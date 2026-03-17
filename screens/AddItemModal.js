import * as ImagePicker from 'expo-image-picker';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useRef, useState } from 'react';
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
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef(null);

  async function takePhoto() {
    if (!cameraRef.current) return;
    const result = await cameraRef.current.takePictureAsync({ quality: 0.7 });
    setPhoto(result.uri);
  }

  async function openLibrary() {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') return;

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
    });

    if (!result.canceled) setPhoto(result.assets[0].uri);
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

  function renderCamera() {
    if (!permission) return null;
    if (!permission.granted) {
      return (
        <View style={styles.permissionContainer}>
          <Text style={styles.permissionText}>camera access needed</Text>
          <TouchableOpacity style={styles.button} onPress={requestPermission}>
            <Text style={styles.buttonText}>allow camera</Text>
          </TouchableOpacity>
        </View>
      );
    }

    return (
      <View style={styles.cameraContainer}>
        <CameraView ref={cameraRef} style={styles.camera} facing="back" />

        {/* cancel top left */}
        <TouchableOpacity style={styles.cancelOverlay} onPress={handleClose}>
          <Text style={styles.cancelText}>cancel</Text>
        </TouchableOpacity>

        {/* bottom bar */}
        <View style={styles.cameraControls}>
          {/* camera roll bottom left */}
          <TouchableOpacity style={styles.libraryButton} onPress={openLibrary}>
            <Text style={styles.libraryButtonText}>roll</Text>
          </TouchableOpacity>

          {/* shutter center */}
          <TouchableOpacity style={styles.shutter} onPress={takePhoto} />

          {/* spacer to balance layout */}
          <View style={styles.shutterSpacer} />
        </View>
      </View>
    );
  }

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={handleClose}>
      {photo ? (
        <KeyboardAvoidingView
          style={styles.container}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <TouchableOpacity style={styles.cancel} onPress={handleClose}>
            <Text style={styles.cancelText}>cancel</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.imageContainer} onPress={() => setPhoto(null)}>
            <Image source={{ uri: photo }} style={styles.photo} />
            <View style={styles.retakeOverlay}>
              <Text style={styles.retakeText}>retake</Text>
            </View>
          </TouchableOpacity>

          <TextInput
            style={styles.input}
            placeholder="what is this?"
            placeholderTextColor="#bbb"
            value={name}
            onChangeText={setName}
            autoFocus
            returnKeyType="done"
            onSubmitEditing={Keyboard.dismiss}
          />

          <TouchableOpacity
            style={[styles.button, saving && styles.buttonDisabled]}
            onPress={handleSave}
            disabled={saving}
          >
            <Text style={styles.buttonText}>{saving ? 'saving...' : 'save'}</Text>
          </TouchableOpacity>
        </KeyboardAvoidingView>
      ) : (
        renderCamera()
      )}
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
  // --- camera ---
  cameraContainer: {
    flex: 1,
    backgroundColor: '#000',
  },
  camera: {
    flex: 1,
  },
  cancelOverlay: {
    position: 'absolute',
    top: 60,
    left: 24,
  },
  cameraControls: {
    position: 'absolute',
    bottom: 48,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 40,
  },
  libraryButton: {
    width: 52,
    height: 52,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  libraryButtonText: {
    color: '#fff',
    fontSize: 12,
  },
  shutter: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#fff',
    borderWidth: 4,
    borderColor: 'rgba(255,255,255,0.5)',
  },
  shutterSpacer: {
    width: 52,
  },
  permissionContainer: {
    flex: 1,
    backgroundColor: '#F5F0EB',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
    paddingHorizontal: 24,
  },
  permissionText: {
    fontSize: 18,
    color: '#2D2D2D',
  },
  // --- post-capture ---
  imageContainer: {
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
