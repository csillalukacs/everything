-- Following: directional follow edges between users. Powers the "friends" feed tab.
-- Integrity with blocking (see sql/add_moderation.sql):
--   * you cannot follow someone you've blocked, or who has blocked you (guard trigger)
--   * blocking someone removes any follow in either direction (cleanup trigger)
-- Both triggers are SECURITY DEFINER so they can see/modify rows on both sides of the
-- relationship regardless of the row-level policies.

create table if not exists follows (
  id uuid primary key default gen_random_uuid(),
  follower_id uuid not null references auth.users(id) on delete cascade,
  followed_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (follower_id, followed_id),
  check (follower_id <> followed_id)
);

create index if not exists follows_follower_idx on follows(follower_id);
create index if not exists follows_followed_idx on follows(followed_id);

alter table follows enable row level security;

-- Follows are public: anyone can read any edge so profiles can show follower /
-- following counts and browsable lists. You can only manage edges where you're
-- the follower.
create policy "follows_select_public" on follows
  for select using (true);
create policy "follows_insert_own" on follows
  for insert with check (auth.uid() = follower_id);
create policy "follows_delete_own" on follows
  for delete using (auth.uid() = follower_id);

-- Guard: reject a follow if a block exists in either direction.
create or replace function follows_block_guard()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if exists (
    select 1 from blocks b
    where (b.blocker_id = new.follower_id and b.blocked_id = new.followed_id)
       or (b.blocker_id = new.followed_id and b.blocked_id = new.follower_id)
  ) then
    raise exception 'cannot follow a blocked user';
  end if;
  return new;
end $$;

drop trigger if exists follows_block_guard on follows;
create trigger follows_block_guard
  before insert on follows
  for each row execute function follows_block_guard();

-- Cleanup: when a block is created, drop any follow edge in either direction.
create or replace function blocks_remove_follows()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  delete from follows
  where (follower_id = new.blocker_id and followed_id = new.blocked_id)
     or (follower_id = new.blocked_id and followed_id = new.blocker_id);
  return new;
end $$;

drop trigger if exists blocks_remove_follows on blocks;
create trigger blocks_remove_follows
  after insert on blocks
  for each row execute function blocks_remove_follows();
