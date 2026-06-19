import { useCallback, useEffect, useRef, useState } from 'react';
import { Image } from 'expo-image';
import { Dimensions, Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  useAnimatedScrollHandler,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { runOnJS } from 'react-native-worklets';
import { thumbOf } from '../shared/items';
import { C } from '../shared/theme';

const SCREEN = Dimensions.get('window');
const LIST_MAX_HEIGHT = SCREEN.height * 0.6;
const COLS = 3;
const GAP = 8;
const H_PADDING = 20;
const TILE = Math.floor((SCREEN.width - H_PADDING * 2 - GAP * (COLS - 1)) / COLS);

// The full list behind a collapsed feed/notification row's photo stack — a grid
// of thumbnails. Tapping one calls `onItemPress` (the parent opens that item).
// Swipe down (when the grid is scrolled to the top) or tap the backdrop to close.
export default function GroupItemsSheet({ visible, onClose, title, items = [], onItemPress }) {
  const [mounted, setMounted] = useState(visible);
  const scrollRef = useRef(null);
  const scrollY = useSharedValue(0);
  const translateY = useSharedValue(SCREEN.height);
  const backdrop = useSharedValue(0);
  // An item tapped while the sheet is open: we close first, then open it once this
  // Modal has fully unmounted, so the two Modals never transition at the same time
  // (which sticks on iOS — the "multiple modals" bug).
  const pendingItem = useRef(null);
  // Hold the last content so the grid doesn't blank out mid close animation when
  // the parent clears its `moreGroup` state.
  const [shown, setShown] = useState({ title, items });

  useEffect(() => {
    if (visible) {
      setShown({ title, items });
      setMounted(true);
      translateY.value = withTiming(0, { duration: 220 });
      backdrop.value = withTiming(1, { duration: 220 });
    } else if (mounted) {
      backdrop.value = withTiming(0, { duration: 200 });
      translateY.value = withTiming(SCREEN.height, { duration: 200 }, (finished) => {
        if (finished) runOnJS(setMounted)(false);
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  // Once fully closed, open any item that was tapped.
  useEffect(() => {
    if (!mounted && pendingItem.current) {
      const item = pendingItem.current;
      pendingItem.current = null;
      onItemPress?.(item);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mounted]);

  const handleItemPress = useCallback((item) => {
    pendingItem.current = item;
    onClose?.();
  }, [onClose]);

  const scrollHandler = useAnimatedScrollHandler((e) => {
    scrollY.value = e.contentOffset.y;
  });

  const close = useCallback(() => onClose?.(), [onClose]);

  // Translate the sheet only when the grid is at the top and the drag is downward,
  // so the gesture stays out of the way of normal list scrolling.
  const dismiss = Gesture.Pan()
    .simultaneousWithExternalGesture(scrollRef)
    .onUpdate((e) => {
      if (e.translationY > 0 && scrollY.value <= 0) translateY.value = e.translationY;
    })
    .onEnd((e) => {
      if (e.translationY > 120 && scrollY.value <= 0) {
        translateY.value = withTiming(SCREEN.height, { duration: 220 }, (finished) => {
          if (finished) runOnJS(close)();
        });
      } else {
        translateY.value = withSpring(0);
      }
    });

  const sheetStyle = useAnimatedStyle(() => ({ transform: [{ translateY: translateY.value }] }));
  const backdropStyle = useAnimatedStyle(() => ({ opacity: backdrop.value }));

  return (
    <Modal visible={mounted} transparent animationType="none" onRequestClose={close}>
      <GestureHandlerRootView style={styles.root}>
        <View style={styles.overlay}>
          <Animated.View style={[styles.backdrop, backdropStyle]} pointerEvents="none" />
          <TouchableOpacity style={styles.overlayTop} activeOpacity={1} onPress={close} />
          <GestureDetector gesture={dismiss}>
            <Animated.View style={[styles.sheet, sheetStyle]}>
              <View style={styles.handle} />
              {shown.title ? <Text style={styles.title}>{shown.title}</Text> : null}
              <Animated.ScrollView
                ref={scrollRef}
                onScroll={scrollHandler}
                scrollEventThrottle={16}
                showsVerticalScrollIndicator={false}
                style={styles.list}
              >
                <View style={styles.grid}>
                  {shown.items.map(item => {
                    const thumb = thumbOf(item);
                    return (
                      <TouchableOpacity
                        key={item.id}
                        activeOpacity={0.7}
                        onPress={() => handleItemPress(item)}
                      >
                        {thumb ? (
                          <Image source={{ uri: thumb }} style={styles.tile} contentFit="cover" cachePolicy="memory-disk" />
                        ) : (
                          <View style={styles.tile} />
                        )}
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </Animated.ScrollView>
            </Animated.View>
          </GestureDetector>
        </View>
      </GestureHandlerRootView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  overlayTop: {
    flex: 1,
  },
  sheet: {
    backgroundColor: C.bg,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: H_PADDING,
    paddingBottom: 32,
  },
  handle: {
    alignSelf: 'center',
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: C.line,
    marginTop: 10,
    marginBottom: 14,
  },
  title: {
    fontSize: 15,
    fontWeight: '600',
    color: C.ink,
    marginBottom: 12,
  },
  list: {
    flexGrow: 0,
    maxHeight: LIST_MAX_HEIGHT,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: GAP,
  },
  tile: {
    width: TILE,
    height: TILE,
    borderRadius: 8,
  },
});
