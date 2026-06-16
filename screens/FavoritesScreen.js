import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useCollection } from '../lib/CollectionProvider';
import { supabase } from '../lib/supabase';
import { fetchFavorites } from '../shared/likesApi';
import { favoritesCacheKey } from '../shared/cacheKeys';
import { S } from '../shared/strings';
import ItemGrid from './ItemGrid';
import ItemDetailModal from './ItemDetailModal';
import { C } from '../shared/theme';

export default function FavoritesScreen() {
  const router = useRouter();
  const { session, blockedIds, blockedByIds, likedItemIds } = useCollection();
  const [favorites, setFavorites] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);

  const load = useCallback(async () => {
    if (!session) return;
    try {
      const rows = await fetchFavorites(supabase, session.user.id, { blockedIds: [...blockedIds], blockedByIds: [...blockedByIds] });
      setFavorites(rows);
      AsyncStorage.setItem(favoritesCacheKey(session.user.id), JSON.stringify(rows));
    } catch (e) {
      console.error('fetchFavorites error:', e);
    }
  }, [session, blockedIds, blockedByIds]);

  useEffect(() => {
    if (!session) return;
    let cancelled = false;
    setLoading(true);
    // Show the last-known favorites right away; only spin if we've never loaded.
    AsyncStorage.getItem(favoritesCacheKey(session.user.id)).then(raw => {
      if (cancelled || !raw) return;
      try { setFavorites(JSON.parse(raw)); setLoading(false); } catch { /* ignore */ }
    });
    load().finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [load, session]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try { await load(); } finally { setRefreshing(false); }
  }, [load]);

  // Drop items as they're un-favorited (the heart lives in the detail modal and
  // mutates likedItemIds in the provider) so the grid stays in sync without a refetch.
  const visibleFavorites = useMemo(
    () => favorites.filter(i => likedItemIds.has(i.id)),
    [favorites, likedItemIds],
  );

  const idx = visibleFavorites.findIndex(i => i.id === selectedItem?.id);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} hitSlop={8}>
          <Ionicons name="chevron-back" size={28} color={C.ink} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>{S.favorites.title}</Text>
          <Text style={styles.subtitle}>
            {visibleFavorites.length === 0 ? S.favorites.subtitle : S.favorites.count(visibleFavorites.length)}
          </Text>
        </View>
      </View>

      {loading ? (
        <View style={styles.empty}><ActivityIndicator color="#999" /></View>
      ) : visibleFavorites.length === 0 ? (
        <View style={styles.empty}>
          <Ionicons name="heart-outline" size={44} color="#ddd" />
          <Text style={styles.emptyText}>{S.favorites.empty}</Text>
          <Text style={styles.emptyHint}>{S.favorites.emptyHint}</Text>
        </View>
      ) : (
        <ItemGrid
          items={visibleFavorites}
          onItemPress={setSelectedItem}
          refreshing={refreshing}
          onRefresh={onRefresh}
          paddingBottom={48}
        />
      )}

      <ItemDetailModal
        visible={!!selectedItem}
        item={selectedItem}
        onClose={() => setSelectedItem(null)}
        onPrev={idx > 0 ? () => setSelectedItem(visibleFavorites[idx - 1]) : null}
        onNext={idx >= 0 && idx < visibleFavorites.length - 1 ? () => setSelectedItem(visibleFavorites[idx + 1]) : null}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: C.bg,
    paddingTop: 60,
    paddingHorizontal: 24,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 16,
    gap: 4,
  },
  backBtn: {
    paddingTop: 2,
    paddingRight: 4,
    marginLeft: -8,
  },
  title: {
    fontSize: 28,
    fontWeight: '300',
    letterSpacing: 1,
    color: C.ink,
    fontFamily: 'Georgia',
  },
  subtitle: {
    fontSize: 13,
    color: '#999',
    marginTop: 6,
    letterSpacing: 0.5,
  },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  emptyText: {
    fontSize: 16,
    color: C.ink,
  },
  emptyHint: {
    fontSize: 13,
    color: '#999',
    textAlign: 'center',
  },
});
