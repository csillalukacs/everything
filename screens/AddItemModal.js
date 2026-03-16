import * as ImagePicker from 'expo-image-picker';
import { useEffect, useState } from 'react';
import {
  Image,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

export default function AddItemModal({ visible, onClose, onSave }) {
  const [photo, setPhoto] = useState(null);
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (visible) openCamera();
  }, [visible]);

  async function openCamera() {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      onClose();
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
    });

    if (result.canceled) {
      onClose();
    } else {
      setPhoto(result.assets[0].uri);
    }
  }

  async function handleSave() {
    if (!name.trim() || !photo) return;
    setSaving(true);
    await onSave(name.trim(), photo);
    setName('');
    setPhoto(null);
    setSaving(false);
  }

  function handleClose() {
    setPhoto(null);
    setName('');
    onClose();
  }

  if (!photo) return null;

  return (
    <Modal visible={visible} animationType="slide">
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <TouchableOpacity style={styles.cancel} onPress={handleClose}>
          <Text style={styles.cancelText}>cancel</Text>
        </TouchableOpacity>

        <Image source={{ uri: photo }} style={styles.photo} />

        <TextInput
          style={styles.input}
          placeholder="what is this?"
          placeholderTextColor="#bbb"
          value={name}
          onChangeText={setName}
          autoFocus
          returnKeyType="done"
          onSubmitEditing={handleSave}
        />

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
  photo: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: 16,
    marginBottom: 24,
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
});
