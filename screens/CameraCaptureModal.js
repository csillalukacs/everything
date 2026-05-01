import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as MediaLibrary from 'expo-media-library';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useEffect, useRef, useState } from 'react';
import {
  Image,
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

export default function CameraCaptureModal({ visible, onCapture, onCancel }) {
  const [permission, requestPermission] = useCameraPermissions();
  const [lastPhoto, setLastPhoto] = useState(null);
  const cameraRef = useRef(null);

  useEffect(() => {
    if (!visible) return;
    (async () => {
      const { status } = await MediaLibrary.requestPermissionsAsync();
      if (status !== 'granted') return;
      const { assets } = await MediaLibrary.getAssetsAsync({ first: 1, sortBy: MediaLibrary.SortBy.creationTime });
      if (assets.length > 0) {
        const info = await MediaLibrary.getAssetInfoAsync(assets[0]);
        setLastPhoto(info.localUri ?? assets[0].uri);
      }
    })();
  }, [visible]);

  async function takePhoto() {
    if (!cameraRef.current) return;
    const result = await cameraRef.current.takePictureAsync({ quality: 0.7 });
    onCapture(result.uri);
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
    if (!result.canceled) onCapture(result.assets[0].uri);
  }

  function renderBody() {
    if (!permission) return null;
    if (!permission.granted) {
      return (
        <View style={styles.permissionContainer}>
          <Text style={styles.permissionText}>camera access needed</Text>
          <TouchableOpacity style={styles.permissionButton} onPress={requestPermission}>
            <Text style={styles.permissionButtonText}>allow camera</Text>
          </TouchableOpacity>
        </View>
      );
    }

    return (
      <View style={styles.cameraContainer}>
        <CameraView ref={cameraRef} style={styles.camera} facing="back" />

        <TouchableOpacity style={styles.cancelOverlay} onPress={onCancel}>
          <Text style={styles.cancelText}>cancel</Text>
        </TouchableOpacity>

        <View style={styles.cameraControls}>
          <TouchableOpacity style={styles.libraryButton} onPress={openLibrary}>
            {lastPhoto ? (
              <Image source={{ uri: lastPhoto }} style={styles.libraryThumbnail} />
            ) : (
              <Ionicons name="image-outline" size={24} color="#fff" />
            )}
          </TouchableOpacity>

          <TouchableOpacity style={styles.shutter} onPress={takePhoto} />

          <View style={styles.shutterSpacer} />
        </View>
      </View>
    );
  }

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onCancel}>
      {renderBody()}
    </Modal>
  );
}

const styles = StyleSheet.create({
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
  cancelText: {
    color: '#fff',
    fontSize: 16,
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
    overflow: 'hidden',
  },
  libraryThumbnail: {
    width: '100%',
    height: '100%',
    borderRadius: 10,
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
  permissionButton: {
    backgroundColor: '#2D2D2D',
    borderRadius: 10,
    paddingVertical: 14,
    paddingHorizontal: 24,
  },
  permissionButtonText: {
    color: '#fff',
    fontSize: 16,
  },
});
