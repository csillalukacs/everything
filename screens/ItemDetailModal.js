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

export default function ItemDetailModal({ item, visible, onClose, onDelete, onSave, allTags = [], autoEdit = false, onPrev, onNext }) {
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState('');
  const [editPhoto, setEditPhoto] = useState(null);
  const [editTags, setEditTags] = useState([]);
  const [editPrivate, setEditPrivate] = useState(false);
  const [saving, setSaving] = useState(false);
  const [removingBg, setRemovingBg] = useState(false);
  const [nameEditable, setNameEditable] = useState(false);
  const [addingTag, setAddingTag] = useState(false);
  const [newTagName, setNewTagName] = useState('');
  const nameInputRef = useRef(null);
  const scrollRef = useRef(null);

  useEffect(() => {
    if (visible && autoEdit) enterEdit();
  }, [visible]);

  useEffect(() => {
    if (nameEditable) nameInputRef.current?.focus();
  }, [nameEditable]);

  useEffect(() => {
    if (addingTag) {
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 150);
    }
  }, [addingTag]);

  function enterEdit() {
    setEditName(item.name ?? '');
    setEditPhoto(item.image_url);
    setEditTags((item.tags ?? []).map(t => t.name));
    setEditPrivate(item.is_private ?? false);
    setNameEditable(false);
    setEditing(true);
  }

  function cancelEdit() {
    setEditing(false);
    setAddingTag(false);
    setNewTagName('');
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

  function toggleTag(tag) {
    setEditTags(prev => prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]);
  }

  function handleConfirmNewTag() {
    const trimmed = newTagName.trim().toLowerCase();
    if (!trimmed) {
      setAddingTag(false);
      setNewTagName('');
      return;
    }
    if (!editTags.includes(trimmed)) setEditTags(prev => [...prev, trimmed]);
    setAddingTag(false);
    setNewTagName('');
  }

  async function handleSave() {
    setSaving(true);
    await onSave(editName.trim(), editPhoto, editTags, editPrivate);
    setSaving(false);
    setEditing(false);
  }

  if (!item) return null;

  const displayPhoto = editing ? editPhoto : item.image_url;
  const itemTags = item.tags ?? [];
  const allTagNames = allTags.map(t => (typeof t === 'string' ? t : t.name));
  const tagPrivacyMap = Object.fromEntries(allTags.filter(t => typeof t === 'object').map(t => [t.name, t.is_private]));
  const tagOptions = [...new Set([...allTagNames, ...editTags])].sort();

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={editing ? cancelEdit : onClose}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View style={styles.header}>
          <TouchableOpacity onPress={editing ? cancelEdit : onClose} style={styles.headerButton}>
            {editing
              ? <Text style={styles.headerButtonText}>cancel</Text>
              : <Ionicons name="chevron-down" size={28} color="#2D2D2D" />
            }
          </TouchableOpacity>
          {!editing && (
            <View style={styles.navButtons}>
              <TouchableOpacity onPress={onPrev} disabled={!onPrev} style={styles.navButton}>
                <Ionicons name="chevron-back" size={24} color={onPrev ? '#2D2D2D' : '#CCC'} />
              </TouchableOpacity>
              <TouchableOpacity onPress={onNext} disabled={!onNext} style={styles.navButton}>
                <Ionicons name="chevron-forward" size={24} color={onNext ? '#2D2D2D' : '#CCC'} />
              </TouchableOpacity>
            </View>
          )}
          <TouchableOpacity onPress={editing ? handleSave : enterEdit} style={styles.headerButton} disabled={saving}>
            <Text style={[styles.headerButtonText, editing && styles.saveText]}>
              {editing ? (saving ? 'saving...' : 'save') : 'edit'}
            </Text>
          </TouchableOpacity>
        </View>

        {editing ? (
          <ScrollView
            ref={scrollRef}
            style={{ flex: 1 }}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.imageContainer}>
              {displayPhoto
                ? <Image source={{ uri: displayPhoto }} style={styles.image} />
                : <View style={styles.imagePlaceholder} />
              }
              {removingBg ? (
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
              )}
            </View>

            <View style={styles.editFields}>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={styles.tagScroll}
                contentContainerStyle={styles.tagScrollContent}
              >
                {tagOptions.map(tag => {
                  const selected = editTags.includes(tag);
                  const isTagPrivate = tagPrivacyMap[tag];
                  return (
                    <TouchableOpacity
                      key={tag}
                      style={[styles.tagChip, selected && styles.tagChipSelected]}
                      onPress={() => toggleTag(tag)}
                    >
                      {isTagPrivate && <Ionicons name="lock-closed" size={10} color={selected ? '#fff' : '#ccc'} />}
                      <Text style={[styles.tagChipText, selected && styles.tagChipTextSelected]}>{tag}</Text>
                    </TouchableOpacity>
                  );
                })}
                {addingTag ? (
                  <View style={styles.newTagRow}>
                    <TextInput
                      style={styles.newTagInput}
                      placeholder="tag"
                      placeholderTextColor="#bbb"
                      value={newTagName}
                      onChangeText={setNewTagName}
                      autoFocus
                      returnKeyType="done"
                      onSubmitEditing={handleConfirmNewTag}
                      onBlur={handleConfirmNewTag}
                    />
                    <TouchableOpacity onPress={handleConfirmNewTag} style={styles.newTagConfirm}>
                      <Ionicons name="checkmark" size={18} color="#2D2D2D" />
                    </TouchableOpacity>
                  </View>
                ) : (
                  <TouchableOpacity
                    style={[styles.tagChip, styles.tagChipAdd]}
                    onPress={() => setAddingTag(true)}
                  >
                    <Ionicons name="add" size={16} color="#999" />
                  </TouchableOpacity>
                )}
              </ScrollView>

              <TouchableOpacity activeOpacity={1} onPress={() => setNameEditable(true)}>
                <TextInput
                  ref={nameInputRef}
                  style={styles.nameInput}
                  value={editName}
                  onChangeText={setEditName}
                  placeholder="name (optional)"
                  placeholderTextColor="#bbb"
                  editable={nameEditable}
                  pointerEvents={nameEditable ? 'auto' : 'none'}
                  returnKeyType="done"
                  onSubmitEditing={Keyboard.dismiss}
                />
              </TouchableOpacity>

              <TouchableOpacity style={styles.privacyToggle} onPress={() => setEditPrivate(prev => !prev)}>
                <Ionicons name={editPrivate ? 'lock-closed' : 'lock-open-outline'} size={16} color={editPrivate ? '#2D2D2D' : '#bbb'} />
                <Text style={[styles.privacyToggleText, editPrivate && styles.privacyToggleTextOn]}>
                  {editPrivate ? 'private' : 'public'}
                </Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        ) : (
          <>
            <View style={styles.imageContainer}>
              {displayPhoto
                ? <Image source={{ uri: displayPhoto }} style={styles.image} />
                : <View style={styles.imagePlaceholder} />
              }
            </View>
            <View style={styles.info}>
              <View style={styles.nameRow}>
                {item.name ? <Text style={styles.name}>{item.name}</Text> : null}
                {item.is_private && <Ionicons name="lock-closed" size={16} color="#999" style={styles.privateLockIcon} />}
              </View>
              {itemTags.length > 0 && (
                <View style={styles.tagRow}>
                  {itemTags.map(tag => (
                    <View key={tag.id} style={styles.tagBadge}>
                      {tag.is_private && <Ionicons name="lock-closed" size={9} color="#bbb" />}
                      <Text style={styles.tagBadgeText}>{tag.name}</Text>
                    </View>
                  ))}
                </View>
              )}
              <Text style={styles.date}>
                added {new Date(item.created_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
              </Text>
            </View>
            <TouchableOpacity style={styles.deleteButton} onPress={onDelete}>
              <Text style={styles.deleteText}>delete item</Text>
            </TouchableOpacity>
          </>
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
  navButtons: {
    flexDirection: 'row',
    gap: 4,
  },
  navButton: {
    padding: 4,
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
  tagRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  privateLockIcon: {
    marginTop: 4,
  },
  tagBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  tagBadgeText: {
    fontSize: 13,
    color: '#2D2D2D',
  },
  privacyToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 10,
  },
  privacyToggleText: {
    fontSize: 14,
    color: '#bbb',
  },
  privacyToggleTextOn: {
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
  editFields: {
    gap: 12,
    paddingBottom: 40,
  },
  tagScroll: {
    flexGrow: 0,
  },
  tagScrollContent: {
    gap: 8,
    paddingVertical: 4,
  },
  tagChip: {
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
  tagChipSelected: {
    backgroundColor: '#2D2D2D',
    borderColor: '#2D2D2D',
  },
  tagChipAdd: {
    borderStyle: 'dashed',
  },
  tagChipText: {
    fontSize: 13,
    color: '#999',
  },
  tagChipTextSelected: {
    color: '#fff',
  },
  newTagRow: {
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
  newTagInput: {
    fontSize: 13,
    color: '#2D2D2D',
    minWidth: 80,
  },
  newTagConfirm: {
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
