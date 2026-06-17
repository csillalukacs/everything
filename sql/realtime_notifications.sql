-- Realtime notifications. The notifications table is already written by
-- SECURITY DEFINER triggers (follows_notify, likes_notify) and read-guarded by
-- RLS (notifications_select_own — recipient sees only their own rows). Adding it
-- to the supabase_realtime publication lets clients subscribe via postgres_changes;
-- RLS scopes each socket to its own recipient rows, so a single channel filtered on
-- recipient_id streams both follow and like notifications. The client re-fetches the
-- unread count on each event rather than trusting the payload.
-- See sql/add_notifications.sql, shared/notifications.js (subscribeToNotifications).

alter publication supabase_realtime add table notifications;

-- replica identity full so UPDATE payloads (read_at flips when marking read) carry
-- recipient_id for the client-side filter; without it the OLD row only includes the
-- primary key and the filter wouldn't match.
alter table notifications replica identity full;
