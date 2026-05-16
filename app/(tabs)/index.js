import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useCollection } from '../../lib/CollectionProvider';
import ItemDetailModal from '../../screens/ItemDetailModal';
import BatchEditSheet from '../../screens/BatchEditSheet';
import FilterSheet from '../../screens/FilterSheet';
import ProfileScreen from '../../screens/ProfileScreen';
import ManageTagsSheet from '../../screens/ManageTagsSheet';
import ItemGrid from '../../screens/ItemGrid';
import SearchBar from '../../screens/SearchBar';
import BatchBar from '../../screens/BatchBar';
import TagFilterChips from '../../screens/TagFilterChips';
import Avatar from '../../screens/Avatar';
import { cityOf } from '../../shared/items';
import { parseQuery, matchItem } from '../../shared/searchQuery';
import { sortItems, newRandomSeed } from '../../shared/sortItems';
import { isFeaturedTag } from '../../shared/featuredTag';
import { S } from '../../shared/strings';

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
    setBatchModeActive,
  } = useCollection();

  const [activeTag, setActiveTag] = useState(null);
  const [activeYear, setActiveYear] = useState(null);
  const [activeCity, setActiveCity] = useState(null);
  const [selectedItem, setSelectedItem] = useState(null);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [batchEditVisible, setBatchEditVisible] = useState(false);
  const [manageTagsVisible, setManageTagsVisible] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterSheetVisible, setFilterSheetVisible] = useState(false);
  const [settingsVisible, setSettingsVisible] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [explicitSortMode, setExplicitSortMode] = useState(null);
  const [randomSeed, setRandomSeed] = useState(() => newRandomSeed());

  const defaultSortForContext = isFeaturedTag(activeTag) ? 'random' : 'newest';
  const sortMode = explicitSortMode ?? defaultSortForContext;

  function handleChangeSort(mode) {
    if (mode === 'random') setRandomSeed(newRandomSeed());
    setExplicitSortMode(mode === defaultSortForContext ? null : mode);
  }

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try { await refresh(); } finally { setRefreshing(false); }
  }, [refresh]);

  const featuredDefaultedRef = useRef(false);
  useEffect(() => {
    if (featuredDefaultedRef.current) return;
    if (itemsLoading) return;
    const featured = tags.find(isFeaturedTag);
    if (!featured) return;
    featuredDefaultedRef.current = true;
    const hasFeaturedItems = items.some(i => (i.tags ?? []).some(isFeaturedTag));
    if (hasFeaturedItems) setActiveTag(featured);
  }, [itemsLoading, tags, items]);

  useEffect(() => {
    if (params.city) {
      setActiveCity(String(params.city));
      setActiveTag(null);
      setActiveYear(null);
      router.setParams({ city: undefined });
    }
  }, [params.city, router]);

  useEffect(() => {
    if (!params.item || items.length === 0) return;
    const found = items.find(i => i.id === String(params.item));
    if (found) setSelectedItem(found);
    router.setParams({ item: undefined });
  }, [params.item, items, router]);

  const availableYears = [...new Set(items.map(i => i.acquired_year).filter(y => y != null))].sort((a, b) => b - a);
  const availableCities = [...new Set(items.map(i => cityOf(i.acquired_location)).filter(Boolean))].sort();
  const hasMissingYear = items.some(i => i.acquired_year == null);
  const hasMissingCity = items.some(i => cityOf(i.acquired_location) == null);

  const batchMode = selectedIds.size > 0;
  const tabBarOffset = TAB_BAR_HEIGHT + Math.max(insets.bottom, 12);

  useEffect(() => {
    setBatchModeActive(batchMode);
    return () => setBatchModeActive(false);
  }, [batchMode, setBatchModeActive]);

  function toggleBatchSelect(itemId) {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(itemId)) next.delete(itemId);
      else next.add(itemId);
      return next;
    });
  }

  async function handleUpdate(name, photoOrUri, tagNames, isPrivate, description, acquired, ocrText, previousImages, imageAddedAt) {
    if (!selectedItem) return;
    const updated = await updateItem(selectedItem.id, name, photoOrUri, tagNames, isPrivate, description, acquired, ocrText, previousImages, imageAddedAt);
    if (updated) setSelectedItem(updated);
  }

  async function handleDelete() {
    const item = selectedItem;
    setSelectedItem(null);
    if (item) await deleteItem(item.id);
  }

  async function handleBatchEdit({ addTags, acquiredPatch }) {
    if (addTags.length === 0 && !acquiredPatch) { setBatchEditVisible(false); return; }
    const ids = [...selectedIds];
    setBatchEditVisible(false);
    setSelectedIds(new Set());
    await batchEditItems(ids, { addTags, acquiredPatch });
  }

  async function handleBatchDelete() {
    const ids = [...selectedIds];
    setSelectedIds(new Set());
    await batchDeleteItems(ids);
  }

  async function handleBatchTogglePrivacy() {
    await batchTogglePrivacy([...selectedIds]);
  }

  const sortedItems = useMemo(
    () => sortItems(items, sortMode, randomSeed),
    [items, sortMode, randomSeed],
  );

  const queryAst = useMemo(() => parseQuery(searchQuery), [searchQuery]);
  const searchedItems = sortedItems.filter(i => {
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

  const headlineName = profile?.display_name
    ?? 'you';

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => setSettingsVisible(true)} activeOpacity={0.8}>
          <Avatar profile={{ ...profile, user_id: session?.user.id }} size={44} />
        </TouchableOpacity>
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

      <SearchBar
        value={searchQuery}
        onChange={setSearchQuery}
        rightAdornment={
          <TouchableOpacity
            style={styles.filterIconBtn}
            onPress={() => setFilterSheetVisible(true)}
            hitSlop={8}
          >
            <Ionicons name="options-outline" size={20} color={(activeYear || activeCity) ? '#2D2D2D' : '#999'} />
            {(activeYear || activeCity) && <View style={styles.filterIconDot} />}
          </TouchableOpacity>
        }
      />

      <TagFilterChips
        tags={tags}
        activeTag={activeTag}
        onChangeActiveTag={setActiveTag}
        totalCount={searchedItems.length}
        untaggedCount={untaggedCount}
        tagCounts={tagCounts}
        onManagePress={() => setManageTagsVisible(true)}
      />

      <ItemGrid
        items={filteredItems}
        selectedIds={selectedIds}
        onItemPress={item => batchMode ? toggleBatchSelect(item.id) : setSelectedItem(item)}
        onItemLongPress={item => toggleBatchSelect(item.id)}
        refreshing={refreshing}
        onRefresh={onRefresh}
        loading={itemsLoading}
        paddingBottom={tabBarOffset + 24}
      />

      {batchMode && (
        <BatchBar
          selectedIds={selectedIds}
          items={items}
          onCancel={() => setSelectedIds(new Set())}
          onTogglePrivacy={handleBatchTogglePrivacy}
          onDelete={handleBatchDelete}
          onEdit={() => setBatchEditVisible(true)}
        />
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
        sortMode={sortMode}
        onChangeSort={handleChangeSort}
      />

      <ProfileScreen
        visible={settingsVisible}
        onClose={() => setSettingsVisible(false)}
        session={session}
        itemCount={itemCount ?? items.length}
      />

      <ManageTagsSheet
        visible={manageTagsVisible}
        onClose={() => setManageTagsVisible(false)}
        tags={tags}
        totalTagCounts={totalTagCounts}
        onRename={renameTag}
        onDelete={tag => {
          deleteTag(tag.id);
          if (activeTag?.id === tag.id) setActiveTag(null);
        }}
        onToggleTagPrivacy={toggleTagPrivacy}
      />
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
});
