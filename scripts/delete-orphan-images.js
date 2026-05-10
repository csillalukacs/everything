#!/usr/bin/env node
// Delete files in the item-images bucket that aren't referenced by any row in
// `items` (image_url, thumb_url, or previous_images entries).
//
// Usage:
//   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node scripts/delete-orphan-images.js
//
// Optional:
//   USER_ID=<uuid>      restrict cleanup to one user's folder
//   DRY_RUN=1           list what would be deleted without removing it
//   MIN_AGE_MINUTES=60  skip files newer than this (default 60) to avoid racing
//                       with in-flight uploads whose DB row hasn't landed yet

const { createClient } = require('@supabase/supabase-js');

const ITEM_IMAGES_BUCKET = 'item-images';
const STORAGE_PATH_MARKER = `/${ITEM_IMAGES_BUCKET}/`;

function imagePathFromUrl(url) {
  if (!url || typeof url !== 'string') return null;
  const idx = url.indexOf(STORAGE_PATH_MARKER);
  if (idx === -1) return null;
  return url.slice(idx + STORAGE_PATH_MARKER.length).split('?')[0] || null;
}

function imagePathsForItem(item) {
  const paths = [];
  const push = u => { const p = imagePathFromUrl(u); if (p) paths.push(p); };
  push(item?.image_url);
  push(item?.thumb_url);
  if (Array.isArray(item?.previous_images)) {
    for (const e of item.previous_images) {
      push(e?.url);
      push(e?.thumb_url);
    }
  }
  return paths;
}

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY required');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });
const DRY_RUN = process.env.DRY_RUN === '1';
const ONLY_USER = process.env.USER_ID || null;
const MIN_AGE_MS = (parseInt(process.env.MIN_AGE_MINUTES, 10) || 60) * 60_000;
const LIST_PAGE = 1000;
const REMOVE_BATCH = 200;

async function fetchReferencedPaths() {
  const referenced = new Set();
  const PAGE = 1000;
  let from = 0;
  for (;;) {
    let q = supabase
      .from('items')
      .select('image_url, thumb_url, previous_images, user_id')
      .range(from, from + PAGE - 1);
    if (ONLY_USER) q = q.eq('user_id', ONLY_USER);
    const { data, error } = await q;
    if (error) throw error;
    for (const item of data) for (const p of imagePathsForItem(item)) referenced.add(p);
    if (data.length < PAGE) break;
    from += PAGE;
  }
  return referenced;
}

async function listUserFolders() {
  if (ONLY_USER) return [ONLY_USER];
  const folders = [];
  let offset = 0;
  for (;;) {
    const { data, error } = await supabase.storage
      .from(ITEM_IMAGES_BUCKET)
      .list('', { limit: LIST_PAGE, offset });
    if (error) throw error;
    for (const entry of data) if (entry.id === null) folders.push(entry.name);
    if (data.length < LIST_PAGE) break;
    offset += LIST_PAGE;
  }
  return folders;
}

async function listUserFiles(userId) {
  const files = [];
  let offset = 0;
  for (;;) {
    const { data, error } = await supabase.storage
      .from(ITEM_IMAGES_BUCKET)
      .list(userId, { limit: LIST_PAGE, offset });
    if (error) throw error;
    for (const entry of data) {
      if (entry.id === null) continue;
      files.push({
        path: `${userId}/${entry.name}`,
        createdAt: entry.created_at ? new Date(entry.created_at).getTime() : 0,
      });
    }
    if (data.length < LIST_PAGE) break;
    offset += LIST_PAGE;
  }
  return files;
}

async function removeBatch(paths) {
  if (DRY_RUN) return;
  for (let i = 0; i < paths.length; i += REMOVE_BATCH) {
    const slice = paths.slice(i, i + REMOVE_BATCH);
    const { error } = await supabase.storage.from(ITEM_IMAGES_BUCKET).remove(slice);
    if (error) throw error;
  }
}

async function main() {
  console.log(`Scanning ${ITEM_IMAGES_BUCKET}${ONLY_USER ? ` for user ${ONLY_USER}` : ''}${DRY_RUN ? ' (dry run)' : ''}`);

  const folders = await listUserFolders();
  console.log(`${folders.length} user folder${folders.length === 1 ? '' : 's'}`);

  const referenced = await fetchReferencedPaths();
  console.log(`${referenced.size} referenced paths in DB`);

  const cutoff = Date.now() - MIN_AGE_MS;
  const orphans = [];
  let totalFiles = 0, tooNew = 0;

  for (const folder of folders) {
    const files = await listUserFiles(folder);
    totalFiles += files.length;
    for (const f of files) {
      if (referenced.has(f.path)) continue;
      if (f.createdAt > cutoff) { tooNew++; continue; }
      orphans.push(f.path);
    }
  }

  console.log(`${totalFiles} files in storage, ${orphans.length} orphaned, ${tooNew} skipped (too new)`);
  if (orphans.length === 0) return;

  if (DRY_RUN) {
    for (const p of orphans) console.log(`  would delete: ${p}`);
  } else {
    await removeBatch(orphans);
    console.log(`deleted ${orphans.length} orphaned file${orphans.length === 1 ? '' : 's'}`);
  }
}

main().catch(e => { console.error(e); process.exit(1); });
