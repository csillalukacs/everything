-- Backfill: every user gets a per-user "featured" tag.
-- New users get their featured tag created client-side on first session
-- (see ensureFeaturedTag in shared/featuredTag.js).
insert into tags (user_id, name, is_private)
select p.user_id, 'featured', false
from profiles p
where not exists (
  select 1 from tags t
  where t.user_id = p.user_id and t.name = 'featured'
);
