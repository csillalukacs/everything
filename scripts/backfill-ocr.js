#!/usr/bin/env node
// Backfill ocr_text for items where it is null.
// Uses macOS Vision via scripts/ocr-image.swift (same engine as iOS).
//
// Usage:
//   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node scripts/backfill-ocr.js
//
// Optional:
//   USER_ID=<uuid>   restrict to one user
//   LIMIT=<n>        process at most n items
//   DRY_RUN=1        log results without writing

const { createClient } = require('@supabase/supabase-js');
const { execFile } = require('child_process');
const { writeFile, unlink } = require('fs/promises');
const { tmpdir } = require('os');
const { join, dirname, extname } = require('path');
const { promisify } = require('util');

const exec = promisify(execFile);

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY required');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });
const SWIFT_SCRIPT = join(__dirname, 'ocr-image.swift');
const DRY_RUN = process.env.DRY_RUN === '1';

async function ocrUrl(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`fetch ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  const ext = extname(new URL(url).pathname) || '.jpg';
  const path = join(tmpdir(), `ocr-${process.pid}-${Date.now()}${ext}`);
  await writeFile(path, buf);
  try {
    const { stdout } = await exec('swift', [SWIFT_SCRIPT, path], { maxBuffer: 10 * 1024 * 1024 });
    return stdout.trim() || null;
  } finally {
    await unlink(path).catch(() => {});
  }
}

async function main() {
  let q = supabase
    .from('items')
    .select('id, image_url')
    .is('ocr_text', null)
    .not('image_url', 'is', null)
    .order('created_at', { ascending: false });
  if (process.env.USER_ID) q = q.eq('user_id', process.env.USER_ID);
  if (process.env.LIMIT) q = q.limit(parseInt(process.env.LIMIT, 10));
  const { data: items, error } = await q;
  if (error) throw error;

  console.log(`${items.length} items to process${DRY_RUN ? ' (dry run)' : ''}`);
  let ok = 0, empty = 0, fail = 0;
  for (const item of items) {
    try {
      const text = await ocrUrl(item.image_url);
      if (!DRY_RUN) {
        const { error: upErr } = await supabase
          .from('items')
          .update({ ocr_text: text })
          .eq('id', item.id);
        if (upErr) throw upErr;
      }
      if (text) {
        ok++;
        const preview = text.slice(0, 60).replace(/\s+/g, ' ');
        console.log(`[ok]    ${item.id}  ${preview}${text.length > 60 ? '...' : ''}`);
      } else {
        empty++;
        console.log(`[empty] ${item.id}`);
      }
    } catch (e) {
      fail++;
      console.error(`[fail]  ${item.id}  ${e.message}`);
    }
  }
  console.log(`\ndone: ${ok} with text, ${empty} empty, ${fail} failed`);
}

main().catch(e => { console.error(e); process.exit(1); });
