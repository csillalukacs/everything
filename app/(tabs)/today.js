import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Dimensions,
  Easing,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { useCollection } from '../../lib/CollectionProvider';
import ItemDetailModal from '../../screens/ItemDetailModal';
import { thumbOf } from '../../shared/items';
import { dayKey } from '../../shared/dates';
import { S } from '../../shared/strings';

const SCREEN_WIDTH = Dimensions.get('window').width;
const GRID_PADDING = 24;
const GRID_GAP = 8;
const GRID_CARD_SIZE = (SCREEN_WIDTH - GRID_PADDING * 2 - GRID_GAP * 2) / 3;
const TAB_BAR_HEIGHT = 70;
const DAILY_COUNT = 9;
const FLIP_DURATION = 650;
const SHINE_DURATION = 1100;
const SHINE_GAP_MIN = 2200;
const SHINE_GAP_MAX = 5200;

const dailyCacheKey = userId => `shuffle:daily:${userId}`;

function shuffleInPlace(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function DailyCard({ item, revealed, shouldShine, onReveal, onOpen }) {
  const flip = useRef(new Animated.Value(revealed ? 1 : 0)).current;
  const shine = useRef(new Animated.Value(0)).current;

  function handlePress() {
    if (revealed) {
      onOpen();
      return;
    }
    onReveal();
    Animated.timing(flip, {
      toValue: 1,
      duration: FLIP_DURATION,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }

  useEffect(() => {
    if (revealed || !shouldShine) {
      shine.stopAnimation();
      shine.setValue(0);
      return;
    }
    shine.setValue(0);
    Animated.timing(shine, {
      toValue: 1,
      duration: SHINE_DURATION,
      easing: Easing.inOut(Easing.quad),
      useNativeDriver: true,
    }).start();
  }, [shouldShine, revealed, shine]);

  const coverRotate = flip.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '180deg'],
  });
  const revealRotate = flip.interpolate({
    inputRange: [0, 1],
    outputRange: ['180deg', '360deg'],
  });
  const shineTranslate = shine.interpolate({
    inputRange: [0, 1],
    outputRange: [-50, GRID_CARD_SIZE + 50],
  });

  return (
    <TouchableOpacity
      style={styles.cardWrap}
      onPress={handlePress}
      activeOpacity={0.9}
    >
      <Animated.View
        style={[
          styles.face,
          styles.coverFace,
          { transform: [{ perspective: 800 }, { rotateY: coverRotate }] },
        ]}
      >
        <Image
          source={require('../../assets/card.png')}
          style={styles.cardImage}
          contentFit="cover"
          cachePolicy="memory-disk"
        />
        {!revealed && (
          <Animated.View
            style={[styles.shineTrack, { transform: [{ translateX: shineTranslate }] }]}
            pointerEvents="none"
          >
            <View style={styles.shineOuter} />
            <View style={styles.shineMid} />
            <View style={styles.shineInner} />
          </Animated.View>
        )}
      </Animated.View>
      <Animated.View
        style={[
          styles.face,
          styles.revealFace,
          { transform: [{ perspective: 800 }, { rotateY: revealRotate }] },
        ]}
      >
        {item.image_url && (
          <Image
            source={{ uri: thumbOf(item) }}
            style={styles.cardImage}
            recyclingKey={item.id}
            cachePolicy="memory-disk"
            contentFit="cover"
          />
        )}
        {item.is_private && (
          <View style={styles.privateBadge}>
            <Ionicons name="lock-closed" size={10} color="#fff" />
          </View>
        )}
      </Animated.View>
    </TouchableOpacity>
  );
}

export default function Today() {
  const insets = useSafeAreaInsets();
  const { session, items, itemsLoading, tags, refresh, updateItem, deleteItem } = useCollection();
  const userId = session?.user?.id;

  const [sampleIds, setSampleIds] = useState([]);
  const [revealedIds, setRevealedIds] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [today, setToday] = useState(() => dayKey(new Date()));
  const [selectedItem, setSelectedItem] = useState(null);
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    setToday(dayKey(new Date()));
    try { await refresh(); } finally { setRefreshing(false); }
  }, [refresh]);

  // Load cached daily selection once we know the user.
  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    AsyncStorage.getItem(dailyCacheKey(userId)).then(str => {
      if (cancelled) return;
      const parsed = str ? JSON.parse(str) : null;
      if (parsed?.date === today && Array.isArray(parsed.itemIds)) {
        setSampleIds(parsed.itemIds);
        if (Array.isArray(parsed.revealedIds)) setRevealedIds(parsed.revealedIds);
      }
      setLoaded(true);
    });
    return () => { cancelled = true; };
  }, [userId, today]);

  // Keep the sample in sync with the collection:
  // - If today's selection is empty/stale, pick fresh.
  // - If one of the selected items was deleted, refill that slot only.
  //   The refilled item starts face-down (not in revealedIds).
  // - Adding/removing other items does NOT change the selection.
  useEffect(() => {
    if (!loaded || !userId) return;
    if (items.length === 0) return; // wait until items have loaded

    const itemsById = new Map(items.map(i => [i.id, i]));
    const present = sampleIds.filter(id => itemsById.has(id));
    const target = Math.min(DAILY_COUNT, items.length);

    if (present.length === target && present.length === sampleIds.length) return;

    const presentSet = new Set(present);
    const candidates = items.filter(i => !presentSet.has(i.id));
    shuffleInPlace(candidates);
    const additions = candidates.slice(0, target - present.length).map(i => i.id);
    const next = [...present, ...additions];

    setSampleIds(next);
    const nextSet = new Set(next);
    setRevealedIds(prev => prev.filter(id => nextSet.has(id)));
  }, [items, sampleIds, loaded, userId, today]);

  // Persist whenever the daily state changes.
  useEffect(() => {
    if (!loaded || !userId) return;
    AsyncStorage.setItem(
      dailyCacheKey(userId),
      JSON.stringify({ date: today, itemIds: sampleIds, revealedIds }),
    );
  }, [sampleIds, revealedIds, loaded, userId, today]);

  const sample = useMemo(() => {
    const byId = new Map(items.map(i => [i.id, i]));
    return sampleIds.map(id => byId.get(id)).filter(Boolean);
  }, [sampleIds, items]);

  const revealedSet = useMemo(() => new Set(revealedIds), [revealedIds]);
  const revealedSample = useMemo(
    () => sample.filter(i => revealedSet.has(i.id)),
    [sample, revealedSet],
  );
  const unrevealedIds = useMemo(
    () => sampleIds.filter(id => !revealedSet.has(id)),
    [sampleIds, revealedSet],
  );

  const [currentShineId, setCurrentShineId] = useState(null);
  useEffect(() => {
    if (unrevealedIds.length === 0) {
      setCurrentShineId(null);
      return;
    }
    let cancelled = false;
    let timeoutId;

    function pickNext(prevId) {
      const pool = unrevealedIds.length > 1
        ? unrevealedIds.filter(id => id !== prevId)
        : unrevealedIds;
      return pool[Math.floor(Math.random() * pool.length)];
    }

    function scheduleNext(prevId, immediate) {
      const gap = SHINE_GAP_MIN + Math.random() * (SHINE_GAP_MAX - SHINE_GAP_MIN);
      const delay = immediate ? 0 : SHINE_DURATION + gap;
      timeoutId = setTimeout(() => {
        if (cancelled) return;
        const next = pickNext(prevId);
        setCurrentShineId(next);
        scheduleNext(next, false);
      }, delay);
    }

    scheduleNext(null, true);

    return () => {
      cancelled = true;
      clearTimeout(timeoutId);
    };
  }, [unrevealedIds]);

  function reveal(id) {
    setRevealedIds(prev => (prev.includes(id) ? prev : [...prev, id]));
  }

  async function handleUpdate(name, photoOrUri, tagNames, isPrivate, description, acquired, ocrText, previousImageUrls) {
    if (!selectedItem) return;
    const updated = await updateItem(selectedItem.id, name, photoOrUri, tagNames, isPrivate, description, acquired, ocrText, previousImageUrls);
    if (updated) setSelectedItem(updated);
  }

  async function handleDelete() {
    const item = selectedItem;
    setSelectedItem(null);
    if (item) await deleteItem(item.id);
  }

  const tabBarOffset = TAB_BAR_HEIGHT + Math.max(insets.bottom, 12);

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + 16 }]}>
        <Text style={styles.title}>{S.today.title}</Text>
        <Text style={styles.subtitle}>{S.today.subtitle}</Text>
      </View>
      <ScrollView
        contentContainerStyle={[styles.scrollContent, { paddingBottom: tabBarOffset }]}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#999" />
        }
      >
        {sample.length === 0 ? (
          <View style={styles.empty}>
            {itemsLoading || items.length > 0 ? (
              <ActivityIndicator color="#999" />
            ) : (
              <Text style={styles.emptyText}>{S.today.empty}</Text>
            )}
          </View>
        ) : (
          <View style={styles.grid}>
            {sample.map(item => (
              <DailyCard
                key={item.id}
                item={item}
                revealed={revealedSet.has(item.id)}
                shouldShine={item.id === currentShineId}
                onReveal={() => reveal(item.id)}
                onOpen={() => setSelectedItem(item)}
              />
            ))}
          </View>
        )}
      </ScrollView>

      <ItemDetailModal
        visible={!!selectedItem}
        item={selectedItem}
        onClose={() => setSelectedItem(null)}
        onDelete={handleDelete}
        onSave={handleUpdate}
        allTags={tags}
        onPrev={(() => { const idx = revealedSample.findIndex(i => i.id === selectedItem?.id); return idx > 0 ? () => setSelectedItem(revealedSample[idx - 1]) : null; })()}
        onNext={(() => { const idx = revealedSample.findIndex(i => i.id === selectedItem?.id); return idx < revealedSample.length - 1 ? () => setSelectedItem(revealedSample[idx + 1]) : null; })()}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F0EB',
  },
  scrollContent: {
    paddingHorizontal: GRID_PADDING,
    flexGrow: 1,
  },
  header: {
    paddingHorizontal: GRID_PADDING,
    paddingBottom: 24,
  },
  title: {
    fontSize: 36,
    fontWeight: '300',
    letterSpacing: 1,
    color: '#2D2D2D',
    fontFamily: Platform.OS === 'ios' ? 'Georgia' : undefined,
  },
  subtitle: {
    fontSize: 13,
    color: '#999',
    marginTop: 6,
    letterSpacing: 0.5,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: GRID_GAP,
  },
  cardWrap: {
    width: GRID_CARD_SIZE,
    height: GRID_CARD_SIZE,
  },
  face: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
    borderRadius: 7,
    overflow: 'hidden',
    backfaceVisibility: 'hidden',
  },
  coverFace: {
    backgroundColor: '#2D2D2D',
  },
  revealFace: {
    backgroundColor: '#E8E3DD',
  },
  cardImage: {
    width: '100%',
    height: '100%',
  },
  shineTrack: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
    backfaceVisibility: 'hidden',
  },
  shineOuter: {
    position: 'absolute',
    top: -GRID_CARD_SIZE / 2,
    left: -28,
    width: 56,
    height: GRID_CARD_SIZE * 2,
    backgroundColor: 'rgba(255, 255, 255, 0.10)',
    transform: [{ rotate: '20deg' }],
  },
  shineMid: {
    position: 'absolute',
    top: -GRID_CARD_SIZE / 2,
    left: -10,
    width: 20,
    height: GRID_CARD_SIZE * 2,
    backgroundColor: 'rgba(255, 255, 255, 0.22)',
    transform: [{ rotate: '20deg' }],
  },
  shineInner: {
    position: 'absolute',
    top: -GRID_CARD_SIZE / 2,
    left: -3,
    width: 6,
    height: GRID_CARD_SIZE * 2,
    backgroundColor: 'rgba(255, 255, 255, 0.55)',
    transform: [{ rotate: '20deg' }],
  },
  privateBadge: {
    position: 'absolute',
    top: 6,
    left: 6,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  empty: {
    paddingVertical: 80,
    alignItems: 'center',
  },
  emptyText: {
    color: '#999',
    fontSize: 14,
  },
});
