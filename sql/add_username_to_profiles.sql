-- Adds a unique, optional username to profiles.
-- Username rules: 3-20 chars, lowercase letters / digits / underscore.
-- Lookup is case-insensitive (CITEXT-style) via the unique index on lower(username).

alter table profiles
  add column if not exists username text;

alter table profiles
  add constraint profiles_username_format
  check (username is null or username ~ '^[a-z0-9_]{3,20}$');

create unique index if not exists profiles_username_lower_key
  on profiles (lower(username));

-- Block reserved slugs that would collide with current/future routes.
create or replace function profiles_username_not_reserved()
returns trigger language plpgsql as $$
begin
  if new.username is not null and lower(new.username) = any (array[
    'admin','api','auth','login','logout','signup','signin','settings',
    'profile','profiles','user','users','u','everything','about','help',
    'support','tos','privacy','app','www','root','me','new','edit','search'
  ]) then
    raise exception 'username % is reserved', new.username;
  end if;
  return new;
end $$;

drop trigger if exists profiles_username_reserved_check on profiles;
create trigger profiles_username_reserved_check
  before insert or update of username on profiles
  for each row execute function profiles_username_not_reserved();

-- Allow anyone to read username + display_name for public profile pages.
-- (Existing select policy on profiles likely already covers this; included
-- here for completeness — drop/skip if you already have a public-read policy.)
do $$ begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'profiles'
      and policyname = 'profiles_public_read'
  ) then
    create policy profiles_public_read on profiles
      for select using (true);
  end if;
end $$;
