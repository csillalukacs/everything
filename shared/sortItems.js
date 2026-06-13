// Shared item sorting. Pure JS — no React/DOM imports.
//
// Modes (kept stable as URL query values on web and storage keys on mobile):
//   newest         created_at desc (default)
//   oldest         created_at asc
//   edited         updated_at (or created_at) desc
//   name-asc       name a→z, blank names last
//   name-desc      name z→a, blank names last
//   acquired-desc  acquired_year desc, missing years last
//   acquired-asc   acquired_year asc, missing years last
//   used-recent    last_used_on desc, never-used last
//   used-often     usage_count desc, never-used last
//   random         deterministic shuffle by hash(id, seed)

export const SORT_MODES = [
  'newest',
  'oldest',
  'edited',
  'name-asc',
  'name-desc',
  'acquired-desc',
  'acquired-asc',
  'used-recent',
  'used-often',
  'random',
];

export const DEFAULT_SORT = 'newest';

function cmpName(a, b) {
  const an = (a.name ?? '').toLowerCase();
  const bn = (b.name ?? '').toLowerCase();
  if (!an && !bn) return 0;
  if (!an) return 1;
  if (!bn) return -1;
  return an.localeCompare(bn);
}

function cmpYear(a, b) {
  if (a.acquired_year == null && b.acquired_year == null) return 0;
  if (a.acquired_year == null) return 1;
  if (b.acquired_year == null) return -1;
  return a.acquired_year - b.acquired_year;
}

// last_used_on is a 'YYYY-MM-DD' string (or null for never-used). Most-recent
// first, with never-used items always last (independent of sort direction —
// don't negate this). String compare suffices since the format is zero-padded.
function cmpLastUsedDesc(a, b) {
  const ad = a.last_used_on ?? '';
  const bd = b.last_used_on ?? '';
  if (!ad && !bd) return 0;
  if (!ad) return 1;
  if (!bd) return -1;
  return bd.localeCompare(ad);
}

// FNV-1a hash of `${seed}:${id}` — deterministic per (id, seed) so random
// order stays stable while the page is open and a new seed reshuffles.
function hashItem(id, seed) {
  const s = `${seed}:${id}`;
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function newRandomSeed() {
  return Math.floor(Math.random() * 0x7fffffff);
}

export function sortItems(items, mode, seed = 0) {
  const arr = [...items];
  switch (mode) {
    case 'oldest':
      return arr.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
    case 'edited':
      return arr.sort((a, b) => new Date(b.updated_at ?? b.created_at) - new Date(a.updated_at ?? a.created_at));
    case 'name-asc':
      return arr.sort(cmpName);
    case 'name-desc':
      return arr.sort((a, b) => -cmpName(a, b));
    case 'acquired-desc':
      return arr.sort((a, b) => -cmpYear(a, b));
    case 'acquired-asc':
      return arr.sort(cmpYear);
    case 'used-recent':
      return arr.sort(cmpLastUsedDesc);
    case 'used-often': {
      // usage_count desc; ties (incl. never-used 0s) fall back to most-recent use.
      return arr.sort((a, b) => {
        const diff = (b.usage_count ?? 0) - (a.usage_count ?? 0);
        return diff !== 0 ? diff : cmpLastUsedDesc(a, b);
      });
    }
    case 'random':
      return arr.sort((a, b) => hashItem(a.id, seed) - hashItem(b.id, seed));
    case 'newest':
    default:
      return arr.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  }
}
