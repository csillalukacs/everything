import { StatusBar } from 'expo-status-bar';
import { readAsStringAsync, EncodingType } from 'expo-file-system/legacy';
import { decode } from 'base64-arraybuffer';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Linking from 'expo-linking';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  FlatList,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Image } from 'expo-image';
import { supabase } from './lib/supabase';
import AuthScreen from './screens/AuthScreen';
import AddItemModal from './screens/AddItemModal';
import ItemDetailModal from './screens/ItemDetailModal';
import CanvasScreen from './screens/CanvasScreen';
import BatchTagSheet from './screens/BatchTagSheet';
import ProfileScreen from './screens/ProfileScreen';
import ProfileViewScreen from './screens/ProfileViewScreen';
import OpenProfileSheet from './screens/OpenProfileSheet';

const SCREEN_WIDTH = Dimensions.get('window').width;
const GRID_CARD_SIZE = (SCREEN_WIDTH - 48 - 12) / 2;

const itemsCacheKey = userId => `cache:items:${userId}`;
const tagsCacheKey = userId => `cache:tags:${userId}`;

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
  const [manageTagsVisible, setManageTagsVisible] = useState(false);
  const [manageTagSearch, setManageTagSearch] = useState('');
  const [profileVisible, setProfileVisible] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [viewingSlug, setViewingSlug] = useState(null);
  const [openProfileVisible, setOpenProfileVisible] = useState(false);

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
    function handleUrl(url) {
      if (!url) return;
      const m = url.match(/\/u\/([^/?#\s]+)/i);
      if (m) setViewingSlug(decodeURIComponent(m[1]).toLowerCase());
    }
    Linking.getInitialURL().then(handleUrl);
    const sub = Linking.addEventListener('url', ({ url }) => handleUrl(url));
    return () => sub.remove();
  }, []);

  useEffect(() => {
    if (!session) {
      setItems([]);
      setTags([]);
      return;
    }
    let cancelled = false;
    (async () => {
      const [itemsStr, tagsStr] = await Promise.all([
        AsyncStorage.getItem(itemsCacheKey(session.user.id)),
        AsyncStorage.getItem(tagsCacheKey(session.user.id)),
      ]);
      if (cancelled) return;
      setItems(itemsStr ? JSON.parse(itemsStr) : []);
      setTags(tagsStr ? JSON.parse(tagsStr) : []);
      if (cancelled) return;
      fetchItems();
      fetchTags();
    })();
    return () => { cancelled = true; };
  }, [session]);

  useEffect(() => {
    if (!session) return;
    AsyncStorage.setItem(itemsCacheKey(session.user.id), JSON.stringify(items));
  }, [items, session]);

  useEffect(() => {
    if (!session) return;
    AsyncStorage.setItem(tagsCacheKey(session.user.id), JSON.stringify(tags));
  }, [tags, session]);

  async function fetchItems() {
    const { data, error } = await supabase
      .from('items')
      .select('*, tags(id, name, is_private)')
      .eq('user_id', session.user.id)
      .order('created_at', { ascending: false });
    if (!error) {
      setItems(data);
      const urls = data.map(i => i.image_url).filter(Boolean);
      if (urls.length) Image.prefetch(urls, { cachePolicy: 'memory-disk' });
    }
  }

  async function fetchTags() {
    const { data, error } = await supabase
      .from('tags')
      .select('*')
      .eq('user_id', session.user.id)
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

  async function handleUpdate(name, photoUri, tagNames, isPrivate, description) {
    let image_url = photoUri;

    if (!photoUri.startsWith('http')) {
      const ext = photoUri.split('.').pop();
      const path = `${session.user.id}/${Date.now()}.${ext}`;
      const base64 = await readAsStringAsync(photoUri, { encoding: EncodingType.Base64 });
      const { error: uploadError } = await supabase.storage
        .from('item-images')
        .upload(path, decode(base64), { contentType: `image/${ext}`, cacheControl: '31536000, immutable' });
      if (uploadError) { console.error('Upload error:', uploadError); return; }
      const { data: { publicUrl } } = supabase.storage.from('item-images').getPublicUrl(path);
      image_url = publicUrl;
    }

    const { data, error } = await supabase
      .from('items')
      .update({ name: name || null, description: description || null, image_url, is_private: isPrivate ?? false })
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
    if (!photoUri.startsWith('http')) Image.prefetch(image_url, { cachePolicy: 'memory-disk' });
  }

  async function handleSave(name, photoUri, tagNames, isPrivate, description) {
    const ext = photoUri.split('.').pop();
    const path = `${session.user.id}/${Date.now()}.${ext}`;

    const base64 = await readAsStringAsync(photoUri, { encoding: EncodingType.Base64 });

    const { error: uploadError } = await supabase.storage
      .from('item-images')
      .upload(path, decode(base64), { contentType: `image/${ext}`, cacheControl: '31536000, immutable' });

    if (uploadError) {
      console.error('Upload error:', uploadError);
      return;
    }

    const { data: { publicUrl } } = supabase.storage
      .from('item-images')
      .getPublicUrl(path);

    const { data, error } = await supabase
      .from('items')
      .insert({ name: name || null, description: description || null, image_url: publicUrl, is_private: isPrivate ?? false })
      .select()
      .single();

    if (error) return;

    const resolved = await ensureTags(tagNames);
    if (!resolved) return;
    await setItemTags(data.id, resolved.map(t => t.id));

    setItems([{ ...data, tags: resolved }, ...items]);
    Image.prefetch(publicUrl, { cachePolicy: 'memory-disk' });
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
    const resolved = await ensureTags(tagNames);
    if (!resolved) return;
    const ids = [...selectedIds];
    setItems(prev => prev.map(item => {
      if (!selectedIds.has(item.id)) return item;
      const existing = item.tags ?? [];
      const existingIds = new Set(existing.map(t => t.id));
      const merged = [...existing, ...resolved.filter(t => !existingIds.has(t.id))];
      return { ...item, tags: merged };
    }));
    setBatchTagVisible(false);
    setSelectedIds(new Set());
    const rows = ids.flatMap(item_id => resolved.map(t => ({ item_id, tag_id: t.id })));
    const { error } = await supabase
      .from('item_tags')
      .upsert(rows, { onConflict: 'item_id,tag_id', ignoreDuplicates: true });
    if (error) console.error('Batch tag error:', error);
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

  const query = searchQuery.trim().toLowerCase();
  const searchedItems = query
    ? items.filter(i => {
        const name = (i.name ?? '').toLowerCase();
        const desc = (i.description ?? '').toLowerCase();
        const tagNames = (i.tags ?? []).map(t => t.name.toLowerCase());
        return name.includes(query) || desc.includes(query) || tagNames.some(n => n.includes(query));
      })
    : items;

  const filteredItems = activeTag?.id === '__untagged__'
    ? searchedItems.filter(i => (i.tags ?? []).length === 0)
    : activeTag
      ? searchedItems.filter(i => (i.tags ?? []).some(t => t.id === activeTag.id))
      : searchedItems;

  const tagCounts = new Map();
  let untaggedCount = 0;
  for (const item of searchedItems) {
    const tagsArr = item.tags ?? [];
    if (tagsArr.length === 0) untaggedCount++;
    for (const t of tagsArr) tagCounts.set(t.id, (tagCounts.get(t.id) ?? 0) + 1);
  }

  const totalTagCounts = new Map();
  for (const item of items) {
    for (const t of (item.tags ?? [])) totalTagCounts.set(t.id, (totalTagCounts.get(t.id) ?? 0) + 1);
  }

  const manageQuery = manageTagSearch.trim().toLowerCase();
  const manageTagsList = (manageQuery
    ? tags.filter(t => t.name.toLowerCase().includes(manageQuery))
    : tags
  ).slice().sort((a, b) => a.name.localeCompare(b.name));

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
        <TouchableOpacity onPress={() => setProfileVisible(true)}>
          <Text style={styles.title}>everything</Text>
          <Text style={styles.subtitle}>{items.length} {items.length === 1 ? 'object' : 'objects'}</Text>
        </TouchableOpacity>
        <View style={styles.headerActions}>
          <TouchableOpacity onPress={() => setOpenProfileVisible(true)} style={styles.headerIconBtn}>
            <Ionicons name="person-circle-outline" size={22} color="#999" />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setCanvasVisible(true)}>
            <Text style={styles.logout}>canvas</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.searchContainer}>
        <Ionicons name="search" size={16} color="#999" />
        <TextInput
          style={styles.searchInput}
          placeholder="search"
          placeholderTextColor="#999"
          value={searchQuery}
          onChangeText={setSearchQuery}
          autoCorrect={false}
          autoCapitalize="none"
          returnKeyType="search"
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity onPress={() => setSearchQuery('')}>
            <Ionicons name="close-circle" size={16} color="#999" />
          </TouchableOpacity>
        )}
      </View>

      {tags.length > 0 && (
        <View style={styles.filterRow}>
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
            <Text style={[styles.filterChipCount, !activeTag && styles.filterChipCountActive]}>{searchedItems.length}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.filterChip, activeTag?.id === '__untagged__' && styles.filterChipActive]}
            onPress={() => setActiveTag(activeTag?.id === '__untagged__' ? null : { id: '__untagged__' })}
          >
            <Text style={[styles.filterChipText, activeTag?.id === '__untagged__' && styles.filterChipTextActive]}>untagged</Text>
            <Text style={[styles.filterChipCount, activeTag?.id === '__untagged__' && styles.filterChipCountActive]}>{untaggedCount}</Text>
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
                <Text style={[styles.filterChipCount, active && styles.filterChipCountActive]}>{tagCounts.get(tag.id) ?? 0}</Text>
              </TouchableOpacity>
            );
          })}
          </ScrollView>
          <TouchableOpacity
            style={[styles.filterChip, styles.filterChipDashed, styles.filterManageBtn]}
            onPress={() => setManageTagsVisible(true)}
          >
            <Text style={styles.filterChipText}>manage</Text>
          </TouchableOpacity>
        </View>
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
                  <Image source={{ uri: item.image_url }} style={styles.cardImage} recyclingKey={item.id} cachePolicy="memory-disk" contentFit="cover" />
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
      />

      <Modal
        visible={manageTagsVisible}
        animationType="slide"
        transparent
        onRequestClose={() => { setManageTagsVisible(false); setManageTagSearch(''); }}
      >
        <View style={styles.manageOverlay}>
          <TouchableOpacity style={styles.manageOverlayTop} activeOpacity={1} onPress={() => { setManageTagsVisible(false); setManageTagSearch(''); }} />
          <View style={styles.manageSheet}>
            <View style={styles.manageHeader}>
              <Text style={styles.manageTitle}>manage tags · {tags.length}</Text>
              <TouchableOpacity onPress={() => { setManageTagsVisible(false); setManageTagSearch(''); }}>
                <Text style={styles.manageDone}>done</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.manageSearchContainer}>
              <Ionicons name="search" size={16} color="#999" />
              <TextInput
                style={styles.manageSearchInput}
                placeholder="search tags"
                placeholderTextColor="#999"
                value={manageTagSearch}
                onChangeText={setManageTagSearch}
                autoCorrect={false}
                autoCapitalize="none"
              />
              {manageTagSearch.length > 0 && (
                <TouchableOpacity onPress={() => setManageTagSearch('')}>
                  <Ionicons name="close-circle" size={16} color="#999" />
                </TouchableOpacity>
              )}
            </View>
            <FlatList
              style={styles.manageList}
              data={manageTagsList}
              keyExtractor={tag => tag.id}
              keyboardShouldPersistTaps="handled"
              ListEmptyComponent={
                <Text style={styles.manageEmpty}>
                  {tags.length === 0 ? 'no tags yet' : 'no matches'}
                </Text>
              }
              renderItem={({ item: tag, index }) => (
                <View style={[styles.manageRow, index < manageTagsList.length - 1 && styles.manageRowBorder]}>
                  <View style={styles.manageTagInfo}>
                    <Text style={styles.manageTagName} numberOfLines={1}>{tag.name}</Text>
                    <Text style={styles.manageTagCount}>{totalTagCounts.get(tag.id) ?? 0}</Text>
                  </View>
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
              )}
            />
          </View>
        </View>
      </Modal>

      <ProfileScreen
        visible={profileVisible}
        onClose={() => setProfileVisible(false)}
        session={session}
        itemCount={items.length}
      />

      <OpenProfileSheet
        visible={openProfileVisible}
        onClose={() => setOpenProfileVisible(false)}
        onOpen={slug => { setOpenProfileVisible(false); setViewingSlug(slug); }}
      />

      <ProfileViewScreen
        visible={!!viewingSlug}
        slug={viewingSlug}
        onClose={() => setViewingSlug(null)}
      />

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
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 4,
  },
  headerIconBtn: {
    padding: 4,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    height: 40,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: '#E0E0E0',
    backgroundColor: '#fff',
    marginBottom: 12,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: '#2D2D2D',
    paddingVertical: 0,
  },
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
  filterChipDashed: {
    borderStyle: 'dashed',
  },
  manageOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  manageOverlayTop: {
    flex: 1,
  },
  manageSheet: {
    backgroundColor: '#F5F0EB',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 24,
    height: '70%',
    maxHeight: 560,
    width: '100%',
    maxWidth: 480,
    alignSelf: 'center',
  },
  manageHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  manageSearchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    height: 36,
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: '#E0E0E0',
    backgroundColor: '#fff',
    marginBottom: 8,
  },
  manageSearchInput: {
    flex: 1,
    fontSize: 14,
    color: '#2D2D2D',
    paddingVertical: 0,
  },
  manageList: {
    flex: 1,
  },
  manageEmpty: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
    paddingVertical: 32,
  },
  manageTagInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginRight: 12,
  },
  manageTagCount: {
    fontSize: 12,
    color: '#999',
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
