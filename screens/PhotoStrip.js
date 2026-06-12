import { Ionicons } from '@expo/vector-icons';
import { ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { Image } from 'expo-image';

export default function PhotoStrip({ photos, selectedIdx, onSelect, editable, onRemove, style }) {
  const hasMultiple = photos.filter(p => p?.url).length > 1;
  if (!hasMultiple) return null;

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={[styles.container, style]}
      contentContainerStyle={styles.row}
    >
      {photos.map((entry, idx) => {
        if (!entry?.url) return null;
        const selected = idx === selectedIdx;
        const removable = editable && idx > 0;
        return (
          <View key={`${entry.url}-${idx}`} style={styles.thumbnailWrap}>
            <TouchableOpacity
              onPress={() => onSelect(idx)}
              style={[styles.thumbnail, selected && styles.thumbnailSelected]}
              activeOpacity={0.8}
            >
              <Image source={{ uri: entry.thumb_url || entry.url }} style={styles.thumbnailImage} cachePolicy="memory-disk" contentFit="cover" />
            </TouchableOpacity>
            {removable && (
              <TouchableOpacity
                onPress={() => onRemove(idx - 1)}
                style={styles.thumbnailRemove}
                hitSlop={6}
              >
                <Ionicons name="close" size={12} color="#fff" />
              </TouchableOpacity>
            )}
          </View>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 0,
  },
  row: {
    gap: 8,
    paddingHorizontal: 4,
    paddingVertical: 6,
    alignItems: 'center',
  },
  thumbnailWrap: {
    position: 'relative',
  },
  thumbnail: {
    width: 48,
    height: 48,
    borderRadius: 10,
    overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.6)',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  thumbnailSelected: {
    borderColor: '#fff',
  },
  thumbnailImage: {
    width: '100%',
    height: '100%',
  },
  thumbnailRemove: {
    position: 'absolute',
    top: -4,
    right: -4,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#2D2D2D',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
