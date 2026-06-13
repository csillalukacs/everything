import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Modal, Platform, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Image } from 'expo-image';
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
import { thumbOf, isRetired } from '../shared/items';
import { S } from '../shared/strings';
import { buildTagDistribution, computeYearStats, buildMapGroups } from '../shared/stats';
import { Bar, PieChart, StatCard } from './StatsComponents';
import { C } from '../shared/theme';

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

export default function StatsScreen() {
  const router = useRouter();
  const { items: allItems, itemCount, itemsLoading, session, refresh } = useCollection();
  // Stats reflect the active collection only — retired (graveyard) things are excluded.
  const items = useMemo(() => allItems.filter(i => !isRetired(i)), [allItems]);
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

  const tagDistribution = useMemo(() => buildTagDistribution(items), [items]);
  const yearStats = useMemo(() => computeYearStats(items), [items]);
  const mapGroups = useMemo(() => buildMapGroups(items), [items]);

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
          <Ionicons name="chevron-back" size={28} color={C.ink} />
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
              <StatCard label={S.stats.total} value={itemCount ?? items.length} sub={S.stats.objectsLabel(itemCount ?? items.length)} />
              <StatCard label={S.stats.streakMobile} value={stats.streak} sub={S.stats.daysLabel(stats.streak)} />
              <StatCard label={S.stats.longestMobile} value={stats.longest} sub={S.stats.daysLabel(stats.longest)} />
              <StatCard
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
                        pinColor={C.ink}
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
                <Ionicons name="chevron-forward" size={16} color={C.ink} />
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
    backgroundColor: C.bg,
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
    color: C.ink,
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
    borderBottomColor: C.surface,
    gap: 3,
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
    color: C.ink,
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
    backgroundColor: C.surface,
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
    backgroundColor: C.bg,
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: Platform.OS === 'ios' ? 40 : 24,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },
  sheetTitle: {
    fontSize: 20,
    fontWeight: '400',
    color: C.ink,
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
    backgroundColor: C.surface,
    overflow: 'hidden',
  },
  sheetThumbImg: {
    width: '100%',
    height: '100%',
  },
  sheetThumbPlaceholder: {
    flex: 1,
    backgroundColor: C.surface,
  },
  sheetSeeAll: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    marginTop: 18,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: C.surface,
  },
  sheetSeeAllText: {
    fontSize: 14,
    color: C.ink,
    letterSpacing: 0.3,
  },
});
