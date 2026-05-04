import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useMemo } from 'react';
import { Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import MapView, { Marker, PROVIDER_DEFAULT } from 'react-native-maps';
import { useCollection } from '../lib/CollectionProvider';

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function startOfDay(d) { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; }
function dayKey(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
}
function startOfWeek(d) {
  const x = startOfDay(d);
  const diff = (x.getDay() + 6) % 7;
  x.setDate(x.getDate() - diff);
  return x;
}
function weekKey(d) { return dayKey(startOfWeek(d)); }
function monthKey(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}
function lastNDays(n) {
  const today = startOfDay(new Date());
  const out = [];
  for (let i = n - 1; i >= 0; i--) { const d = new Date(today); d.setDate(d.getDate() - i); out.push(d); }
  return out;
}
function lastNWeeks(n) {
  const start = startOfWeek(new Date());
  const out = [];
  for (let i = n - 1; i >= 0; i--) { const d = new Date(start); d.setDate(d.getDate() - i * 7); out.push(d); }
  return out;
}
function lastNMonths(n) {
  const today = new Date();
  const out = [];
  for (let i = n - 1; i >= 0; i--) out.push(new Date(today.getFullYear(), today.getMonth() - i, 1));
  return out;
}
function computeStreak(byDay) {
  if (byDay.size === 0) return 0;
  const cursor = startOfDay(new Date());
  if (!byDay.has(dayKey(cursor))) cursor.setDate(cursor.getDate() - 1);
  let streak = 0;
  while (byDay.has(dayKey(cursor))) { streak++; cursor.setDate(cursor.getDate() - 1); }
  return streak;
}
function computeLongestStreak(byDay) {
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
function bucketize(items, keyFn) {
  const m = new Map();
  for (const item of items) {
    const k = keyFn(new Date(item.created_at));
    m.set(k, (m.get(k) ?? 0) + 1);
  }
  return m;
}
function formatDayLabel(d, i, total) {
  if (total <= 14) return String(d.getDate());
  if (i === total - 1) return String(d.getDate());
  if (d.getDate() === 1) return MONTH_NAMES[d.getMonth()].toLowerCase();
  if (d.getDay() === 1) return String(d.getDate());
  return '';
}
function formatWeekLabel(d) { return `${d.getMonth() + 1}/${d.getDate()}`; }
function formatMonthLabel(d) { return MONTH_NAMES[d.getMonth()].toLowerCase(); }

function Bar({ count, max, label }) {
  const heightPct = max > 0 ? (count / max) * 100 : 0;
  return (
    <View style={styles.barCol}>
      <View style={styles.barTrack}>
        {count > 0 && (
          <View style={[styles.barFill, { height: `${Math.max(heightPct, 2)}%` }]}>
            <Text style={styles.barValue}>{count}</Text>
          </View>
        )}
      </View>
      <Text style={styles.barLabel} numberOfLines={1}>{label}</Text>
    </View>
  );
}

function Card({ label, value, sub }) {
  return (
    <View style={styles.card}>
      <Text style={styles.cardLabel}>{label}</Text>
      <Text style={styles.cardValue}>{value}</Text>
      <Text style={styles.cardSub} numberOfLines={1}>{sub}</Text>
    </View>
  );
}

export default function StatsScreen() {
  const router = useRouter();
  const { items } = useCollection();

  const stats = useMemo(() => {
    const byDay = bucketize(items, dayKey);
    const byWeek = bucketize(items, weekKey);
    const byMonth = bucketize(items, monthKey);
    const streak = computeStreak(byDay);
    const longest = computeLongestStreak(byDay);
    let bestDayKey = null, bestDayCount = 0;
    for (const [k, v] of byDay) if (v > bestDayCount) { bestDayKey = k; bestDayCount = v; }
    return { byDay, byWeek, byMonth, streak, longest, bestDayKey, bestDayCount };
  }, [items]);

  const days = lastNDays(30);
  const weeks = lastNWeeks(12);
  const months = lastNMonths(12);
  const dayMax = Math.max(0, ...days.map(d => stats.byDay.get(dayKey(d)) ?? 0));
  const weekMax = Math.max(0, ...weeks.map(d => stats.byWeek.get(weekKey(d)) ?? 0));
  const monthMax = Math.max(0, ...months.map(d => stats.byMonth.get(monthKey(d)) ?? 0));
  const bestDayDate = stats.bestDayKey ? new Date(stats.bestDayKey) : null;

  const yearStats = useMemo(() => {
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
  }, [items]);

  const mapMarkers = useMemo(() => {
    return items
      .filter(i => i.acquired_lat != null && i.acquired_lng != null)
      .map(i => ({
        id: i.id,
        lat: i.acquired_lat,
        lng: i.acquired_lng,
        title: i.name || i.acquired_location?.split(',')[0] || 'item',
        subtitle: i.acquired_year ? String(i.acquired_year) : (i.acquired_location?.split(',').slice(1, 3).join(',').trim() ?? ''),
      }));
  }, [items]);

  const mapRegion = useMemo(() => {
    if (mapMarkers.length === 0) return null;
    const lats = mapMarkers.map(m => m.lat);
    const lngs = mapMarkers.map(m => m.lng);
    const minLat = Math.min(...lats), maxLat = Math.max(...lats);
    const minLng = Math.min(...lngs), maxLng = Math.max(...lngs);
    const latDelta = Math.max(0.5, (maxLat - minLat) * 1.4);
    const lngDelta = Math.max(0.5, (maxLng - minLng) * 1.4);
    return {
      latitude: (minLat + maxLat) / 2,
      longitude: (minLng + maxLng) / 2,
      latitudeDelta: latDelta,
      longitudeDelta: lngDelta,
    };
  }, [mapMarkers]);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={28} color="#2D2D2D" />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>stats</Text>
          <Text style={styles.subtitle}>your collection over time</Text>
        </View>
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 40 }}>
        {items.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyText}>nothing to show yet</Text>
          </View>
        ) : (
          <>
            <View style={styles.summary}>
              <Card label="total" value={items.length} sub={items.length === 1 ? 'object' : 'objects'} />
              <Card label="streak" value={stats.streak} sub={stats.streak === 1 ? 'day' : 'days'} />
              <Card label="longest" value={stats.longest} sub={stats.longest === 1 ? 'day' : 'days'} />
              <Card
                label="best day"
                value={stats.bestDayCount}
                sub={bestDayDate ? `${MONTH_NAMES[bestDayDate.getMonth()].toLowerCase()} ${bestDayDate.getDate()}` : '—'}
              />
            </View>

            <Section title="last 30 days">
              <View style={styles.chart}>
                {days.map((d, i) => {
                  const k = dayKey(d);
                  return <Bar key={k} count={stats.byDay.get(k) ?? 0} max={dayMax} label={formatDayLabel(d, i, days.length)} />;
                })}
              </View>
            </Section>

            <Section title="last 12 weeks">
              <View style={styles.chart}>
                {weeks.map(d => {
                  const k = weekKey(d);
                  return <Bar key={k} count={stats.byWeek.get(k) ?? 0} max={weekMax} label={formatWeekLabel(d)} />;
                })}
              </View>
            </Section>

            <Section title="last 12 months">
              <View style={styles.chart}>
                {months.map(d => {
                  const k = monthKey(d);
                  return <Bar key={k} count={stats.byMonth.get(k) ?? 0} max={monthMax} label={formatMonthLabel(d)} />;
                })}
              </View>
            </Section>

            {yearStats && (
              <Section title={`acquisition ${yearStats.bucketSize === 1 ? 'years' : `${yearStats.bucketSize}-year periods`}`}>
                <View style={styles.chart}>
                  {yearStats.bars.map(b => (
                    <Bar key={b.key} count={b.count} max={yearStats.max} label={b.label} />
                  ))}
                </View>
              </Section>
            )}

            {mapMarkers.length > 0 && mapRegion && (
              <Section title="acquired around the world">
                <View style={styles.mapWrap}>
                  <MapView
                    style={styles.map}
                    provider={PROVIDER_DEFAULT}
                    initialRegion={mapRegion}
                  >
                    {mapMarkers.map(m => (
                      <Marker
                        key={m.id}
                        coordinate={{ latitude: m.lat, longitude: m.lng }}
                        title={m.title}
                        description={m.subtitle}
                      />
                    ))}
                  </MapView>
                </View>
                <Text style={styles.mapCaption}>
                  {mapMarkers.length} object{mapMarkers.length === 1 ? '' : 's'} with a known location
                </Text>
              </Section>
            )}
          </>
        )}
      </ScrollView>
    </View>
  );
}

function Section({ title, children }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F0EB',
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
    paddingHorizontal: 24,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 24,
    gap: 4,
  },
  backBtn: {
    paddingTop: 4,
    paddingRight: 4,
    marginLeft: -8,
  },
  title: {
    fontSize: 32,
    fontWeight: '300',
    letterSpacing: 1,
    color: '#2D2D2D',
    fontFamily: Platform.OS === 'ios' ? 'Georgia' : undefined,
  },
  subtitle: {
    fontSize: 13,
    color: '#999',
    marginTop: 4,
    letterSpacing: 0.5,
  },
  empty: {
    paddingVertical: 80,
    alignItems: 'center',
  },
  emptyText: {
    color: '#999',
    fontSize: 14,
  },
  summary: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 32,
  },
  card: {
    flexBasis: '47%',
    flexGrow: 1,
    borderWidth: 1.5,
    borderColor: '#E0E0E0',
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: '#fff',
  },
  cardLabel: {
    fontSize: 10,
    textTransform: 'uppercase',
    letterSpacing: 1,
    color: '#999',
    marginBottom: 8,
  },
  cardValue: {
    fontSize: 28,
    fontWeight: '300',
    color: '#2D2D2D',
    fontFamily: Platform.OS === 'ios' ? 'Georgia' : undefined,
  },
  cardSub: {
    fontSize: 11,
    color: '#999',
    marginTop: 4,
  },
  section: {
    marginBottom: 32,
  },
  sectionTitle: {
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 1,
    color: '#999',
    marginBottom: 14,
  },
  chart: {
    flexDirection: 'row',
    alignItems: 'stretch',
    height: 180,
    paddingTop: 18,
    borderBottomWidth: 1,
    borderBottomColor: '#E8E3DD',
    gap: 3,
  },
  barCol: {
    flex: 1,
    alignItems: 'center',
    minWidth: 0,
  },
  barTrack: {
    flex: 1,
    width: '100%',
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  barFill: {
    width: '90%',
    maxWidth: 28,
    backgroundColor: '#2D2D2D',
    borderTopLeftRadius: 4,
    borderTopRightRadius: 4,
  },
  barValue: {
    position: 'absolute',
    top: -14,
    fontSize: 9,
    color: '#999',
    width: 24,
    textAlign: 'center',
    left: '50%',
    marginLeft: -12,
  },
  barLabel: {
    fontSize: 9,
    color: '#999',
    marginTop: 4,
    height: 12,
  },
  mapWrap: {
    height: 320,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#E8E3DD',
  },
  map: {
    flex: 1,
  },
  mapCaption: {
    fontSize: 11,
    color: '#999',
    marginTop: 8,
    textAlign: 'center',
  },
});
