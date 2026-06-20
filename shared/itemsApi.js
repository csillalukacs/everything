const PAGE_SIZE = 1000;

// Columns the feed actually consumes (row display + ItemDetailModal). Deliberately
// excludes ocr_text: it's the largest column (full recognized text per image) and
// the feed/detail views never read it — pulling it for up to ~200 rows per load was
// the bulk of the feed payload. The detail modal regenerates OCR on save anyway.
const FEED_COLUMNS =
  'id, user_id, name, description, image_url, thumb_url, previous_images, image_added_at, ' +
  'is_private, acquired_year, acquired_location, acquired_lat, acquired_lng, ' +
  'usage_count, last_used_on, created_at, updated_at, retired_at, tags(id, name, is_private)';

export async function fetchAllItems(client, { userId, publicOnly = false, columns = '*, tags(id, name, is_private)' } = {}) {
  // Keyset pagination on (created_at desc, id desc) — see the matching indexes in
  // sql/add_items_collection_indexes.sql. Faster than OFFSET (which scans and
  // discards every prior page) and stable when rows share a created_at.
  let cursor = null; // { created_at, id } of the last row returned, or null on page 1
  const all = [];
  for (;;) {
    let query = client
      .from('items')
      .select(columns)
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .order('id', { ascending: false })
      .limit(PAGE_SIZE);
    if (cursor) {
      query = query.or(
        `created_at.lt.${cursor.created_at},and(created_at.eq.${cursor.created_at},id.lt.${cursor.id})`
      );
    }
    // Retired (graveyard) items are owner-only; never expose them publicly.
    if (publicOnly) query = query.eq('is_private', false).is('retired_at', null);
    const { data, error } = await query;
    if (error) throw error;
    all.push(...data);
    if (data.length < PAGE_SIZE) break;
    const last = data[data.length - 1];
    cursor = { created_at: last.created_at, id: last.id };
  }
  return all;
}

export async function fetchPublicFeed(client, { limit = 50, blockedIds = [] } = {}) {
  const { data: rawItems, error } = await client
    .from('items')
    .select(FEED_COLUMNS)
    .eq('is_private', false)
    .is('retired_at', null)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  const blocked = new Set(blockedIds);
  const items = (rawItems ?? []).filter(i => !blocked.has(i.user_id));
  if (!items.length) return [];

  const userIds = [...new Set(items.map(i => i.user_id))];
  const { data: profiles, error: pErr } = await client
    .from('profiles')
    .select('user_id, display_name, username, avatar_url, avatar_thumb_url')
    .in('user_id', userIds);
  if (pErr) throw pErr;

  const profileMap = new Map((profiles ?? []).map(p => [p.user_id, p]));
  return items.map(item => ({
    ...item,
    profile: profileMap.get(item.user_id) ?? null,
  }));
}

// Cross-user feed of item-add events, each carrying its item + the poster's
// profile, sorted newest-first by insert time.
// Returns events shaped { type: 'add', key, at, item }.
// authorIds: when provided, restrict the feed to these users (the "friends" tab).
// An empty array yields an empty feed (you follow no one). null = everyone.
// before: a created_at ISO cursor for keyset pagination — only events strictly
// older than it are returned. Pass the `at` of the last event of the previous
// page to load the next page (infinite scroll).
export async function fetchFeedEvents(client, { limit = 50, blockedIds = [], authorIds = null, before = null } = {}) {
  const blocked = new Set(blockedIds);
  if (authorIds && authorIds.length === 0) return [];

  let addsQuery = client
    .from('items')
    .select(FEED_COLUMNS)
    .eq('is_private', false)
    .is('retired_at', null);
  if (authorIds) addsQuery = addsQuery.in('user_id', authorIds);
  if (before) addsQuery = addsQuery.lt('created_at', before);

  const { data, error } = await addsQuery
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;

  const events = (data ?? [])
    .filter(item => !blocked.has(item.user_id))
    .map(item => ({ type: 'add', key: `add-${item.id}`, at: item.created_at, item }));
  if (!events.length) return [];

  const userIds = [...new Set(events.map(e => e.item.user_id))];
  const { data: profiles, error: pErr } = await client
    .from('profiles')
    .select('user_id, display_name, username, avatar_url, avatar_thumb_url')
    .in('user_id', userIds);
  if (pErr) throw pErr;

  const profileMap = new Map((profiles ?? []).map(p => [p.user_id, p]));
  for (const e of events) {
    const profile = profileMap.get(e.item.user_id) ?? null;
    e.profile = profile;
    e.item = { ...e.item, profile };
  }
  return events;
}

export async function fetchItemCount(client, { userId, publicOnly = false } = {}) {
  let query = client
    .from('items')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    // The object count reflects the active collection — retired things don't count.
    .is('retired_at', null);
  if (publicOnly) query = query.eq('is_private', false);
  const { count, error } = await query;
  if (error) throw error;
  return count ?? 0;
}
