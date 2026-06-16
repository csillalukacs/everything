import { useCallback, useEffect, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { Image } from 'expo-image';
import { ActivityIndicator, Platform, RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '../../lib/supabase';
import { fetchFeedEvents } from '../../shared/itemsApi';
import { thumbOf } from '../../shared/items';
import { relativeTime } from '../../shared/dates';
import { S } from '../../shared/strings';
import { useCollection } from '../../lib/CollectionProvider';
import ItemDetailModal from '../../screens/ItemDetailModal';
import OpenProfileSheet from '../../screens/OpenProfileSheet';
import Avatar from '../../screens/Avatar';
import { C } from '../../shared/theme';

const TAB_BAR_HEIGHT = 70;

export default function Feed() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { session, updateItem, deleteItem, blockedIds, blockedByIds, followingIds, unreadNotifications, refreshNotifications } = useCollection();
  const [feedEvents, setFeedEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);
  const [openProfileVisible, setOpenProfileVisible] = useState(false);
  const [activeTab, setActiveTab] = useState('everyone');

  const isOwnItem = !!selectedItem && session?.user?.id === selectedItem.user_id;
  // Hide both people I've blocked and people who've blocked me (the latter so my
  // updates stay off their feed, mirrored: their updates stay off mine).
  const visibleEvents = feedEvents.filter(
    e => !blockedIds.has(e.item.user_id) && !blockedByIds.has(e.item.user_id),
  );

  // Refresh the unread count each time the feed regains focus (e.g. returning
  // from the notifications screen, where they get marked read).
  useFocusEffect(useCallback(() => { refreshNotifications(); }, [refreshNotifications]));

  const feedOptions = useCallback(
    () => (activeTab === 'friends' ? { limit: 50, authorIds: [...followingIds] } : { limit: 50 }),
    [activeTab, followingIds],
  );

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

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetchFeedEvents(supabase, feedOptions())
      .then(rows => { if (!cancelled) setFeedEvents(rows); })
      .catch(e => console.error('fetchFeedEvents error:', e))
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [feedOptions]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      const rows = await fetchFeedEvents(supabase, feedOptions());
      setFeedEvents(rows);
    } catch (e) {
      console.error('fetchFeedEvents error:', e);
    } finally {
      setRefreshing(false);
    }
  }, [feedOptions]);

  const tabBarOffset = TAB_BAR_HEIGHT + Math.max(insets.bottom, 12);

  function openProfile(item) {
    const slug = item.profile?.username || item.user_id;
    router.push(`/u/${slug}`);
  }

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + 16 }]}>
        <Text style={styles.title}>{S.appName}</Text>
        <View style={styles.headerActions}>
          <TouchableOpacity
            onPress={() => router.push('/notifications')}
            style={styles.headerIconBtn}
            accessibilityLabel={S.a11y.notifications}
          >
            <Ionicons name="notifications-outline" size={22} color="#999" />
            {unreadNotifications > 0 && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{unreadNotifications > 99 ? '99+' : unreadNotifications}</Text>
              </View>
            )}
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setOpenProfileVisible(true)} style={styles.headerIconBtn}>
            <Ionicons name="search" size={22} color="#999" />
          </TouchableOpacity>
        </View>
      </View>
      <View style={styles.tabs}>
        {['everyone', 'friends'].map(tab => (
          <TouchableOpacity key={tab} style={styles.tab} onPress={() => setActiveTab(tab)} activeOpacity={0.7}>
            <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>
              {tab === 'everyone' ? S.feed.tabEveryone : S.feed.tabFriends}
            </Text>
            {activeTab === tab && <View style={styles.tabUnderline} />}
          </TouchableOpacity>
        ))}
      </View>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: tabBarOffset + 24 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#999" />
        }
      >
        {loading ? (
          <View style={styles.empty}>
            <ActivityIndicator color="#999" />
          </View>
        ) : visibleEvents.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyText}>
              {activeTab === 'friends' ? S.feed.friendsEmpty : S.feed.feedEmpty}
            </Text>
          </View>
        ) : (
          <View style={styles.feedList}>
            {visibleEvents.map(event => {
              const item = event.item;
              const name = item.profile?.display_name || item.profile?.username || 'someone';
              const time = relativeTime(event.at);
              const action = event.type === 'usage' ? S.feed.usedItem : S.feed.addedNewItem;
              return (
                <TouchableOpacity
                  key={event.key}
                  style={styles.feedRow}
                  activeOpacity={0.7}
                  onPress={() => setSelectedItem(item)}
                >
                  <TouchableOpacity onPress={() => openProfile(item)} hitSlop={6}>
                    <Avatar profile={{ ...(item.profile ?? {}), user_id: item.user_id }} size={36} />
                  </TouchableOpacity>
                  <View style={styles.feedRowText}>
                    <Text style={styles.posterRow}>
                      <Text
                        style={styles.posterName}
                        onPress={() => openProfile(item)}
                        suppressHighlighting
                      >{name}</Text>
                      <Text style={styles.posterAction}> {action}</Text>
                      {time && <Text style={styles.posterTime}> · {time}</Text>}
                    </Text>
                    {item.name && <Text style={styles.itemName} numberOfLines={1}>{item.name}</Text>}
                    {event.type !== 'usage' && item.description && (
                      <Text style={styles.itemDescription} numberOfLines={2}>{item.description}</Text>
                    )}
                  </View>
                  {item.image_url && (
                    <View style={styles.thumbWrap}>
                      <Image
                        source={{ uri: thumbOf(item) }}
                        style={styles.thumbImage}
                        contentFit="cover"
                        cachePolicy="memory-disk"
                      />
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        )}
      </ScrollView>

      <ItemDetailModal
        visible={!!selectedItem}
        item={selectedItem}
        onClose={() => setSelectedItem(null)}
        onSave={isOwnItem ? handleUpdate : undefined}
        onDelete={isOwnItem ? handleDelete : undefined}
      />

      <OpenProfileSheet
        visible={openProfileVisible}
        onClose={() => setOpenProfileVisible(false)}
        onOpen={slug => { setOpenProfileVisible(false); router.push(`/u/${slug}`); }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: C.bg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingBottom: 28,
    backgroundColor: C.bg,
  },
  title: {
    fontSize: 36,
    fontWeight: '300',
    letterSpacing: 1,
    color: C.ink,
    fontFamily: Platform.OS === 'ios' ? 'Georgia' : undefined,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerIconBtn: {
    padding: 4,
  },
  badge: {
    position: 'absolute',
    top: -2,
    right: -4,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    paddingHorizontal: 4,
    backgroundColor: C.red,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '700',
  },
  tabs: {
    flexDirection: 'row',
    gap: 24,
    paddingHorizontal: 24,
    marginBottom: 20,
  },
  tab: {
    alignItems: 'center',
  },
  tabText: {
    fontSize: 16,
    color: '#999',
  },
  tabTextActive: {
    color: C.ink,
    fontWeight: '500',
  },
  tabUnderline: {
    marginTop: 6,
    height: 2,
    alignSelf: 'stretch',
    backgroundColor: C.ink,
  },
  empty: {
    paddingVertical: 80,
    alignItems: 'center',
  },
  emptyText: {
    color: '#999',
    fontSize: 14,
  },
  feedList: {
    gap: 20,
  },
  feedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  feedRowText: {
    flex: 1,
    gap: 4,
  },
  posterRow: {
    fontSize: 13,
    color: '#777',
    lineHeight: 18,
  },
  posterName: {
    fontSize: 13,
    fontWeight: '500',
    color: C.ink,
  },
  posterAction: {
    color: '#777',
  },
  posterTime: {
    color: '#999',
  },
  itemName: {
    fontSize: 15,
    fontWeight: '500',
    color: C.ink,
  },
  itemDescription: {
    fontSize: 13,
    color: '#777',
    lineHeight: 18,
  },
  thumbWrap: {
    width: 72,
    height: 72,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: C.surface,
  },
  thumbImage: {
    width: '100%',
    height: '100%',
  },
});
