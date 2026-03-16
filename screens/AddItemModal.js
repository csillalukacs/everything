import * as ImagePicker from 'expo-image-picker';
// import { removeBackground } from 'react-native-background-remover';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
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
  const [processing, setProcessing] = useState(false);

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

  // async function stickerify(originalUri) {
  //   try {
  //     const outputUri = await removeBackground(originalUri);
  //     setPhoto(outputUri);
  //   } catch (e) {
  //     console.warn('Stickerify failed, using original:', e);
  //     setPhoto(originalUri);
  //   } finally {
  //     setProcessing(false);
  //   }
  // }

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

  if (!photo && !processing) return null;

  if (processing) {
    return (
      <Modal visible={visible} animationType="slide">
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#2D2D2D" />
          <Text style={styles.loadingText}>stickerifying...</Text>
        </View>
      </Modal>
    );
  }

  return (
    <Modal visible={visible} animationType="slide">
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <TouchableOpacity style={styles.cancel} onPress={handleClose}>
          <Text style={styles.cancelText}>cancel</Text>
        </TouchableOpacity>

        <View style={styles.stickerContainer}>
          <Image source={{ uri: photo }} style={styles.photo} />
        </View>

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
  loadingContainer: {
    flex: 1,
    backgroundColor: '#F5F0EB',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
  },
  loadingText: {
    fontSize: 16,
    color: '#999',
    letterSpacing: 1,
  },
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
  stickerContainer: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: 16,
    marginBottom: 24,
    backgroundColor: '#E8E3DD',
    overflow: 'hidden',
  },
  photo: {
    width: '100%',
    height: '100%',
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
