// Pure-JS favorites ("hearts") helpers shared by mobile + web. See sql/add_likes.sql.
// The DB enforces the rules (can't favorite your own item or a blocked user's item;
// blocking drops favorites both ways; favoriting notifies the owner), so these stay thin.

export async function addLike(client, { userId, itemId }) {
  const { error } = await client
    .from('likes')
    .upsert({ user_id: userId, item_id: itemId }, { onConflict: 'user_id,item_id', ignoreDuplicates: true });
  if (error) throw error;
}

export async function removeLike(client, { userId, itemId }) {
  const { error } = await client
    .from('likes')
    .delete()
    .eq('user_id', userId)
    .eq('item_id', itemId);
  if (error) throw error;
}

// The set of item ids the given user has favorited — drives the heart's filled state.
export async function fetchLikedItemIds(client, userId) {
  if (!userId) return [];
  const { data, error } = await client
    .from('likes')
    .select('item_id')
    .eq('user_id', userId);
  if (error) throw error;
  return (data ?? []).map(r => r.item_id);
}

// The user's favorites as full item objects (with owner profile + tags), newest
// favorite first. Items that went private, were retired, or whose owner is blocked
// in either direction are hidden (not deleted — see sql/add_likes.sql), so favorites
// only ever surface other people's currently-public things.
export async function fetchFavorites(client, userId, { blockedIds = [], blockedByIds = [] } = {}) {
  if (!userId) return [];
  const { data, error } = await client
    .from('likes')
    .select('created_at, item:items(*, tags(id, name, is_private))')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
  if (error) throw error;

  const hidden = new Set([...blockedIds, ...blockedByIds]);
  const rows = (data ?? []).filter(r =>
    r.item && !r.item.is_private && !r.item.retired_at && !hidden.has(r.item.user_id),
  );
  if (!rows.length) return [];

  const userIds = [...new Set(rows.map(r => r.item.user_id))];
  const { data: profiles, error: pErr } = await client
    .from('profiles')
    .select('user_id, display_name, username, avatar_url, avatar_thumb_url')
    .in('user_id', userIds);
  if (pErr) throw pErr;

  const profileMap = new Map((profiles ?? []).map(p => [p.user_id, p]));
  return rows.map(r => ({ ...r.item, profile: profileMap.get(r.item.user_id) ?? null }));
}
