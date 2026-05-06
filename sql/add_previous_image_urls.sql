-- Keep older photos (with their dates) when replacing the main image of an item.
-- Replaced photos are pushed into previous_images as {url, added_at}; user can delete from this list.
-- Safe to re-run from any state.

-- 1. Replace the trigger function with a safe version that references only columns
--    guaranteed to exist. This neutralizes any prior version that referenced
--    previous_image_urls (which we're about to drop).
create or replace function items_bump_updated_at()
returns trigger language plpgsql as $$
begin
  if (
    new.name is distinct from old.name
    or new.description is distinct from old.description
    or new.image_url is distinct from old.image_url
    or new.acquired_year is distinct from old.acquired_year
    or new.acquired_location is distinct from old.acquired_location
    or new.acquired_lat is distinct from old.acquired_lat
    or new.acquired_lng is distinct from old.acquired_lng
    or new.ocr_text is distinct from old.ocr_text
  ) then
    new.updated_at = now();
  end if;
  return new;
end $$;

-- 2. Drop the obsolete column from an earlier draft of this migration.
alter table items drop column if exists previous_image_urls;

-- 3. Add the new columns.
alter table items add column if not exists previous_images jsonb not null default '[]'::jsonb;
alter table items add column if not exists image_added_at timestamptz;

-- 4. Backfill image_added_at. The trigger function from step 1 references only
--    pre-existing columns, so this UPDATE is safe even with the trigger attached.
update items set image_added_at = created_at where image_added_at is null;
alter table items alter column image_added_at set not null;
alter table items alter column image_added_at set default now();

-- 5. Replace the trigger function with the final version that includes the new fields.
create or replace function items_bump_updated_at()
returns trigger language plpgsql as $$
begin
  if (
    new.name is distinct from old.name
    or new.description is distinct from old.description
    or new.image_url is distinct from old.image_url
    or new.image_added_at is distinct from old.image_added_at
    or new.previous_images is distinct from old.previous_images
    or new.acquired_year is distinct from old.acquired_year
    or new.acquired_location is distinct from old.acquired_location
    or new.acquired_lat is distinct from old.acquired_lat
    or new.acquired_lng is distinct from old.acquired_lng
    or new.ocr_text is distinct from old.ocr_text
  ) then
    new.updated_at = now();
  end if;
  return new;
end $$;
