import { useCallback, useEffect, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { ActivityIndicator, Dimensions, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  useAnimatedScrollHandler,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { runOnJS } from 'react-native-worklets';
import { Image } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '../lib/supabase';
import { useCollection } from '../lib/CollectionProvider';
import { fetchNotifications, subscribeToNotifications } from '../shared/notifications';
import { groupConsecutive } from '../shared/grouping';
import { notificationsCacheKey } from '../shared/cacheKeys';
import { thumbOf } from '../shared/items';
import { relativeTime, dayKey } from '../shared/dates';
import { S } from '../shared/strings';
import { C } from '../shared/theme';
import Avatar from '../screens/Avatar';
import PhotoStack from '../screens/PhotoStack';
import GroupItemsSheet from '../screens/GroupItemsSheet';

const SCREEN_HEIGHT = Dimensions.get('window').height;

export default function Notifications() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { session, blockedIds, readNotifications } = useCollection();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [moreGroup, setMoreGroup] = useState(null);

  // Swipe-down-to-dismiss. We translate the whole screen, but only when the
  // ScrollView is already at the top and the drag is downward — otherwise the
  // gesture stays out of the way and the list scrolls normally.
  const scrollRef = useRef(null);
  const scrollY = useSharedValue(0);
  const translateY = useSharedValue(0);

  const scrollHandler = useAnimatedScrollHandler((e) => {
    scrollY.value = e.contentOffset.y;
  });

  const close = useCallback(() => router.back(), [router]);

  const dismissGesture = Gesture.Pan()
    .simultaneousWithExternalGesture(scrollRef)
    .onUpdate((e) => {
      if (e.translationY > 0 && scrollY.value <= 0) {
        translateY.value = e.translationY;
      }
    })
    .onEnd((e) => {
      if (e.translationY > 120 && scrollY.value <= 0) {
        translateY.value = withTiming(SCREEN_HEIGHT, { duration: 220 }, (finished) => {
          if (finished) runOnJS(close)();
        });
      } else {
        translateY.value = withSpring(0);
      }
    });

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  const load = useCallback(async () => {
    if (!session) return;
    const key = notificationsCacheKey(session.user.id);
    try {
      const data = await fetchNotifications(supabase, session.user.id);
      setRows(data);
      AsyncStorage.setItem(key, JSON.stringify(data));
    } catch (e) {
      console.error('fetchNotifications error:', e);
    } finally {
      setLoading(false);
    }
  }, [session]);

  useEffect(() => {
    if (!session) return;
    let cancelled = false;
    const key = notificationsCacheKey(session.user.id);
    // Show the last-known list right away; only spin if we've never loaded.
    AsyncStorage.getItem(key).then(raw => {
      if (cancelled || !raw) return;
      try { setRows(JSON.parse(raw)); setLoading(false); } catch { /* ignore */ }
    });
    load();
    // Opening the screen clears the badge.
    readNotifications();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session]);

  // Realtime: a notification arriving while this screen is open should appear in
  // the list, not just bump the badge. Re-fetch on each event and re-mark read so
  // the badge stays clear while you're looking at it.
  useEffect(() => {
    if (!session) return;
    return subscribeToNotifications(supabase, session.user.id, () => {
      load();
      readNotifications();
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session]);

  const visible = rows.filter(n => !blockedIds.has(n.actor_id));

  const openActor = useCallback(actor => {
    router.push(`/u/${actor.username || actor.user_id}`);
  }, [router]);

  // A 'like' is someone favoriting one of your own things — open that thing in your
  // collection; a 'follow' opens the actor's profile.
  const handlePress = useCallback(n => {
    if (n.type === 'like' && n.item_id) router.push(`/?item=${n.item_id}`);
    else openActor(n.actor);
  }, [router, openActor]);

  return (
    <GestureHandlerRootView style={styles.root}>
    <GestureDetector gesture={dismissGesture}>
    <Animated.View style={[styles.container, animStyle]}>
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} hitSlop={8}>
          <Ionicons name="chevron-down" size={26} color={C.ink} />
        </TouchableOpacity>
        <Text style={styles.title}>{S.notifications.title}</Text>
        <View style={styles.backBtn} />
      </View>

      <Animated.ScrollView
        ref={scrollRef}
        onScroll={scrollHandler}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
      >
        {loading ? (
          <View style={styles.empty}><ActivityIndicator color="#999" /></View>
        ) : visible.length === 0 ? (
          <View style={styles.empty}><Text style={styles.emptyText}>{S.notifications.empty}</Text></View>
        ) : (
          groupConsecutive(visible, n => n.actor_id, n => (n.type === 'like' ? 'like' : null), n => dayKey(new Date(n.created_at))).map(group => {
            const first = group.entries[0];
            const name = first.actor.display_name || first.actor.username || 'someone';
            const time = relativeTime(first.created_at);
            const unread = group.entries.some(n => !n.read_at);

            if (group.entries.length > 1) {
              const count = group.entries.length;
              const thumbs = group.entries.map(n => n.item && thumbOf(n.item)).filter(Boolean);
              return (
                <TouchableOpacity
                  key={group.key}
                  style={[styles.row, unread && styles.rowUnread]}
                  activeOpacity={0.7}
                  onPress={() => openActor(first.actor)}
                >
                  <TouchableOpacity onPress={() => openActor(first.actor)} hitSlop={6}>
                    <Avatar profile={first.actor} size={40} />
                  </TouchableOpacity>
                  <Text style={styles.rowText}>
                    <Text style={styles.name} onPress={() => openActor(first.actor)}>{name}</Text>
                    <Text style={styles.action}> {S.notifications.likedThings(count)}</Text>
                    {time && <Text style={styles.time}> · {time}</Text>}
                  </Text>
                  {thumbs.length > 0 && (
                    <PhotoStack
                      thumbs={thumbs}
                      total={count}
                      size={44}
                      onPress={() => setMoreGroup({
                        title: S.notifications.likedThings(count),
                        items: group.entries.map(n => n.item).filter(Boolean),
                      })}
                    />
                  )}
                </TouchableOpacity>
              );
            }

            const n = first;
            const thumb = n.item ? thumbOf(n.item) : null;
            return (
              <TouchableOpacity
                key={group.key}
                style={[styles.row, !n.read_at && styles.rowUnread]}
                activeOpacity={0.7}
                onPress={() => handlePress(n)}
              >
                <TouchableOpacity onPress={() => openActor(n.actor)} hitSlop={6}>
                  <Avatar profile={n.actor} size={40} />
                </TouchableOpacity>
                <Text style={styles.rowText}>
                  <Text style={styles.name} onPress={() => openActor(n.actor)}>{name}</Text>
                  <Text style={styles.action}> {n.type === 'like' ? S.notifications.liked : S.notifications.followed}</Text>
                  {time && <Text style={styles.time}> · {time}</Text>}
                </Text>
                {thumb && (
                  <Image
                    source={{ uri: thumb }}
                    style={styles.thumb}
                    contentFit="cover"
                    cachePolicy="memory-disk"
                  />
                )}
              </TouchableOpacity>
            );
          })
        )}
      </Animated.ScrollView>

      <GroupItemsSheet
        visible={!!moreGroup}
        onClose={() => setMoreGroup(null)}
        title={moreGroup?.title}
        items={moreGroup?.items ?? []}
        onItemPress={item => router.push(`/?item=${item.id}`)}
      />
    </Animated.View>
    </GestureDetector>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  container: {
    flex: 1,
    backgroundColor: C.bg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: C.surface,
  },
  backBtn: {
    width: 40,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: C.ink,
  },
  empty: {
    paddingVertical: 80,
    alignItems: 'center',
  },
  emptyText: {
    color: '#999',
    fontSize: 14,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 14,
    paddingHorizontal: 24,
  },
  rowUnread: {
    backgroundColor: C.surface,
  },
  rowText: {
    flex: 1,
    fontSize: 14,
    color: '#777',
    lineHeight: 19,
  },
  thumb: {
    width: 44,
    height: 44,
    borderRadius: 6,
    backgroundColor: C.surface,
  },
  name: {
    fontWeight: '600',
    color: C.ink,
  },
  action: {
    color: '#777',
  },
  time: {
    color: '#999',
  },
});
