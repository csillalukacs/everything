import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Modal, Platform, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Image } from 'expo-image';
import { Canvas, Path, Skia } from '@shopify/react-native-skia';
import { useCollection } from '../lib/CollectionProvider';
import { supabase } from '../lib/supabase';
import {
  MONTH_NAMES,
  dayKey,
  weekKey,
  monthKey,
  lastNDays,
  lastNWeeks,
  lastNMonths,
  bucketize,
  computeStreak,
  computeLongestStreak,
  formatDayLabel,
  formatWeekLabel,
  formatMonthLabel,
} from '../shared/dates';
import { cityOf, thumbOf } from '../shared/items';
import { S } from '../shared/strings';

const PIE_PALETTE = [
  '#C5705D', '#D4A55C', '#8FA363', '#5C9A8C', '#5A7CA8',
  '#8A6FA3', '#B5688A', '#8B6F47', '#A89B6E', '#5C5C5C',
];
const PIE_UNTAGGED_COLOR = '#D5D0C8';

let MapView = null;
let Marker = null;
let Polyline = null;
let PROVIDER_DEFAULT = null;
try {
  const maps = require('react-native-maps');
  MapView = maps.default;
  Marker = maps.Marker;
  Polyline = maps.Polyline;
  PROVIDER_DEFAULT = maps.PROVIDER_DEFAULT;
} catch {
  // react-native-maps native module not registered — map section will be hidden.
}

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

function PieChart({ slices, total, size = 220 }) {
  const r = size / 2;
  const cx = size / 2;
  const cy = size / 2;
  const paths = useMemo(() => {
    if (slices.length === 1) {
      const path = Skia.Path.Make();
      path.addCircle(cx, cy, r);
      return [{ path, color: slices[0].color }];
    }
    let cumDeg = -90;
    return slices.map(slice => {
      const sweep = (slice.count / total) * 360;
      const startDeg = cumDeg;
      cumDeg += sweep;
      const path = Skia.Path.Make();
      path.moveTo(cx, cy);
      const startRad = (startDeg * Math.PI) / 180;
      path.lineTo(cx + r * Math.cos(startRad), cy + r * Math.sin(startRad));
      const oval = Skia.XYWHRect(cx - r, cy - r, 2 * r, 2 * r);
      path.arcToOval(oval, startDeg, sweep, false);
      path.close();
      return { path, color: slice.color };
    });
  }, [slices, total, cx, cy, r]);
  return (
    <Canvas style={{ width: size, height: size }}>
      {paths.map((p, i) => <Path key={i} path={p.path} color={p.color} />)}
    </Canvas>
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
  const { items, itemCount, itemsLoading, session, refresh } = useCollection();
  const [home, setHome] = useState(null);
  const [selectedGroup, setSelectedGroup] = useState(null);
  const [refreshing, setRefreshing] = useState(false);

  const fetchHome = useCallback(async () => {
    if (!session) return;
    const { data } = await supabase
      .from('profiles')
      .select('home_location, home_lat, home_lng')
      .eq('user_id', session.user.id)
      .maybeSingle();
    if (data?.home_lat != null && data?.home_lng != null) {
      setHome({ lat: data.home_lat, lng: data.home_lng, location: data.home_location });
    } else {
      setHome(null);
    }
  }, [session]);

  useEffect(() => {
    fetchHome().catch(() => {});
  }, [fetchHome]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try { await Promise.all([refresh(), fetchHome()]); } finally { setRefreshing(false); }
  }, [refresh, fetchHome]);

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

  const tagDistribution = useMemo(() => {
    if (items.length === 0) return null;
    const appearances = new Map();
    for (const item of items) {
      for (const tag of item.tags ?? []) {
        appearances.set(tag.name, (appearances.get(tag.name) ?? 0) + 1);
      }
    }
    const tagCounts = new Map();
    let untaggedCount = 0;
    for (const item of items) {
      const tags = item.tags ?? [];
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
    if (untaggedCount > 0) slices.push({ label: S.collection.untagged, count: untaggedCount, kind: 'untagged', color: PIE_UNTAGGED_COLOR });
    if (slices.length === 0) return null;
    const total = slices.reduce((sum, s) => sum + s.count, 0);
    return { slices, total };
  }, [items]);

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

  const mapGroups = useMemo(() => {
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
  }, [items]);

  const totalLocatedItems = useMemo(
    () => mapGroups.reduce((sum, g) => sum + g.count, 0),
    [mapGroups]
  );

  const mapRegion = useMemo(() => {
    if (mapGroups.length === 0) return null;
    const lats = mapGroups.map(g => g.lat);
    const lngs = mapGroups.map(g => g.lng);
    if (home) { lats.push(home.lat); lngs.push(home.lng); }
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
  }, [mapGroups, home]);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={28} color="#2D2D2D" />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>{S.stats.title}</Text>
          <Text style={styles.subtitle}>{S.stats.subtitle}</Text>
        </View>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: 40 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#999" />
        }
      >
        {items.length === 0 ? (
          <View style={styles.empty}>
            {itemsLoading ? (
              <ActivityIndicator color="#999" />
            ) : (
              <Text style={styles.emptyText}>{S.stats.empty}</Text>
            )}
          </View>
        ) : (
          <>
            <View style={styles.summary}>
              <Card label={S.stats.total} value={itemCount ?? items.length} sub={S.stats.objectsLabel(itemCount ?? items.length)} />
              <Card label={S.stats.streakMobile} value={stats.streak} sub={S.stats.daysLabel(stats.streak)} />
              <Card label={S.stats.longestMobile} value={stats.longest} sub={S.stats.daysLabel(stats.longest)} />
              <Card
                label={S.stats.bestDay}
                value={stats.bestDayCount}
                sub={bestDayDate ? `${MONTH_NAMES[bestDayDate.getMonth()].toLowerCase()} ${bestDayDate.getDate()}` : '—'}
              />
            </View>

            <Section title={S.stats.last30Days}>
              <View style={styles.chart}>
                {days.map((d, i) => {
                  const k = dayKey(d);
                  return <Bar key={k} count={stats.byDay.get(k) ?? 0} max={dayMax} label={formatDayLabel(d, i, days.length)} />;
                })}
              </View>
            </Section>

            <Section title={S.stats.last12Weeks}>
              <View style={styles.chart}>
                {weeks.map(d => {
                  const k = weekKey(d);
                  return <Bar key={k} count={stats.byWeek.get(k) ?? 0} max={weekMax} label={formatWeekLabel(d)} />;
                })}
              </View>
            </Section>

            <Section title={S.stats.last12Months}>
              <View style={styles.chart}>
                {months.map(d => {
                  const k = monthKey(d);
                  return <Bar key={k} count={stats.byMonth.get(k) ?? 0} max={monthMax} label={formatMonthLabel(d)} />;
                })}
              </View>
            </Section>

            {tagDistribution && (
              <Section title={S.stats.tags}>
                <View style={styles.pieWrap}>
                  <PieChart slices={tagDistribution.slices} total={tagDistribution.total} />
                </View>
                <View style={styles.legend}>
                  {tagDistribution.slices.map(s => {
                    const pct = Math.round((s.count / tagDistribution.total) * 100);
                    return (
                      <View key={`${s.kind}:${s.label}`} style={styles.legendRow}>
                        <View style={[styles.legendSwatch, { backgroundColor: s.color }]} />
                        <Text style={styles.legendLabel} numberOfLines={1}>{s.label}</Text>
                        <Text style={styles.legendValue}>{pct}%</Text>
                      </View>
                    );
                  })}
                </View>
              </Section>
            )}

            {yearStats && (
              <Section title={S.stats.acquisitionTitle(yearStats.bucketSize)}>
                <View style={styles.chart}>
                  {yearStats.bars.map(b => (
                    <Bar key={b.key} count={b.count} max={yearStats.max} label={b.label} />
                  ))}
                </View>
              </Section>
            )}

            {MapView && mapGroups.length > 0 && mapRegion && (
              <Section title={S.stats.acquiredAroundWorld}>
                <View style={styles.mapWrap}>
                  <MapView
                    style={styles.map}
                    provider={PROVIDER_DEFAULT}
                    initialRegion={mapRegion}
                  >
                    {home && Polyline && mapGroups.map(g => (
                      <Polyline
                        key={`line-${g.key}`}
                        coordinates={[
                          { latitude: home.lat, longitude: home.lng },
                          { latitude: g.lat, longitude: g.lng },
                        ]}
                        strokeColor="rgba(45,45,45,0.35)"
                        strokeWidth={1}
                      />
                    ))}
                    {mapGroups.map(g => (
                      <Marker
                        key={g.key}
                        coordinate={{ latitude: g.lat, longitude: g.lng }}
                        title={g.city || S.stats.unnamedLocation}
                        description={S.stats.objectCount(g.count)}
                        onPress={() => setSelectedGroup(g)}
                      />
                    ))}
                    {home && (
                      <Marker
                        coordinate={{ latitude: home.lat, longitude: home.lng }}
                        title={S.stats.home}
                        description={home.location?.split(',')[0]}
                        pinColor="#2D2D2D"
                      />
                    )}
                  </MapView>
                </View>
                <Text style={styles.mapCaption}>
                  {S.stats.mapCaption(totalLocatedItems, mapGroups.length)}
                  {home ? S.stats.connectedTo(home.location?.split(',')[0]) : ''}
                </Text>
              </Section>
            )}
          </>
        )}
      </ScrollView>

      <Modal
        visible={selectedGroup != null}
        transparent
        animationType="fade"
        onRequestClose={() => setSelectedGroup(null)}
      >
        <Pressable style={styles.sheetBackdrop} onPress={() => setSelectedGroup(null)}>
          <Pressable style={styles.sheet} onPress={() => {}}>
            <Text style={styles.sheetTitle}>{selectedGroup?.city || S.stats.unnamedLocation}</Text>
            <Text style={styles.sheetSub}>
              {S.stats.objectCountWithRegion(selectedGroup?.count ?? 0, selectedGroup?.regionLabel)}
            </Text>
            {selectedGroup?.samples?.length > 0 && (
              <View style={styles.sheetThumbs}>
                {selectedGroup.samples.map(s => (
                  <View key={s.id} style={styles.sheetThumb}>
                    {s.image_url
                      ? <Image source={{ uri: thumbOf(s) }} style={styles.sheetThumbImg} contentFit="cover" />
                      : <View style={styles.sheetThumbPlaceholder} />
                    }
                  </View>
                ))}
              </View>
            )}
            {selectedGroup?.city && (
              <TouchableOpacity
                style={styles.sheetSeeAll}
                onPress={() => {
                  const city = selectedGroup.city;
                  setSelectedGroup(null);
                  router.push({ pathname: '/', params: { city } });
                }}
              >
                <Text style={styles.sheetSeeAllText}>{S.stats.seeAllFromMobile(selectedGroup.city)}</Text>
                <Ionicons name="chevron-forward" size={16} color="#2D2D2D" />
              </TouchableOpacity>
            )}
          </Pressable>
        </Pressable>
      </Modal>
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
  pieWrap: {
    alignItems: 'center',
    marginBottom: 18,
  },
  legend: {
    gap: 8,
  },
  legendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  legendSwatch: {
    width: 12,
    height: 12,
    borderRadius: 3,
  },
  legendLabel: {
    flex: 1,
    fontSize: 13,
    color: '#2D2D2D',
  },
  legendValue: {
    fontSize: 12,
    color: '#999',
    fontVariant: ['tabular-nums'],
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
  sheetBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#F5F0EB',
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: Platform.OS === 'ios' ? 40 : 24,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },
  sheetTitle: {
    fontSize: 20,
    fontWeight: '400',
    color: '#2D2D2D',
    fontFamily: Platform.OS === 'ios' ? 'Georgia' : undefined,
  },
  sheetSub: {
    fontSize: 12,
    color: '#999',
    marginTop: 4,
  },
  sheetThumbs: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 16,
  },
  sheetThumb: {
    width: 56,
    height: 56,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    backgroundColor: '#E8E3DD',
    overflow: 'hidden',
  },
  sheetThumbImg: {
    width: '100%',
    height: '100%',
  },
  sheetThumbPlaceholder: {
    flex: 1,
    backgroundColor: '#E8E3DD',
  },
  sheetSeeAll: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    marginTop: 18,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: '#E8E3DD',
  },
  sheetSeeAllText: {
    fontSize: 14,
    color: '#2D2D2D',
    letterSpacing: 0.3,
  },
});
