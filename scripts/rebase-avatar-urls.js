#!/usr/bin/env node
// Repoint avatar_url and avatar_thumb_url on every profiles row from one R2
// public base to another. Use this when the bucket stays the same (identical
// object keys) but the public hostname changes — e.g. moving off the
// pub-xxx.r2.dev dev domain onto a Cloudflare custom domain. Idempotent: rows
// already on NEW_R2_BASE are left alone.
//
// Usage:
//   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... \
//   OLD_R2_BASE=https://pub-xxx.r2.dev NEW_R2_BASE=https://img.example.com \
//     node scripts/rebase-avatar-urls.js
//
// Optional:
//   USER_ID=<uuid>    restrict to one user
//   DRY_RUN=1         log changes without writing

const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const OLD_R2_BASE = (process.env.OLD_R2_BASE || '').replace(/\/+$/, '');
const NEW_R2_BASE = (process.env.NEW_R2_BASE || '').replace(/\/+$/, '');
if (!SUPABASE_URL || !SERVICE_KEY || !OLD_R2_BASE || !NEW_R2_BASE) {
  console.error('SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, OLD_R2_BASE, NEW_R2_BASE required');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });
const DRY_RUN = process.env.DRY_RUN === '1';
const ONLY_USER = process.env.USER_ID || null;

function rewrite(url) {
  if (!url || typeof url !== 'string') return url;
  if (url.startsWith(NEW_R2_BASE + '/')) return url;
  if (!url.startsWith(OLD_R2_BASE + '/')) return url;
  return NEW_R2_BASE + url.slice(OLD_R2_BASE.length);
}

async function main() {
  console.log(`Rebasing avatar URLs ${OLD_R2_BASE} → ${NEW_R2_BASE}${ONLY_USER ? ` for user ${ONLY_USER}` : ''}${DRY_RUN ? ' (dry run)' : ''}`);

  const PAGE = 1000;
  let from = 0;
  let total = 0, changed = 0, fail = 0;

  for (;;) {
    let q = supabase
      .from('profiles')
      .select('user_id, avatar_url, avatar_thumb_url')
      .order('user_id')
      .range(from, from + PAGE - 1);
    if (ONLY_USER) q = q.eq('user_id', ONLY_USER);
    const { data, error } = await q;
    if (error) throw error;
    if (data.length === 0) break;

    for (const row of data) {
      total++;
      const newAvatar = rewrite(row.avatar_url);
      const newThumb = rewrite(row.avatar_thumb_url);
      const patch = {};
      if (newAvatar !== row.avatar_url) patch.avatar_url = newAvatar;
      if (newThumb !== row.avatar_thumb_url) patch.avatar_thumb_url = newThumb;
      if (Object.keys(patch).length === 0) continue;
      changed++;

      if (DRY_RUN) {
        const summary = Object.keys(patch).join(',');
        console.log(`[would update] ${row.user_id}  fields: ${summary}`);
        continue;
      }
      const { error: uErr } = await supabase.from('profiles').update(patch).eq('user_id', row.user_id);
      if (uErr) {
        fail++;
        console.error(`[fail] ${row.user_id}: ${uErr.message}`);
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
