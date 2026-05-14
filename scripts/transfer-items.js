#!/usr/bin/env node
// Transfer items from one user to another.
//
// Updates items.user_id and rewires item_tags so each tag still applies, by
// reusing or creating a same-named tag on the target user. Source-side tag
// rows are left untouched (other items the source still owns may use them).
//
// Image storage paths keep their original {source_user_id}/... prefix; only the
// owning row in the items table changes. The public URLs continue to work.
//
// Usage:
//   FROM_USER_ID=<uuid> TO_USER_ID=<uuid> \
//   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... \
//   node scripts/transfer-items.js
//
// Optional:
//   ITEM_IDS=<csv>   only transfer these item ids (default: all items owned by FROM)
//   LIMIT=<n>        cap number of items
//   DRY_RUN=1        log the plan without writing (default behavior — set APPLY=1 to actually run)
//   APPLY=1          required to actually write. Without it the script is a dry run.

const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const FROM = process.env.FROM_USER_ID;
const TO = process.env.TO_USER_ID;
const APPLY = process.env.APPLY === '1' && process.env.DRY_RUN !== '1';
const LIMIT = process.env.LIMIT ? parseInt(process.env.LIMIT, 10) : null;
const ITEM_IDS = process.env.ITEM_IDS
  ? process.env.ITEM_IDS.split(',').map(s => s.trim()).filter(Boolean)
  : null;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function die(msg) { console.error(msg); process.exit(1); }

if (!SUPABASE_URL || !SERVICE_KEY) die('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY required');
if (!FROM || !TO) die('FROM_USER_ID and TO_USER_ID required');
if (!UUID_RE.test(FROM)) die(`FROM_USER_ID not a uuid: ${FROM}`);
if (!UUID_RE.test(TO)) die(`TO_USER_ID not a uuid: ${TO}`);
if (FROM === TO) die('FROM_USER_ID and TO_USER_ID are the same; nothing to do');

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

async function fetchSourceItems() {
  let q = supabase
    .from('items')
    .select('id, name, tags(id, name)')
    .eq('user_id', FROM)
    .order('created_at', { ascending: true });
  if (ITEM_IDS) q = q.in('id', ITEM_IDS);
  if (LIMIT) q = q.limit(LIMIT);
  const { data, error } = await q;
  if (error) throw error;
  return data;
}

// Map of source tag name (lowercased) -> { source_tag_id, target_tag_id }.
// Names on the tags table are stored lowercase per app convention.
async function resolveTargetTags(sourceItems) {
  const nameToSourceId = new Map();
  for (const item of sourceItems) {
    for (const tag of item.tags || []) {
      const name = (tag.name || '').toLowerCase();
      if (!name) continue;
      if (!nameToSourceId.has(name)) nameToSourceId.set(name, tag.id);
    }
  }
  const names = [...nameToSourceId.keys()];
  if (names.length === 0) return { mapBySourceId: new Map(), createdCount: 0 };

  const { data: existing, error: exErr } = await supabase
    .from('tags')
    .select('id, name')
    .eq('user_id', TO)
    .in('name', names);
  if (exErr) throw exErr;
  const existingByName = new Map(existing.map(t => [t.name, t.id]));

  const toCreate = names.filter(n => !existingByName.has(n));
  let createdCount = 0;
  if (toCreate.length > 0) {
    if (APPLY) {
      const { data: inserted, error: insErr } = await supabase
        .from('tags')
        .insert(toCreate.map(name => ({ name, user_id: TO })))
        .select('id, name');
      if (insErr) throw insErr;
      for (const t of inserted) existingByName.set(t.name, t.id);
    }
    createdCount = toCreate.length;
  }

  const mapBySourceId = new Map();
  for (const [name, sourceId] of nameToSourceId) {
    const targetId = existingByName.get(name);
    // In dry-run, target ids for tags-to-be-created won't exist yet.
    mapBySourceId.set(sourceId, targetId || null);
  }
  return { mapBySourceId, createdCount, willCreate: toCreate };
}

async function transferItem(item, tagMap) {
  const tagLinks = (item.tags || []).map(t => ({
    sourceTagId: t.id,
    targetTagId: tagMap.get(t.id),
    name: t.name,
  }));

  if (APPLY) {
    // 1. Insert new item_tags rows for the target tag ids (idempotent).
    const inserts = tagLinks
      .filter(l => l.targetTagId)
      .map(l => ({ item_id: item.id, tag_id: l.targetTagId }));
    if (inserts.length > 0) {
      const { error } = await supabase
        .from('item_tags')
        .upsert(inserts, { onConflict: 'item_id,tag_id', ignoreDuplicates: true });
      if (error) throw new Error(`item_tags insert: ${error.message}`);
    }

    // 2. Delete the source-tag links for this item.
    const sourceTagIds = tagLinks.map(l => l.sourceTagId);
    if (sourceTagIds.length > 0) {
      const { error } = await supabase
        .from('item_tags')
        .delete()
        .eq('item_id', item.id)
        .in('tag_id', sourceTagIds);
      if (error) throw new Error(`item_tags delete: ${error.message}`);
    }

    // 3. Reassign the item itself.
    const { error } = await supabase
      .from('items')
      .update({ user_id: TO })
      .eq('id', item.id);
    if (error) throw new Error(`items update: ${error.message}`);
  }

  return tagLinks.length;
}

async function main() {
  console.log(`transfer: ${FROM} -> ${TO}`);
  console.log(APPLY ? 'mode: APPLY (writes enabled)' : 'mode: DRY RUN (set APPLY=1 to write)');

  const items = await fetchSourceItems();
  console.log(`${items.length} item(s) to transfer${ITEM_IDS ? ' (filtered by ITEM_IDS)' : ''}${LIMIT ? ` (capped at ${LIMIT})` : ''}`);
  if (items.length === 0) return;

  const { mapBySourceId, createdCount, willCreate } = await resolveTargetTags(items);
  if (createdCount > 0) {
    console.log(`tags to create on target user: ${createdCount} (${willCreate.join(', ')})`);
  } else {
    console.log('no new tags need to be created on target user');
  }

  let ok = 0, fail = 0, totalLinks = 0;
  for (const item of items) {
    try {
      const linkCount = await transferItem(item, mapBySourceId);
      ok++;
      totalLinks += linkCount;
      console.log(`[ok]   ${item.id}  "${item.name ?? ''}"  (${linkCount} tag link${linkCount === 1 ? '' : 's'})`);
    } catch (e) {
      fail++;
      console.error(`[fail] ${item.id}  ${e.message}`);
    }
  }

  console.log(`\ndone: ${ok} item(s) transferred, ${fail} failed, ${totalLinks} tag link(s) rewired`);
  if (!APPLY) console.log('(dry run — nothing was written. Re-run with APPLY=1 to commit.)');
}

main().catch(e => { console.error(e); process.exit(1); });
