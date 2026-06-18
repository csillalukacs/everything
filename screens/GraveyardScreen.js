import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useCollection } from '../lib/CollectionProvider';
import { isRetired } from '../shared/items';
import { S } from '../shared/strings';
import ItemGrid from './ItemGrid';
import ItemDetailModal from './ItemDetailModal';
import { C } from '../shared/theme';

export default function GraveyardScreen() {
  const router = useRouter();
  const { items, itemsLoading, resurrectItem, deleteItem, refresh } = useCollection();
  const [selectedItem, setSelectedItem] = useState(null);
  const [refreshing, setRefreshing] = useState(false);

  const retiredItems = useMemo(
    () => items
      .filter(isRetired)
      .sort((a, b) => new Date(b.retired_at) - new Date(a.retired_at)),
    [items],
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try { await refresh(); } finally { setRefreshing(false); }
  }, [refresh]);

  async function handleResurrect() {
    const item = selectedItem;
    setSelectedItem(null);
    if (item) {
      await resurrectItem(item);
      // Send the user back to their collection with the resurrected item open.
      router.replace(`/?item=${item.id}`);
    }
  }

  async function handleDelete() {
    const item = selectedItem;
    setSelectedItem(null);
    if (item) await deleteItem(item.id);
  }

  const idx = retiredItems.findIndex(i => i.id === selectedItem?.id);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} hitSlop={8}>
          <Ionicons name="chevron-back" size={28} color={C.ink} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>{S.graveyard.emoji}  {S.graveyard.title}</Text>
          <Text style={styles.subtitle}>
            {retiredItems.length === 0 ? S.graveyard.subtitle : S.graveyard.count(retiredItems.length)}
          </Text>
        </View>
      </View>

      {retiredItems.length === 0 && !itemsLoading ? (
        <View style={styles.empty}>
          <Text style={styles.emptyEmoji}>{S.graveyard.emoji}</Text>
          <Text style={styles.emptyText}>{S.graveyard.empty}</Text>
          <Text style={styles.emptyHint}>{S.graveyard.emptyHint}</Text>
        </View>
      ) : (
        <ItemGrid
          items={retiredItems}
          onItemPress={setSelectedItem}
          refreshing={refreshing}
          onRefresh={onRefresh}
          loading={itemsLoading}
          paddingBottom={48}
        />
      )}

      <ItemDetailModal
        visible={!!selectedItem}
        item={selectedItem}
        onClose={() => setSelectedItem(null)}
        onResurrect={handleResurrect}
        onDelete={handleDelete}
        onPrev={idx > 0 ? () => setSelectedItem(retiredItems[idx - 1]) : null}
        onNext={idx >= 0 && idx < retiredItems.length - 1 ? () => setSelectedItem(retiredItems[idx + 1]) : null}
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
  emptyEmoji: {
    fontSize: 44,
  },
  emptyText: {
    fontSize: 16,
    color: C.ink,
  },
  emptyHint: {
    fontSize: 13,
    color: '#999',
  },
});
