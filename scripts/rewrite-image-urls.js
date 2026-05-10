#!/usr/bin/env node
// Rewrite image_url, thumb_url, and previous_images[].url / .thumb_url on every
// items row to point at R2 instead of Supabase Storage. Idempotent: rows whose
// URLs already point to R2 are left alone.
//
// Assumes objects in R2 are at the same key as in Supabase (same path after
// the bucket prefix), which is what scripts/migrate-to-r2.js produces.
//
// Usage:
//   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... R2_PUBLIC_BASE=https://pub-xxx.r2.dev \
//     node scripts/rewrite-image-urls.js
//
// Optional:
//   USER_ID=<uuid>    restrict to one user
//   DRY_RUN=1         log changes without writing

const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const R2_PUBLIC_BASE = (process.env.R2_PUBLIC_BASE || '').replace(/\/+$/, '');
if (!SUPABASE_URL || !SERVICE_KEY || !R2_PUBLIC_BASE) {
  console.error('SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, R2_PUBLIC_BASE required');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });
const DRY_RUN = process.env.DRY_RUN === '1';
const ONLY_USER = process.env.USER_ID || null;
const STORAGE_MARKER = '/item-images/';

function rewrite(url) {
  if (!url || typeof url !== 'string') return url;
  if (url.startsWith(R2_PUBLIC_BASE + '/')) return url;
  const idx = url.indexOf(STORAGE_MARKER);
  if (idx === -1) return url;
  const path = url.slice(idx + STORAGE_MARKER.length).split('?')[0];
  return `${R2_PUBLIC_BASE}/${path}`;
}

function rewritePreviousImages(prev) {
  if (!Array.isArray(prev)) return prev;
  let changed = false;
  const next = prev.map(entry => {
    if (!entry || typeof entry !== 'object') return entry;
    const url = rewrite(entry.url);
    const thumb_url = rewrite(entry.thumb_url);
    if (url !== entry.url || thumb_url !== entry.thumb_url) {
      changed = true;
      return { ...entry, url, thumb_url };
    }
    return entry;
  });
  return changed ? next : prev;
}

async function main() {
  console.log(`Rewriting URLs → ${R2_PUBLIC_BASE}${ONLY_USER ? ` for user ${ONLY_USER}` : ''}${DRY_RUN ? ' (dry run)' : ''}`);

  const PAGE = 1000;
  let from = 0;
  let total = 0, changed = 0, fail = 0;

  for (;;) {
    let q = supabase
      .from('items')
      .select('id, image_url, thumb_url, previous_images')
      .order('id')
      .range(from, from + PAGE - 1);
    if (ONLY_USER) q = q.eq('user_id', ONLY_USER);
    const { data, error } = await q;
    if (error) throw error;
    if (data.length === 0) break;

    for (const item of data) {
      total++;
      const newImage = rewrite(item.image_url);
      const newThumb = rewrite(item.thumb_url);
      const newPrev = rewritePreviousImages(item.previous_images);
      const patch = {};
      if (newImage !== item.image_url) patch.image_url = newImage;
      if (newThumb !== item.thumb_url) patch.thumb_url = newThumb;
      if (newPrev !== item.previous_images) patch.previous_images = newPrev;
      if (Object.keys(patch).length === 0) continue;
      changed++;

      if (DRY_RUN) {
        const summary = Object.keys(patch).join(',');
        console.log(`[would update] ${item.id}  fields: ${summary}`);
        continue;
      }
      const { error: uErr } = await supabase.from('items').update(patch).eq('id', item.id);
      if (uErr) {
        fail++;
        console.error(`[fail] ${item.id}: ${uErr.message}`);
      } else {
        if (changed % 50 === 0) console.log(`  progress: ${changed} updated`);
      }
    }

    if (data.length < PAGE) break;
    from += PAGE;
  }

  console.log(`\ndone: ${total} scanned, ${changed} ${DRY_RUN ? 'would change' : 'updated'}, ${fail} failed`);
  if (fail > 0) process.exit(1);
}

main().catch(e => { console.error(e); process.exit(1); });
