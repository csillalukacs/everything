import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
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
import { cropToContent } from '../lib/cropToContent';
import CameraCaptureModal from './CameraCaptureModal';

export default function AddItemModal({ visible, onClose, onSave, allTags = [] }) {
  const [photo, setPhoto] = useState(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);
  const [tags, setTags] = useState([]);
  const [isPrivate, setIsPrivate] = useState(false);
  const [addingTag, setAddingTag] = useState(false);
  const [newTagName, setNewTagName] = useState('');
  const [removingBg, setRemovingBg] = useState(false);

  async function processCapturedUri(uri) {
    setPhoto(uri);
    setRemovingBg(true);
    try {
      const cleaned = await removeBackground(uri);
      setPhoto(await cropToContent(cleaned));
    } finally {
      setRemovingBg(false);
    }
  }

  function toggleTag(tag) {
    setTags(prev => prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]);
  }

  function handleConfirmNewTag() {
    const trimmed = newTagName.trim().toLowerCase();
    if (!trimmed) {
      setAddingTag(false);
      setNewTagName('');
      return;
    }
    if (!tags.includes(trimmed)) setTags(prev => [...prev, trimmed]);
    setAddingTag(false);
    setNewTagName('');
  }

  async function handleSave() {
    if (!photo) return;
    setSaving(true);
    await onSave(name.trim(), photo, tags, isPrivate, description.trim());
    setName('');
    setDescription('');
    setPhoto(null);
    setTags([]);
    setIsPrivate(false);
    setSaving(false);
  }

  function handleClose() {
    setPhoto(null);
    setName('');
    setDescription('');
    setTags([]);
    setIsPrivate(false);
    setAddingTag(false);
    setNewTagName('');
    onClose();
  }

  const allTagNames = allTags.map(t => (typeof t === 'string' ? t : t.name));
  const tagPrivacyMap = Object.fromEntries(allTags.filter(t => typeof t === 'object').map(t => [t.name, t.is_private]));
  const tagOptions = [...new Set([...allTagNames, ...tags])].sort();

  if (!photo) {
    return (
      <CameraCaptureModal
        visible={visible}
        onCapture={processCapturedUri}
        onCancel={handleClose}
      />
    );
  }

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={handleClose}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <TouchableOpacity style={styles.cancel} onPress={handleClose}>
          <Text style={styles.cancelText}>cancel</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.imageContainer} onPress={() => setPhoto(null)} disabled={removingBg}>
          <Image source={{ uri: photo }} style={styles.photo} />
          {removingBg ? (
            <View style={styles.retakeOverlay}>
              <ActivityIndicator color="#fff" />
              <Text style={styles.retakeText}>removing background...</Text>
            </View>
          ) : (
            <View style={styles.retakeOverlay}>
              <Text style={styles.retakeText}>retake</Text>
            </View>
          )}
        </TouchableOpacity>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.tagScroll}
          contentContainerStyle={styles.tagScrollContent}
        >
          {tagOptions.map(tag => {
            const selected = tags.includes(tag);
            const isTagPrivate = tagPrivacyMap[tag];
            return (
              <TouchableOpacity
                key={tag}
                style={[styles.tagChip, selected && styles.tagChipSelected]}
                onPress={() => toggleTag(tag)}
              >
                {isTagPrivate && <Ionicons name="lock-closed" size={10} color={selected ? '#fff' : '#ccc'} />}
                <Text style={[styles.tagChipText, selected && styles.tagChipTextSelected]}>
                  {tag}
                </Text>
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

        <TextInput
          style={styles.input}
          placeholder="name (optional)"
          placeholderTextColor="#bbb"
          value={name}
          onChangeText={setName}
          returnKeyType="next"
          onSubmitEditing={Keyboard.dismiss}
        />
        <TextInput
          style={[styles.input, styles.descriptionInput]}
          placeholder="description (optional)"
          placeholderTextColor="#bbb"
          value={description}
          onChangeText={setDescription}
          multiline
          returnKeyType="done"
          onSubmitEditing={Keyboard.dismiss}
        />

        <TouchableOpacity style={styles.privacyToggle} onPress={() => setIsPrivate(prev => !prev)}>
          <Ionicons name={isPrivate ? 'lock-closed' : 'lock-open-outline'} size={16} color={isPrivate ? '#2D2D2D' : '#bbb'} />
          <Text style={[styles.privacyToggleText, isPrivate && styles.privacyToggleTextOn]}>
            {isPrivate ? 'private' : 'public'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.button, saving && styles.buttonDisabled]}
          onPress={handleSave}
          disabled={saving}
        >
          <Text style={styles.buttonText}>{saving ? 'saving...' : 'save'}</Text>
        </TouchableOpacity>
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
  },
  cancel: {
    marginBottom: 24,
  },
  cancelText: {
    color: '#999',
    fontSize: 16,
  },
  imageContainer: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: 16,
    marginBottom: 16,
    backgroundColor: '#E8E3DD',
    overflow: 'hidden',
  },
  photo: {
    width: '100%',
    height: '100%',
  },
  retakeOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingVertical: 10,
    backgroundColor: 'rgba(0,0,0,0.3)',
    alignItems: 'center',
  },
  retakeText: {
    color: '#fff',
    fontSize: 14,
  },
  tagScroll: {
    flexGrow: 0,
    marginBottom: 12,
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
  input: {
    backgroundColor: '#fff',
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: '#2D2D2D',
    marginBottom: 12,
  },
  descriptionInput: {
    fontSize: 14,
    minHeight: 80,
    textAlignVertical: 'top',
  },
  button: {
    backgroundColor: '#2D2D2D',
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
  },
  privacyToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 10,
    marginBottom: 4,
  },
  privacyToggleText: {
    fontSize: 14,
    color: '#bbb',
  },
  privacyToggleTextOn: {
    color: '#2D2D2D',
  },
});
