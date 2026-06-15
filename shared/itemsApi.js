const PAGE_SIZE = 1000;

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
    .select('*, tags(id, name, is_private)')
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

// Unified cross-user feed: item-add events merged with "used today" usage events,
// each carrying its item + the poster's profile, sorted newest-first by insert time.
// Returns events shaped { type: 'add' | 'usage', key, at, used_on?, item }.
export async function fetchFeedEvents(client, { limit = 50, blockedIds = [] } = {}) {
  const blocked = new Set(blockedIds);
  const [addsRes, usagesRes] = await Promise.all([
    client
      .from('items')
      .select('*, tags(id, name, is_private)')
      .eq('is_private', false)
      .is('retired_at', null)
      .order('created_at', { ascending: false })
      .limit(limit),
    client
      .from('item_usages')
      .select('id, used_on, created_at, item:items!inner(*, tags(id, name, is_private))')
      .eq('on_feed', true)
      .eq('item.is_private', false)
      .is('item.retired_at', null)
      .order('created_at', { ascending: false })
      .limit(limit),
  ]);
  if (addsRes.error) throw addsRes.error;
  if (usagesRes.error) throw usagesRes.error;

  const addEvents = (addsRes.data ?? []).map(item => ({
    type: 'add', key: `add-${item.id}`, at: item.created_at, item,
  }));
  const usageEvents = (usagesRes.data ?? [])
    .filter(u => u.item)
    .map(u => ({ type: 'usage', key: `use-${u.id}`, at: u.created_at, used_on: u.used_on, item: u.item }));

  const events = [...addEvents, ...usageEvents]
    .filter(e => !blocked.has(e.item.user_id))
    .sort((a, b) => new Date(b.at) - new Date(a.at))
    .slice(0, limit);
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
