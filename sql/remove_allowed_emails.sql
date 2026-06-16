-- Open signups to everyone -- undo sql/add_allowed_emails.sql (friends-only launch).
--
-- The actual gate was the "Before User Created" auth hook pointing at
-- restrict_signups(). BEFORE running this SQL, unregister the hook in the
-- dashboard so nothing references the function we're about to drop:
--   Authentication -> Hooks -> Before User Created -> set to None.
--
-- With the hook gone, Google/Apple OAuth auto-creates a user on first login
-- for anyone -- no allowlist consulted.

drop function if exists public.restrict_signups(jsonb);
drop table if exists public.signup_requests;
drop table if exists public.allowed_emails;
