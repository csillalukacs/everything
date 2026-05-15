// The "featured" tag is a per-user tag that every user has automatically.
// It behaves like a regular tag for filtering and assignment, but is sorted
// first in tag chip rows, gets a yellow-star adornment in the UI, and cannot
// be renamed, deleted, or made private.

export const FEATURED_TAG_NAME = 'featured';

export function isFeaturedTag(tag) {
  return tag?.name === FEATURED_TAG_NAME;
}

export function sortTagsFeaturedFirst(tags) {
  return tags.slice().sort((a, b) => {
    const af = isFeaturedTag(a);
    const bf = isFeaturedTag(b);
    if (af && !bf) return -1;
    if (!af && bf) return 1;
    return a.name.localeCompare(b.name);
  });
}

export function findFeaturedTag(tags) {
  return tags.find(isFeaturedTag) ?? null;
}

// Inserts the featured tag for the given user if it does not already exist.
// Returns the tag row. Safe to call repeatedly; tolerates a unique-conflict
// race by re-selecting if the insert collides.
export async function ensureFeaturedTag(client, userId, existingTags = []) {
  const existing = findFeaturedTag(existingTags);
  if (existing) return existing;
  const { data, error } = await client
    .from('tags')
    .insert({ user_id: userId, name: FEATURED_TAG_NAME, is_private: false })
    .select()
    .single();
  if (!error) return data;
  const { data: refetched } = await client
    .from('tags')
    .select('*')
    .eq('user_id', userId)
    .eq('name', FEATURED_TAG_NAME)
    .maybeSingle();
  return refetched ?? null;
}
