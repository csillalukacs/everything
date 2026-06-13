import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, Dimensions, FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Image } from 'expo-image';
import BottomSheet from './BottomSheet';
import { useCollection } from '../lib/CollectionProvider';
import { supabase } from '../lib/supabase';
import { S } from '../shared/strings';
import { C } from '../shared/theme';

const SHEET_HEIGHT = Math.min(Dimensions.get('window').height * 0.7, 560);

export default function CollagesSheet({ visible, onClose, tag }) {
  const router = useRouter();
  const { deleteCollage } = useCollection();
  const [collages, setCollages] = useState([]);
  const [loading, setLoading] = useState(false);

  async function load() {
    if (!tag?.id) return;
    setLoading(true);
    const { data, error } = await supabase
      .from('collages')
      .select('id, title, cover_thumb_url, cover_url, is_private, updated_at')
      .eq('tag_id', tag.id)
      .order('updated_at', { ascending: false });
    if (!error) setCollages(data ?? []);
    setLoading(false);
  }

  useEffect(() => {
    if (visible) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, tag?.id]);

  function handleNew() {
    onClose();
    router.push({ pathname: '/canvas', params: { tagId: tag.id } });
  }

  function handleEdit(collage) {
    onClose();
    router.push({ pathname: '/canvas', params: { collageId: collage.id } });
  }

  function handleDelete(collage) {
    Alert.alert(
      S.collages.deleteConfirm(collage.title),
      undefined,
      [
        { text: S.common.cancel, style: 'cancel' },
        {
          text: S.collages.deleteConfirmAction,
          style: 'destructive',
          onPress: async () => {
            const ok = await deleteCollage(collage.id);
            if (ok) setCollages(prev => prev.filter(c => c.id !== collage.id));
          },
        },
      ],
    );
  }

  return (
    <BottomSheet visible={visible} onClose={onClose} sheetStyle={styles.sheet}>
      <View style={styles.header}>
        <Text style={styles.title}>{tag ? S.collages.titleForTag(tag.name) : S.collages.title}</Text>
        <TouchableOpacity onPress={onClose}>
          <Text style={styles.done}>{S.common.done}</Text>
        </TouchableOpacity>
      </View>

      <TouchableOpacity style={styles.newRow} onPress={handleNew}>
        <View style={styles.newBadge}>
          <Ionicons name="add" size={20} color={C.ink} />
        </View>
        <Text style={styles.newText}>{S.collages.newCollage}</Text>
      </TouchableOpacity>

      <FlatList
        style={styles.list}
        data={collages}
        keyExtractor={c => c.id}
        ListEmptyComponent={
          !loading ? <Text style={styles.empty}>{S.collages.empty}</Text> : null
        }
        renderItem={({ item }) => (
          <TouchableOpacity style={styles.row} onPress={() => handleEdit(item)} activeOpacity={0.7}>
            <View style={styles.coverWrap}>
              {item.cover_thumb_url || item.cover_url ? (
                <Image
                  source={{ uri: item.cover_thumb_url || item.cover_url }}
                  style={styles.cover}
                  cachePolicy="memory-disk"
                  contentFit="cover"
                />
              ) : (
                <View style={[styles.cover, styles.coverEmpty]} />
              )}
            </View>
            <View style={styles.rowMid}>
              <Text style={styles.rowTitle} numberOfLines={1}>
                {item.title || S.collages.untitled}
              </Text>
              {item.is_private && (
                <Ionicons name="lock-closed" size={12} color="#999" />
              )}
            </View>
            <TouchableOpacity onPress={() => handleDelete(item)} hitSlop={8} style={styles.deleteBtn}>
              <Ionicons name="trash-outline" size={18} color="#999" />
            </TouchableOpacity>
          </TouchableOpacity>
        )}
      />
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  sheet: {
    backgroundColor: C.bg,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 24,
    height: SHEET_HEIGHT,
    width: '100%',
    maxWidth: 480,
    alignSelf: 'center',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  title: {
    fontSize: 15,
    fontWeight: '500',
    color: C.ink,
  },
  done: {
    fontSize: 15,
    color: '#999',
  },
  newRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    marginBottom: 4,
  },
  newBadge: {
    width: 48,
    height: 48,
    borderRadius: 8,
    backgroundColor: '#fff',
    borderWidth: 1.5,
    borderColor: '#E0E0E0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  newText: {
    fontSize: 15,
    color: C.ink,
  },
  list: {
    flex: 1,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: C.surface,
  },
  coverWrap: {
    width: 48,
    height: 48,
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: '#fff',
  },
  cover: {
    width: '100%',
    height: '100%',
  },
  coverEmpty: {
    backgroundColor: C.surface,
  },
  rowMid: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  rowTitle: {
    fontSize: 15,
    color: C.ink,
    flexShrink: 1,
  },
  deleteBtn: {
    padding: 6,
  },
  empty: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
    paddingVertical: 24,
  },
});
