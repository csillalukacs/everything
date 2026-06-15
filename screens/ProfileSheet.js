import { useRef } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import BottomSheet from './BottomSheet';
import Avatar from './Avatar';
import { S } from '../shared/strings';
import { C } from '../shared/theme';

// The sheet that opens when you tap a profile picture (yours or someone else's).
// Home for follower/following counts + the follow / report / block actions.
export default function ProfileSheet({
  visible,
  onClose,
  profile,
  counts = { followers: 0, following: 0 },
  isOwn,
  isFollowing,
  isBlocked,
  onToggleFollow,
  onReport,
  onBlock,
  onUnblock,
  onSettings,
  onShowFollows,
}) {
  const name = profile?.display_name || (profile?.username ? `@${profile.username}` : 'someone');

  // Close this sheet first, then run the action only after the sheet's modal has
  // fully unmounted (via onClosed). Presenting another modal while this one is still
  // dismissing leaves iOS with a stuck modal (nothing opens, page goes unresponsive).
  const pendingRef = useRef(null);
  function run(action) {
    pendingRef.current = action || null;
    onClose();
  }

  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      onClosed={() => { const action = pendingRef.current; pendingRef.current = null; if (action) action(); }}
      sheetStyle={styles.sheet}
    >
      <View style={styles.head}>
        <Avatar profile={profile ?? {}} size={64} />
        <View style={styles.headText}>
          <Text style={styles.name} numberOfLines={1}>{name}</Text>
          {profile?.username && profile?.display_name && (
            <Text style={styles.handle} numberOfLines={1}>@{profile.username}</Text>
          )}
        </View>
      </View>

      <View style={styles.countsRow}>
        <TouchableOpacity style={styles.countItem} onPress={() => run(() => onShowFollows('followers'))} activeOpacity={0.7}>
          <Text style={styles.countNum}>{counts.followers}</Text>
          <Text style={styles.countLabel}>{S.social.followersTitle}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.countItem} onPress={() => run(() => onShowFollows('following'))} activeOpacity={0.7}>
          <Text style={styles.countNum}>{counts.following}</Text>
          <Text style={styles.countLabel}>{S.social.followingTitle}</Text>
        </TouchableOpacity>
      </View>

      {isOwn ? (
        <TouchableOpacity style={styles.outlineBtn} onPress={() => run(onSettings)} activeOpacity={0.8}>
          <Text style={styles.outlineBtnText}>{S.profile.settings}</Text>
        </TouchableOpacity>
      ) : isBlocked ? (
        <TouchableOpacity style={styles.outlineBtn} onPress={() => run(onUnblock)} activeOpacity={0.8}>
          <Text style={styles.outlineBtnText}>{S.moderation.unblock}</Text>
        </TouchableOpacity>
      ) : (
        <>
          <TouchableOpacity
            style={[styles.primaryBtn, isFollowing && styles.outlineBtn]}
            onPress={onToggleFollow}
            activeOpacity={0.8}
          >
            <Text style={[styles.primaryBtnText, isFollowing && styles.outlineBtnText]}>
              {isFollowing ? S.social.following : S.social.follow}
            </Text>
          </TouchableOpacity>
          <View style={styles.modRow}>
            <TouchableOpacity onPress={() => run(onReport)} hitSlop={6}>
              <Text style={styles.modText}>{S.moderation.report}</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => run(onBlock)} hitSlop={6}>
              <Text style={[styles.modText, styles.modDanger]}>{S.moderation.block}</Text>
            </TouchableOpacity>
          </View>
        </>
      )}
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  sheet: {
    backgroundColor: C.bg,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 20,
    paddingBottom: 36,
    paddingHorizontal: 24,
  },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  headText: {
    flex: 1,
  },
  name: {
    fontSize: 20,
    fontWeight: '500',
    color: C.ink,
  },
  handle: {
    fontSize: 14,
    color: '#999',
    marginTop: 2,
  },
  countsRow: {
    flexDirection: 'row',
    gap: 32,
    marginTop: 20,
    marginBottom: 20,
  },
  countItem: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 5,
  },
  countNum: {
    fontSize: 16,
    fontWeight: '600',
    color: C.ink,
  },
  countLabel: {
    fontSize: 14,
    color: '#999',
  },
  primaryBtn: {
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
    backgroundColor: C.ink,
    borderWidth: 1.5,
    borderColor: C.ink,
  },
  primaryBtnText: {
    fontSize: 15,
    fontWeight: '500',
    color: '#fff',
  },
  outlineBtn: {
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
    backgroundColor: '#fff',
    borderWidth: 1.5,
    borderColor: C.ink,
  },
  outlineBtnText: {
    fontSize: 15,
    fontWeight: '500',
    color: C.ink,
  },
  modRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 32,
    marginTop: 16,
  },
  modText: {
    fontSize: 14,
    color: '#999',
  },
  modDanger: {
    color: C.red,
  },
});
