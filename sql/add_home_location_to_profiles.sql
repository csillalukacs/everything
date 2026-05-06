-- Public home city for a profile.
-- home_location is the human-readable display string from Nominatim
-- (matches items.acquired_location). home_lat/home_lng are the coords.
-- Coords are nullable because location is optional.

alter table profiles add column if not exists home_location text;
alter table profiles add column if not exists home_lat double precision;
alter table profiles add column if not exists home_lng double precision;
