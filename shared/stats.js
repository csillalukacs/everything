import { cityOf } from './items';
import { FEATURED_TAG_NAME } from './featuredTag';
import { S } from './strings';

// Bold categorical hues for pie slices (each slice is labelled in its own
// legend, so yellow is fine here).
export const PIE_PALETTE = [
  '#E53935', '#1E88E5', '#FDD835', '#43A047', '#8E24AA',
  '#00897B', '#D81B60', '#3949AB', '#00ACC1', '#C0CA33',
];
export const PIE_UNTAGGED_COLOR = '#BDBDBD';

export function buildTagDistribution(items) {
  if (items.length === 0) return null;
  const appearances = new Map();
  for (const item of items) {
    for (const tag of item.tags ?? []) {
      if (tag.name === FEATURED_TAG_NAME) continue;
      appearances.set(tag.name, (appearances.get(tag.name) ?? 0) + 1);
    }
  }
  const tagCounts = new Map();
  let untaggedCount = 0;
  for (const item of items) {
    const tags = (item.tags ?? []).filter(t => t.name !== FEATURED_TAG_NAME);
    if (tags.length === 0) { untaggedCount++; continue; }
    let chosen = tags[0].name;
    let chosenCount = appearances.get(chosen) ?? 0;
    for (let i = 1; i < tags.length; i++) {
      const n = tags[i].name;
      const c = appearances.get(n) ?? 0;
      if (c > chosenCount) { chosen = n; chosenCount = c; }
    }
    tagCounts.set(chosen, (tagCounts.get(chosen) ?? 0) + 1);
  }
  const tagSlices = [...tagCounts.entries()]
    .map(([label, count]) => ({ label, count, kind: 'tag' }))
    .sort((a, b) => b.count - a.count)
    .map((s, i) => ({ ...s, color: PIE_PALETTE[i % PIE_PALETTE.length] }));
  const slices = [...tagSlices];
  if (untaggedCount > 0) {
    slices.push({ label: S.collection.untagged, count: untaggedCount, kind: 'untagged', color: PIE_UNTAGGED_COLOR });
  }
  if (slices.length === 0) return null;
  const total = slices.reduce((sum, s) => sum + s.count, 0);
  return { slices, total };
}

export function computeYearStats(items) {
  const years = items.map(i => i.acquired_year).filter(y => y != null);
  if (years.length === 0) return null;
  const min = Math.min(...years);
  const max = Math.max(...years);
  const range = max - min;
  const bucketSize = range > 30 ? 5 : 1;
  const buckets = new Map();
  for (const y of years) {
    const bucket = Math.floor(y / bucketSize) * bucketSize;
    buckets.set(bucket, (buckets.get(bucket) ?? 0) + 1);
  }
  const startBucket = Math.floor(min / bucketSize) * bucketSize;
  const endBucket = Math.floor(max / bucketSize) * bucketSize;
  const bars = [];
  for (let b = startBucket; b <= endBucket; b += bucketSize) {
    bars.push({ key: b, label: bucketSize === 1 ? `'${String(b).slice(2)}` : String(b), count: buckets.get(b) ?? 0 });
  }
  const maxCount = Math.max(...bars.map(b => b.count));
  return { bars, max: maxCount, bucketSize };
}

export function buildMapGroups(items) {
  const groups = new Map();
  for (const i of items) {
    if (i.acquired_lat == null || i.acquired_lng == null) continue;
    const city = cityOf(i.acquired_location);
    const key = city
      ? `city:${city.toLowerCase()}`
      : `coord:${Math.round(i.acquired_lat * 10) / 10},${Math.round(i.acquired_lng * 10) / 10}`;
    let g = groups.get(key);
    if (!g) {
      g = { key, city, items: [], latSum: 0, lngSum: 0 };
      groups.set(key, g);
    }
    g.items.push(i);
    g.latSum += i.acquired_lat;
    g.lngSum += i.acquired_lng;
  }
  return [...groups.values()].map(g => {
    const withImage = g.items.filter(i => i.image_url);
    const pool = withImage.length > 0 ? withImage : g.items;
    const shuffled = [...pool].sort(() => Math.random() - 0.5);
    return {
      key: g.key,
      lat: g.latSum / g.items.length,
      lng: g.lngSum / g.items.length,
      city: g.city,
      count: g.items.length,
      samples: shuffled.slice(0, 5),
      regionLabel: g.items[0]?.acquired_location?.split(',').slice(1, 3).join(',').trim() || null,
    };
  });
}
