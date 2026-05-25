import { Ionicons } from '@expo/vector-icons';
import { memo, useCallback, useMemo } from 'react';
import { ActivityIndicator, Dimensions, FlatList, RefreshControl, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Image } from 'expo-image';
import { thumbOf } from '../shared/items';

const SCREEN_WIDTH = Dimensions.get('window').width;
const GRID_GAP = 8;
const EMPTY_SELECTION = new Set();

function cardSize(numColumns) {
  return (SCREEN_WIDTH - 48 - GRID_GAP * (numColumns - 1)) / numColumns;
}

const Card = memo(function Card({ item, size, isSelected, batchMode, onPress, onLongPress }) {
  return (
    <TouchableOpacity
      style={[styles.card, { width: size }, isSelected && styles.cardSelected]}
      onPress={() => onPress(item)}
      onLongPress={onLongPress ? () => onLongPress(item) : undefined}
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
});

export default function ItemGrid({
  items,
  selectedIds = EMPTY_SELECTION,
  onItemPress,
  onItemLongPress,
  refreshing,
  onRefresh,
  loading,
  paddingBottom,
  numColumns = 3,
  emptyText,
}) {
  const batchMode = selectedIds.size > 0;
  const size = cardSize(numColumns);
  const rowHeight = size + GRID_GAP;

  const keyExtractor = useCallback(item => item.id, []);

  const renderItem = useCallback(
    ({ item }) => (
      <Card
        item={item}
        size={size}
        isSelected={selectedIds.has(item.id)}
        batchMode={batchMode}
        onPress={onItemPress}
        onLongPress={onItemLongPress}
      />
    ),
    [size, selectedIds, batchMode, onItemPress, onItemLongPress]
  );

  const getItemLayout = useCallback(
    (_, index) => ({ length: rowHeight, offset: rowHeight * Math.floor(index / numColumns), index }),
    [rowHeight, numColumns]
  );

  const contentContainerStyle = useMemo(
    () => [styles.listContent, paddingBottom != null && { paddingBottom }, items.length === 0 && styles.listContentEmpty],
    [paddingBottom, items.length]
  );

  return (
    <FlatList
      data={items}
      keyExtractor={keyExtractor}
      numColumns={numColumns}
      columnWrapperStyle={items.length > 0 ? styles.row : undefined}
      contentContainerStyle={contentContainerStyle}
      style={styles.list}
      refreshControl={
        onRefresh ? <RefreshControl refreshing={!!refreshing} onRefresh={onRefresh} tintColor="#999" /> : undefined
      }
      ListEmptyComponent={
        loading ? (
          <View style={styles.listLoader}>
            <ActivityIndicator color="#999" />
          </View>
        ) : emptyText ? (
          <View style={styles.listLoader}>
            <Text style={styles.emptyText}>{emptyText}</Text>
          </View>
        ) : null
      }
      renderItem={renderItem}
      getItemLayout={getItemLayout}
      removeClippedSubviews
      initialNumToRender={numColumns * 6}
      maxToRenderPerBatch={numColumns * 4}
      windowSize={9}
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
  emptyText: {
    color: '#999',
    fontSize: 14,
  },
  row: {
    gap: GRID_GAP,
    marginBottom: GRID_GAP,
    justifyContent: 'flex-start',
    alignItems: 'flex-start',
  },
  card: {
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
  selectionCheck: {
    color: '#fff',
    fontSize: 14,
    lineHeight: 16,
    fontWeight: 'bold',
  },
});
