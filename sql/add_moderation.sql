-- Moderation primitives required for App Store guideline 1.2 (user-generated content):
-- a way to REPORT objectionable content and a way to BLOCK abusive users.
--
-- reports: write-only from the client's perspective. Authenticated users insert a row;
--   nobody can read them back (no select policy => default deny). Moderation happens via
--   the Supabase dashboard / service role, which bypasses RLS. target_user_id is the
--   content owner, denormalized so a reviewer can eject the right account within 24h.
-- blocks: a user hides another user. The blocker manages and reads their own rows; the
--   feed/profile queries exclude blocked authors client-side (see shared/itemsApi.js).

create table if not exists reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references auth.users(id) on delete cascade,
  target_type text not null check (target_type in ('item', 'profile')),
  target_id uuid not null,
  target_user_id uuid,
  reason text not null,
  created_at timestamptz not null default now()
);

create index if not exists reports_target_idx on reports(target_type, target_id);
create index if not exists reports_created_idx on reports(created_at desc);

alter table reports enable row level security;

create policy "reports_insert_own" on reports
  for insert with check (auth.uid() = reporter_id);

create table if not exists blocks (
  id uuid primary key default gen_random_uuid(),
  blocker_id uuid not null references auth.users(id) on delete cascade,
  blocked_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (blocker_id, blocked_id)
);

create index if not exists blocks_blocker_idx on blocks(blocker_id);

alter table blocks enable row level security;

create policy "blocks_owner_all" on blocks
  for all using (auth.uid() = blocker_id) with check (auth.uid() = blocker_id);
