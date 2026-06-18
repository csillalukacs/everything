import { Ionicons } from '@expo/vector-icons';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Dimensions, Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  useAnimatedScrollHandler,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { runOnJS } from 'react-native-worklets';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '../lib/supabase';
import { fetchFollowList } from '../shared/follows';
import { S } from '../shared/strings';
import { C } from '../shared/theme';
import Avatar from './Avatar';

const SCREEN_HEIGHT = Dimensions.get('window').height;

// Followers / following list as a slide-up modal. `mode` is 'followers' | 'following'.
export default function FollowListScreen({ visible, userId, mode, onClose, onOpenProfile }) {
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(true);
  const [profiles, setProfiles] = useState([]);

  // Swipe-down-to-dismiss. We translate the whole sheet, but only when the list
  // is already at the top and the drag is downward — otherwise the gesture stays
  // out of the way and the list scrolls normally.
  const scrollRef = useRef(null);
  const scrollY = useSharedValue(0);
  const translateY = useSharedValue(0);

  // Reset position whenever the sheet (re)opens.
  useEffect(() => {
    if (visible) translateY.value = 0;
  }, [visible]);

  const scrollHandler = useAnimatedScrollHandler((e) => {
    scrollY.value = e.contentOffset.y;
  });

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
          if (finished) runOnJS(onClose)();
        });
      } else {
        translateY.value = withSpring(0);
      }
    });

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

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
      <GestureHandlerRootView style={styles.root}>
      <GestureDetector gesture={dismissGesture}>
      <Animated.View style={[styles.container, { paddingTop: insets.top + 12 }, animStyle]}>
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} hitSlop={8} style={styles.back}>
            <Ionicons name="chevron-down" size={26} color={C.ink} />
          </TouchableOpacity>
          <Text style={styles.title}>{title}</Text>
        </View>
        {loading ? (
          <View style={styles.centered}><ActivityIndicator color="#999" /></View>
        ) : profiles.length === 0 ? (
          <View style={styles.centered}><Text style={styles.empty}>{empty}</Text></View>
        ) : (
          <Animated.FlatList
            ref={scrollRef}
            onScroll={scrollHandler}
            scrollEventThrottle={16}
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
      </Animated.View>
      </GestureDetector>
      </GestureHandlerRootView>
    </Modal>
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
