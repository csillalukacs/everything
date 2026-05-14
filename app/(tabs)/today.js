import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useMemo, useState } from 'react';
import {
  Dimensions,
  Platform,
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

const dailyCacheKey = userId => `shuffle:daily:${userId}`;

function shuffleInPlace(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export default function Today() {
  const insets = useSafeAreaInsets();
  const { session, items, tags, updateItem, deleteItem } = useCollection();
  const userId = session?.user?.id;

  const [sampleIds, setSampleIds] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [today] = useState(() => dayKey(new Date()));
  const [selectedItem, setSelectedItem] = useState(null);

  // Load cached daily selection once we know the user.
  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    AsyncStorage.getItem(dailyCacheKey(userId)).then(str => {
      if (cancelled) return;
      const parsed = str ? JSON.parse(str) : null;
      if (parsed?.date === today && Array.isArray(parsed.itemIds)) {
        setSampleIds(parsed.itemIds);
      }
      setLoaded(true);
    });
    return () => { cancelled = true; };
  }, [userId, today]);

  // Keep the sample in sync with the collection:
  // - If today's selection is empty/stale, pick fresh.
  // - If one of the selected items was deleted, refill that slot only.
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
    AsyncStorage.setItem(dailyCacheKey(userId), JSON.stringify({ date: today, itemIds: next }));
  }, [items, sampleIds, loaded, userId, today]);

  const sample = useMemo(() => {
    const byId = new Map(items.map(i => [i.id, i]));
    return sampleIds.map(id => byId.get(id)).filter(Boolean);
  }, [sampleIds, items]);

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
    <View style={[styles.container, { paddingTop: insets.top + 16, paddingBottom: tabBarOffset }]}>
      <View style={styles.header}>
        <Text style={styles.title}>{S.today.title}</Text>
        <Text style={styles.subtitle}>{S.today.subtitle}</Text>
      </View>

      {sample.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyText}>{S.today.empty}</Text>
        </View>
      ) : (
        <View style={styles.grid}>
          {sample.map(item => (
            <TouchableOpacity
              key={item.id}
              style={styles.card}
              onPress={() => setSelectedItem(item)}
              activeOpacity={0.8}
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
            </TouchableOpacity>
          ))}
        </View>
      )}

      <ItemDetailModal
        visible={!!selectedItem}
        item={selectedItem}
        onClose={() => setSelectedItem(null)}
        onDelete={handleDelete}
        onSave={handleUpdate}
        allTags={tags}
        onPrev={(() => { const idx = sample.findIndex(i => i.id === selectedItem?.id); return idx > 0 ? () => setSelectedItem(sample[idx - 1]) : null; })()}
        onNext={(() => { const idx = sample.findIndex(i => i.id === selectedItem?.id); return idx < sample.length - 1 ? () => setSelectedItem(sample[idx + 1]) : null; })()}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F0EB',
    paddingHorizontal: GRID_PADDING,
  },
  header: {
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
  card: {
    width: GRID_CARD_SIZE,
    height: GRID_CARD_SIZE,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#E8E3DD',
  },
  cardImage: {
    width: '100%',
    height: '100%',
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
