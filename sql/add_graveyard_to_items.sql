-- Graveyard: let users "retire" items they no longer own (sold, consumed, lost,
-- stolen, given away, …) instead of deleting them. Retired items leave the normal
-- collection, public feed, stats and Today, and live only in the owner's graveyard
-- view. They can be resurrected at any time.
--
-- retired_at non-null == currently in the graveyard. It also doubles as "when last
-- retired". Resurrecting clears all three fields (no retirement history is kept).
-- retire_reason is a free-text string (a preset chip or anything the user types).
-- epitaph is an optional few last words.

alter table items add column if not exists retired_at timestamptz;
alter table items add column if not exists retire_reason text;
alter table items add column if not exists epitaph text;

-- Partial index for the owner's graveyard query (only retired rows are interesting).
create index if not exists items_user_retired_idx
  on items(user_id, retired_at desc) where retired_at is not null;
