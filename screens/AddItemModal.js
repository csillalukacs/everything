import { Ionicons } from '@expo/vector-icons';
import { useMemo, useRef, useState } from 'react';
import { removeBackground } from '@jacobjmc/react-native-background-remover';
import {
  ActivityIndicator,
  Alert,
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
import { centerCropToSquare, cropToContent } from '../lib/cropToContent';
import { ocrImage } from '../lib/ocr';
import { useCollection } from '../lib/CollectionProvider';
import { locationSuggestionsFromItems } from '../shared/items';
import { S } from '../shared/strings';
import CameraCaptureModal from './CameraCaptureModal';
import LocationPicker from './LocationPicker';
import TagInput from './TagInput';
import { C } from '../shared/theme';

export default function AddItemModal({ visible, onClose, onSave, allTags = [] }) {
  const { items, uploadLocalPhoto } = useCollection();
  const locationSuggestions = useMemo(() => locationSuggestionsFromItems(items), [items]);
  const [photo, setPhoto] = useState(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);
  const [tags, setTags] = useState([]);
  const [isPrivate, setIsPrivate] = useState(false);
  const [removingBg, setRemovingBg] = useState(false);
  const [year, setYear] = useState('');
  const [acquired, setAcquired] = useState(null);
  const ocrPromiseRef = useRef(null);
  const uploadPromiseRef = useRef(null);
  const scrollRef = useRef(null);

  async function processCapturedUri(uri) {
    setPhoto(uri);
    setRemovingBg(true);
    ocrPromiseRef.current = ocrImage(uri);
    let finalUri = uri;
    try {
      const cleaned = await removeBackground(uri);
      finalUri = await cropToContent(cleaned);
      setPhoto(finalUri);
    } catch {
      try {
        finalUri = await centerCropToSquare(uri);
        setPhoto(finalUri);
      } catch {
        // fall back to the original
      }
    } finally {
      setRemovingBg(false);
      uploadPromiseRef.current = uploadLocalPhoto(finalUri);
    }
  }

  function handleRetake() {
    setPhoto(null);
    uploadPromiseRef.current = null;
  }

  function buildAcquired() {
    const y = year.trim();
    const yearNum = y ? parseInt(y, 10) : null;
    const validYear = yearNum && yearNum >= 1800 && yearNum <= 2100 ? yearNum : null;
    if (!validYear && !acquired) return null;
    return { year: validYear, location: acquired?.location ?? null, lat: acquired?.lat ?? null, lng: acquired?.lng ?? null };
  }

  async function attemptSave() {
    const ocrText = await (ocrPromiseRef.current ?? Promise.resolve(null));
    const uploadPromise = uploadPromiseRef.current;
    let timeoutId;
    const timeoutPromise = new Promise(resolve => {
      timeoutId = setTimeout(() => resolve(false), 60000);
    });
    const savePromise = (async () => {
      try {
        return await onSave(name.trim(), photo, tags, isPrivate, description.trim(), buildAcquired(), ocrText, uploadPromise);
      } catch (e) {
        console.error('Add save error:', e);
        return false;
      }
    })();
    const ok = await Promise.race([savePromise, timeoutPromise]);
    clearTimeout(timeoutId);
    return !!ok;
  }

  async function handleSave() {
    if (!photo) return;
    setSaving(true);
    const ok = await attemptSave();
    setSaving(false);
    if (ok) return;
    // Failed or timed out — force fresh upload on retry; keep form state.
    uploadPromiseRef.current = null;
    Alert.alert(
      S.common.saveFailedTitle,
      S.common.saveFailedMessage,
      [
        { text: S.common.cancel, style: 'cancel' },
        { text: S.common.retry, onPress: handleSave },
      ],
    );
  }

  function handleClose() {
    setPhoto(null);
    setName('');
    setDescription('');
    setTags([]);
    setIsPrivate(false);
    setYear('');
    setAcquired(null);
    ocrPromiseRef.current = null;
    uploadPromiseRef.current = null;
    onClose();
  }

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
        <ScrollView
          ref={scrollRef}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
        <TouchableOpacity style={styles.cancel} onPress={handleClose}>
          <Text style={styles.cancelText}>{S.common.cancel}</Text>
        </TouchableOpacity>

        <View style={styles.imageContainer}>
          <TouchableOpacity activeOpacity={0.9} onPress={handleRetake} disabled={removingBg} style={StyleSheet.absoluteFill}>
            <Image source={{ uri: photo }} style={styles.photo} />
            {removingBg ? (
              <View style={styles.retakeOverlay}>
                <ActivityIndicator color="#fff" />
                <Text style={styles.retakeText}>{S.common.removingBackground}</Text>
              </View>
            ) : (
              <View style={styles.retakeOverlay}>
                <Text style={styles.retakeText}>{S.common.retake}</Text>
              </View>
            )}
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.privacyCorner, isPrivate && styles.privacyCornerOn]}
            onPress={() => setIsPrivate(prev => !prev)}
          >
            <Ionicons
              name={isPrivate ? 'lock-closed' : 'lock-open-outline'}
              size={16}
              color="#fff"
            />
          </TouchableOpacity>
        </View>

        <TagInput
          allTags={allTags}
          selectedTags={tags}
          onChange={setTags}
          onStartAdding={() => setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 150)}
        />

        <TextInput
          style={styles.input}
          placeholder={S.itemForm.namePlaceholder}
          placeholderTextColor="#bbb"
          value={name}
          onChangeText={setName}
          returnKeyType="next"
          onSubmitEditing={Keyboard.dismiss}
        />
        <TextInput
          style={styles.input}
          placeholder={S.itemForm.descriptionPlaceholder}
          placeholderTextColor="#bbb"
          value={description}
          onChangeText={setDescription}
          returnKeyType="done"
          onSubmitEditing={Keyboard.dismiss}
        />

        <TextInput
          style={styles.input}
          placeholder={S.itemForm.yearPlaceholder}
          placeholderTextColor="#bbb"
          value={year}
          onChangeText={t => setYear(t.replace(/[^0-9]/g, '').slice(0, 4))}
          keyboardType="number-pad"
          maxLength={4}
          returnKeyType="done"
          onSubmitEditing={Keyboard.dismiss}
        />

        <View style={{ marginBottom: 12 }}>
          <LocationPicker
            value={acquired}
            onChange={setAcquired}
            placeholder={S.itemForm.cityPlaceholder}
            suggestions={locationSuggestions}
            onFocus={() => setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 50)}
          />
        </View>

        <TouchableOpacity
          style={[styles.button, saving && styles.buttonDisabled]}
          onPress={handleSave}
          disabled={saving}
        >
          <Text style={styles.buttonText}>{saving ? S.common.saving : S.common.save}</Text>
        </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: C.bg,
  },
  scrollContent: {
    paddingTop: 60,
    paddingHorizontal: 24,
    paddingBottom: 40,
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
    backgroundColor: C.surface,
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
  input: {
    backgroundColor: '#fff',
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: C.ink,
    marginBottom: 12,
  },
  button: {
    backgroundColor: C.ink,
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
  privacyCorner: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  privacyCornerOn: {
    backgroundColor: C.ink,
  },
});
