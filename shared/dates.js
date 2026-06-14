export const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function relativeTime(s, now = new Date()) {
  if (!s) return '';
  const then = typeof s === 'string' ? new Date(s) : s;
  const diff = now.getTime() - then.getTime();
  if (Number.isNaN(diff)) return '';
  const sec = Math.floor(diff / 1000);
  if (sec < 60) return 'just now';
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h`;
  const days = Math.floor(hr / 24);
  if (days < 7) return `${days}d`;
  const weeks = Math.floor(days / 7);
  if (weeks < 4) return `${weeks}w`;
  const sameYear = then.getFullYear() === now.getFullYear();
  return sameYear
    ? `${MONTH_NAMES[then.getMonth()]} ${then.getDate()}`
    : `${MONTH_NAMES[then.getMonth()]} ${then.getDate()}, ${then.getFullYear()}`;
}

// Day-granular relative label for a 'YYYY-MM-DD' day key (parsed in local time so it
// doesn't drift across the UTC boundary the way relativeTime would on a bare date).
export function relativeDay(dayStr, now = new Date()) {
  if (!dayStr) return '';
  const [y, m, d] = String(dayStr).split('-').map(Number);
  if (!y) return '';
  const then = startOfDay(new Date(y, m - 1, d));
  const today = startOfDay(now);
  const diffDays = Math.round((today - then) / 86400000);
  if (diffDays <= 0) return 'today';
  if (diffDays === 1) return 'yesterday';
  if (diffDays < 7) return `${diffDays} days ago`;
  if (diffDays < 14) return 'last week';
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
  return then.toLocaleDateString('en-US', {
    month: 'short', day: 'numeric',
    year: then.getFullYear() === today.getFullYear() ? undefined : 'numeric',
  });
}

// How "recently used" an item is, from its last_used_on day ('YYYY-MM-DD' or null).
// Returns 'today' | 'week' | 'month' for items used within those windows, else null
// (never used, or last used > 30 days ago). Drives the warm grid-tile tint — see
// USAGE_TINTS below. Both apps read these so the recency cue stays consistent.
export function usageRecencyTier(lastUsedOn, now = new Date()) {
  if (!lastUsedOn) return null;
  const [y, m, d] = String(lastUsedOn).split('-').map(Number);
  if (!y) return null;
  const diffDays = Math.round((startOfDay(now) - startOfDay(new Date(y, m - 1, d))) / 86400000);
  if (diffDays <= 0) return 'today';
  if (diffDays <= 7) return 'week';
  if (diffDays <= 30) return 'month';
  return null;
}

// Cool recency ramp keyed by usageRecencyTier(), against the #FFFFFF base. The
// hue walks green → blue as an item ages: freshly used today glows green, this
// week teal, this month blue. These are the glow *centre* colours — each tile
// renders them as a radial glow fading to white (see usageGlowCss for web, and the
// Skia RadialGradient in ItemGrid for mobile), not a flat fill. Absence of a tier
// means no glow (plain tile).
export const USAGE_TINTS = {
  today: '#5BD6A0',
  week: '#5BBFD6',
  month: '#7BA8E8',
};

// Web: a radial glow behind a recently-used tile — the tint colour at the centre,
// fading to the white grid base. Returns null for items with no recency tier.
export function usageGlowCss(tier) {
  const c = USAGE_TINTS[tier];
  return c ? `radial-gradient(circle at 50% 50%, ${c} 0%, #FFFFFF 55%)` : null;
}

export function startOfDay(d) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

export function dayKey(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
}

export function startOfWeek(d) {
  const x = startOfDay(d);
  const diff = (x.getDay() + 6) % 7;
  x.setDate(x.getDate() - diff);
  return x;
}

export function weekKey(d) { return dayKey(startOfWeek(d)); }

export function monthKey(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

export function lastNDays(n) {
  const today = startOfDay(new Date());
  const out = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    out.push(d);
  }
  return out;
}

export function lastNWeeks(n) {
  const start = startOfWeek(new Date());
  const out = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(start);
    d.setDate(d.getDate() - i * 7);
    out.push(d);
  }
  return out;
}

export function lastNMonths(n) {
  const today = new Date();
  const out = [];
  for (let i = n - 1; i >= 0; i--) {
    out.push(new Date(today.getFullYear(), today.getMonth() - i, 1));
  }
  return out;
}

export function bucketize(items, keyFn) {
  const m = new Map();
  for (const item of items) {
    const k = keyFn(new Date(item.created_at));
    m.set(k, (m.get(k) ?? 0) + 1);
  }
  return m;
}

export function computeStreak(byDay) {
  if (byDay.size === 0) return 0;
  const cursor = startOfDay(new Date());
  if (!byDay.has(dayKey(cursor))) cursor.setDate(cursor.getDate() - 1);
  let streak = 0;
  while (byDay.has(dayKey(cursor))) {
    streak++;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

export function computeLongestStreak(byDay) {
  const keys = [...byDay.keys()].sort();
  if (keys.length === 0) return 0;
  let longest = 1, current = 1;
  for (let i = 1; i < keys.length; i++) {
    const prev = new Date(keys[i - 1]);
    const curr = new Date(keys[i]);
    const diffDays = Math.round((curr - prev) / 86400000);
    if (diffDays === 1) { current++; longest = Math.max(longest, current); }
    else current = 1;
  }
  return longest;
}

export function formatDayLabel(d, i, total) {
  if (total <= 14) return String(d.getDate());
  if (i === total - 1) return String(d.getDate());
  if (d.getDate() === 1) return MONTH_NAMES[d.getMonth()].toLowerCase();
  if (d.getDay() === 1) return String(d.getDate());
  return '';
}

export function formatWeekLabel(d) { return `${d.getMonth() + 1}/${d.getDate()}`; }

export function formatMonthLabel(d) { return MONTH_NAMES[d.getMonth()].toLowerCase(); }

export function dayKeyToDate(k) { return new Date(k); }

export function endOfWeekKey(k) {
  const d = dayKeyToDate(k);
  d.setDate(d.getDate() + 6);
  return dayKey(d);
}

export function endOfMonthKey(k) {
  const [y, m] = k.split('-').map(Number);
  const d = new Date(y, m, 0);
  return dayKey(d);
}

export function formatDateLabel(s) {
  if (!s) return '';
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return s;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).toLowerCase();
}

// 'YYYY-MM-DD' (a local day key) → short label like 'Jun 12', or 'Jun 12, 2024' when not the current year.
// Parses the parts directly so the label never shifts a day across time zones.
export function dayKeyLabel(key, now = new Date()) {
  if (!key) return '';
  const [y, m, d] = key.split('-').map(Number);
  if (!y || !m || !d) return key;
  const label = `${MONTH_NAMES[m - 1]} ${d}`;
  return y === now.getFullYear() ? label : `${label}, ${y}`;
}
