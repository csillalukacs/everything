import { Image } from 'expo-image';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { C } from '../shared/theme';

// A left-anchored fan of thumbnails for a collapsed feed/notification row. Thumbs
// fan out to the right with the "+N" chip last (right end). When `onPress` is
// given the whole stack is tappable (opens the full-list modal); otherwise the
// enclosing row owns the press.
//
// `total` is the real item count when it exceeds the thumbnails passed in (some
// items may lack a thumb); it drives the "+N" so the modal count stays honest.
export default function PhotoStack({ thumbs, total, size = 56, max = 3, onPress }) {
  const shown = thumbs.slice(0, max);
  const overflow = (total ?? thumbs.length) - shown.length;
  const offset = Math.round(size * 0.3);
  const layers = shown.length + (overflow > 0 ? 1 : 0);
  const cell = { width: size, height: size, borderRadius: Math.round(size / 6) };
  const containerStyle = { height: size, width: size + (layers - 1) * offset, position: 'relative' };

  const content = (
    <>
      {shown.map((uri, i) => (
        <Image
          key={uri + i}
          source={{ uri }}
          style={[styles.cell, cell, { left: i * offset, zIndex: i }]}
          contentFit="cover"
          cachePolicy="memory-disk"
        />
      ))}
      {overflow > 0 && (
        <View style={[styles.cell, styles.more, cell, { left: shown.length * offset, zIndex: layers }]}>
          <Text style={styles.moreText}>+{overflow}</Text>
        </View>
      )}
    </>
  );

  if (onPress) {
    return (
      <TouchableOpacity style={containerStyle} onPress={onPress} activeOpacity={0.8}>
        {content}
      </TouchableOpacity>
    );
  }
  return <View style={containerStyle}>{content}</View>;
}

const styles = StyleSheet.create({
  cell: {
    position: 'absolute',
    top: 0,
  },
  more: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: C.surface,
  },
  moreText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#777',
  },
});
