export const ITEM_IMAGES_BUCKET = 'item-images';
const STORAGE_PATH_MARKER = `/${ITEM_IMAGES_BUCKET}/`;

export function cityOf(loc) {
  if (!loc) return null;
  const c = loc.split(',')[0].trim();
  return c || null;
}

export function thumbOf(item) {
  return item?.thumb_url || item?.image_url || null;
}

export function imagePathFromUrl(url) {
  if (!url || typeof url !== 'string') return null;
  const idx = url.indexOf(STORAGE_PATH_MARKER);
  if (idx === -1) return null;
  return url.slice(idx + STORAGE_PATH_MARKER.length).split('?')[0] || null;
}

export function imagePathsForItem(item) {
  const paths = [];
  const push = u => { const p = imagePathFromUrl(u); if (p) paths.push(p); };
  push(item?.image_url);
  push(item?.thumb_url);
  if (Array.isArray(item?.previous_images)) {
    for (const e of item.previous_images) {
      push(e?.url);
      push(e?.thumb_url);
    }
  }
  return paths;
}

export function acquiredFields(acquired) {
  return {
    acquired_year: acquired?.year ?? null,
    acquired_location: acquired?.location ?? null,
    acquired_lat: acquired?.lat ?? null,
    acquired_lng: acquired?.lng ?? null,
  };
}
