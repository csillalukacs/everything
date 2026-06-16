-- Favorites ("hearts"): a user marks another user's item as a favorite. Powers the
-- heart button on item detail and the favorites grid in your own collection.
--
-- Integrity with blocking (see sql/add_moderation.sql):
--   * you cannot favorite an item whose owner you've blocked, or who has blocked you
--     (guard trigger) — "blocked users cannot heart your things"
--   * blocking does NOT delete existing favorites — they're merely hidden at read time
--     (see fetchFavorites in shared/likesApi.js), so unblocking restores them
--   * favoriting someone's item notifies them (notify trigger -> notifications table,
--     which already defines the 'like' type + dedup index in sql/add_notifications.sql)
-- Both triggers are SECURITY DEFINER so they can read items/blocks and write
-- notifications regardless of row-level policies.

create table if not exists likes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,  -- who favorited
  item_id uuid not null references items(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (user_id, item_id)
);

-- The favorites grid lists a user's likes newest-first; the count/lookup goes by item.
create index if not exists likes_user_idx on likes(user_id, created_at desc);
create index if not exists likes_item_idx on likes(item_id);

alter table likes enable row level security;

-- A user manages and reads only their own favorites. Item owners learn about likes
-- through the notification the trigger writes, not by reading this table.
create policy "likes_owner_all" on likes
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Guard: reject favoriting your own item, or an item whose owner is blocked in
-- either direction.
create or replace function likes_block_guard()
returns trigger language plpgsql security definer set search_path = public as $$
declare owner uuid;
begin
  select user_id into owner from items where id = new.item_id;
  if owner is null then
    raise exception 'item not found';
  end if;
  if owner = new.user_id then
    raise exception 'cannot favorite your own item';
  end if;
  if exists (
    select 1 from blocks b
    where (b.blocker_id = new.user_id and b.blocked_id = owner)
       or (b.blocker_id = owner and b.blocked_id = new.user_id)
  ) then
    raise exception 'cannot favorite a blocked user''s item';
  end if;
  return new;
end $$;

drop trigger if exists likes_block_guard on likes;
create trigger likes_block_guard
  before insert on likes
  for each row execute function likes_block_guard();

-- A new favorite notifies the item's owner. Repeat favorites (after unfavoriting)
-- bump created_at and re-mark unread via the dedup index, rather than piling up rows.
create or replace function likes_notify()
returns trigger language plpgsql security definer set search_path = public as $$
declare owner uuid;
begin
  select user_id into owner from items where id = new.item_id;
  if owner is null or owner = new.user_id then
    return new;
  end if;
  insert into notifications (recipient_id, actor_id, type, item_id)
  values (owner, new.user_id, 'like', new.item_id)
  on conflict (recipient_id, actor_id, item_id) where type = 'like'
  do update set created_at = now(), read_at = null;
  return new;
end $$;

drop trigger if exists likes_notify on likes;
create trigger likes_notify
  after insert on likes
  for each row execute function likes_notify();

-- Note: there is deliberately no block-cleanup trigger for likes. Blocking hides
-- favorites in either direction via read-time filtering rather than deleting them,
-- so the favorites come back if the block is later removed.
