-- Restrict signups to an allowlist of emails (friends-only launch).
--
-- Google OAuth auto-creates a user on first login, so we can't just disable
-- signups. Instead we register restrict_signups() as the Auth "before user
-- created" hook: it runs server-side before the user row is committed and
-- rejects any email not present in allowed_emails.
--
-- After applying this, register the hook in the Supabase dashboard:
--   Authentication -> Hooks -> Before User Created -> select restrict_signups.

create table if not exists public.allowed_emails (
  email text primary key
);

-- Seed your allowlist here (emails are lowercased to match the hook):
-- insert into public.allowed_emails (email) values
--   ('friend1@example.com'),
--   ('friend2@example.com')
-- on conflict do nothing;

-- Just-in-case fallback: every rejected attempt is logged here so you can see
-- who got turned away and add them to allowed_emails. The rejected sign-in is
-- itself the access request -- no separate form needed. To approve someone:
--   insert into public.allowed_emails (email)
--   select email from public.signup_requests where email = '...';
create table if not exists public.signup_requests (
  email text primary key,
  attempts integer not null default 1,
  first_requested_at timestamptz not null default now(),
  last_requested_at timestamptz not null default now()
);

create or replace function public.restrict_signups(event jsonb)
returns jsonb
language plpgsql
as $$
declare
  candidate text := lower(event->'user'->>'email');
begin
  if not exists (
    select 1 from public.allowed_emails where email = candidate
  ) then
    insert into public.signup_requests (email)
      values (candidate)
    on conflict (email) do update
      set attempts = public.signup_requests.attempts + 1,
          last_requested_at = now();

    return jsonb_build_object(
      'error', jsonb_build_object(
        'message', 'This email is not on the invite list. We have noted your request -- ask the owner to add you.',
        'http_code', 403
      )
    );
  end if;

  return '{}'::jsonb;
end;
$$;

-- The hook runs as supabase_auth_admin, so it needs execute on the function
-- and read access to the allowlist table. Nobody else should call either.
grant execute on function public.restrict_signups to supabase_auth_admin;
revoke execute on function public.restrict_signups from authenticated, anon, public;

grant select on public.allowed_emails to supabase_auth_admin;
grant select, insert, update on public.signup_requests to supabase_auth_admin;

-- supabase_auth_admin (the role the hook runs as) is subject to RLS, so it
-- needs explicit policies -- it does NOT bypass RLS. Without these the hook
-- throws ("violates row-level security policy") and every signup is rejected.
-- No policies exist for anon/authenticated, so the tables stay invisible to
-- clients.
alter table public.allowed_emails enable row level security;
alter table public.signup_requests enable row level security;

drop policy if exists "auth_admin_read_allowlist" on public.allowed_emails;
create policy "auth_admin_read_allowlist" on public.allowed_emails
  as permissive for select to supabase_auth_admin using (true);

drop policy if exists "auth_admin_read_requests" on public.signup_requests;
create policy "auth_admin_read_requests" on public.signup_requests
  as permissive for select to supabase_auth_admin using (true);

drop policy if exists "auth_admin_insert_requests" on public.signup_requests;
create policy "auth_admin_insert_requests" on public.signup_requests
  as permissive for insert to supabase_auth_admin with check (true);

drop policy if exists "auth_admin_update_requests" on public.signup_requests;
create policy "auth_admin_update_requests" on public.signup_requests
  as permissive for update to supabase_auth_admin using (true) with check (true);
