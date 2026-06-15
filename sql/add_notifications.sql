-- In-app notifications. Not real-time; the client polls an unread count for the
-- badge and reads the list when the notifications screen opens.
--
-- Rows are written ONLY by SECURITY DEFINER triggers (never by the client), so a
-- user can't fabricate notifications for someone else. The recipient may read and
-- mark their own rows read; that's the entire client surface.
--
-- type 'follow' -> someone followed you (item_id null).
-- type 'like'   -> someone liked an item of yours (item_id set). The like trigger
--   doesn't exist yet (no likes table); the type + item_id column are here so the
--   future likes feature drops in without a schema change.

create table if not exists notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_id uuid not null references auth.users(id) on delete cascade,
  actor_id uuid not null references auth.users(id) on delete cascade,
  type text not null check (type in ('follow', 'like')),
  item_id uuid references items(id) on delete cascade,
  created_at timestamptz not null default now(),
  read_at timestamptz,
  check (recipient_id <> actor_id)
);

-- List ordering (newest first) and the unread-count head query.
create index if not exists notifications_recipient_idx on notifications(recipient_id, created_at desc);
create index if not exists notifications_unread_idx on notifications(recipient_id) where read_at is null;

-- Dedup: one follow notification per (recipient, actor); one like notification per
-- (recipient, actor, item). A repeat action bumps created_at and re-marks unread
-- (see the upsert in the triggers below) rather than piling up duplicate rows.
create unique index if not exists notifications_follow_unique
  on notifications(recipient_id, actor_id) where type = 'follow';
create unique index if not exists notifications_like_unique
  on notifications(recipient_id, actor_id, item_id) where type = 'like';

alter table notifications enable row level security;

-- Recipient can read and mark-read their own notifications. No insert/delete policy:
-- the triggers below run as SECURITY DEFINER and bypass RLS.
create policy "notifications_select_own" on notifications
  for select using (auth.uid() = recipient_id);
create policy "notifications_update_own" on notifications
  for update using (auth.uid() = recipient_id) with check (auth.uid() = recipient_id);

-- A new follow edge notifies the followed user. The follows_block_guard (see
-- sql/add_follows.sql) already rejects follows between blocked pairs, so a blocked
-- actor can't generate a notification here.
create or replace function follows_notify()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into notifications (recipient_id, actor_id, type)
  values (new.followed_id, new.follower_id, 'follow')
  on conflict (recipient_id, actor_id) where type = 'follow'
  do update set created_at = now(), read_at = null;
  return new;
end $$;

drop trigger if exists follows_notify on follows;
create trigger follows_notify
  after insert on follows
  for each row execute function follows_notify();

-- Blocking someone scrubs notifications in either direction so a blocked user
-- never lingers in your bell (mirrors blocks_remove_follows in sql/add_follows.sql).
create or replace function blocks_remove_notifications()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  delete from notifications
  where (recipient_id = new.blocker_id and actor_id = new.blocked_id)
     or (recipient_id = new.blocked_id and actor_id = new.blocker_id);
  return new;
end $$;

drop trigger if exists blocks_remove_notifications on blocks;
create trigger blocks_remove_notifications
  after insert on blocks
  for each row execute function blocks_remove_notifications();
