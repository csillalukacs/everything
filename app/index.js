import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import {
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
import { useCollection } from '../lib/CollectionProvider';
import AddItemModal from '../screens/AddItemModal';
import ItemDetailModal from '../screens/ItemDetailModal';
import BatchTagSheet from '../screens/BatchTagSheet';
import OpenProfileSheet from '../screens/OpenProfileSheet';

const SCREEN_WIDTH = Dimensions.get('window').width;
const GRID_CARD_SIZE = (SCREEN_WIDTH - 48 - 12) / 2;

export default function Home() {
  const router = useRouter();
  const {
    items,
    tags,
    addItem,
    updateItem,
    deleteItem,
    batchTagItems,
    batchDeleteItems,
    batchTogglePrivacy,
    deleteTag,
    toggleTagPrivacy,
  } = useCollection();

  const [activeTag, setActiveTag] = useState(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [batchTagVisible, setBatchTagVisible] = useState(false);
  const [manageTagsVisible, setManageTagsVisible] = useState(false);
  const [manageTagSearch, setManageTagSearch] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [openProfileVisible, setOpenProfileVisible] = useState(false);

  const batchMode = selectedIds.size > 0;

  function toggleBatchSelect(itemId) {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(itemId)) next.delete(itemId);
      else next.add(itemId);
      return next;
    });
  }

  async function handleSave(name, photoUri, tagNames, isPrivate, description) {
    const created = await addItem(name, photoUri, tagNames, isPrivate, description);
    if (created) setModalVisible(false);
  }

  async function handleUpdate(name, photoOrUri, tagNames, isPrivate, description) {
    if (!selectedItem) return;
    const updated = await updateItem(selectedItem.id, name, photoOrUri, tagNames, isPrivate, description);
    if (updated) setSelectedItem(updated);
  }

  async function handleDelete() {
    const item = selectedItem;
    setSelectedItem(null);
    if (item) await deleteItem(item.id);
  }

  async function handleBatchTag(tagNames) {
    if (tagNames.length === 0) { setBatchTagVisible(false); return; }
    const ids = [...selectedIds];
    setBatchTagVisible(false);
    setSelectedIds(new Set());
    await batchTagItems(ids, tagNames);
  }

  async function handleBatchDelete() {
    const ids = [...selectedIds];
    setSelectedIds(new Set());
    await batchDeleteItems(ids);
  }

  async function handleBatchTogglePrivacy() {
    await batchTogglePrivacy([...selectedIds]);
  }

  const query = searchQuery.trim().toLowerCase();
  const searchedItems = query
    ? items.filter(i => {
        const name = (i.name ?? '').toLowerCase();
        const desc = (i.description ?? '').toLowerCase();
        const tagNames = (i.tags ?? []).map(t => t.name.toLowerCase());
        return name.includes(query) || desc.includes(query) || tagNames.some(n => n.includes(query));
      })
    : items;

  const filteredItems = activeTag?.id === '__untagged__'
    ? searchedItems.filter(i => (i.tags ?? []).length === 0)
    : activeTag
      ? searchedItems.filter(i => (i.tags ?? []).some(t => t.id === activeTag.id))
      : searchedItems;

  const tagCounts = new Map();
  let untaggedCount = 0;
  for (const item of searchedItems) {
    const tagsArr = item.tags ?? [];
    if (tagsArr.length === 0) untaggedCount++;
    for (const t of tagsArr) tagCounts.set(t.id, (tagCounts.get(t.id) ?? 0) + 1);
  }

  const totalTagCounts = new Map();
  for (const item of items) {
    for (const t of (item.tags ?? [])) totalTagCounts.set(t.id, (totalTagCounts.get(t.id) ?? 0) + 1);
  }

  const manageQuery = manageTagSearch.trim().toLowerCase();
  const manageTagsList = (manageQuery
    ? tags.filter(t => t.name.toLowerCase().includes(manageQuery))
    : tags
  ).slice().sort((a, b) => a.name.localeCompare(b.name));

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>things</Text>
          <Text style={styles.subtitle}>{items.length} {items.length === 1 ? 'object' : 'objects'}</Text>
        </View>
        <View style={styles.headerActions}>
          <TouchableOpacity onPress={() => setOpenProfileVisible(true)} style={styles.headerIconBtn}>
            <Ionicons name="search" size={22} color="#999" />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => router.push('/profile')} style={styles.headerIconBtn}>
            <Ionicons name="person-circle-outline" size={26} color="#999" />
          </TouchableOpacity>
        </View>
      </View>

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

      {tags.length > 0 && (
        <View style={styles.filterRow}>
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
            <TouchableOpacity
              style={[styles.filterChip, activeTag?.id === '__untagged__' && styles.filterChipActive]}
              onPress={() => setActiveTag(activeTag?.id === '__untagged__' ? null : { id: '__untagged__' })}
            >
              <Text style={[styles.filterChipText, activeTag?.id === '__untagged__' && styles.filterChipTextActive]}>untagged</Text>
              <Text style={[styles.filterChipCount, activeTag?.id === '__untagged__' && styles.filterChipCountActive]}>{untaggedCount}</Text>
            </TouchableOpacity>
            {tags.map(tag => {
              const active = activeTag?.id === tag.id;
              return (
                <TouchableOpacity
                  key={tag.id}
                  style={[styles.filterChip, active && styles.filterChipActive]}
                  onPress={() => setActiveTag(active ? null : tag)}
                >
                  {tag.is_private && <Ionicons name="lock-closed" size={10} color={active ? '#fff' : '#ccc'} />}
                  <Text style={[styles.filterChipText, active && styles.filterChipTextActive]}>{tag.name}</Text>
                  <Text style={[styles.filterChipCount, active && styles.filterChipCountActive]}>{tagCounts.get(tag.id) ?? 0}</Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
          <TouchableOpacity
            style={[styles.filterChip, styles.filterChipDashed, styles.filterManageBtn]}
            onPress={() => setManageTagsVisible(true)}
          >
            <Text style={styles.filterChipText}>manage</Text>
          </TouchableOpacity>
        </View>
      )}

      <FlatList
        data={filteredItems}
        keyExtractor={item => item.id}
        numColumns={2}
        columnWrapperStyle={styles.row}
        contentContainerStyle={styles.listContent}
        style={styles.list}
        renderItem={({ item }) => {
          const isSelected = selectedIds.has(item.id);
          return (
            <TouchableOpacity
              style={[styles.card, isSelected && styles.cardSelected]}
              onPress={() => batchMode ? toggleBatchSelect(item.id) : setSelectedItem(item)}
              onLongPress={() => toggleBatchSelect(item.id)}
              delayLongPress={400}
            >
              {item.image_url && (
                <View style={styles.cardImageContainer}>
                  <Image source={{ uri: item.image_url }} style={styles.cardImage} recyclingKey={item.id} cachePolicy="memory-disk" contentFit="cover" />
                </View>
              )}
              {item.is_private && !batchMode && (
                <View style={styles.privateBadge}>
                  <Ionicons name="lock-closed" size={10} color="#fff" />
                </View>
              )}
              {batchMode && (
                <View style={[styles.selectionCircle, isSelected && styles.selectionCircleActive]}>
                  {isSelected && <Text style={styles.selectionCheck}>✓</Text>}
                </View>
              )}
            </TouchableOpacity>
          );
        }}
      />

      {batchMode ? (
        <View style={styles.batchBar}>
          <TouchableOpacity onPress={() => setSelectedIds(new Set())} style={styles.batchBarBtn}>
            <Text style={styles.batchBarCancelText}>cancel</Text>
          </TouchableOpacity>
          <Text style={styles.batchBarCount}>{selectedIds.size} selected</Text>
          <View style={styles.batchBarActions}>
            <TouchableOpacity onPress={handleBatchTogglePrivacy} style={styles.batchBarIcon}>
              <Ionicons
                name={[...selectedIds].every(id => items.find(i => i.id === id)?.is_private) ? 'lock-closed' : 'lock-open-outline'}
                size={18}
                color="#fff"
              />
            </TouchableOpacity>
            <TouchableOpacity onPress={handleBatchDelete} style={styles.batchBarIcon}>
              <Ionicons name="trash-outline" size={18} color="#ff6b6b" />
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setBatchTagVisible(true)} style={styles.batchBarBtn}>
              <Text style={styles.batchBarTagText}>tag</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        <TouchableOpacity style={styles.fab} onPress={() => setModalVisible(true)}>
          <Text style={styles.fabText}>+</Text>
        </TouchableOpacity>
      )}

      <AddItemModal
        visible={modalVisible}
        onClose={() => setModalVisible(false)}
        onSave={handleSave}
        allTags={tags}
      />

      <ItemDetailModal
        visible={!!selectedItem}
        item={selectedItem}
        onClose={() => setSelectedItem(null)}
        onDelete={handleDelete}
        onSave={handleUpdate}
        allTags={tags}
        onPrev={(() => { const idx = filteredItems.findIndex(i => i.id === selectedItem?.id); return idx > 0 ? () => setSelectedItem(filteredItems[idx - 1]) : null; })()}
        onNext={(() => { const idx = filteredItems.findIndex(i => i.id === selectedItem?.id); return idx < filteredItems.length - 1 ? () => setSelectedItem(filteredItems[idx + 1]) : null; })()}
      />

      <BatchTagSheet
        visible={batchTagVisible}
        onClose={() => setBatchTagVisible(false)}
        onApply={handleBatchTag}
        allTags={tags}
        selectedCount={selectedIds.size}
      />

      <OpenProfileSheet
        visible={openProfileVisible}
        onClose={() => setOpenProfileVisible(false)}
        onOpen={slug => { setOpenProfileVisible(false); router.push(`/u/${slug}`); }}
      />

      <Modal
        visible={manageTagsVisible}
        animationType="slide"
        transparent
        onRequestClose={() => { setManageTagsVisible(false); setManageTagSearch(''); }}
      >
        <View style={styles.manageOverlay}>
          <TouchableOpacity style={styles.manageOverlayTop} activeOpacity={1} onPress={() => { setManageTagsVisible(false); setManageTagSearch(''); }} />
          <View style={styles.manageSheet}>
            <View style={styles.manageHeader}>
              <Text style={styles.manageTitle}>manage tags · {tags.length}</Text>
              <TouchableOpacity onPress={() => { setManageTagsVisible(false); setManageTagSearch(''); }}>
                <Text style={styles.manageDone}>done</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.manageSearchContainer}>
              <Ionicons name="search" size={16} color="#999" />
              <TextInput
                style={styles.manageSearchInput}
                placeholder="search tags"
                placeholderTextColor="#999"
                value={manageTagSearch}
                onChangeText={setManageTagSearch}
                autoCorrect={false}
                autoCapitalize="none"
              />
              {manageTagSearch.length > 0 && (
                <TouchableOpacity onPress={() => setManageTagSearch('')}>
                  <Ionicons name="close-circle" size={16} color="#999" />
                </TouchableOpacity>
              )}
            </View>
            <FlatList
              style={styles.manageList}
              data={manageTagsList}
              keyExtractor={tag => tag.id}
              keyboardShouldPersistTaps="handled"
              ListEmptyComponent={
                <Text style={styles.manageEmpty}>
                  {tags.length === 0 ? 'no tags yet' : 'no matches'}
                </Text>
              }
              renderItem={({ item: tag, index }) => (
                <View style={[styles.manageRow, index < manageTagsList.length - 1 && styles.manageRowBorder]}>
                  <View style={styles.manageTagInfo}>
                    <Text style={styles.manageTagName} numberOfLines={1}>{tag.name}</Text>
                    <Text style={styles.manageTagCount}>{totalTagCounts.get(tag.id) ?? 0}</Text>
                  </View>
                  <View style={styles.manageActions}>
                    <TouchableOpacity onPress={() => toggleTagPrivacy(tag)} style={styles.manageLockBtn}>
                      <Ionicons
                        name={tag.is_private ? 'lock-closed' : 'lock-open-outline'}
                        size={16}
                        color={tag.is_private ? '#2D2D2D' : '#ccc'}
                      />
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => {
                      deleteTag(tag.id);
                      if (activeTag?.id === tag.id) setActiveTag(null);
                    }}>
                      <Text style={styles.manageDeleteBtn}>delete</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}
            />
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F0EB',
    paddingTop: 80,
    paddingHorizontal: 24,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 20,
  },
  title: {
    fontSize: 40,
    fontWeight: '300',
    letterSpacing: 2,
    color: '#2D2D2D',
  },
  subtitle: {
    fontSize: 14,
    color: '#999',
    marginTop: 8,
    letterSpacing: 1,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 4,
  },
  headerIconBtn: {
    padding: 4,
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
  filterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 20,
  },
  filterScroll: {
    flex: 1,
    flexGrow: 1,
    flexShrink: 1,
  },
  filterScrollContent: {
    gap: 8,
    paddingVertical: 2,
  },
  filterManageBtn: {
    flexShrink: 0,
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
  filterChipDashed: {
    borderStyle: 'dashed',
  },
  manageOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  manageOverlayTop: {
    flex: 1,
  },
  manageSheet: {
    backgroundColor: '#F5F0EB',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 24,
    height: '70%',
    maxHeight: 560,
    width: '100%',
    maxWidth: 480,
    alignSelf: 'center',
  },
  manageHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  manageSearchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    height: 36,
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: '#E0E0E0',
    backgroundColor: '#fff',
    marginBottom: 8,
  },
  manageSearchInput: {
    flex: 1,
    fontSize: 14,
    color: '#2D2D2D',
    paddingVertical: 0,
  },
  manageList: {
    flex: 1,
  },
  manageEmpty: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
    paddingVertical: 32,
  },
  manageTagInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginRight: 12,
  },
  manageTagCount: {
    fontSize: 12,
    color: '#999',
  },
  manageTitle: {
    fontSize: 15,
    fontWeight: '500',
    color: '#2D2D2D',
  },
  manageDone: {
    fontSize: 15,
    color: '#999',
  },
  manageRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
  },
  manageRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: '#E8E3DD',
  },
  manageTagName: {
    fontSize: 15,
    color: '#2D2D2D',
  },
  manageActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  manageLockBtn: {
    padding: 2,
  },
  manageDeleteBtn: {
    fontSize: 13,
    color: '#E74C3C',
  },
  privateBadge: {
    position: 'absolute',
    top: 8,
    left: 8,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  list: {
    flex: 1,
  },
  listContent: {
    justifyContent: 'flex-start',
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
  cardSelected: {
    borderWidth: 2.5,
    borderColor: '#2D2D2D',
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
  selectionCircle: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: '#fff',
    backgroundColor: 'rgba(0,0,0,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  selectionCircleActive: {
    backgroundColor: '#2D2D2D',
    borderColor: '#2D2D2D',
  },
  selectionCheck: {
    color: '#fff',
    fontSize: 14,
    lineHeight: 16,
    fontWeight: 'bold',
  },
  fab: {
    position: 'absolute',
    bottom: 40,
    right: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#2D2D2D',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  fabText: {
    color: '#fff',
    fontSize: 28,
    lineHeight: 32,
  },
  batchBar: {
    position: 'absolute',
    bottom: 40,
    left: 24,
    right: 24,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#2D2D2D',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  batchBarBtn: {
    padding: 8,
    minWidth: 56,
  },
  batchBarCancelText: {
    color: '#aaa',
    fontSize: 15,
  },
  batchBarCount: {
    color: '#fff',
    fontSize: 14,
  },
  batchBarActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  batchBarIcon: {
    padding: 8,
  },
  batchBarTagText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '500',
    textAlign: 'right',
  },
});
