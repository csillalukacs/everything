import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as MediaLibrary from 'expo-media-library';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useEffect, useRef, useState } from 'react';
import { removeBackground } from '@jacobjmc/react-native-background-remover';
import { encode as encodeBase64 } from 'base64-arraybuffer';
import * as FileSystem from 'expo-file-system/legacy';
import { AlphaType, ColorType, ImageFormat, Skia } from '@shopify/react-native-skia';
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

const CROP_SCAN = 64;

async function cropToContent(uri) {
  const data = await Skia.Data.fromURI(uri);
  const img = Skia.Image.MakeImageFromEncoded(data);
  if (!img) return uri;

  const W = img.width();
  const H = img.height();

  // Sample alpha at reduced resolution to find content bounds
  const scanSurf = Skia.Surface.Make(CROP_SCAN, CROP_SCAN);
  if (!scanSurf) return uri;
  const scanCanvas = scanSurf.getCanvas();
  scanCanvas.drawImageRect(img, Skia.XYWHRect(0, 0, W, H), Skia.XYWHRect(0, 0, CROP_SCAN, CROP_SCAN), Skia.Paint());
  scanSurf.flush();
  const pixels = scanSurf.makeImageSnapshot().readPixels(0, 0, {
    width: CROP_SCAN, height: CROP_SCAN,
    colorType: ColorType.Alpha_8,
    alphaType: AlphaType.Unpremul,
  });
  if (!pixels) return uri;

  let minX = CROP_SCAN, minY = CROP_SCAN, maxX = -1, maxY = -1;
  for (let y = 0; y < CROP_SCAN; y++) {
    for (let x = 0; x < CROP_SCAN; x++) {
      if (pixels[y * CROP_SCAN + x] > 10) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  if (maxX === -1) return uri;

  // Map scan-space bounds to full-res pixel coords
  const ox = Math.floor(minX / CROP_SCAN * W);
  const oy = Math.floor(minY / CROP_SCAN * H);
  const ex = Math.ceil((maxX + 1) / CROP_SCAN * W);
  const ey = Math.ceil((maxY + 1) / CROP_SCAN * H);

  const cX = (ox + ex) / 2;
  const cY = (oy + ey) / 2;
  // Square side = larger content dimension + 10% padding
  const cropSize = Math.min(
    Math.ceil(Math.max(ex - ox, ey - oy) * 1.1),
    W, H
  );
  const cropX = Math.max(0, Math.min(W - cropSize, Math.round(cX - cropSize / 2)));
  const cropY = Math.max(0, Math.min(H - cropSize, Math.round(cY - cropSize / 2)));

  const outSurf = Skia.Surface.Make(cropSize, cropSize);
  if (!outSurf) return uri;
  outSurf.getCanvas().drawImageRect(
    img,
    Skia.XYWHRect(cropX, cropY, cropSize, cropSize),
    Skia.XYWHRect(0, 0, cropSize, cropSize),
    Skia.Paint()
  );
  outSurf.flush();

  const bytes = outSurf.makeImageSnapshot().encodeToBytes(ImageFormat.PNG, 100);
  if (!bytes) return uri;

  const b64 = encodeBase64(bytes.buffer);
  const outPath = `${FileSystem.cacheDirectory}cropped_${Date.now()}.png`;
  await FileSystem.writeAsStringAsync(outPath, b64, { encoding: FileSystem.EncodingType.Base64 });
  return outPath;
}

export default function AddItemModal({ visible, onClose, onSave, allTags = [] }) {
  const [photo, setPhoto] = useState(null);
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);
  const [tags, setTags] = useState([]);
  const [isPrivate, setIsPrivate] = useState(false);
  const [addingTag, setAddingTag] = useState(false);
  const [newTagName, setNewTagName] = useState('');
  const [permission, requestPermission] = useCameraPermissions();
  const [lastPhoto, setLastPhoto] = useState(null);
  const [removingBg, setRemovingBg] = useState(false);
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
    setPhoto(result.uri);
    setRemovingBg(true);
    try {
      const cleaned = await removeBackground(result.uri);
      setPhoto(await cropToContent(cleaned));
    } finally {
      setRemovingBg(false);
    }
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

    if (!result.canceled) {
      const uri = result.assets[0].uri;
      setPhoto(uri);
      setRemovingBg(true);
      try {
        const cleaned = await removeBackground(uri);
        setPhoto(await cropToContent(cleaned));
      } finally {
        setRemovingBg(false);
      }
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
    await onSave(name.trim(), photo, tags, isPrivate);
    setName('');
    setPhoto(null);
    setTags([]);
    setIsPrivate(false);
    setSaving(false);
  }

  function handleClose() {
    setPhoto(null);
    setName('');
    setTags([]);
    setIsPrivate(false);
    setAddingTag(false);
    setNewTagName('');
    onClose();
  }

  const allTagNames = allTags.map(t => (typeof t === 'string' ? t : t.name));
  const tagPrivacyMap = Object.fromEntries(allTags.filter(t => typeof t === 'object').map(t => [t.name, t.is_private]));
  const tagOptions = [...new Set([...allTagNames, ...tags])].sort();

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

        <TouchableOpacity style={styles.cancelOverlay} onPress={handleClose}>
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
    <Modal visible={visible} animationType="slide" onRequestClose={handleClose}>
      {photo ? (
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
