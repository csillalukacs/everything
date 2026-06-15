// Pure-JS moderation helpers shared by mobile + web.
// Reason *labels* live in shared/strings.js (S.moderation.reasons); only the stored
// value lives with each report. See sql/add_moderation.sql for the table shapes.

export async function submitReport(client, { reporterId, targetType, targetId, targetUserId = null, reason }) {
  const { error } = await client.from('reports').insert({
    reporter_id: reporterId,
    target_type: targetType,
    target_id: targetId,
    target_user_id: targetUserId,
    reason,
  });
  if (error) throw error;
}

export async function blockUser(client, { blockerId, blockedId }) {
  const { error } = await client
    .from('blocks')
    .upsert({ blocker_id: blockerId, blocked_id: blockedId }, { onConflict: 'blocker_id,blocked_id', ignoreDuplicates: true });
  if (error) throw error;
}

export async function unblockUser(client, { blockerId, blockedId }) {
  const { error } = await client
    .from('blocks')
    .delete()
    .eq('blocker_id', blockerId)
    .eq('blocked_id', blockedId);
  if (error) throw error;
}

// Returns the set of user ids the given user has blocked.
export async function fetchBlockedIds(client, blockerId) {
  if (!blockerId) return [];
  const { data, error } = await client
    .from('blocks')
    .select('blocked_id')
    .eq('blocker_id', blockerId);
  if (error) throw error;
  return (data ?? []).map(r => r.blocked_id);
}

// Returns the set of user ids that have blocked the *current* user (the reverse
// of fetchBlockedIds). Goes through the blocked_by_ids() RPC because the blocks
// RLS only lets the blocker read their own rows — see sql/add_blocked_by_rpc.sql.
// Used to hide the viewer's items from people who blocked them on the feed.
export async function fetchBlockedByIds(client) {
  const { data, error } = await client.rpc('blocked_by_ids');
  if (error) throw error;
  return data ?? [];
}
