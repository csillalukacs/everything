import { useCallback, useEffect, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Image } from 'expo-image';
import { ActivityIndicator, Platform, RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '../../lib/supabase';
import { fetchPublicFeed } from '../../shared/itemsApi';
import { thumbOf } from '../../shared/items';
import { relativeTime } from '../../shared/dates';
import { S } from '../../shared/strings';
import ItemDetailModal from '../../screens/ItemDetailModal';
import OpenProfileSheet from '../../screens/OpenProfileSheet';

const TAB_BAR_HEIGHT = 70;

export default function Feed() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [feedItems, setFeedItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);
  const [openProfileVisible, setOpenProfileVisible] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetchPublicFeed(supabase, { limit: 50 })
      .then(rows => { if (!cancelled) setFeedItems(rows); })
      .catch(e => console.error('fetchPublicFeed error:', e))
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      const rows = await fetchPublicFeed(supabase, { limit: 50 });
      setFeedItems(rows);
    } catch (e) {
      console.error('fetchPublicFeed error:', e);
    } finally {
      setRefreshing(false);
    }
  }, []);

  const tabBarOffset = TAB_BAR_HEIGHT + Math.max(insets.bottom, 12);

  function openProfile(item) {
    const slug = item.profile?.username || item.user_id;
    router.push(`/u/${slug}`);
  }

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + 16 }]}>
        <Text style={styles.title}>{S.appName}</Text>
        <TouchableOpacity onPress={() => setOpenProfileVisible(true)} style={styles.headerIconBtn}>
          <Ionicons name="search" size={22} color="#999" />
        </TouchableOpacity>
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
        ) : feedItems.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyText}>{S.feed.feedEmpty}</Text>
          </View>
        ) : (
          <View style={styles.feedList}>
            {feedItems.map(item => {
              const name = item.profile?.display_name || item.profile?.username || 'someone';
              const time = relativeTime(item.created_at);
              return (
                <TouchableOpacity
                  key={item.id}
                  style={styles.feedRow}
                  activeOpacity={0.7}
                  onPress={() => setSelectedItem(item)}
                >
                  <View style={styles.feedRowText}>
                    <Text style={styles.posterRow}>
                      <Text
                        style={styles.posterName}
                        onPress={() => openProfile(item)}
                        suppressHighlighting
                      >{name}</Text>
                      <Text style={styles.posterAction}> {S.feed.addedNewItem}</Text>
                      {time && <Text style={styles.posterTime}> · {time}</Text>}
                    </Text>
                    {item.name && <Text style={styles.itemName} numberOfLines={1}>{item.name}</Text>}
                    {item.description && (
                      <Text style={styles.itemDescription} numberOfLines={2}>{item.description}</Text>
                    )}
                  </View>
                  {item.image_url && (
                    <View style={styles.thumbWrap}>
                      <Image
                        source={{ uri: thumbOf(item) }}
                        style={styles.thumbImage}
                        contentFit="contain"
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
    backgroundColor: '#F5F0EB',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingBottom: 28,
    backgroundColor: '#F5F0EB',
  },
  title: {
    fontSize: 36,
    fontWeight: '300',
    letterSpacing: 1,
    color: '#2D2D2D',
    fontFamily: Platform.OS === 'ios' ? 'Georgia' : undefined,
  },
  headerIconBtn: {
    padding: 4,
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
    color: '#2D2D2D',
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
    color: '#2D2D2D',
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
    backgroundColor: '#E8E3DD',
  },
  thumbImage: {
    width: '100%',
    height: '100%',
  },
});
