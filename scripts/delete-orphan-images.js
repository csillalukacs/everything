#!/usr/bin/env node
// Delete files in the R2 bucket that aren't referenced by any row in `items`
// (image_url, thumb_url, or previous_images entries).
//
// One-time install:
//   npm i --no-save @aws-sdk/client-s3
//
// Required env:
//   SUPABASE_URL
//   SUPABASE_SERVICE_ROLE_KEY
//   R2_ENDPOINT                https://<account-id>.r2.cloudflarestorage.com
//   R2_ACCESS_KEY_ID
//   R2_SECRET_ACCESS_KEY
//   R2_BUCKET
//
// Optional:
//   USER_ID=<uuid>      restrict cleanup to one user's prefix
//   DRY_RUN=1           list what would be deleted without removing it
//   MIN_AGE_MINUTES=60  skip files newer than this (default 60) so in-flight
//                       uploads whose DB row hasn't landed yet aren't nuked

const { createClient } = require('@supabase/supabase-js');
const {
  S3Client,
  ListObjectsV2Command,
  DeleteObjectsCommand,
} = require('@aws-sdk/client-s3');

const required = [
  'SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY',
  'R2_ENDPOINT', 'R2_ACCESS_KEY_ID', 'R2_SECRET_ACCESS_KEY', 'R2_BUCKET',
];
const missing = required.filter(k => !process.env[k]);
if (missing.length) {
  console.error(`Missing env: ${missing.join(', ')}`);
  process.exit(1);
}

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const r2 = new S3Client({
  endpoint: process.env.R2_ENDPOINT,
  region: 'auto',
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
  },
  forcePathStyle: true,
});

const R2_BUCKET = process.env.R2_BUCKET;
const DRY_RUN = process.env.DRY_RUN === '1';
const ONLY_USER = process.env.USER_ID || null;
const MIN_AGE_MS = (parseInt(process.env.MIN_AGE_MINUTES, 10) || 60) * 60_000;
const DELETE_BATCH = 1000;

function imagePathFromUrl(url) {
  if (!url || typeof url !== 'string') return null;
  const marker = '/item-images/';
  const idx = url.indexOf(marker);
  if (idx !== -1) return url.slice(idx + marker.length).split('?')[0] || null;
  try {
    return new URL(url).pathname.replace(/^\/+/, '').split('?')[0] || null;
  } catch {
    return null;
  }
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

async function listAllR2Files() {
  const files = [];
  let token;
  for (;;) {
    const res = await r2.send(new ListObjectsV2Command({
      Bucket: R2_BUCKET,
      Prefix: ONLY_USER ? `${ONLY_USER}/` : undefined,
      ContinuationToken: token,
      MaxKeys: 1000,
    }));
    for (const obj of res.Contents ?? []) {
      files.push({
        path: obj.Key,
        createdAt: obj.LastModified ? obj.LastModified.getTime() : 0,
      });
    }
    if (!res.IsTruncated) break;
    token = res.NextContinuationToken;
  }
  return files;
}

async function deleteBatched(paths) {
  if (DRY_RUN) return;
  for (let i = 0; i < paths.length; i += DELETE_BATCH) {
    const slice = paths.slice(i, i + DELETE_BATCH);
    const { Errors } = await r2.send(new DeleteObjectsCommand({
      Bucket: R2_BUCKET,
      Delete: { Objects: slice.map(Key => ({ Key })), Quiet: true },
    }));
    if (Errors?.length) {
      for (const e of Errors) console.error(`[fail] ${e.Key}: ${e.Message}`);
    }
  }
}

async function main() {
  console.log(`Scanning R2 bucket ${R2_BUCKET}${ONLY_USER ? ` for user ${ONLY_USER}` : ''}${DRY_RUN ? ' (dry run)' : ''}`);

  const files = await listAllR2Files();
  console.log(`${files.length} files in R2`);

  const referenced = await fetchReferencedPaths();
  console.log(`${referenced.size} referenced paths in DB`);

  const cutoff = Date.now() - MIN_AGE_MS;
  const orphans = [];
  let tooNew = 0;
  for (const f of files) {
    if (referenced.has(f.path)) continue;
    if (f.createdAt > cutoff) { tooNew++; continue; }
    orphans.push(f.path);
  }

  console.log(`${orphans.length} orphaned, ${tooNew} skipped (too new)`);
  if (orphans.length === 0) return;

  if (DRY_RUN) {
    for (const p of orphans) console.log(`  would delete: ${p}`);
  } else {
    await deleteBatched(orphans);
    console.log(`deleted ${orphans.length} orphaned file${orphans.length === 1 ? '' : 's'}`);
  }
}

main().catch(e => { console.error(e); process.exit(1); });
