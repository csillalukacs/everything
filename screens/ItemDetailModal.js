import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useEffect, useRef, useState } from 'react';
import { removeBackground } from '@jacobjmc/react-native-background-remover';
import {
  ActivityIndicator,
  Image,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

export default function ItemDetailModal({ item, category, visible, onClose, onDelete, onSave, categories = [], onAddCategory, autoEdit = false }) {
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState('');
  const [editPhoto, setEditPhoto] = useState(null);
  const [editCategory, setEditCategory] = useState(null);
  const [saving, setSaving] = useState(false);
  const [removingBg, setRemovingBg] = useState(false);
  const [nameEditable, setNameEditable] = useState(false);
  const [addingCategory, setAddingCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const nameInputRef = useRef(null);

  useEffect(() => {
    if (visible && autoEdit) enterEdit();
  }, [visible]);

  useEffect(() => {
    if (nameEditable) nameInputRef.current?.focus();
  }, [nameEditable]);

  function enterEdit() {
    setEditName(item.name);
    setEditPhoto(item.image_url);
    setEditCategory(category ?? null);
    setNameEditable(false);
    setEditing(true);
  }

  function cancelEdit() {
    setEditing(false);
    setAddingCategory(false);
    setNewCategoryName('');
  }

  async function pickFromCamera() {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') return;
    const result = await ImagePicker.launchCameraAsync({ allowsEditing: true, aspect: [1, 1], quality: 0.7 });
    if (!result.canceled) {
      const uri = result.assets[0].uri;
      setEditPhoto(uri);
      setRemovingBg(true);
      try {
        const cleaned = await removeBackground(uri);
        setEditPhoto(cleaned);
      } finally {
        setRemovingBg(false);
      }
    }
  }

  async function pickFromLibrary() {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') return;
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], quality: 0.7 });
    if (!result.canceled) {
      const uri = result.assets[0].uri;
      setEditPhoto(uri);
      setRemovingBg(true);
      try {
        const cleaned = await removeBackground(uri);
        setEditPhoto(cleaned);
      } finally {
        setRemovingBg(false);
      }
    }
  }

  async function handleConfirmNewCategory() {
    const trimmed = newCategoryName.trim();
    if (!trimmed) return;
    const cat = await onAddCategory(trimmed);
    if (cat) setEditCategory(cat);
    setAddingCategory(false);
    setNewCategoryName('');
  }

  async function handleSave() {
    if (!editName.trim()) return;
    setSaving(true);
    await onSave(editName.trim(), editPhoto, editCategory?.id ?? null);
    setSaving(false);
    setEditing(false);
  }

  if (!item) return null;

  const displayCategory = editing ? editCategory : category;
  const displayPhoto = editing ? editPhoto : item.image_url;

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={editing ? cancelEdit : onClose}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={editing ? cancelEdit : onClose} style={styles.headerButton}>
            {editing
              ? <Text style={styles.headerButtonText}>cancel</Text>
              : <Ionicons name="chevron-down" size={28} color="#2D2D2D" />
            }
          </TouchableOpacity>
          <TouchableOpacity onPress={editing ? handleSave : enterEdit} style={styles.headerButton} disabled={saving}>
            <Text style={[styles.headerButtonText, editing && styles.saveText]}>
              {editing ? (saving ? 'saving...' : 'save') : 'edit'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Photo */}
        <View style={[styles.imageContainer, displayCategory && { borderColor: displayCategory.color, borderWidth: 3, backgroundColor: displayCategory.color }]}>
          {displayPhoto ? (
            <Image source={{ uri: displayPhoto }} style={styles.image} />
          ) : (
            <View style={styles.imagePlaceholder} />
          )}

          {editing && (
            removingBg ? (
              <View style={styles.photoOverlay}>
                <ActivityIndicator color="#fff" />
                <Text style={styles.photoActionText}>removing background...</Text>
              </View>
            ) : (
              <View style={styles.photoOverlay}>
                <TouchableOpacity style={styles.photoAction} onPress={pickFromCamera}>
                  <Ionicons name="camera-outline" size={22} color="#fff" />
                  <Text style={styles.photoActionText}>camera</Text>
                </TouchableOpacity>
                <View style={styles.photoActionDivider} />
                <TouchableOpacity style={styles.photoAction} onPress={pickFromLibrary}>
                  <Ionicons name="image-outline" size={22} color="#fff" />
                  <Text style={styles.photoActionText}>library</Text>
                </TouchableOpacity>
              </View>
            )
          )}
        </View>

        {/* Info / Edit fields */}
        {editing ? (
          <View style={styles.editFields}>
            {/* Category picker */}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.categoryScroll}
              contentContainerStyle={styles.categoryScrollContent}
            >
              {categories.map(cat => {
                const selected = editCategory?.id === cat.id;
                return (
                  <TouchableOpacity
                    key={cat.id}
                    style={[styles.categoryChip, selected && styles.categoryChipSelected, { borderColor: cat.color }]}
                    onPress={() => setEditCategory(selected ? null : cat)}
                  >
                    <View style={[styles.categoryDot, { backgroundColor: cat.color }]} />
                    <Text style={[styles.categoryChipText, selected && styles.categoryChipTextSelected]}>{cat.name}</Text>
                  </TouchableOpacity>
                );
              })}
              {addingCategory ? (
                <View style={styles.newCategoryRow}>
                  <TextInput
                    style={styles.newCategoryInput}
                    placeholder="category name"
                    placeholderTextColor="#bbb"
                    value={newCategoryName}
                    onChangeText={setNewCategoryName}
                    autoFocus
                    returnKeyType="done"
                    onSubmitEditing={handleConfirmNewCategory}
                  />
                  <TouchableOpacity onPress={handleConfirmNewCategory} style={styles.newCategoryConfirm}>
                    <Ionicons name="checkmark" size={18} color="#2D2D2D" />
                  </TouchableOpacity>
                </View>
              ) : (
                <TouchableOpacity
                  style={[styles.categoryChip, styles.categoryChipAdd]}
                  onPress={() => setAddingCategory(true)}
                >
                  <Ionicons name="add" size={16} color="#999" />
                </TouchableOpacity>
              )}
            </ScrollView>

            {/* Name input */}
            <TouchableOpacity activeOpacity={1} onPress={() => setNameEditable(true)}>
              <TextInput
                ref={nameInputRef}
                style={styles.nameInput}
                value={editName}
                onChangeText={setEditName}
                editable={nameEditable}
                pointerEvents={nameEditable ? 'auto' : 'none'}
                returnKeyType="done"
                onSubmitEditing={Keyboard.dismiss}
              />
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.info}>
            <Text style={styles.name}>{item.name}</Text>
            {category && (
              <View style={[styles.categoryBadge, { backgroundColor: category.color }]}>
                <Text style={styles.categoryBadgeText}>{category.name}</Text>
              </View>
            )}
            <Text style={styles.date}>
              added {new Date(item.created_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
            </Text>
          </View>
        )}

        {!editing && (
          <TouchableOpacity style={styles.deleteButton} onPress={onDelete}>
            <Text style={styles.deleteText}>delete item</Text>
          </TouchableOpacity>
        )}
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F0EB',
    paddingTop: 60,
    paddingHorizontal: 24,
    paddingBottom: 40,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  headerButton: {
    padding: 4,
  },
  headerButtonText: {
    fontSize: 16,
    color: '#2D2D2D',
  },
  saveText: {
    fontWeight: '500',
  },
  // --- photo ---
  imageContainer: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: 20,
    overflow: 'hidden',
    backgroundColor: '#E8E3DD',
    marginBottom: 20,
  },
  image: {
    width: '100%',
    height: '100%',
  },
  imagePlaceholder: {
    flex: 1,
  },
  photoOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  photoAction: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
  },
  photoActionDivider: {
    width: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(255,255,255,0.3)',
  },
  photoActionText: {
    color: '#fff',
    fontSize: 14,
  },
  // --- view mode ---
  info: {
    gap: 12,
    flex: 1,
  },
  name: {
    fontSize: 28,
    fontWeight: '300',
    color: '#2D2D2D',
    letterSpacing: 0.5,
  },
  categoryBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
  },
  categoryBadgeText: {
    fontSize: 13,
    color: '#2D2D2D',
  },
  date: {
    fontSize: 13,
    color: '#999',
  },
  deleteButton: {
    paddingVertical: 16,
    alignItems: 'center',
  },
  deleteText: {
    fontSize: 16,
    color: '#E74C3C',
  },
  // --- edit mode ---
  editFields: {
    flex: 1,
    gap: 12,
  },
  categoryScroll: {
    flexGrow: 0,
  },
  categoryScrollContent: {
    gap: 8,
    paddingVertical: 4,
  },
  categoryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    height: 34,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: '#E0E0E0',
    backgroundColor: '#fff',
  },
  categoryChipSelected: {
    backgroundColor: '#F5F0EB',
  },
  categoryChipAdd: {
    borderStyle: 'dashed',
    borderColor: '#E0E0E0',
  },
  categoryDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  categoryChipText: {
    fontSize: 13,
    color: '#999',
  },
  categoryChipTextSelected: {
    color: '#2D2D2D',
    fontWeight: '500',
  },
  newCategoryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#E0E0E0',
    borderRadius: 20,
    paddingHorizontal: 12,
    height: 34,
    backgroundColor: '#fff',
    gap: 6,
  },
  newCategoryInput: {
    fontSize: 13,
    color: '#2D2D2D',
    minWidth: 100,
  },
  newCategoryConfirm: {
    padding: 2,
  },
  nameInput: {
    backgroundColor: '#fff',
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: '#2D2D2D',
  },
});
