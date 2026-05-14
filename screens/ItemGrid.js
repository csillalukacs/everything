import { Ionicons } from '@expo/vector-icons';
import { ActivityIndicator, Dimensions, FlatList, RefreshControl, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Image } from 'expo-image';
import { thumbOf } from '../shared/items';

const SCREEN_WIDTH = Dimensions.get('window').width;
const GRID_GAP = 8;
const GRID_CARD_SIZE = (SCREEN_WIDTH - 48 - GRID_GAP * 2) / 3;

export default function ItemGrid({
  items,
  selectedIds,
  onItemPress,
  onItemLongPress,
  refreshing,
  onRefresh,
  loading,
  paddingBottom,
}) {
  const batchMode = selectedIds.size > 0;
  return (
    <FlatList
      data={items}
      keyExtractor={item => item.id}
      numColumns={3}
      columnWrapperStyle={items.length > 0 ? styles.row : undefined}
      contentContainerStyle={[styles.listContent, { paddingBottom }, items.length === 0 && styles.listContentEmpty]}
      style={styles.list}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#999" />
      }
      ListEmptyComponent={
        loading ? (
          <View style={styles.listLoader}>
            <ActivityIndicator color="#999" />
          </View>
        ) : null
      }
      renderItem={({ item }) => {
        const isSelected = selectedIds.has(item.id);
        return (
          <TouchableOpacity
            style={[styles.card, isSelected && styles.cardSelected]}
            onPress={() => onItemPress(item)}
            onLongPress={() => onItemLongPress(item)}
            delayLongPress={400}
          >
            {item.image_url && (
              <View style={styles.cardImageContainer}>
                <Image source={{ uri: thumbOf(item) }} style={styles.cardImage} recyclingKey={item.id} cachePolicy="memory-disk" contentFit="cover" />
              </View>
            )}
            {item.is_private && !batchMode && (
              <View style={styles.privateBadge}>
                <Ionicons name="lock-closed" size={10} color="#fff" />
              </View>
            )}
            {batchMode && (
              <View style={[styles.selectionCircle, isSelected && styles.selectionCircleActive]}>
                {isSelected && <Text style={styles.selectionCheck}>✓</Text>}
              </View>
            )}
          </TouchableOpacity>
        );
      }}
    />
  );
}

const styles = StyleSheet.create({
  list: {
    flex: 1,
  },
  listContent: {
    justifyContent: 'flex-start',
  },
  listContentEmpty: {
    flexGrow: 1,
  },
  listLoader: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 80,
  },
  row: {
    gap: GRID_GAP,
    marginBottom: GRID_GAP,
    justifyContent: 'flex-start',
    alignItems: 'flex-start',
  },
  card: {
    width: GRID_CARD_SIZE,
    backgroundColor: '#fff',
    borderRadius: 12,
    overflow: 'hidden',
  },
  cardSelected: {
    borderWidth: 2.5,
    borderColor: '#2D2D2D',
  },
  cardImageContainer: {
    width: '100%',
    aspectRatio: 1,
    backgroundColor: '#E8E3DD',
  },
  cardImage: {
    width: '100%',
    height: '100%',
  },
  privateBadge: {
    position: 'absolute',
    top: 8,
    left: 8,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  selectionCircle: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: '#fff',
    backgroundColor: 'rgba(0,0,0,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  selectionCircleActive: {
    backgroundColor: '#2D2D2D',
    borderColor: '#2D2D2D',
  },
  selectionCheck: {
    color: '#fff',
    fontSize: 14,
    lineHeight: 16,
    fontWeight: 'bold',
  },
});
