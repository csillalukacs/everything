import { Ionicons } from '@expo/vector-icons';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Image } from 'expo-image';
import { S } from '../shared/strings';

export default function PhotoStrip({ photos, selectedIdx, onSelect, editable, onRemove }) {
  const displayedEntry = photos[selectedIdx] ?? {};
  const displayedDate = displayedEntry.added_at;
  const hasMultiple = photos.filter(p => p?.url).length > 1;
  if (!hasMultiple && !displayedDate) return null;

  return (
    <View style={styles.photoExtras}>
      {displayedDate ? (
        <Text style={styles.photoDate}>
          {S.itemForm.photoFrom(new Date(displayedDate).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }))}
        </Text>
      ) : null}
      {hasMultiple && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.thumbnailScroll}
          contentContainerStyle={styles.thumbnailRow}
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
                    <Ionicons name="close" size={14} color="#fff" />
                  </TouchableOpacity>
                )}
              </View>
            );
          })}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  photoExtras: {
    marginBottom: 16,
    marginTop: -8,
  },
  photoDate: {
    fontSize: 12,
    color: '#999',
    marginBottom: 8,
  },
  thumbnailScroll: {
    flexGrow: 0,
  },
  thumbnailRow: {
    gap: 8,
    paddingVertical: 4,
  },
  thumbnailWrap: {
    position: 'relative',
  },
  thumbnail: {
    width: 56,
    height: 56,
    borderRadius: 10,
    overflow: 'hidden',
    backgroundColor: '#E8E3DD',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  thumbnailSelected: {
    borderColor: '#2D2D2D',
  },
  thumbnailImage: {
    width: '100%',
    height: '100%',
  },
  thumbnailRemove: {
    position: 'absolute',
    top: -6,
    right: -6,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#2D2D2D',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
