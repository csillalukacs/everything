-- Fix: repeat likes/follows didn't send an OS push.
--
-- likes_notify / follows_notify upsert into `notifications`
-- (on conflict ... do update set created_at = now(), read_at = null). The push
-- trigger notifications_send_push was AFTER INSERT only, so a repeat action
-- (e.g. unlike then re-like, when the original notification row still exists)
-- resolved to an UPDATE and never pushed — even though the in-app bell re-lit.
--
-- Now fire on UPDATE too, but only for the re-notify case. The re-notify bumps
-- created_at; a mark-as-read update leaves created_at unchanged (it only sets
-- read_at). So `new.created_at <> old.created_at` uniquely identifies a
-- re-trigger and excludes mark-as-read, avoiding a push storm when the recipient
-- opens the notifications screen.

create or replace function notifications_send_push()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  base_url text;
  service_key text;
begin
  -- On UPDATE, only push when this is a re-notify (created_at bumped), not a
  -- mark-as-read. INSERTs always pass through.
  if tg_op = 'UPDATE' and new.created_at = old.created_at then
    return new;
  end if;

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
  after insert or update on notifications
  for each row execute function notifications_send_push();
