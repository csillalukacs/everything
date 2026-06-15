import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '../lib/supabase';
import { fetchFollowList } from '../shared/follows';
import { S } from '../shared/strings';
import { C } from '../shared/theme';
import Avatar from './Avatar';

// Followers / following list as a slide-up modal. `mode` is 'followers' | 'following'.
export default function FollowListScreen({ visible, userId, mode, onClose, onOpenProfile }) {
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(true);
  const [profiles, setProfiles] = useState([]);

  useEffect(() => {
    if (!visible || !userId || !mode) return;
    let cancelled = false;
    setLoading(true);
    fetchFollowList(supabase, userId, mode)
      .then(rows => { if (!cancelled) setProfiles(rows); })
      .catch(e => console.error('fetchFollowList error:', e))
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [visible, userId, mode]);

  const title = mode === 'followers' ? S.social.followersTitle : S.social.followingTitle;
  const empty = mode === 'followers' ? S.social.noFollowers : S.social.noFollowing;

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={[styles.container, { paddingTop: insets.top + 12 }]}>
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} hitSlop={8} style={styles.back}>
            <Ionicons name="chevron-back" size={26} color={C.ink} />
          </TouchableOpacity>
          <Text style={styles.title}>{title}</Text>
        </View>
        {loading ? (
          <View style={styles.centered}><ActivityIndicator color="#999" /></View>
        ) : profiles.length === 0 ? (
          <View style={styles.centered}><Text style={styles.empty}>{empty}</Text></View>
        ) : (
          <FlatList
            data={profiles}
            keyExtractor={p => p.user_id}
            contentContainerStyle={styles.list}
            renderItem={({ item }) => {
              const name = item.display_name || (item.username ? `@${item.username}` : 'someone');
              const slug = item.username || item.user_id;
              return (
                <TouchableOpacity style={styles.row} activeOpacity={0.7} onPress={() => onOpenProfile(slug)}>
                  <Avatar profile={item} size={44} />
                  <View style={styles.rowText}>
                    <Text style={styles.name} numberOfLines={1}>{name}</Text>
                    {item.display_name && item.username && (
                      <Text style={styles.handle} numberOfLines={1}>@{item.username}</Text>
                    )}
                  </View>
                  <Ionicons name="chevron-forward" size={18} color="#ccc" />
                </TouchableOpacity>
              );
            }}
          />
        )}
      </View>
    </Modal>
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
    gap: 6,
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  back: {
    marginLeft: -4,
  },
  title: {
    fontSize: 20,
    fontWeight: '500',
    color: C.ink,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  empty: {
    fontSize: 14,
    color: '#999',
  },
  list: {
    paddingHorizontal: 24,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: C.surface,
  },
  rowText: {
    flex: 1,
  },
  name: {
    fontSize: 15,
    fontWeight: '500',
    color: C.ink,
  },
  handle: {
    fontSize: 13,
    color: '#999',
    marginTop: 1,
  },
});
