import { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text, TouchableOpacity } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useCollection } from '../lib/CollectionProvider';
import { S } from '../shared/strings';
import { C } from '../shared/theme';

// Transient bar shown after a delete; tapping "undo" restores the item(s).
// Reads the pending-delete state held in CollectionProvider so it can sit
// above every screen and react to deletes from any of them.
export default function DeleteSnackbar() {
  const { pendingDelete, undoDelete } = useCollection();
  const insets = useSafeAreaInsets();
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(anim, {
      toValue: pendingDelete ? 1 : 0,
      duration: 180,
      useNativeDriver: true,
    }).start();
  }, [pendingDelete, anim]);

  if (!pendingDelete) return null;

  const count = pendingDelete.items.length;
  const label = count === 1 ? S.undo.deleted : S.undo.deletedN(count);

  return (
    <Animated.View
      style={[
        styles.wrap,
        { bottom: insets.bottom + 96 },
        {
          opacity: anim,
          transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [12, 0] }) }],
        },
      ]}
      pointerEvents="box-none"
    >
      <Text style={styles.label}>{label}</Text>
      <TouchableOpacity onPress={undoDelete} hitSlop={8}>
        <Text style={styles.action}>{S.undo.action}</Text>
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: 24,
    right: 24,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: C.ink,
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 18,
  },
  label: {
    color: C.bg,
    fontSize: 15,
    letterSpacing: 0.3,
  },
  action: {
    color: C.yellow,
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
});
