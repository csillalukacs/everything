import { StatusBar } from 'expo-status-bar';
import { readAsStringAsync, EncodingType } from 'expo-file-system/legacy';
import { decode } from 'base64-arraybuffer';
import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  FlatList,
  Image,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { supabase } from './lib/supabase';
import AuthScreen from './screens/AuthScreen';
import AddItemModal from './screens/AddItemModal';
import ItemDetailModal from './screens/ItemDetailModal';
import CanvasScreen from './screens/CanvasScreen';
import BatchTagSheet from './screens/BatchTagSheet';

const SCREEN_WIDTH = Dimensions.get('window').width;
const GRID_CARD_SIZE = (SCREEN_WIDTH - 48 - 12) / 2;

export default function App() {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState([]);
  const [tags, setTags] = useState([]);
  const [activeTag, setActiveTag] = useState(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [canvasVisible, setCanvasVisible] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [batchTagVisible, setBatchTagVisible] = useState(false);
  const [batchTagging, setBatchTagging] = useState(false);
  const [manageTagsVisible, setManageTagsVisible] = useState(false);

  const batchMode = selectedIds.size > 0;

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (session) {
      fetchItems();
      fetchTags();
    } else {
      setItems([]);
      setTags([]);
    }
  }, [session]);

  async function fetchItems() {
    const { data, error } = await supabase
      .from('items')
      .select('*, tags(id, name, is_private)')
      .order('created_at', { ascending: false });
    if (!error) setItems(data);
  }

  async function fetchTags() {
    const { data, error } = await supabase
      .from('tags')
      .select('*')
      .order('name');
    if (!error) setTags(data);
  }

  async function ensureTags(tagNames) {
    const lowered = [...new Set(tagNames.map(n => n.trim().toLowerCase()).filter(Boolean))];
    if (lowered.length === 0) return [];

    const byName = new Map(tags.map(t => [t.name, t]));
    const newNames = lowered.filter(n => !byName.has(n));

    let created = [];
    if (newNames.length > 0) {
      const { data, error } = await supabase
        .from('tags')
        .insert(newNames.map(name => ({ name, user_id: session.user.id })))
        .select();
      if (error) { console.error('Tag insert error:', error); return null; }
      created = data;
      setTags(prev => [...prev, ...created]);
      created.forEach(t => byName.set(t.name, t));
    }

    return lowered.map(n => byName.get(n));
  }

  async function setItemTags(itemId, tagIds) {
    await supabase.from('item_tags').delete().eq('item_id', itemId);
    if (tagIds.length === 0) return;
    await supabase.from('item_tags').insert(tagIds.map(tag_id => ({ item_id: itemId, tag_id })));
  }

  async function handleUpdate(name, photoUri, tagNames, isPrivate) {
    let image_url = photoUri;

    if (!photoUri.startsWith('http')) {
      const ext = photoUri.split('.').pop();
      const path = `${session.user.id}/${Date.now()}.${ext}`;
      const base64 = await readAsStringAsync(photoUri, { encoding: EncodingType.Base64 });
      const { error: uploadError } = await supabase.storage
        .from('item-images')
        .upload(path, decode(base64), { contentType: `image/${ext}` });
      if (uploadError) { console.error('Upload error:', uploadError); return; }
      const { data: { publicUrl } } = supabase.storage.from('item-images').getPublicUrl(path);
      image_url = publicUrl;
    }

    const { data, error } = await supabase
      .from('items')
      .update({ name: name || null, image_url, is_private: isPrivate ?? false })
      .eq('id', selectedItem.id)
      .select()
      .single();

    if (error) return;

    const resolved = await ensureTags(tagNames);
    if (!resolved) return;
    await setItemTags(data.id, resolved.map(t => t.id));

    const updated = { ...data, tags: resolved };
    setItems(prev => prev.map(i => i.id === updated.id ? updated : i));
    setSelectedItem(updated);
  }

  async function handleSave(name, photoUri, tagNames, isPrivate) {
    const ext = photoUri.split('.').pop();
    const path = `${session.user.id}/${Date.now()}.${ext}`;

    const base64 = await readAsStringAsync(photoUri, { encoding: EncodingType.Base64 });

    const { error: uploadError } = await supabase.storage
      .from('item-images')
      .upload(path, decode(base64), { contentType: `image/${ext}` });

    if (uploadError) {
      console.error('Upload error:', uploadError);
      return;
    }

    const { data: { publicUrl } } = supabase.storage
      .from('item-images')
      .getPublicUrl(path);

    const { data, error } = await supabase
      .from('items')
      .insert({ name: name || null, image_url: publicUrl, is_private: isPrivate ?? false })
      .select()
      .single();

    if (error) return;

    const resolved = await ensureTags(tagNames);
    if (!resolved) return;
    await setItemTags(data.id, resolved.map(t => t.id));

    setItems([{ ...data, tags: resolved }, ...items]);
    setModalVisible(false);
  }

  async function handleDelete() {
    const itemToDelete = selectedItem;
    setSelectedItem(null);
    const { error } = await supabase
      .from('items')
      .delete()
      .eq('id', itemToDelete.id);
    if (!error) setItems(prev => prev.filter(i => i.id !== itemToDelete.id));
  }

  function toggleBatchSelect(itemId) {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(itemId)) next.delete(itemId);
      else next.add(itemId);
      return next;
    });
  }

  async function handleDeleteTag(tag) {
    await supabase.from('item_tags').delete().eq('tag_id', tag.id);
    const { error } = await supabase.from('tags').delete().eq('id', tag.id);
    if (!error) {
      setTags(prev => prev.filter(t => t.id !== tag.id));
      setItems(prev => prev.map(i => ({ ...i, tags: (i.tags ?? []).filter(t => t.id !== tag.id) })));
      if (activeTag?.id === tag.id) setActiveTag(null);
    }
  }

  async function handleToggleTagPrivacy(tag) {
    const newPrivate = !tag.is_private;
    const { error } = await supabase.from('tags').update({ is_private: newPrivate }).eq('id', tag.id);
    if (!error) setTags(prev => prev.map(t => t.id === tag.id ? { ...t, is_private: newPrivate } : t));
  }

  async function handleBatchTag(tagNames) {
    if (tagNames.length === 0) {
      setBatchTagVisible(false);
      return;
    }
    setBatchTagging(true);
    const resolved = await ensureTags(tagNames);
    if (!resolved) { setBatchTagging(false); return; }
    const newTagIds = resolved.map(t => t.id);
    for (const itemId of selectedIds) {
      const item = items.find(i => i.id === itemId);
      const existingIds = (item?.tags ?? []).map(t => t.id);
      await setItemTags(itemId, [...new Set([...existingIds, ...newTagIds])]);
    }
    await fetchItems();
    setBatchTagging(false);
    setBatchTagVisible(false);
    setSelectedIds(new Set());
  }

  async function handleBatchDelete() {
    const ids = [...selectedIds];
    setSelectedIds(new Set());
    await supabase.from('item_tags').delete().in('item_id', ids);
    const { error } = await supabase.from('items').delete().in('id', ids);
    if (!error) setItems(prev => prev.filter(i => !ids.includes(i.id)));
  }

  async function handleBatchTogglePrivacy() {
    const ids = [...selectedIds];
    const allPrivate = ids.every(id => items.find(i => i.id === id)?.is_private);
    const newPrivate = !allPrivate;
    await supabase.from('items').update({ is_private: newPrivate }).in('id', ids);
    setItems(prev => prev.map(i => ids.includes(i.id) ? { ...i, is_private: newPrivate } : i));
  }

  const allTagObjects = tags;

  const filteredItems = activeTag
    ? activeTag.id === '__untagged__'
      ? items.filter(i => (i.tags ?? []).length === 0)
      : items.filter(i => (i.tags ?? []).some(t => t.id === activeTag.id))
    : items;

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color="#999" />
      </View>
    );
  }

  if (!session) {
    return <AuthScreen />;
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>everything</Text>
          <Text style={styles.subtitle}>a home for your stuff</Text>
        </View>
        <View style={{ flexDirection: 'row', gap: 16, alignItems: 'center' }}>
          <TouchableOpacity onPress={() => setCanvasVisible(true)}>
            <Text style={styles.logout}>canvas</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => supabase.auth.signOut()}>
            <Text style={styles.logout}>log out</Text>
          </TouchableOpacity>
        </View>
      </View>

      {tags.length > 0 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.filterScroll}
          contentContainerStyle={styles.filterScrollContent}
        >
          <TouchableOpacity
            style={[styles.filterChip, !activeTag && styles.filterChipActive]}
            onPress={() => setActiveTag(null)}
          >
            <Text style={[styles.filterChipText, !activeTag && styles.filterChipTextActive]}>all</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.filterChip, activeTag?.id === '__untagged__' && styles.filterChipActive]}
            onPress={() => setActiveTag(activeTag?.id === '__untagged__' ? null : { id: '__untagged__' })}
          >
            <Text style={[styles.filterChipText, activeTag?.id === '__untagged__' && styles.filterChipTextActive]}>untagged</Text>
          </TouchableOpacity>
          {tags.map(tag => {
            const active = activeTag?.id === tag.id;
            return (
              <TouchableOpacity
                key={tag.id}
                style={[styles.filterChip, active && styles.filterChipActive]}
                onPress={() => setActiveTag(active ? null : tag)}
              >
                {tag.is_private && <Ionicons name="lock-closed" size={10} color={active ? '#fff' : '#ccc'} />}
                <Text style={[styles.filterChipText, active && styles.filterChipTextActive]}>{tag.name}</Text>
              </TouchableOpacity>
            );
          })}
          <TouchableOpacity
            style={[styles.filterChip, styles.filterChipDashed]}
            onPress={() => setManageTagsVisible(true)}
          >
            <Text style={styles.filterChipText}>manage</Text>
          </TouchableOpacity>
        </ScrollView>
      )}

      <FlatList
        data={filteredItems}
        keyExtractor={(item) => item.id}
        numColumns={2}
        columnWrapperStyle={styles.row}
        contentContainerStyle={styles.listContent}
        style={styles.list}
        renderItem={({ item }) => {
          const isSelected = selectedIds.has(item.id);
          return (
            <TouchableOpacity
              style={[styles.card, isSelected && styles.cardSelected]}
              onPress={() => {
                if (batchMode) {
                  toggleBatchSelect(item.id);
                } else {
                  setSelectedItem(item);
                }
              }}
              onLongPress={() => toggleBatchSelect(item.id)}
              delayLongPress={400}
            >
              {item.image_url && (
                <View style={styles.cardImageContainer}>
                  <Image source={{ uri: item.image_url }} style={styles.cardImage} />
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

      {batchMode ? (
        <View style={styles.batchBar}>
          <TouchableOpacity onPress={() => setSelectedIds(new Set())} style={styles.batchBarBtn}>
            <Text style={styles.batchBarCancelText}>cancel</Text>
          </TouchableOpacity>
          <Text style={styles.batchBarCount}>{selectedIds.size} selected</Text>
          <View style={styles.batchBarActions}>
            <TouchableOpacity onPress={handleBatchTogglePrivacy} style={styles.batchBarIcon}>
              <Ionicons
                name={[...selectedIds].every(id => items.find(i => i.id === id)?.is_private) ? 'lock-closed' : 'lock-open-outline'}
                size={18}
                color="#fff"
              />
            </TouchableOpacity>
            <TouchableOpacity onPress={handleBatchDelete} style={styles.batchBarIcon}>
              <Ionicons name="trash-outline" size={18} color="#ff6b6b" />
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setBatchTagVisible(true)} style={styles.batchBarBtn}>
              <Text style={styles.batchBarTagText}>tag</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        <TouchableOpacity style={styles.fab} onPress={() => setModalVisible(true)}>
          <Text style={styles.fabText}>+</Text>
        </TouchableOpacity>
      )}

      <AddItemModal
        visible={modalVisible}
        onClose={() => setModalVisible(false)}
        onSave={handleSave}
        allTags={allTagObjects}
      />

      <CanvasScreen
        visible={canvasVisible}
        onClose={() => setCanvasVisible(false)}
        items={items}
      />

      <ItemDetailModal
        visible={!!selectedItem}
        item={selectedItem}
        onClose={() => setSelectedItem(null)}
        onDelete={handleDelete}
        onSave={handleUpdate}
        allTags={allTagObjects}
        onPrev={(() => { const idx = filteredItems.findIndex(i => i.id === selectedItem?.id); return idx > 0 ? () => setSelectedItem(filteredItems[idx - 1]) : null; })()}
        onNext={(() => { const idx = filteredItems.findIndex(i => i.id === selectedItem?.id); return idx < filteredItems.length - 1 ? () => setSelectedItem(filteredItems[idx + 1]) : null; })()}
      />

      <BatchTagSheet
        visible={batchTagVisible}
        onClose={() => setBatchTagVisible(false)}
        onApply={handleBatchTag}
        allTags={allTagObjects}
        selectedCount={selectedIds.size}
        loading={batchTagging}
      />

      <Modal
        visible={manageTagsVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setManageTagsVisible(false)}
      >
        <TouchableOpacity style={styles.manageOverlay} activeOpacity={1} onPress={() => setManageTagsVisible(false)}>
          <TouchableOpacity style={styles.manageSheet} activeOpacity={1} onPress={() => {}}>
            <View style={styles.manageHeader}>
              <Text style={styles.manageTitle}>manage tags</Text>
              <TouchableOpacity onPress={() => setManageTagsVisible(false)}>
                <Text style={styles.manageDone}>done</Text>
              </TouchableOpacity>
            </View>
            <ScrollView>
              {tags.map((tag, i) => (
                <View key={tag.id} style={[styles.manageRow, i < tags.length - 1 && styles.manageRowBorder]}>
                  <Text style={styles.manageTagName}>{tag.name}</Text>
                  <View style={styles.manageActions}>
                    <TouchableOpacity onPress={() => handleToggleTagPrivacy(tag)} style={styles.manageLockBtn}>
                      <Ionicons
                        name={tag.is_private ? 'lock-closed' : 'lock-open-outline'}
                        size={16}
                        color={tag.is_private ? '#2D2D2D' : '#ccc'}
                      />
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => handleDeleteTag(tag)}>
                      <Text style={styles.manageDeleteBtn}>delete</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ))}
            </ScrollView>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      <StatusBar style="dark" />
    </View>
  );
}

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    backgroundColor: '#F5F0EB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  container: {
    flex: 1,
    backgroundColor: '#F5F0EB',
    paddingTop: 80,
    paddingHorizontal: 24,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 20,
  },
  title: {
    fontSize: 40,
    fontWeight: '300',
    letterSpacing: 2,
    color: '#2D2D2D',
  },
  subtitle: {
    fontSize: 14,
    color: '#999',
    marginTop: 8,
    letterSpacing: 1,
  },
  logout: {
    fontSize: 14,
    color: '#999',
    marginTop: 8,
  },
  filterScroll: {
    flexGrow: 0,
    flexShrink: 0,
    marginBottom: 20,
  },
  filterScrollContent: {
    gap: 8,
    paddingVertical: 2,
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
  filterChipDashed: {
    borderStyle: 'dashed',
  },
  manageOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  manageSheet: {
    backgroundColor: '#F5F0EB',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 24,
    maxHeight: '70%',
  },
  manageHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  manageTitle: {
    fontSize: 15,
    fontWeight: '500',
    color: '#2D2D2D',
  },
  manageDone: {
    fontSize: 15,
    color: '#999',
  },
  manageRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
  },
  manageRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: '#E8E3DD',
  },
  manageTagName: {
    fontSize: 15,
    color: '#2D2D2D',
  },
  manageActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  manageLockBtn: {
    padding: 2,
  },
  manageDeleteBtn: {
    fontSize: 13,
    color: '#E74C3C',
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
  list: {
    flex: 1,
  },
  listContent: {
    justifyContent: 'flex-start',
  },
  row: {
    gap: 12,
    marginBottom: 12,
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
  fab: {
    position: 'absolute',
    bottom: 40,
    right: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#2D2D2D',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  fabText: {
    color: '#fff',
    fontSize: 28,
    lineHeight: 32,
  },
  batchBar: {
    position: 'absolute',
    bottom: 40,
    left: 24,
    right: 24,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#2D2D2D',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  batchBarBtn: {
    padding: 8,
    minWidth: 56,
  },
  batchBarCancelText: {
    color: '#aaa',
    fontSize: 15,
  },
  batchBarCount: {
    color: '#fff',
    fontSize: 14,
  },
  batchBarActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  batchBarIcon: {
    padding: 8,
  },
  batchBarTagText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '500',
    textAlign: 'right',
  },
});
