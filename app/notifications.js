import { useCallback, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '../lib/supabase';
import { useCollection } from '../lib/CollectionProvider';
import { fetchNotifications, subscribeToNotifications } from '../shared/notifications';
import { notificationsCacheKey } from '../shared/cacheKeys';
import { relativeTime } from '../shared/dates';
import { S } from '../shared/strings';
import { C } from '../shared/theme';
import Avatar from '../screens/Avatar';

export default function Notifications() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { session, blockedIds, readNotifications } = useCollection();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

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
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} hitSlop={8}>
          <Ionicons name="chevron-back" size={26} color={C.ink} />
        </TouchableOpacity>
        <Text style={styles.title}>{S.notifications.title}</Text>
        <View style={styles.backBtn} />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
      >
        {loading ? (
          <View style={styles.empty}><ActivityIndicator color="#999" /></View>
        ) : visible.length === 0 ? (
          <View style={styles.empty}><Text style={styles.emptyText}>{S.notifications.empty}</Text></View>
        ) : (
          visible.map(n => {
            const name = n.actor.display_name || n.actor.username || 'someone';
            const time = relativeTime(n.created_at);
            return (
              <TouchableOpacity
                key={n.id}
                style={[styles.row, !n.read_at && styles.rowUnread]}
                activeOpacity={0.7}
                onPress={() => handlePress(n)}
              >
                <Avatar profile={n.actor} size={40} />
                <Text style={styles.rowText}>
                  <Text style={styles.name}>{name}</Text>
                  <Text style={styles.action}> {n.type === 'like' ? S.notifications.liked : S.notifications.followed}</Text>
                  {time && <Text style={styles.time}> · {time}</Text>}
                </Text>
              </TouchableOpacity>
            );
          })
        )}
      </ScrollView>
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
