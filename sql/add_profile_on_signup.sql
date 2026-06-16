-- Auto-create a bare profiles row for every new auth user.
--
-- Previously a profiles row was created lazily by the first display-name
-- upsert (screens/ProfileScreen.js, web SettingsPage.jsx). Username/home/avatar
-- saves use .update().eq('user_id', ...), which silently no-ops when no row
-- exists. This trigger guarantees a row exists from signup so those paths
-- always persist.

create or replace function handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (user_id)
  values (new.id)
  on conflict (user_id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- Backfill rows for existing users who never saved a profile.
insert into public.profiles (user_id)
select u.id
from auth.users u
left join public.profiles p on p.user_id = u.id
where p.user_id is null
on conflict (user_id) do nothing;
