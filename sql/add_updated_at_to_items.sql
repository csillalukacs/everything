-- Track when an item was last meaningfully edited.
-- "Meaningful" = any field except is_private. Toggling privacy does NOT bump updated_at.
-- Tag changes (rows in item_tags) DO bump it.

alter table items add column if not exists updated_at timestamptz;

update items set updated_at = created_at where updated_at is null;

alter table items alter column updated_at set not null;
alter table items alter column updated_at set default now();

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

drop trigger if exists items_bump_updated_at on items;
create trigger items_bump_updated_at
  before update on items
  for each row execute function items_bump_updated_at();

create or replace function item_tags_bump_item_updated_at()
returns trigger language plpgsql as $$
begin
  if tg_op = 'DELETE' then
    update items set updated_at = now() where id = old.item_id;
    return old;
  end if;
  update items set updated_at = now() where id = new.item_id;
  return new;
end $$;

drop trigger if exists item_tags_bump_item_updated_at on item_tags;
create trigger item_tags_bump_item_updated_at
  after insert or delete on item_tags
  for each row execute function item_tags_bump_item_updated_at();
