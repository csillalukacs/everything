import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Dimensions, FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { supabase } from '../lib/supabase';
import { fetchFollowList } from '../shared/follows';
import { S } from '../shared/strings';
import { C } from '../shared/theme';
import Avatar from './Avatar';
import BottomSheet from './BottomSheet';

const LIST_MAX_HEIGHT = Dimensions.get('window').height * 0.6;

// Followers / following list as a bottom sheet. `mode` is 'followers' | 'following'.
export default function FollowListScreen({ visible, userId, mode, onClose, onOpenProfile }) {
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
    <BottomSheet visible={visible} onClose={onClose} sheetStyle={styles.sheet}>
      <Text style={styles.title}>{title}</Text>
      {loading ? (
        <View style={styles.centered}><ActivityIndicator color="#999" /></View>
      ) : profiles.length === 0 ? (
        <View style={styles.centered}><Text style={styles.empty}>{empty}</Text></View>
      ) : (
        <FlatList
          data={profiles}
          keyExtractor={p => p.user_id}
          style={styles.list}
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
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  sheet: {
    backgroundColor: C.bg,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 8,
    paddingHorizontal: 24,
    paddingBottom: 24,
  },
  title: {
    fontSize: 20,
    fontWeight: '500',
    color: C.ink,
    marginBottom: 12,
  },
  centered: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  empty: {
    fontSize: 14,
    color: '#999',
  },
  list: {
    flexGrow: 0,
    maxHeight: LIST_MAX_HEIGHT,
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
