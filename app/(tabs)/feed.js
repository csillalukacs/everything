import { useState } from 'react';
import { Image } from 'expo-image';
import { Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useCollection } from '../../lib/CollectionProvider';
import ItemDetailModal from '../../screens/ItemDetailModal';

const TAB_BAR_HEIGHT = 70;

function getDailyItem(items) {
  if (!items.length) return null;
  const dateStr = new Date().toISOString().slice(0, 10);
  let hash = 0;
  for (const ch of dateStr) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  return items[hash % items.length];
}

export default function Feed() {
  const insets = useSafeAreaInsets();
  const { items, tags, updateItem, deleteItem } = useCollection();
  const [selectedItem, setSelectedItem] = useState(null);

  const dailyItem = getDailyItem(items);
  const tabBarOffset = TAB_BAR_HEIGHT + Math.max(insets.bottom, 12);

  async function handleUpdate(name, photoOrUri, tagNames, isPrivate, description, acquired) {
    if (!selectedItem) return;
    const updated = await updateItem(selectedItem.id, name, photoOrUri, tagNames, isPrivate, description, acquired);
    if (updated) setSelectedItem(updated);
  }

  async function handleDelete() {
    const item = selectedItem;
    setSelectedItem(null);
    if (item) await deleteItem(item.id);
  }

  return (
    <View style={styles.container}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 24, paddingTop: 80, paddingBottom: tabBarOffset + 24 }}
      >
        <View style={styles.header}>
          <Text style={styles.title}>things</Text>
        </View>

        {!dailyItem ? (
          <View style={styles.empty}>
            <Text style={styles.emptyText}>nothing yet — add your first item</Text>
          </View>
        ) : (
          <TouchableOpacity
            style={styles.dailyCard}
            activeOpacity={0.85}
            onPress={() => setSelectedItem(dailyItem)}
          >
            <Text style={styles.dailyLabel}>item of the day</Text>
            {dailyItem.image_url && (
              <View style={styles.dailyImageWrap}>
                <Image
                  source={{ uri: dailyItem.image_url }}
                  style={styles.dailyImage}
                  contentFit="contain"
                  cachePolicy="memory-disk"
                />
              </View>
            )}
            {dailyItem.name && <Text style={styles.dailyName}>{dailyItem.name}</Text>}
            {dailyItem.description && (
              <Text style={styles.dailyDescription} numberOfLines={6}>{dailyItem.description}</Text>
            )}
            {(dailyItem.tags ?? []).length > 0 && (
              <View style={styles.tagRow}>
                {(dailyItem.tags ?? []).map(tag => (
                  <View key={tag.id} style={styles.tagBadge}>
                    <Text style={styles.tagBadgeText}>{tag.name}</Text>
                  </View>
                ))}
              </View>
            )}
          </TouchableOpacity>
        )}
      </ScrollView>

      <ItemDetailModal
        visible={!!selectedItem}
        item={selectedItem}
        onClose={() => setSelectedItem(null)}
        onSave={handleUpdate}
        onDelete={handleDelete}
        allTags={tags}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F0EB',
  },
  header: {
    marginBottom: 28,
  },
  title: {
    fontSize: 36,
    fontWeight: '300',
    letterSpacing: 1,
    color: '#2D2D2D',
    fontFamily: Platform.OS === 'ios' ? 'Georgia' : undefined,
  },
  empty: {
    paddingVertical: 80,
    alignItems: 'center',
  },
  emptyText: {
    color: '#999',
    fontSize: 14,
  },
  dailyCard: {
    alignItems: 'center',
    gap: 14,
    paddingVertical: 8,
  },
  dailyLabel: {
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 1,
    color: '#999',
  },
  dailyImageWrap: {
    width: '100%',
    aspectRatio: 1,
    maxWidth: 420,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#E8E3DD',
  },
  dailyImage: {
    width: '100%',
    height: '100%',
  },
  dailyName: {
    fontSize: 22,
    fontWeight: '500',
    color: '#2D2D2D',
    textAlign: 'center',
  },
  dailyDescription: {
    fontSize: 14,
    color: '#555',
    lineHeight: 22,
    textAlign: 'center',
    maxWidth: 420,
  },
  tagRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    justifyContent: 'center',
  },
  tagBadge: {
    paddingHorizontal: 10,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#E8E3DD',
    justifyContent: 'center',
  },
  tagBadgeText: {
    fontSize: 12,
    color: '#2D2D2D',
  },
});
