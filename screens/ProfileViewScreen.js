import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  FlatList,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Image } from 'expo-image';
import { supabase } from '../lib/supabase';
import ItemDetailModal from './ItemDetailModal';

const SCREEN_WIDTH = Dimensions.get('window').width;
const GRID_CARD_SIZE = (SCREEN_WIDTH - 48 - 12) / 2;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default function ProfileViewScreen({ visible, slug, onClose }) {
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [profile, setProfile] = useState(null);
  const [items, setItems] = useState([]);
  const [activeTag, setActiveTag] = useState(null);
  const [selectedItem, setSelectedItem] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    if (!visible || !slug) return;
    let cancelled = false;
    setLoading(true);
    setNotFound(false);
    setProfile(null);
    setItems([]);
    setActiveTag(null);
    setSelectedItem(null);
    setSearchQuery('');

    (async () => {
      const slugIsUuid = UUID_RE.test(slug);
      let resolvedId = null;
      let resolvedProfile = null;
      if (slugIsUuid) {
        const { data } = await supabase
          .from('profiles')
          .select('user_id, display_name, username')
          .eq('user_id', slug)
          .maybeSingle();
        if (data) { resolvedId = data.user_id; resolvedProfile = data; }
      } else {
        const { data } = await supabase
          .from('profiles')
          .select('user_id, display_name, username')
          .ilike('username', slug)
          .maybeSingle();
        if (data) { resolvedId = data.user_id; resolvedProfile = data; }
      }
      if (cancelled) return;
      if (!resolvedId) {
        setNotFound(true);
        setLoading(false);
        return;
      }
      setProfile(resolvedProfile);

      const { data: fetchedItems } = await supabase
        .from('items')
        .select('*, tags(id, name, is_private)')
        .eq('user_id', resolvedId)
        .eq('is_private', false)
        .order('created_at', { ascending: false });
      if (cancelled) return;
      if (fetchedItems) setItems(fetchedItems);
      setLoading(false);
    })();

    return () => { cancelled = true; };
  }, [visible, slug]);

  const query = searchQuery.trim().toLowerCase();
  const searchedItems = query
    ? items.filter(i => {
        const name = (i.name ?? '').toLowerCase();
        const desc = (i.description ?? '').toLowerCase();
        const tagNames = (i.tags ?? []).map(t => t.name.toLowerCase());
        return name.includes(query) || desc.includes(query) || tagNames.some(n => n.includes(query));
      })
    : items;

  const tagMap = new Map();
  searchedItems.forEach(item => {
    (item.tags ?? []).forEach(tag => {
      if (!tag.is_private) tagMap.set(tag.id, tag);
    });
  });
  const visibleTags = [...tagMap.values()].sort((a, b) => a.name.localeCompare(b.name));

  const tagCounts = new Map();
  for (const item of searchedItems) {
    for (const t of (item.tags ?? [])) tagCounts.set(t.id, (tagCounts.get(t.id) ?? 0) + 1);
  }

  const filteredItems = activeTag
    ? searchedItems.filter(i => (i.tags ?? []).some(t => t.id === activeTag.id))
    : searchedItems;

  const headerTitle = profile?.display_name
    ?? (profile?.username ? `@${profile.username}` : (slug ?? '').slice(0, 8));

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.backBtn}>
            <Ionicons name="chevron-back" size={28} color="#2D2D2D" />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={styles.title} numberOfLines={1}>{headerTitle}</Text>
            {profile?.username && profile?.display_name && (
              <Text style={styles.subtitle}>@{profile.username}</Text>
            )}
            {!loading && !notFound && (
              <Text style={styles.itemCount}>
                {items.length} {items.length === 1 ? 'object' : 'objects'}
              </Text>
            )}
          </View>
        </View>

        {loading ? (
          <View style={styles.centered}>
            <ActivityIndicator color="#999" />
          </View>
        ) : notFound ? (
          <View style={styles.centered}>
            <Text style={styles.emptyText}>no profile at /u/{slug}</Text>
          </View>
        ) : (
          <>
            <View style={styles.searchContainer}>
              <Ionicons name="search" size={16} color="#999" />
              <TextInput
                style={styles.searchInput}
                placeholder="search"
                placeholderTextColor="#999"
                value={searchQuery}
                onChangeText={setSearchQuery}
                autoCorrect={false}
                autoCapitalize="none"
                returnKeyType="search"
              />
              {searchQuery.length > 0 && (
                <TouchableOpacity onPress={() => setSearchQuery('')}>
                  <Ionicons name="close-circle" size={16} color="#999" />
                </TouchableOpacity>
              )}
            </View>

            {visibleTags.length > 0 && (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={styles.filterScroll}
                contentContainerStyle={styles.filterScrollContent}
              >
                <TouchableOpacity
                  style={[styles.filterChip, !activeTag && styles.filterChipActive]}
                  onPress={() => setActiveTag(null)}
                >
                  <Text style={[styles.filterChipText, !activeTag && styles.filterChipTextActive]}>all</Text>
                  <Text style={[styles.filterChipCount, !activeTag && styles.filterChipCountActive]}>{searchedItems.length}</Text>
                </TouchableOpacity>
                {visibleTags.map(tag => {
                  const active = activeTag?.id === tag.id;
                  return (
                    <TouchableOpacity
                      key={tag.id}
                      style={[styles.filterChip, active && styles.filterChipActive]}
                      onPress={() => setActiveTag(active ? null : tag)}
                    >
                      <Text style={[styles.filterChipText, active && styles.filterChipTextActive]}>{tag.name}</Text>
                      <Text style={[styles.filterChipCount, active && styles.filterChipCountActive]}>{tagCounts.get(tag.id) ?? 0}</Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            )}

            {items.length === 0 ? (
              <View style={styles.centered}>
                <Text style={styles.emptyText}>nothing public yet</Text>
              </View>
            ) : (
              <FlatList
                data={filteredItems}
                keyExtractor={item => item.id}
                numColumns={2}
                columnWrapperStyle={styles.row}
                contentContainerStyle={styles.listContent}
                style={styles.list}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={styles.card}
                    onPress={() => setSelectedItem(item)}
                  >
                    {item.image_url && (
                      <View style={styles.cardImageContainer}>
                        <Image
                          source={{ uri: item.image_url }}
                          style={styles.cardImage}
                          recyclingKey={item.id}
                          cachePolicy="memory-disk"
                          contentFit="cover"
                        />
                      </View>
                    )}
                  </TouchableOpacity>
                )}
              />
            )}
          </>
        )}

        <ItemDetailModal
          visible={!!selectedItem}
          item={selectedItem}
          onClose={() => setSelectedItem(null)}
          allTags={[]}
          onPrev={(() => {
            const idx = filteredItems.findIndex(i => i.id === selectedItem?.id);
            return idx > 0 ? () => setSelectedItem(filteredItems[idx - 1]) : null;
          })()}
          onNext={(() => {
            const idx = filteredItems.findIndex(i => i.id === selectedItem?.id);
            return idx < filteredItems.length - 1 ? () => setSelectedItem(filteredItems[idx + 1]) : null;
          })()}
        />
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F0EB',
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
    paddingTop: 4,
    paddingRight: 4,
    marginLeft: -8,
  },
  title: {
    fontSize: 28,
    fontWeight: '300',
    letterSpacing: 1,
    color: '#2D2D2D',
  },
  subtitle: {
    fontSize: 13,
    color: '#999',
    marginTop: 2,
  },
  itemCount: {
    fontSize: 13,
    color: '#999',
    marginTop: 6,
    letterSpacing: 0.5,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    height: 40,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: '#E0E0E0',
    backgroundColor: '#fff',
    marginBottom: 12,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: '#2D2D2D',
    paddingVertical: 0,
  },
  filterScroll: {
    flexGrow: 0,
    marginBottom: 16,
  },
  filterScrollContent: {
    gap: 8,
    paddingVertical: 2,
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    height: 34,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: '#E0E0E0',
    backgroundColor: '#fff',
  },
  filterChipActive: {
    backgroundColor: '#2D2D2D',
    borderColor: '#2D2D2D',
  },
  filterChipText: {
    fontSize: 13,
    color: '#999',
  },
  filterChipTextActive: {
    color: '#fff',
  },
  filterChipCount: {
    fontSize: 11,
    color: '#bbb',
    marginLeft: 2,
  },
  filterChipCountActive: {
    color: '#bbb',
  },
  list: {
    flex: 1,
  },
  listContent: {
    justifyContent: 'flex-start',
    paddingBottom: 40,
  },
  row: {
    gap: 12,
    marginBottom: 12,
    justifyContent: 'flex-start',
    alignItems: 'flex-start',
  },
  card: {
    width: GRID_CARD_SIZE,
    backgroundColor: '#fff',
    borderRadius: 12,
    overflow: 'hidden',
  },
  cardImageContainer: {
    width: '100%',
    aspectRatio: 1,
    backgroundColor: '#E8E3DD',
  },
  cardImage: {
    width: '100%',
    height: '100%',
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    fontSize: 14,
    color: '#999',
  },
});
