-- Collages: tag-scoped saved arrangements of items.
-- layout is jsonb of { canvas: { size }, items: [{ id, item_id, image_url, thumb_url, x, y, scale, rotation, width, height }] }
-- Item image_url/thumb_url are frozen at placement time; if the underlying item is replaced or deleted,
-- the collage keeps showing the original photo until the user re-places it.
-- cover_url/cover_thumb_url are a baked render of the collage uploaded via r2-presign on save.
-- Tag-scoped for now; v2 will make tag_id nullable so collages can outlive their tag.

create table if not exists collages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  tag_id uuid not null references tags(id) on delete cascade,
  title text not null default '',
  layout jsonb not null default '{"items":[]}'::jsonb,
  cover_url text,
  cover_thumb_url text,
  is_private boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists collages_user_id_idx on collages(user_id);
create index if not exists collages_tag_id_idx on collages(tag_id);

alter table collages enable row level security;

create policy "collages_owner_all" on collages
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "collages_public_read" on collages
  for select using (is_private = false);
