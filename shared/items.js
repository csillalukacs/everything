export function cityOf(loc) {
  if (!loc) return null;
  const c = loc.split(',')[0].trim();
  return c || null;
}

export function thumbOf(item) {
  return item?.thumb_url || item?.image_url || null;
}

export function acquiredFields(acquired) {
  return {
    acquired_year: acquired?.year ?? null,
    acquired_location: acquired?.location ?? null,
    acquired_lat: acquired?.lat ?? null,
    acquired_lng: acquired?.lng ?? null,
  };
}
