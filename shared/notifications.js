// Pure-JS in-app notification helpers shared by mobile + web. See
// sql/add_notifications.sql. Rows are created by DB triggers; the client only
// reads them, counts unread ones for the badge, and marks them read.

// Unread count for the bell badge. Uses a head/count query like fetchItemCount.
export async function fetchUnreadNotificationCount(client, userId) {
  if (!userId) return 0;
  const { count, error } = await client
    .from('notifications')
    .select('*', { count: 'exact', head: true })
    .eq('recipient_id', userId)
    .is('read_at', null);
  if (error) throw error;
  return count ?? 0;
}

// The notification list, newest first, with each actor's profile attached. Actor
// profiles are fetched in a second query and joined in JS (mirrors fetchFollowList).
export async function fetchNotifications(client, userId, { limit = 50 } = {}) {
  if (!userId) return [];
  const { data, error } = await client
    .from('notifications')
    .select('id, actor_id, type, item_id, created_at, read_at')
    .eq('recipient_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  const rows = data ?? [];
  if (!rows.length) return [];

  const actorIds = [...new Set(rows.map(r => r.actor_id))];
  const { data: profiles, error: pErr } = await client
    .from('profiles')
    .select('user_id, display_name, username, avatar_url, avatar_thumb_url')
    .in('user_id', actorIds);
  if (pErr) throw pErr;

  const byId = new Map((profiles ?? []).map(p => [p.user_id, p]));

  // Like notifications carry an item (one of the recipient's own things); fetch its
  // thumbnail so the row can show what was favorited.
  const itemIds = [...new Set(rows.filter(r => r.item_id).map(r => r.item_id))];
  let itemById = new Map();
  if (itemIds.length) {
    const { data: items, error: iErr } = await client
      .from('items')
      .select('id, name, image_url, thumb_url')
      .in('id', itemIds);
    if (iErr) throw iErr;
    itemById = new Map((items ?? []).map(i => [i.id, i]));
  }

  return rows.map(r => ({
    ...r,
    actor: byId.get(r.actor_id) ?? { user_id: r.actor_id },
    item: r.item_id ? itemById.get(r.item_id) ?? null : null,
  }));
}

// Subscribe to realtime changes on this user's notifications (see
// sql/realtime_notifications.sql). The DB triggers write rows as SECURITY DEFINER;
// RLS (notifications_select_own) scopes the stream to the recipient, so this single
// channel covers both follow and like notifications. `onChange` fires on any change
// (insert = new notification, update = read_at flip) — callers re-fetch the unread
// count rather than trusting the payload. Returns an unsubscribe function.
export function subscribeToNotifications(client, userId, onChange) {
  if (!userId) return () => {};
  const channel = client
    .channel(`notifications:${userId}`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'notifications', filter: `recipient_id=eq.${userId}` },
      onChange,
    )
    .subscribe();
  return () => { client.removeChannel(channel); };
}

// Mark every unread notification read (called when the screen opens). Clears the badge.
export async function markNotificationsRead(client, userId) {
  if (!userId) return;
  const { error } = await client
    .from('notifications')
    .update({ read_at: new Date().toISOString() })
    .eq('recipient_id', userId)
    .is('read_at', null);
  if (error) throw error;
}
