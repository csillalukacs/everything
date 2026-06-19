import { Image } from 'expo-image';
import { StyleSheet, Text, View } from 'react-native';
import { C } from '../shared/theme';

// A right-aligned fan of thumbnails for a collapsed feed/notification row. The
// first thumb sits on top; a "+N" chip stands in for any beyond `max`. Purely
// presentational — the enclosing row owns the press.
export default function PhotoStack({ thumbs, size = 72, max = 3 }) {
  const shown = thumbs.slice(0, max);
  const overflow = thumbs.length - shown.length;
  const offset = Math.round(size * 0.22);
  const layers = shown.length + (overflow > 0 ? 1 : 0);
  const cell = { width: size, height: size, borderRadius: Math.round(size / 6) };
  return (
    <View style={{ height: size, width: size + (layers - 1) * offset, position: 'relative' }}>
      {shown.map((uri, i) => (
        <Image
          key={uri + i}
          source={{ uri }}
          style={[styles.cell, cell, { right: i * offset, zIndex: max - i }]}
          contentFit="cover"
          cachePolicy="memory-disk"
        />
      ))}
      {overflow > 0 && (
        <View style={[styles.cell, styles.more, cell, { right: shown.length * offset }]}>
          <Text style={styles.moreText}>+{overflow}</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  cell: {
    position: 'absolute',
    top: 0,
    backgroundColor: C.surface,
    borderWidth: 2,
    borderColor: C.bg,
  },
  more: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  moreText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#777',
  },
});
