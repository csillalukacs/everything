export function cityOf(loc) {
  if (!loc) return null;
  const c = loc.split(',')[0].trim();
  return c || null;
}

export function acquiredFields(acquired) {
  return {
    acquired_year: acquired?.year ?? null,
    acquired_location: acquired?.location ?? null,
    acquired_lat: acquired?.lat ?? null,
    acquired_lng: acquired?.lng ?? null,
  };
}
