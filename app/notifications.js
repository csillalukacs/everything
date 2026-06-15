import { useCallback, useEffect, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '../lib/supabase';
import { useCollection } from '../lib/CollectionProvider';
import { fetchNotifications } from '../shared/notifications';
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

  useEffect(() => {
    if (!session) return;
    let cancelled = false;
    fetchNotifications(supabase, session.user.id)
      .then(data => { if (!cancelled) setRows(data); })
      .catch(e => console.error('fetchNotifications error:', e))
      .finally(() => { if (!cancelled) setLoading(false); });
    // Opening the screen clears the badge.
    readNotifications();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session]);

  const visible = rows.filter(n => !blockedIds.has(n.actor_id));

  const openActor = useCallback(actor => {
    router.push(`/u/${actor.username || actor.user_id}`);
  }, [router]);

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
                onPress={() => openActor(n.actor)}
              >
                <Avatar profile={n.actor} size={40} />
                <Text style={styles.rowText}>
                  <Text style={styles.name}>{name}</Text>
                  <Text style={styles.action}> {S.notifications.followed}</Text>
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
