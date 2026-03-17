import { StatusBar } from 'expo-status-bar';
import { readAsStringAsync, EncodingType } from 'expo-file-system/legacy';
import { decode } from 'base64-arraybuffer';
import { useEffect, useRef, useState } from 'react';
import {
  Animated,
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
import { BlurView } from 'expo-blur';
import { supabase } from './lib/supabase';
import { CATEGORY_COLORS } from './constants/categories';
import AuthScreen from './screens/AuthScreen';
import AddItemModal from './screens/AddItemModal';

const SCREEN_WIDTH = Dimensions.get('window').width;
const CARD_SIZE = SCREEN_WIDTH * 0.72;
const GRID_CARD_SIZE = (SCREEN_WIDTH - 48 - 12) / 2;

export default function App() {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState([]);
  const [categories, setCategories] = useState([]);
  const [activeCategory, setActiveCategory] = useState(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);
  const [editingItem, setEditingItem] = useState(null);

  const backdropAnim = useRef(new Animated.Value(0)).current;
  const cardAnim = useRef(new Animated.Value(0)).current;

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
      fetchCategories();
    } else {
      setItems([]);
      setCategories([]);
    }
  }, [session]);

  useEffect(() => {
    if (selectedItem) {
      Animated.parallel([
        Animated.timing(backdropAnim, { toValue: 1, duration: 200, useNativeDriver: true }),
        Animated.spring(cardAnim, { toValue: 1, tension: 120, friction: 8, useNativeDriver: true }),
      ]).start();
    }
  }, [selectedItem]);

  function dismiss(onComplete) {
    Animated.parallel([
      Animated.timing(backdropAnim, { toValue: 0, duration: 180, useNativeDriver: true }),
      Animated.timing(cardAnim, { toValue: 0, duration: 150, useNativeDriver: true }),
    ]).start(() => {
      setSelectedItem(null);
      backdropAnim.setValue(0);
      cardAnim.setValue(0);
      onComplete?.();
    });
  }

  async function fetchItems() {
    const { data, error } = await supabase
      .from('items')
      .select('*')
      .order('created_at', { ascending: false });
    if (!error) setItems(data);
  }

  async function fetchCategories() {
    const { data, error } = await supabase
      .from('categories')
      .select('*')
      .order('created_at', { ascending: true });
    if (!error) setCategories(data);
  }

  async function handleAddCategory(name) {
    const usedColors = new Set(categories.map(c => c.color));
    const color = CATEGORY_COLORS.find(c => !usedColors.has(c)) ?? CATEGORY_COLORS[0];

    const { data, error } = await supabase
      .from('categories')
      .insert({ name, color, user_id: session.user.id })
      .select()
      .single();

    if (!error) {
      setCategories(prev => [...prev, data]);
      return data;
    }
    return null;
  }

  async function handleUpdate(name, photoUri, categoryId) {
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
      .update({ name, image_url, category_id: categoryId })
      .eq('id', editingItem.id)
      .select()
      .single();

    if (!error) {
      setItems(prev => prev.map(i => i.id === data.id ? data : i));
      setEditingItem(null);
      setModalVisible(false);
    }
  }

  async function handleSave(name, photoUri, categoryId) {
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
      .insert({ name, image_url: publicUrl, category_id: categoryId })
      .select()
      .single();

    if (!error) {
      setItems([data, ...items]);
      setModalVisible(false);
    }
  }

  async function handleDelete() {
    const itemToDelete = selectedItem;
    dismiss();
    const { error } = await supabase
      .from('items')
      .delete()
      .eq('id', itemToDelete.id);
    if (!error) setItems(prev => prev.filter(i => i.id !== itemToDelete.id));
  }

  const filteredItems = activeCategory
    ? items.filter(i => i.category_id === activeCategory.id)
    : items;

  const categoryMap = new Map(categories.map(c => [c.id, c]));

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
          <Text style={styles.subtitle}>your personal inventory</Text>
        </View>
        <TouchableOpacity onPress={() => supabase.auth.signOut()}>
          <Text style={styles.logout}>log out</Text>
        </TouchableOpacity>
      </View>

      {/* Category filter bar */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.filterScroll}
        contentContainerStyle={styles.filterScrollContent}
      >
        <TouchableOpacity
          style={[styles.filterChip, !activeCategory && styles.filterChipActive]}
          onPress={() => setActiveCategory(null)}
        >
          <Text style={[styles.filterChipText, !activeCategory && styles.filterChipTextActive]}>all</Text>
        </TouchableOpacity>
        {categories.map(cat => {
          const active = activeCategory?.id === cat.id;
          return (
            <TouchableOpacity
              key={cat.id}
              style={[styles.filterChip, active && styles.filterChipActive, { borderColor: cat.color }]}
              onPress={() => setActiveCategory(active ? null : cat)}
            >
              <View style={[styles.filterDot, { backgroundColor: cat.color }]} />
              <Text style={[styles.filterChipText, active && styles.filterChipTextActive]}>{cat.name}</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      <FlatList
        data={filteredItems}
        keyExtractor={(item) => item.id}
        numColumns={2}
        columnWrapperStyle={styles.row}
        contentContainerStyle={styles.listContent}
        style={styles.list}
        renderItem={({ item }) => {
          const cat = item.category_id ? categoryMap.get(item.category_id) : null;
          return (
            <TouchableOpacity
              style={styles.card}
              onLongPress={() => setSelectedItem(item)}
              delayLongPress={400}
            >
              {cat && <View style={[styles.cardColorStrip, { backgroundColor: cat.color }]} />}
              {item.image_url && (
                <View style={styles.cardImageContainer}>
                  <Image source={{ uri: item.image_url }} style={styles.cardImage} />
                </View>
              )}
              <Text style={styles.cardName}>{item.name}</Text>
            </TouchableOpacity>
          );
        }}
      />

      <TouchableOpacity style={styles.fab} onPress={() => setModalVisible(true)}>
        <Text style={styles.fabText}>+</Text>
      </TouchableOpacity>

      <AddItemModal
        visible={modalVisible}
        onClose={() => { setModalVisible(false); setEditingItem(null); }}
        onSave={editingItem ? handleUpdate : handleSave}
        categories={categories}
        onAddCategory={handleAddCategory}
        editingItem={editingItem}
      />

      <Modal
        visible={!!selectedItem}
        transparent
        animationType="none"
        onRequestClose={() => dismiss()}
      >
        <Animated.View style={[StyleSheet.absoluteFill, { opacity: backdropAnim }]}>
          <BlurView intensity={40} tint="dark" style={StyleSheet.absoluteFill} />
        </Animated.View>
        <TouchableOpacity
          style={StyleSheet.absoluteFill}
          activeOpacity={1}
          onPress={() => dismiss()}
        />

        <View style={styles.floatingContainer} pointerEvents="box-none">
          <Animated.View style={[styles.floatingCard, {
            opacity: cardAnim,
            transform: [{
              scale: cardAnim.interpolate({ inputRange: [0, 1], outputRange: [0.85, 1] }),
            }],
          }]}>
            {selectedItem?.category_id && categoryMap.get(selectedItem.category_id) && (
              <View style={[styles.floatingColorStrip, { backgroundColor: categoryMap.get(selectedItem.category_id).color }]} />
            )}
            {selectedItem?.image_url && (
              <Image source={{ uri: selectedItem.image_url }} style={styles.floatingImage} />
            )}
            <Text style={styles.floatingName}>{selectedItem?.name}</Text>
          </Animated.View>

          <Animated.View style={[styles.actions, {
            opacity: cardAnim,
            transform: [{
              translateY: cardAnim.interpolate({ inputRange: [0, 1], outputRange: [10, 0] }),
            }],
          }]}>
            <TouchableOpacity style={styles.actionRow} onPress={() => dismiss(() => { setEditingItem(selectedItem); setModalVisible(true); })}>
              <Text style={styles.actionText}>edit</Text>
            </TouchableOpacity>
            <View style={styles.actionDivider} />
            <TouchableOpacity style={styles.actionRow} onPress={handleDelete}>
              <Text style={[styles.actionText, styles.actionDelete]}>delete</Text>
            </TouchableOpacity>
          </Animated.View>
        </View>
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
  // --- filter bar ---
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
  filterDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  filterChipText: {
    fontSize: 13,
    color: '#999',
  },
  filterChipTextActive: {
    color: '#fff',
  },
  // --- grid ---
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
  cardColorStrip: {
    height: 4,
    width: '100%',
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
  cardName: {
    fontSize: 14,
    color: '#2D2D2D',
    padding: 10,
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
  // --- detail modal ---
  floatingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    gap: 12,
  },
  floatingCard: {
    width: CARD_SIZE,
    backgroundColor: '#fff',
    borderRadius: 20,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.3,
    shadowRadius: 24,
  },
  floatingColorStrip: {
    height: 5,
    width: '100%',
  },
  floatingImage: {
    width: CARD_SIZE,
    height: CARD_SIZE,
  },
  floatingName: {
    fontSize: 16,
    color: '#2D2D2D',
    padding: 14,
  },
  actions: {
    width: CARD_SIZE,
    backgroundColor: '#fff',
    borderRadius: 16,
    overflow: 'hidden',
  },
  actionRow: {
    paddingVertical: 16,
    alignItems: 'center',
  },
  actionText: {
    fontSize: 16,
    color: '#2D2D2D',
  },
  actionDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: '#E5E5E5',
    marginHorizontal: 16,
  },
  actionDelete: {
    color: '#E74C3C',
  },
});
