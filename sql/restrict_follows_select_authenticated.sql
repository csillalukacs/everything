-- Follower / following counts and lists are visible to signed-in users only.
-- Previously the follows select policy was `using (true)`, so logged-out visitors
-- (e.g. anonymous web profile views) could read every edge and see the social
-- graph. Tighten it to require an authenticated session.
drop policy if exists "follows_select_public" on follows;
create policy "follows_select_authenticated" on follows
  for select using (auth.uid() is not null);
