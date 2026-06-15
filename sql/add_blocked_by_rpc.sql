-- blocked_by_ids(): the user ids that have blocked the calling user. The public
-- feed uses this to hide the viewer's items from anyone who blocked them, so
-- "people I've blocked don't see my updates on the public timeline".
--
-- SECURITY DEFINER because the blocks RLS only exposes a row to its blocker — a
-- blocked user can't read it directly. This function returns only the blocker ids
-- relevant to the caller (never the rows / the full table), so it doesn't widen
-- what anyone can learn beyond "someone blocked me".
create or replace function blocked_by_ids()
returns setof uuid
language sql
security definer
set search_path = public
stable
as $$
  select blocker_id from blocks where blocked_id = auth.uid();
$$;

revoke all on function blocked_by_ids() from public;
grant execute on function blocked_by_ids() to authenticated;
