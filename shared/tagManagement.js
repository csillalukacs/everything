export function filterAndSortTags(tags, query) {
  const q = (query ?? '').trim().toLowerCase();
  const filtered = q ? tags.filter(t => t.name.toLowerCase().includes(q)) : tags;
  return filtered.slice().sort((a, b) => a.name.localeCompare(b.name));
}

export function validateTagRename(tag, draft, allTags) {
  const normalized = (draft ?? '').trim().toLowerCase();
  if (!normalized || normalized === tag.name) return { ok: false, normalized, reason: 'noop' };
  if (allTags.some(t => t.id !== tag.id && t.name === normalized)) {
    return { ok: false, normalized, reason: 'duplicate' };
  }
  return { ok: true, normalized, reason: null };
}
