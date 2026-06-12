-- Track item "usages": each day a user uses one of their items.
-- Two entry points:
--   1. One-tap "used this today" button  -> on_feed = true  (produces a feed event)
--   2. Backfill in item edit mode         -> on_feed = false (silent, no feed event)
-- used_on is the user's LOCAL calendar day for the usage (sent by the client so the
--   "one per day" rule respects the user's timezone, not UTC). Day granularity only --
--   we never store a precise time of use. At most one usage per item per day, so
--   "times used" == distinct days used == usage_count.
-- created_at is the insert moment, kept only to order same-day feed events.
-- on_feed lets us later expose a per-usage "share to feed?" toggle without a schema change.

create table if not exists item_usages (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references items(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  used_on date not null,
  on_feed boolean not null default false,
  created_at timestamptz not null default now()
);

-- One usage per item per local day. A repeat "used today" tap is a no-op (or a toggle-off
-- delete, decided client-side); a backfill onto an already-used day conflicts harmlessly.
create unique index if not exists item_usages_item_day_uniq on item_usages(item_id, used_on);
create index if not exists item_usages_item_id_idx on item_usages(item_id);
create index if not exists item_usages_user_used_on_idx on item_usages(user_id, used_on desc);
-- partial index for the cross-user public feed query (ordered by insert time)
create index if not exists item_usages_feed_idx on item_usages(created_at desc) where on_feed = true;

alter table item_usages enable row level security;

create policy "item_usages_owner_all" on item_usages
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Public can read a usage only if it was shared to the feed AND the item is public.
create policy "item_usages_public_read" on item_usages
  for select using (
    on_feed = true
    and exists (select 1 from items i where i.id = item_id and i.is_private = false)
  );

-- Denormalized rollups on items so the existing select('*') fetch + AsyncStorage
-- cache carry usage info with no extra query in the grid / detail view.
alter table items add column if not exists usage_count integer not null default 0;
alter table items add column if not exists last_used_on date;

-- Keep the rollups in sync. INSERT is the hot path (one-tap + backfill); DELETE
-- recomputes from scratch since it's rare.
create or replace function item_usages_sync_item()
returns trigger language plpgsql as $$
begin
  if tg_op = 'INSERT' then
    update items
      set usage_count = usage_count + 1,
          last_used_on = greatest(coalesce(last_used_on, new.used_on), new.used_on)
      where id = new.item_id;
    return new;
  elsif tg_op = 'DELETE' then
    update items
      set usage_count = (select count(*) from item_usages u where u.item_id = old.item_id),
          last_used_on = (select max(u.used_on) from item_usages u where u.item_id = old.item_id)
      where id = old.item_id;
    return old;
  end if;
  return null;
end $$;

drop trigger if exists item_usages_sync_item on item_usages;
create trigger item_usages_sync_item
  after insert or delete on item_usages
  for each row execute function item_usages_sync_item();
