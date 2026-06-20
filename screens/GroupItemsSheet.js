import { useCallback, useEffect, useRef, useState } from 'react';
import { Image } from 'expo-image';
import { Dimensions, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { thumbOf } from '../shared/items';
import { C } from '../shared/theme';
import BottomSheet from './BottomSheet';

const SCREEN = Dimensions.get('window');
const LIST_MAX_HEIGHT = SCREEN.height * 0.6;
const COLS = 3;
const GAP = 8;
const H_PADDING = 20;
const TILE = Math.floor((SCREEN.width - H_PADDING * 2 - GAP * (COLS - 1)) / COLS);

// The full list behind a collapsed feed/notification row's photo stack — a grid
// of thumbnails. Tapping one closes the sheet, then (once it has fully unmounted)
// calls `onItemPress` so the parent can open that item without overlapping modals.
export default function GroupItemsSheet({ visible, onClose, title, items = [], onItemPress }) {
  const pendingItem = useRef(null);
  // Hold the last content so the grid doesn't blank out mid close animation when
  // the parent clears its `moreGroup` state.
  const [shown, setShown] = useState({ title, items });

  useEffect(() => {
    if (visible) setShown({ title, items });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const handleItemPress = useCallback((item) => {
    pendingItem.current = item;
    onClose?.();
  }, [onClose]);

  const handleClosed = useCallback(() => {
    const item = pendingItem.current;
    pendingItem.current = null;
    if (item) onItemPress?.(item);
  }, [onItemPress]);

  return (
    <BottomSheet visible={visible} onClose={onClose} onClosed={handleClosed} sheetStyle={styles.sheet}>
      {shown.title ? <Text style={styles.title}>{shown.title}</Text> : null}
      <ScrollView showsVerticalScrollIndicator={false} style={styles.list}>
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
      </ScrollView>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  sheet: {
    backgroundColor: C.bg,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: H_PADDING,
    paddingBottom: 32,
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
