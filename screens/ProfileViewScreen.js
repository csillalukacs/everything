import { Ionicons } from '@expo/vector-icons';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { supabase } from '../lib/supabase';
import { fetchAllItems, fetchItemCount } from '../shared/itemsApi';
import { UUID_RE } from '../shared/identifiers';
import { S } from '../shared/strings';
import { FEATURED_TAG_NAME, isFeaturedTag, sortTagsFeaturedFirst, findFeaturedTag } from '../shared/featuredTag';
import { useCollection } from '../lib/CollectionProvider';
import ItemDetailModal from './ItemDetailModal';
import ReportSheet from './ReportSheet';
import Avatar from './Avatar';
import ItemGrid from './ItemGrid';
import AppleIcon from './AppleIcon';
import { C } from '../shared/theme';

export default function ProfileViewScreen({ visible, slug, initialItemId, onClose }) {
  const { session, blockedIds, blockContent, unblockContent, reportContent } = useCollection();
  const [menuVisible, setMenuVisible] = useState(false);
  const [reportSheetVisible, setReportSheetVisible] = useState(false);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [profile, setProfile] = useState(null);
  const [resolvedUserId, setResolvedUserId] = useState(null);
  const [items, setItems] = useState([]);
  const [itemCount, setItemCount] = useState(null);
  const [activeTag, setActiveTag] = useState({ id: '__featured__', name: FEATURED_TAG_NAME, is_private: false });
  const [selectedItem, setSelectedItem] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [openedInitial, setOpenedInitial] = useState(false);
  const featuredFallbackCheckedRef = useRef(false);

  useEffect(() => {
    setOpenedInitial(false);
    featuredFallbackCheckedRef.current = false;
  }, [slug, initialItemId]);

  useEffect(() => {
    if (loading || featuredFallbackCheckedRef.current) return;
    featuredFallbackCheckedRef.current = true;
    if (!isFeaturedTag(activeTag)) return;
    const hasFeatured = items.some(i => (i.tags ?? []).some(isFeaturedTag));
    if (!hasFeatured) setActiveTag(null);
  }, [loading, items, activeTag]);

  useEffect(() => {
    if (openedInitial || !initialItemId || items.length === 0) return;
    const found = items.find(i => i.id === initialItemId);
    if (found) {
      setSelectedItem(found);
      setOpenedInitial(true);
    }
  }, [openedInitial, initialItemId, items]);

  useEffect(() => {
    if (!visible || !slug) return;
    let cancelled = false;
    setLoading(true);
    setNotFound(false);
    setProfile(null);
    setResolvedUserId(null);
    setItems([]);
    setItemCount(null);
    setActiveTag({ id: '__featured__', name: FEATURED_TAG_NAME, is_private: false });
    setSelectedItem(null);
    setSearchQuery('');
    setMenuVisible(false);
    setReportSheetVisible(false);

    (async () => {
      const slugIsUuid = UUID_RE.test(slug);
      let resolvedId = null;
      let resolvedProfile = null;
      const cols = 'user_id, display_name, username, home_location, home_lat, home_lng, avatar_url, avatar_thumb_url';
      if (slugIsUuid) {
        const { data } = await supabase
          .from('profiles')
          .select(cols)
          .eq('user_id', slug)
          .maybeSingle();
        if (data) { resolvedId = data.user_id; resolvedProfile = data; }
      } else {
        const { data } = await supabase
          .from('profiles')
          .select(cols)
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
      setResolvedUserId(resolvedId);

      fetchItemCount(supabase, { userId: resolvedId, publicOnly: true })
        .then(c => { if (!cancelled) setItemCount(c); })
        .catch(e => console.error('fetchItemCount error:', e));

      try {
        const fetchedItems = await fetchAllItems(supabase, { userId: resolvedId, publicOnly: true });
        if (cancelled) return;
        setItems(fetchedItems);
      } catch (e) {
        console.error('fetchAllItems error:', e);
      }
      if (cancelled) return;
      setLoading(false);
    })();

    return () => { cancelled = true; };
  }, [visible, slug]);

  const onRefresh = useCallback(async () => {
    if (!resolvedUserId) return;
    setRefreshing(true);
    try {
      const [fetched, count] = await Promise.all([
        fetchAllItems(supabase, { userId: resolvedUserId, publicOnly: true }),
        fetchItemCount(supabase, { userId: resolvedUserId, publicOnly: true }),
      ]);
      setItems(fetched);
      setItemCount(count);
    } catch (e) {
      console.error('ProfileView refresh error:', e);
    } finally {
      setRefreshing(false);
    }
  }, [resolvedUserId]);

  const isOwnProfile = !!session?.user?.id && session.user.id === resolvedUserId;
  const isBlocked = !!resolvedUserId && blockedIds.has(resolvedUserId);
  const ownerName = profile?.display_name
    || (profile?.username ? `@${profile.username}` : 'this user');

  async function handleReportPick(reason) {
    setReportSheetVisible(false);
    await reportContent({ targetType: 'profile', targetId: resolvedUserId, targetUserId: resolvedUserId, reason });
    Alert.alert(S.moderation.reportThanksTitle, S.moderation.reportThanksBody);
  }

  function handleBlock() {
    setMenuVisible(false);
    Alert.alert(
      S.moderation.blockConfirmTitle(ownerName),
      S.moderation.blockConfirmBody,
      [
        { text: S.common.cancel, style: 'cancel' },
        {
          text: S.moderation.block,
          style: 'destructive',
          onPress: async () => {
            const name = ownerName;
            await blockContent(resolvedUserId);
            Alert.alert(S.moderation.blockedDone(name));
          },
        },
      ],
    );
  }

  function handleUnblock() {
    setMenuVisible(false);
    Alert.alert(
      S.moderation.unblockConfirmTitle(ownerName),
      S.moderation.unblockConfirmBody,
      [
        { text: S.common.cancel, style: 'cancel' },
        { text: S.moderation.unblock, onPress: () => unblockContent(resolvedUserId) },
      ],
    );
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

  const tagMap = new Map();
  searchedItems.forEach(item => {
    (item.tags ?? []).forEach(tag => {
      if (!tag.is_private) tagMap.set(tag.id, tag);
    });
  });
  const visibleTagsList = [...tagMap.values()];
  if (!findFeaturedTag(visibleTagsList)) {
    visibleTagsList.push({ id: '__featured__', name: FEATURED_TAG_NAME, is_private: false });
  }
  const visibleTags = sortTagsFeaturedFirst(visibleTagsList);

  const tagCounts = new Map();
  for (const item of searchedItems) {
    for (const t of (item.tags ?? [])) tagCounts.set(t.id, (tagCounts.get(t.id) ?? 0) + 1);
  }

  const filteredItems = !activeTag
    ? searchedItems
    : isFeaturedTag(activeTag)
      ? searchedItems.filter(i => (i.tags ?? []).some(t => t.name === FEATURED_TAG_NAME))
      : searchedItems.filter(i => (i.tags ?? []).some(t => t.id === activeTag.id));

  const headerTitle = profile?.display_name
    ?? (profile?.username ? `@${profile.username}` : (slug ?? '').slice(0, 8));

  return (
    <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.backBtn}>
            <Ionicons name="chevron-back" size={28} color={C.ink} />
          </TouchableOpacity>
          {profile && <Avatar profile={profile} size={56} style={styles.headerAvatar} />}
          <View style={{ flex: 1 }}>
            <Text style={styles.title} numberOfLines={1}>{headerTitle}</Text>
            {profile?.username && profile?.display_name && (
              <Text style={styles.subtitle}>@{profile.username}</Text>
            )}
            {profile?.home_location && (
              <View style={styles.homeRow}>
                <Ionicons name="location-outline" size={12} color="#999" />
                <Text style={styles.homeText} numberOfLines={1}>
                  {profile.home_location.split(',')[0]}
                </Text>
              </View>
            )}
            {!loading && !notFound && !isBlocked && itemCount != null && (
              <Text style={styles.itemCount}>{S.profile.objectCount(itemCount)}</Text>
            )}
          </View>
          {!loading && !notFound && resolvedUserId && !isOwnProfile && (
            <View style={styles.menuWrap} pointerEvents="box-none">
              <TouchableOpacity style={styles.menuBtn} onPress={() => setMenuVisible(v => !v)} hitSlop={8}>
                <Ionicons name="ellipsis-horizontal" size={20} color={C.ink} />
              </TouchableOpacity>
              {menuVisible && (
                <View style={styles.menu}>
                  <TouchableOpacity
                    style={styles.menuItem}
                    onPress={() => { setMenuVisible(false); setReportSheetVisible(true); }}
                  >
                    <Ionicons name="flag-outline" size={18} color={C.ink} />
                    <Text style={styles.menuItemText}>{S.moderation.report}</Text>
                  </TouchableOpacity>
                  {isBlocked ? (
                    <TouchableOpacity style={styles.menuItem} onPress={handleUnblock}>
                      <Ionicons name="checkmark-circle-outline" size={18} color={C.ink} />
                      <Text style={styles.menuItemText}>{S.moderation.unblock}</Text>
                    </TouchableOpacity>
                  ) : (
                    <TouchableOpacity style={styles.menuItem} onPress={handleBlock}>
                      <Ionicons name="ban-outline" size={18} color={C.red} />
                      <Text style={[styles.menuItemText, styles.menuItemDanger]}>{S.moderation.block}</Text>
                    </TouchableOpacity>
                  )}
                </View>
              )}
            </View>
          )}
        </View>

        {loading ? (
          <View style={styles.centered}>
            <ActivityIndicator color="#999" />
          </View>
        ) : notFound ? (
          <View style={styles.centered}>
            <Text style={styles.emptyText}>{S.profileView.notFound(slug)}</Text>
          </View>
        ) : isBlocked ? (
          <View style={styles.centered}>
            <Ionicons name="ban-outline" size={40} color="#bbb" />
            <Text style={styles.blockedTitle}>{S.moderation.profileBlocked(ownerName)}</Text>
            <Text style={styles.blockedHint}>{S.moderation.profileBlockedHint}</Text>
            <TouchableOpacity style={styles.unblockBtn} onPress={handleUnblock}>
              <Text style={styles.unblockBtnText}>{S.moderation.unblock}</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
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
            </View>

            {visibleTags.length > 0 && (() => {
              const renderTagChip = (tag) => {
                const featured = isFeaturedTag(tag);
                const active = featured ? isFeaturedTag(activeTag) : activeTag?.id === tag.id;
                const count = featured
                  ? searchedItems.filter(i => (i.tags ?? []).some(t => t.name === FEATURED_TAG_NAME)).length
                  : (tagCounts.get(tag.id) ?? 0);
                return (
                  <TouchableOpacity
                    key={tag.id}
                    style={[styles.filterChip, active && styles.filterChipActive]}
                    onPress={() => setActiveTag(active ? null : tag)}
                  >
                    {featured && <AppleIcon size={14} />}
                    <Text style={[styles.filterChipText, active && styles.filterChipTextActive]}>{tag.name}</Text>
                    <Text style={[styles.filterChipCount, active && styles.filterChipCountActive]}>{count}</Text>
                  </TouchableOpacity>
                );
              };
              const featuredTag = visibleTags.find(isFeaturedTag);
              const otherTags = visibleTags.filter(t => !isFeaturedTag(t));
              return (
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  style={styles.filterScroll}
                  contentContainerStyle={styles.filterScrollContent}
                >
                  {featuredTag && renderTagChip(featuredTag)}
                  <TouchableOpacity
                    style={[styles.filterChip, !activeTag && styles.filterChipActive]}
                    onPress={() => setActiveTag(null)}
                  >
                    <Text style={[styles.filterChipText, !activeTag && styles.filterChipTextActive]}>{S.common.all}</Text>
                    <Text style={[styles.filterChipCount, !activeTag && styles.filterChipCountActive]}>{searchedItems.length}</Text>
                  </TouchableOpacity>
                  {otherTags.map(renderTagChip)}
                </ScrollView>
              );
            })()}

            <ItemGrid
              items={filteredItems}
              onItemPress={setSelectedItem}
              refreshing={refreshing}
              onRefresh={onRefresh}
              numColumns={3}
              emptyText={S.profileView.nothingPublic}
            />
          </>
        )}

        <ItemDetailModal
          visible={!!selectedItem}
          item={selectedItem}
          onClose={() => setSelectedItem(null)}
          allTags={[]}
          onTagPress={tag => { setActiveTag(tag); setSelectedItem(null); }}
          onPrev={(() => {
            const idx = filteredItems.findIndex(i => i.id === selectedItem?.id);
            return idx > 0 ? () => setSelectedItem(filteredItems[idx - 1]) : null;
          })()}
          onNext={(() => {
            const idx = filteredItems.findIndex(i => i.id === selectedItem?.id);
            return idx < filteredItems.length - 1 ? () => setSelectedItem(filteredItems[idx + 1]) : null;
          })()}
        />

        <ReportSheet
          visible={reportSheetVisible}
          onClose={() => setReportSheetVisible(false)}
          onPick={handleReportPick}
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
    zIndex: 20,
  },
  backBtn: {
    paddingTop: 4,
    paddingRight: 4,
    marginLeft: -8,
  },
  menuWrap: {
    paddingTop: 4,
  },
  menuBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  menu: {
    position: 'absolute',
    top: 44,
    right: 0,
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingVertical: 4,
    minWidth: 140,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 8,
    zIndex: 30,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  menuItemText: {
    fontSize: 14,
    color: C.ink,
  },
  menuItemDanger: {
    color: C.red,
  },
  headerAvatar: {
    marginRight: 12,
    marginTop: 2,
  },
  title: {
    fontSize: 28,
    fontWeight: '300',
    letterSpacing: 1,
    color: C.ink,
  },
  subtitle: {
    fontSize: 13,
    color: '#999',
    marginTop: 2,
  },
  homeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
  },
  homeText: {
    fontSize: 13,
    color: '#999',
    flexShrink: 1,
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
    color: C.ink,
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
    backgroundColor: C.ink,
    borderColor: C.ink,
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
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    fontSize: 14,
    color: '#999',
  },
  blockedTitle: {
    fontSize: 17,
    fontWeight: '500',
    color: C.ink,
    marginTop: 14,
  },
  blockedHint: {
    fontSize: 14,
    color: '#999',
    marginTop: 6,
    textAlign: 'center',
  },
  unblockBtn: {
    marginTop: 20,
    paddingVertical: 10,
    paddingHorizontal: 24,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: C.ink,
    backgroundColor: '#fff',
  },
  unblockBtnText: {
    fontSize: 15,
    fontWeight: '500',
    color: C.ink,
  },
});
