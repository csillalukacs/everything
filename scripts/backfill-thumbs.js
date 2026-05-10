#!/usr/bin/env node
// Backfill thumb_url on items by generating 400px WebP thumbnails.
// Also fills in thumb_url on previous_images JSONB entries.
//
// One-time install (sharp is heavy, not added to package.json):
//   npm i --no-save sharp
//
// Usage:
//   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node scripts/backfill-thumbs.js
//
// Optional:
//   USER_ID=<uuid>   restrict to one user
//   LIMIT=<n>        process at most n items
//   DRY_RUN=1        log without writing storage or DB

const { createClient } = require('@supabase/supabase-js');
const sharp = require('sharp');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY required');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });
const DRY_RUN = process.env.DRY_RUN === '1';
const BUCKET = 'item-images';

function thumbPathFromUrl(url) {
  const marker = `/${BUCKET}/`;
  const idx = url.indexOf(marker);
  if (idx === -1) return null;
  const path = url.slice(idx + marker.length).split('?')[0];
  const dot = path.lastIndexOf('.');
  const base = dot > 0 ? path.slice(0, dot) : path;
  return `${base}_thumb.webp`;
}

async function generateAndUploadThumb(originalUrl) {
  const thumbPath = thumbPathFromUrl(originalUrl);
  if (!thumbPath) throw new Error(`bad url: ${originalUrl}`);
  const res = await fetch(originalUrl);
  if (!res.ok) throw new Error(`fetch ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  const thumbBuf = await sharp(buf)
    .resize({ width: 400, withoutEnlargement: true })
    .webp({ quality: 85 })
    .toBuffer();
  if (!DRY_RUN) {
    const { error } = await supabase.storage
      .from(BUCKET)
      .upload(thumbPath, thumbBuf, {
        contentType: 'image/webp',
        cacheControl: '31536000, immutable',
        upsert: true,
      });
    if (error) throw error;
  }
  const { data: { publicUrl } } = supabase.storage.from(BUCKET).getPublicUrl(thumbPath);
  return { thumbUrl: publicUrl, bytes: thumbBuf.length, originalBytes: buf.length };
}

async function processItem(item) {
  let didWork = false;
  let newThumbUrl = item.thumb_url;
  let saved = 0;
  let processed = 0;

  if (!item.thumb_url && item.image_url) {
    const { thumbUrl, bytes, originalBytes } = await generateAndUploadThumb(item.image_url);
    newThumbUrl = thumbUrl;
    saved += originalBytes - bytes;
    processed++;
    didWork = true;
  }

  let newPrev = item.previous_images;
  if (Array.isArray(item.previous_images) && item.previous_images.length > 0) {
    const needed = item.previous_images.some(e => e?.url && !e.thumb_url);
    if (needed) {
      const updated = [];
      for (const entry of item.previous_images) {
        if (!entry?.url || entry.thumb_url) {
          updated.push(entry);
          continue;
        }
        try {
          const { thumbUrl, bytes, originalBytes } = await generateAndUploadThumb(entry.url);
          saved += originalBytes - bytes;
          processed++;
          updated.push({ ...entry, thumb_url: thumbUrl });
          didWork = true;
        } catch (e) {
          console.error(`  prev fail ${entry.url}: ${e.message}`);
          updated.push(entry);
        }
      }
      newPrev = updated;
    }
  }

  if (didWork && !DRY_RUN) {
    const patch = { thumb_url: newThumbUrl };
    if (newPrev !== item.previous_images) patch.previous_images = newPrev;
    const { error } = await supabase.from('items').update(patch).eq('id', item.id);
    if (error) throw error;
  }
  return { didWork, saved, processed };
}

async function main() {
  let q = supabase
    .from('items')
    .select('id, image_url, thumb_url, previous_images')
    .not('image_url', 'is', null)
    .order('created_at', { ascending: false });
  if (process.env.USER_ID) q = q.eq('user_id', process.env.USER_ID);
  if (process.env.LIMIT) q = q.limit(parseInt(process.env.LIMIT, 10));
  const { data: items, error } = await q;
  if (error) throw error;

  console.log(`${items.length} items to inspect${DRY_RUN ? ' (dry run)' : ''}`);
  let ok = 0, skipped = 0, fail = 0, totalSaved = 0, totalProcessed = 0;
  for (const item of items) {
    try {
      const { didWork, saved, processed } = await processItem(item);
      if (didWork) {
        ok++;
        totalSaved += saved;
        totalProcessed += processed;
        const ratio = saved > 0 ? `${((saved / (saved + (processed > 0 ? 0 : 1))) * 100).toFixed(0)}%` : '';
        console.log(`[ok]   ${item.id}  +${processed} thumb${processed === 1 ? '' : 's'}, saved ${(saved / 1024).toFixed(0)} KB`);
      } else {
        skipped++;
      }
    } catch (e) {
      fail++;
      console.error(`[fail] ${item.id}  ${e.message}`);
    }
  }
  const mb = (totalSaved / 1024 / 1024).toFixed(1);
  console.log(`\ndone: ${ok} items updated (${totalProcessed} thumbs generated, ~${mb} MB savings per full collection fetch), ${skipped} already done, ${fail} failed`);
}

main().catch(e => { console.error(e); process.exit(1); });
