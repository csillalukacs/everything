import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  FlatList,
  Modal,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { useCollection } from '../../lib/CollectionProvider';
import ItemDetailModal from '../../screens/ItemDetailModal';
import BatchEditSheet from '../../screens/BatchEditSheet';
import FilterSheet from '../../screens/FilterSheet';
import ProfileScreen from '../../screens/ProfileScreen';
import BottomSheet from '../../screens/BottomSheet';
import { cityOf, thumbOf } from '../../shared/items';
import { parseQuery, matchItem } from '../../shared/searchQuery';
import { S } from '../../shared/strings';

const SCREEN_WIDTH = Dimensions.get('window').width;
const GRID_GAP = 8;
const GRID_CARD_SIZE = (SCREEN_WIDTH - 48 - GRID_GAP * 2) / 3;
const TAB_BAR_HEIGHT = 70;

export default function Collection() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const insets = useSafeAreaInsets();
  const {
    session,
    items,
    itemCount,
    itemsLoading,
    tags,
    profile,
    updateItem,
    deleteItem,
    batchEditItems,
    batchDeleteItems,
    batchTogglePrivacy,
    deleteTag,
    toggleTagPrivacy,
    renameTag,
    refresh,
  } = useCollection();

  const [activeTag, setActiveTag] = useState(null);
  const [activeYear, setActiveYear] = useState(null);
  const [activeCity, setActiveCity] = useState(null);
  const [selectedItem, setSelectedItem] = useState(null);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [batchEditVisible, setBatchEditVisible] = useState(false);
  const [manageTagsVisible, setManageTagsVisible] = useState(false);
  const [manageTagSearch, setManageTagSearch] = useState('');
  const [renamingTagId, setRenamingTagId] = useState(null);
  const [renameDraft, setRenameDraft] = useState('');
  const [renameError, setRenameError] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchHelpVisible, setSearchHelpVisible] = useState(false);
  const [filterSheetVisible, setFilterSheetVisible] = useState(false);
  const [settingsVisible, setSettingsVisible] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try { await refresh(); } finally { setRefreshing(false); }
  }, [refresh]);

  useEffect(() => {
    if (params.city) {
      setActiveCity(String(params.city));
      setActiveTag(null);
      setActiveYear(null);
      router.setParams({ city: undefined });
    }
  }, [params.city, router]);

  const availableYears = [...new Set(items.map(i => i.acquired_year).filter(y => y != null))].sort((a, b) => b - a);
  const availableCities = [...new Set(items.map(i => cityOf(i.acquired_location)).filter(Boolean))].sort();
  const hasMissingYear = items.some(i => i.acquired_year == null);
  const hasMissingCity = items.some(i => cityOf(i.acquired_location) == null);

  const batchMode = selectedIds.size > 0;
  const tabBarOffset = TAB_BAR_HEIGHT + Math.max(insets.bottom, 12);

  function toggleBatchSelect(itemId) {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(itemId)) next.delete(itemId);
      else next.add(itemId);
      return next;
    });
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

  async function handleBatchEdit({ addTags, acquired }) {
    if (addTags.length === 0 && !acquired) { setBatchEditVisible(false); return; }
    const ids = [...selectedIds];
    setBatchEditVisible(false);
    setSelectedIds(new Set());
    await batchEditItems(ids, { addTags, acquired });
  }

  async function handleBatchDelete() {
    const ids = [...selectedIds];
    setSelectedIds(new Set());
    await batchDeleteItems(ids);
  }

  async function handleBatchTogglePrivacy() {
    await batchTogglePrivacy([...selectedIds]);
  }

  function startRenameTag(tag) {
    setRenamingTagId(tag.id);
    setRenameDraft(tag.name);
    setRenameError(null);
  }

  function cancelRenameTag() {
    setRenamingTagId(null);
    setRenameDraft('');
    setRenameError(null);
  }

  async function commitRenameTag(tag) {
    const trimmed = renameDraft.trim();
    if (!trimmed || trimmed.toLowerCase() === tag.name) { cancelRenameTag(); return; }
    const result = await renameTag(tag.id, trimmed);
    if (result?.error) { setRenameError(S.collection.tagNameTaken); return; }
    cancelRenameTag();
  }

  function closeManageTags() {
    setManageTagsVisible(false);
    setManageTagSearch('');
    cancelRenameTag();
  }

  const queryAst = useMemo(() => parseQuery(searchQuery), [searchQuery]);
  const searchedItems = items.filter(i => {
    if (!matchItem(i, queryAst)) return false;
    if (activeYear === 'none') {
      if (i.acquired_year != null) return false;
    } else if (activeYear != null && i.acquired_year !== activeYear) return false;
    if (activeCity === 'none') {
      if (cityOf(i.acquired_location) != null) return false;
    } else if (activeCity != null) {
      const c = cityOf(i.acquired_location);
      if (!c || c.toLowerCase() !== activeCity.toLowerCase()) return false;
    }
    return true;
  });

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

  const headlineName = profile?.display_name
    ?? 'you';

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={styles.title} numberOfLines={1}>{headlineName}</Text>
          <Text style={styles.subtitle}>
            {profile?.username ? `@${profile.username} · ` : ''}
            {S.profile.objectCount(itemCount ?? items.length)}
          </Text>
        </View>
        <View style={styles.headerActions}>
          <TouchableOpacity onPress={() => router.push('/stats')} style={styles.headerIconBtn}>
            <Ionicons name="bar-chart-outline" size={22} color="#999" />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setSettingsVisible(true)} style={styles.headerIconBtn}>
            <Ionicons name="settings-outline" size={22} color="#999" />
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.searchRow}>
        <View style={styles.searchContainer}>
          <Ionicons name="search" size={16} color="#999" />
          <TextInput
            style={styles.searchInput}
            placeholder={S.common.search}
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
          <TouchableOpacity
            style={styles.searchHelpButton}
            onPress={() => setSearchHelpVisible(true)}
            accessibilityLabel={S.a11y.searchHelp}
            hitSlop={8}
          >
            <Text style={styles.searchHelpButtonText}>?</Text>
          </TouchableOpacity>
        </View>
        <TouchableOpacity
          style={styles.filterIconBtn}
          onPress={() => setFilterSheetVisible(true)}
          hitSlop={8}
        >
          <Ionicons name="options-outline" size={20} color={(activeYear || activeCity) ? '#2D2D2D' : '#999'} />
          {(activeYear || activeCity) && <View style={styles.filterIconDot} />}
        </TouchableOpacity>
      </View>

      <Modal
        visible={searchHelpVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setSearchHelpVisible(false)}
      >
        <TouchableOpacity
          style={styles.searchHelpBackdrop}
          activeOpacity={1}
          onPress={() => setSearchHelpVisible(false)}
        >
          <TouchableOpacity activeOpacity={1} style={styles.searchHelpCard} onPress={() => {}}>
            <Text style={styles.searchHelpTitle}>{S.searchHelp.title}</Text>
            <Text style={styles.searchHelpIntro}>{S.searchHelp.intro}</Text>
            <ScrollView style={styles.searchHelpList}>
              {S.searchHelp.examples.map(ex => (
                <TouchableOpacity
                  key={ex.code}
                  style={styles.searchHelpRow}
                  onPress={() => {
                    setSearchQuery(ex.code);
                    setSearchHelpVisible(false);
                  }}
                >
                  <Text style={styles.searchHelpCode}>{ex.code}</Text>
                  <Text style={styles.searchHelpDesc}>{ex.desc}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>


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
              <Text style={[styles.filterChipText, !activeTag && styles.filterChipTextActive]}>{S.common.all}</Text>
              <Text style={[styles.filterChipCount, !activeTag && styles.filterChipCountActive]}>{searchedItems.length}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.filterChip, activeTag?.id === '__untagged__' && styles.filterChipActive]}
              onPress={() => setActiveTag(activeTag?.id === '__untagged__' ? null : { id: '__untagged__' })}
            >
              <Text style={[styles.filterChipText, activeTag?.id === '__untagged__' && styles.filterChipTextActive]}>{S.collection.untagged}</Text>
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
            style={[styles.filterChip, styles.filterManageBtn]}
            onPress={() => setManageTagsVisible(true)}
            accessibilityLabel={S.common.manage}
          >
            <Ionicons name="settings-outline" size={18} color="#999" />
          </TouchableOpacity>
        </View>
      )}

      <FlatList
        data={filteredItems}
        keyExtractor={item => item.id}
        numColumns={3}
        columnWrapperStyle={filteredItems.length > 0 ? styles.row : undefined}
        contentContainerStyle={[styles.listContent, { paddingBottom: tabBarOffset + 24 }, filteredItems.length === 0 && styles.listContentEmpty]}
        style={styles.list}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#999" />
        }
        ListEmptyComponent={
          itemsLoading ? (
            <View style={styles.listLoader}>
              <ActivityIndicator color="#999" />
            </View>
          ) : null
        }
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
                  <Image source={{ uri: thumbOf(item) }} style={styles.cardImage} recyclingKey={item.id} cachePolicy="memory-disk" contentFit="cover" />
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

      {batchMode && (
        <View style={[styles.batchBar]}>
          <TouchableOpacity onPress={() => setSelectedIds(new Set())} style={styles.batchBarBtn}>
            <Text style={styles.batchBarCancelText}>{S.common.cancel}</Text>
          </TouchableOpacity>
          <Text style={styles.batchBarCount}>{S.batchEdit.selectedCount(selectedIds.size)}</Text>
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
            <TouchableOpacity onPress={() => setBatchEditVisible(true)} style={styles.batchBarBtn}>
              <Text style={styles.batchBarTagText}>{S.common.edit}</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      <ItemDetailModal
        visible={!!selectedItem}
        item={selectedItem}
        onClose={() => setSelectedItem(null)}
        onDelete={handleDelete}
        onSave={handleUpdate}
        allTags={tags}
        onTagPress={tag => { setActiveTag(tag); setSelectedItem(null); }}
        onYearPress={year => { setActiveYear(year); setActiveTag(null); setActiveCity(null); setSelectedItem(null); }}
        onCityPress={city => { setActiveCity(city); setActiveTag(null); setActiveYear(null); setSelectedItem(null); }}
        onPrev={(() => { const idx = filteredItems.findIndex(i => i.id === selectedItem?.id); return idx > 0 ? () => setSelectedItem(filteredItems[idx - 1]) : null; })()}
        onNext={(() => { const idx = filteredItems.findIndex(i => i.id === selectedItem?.id); return idx < filteredItems.length - 1 ? () => setSelectedItem(filteredItems[idx + 1]) : null; })()}
      />

      <BatchEditSheet
        visible={batchEditVisible}
        onClose={() => setBatchEditVisible(false)}
        onApply={handleBatchEdit}
        allTags={tags}
        selectedCount={selectedIds.size}
      />

      <FilterSheet
        visible={filterSheetVisible}
        onClose={() => setFilterSheetVisible(false)}
        availableYears={availableYears}
        availableCities={availableCities}
        hasMissingYear={hasMissingYear}
        hasMissingCity={hasMissingCity}
        activeYear={activeYear}
        activeCity={activeCity}
        onChangeYear={setActiveYear}
        onChangeCity={setActiveCity}
      />

      <ProfileScreen
        visible={settingsVisible}
        onClose={() => setSettingsVisible(false)}
        session={session}
        itemCount={itemCount ?? items.length}
      />

      <BottomSheet visible={manageTagsVisible} onClose={closeManageTags} sheetStyle={styles.manageSheet}>
        <View style={styles.manageHeader}>
          <Text style={styles.manageTitle}>{S.collection.manageTags(tags.length)}</Text>
          <TouchableOpacity onPress={closeManageTags}>
            <Text style={styles.manageDone}>{S.common.done}</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.manageSearchContainer}>
          <Ionicons name="search" size={16} color="#999" />
          <TextInput
            style={styles.manageSearchInput}
            placeholder={S.collection.searchTags}
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
              {tags.length === 0 ? S.collection.noTagsYet : S.common.noMatches}
            </Text>
          }
          renderItem={({ item: tag, index }) => {
            const isRenaming = renamingTagId === tag.id;
            return (
              <View style={[styles.manageRow, index < manageTagsList.length - 1 && styles.manageRowBorder]}>
                <View style={styles.manageTagInfo}>
                  {isRenaming ? (
                    <TextInput
                      style={[styles.manageTagName, styles.manageTagRenameInput, renameError && styles.manageTagRenameInputError]}
                      value={renameDraft}
                      onChangeText={(v) => { setRenameDraft(v); if (renameError) setRenameError(null); }}
                      onSubmitEditing={() => commitRenameTag(tag)}
                      onBlur={() => commitRenameTag(tag)}
                      autoFocus
                      autoCorrect={false}
                      autoCapitalize="none"
                      returnKeyType="done"
                    />
                  ) : (
                    <Text style={styles.manageTagName} numberOfLines={1}>{tag.name}</Text>
                  )}
                  {!isRenaming && (
                    <Text style={styles.manageTagCount}>{totalTagCounts.get(tag.id) ?? 0}</Text>
                  )}
                  {isRenaming && renameError && (
                    <Text style={styles.manageTagRenameError} numberOfLines={1}>{renameError}</Text>
                  )}
                </View>
                <View style={styles.manageActions}>
                  {isRenaming ? (
                    <TouchableOpacity onPress={cancelRenameTag}>
                      <Text style={styles.manageDone}>{S.common.cancel}</Text>
                    </TouchableOpacity>
                  ) : (
                    <>
                      <TouchableOpacity onPress={() => startRenameTag(tag)} style={styles.manageLockBtn}>
                        <Ionicons name="pencil-outline" size={16} color="#999" />
                      </TouchableOpacity>
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
                        <Text style={styles.manageDeleteBtn}>{S.common.delete}</Text>
                      </TouchableOpacity>
                    </>
                  )}
                </View>
              </View>
            );
          }}
        />
      </BottomSheet>
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
    gap: 12,
  },
  headerLeft: {
    flex: 1,
  },
  title: {
    fontSize: 36,
    fontWeight: '300',
    letterSpacing: 1,
    color: '#2D2D2D',
    fontFamily: 'Georgia',
  },
  subtitle: {
    fontSize: 13,
    color: '#999',
    marginTop: 6,
    letterSpacing: 0.5,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 10,
  },
  headerIconBtn: {
    padding: 4,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  searchContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    height: 40,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: '#E0E0E0',
    backgroundColor: '#fff',
  },
  filterIconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: '#E0E0E0',
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterIconDot: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: '#2D2D2D',
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: '#2D2D2D',
    paddingVertical: 0,
  },
  searchHelpButton: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1.5,
    borderColor: '#E0E0E0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchHelpButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#999',
    lineHeight: 14,
  },
  searchHelpBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  searchHelpCard: {
    width: '100%',
    maxWidth: 420,
    maxHeight: '80%',
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
  },
  searchHelpTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#2D2D2D',
    marginBottom: 4,
  },
  searchHelpIntro: {
    fontSize: 13,
    color: '#999',
    marginBottom: 12,
  },
  searchHelpList: {
    flexGrow: 0,
  },
  searchHelpRow: {
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F0EBE5',
  },
  searchHelpCode: {
    fontFamily: 'Menlo',
    fontSize: 13,
    color: '#2D2D2D',
    marginBottom: 2,
  },
  searchHelpDesc: {
    fontSize: 12,
    color: '#666',
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
    borderWidth: 0,
    backgroundColor: 'transparent',
    paddingHorizontal: 6,
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
  manageTagRenameInput: {
    flex: 1,
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderWidth: 1.5,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    backgroundColor: '#fff',
  },
  manageTagRenameInputError: {
    borderColor: '#E74C3C',
  },
  manageTagRenameError: {
    fontSize: 11,
    color: '#E74C3C',
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
  listContentEmpty: {
    flexGrow: 1,
  },
  listLoader: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 80,
  },
  row: {
    gap: GRID_GAP,
    marginBottom: GRID_GAP,
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
  batchBar: {
    position: 'absolute',
    left: 24,
    right: 24,
    bottom: 10,
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
