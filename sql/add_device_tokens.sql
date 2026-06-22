-- Device push tokens + the trigger that fans a new notification out to APNs.
--
-- Push is a DELIVERY layer on top of in-app notifications (sql/add_notifications.sql):
-- the `notifications` row is still written by follows_notify / likes_notify and drives
-- the realtime bell badge. This file adds (1) a place to store each device's Expo push
-- token, and (2) an AFTER INSERT trigger on `notifications` that calls the send-push
-- edge function so the OS shows a banner even when the app is closed.
--
-- iOS only for now (the client registers a token only on distribution builds — see
-- featureFlags.js / lib/push.js). Android/FCM is deferred.

-- ---------------------------------------------------------------------------
-- 1. device_tokens
-- ---------------------------------------------------------------------------
-- One row per device token. The client (lib/push.registerForPush) upserts its own
-- token on sign-in; `token` is unique so re-registering just bumps updated_at, and a
-- token that migrates to another account moves rather than duplicating.
create table if not exists device_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  token text not null unique,
  platform text not null check (platform in ('ios', 'android', 'web')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists device_tokens_user_idx on device_tokens(user_id);

alter table device_tokens enable row level security;

-- A user manages only their own tokens. The send-push function reads across users
-- via the service-role key (bypasses RLS), so no cross-user read policy is needed.
create policy "device_tokens_select_own" on device_tokens
  for select using (auth.uid() = user_id);
create policy "device_tokens_insert_own" on device_tokens
  for insert with check (auth.uid() = user_id);
create policy "device_tokens_update_own" on device_tokens
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "device_tokens_delete_own" on device_tokens
  for delete using (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- 2. Fan-out trigger: notifications INSERT -> send-push edge function
-- ---------------------------------------------------------------------------
-- Uses pg_net (net.http_post) to POST the new notification id to the edge function,
-- which looks up the recipient's device tokens and relays via Expo Push. The function
-- URL and the service-role key are read from Vault so no secret is hard-coded here.
--
-- One-time setup (Supabase SQL editor / dashboard):
--   create extension if not exists pg_net;
--   select vault.create_secret('https://<project-ref>.supabase.co/functions/v1', 'project_functions_url');
--   select vault.create_secret('<service-role-key>', 'service_role_key');
--
-- Alternative to this trigger: a Supabase **Database Webhook** (Dashboard ->
-- Database -> Webhooks) on INSERT to `notifications` pointing at send-push. The
-- webhook handles auth headers for you; if you use it, skip the function+trigger
-- below. The trigger is kept here so the wiring lives in sql/ and is reproducible.

create extension if not exists pg_net;

create or replace function notifications_send_push()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  base_url text;
  service_key text;
begin
  select decrypted_secret into base_url
    from vault.decrypted_secrets where name = 'project_functions_url';
  select decrypted_secret into service_key
    from vault.decrypted_secrets where name = 'service_role_key';

  -- If the secrets aren't configured yet, do nothing (the in-app notification still
  -- works; only the OS push is skipped) rather than failing the insert.
  if base_url is null or service_key is null then
    return new;
  end if;

  perform net.http_post(
    url := base_url || '/send-push',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || service_key
    ),
    body := jsonb_build_object('notification_id', new.id)
  );
  return new;
end $$;

drop trigger if exists notifications_send_push on notifications;
create trigger notifications_send_push
  after insert on notifications
  for each row execute function notifications_send_push();
