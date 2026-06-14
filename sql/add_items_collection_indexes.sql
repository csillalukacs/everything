-- Indexes for the collection-load queries (fetchAllItems in shared/itemsApi.js).
--
-- Before this, the only items index matching these queries was the graveyard one
-- (items_user_retired_idx WHERE retired_at IS NOT NULL) — the opposite predicate.
-- So the owner's collection load and every public-profile load did a scan + filter
-- + sort by created_at on each request. These indexes let Postgres return rows
-- already ordered, with no sort, and support keyset pagination.
--
-- id is the secondary sort key (matches the (created_at desc, id desc) order +
-- keyset cursor in fetchAllItems) so pagination is stable when two rows share a
-- created_at timestamp.

-- Public-profile / feed-style load: is_private = false and retired_at is null.
create index if not exists items_user_public_created_idx
  on items(user_id, created_at desc, id desc)
  where is_private = false and retired_at is null;

-- Owner's own full-collection load (includes private + retired items).
create index if not exists items_user_created_idx
  on items(user_id, created_at desc, id desc);
