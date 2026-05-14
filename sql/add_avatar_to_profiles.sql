-- Profile picture stored on R2 (same bucket as item images).
-- avatar_url is the full-resolution upload, avatar_thumb_url is the baked WebP thumbnail.
-- Both are nullable: profiles fall back to a placeholder (initial + generated color).

alter table profiles add column if not exists avatar_url text;
alter table profiles add column if not exists avatar_thumb_url text;
