import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useCollection } from '../../lib/CollectionProvider';
import { supabase } from '../../lib/supabase';
import { fetchFollowCounts } from '../../shared/follows';
import ItemDetailModal from '../../screens/ItemDetailModal';
import FollowListScreen from '../../screens/FollowListScreen';
import ProfileSheet from '../../screens/ProfileSheet';
import BatchEditSheet from '../../screens/BatchEditSheet';
import FilterSheet from '../../screens/FilterSheet';
import ProfileScreen from '../../screens/ProfileScreen';
import ManageTagsSheet from '../../screens/ManageTagsSheet';
import CollagesSheet from '../../screens/CollagesSheet';
import ItemGrid from '../../screens/ItemGrid';
import SearchBar from '../../screens/SearchBar';
import BatchBar from '../../screens/BatchBar';
import TagFilterChips from '../../screens/TagFilterChips';
import Avatar from '../../screens/Avatar';
import { cityOf, isRetired } from '../../shared/items';
import { parseQuery, matchItem } from '../../shared/searchQuery';
import { sortItems, newRandomSeed } from '../../shared/sortItems';
import { isFeaturedTag } from '../../shared/featuredTag';
import { S } from '../../shared/strings';
import { C } from '../../shared/theme';

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
    retireItem,
    batchEditItems,
    batchDeleteItems,
    batchTogglePrivacy,
    deleteTag,
    toggleTagPrivacy,
    renameTag,
    countCollagesForTag,
    refresh,
    setBatchModeActive,
    followingIds,
  } = useCollection();

  const [followCounts, setFollowCounts] = useState({ followers: 0, following: 0 });
  const [followListMode, setFollowListMode] = useState(null);
  const [profileSheetVisible, setProfileSheetVisible] = useState(false);
  const [activeTag, setActiveTag] = useState(null);
  const [activeYear, setActiveYear] = useState(null);
  const [activeCity, setActiveCity] = useState(null);
  const [selectedItem, setSelectedItem] = useState(null);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [batchEditVisible, setBatchEditVisible] = useState(false);
  const [manageTagsVisible, setManageTagsVisible] = useState(false);
  const [collagesSheetVisible, setCollagesSheetVisible] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterSheetVisible, setFilterSheetVisible] = useState(false);
  const [settingsVisible, setSettingsVisible] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [explicitSortMode, setExplicitSortMode] = useState(null);
  const [randomSeed, setRandomSeed] = useState(() => newRandomSeed());

  const defaultSortForContext = isFeaturedTag(activeTag) ? 'random' : 'edited';
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
    if (!params.tag) return;
    const found = tags.find(t => t.name === String(params.tag));
    if (!found) return;
    setActiveTag(found);
    setActiveCity(null);
    setActiveYear(null);
    router.setParams({ tag: undefined });
  }, [params.tag, tags, router]);

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

  // Retired (graveyard) items are excluded from the collection; they live in /graveyard.
  const activeItems = useMemo(() => items.filter(i => !isRetired(i)), [items]);
  const retiredCount = items.length - activeItems.length;

  const availableYears = [...new Set(activeItems.map(i => i.acquired_year).filter(y => y != null))].sort((a, b) => b - a);
  const availableCities = [...new Set(activeItems.map(i => cityOf(i.acquired_location)).filter(Boolean))].sort();
  const hasMissingYear = activeItems.some(i => i.acquired_year == null);
  const hasMissingCity = activeItems.some(i => cityOf(i.acquired_location) == null);

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
    if (!selectedItem) return false;
    const updated = await updateItem(selectedItem.id, name, photoOrUri, tagNames, isPrivate, description, acquired, ocrText, previousImages, imageAddedAt);
    if (!updated) return false;
    setSelectedItem(updated);
    return true;
  }

  async function handleDelete() {
    const item = selectedItem;
    setSelectedItem(null);
    if (item) await deleteItem(item.id);
  }

  async function handleRetire(reason, epitaph) {
    const item = selectedItem;
    setSelectedItem(null);
    if (item) await retireItem(item, { reason, epitaph });
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
    () => sortItems(activeItems, sortMode, randomSeed),
    [activeItems, sortMode, randomSeed],
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
  for (const item of activeItems) {
    for (const t of (item.tags ?? [])) totalTagCounts.set(t.id, (totalTagCounts.get(t.id) ?? 0) + 1);
  }

  useEffect(() => {
    const uid = session?.user?.id;
    if (!uid) return;
    let cancelled = false;
    fetchFollowCounts(supabase, uid)
      .then(c => { if (!cancelled) setFollowCounts(c); })
      .catch(e => console.error('fetchFollowCounts error:', e));
    return () => { cancelled = true; };
  }, [session?.user?.id, followingIds]);

  const headlineName = profile?.display_name
    ?? 'you';

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => setProfileSheetVisible(true)} activeOpacity={0.8}>
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
          {retiredCount > 0 && (
            <TouchableOpacity onPress={() => router.push('/graveyard')} style={styles.headerIconBtn}>
              <Text style={styles.graveyardIcon}>{S.graveyard.emoji}</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity onPress={() => router.push('/favorites')} style={styles.headerIconBtn} accessibilityLabel={S.a11y.favorites}>
            <Ionicons name="heart-outline" size={22} color="#999" />
          </TouchableOpacity>
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
            <Ionicons name="options-outline" size={20} color={(activeYear || activeCity) ? C.ink : '#999'} />
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

      {activeTag && activeTag.id !== '__untagged__' && (
        <View style={styles.tagActionsRow}>
          <TouchableOpacity
            style={styles.tagActionBtn}
            onPress={() => setCollagesSheetVisible(true)}
            activeOpacity={0.7}
          >
            <Ionicons name="grid-outline" size={14} color={C.ink} />
            <Text style={styles.tagActionText}>{S.collages.title}</Text>
          </TouchableOpacity>
        </View>
      )}

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
        onRetire={handleRetire}
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

      <ProfileSheet
        visible={profileSheetVisible}
        onClose={() => setProfileSheetVisible(false)}
        profile={{ ...profile, user_id: session?.user?.id }}
        counts={followCounts}
        isOwn
        onSettings={() => setSettingsVisible(true)}
        onShowFollows={mode => setFollowListMode(mode)}
      />

      <FollowListScreen
        visible={!!followListMode}
        userId={session?.user?.id}
        mode={followListMode}
        onClose={() => setFollowListMode(null)}
        onOpenProfile={slug => { setFollowListMode(null); router.push(`/u/${slug}`); }}
      />

      <ManageTagsSheet
        visible={manageTagsVisible}
        onClose={() => setManageTagsVisible(false)}
        tags={tags}
        totalTagCounts={totalTagCounts}
        onRename={renameTag}
        onDelete={async tag => {
          const doDelete = () => {
            deleteTag(tag.id);
            if (activeTag?.id === tag.id) setActiveTag(null);
          };
          const collageCount = await countCollagesForTag(tag.id);
          if (collageCount > 0) {
            Alert.alert(
              S.collection.deleteTagWithCollages(tag.name, collageCount),
              undefined,
              [
                { text: S.common.cancel, style: 'cancel' },
                { text: S.common.delete, style: 'destructive', onPress: doDelete },
              ],
            );
          } else {
            doDelete();
          }
        }}
        onToggleTagPrivacy={toggleTagPrivacy}
      />

      <CollagesSheet
        visible={collagesSheetVisible}
        onClose={() => setCollagesSheetVisible(false)}
        tag={activeTag && activeTag.id !== '__untagged__' ? activeTag : null}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: C.bg,
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
    color: C.ink,
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
  graveyardIcon: {
    fontSize: 20,
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
    backgroundColor: C.ink,
  },
  tagActionsRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: -8,
    marginBottom: 16,
  },
  tagActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    height: 30,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: '#E0E0E0',
    backgroundColor: '#fff',
  },
  tagActionText: {
    fontSize: 13,
    color: C.ink,
  },
});
