import { Ionicons } from '@expo/vector-icons';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { S } from '../shared/strings';
import { isFeaturedTag, sortTagsFeaturedFirst } from '../shared/featuredTag';

export default function TagFilterChips({
  tags,
  activeTag,
  onChangeActiveTag,
  totalCount,
  untaggedCount,
  tagCounts,
  onManagePress,
}) {
  if (tags.length === 0) return null;
  const isUntagged = activeTag?.id === '__untagged__';
  const orderedTags = sortTagsFeaturedFirst(tags);
  const renderTagChip = (tag) => {
    const active = activeTag?.id === tag.id;
    const featured = isFeaturedTag(tag);
    return (
      <TouchableOpacity
        key={tag.id}
        style={[styles.filterChip, active && styles.filterChipActive]}
        onPress={() => onChangeActiveTag(active ? null : tag)}
      >
        {featured && <Ionicons name="star" size={12} color="#F5C518" />}
        {tag.is_private && !featured && <Ionicons name="lock-closed" size={10} color={active ? '#fff' : '#ccc'} />}
        <Text style={[styles.filterChipText, active && styles.filterChipTextActive]}>{tag.name}</Text>
        <Text style={[styles.filterChipCount, active && styles.filterChipCountActive]}>{tagCounts.get(tag.id) ?? 0}</Text>
      </TouchableOpacity>
    );
  };
  const featuredTag = orderedTags.find(isFeaturedTag);
  const otherTags = orderedTags.filter(t => !isFeaturedTag(t));
  return (
    <View style={styles.filterRow}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.filterScroll}
        contentContainerStyle={styles.filterScrollContent}
      >
        {featuredTag && renderTagChip(featuredTag)}
        <TouchableOpacity
          style={[styles.filterChip, !activeTag && styles.filterChipActive]}
          onPress={() => onChangeActiveTag(null)}
        >
          <Text style={[styles.filterChipText, !activeTag && styles.filterChipTextActive]}>{S.common.all}</Text>
          <Text style={[styles.filterChipCount, !activeTag && styles.filterChipCountActive]}>{totalCount}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.filterChip, isUntagged && styles.filterChipActive]}
          onPress={() => onChangeActiveTag(isUntagged ? null : { id: '__untagged__' })}
        >
          <Text style={[styles.filterChipText, isUntagged && styles.filterChipTextActive]}>{S.collection.untagged}</Text>
          <Text style={[styles.filterChipCount, isUntagged && styles.filterChipCountActive]}>{untaggedCount}</Text>
        </TouchableOpacity>
        {otherTags.map(renderTagChip)}
      </ScrollView>
      {onManagePress && (
        <TouchableOpacity
          style={[styles.filterChip, styles.filterManageBtn]}
          onPress={onManagePress}
          accessibilityLabel={S.common.manage}
        >
          <Ionicons name="settings-outline" size={18} color="#999" />
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  filterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 20,
  },
  filterScroll: {
    flex: 1,
    flexGrow: 1,
    flexShrink: 1,
  },
  filterScrollContent: {
    gap: 8,
    paddingVertical: 2,
  },
  filterManageBtn: {
    flexShrink: 0,
    borderWidth: 0,
    backgroundColor: 'transparent',
    paddingHorizontal: 6,
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    height: 34,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: '#E0E0E0',
    backgroundColor: '#fff',
  },
  filterChipActive: {
    backgroundColor: '#2D2D2D',
    borderColor: '#2D2D2D',
  },
  filterChipText: {
    fontSize: 13,
    color: '#999',
  },
  filterChipTextActive: {
    color: '#fff',
  },
  filterChipCount: {
    fontSize: 11,
    color: '#bbb',
    marginLeft: 2,
  },
  filterChipCountActive: {
    color: '#bbb',
  },
});
