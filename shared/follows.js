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
