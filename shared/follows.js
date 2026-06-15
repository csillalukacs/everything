// Pure-JS follow helpers shared by mobile + web. See sql/add_follows.sql.
// The DB enforces the block rules (can't follow a blocked user; blocking drops
// follows both ways), so these stay thin.

export async function followUser(client, { followerId, followedId }) {
  const { error } = await client
    .from('follows')
    .upsert({ follower_id: followerId, followed_id: followedId }, { onConflict: 'follower_id,followed_id', ignoreDuplicates: true });
  if (error) throw error;
}

export async function unfollowUser(client, { followerId, followedId }) {
  const { error } = await client
    .from('follows')
    .delete()
    .eq('follower_id', followerId)
    .eq('followed_id', followedId);
  if (error) throw error;
}

// Returns the set of user ids the given user follows.
export async function fetchFollowingIds(client, followerId) {
  if (!followerId) return [];
  const { data, error } = await client
    .from('follows')
    .select('followed_id')
    .eq('follower_id', followerId);
  if (error) throw error;
  return (data ?? []).map(r => r.followed_id);
}

// { followers, following } counts for a user. Follows are public (see SQL).
export async function fetchFollowCounts(client, userId) {
  if (!userId) return { followers: 0, following: 0 };
  const [followersRes, followingRes] = await Promise.all([
    client.from('follows').select('*', { count: 'exact', head: true }).eq('followed_id', userId),
    client.from('follows').select('*', { count: 'exact', head: true }).eq('follower_id', userId),
  ]);
  if (followersRes.error) throw followersRes.error;
  if (followingRes.error) throw followingRes.error;
  return { followers: followersRes.count ?? 0, following: followingRes.count ?? 0 };
}

// Profiles for a user's followers (mode 'followers') or the users they follow
// (mode 'following'), most recent edge first.
export async function fetchFollowList(client, userId, mode) {
  if (!userId) return [];
  const selfCol = mode === 'followers' ? 'followed_id' : 'follower_id';
  const otherCol = mode === 'followers' ? 'follower_id' : 'followed_id';
  const { data: edges, error } = await client
    .from('follows')
    .select(`${otherCol}, created_at`)
    .eq(selfCol, userId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  const ids = (edges ?? []).map(e => e[otherCol]);
  if (!ids.length) return [];

  const { data: profiles, error: pErr } = await client
    .from('profiles')
    .select('user_id, display_name, username, avatar_url, avatar_thumb_url')
    .in('user_id', ids);
  if (pErr) throw pErr;

  // Preserve the edge order (newest follow first).
  const byId = new Map((profiles ?? []).map(p => [p.user_id, p]));
  return ids.map(id => byId.get(id) ?? { user_id: id }).filter(Boolean);
}
