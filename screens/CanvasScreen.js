import * as FileSystem from 'expo-file-system/legacy';
import * as MediaLibrary from 'expo-media-library';
import { memo, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import {
  AlphaType,
  Canvas,
  ColorType,
  Group,
  Image as SkiaImage,
  ImageFormat,
  Rect,
  Skia,
  useCanvasRef,
} from '@shopify/react-native-skia';
import {
  Gesture,
  GestureDetector,
  GestureHandlerRootView,
} from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useDerivedValue, useSharedValue } from 'react-native-reanimated';
import { runOnJS } from 'react-native-worklets';
import { useCollection } from '../lib/CollectionProvider';
import { thumbOf } from '../shared/items';
import { S } from '../shared/strings';
import { C } from '../shared/theme';

const LOGICAL_SIZE = 1000;
const INITIAL_DIM = 200;
const SCAN_SIZE = 64;

async function loadSkiaImageCached(url) {
  let path = await Image.getCachePathAsync(url);
  if (!path) {
    await Image.prefetch(url);
    path = await Image.getCachePathAsync(url);
  }
  if (path) {
    const fileUri = path.startsWith('file://') ? path : `file://${path}`;
    const data = await Skia.Data.fromURI(fileUri);
    if (data) return data;
  }
  return Skia.Data.fromURI(url);
}

function computeTightBounds(skImg, itemWidth, itemHeight) {
  const surface = Skia.Surface.Make(SCAN_SIZE, SCAN_SIZE);
  if (!surface) return null;
  const canvas = surface.getCanvas();
  const src = Skia.XYWHRect(0, 0, skImg.width(), skImg.height());
  const dst = Skia.XYWHRect(0, 0, SCAN_SIZE, SCAN_SIZE);
  canvas.drawImageRect(skImg, src, dst, Skia.Paint());
  surface.flush();
  const pixels = surface.makeImageSnapshot().readPixels(0, 0, {
    width: SCAN_SIZE, height: SCAN_SIZE,
    colorType: ColorType.Alpha_8,
    alphaType: AlphaType.Unpremul,
  });
  if (!pixels) return null;
  let minX = SCAN_SIZE, minY = SCAN_SIZE, maxX = -1, maxY = -1;
  for (let y = 0; y < SCAN_SIZE; y++) {
    for (let x = 0; x < SCAN_SIZE; x++) {
      if (pixels[y * SCAN_SIZE + x] > 10) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  if (maxX === -1) return null;
  return {
    minX: (minX / SCAN_SIZE - 0.5) * itemWidth,
    minY: (minY / SCAN_SIZE - 0.5) * itemHeight,
    maxX: ((maxX + 1) / SCAN_SIZE - 0.5) * itemWidth,
    maxY: ((maxY + 1) / SCAN_SIZE - 0.5) * itemHeight,
  };
}

function stripRuntime(items) {
  return items.map(({ skImage, tightBounds, pending, ...rest }) => rest);
}

// One placed item. While it's the gesture-active item, its transform is driven by the
// shared values on the UI thread (no React re-render per frame); otherwise it reads the
// committed values from props. Memoized so a commit only re-renders the item that moved.
const PlacedItem = memo(function PlacedItem({
  item, isSelected, viewScale, activeId, liveX, liveY, liveScale, liveRot,
}) {
  const hw = item.width / 2;
  const hh = item.height / 2;
  const transform = useDerivedValue(() => {
    const live = activeId.value === item.id;
    return [
      { translateX: live ? liveX.value : item.x },
      { translateY: live ? liveY.value : item.y },
      { rotate: live ? liveRot.value : item.rotation },
      { scale: live ? liveScale.value : item.scale },
    ];
  }, [item.id, item.x, item.y, item.scale, item.rotation]);

  const pad = 3 / item.scale / (viewScale || 1);
  const strokeW = 1.5 / item.scale / (viewScale || 1);
  const b = item.skImage && item.tightBounds
    ? item.tightBounds
    : { minX: -hw, minY: -hh, maxX: hw, maxY: hh };

  return (
    <Group transform={transform}>
      {item.skImage ? (
        <SkiaImage
          image={item.skImage}
          x={-hw}
          y={-hh}
          width={item.width}
          height={item.height}
          fit="contain"
        />
      ) : (
        <Rect x={-hw} y={-hh} width={item.width} height={item.height} color={C.surface} />
      )}
      {isSelected && (
        <Rect
          x={b.minX - pad}
          y={b.minY - pad}
          width={b.maxX - b.minX + pad * 2}
          height={b.maxY - b.minY + pad * 2}
          color={C.ink}
          style="stroke"
          strokeWidth={strokeW}
        />
      )}
    </Group>
  );
});

export default function CanvasScreen({
  onClose,
  collageId,
  tagId,
  tagItems,
  initialTitle,
  initialIsPrivate,
  initialLayout,
}) {
  const insets = useSafeAreaInsets();
  const { createCollage, updateCollage, uploadSkiaImage } = useCollection();
  const [placedItems, setPlacedItems] = useState(() => {
    const seed = initialLayout?.items ?? [];
    return seed.map(p => ({ ...p, skImage: null, tightBounds: null }));
  });
  const [selectedId, setSelectedId] = useState(null);
  const [title, setTitle] = useState(initialTitle ?? '');
  const [isPrivate, setIsPrivate] = useState(initialIsPrivate ?? false);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [canvasSize, setCanvasSize] = useState({ width: 0, height: 0 });
  const canvasRef = useCanvasRef();

  const placedItemsRef = useRef([]);
  const selectedIdRef = useRef(null);

  // Live transform of the gesture-active item, driven on the UI thread. `start*` anchor
  // the gesture; `live*` are what the active PlacedItem renders. Committed to React state
  // only on gesture finalize.
  const activeId = useSharedValue(null);
  const startX = useSharedValue(0);
  const startY = useSharedValue(0);
  const startScale = useSharedValue(1);
  const startRot = useSharedValue(0);
  const liveX = useSharedValue(0);
  const liveY = useSharedValue(0);
  const liveScale = useSharedValue(1);
  const liveRot = useSharedValue(0);

  useEffect(() => { placedItemsRef.current = placedItems; }, [placedItems]);
  useEffect(() => { selectedIdRef.current = selectedId; }, [selectedId]);

  // Square logical canvas centered inside the available space.
  const view = useMemo(() => {
    const drawSize = Math.max(0, Math.min(canvasSize.width, canvasSize.height));
    return {
      drawSize,
      scale: drawSize / LOGICAL_SIZE,
      offsetX: (canvasSize.width - drawSize) / 2,
      offsetY: (canvasSize.height - drawSize) / 2,
    };
  }, [canvasSize]);

  // Load Skia image whenever a placed item with skImage=null is added/seeded.
  // Collages only ever use the 400px thumbnail — never the full-resolution image —
  // so the tray, canvas, and export bake all stay lightweight.
  useEffect(() => {
    placedItems.forEach(p => {
      if (p.skImage !== null) return;
      const thumbUrl = p.thumb_url || p.image_url;
      loadSkiaImageCached(thumbUrl).then(data => {
        if (!data) return;
        const skImg = Skia.Image.MakeImageFromEncoded(data);
        if (!skImg) return;
        let width = p.width;
        let height = p.height;
        if (p.pending || !width || !height) {
          const maxDim = Math.max(skImg.width(), skImg.height());
          const s = INITIAL_DIM / maxDim;
          width = skImg.width() * s;
          height = skImg.height() * s;
        }
        const tightBounds = computeTightBounds(skImg, width, height);
        setPlacedItems(prev => prev.map(q =>
          q.id === p.id ? { ...q, skImage: skImg, width, height, tightBounds, pending: false } : q,
        ));
      });
    });
  }, [placedItems.map(p => p.id).join(',')]);

  function screenToLogical(sx, sy) {
    if (!view.scale) return { x: 0, y: 0 };
    return { x: (sx - view.offsetX) / view.scale, y: (sy - view.offsetY) / view.scale };
  }

  function addToCanvas(collectionItem) {
    const id = `p_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
    setPlacedItems(prev => [...prev, {
      id,
      item_id: collectionItem.id,
      image_url: collectionItem.image_url,
      thumb_url: collectionItem.thumb_url ?? null,
      skImage: null,
      pending: true,
      x: LOGICAL_SIZE / 2,
      y: LOGICAL_SIZE / 2,
      scale: 1,
      rotation: 0,
      width: INITIAL_DIM,
      height: INITIAL_DIM,
      tightBounds: null,
    }]);
    setDirty(true);
  }

  function hitTest(touchX, touchY) {
    const { x: lx, y: ly } = screenToLogical(touchX, touchY);
    const items = placedItemsRef.current;
    for (let i = items.length - 1; i >= 0; i--) {
      const item = items[i];
      const dx = lx - item.x;
      const dy = ly - item.y;
      const cos = Math.cos(-item.rotation);
      const sin = Math.sin(-item.rotation);
      const localX = (cos * dx - sin * dy) / item.scale;
      const localY = (sin * dx + cos * dy) / item.scale;
      const b = item.tightBounds ?? { minX: -item.width / 2, minY: -item.height / 2, maxX: item.width / 2, maxY: item.height / 2 };
      if (localX >= b.minX && localX <= b.maxX && localY >= b.minY && localY <= b.maxY) return item.id;
    }
    return null;
  }

  // Seed the live shared values from a placed item so a gesture can drive it on the UI
  // thread. Re-anchors `start*` to the current live values if it's already active, so a
  // second simultaneous gesture (e.g. pinch starting mid-pan) composes correctly.
  function beginManipulation(id) {
    if (!id) return;
    const item = placedItemsRef.current.find(p => p.id === id);
    if (!item) return;
    if (activeId.value !== id) {
      startX.value = item.x;
      startY.value = item.y;
      startScale.value = item.scale;
      startRot.value = item.rotation;
      liveX.value = item.x;
      liveY.value = item.y;
      liveScale.value = item.scale;
      liveRot.value = item.rotation;
      activeId.value = id;
    } else {
      startX.value = liveX.value;
      startY.value = liveY.value;
      startScale.value = liveScale.value;
      startRot.value = liveRot.value;
    }
  }

  function beginManipulationSelected() {
    beginManipulation(selectedIdRef.current);
  }

  function handleTap(x, y) {
    setSelectedId(hitTest(x, y));
  }

  function handlePanBegin(x, y) {
    const hit = hitTest(x, y);
    if (hit) {
      setSelectedId(hit);
      beginManipulation(hit);
    } else {
      setSelectedId(null);
      activeId.value = null;
    }
  }

  // Write the live transform back into React state. No-op for a pure tap (values
  // unchanged), so tapping doesn't mark the collage dirty.
  function commitManipulation() {
    const id = activeId.value;
    if (!id) return;
    const item = placedItemsRef.current.find(p => p.id === id);
    if (!item) return;
    const x = liveX.value, y = liveY.value, s = liveScale.value, r = liveRot.value;
    if (item.x === x && item.y === y && item.scale === s && item.rotation === r) return;
    setPlacedItems(prev => prev.map(p =>
      p.id === id ? { ...p, x, y, scale: s, rotation: r } : p,
    ));
    setDirty(true);
  }

  // Captured by value into the worklets below; constant for the duration of a gesture
  // since no React re-render happens while dragging.
  const vScale = view.scale;

  const tapGesture = Gesture.Tap()
    .onEnd((e) => {
      'worklet';
      runOnJS(handleTap)(e.x, e.y);
    });

  const panGesture = Gesture.Pan()
    .onBegin((e) => {
      'worklet';
      runOnJS(handlePanBegin)(e.x, e.y);
    })
    .onChange((e) => {
      'worklet';
      if (activeId.value === null || !vScale) return;
      liveX.value = startX.value + e.translationX / vScale;
      liveY.value = startY.value + e.translationY / vScale;
    })
    .onFinalize(() => {
      'worklet';
      runOnJS(commitManipulation)();
    });

  const pinchGesture = Gesture.Pinch()
    .onBegin(() => {
      'worklet';
      runOnJS(beginManipulationSelected)();
    })
    .onChange((e) => {
      'worklet';
      if (activeId.value === null) return;
      liveScale.value = Math.max(0.1, startScale.value * e.scale);
    })
    .onFinalize(() => {
      'worklet';
      runOnJS(commitManipulation)();
    });

  const rotationGesture = Gesture.Rotation()
    .onBegin(() => {
      'worklet';
      runOnJS(beginManipulationSelected)();
    })
    .onChange((e) => {
      'worklet';
      if (activeId.value === null) return;
      liveRot.value = startRot.value + e.rotation;
    })
    .onFinalize(() => {
      'worklet';
      runOnJS(commitManipulation)();
    });

  const composedGesture = Gesture.Simultaneous(
    Gesture.Race(tapGesture, panGesture),
    pinchGesture,
    rotationGesture,
  );

  function requestClose() {
    if (saving) return;
    if (!dirty) { onClose(); return; }
    Alert.alert(
      S.collages.discardChangesTitle,
      S.collages.discardChangesMessage,
      [
        { text: S.collages.keepEditing, style: 'cancel' },
        { text: S.collages.discardChangesAction, style: 'destructive', onPress: onClose },
      ],
    );
  }

  async function takeSnapshot() {
    if (!canvasRef.current || !view.drawSize) return null;
    setSelectedId(null);
    // One frame so the selection border disappears from the snapshot.
    await new Promise(r => setTimeout(r, 16));
    const rect = Skia.XYWHRect(view.offsetX, view.offsetY, view.drawSize, view.drawSize);
    return canvasRef.current.makeImageSnapshot(rect);
  }

  async function snapshotToFile(prefix) {
    const snapshot = await takeSnapshot();
    if (!snapshot) return null;
    const base64 = snapshot.encodeToBase64(ImageFormat.PNG, 100);
    const uri = `${FileSystem.cacheDirectory}${prefix}_${Date.now()}.png`;
    await FileSystem.writeAsStringAsync(uri, base64, { encoding: FileSystem.EncodingType.Base64 });
    return uri;
  }

  async function bakeCover() {
    const snapshot = await takeSnapshot();
    if (!snapshot) return null;
    return uploadSkiaImage(snapshot);
  }

  async function handleExport() {
    try {
      const { status } = await MediaLibrary.requestPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(S.canvas.permissionNeeded, S.canvas.permissionMessage);
        return;
      }
      const uri = await snapshotToFile('canvas');
      if (!uri) { Alert.alert(S.canvas.error, S.canvas.failedSnapshot); return; }
      await MediaLibrary.saveToLibraryAsync(uri);
      Alert.alert(S.canvas.saved, S.canvas.savedMessage);
    } catch (e) {
      Alert.alert(S.canvas.exportFailed, e.message);
    }
  }

  async function handleSave() {
    if (saving) return;
    setSaving(true);
    try {
      const cover = await bakeCover();
      const layout = {
        canvas: { size: LOGICAL_SIZE },
        items: stripRuntime(placedItems),
      };
      const patch = {
        title: title.trim(),
        layout,
        is_private: isPrivate,
        ...(cover ? { cover_url: cover.image_url, cover_thumb_url: cover.thumb_url } : {}),
      };
      const row = collageId
        ? await updateCollage(collageId, patch)
        : await createCollage({
            tagId,
            title: patch.title,
            layout,
            isPrivate,
            coverUrl: cover?.image_url ?? null,
            coverThumbUrl: cover?.thumb_url ?? null,
          });
      if (!row) {
        Alert.alert(S.collages.saveFailed);
        return;
      }
      setDirty(false);
      onClose();
    } catch (e) {
      console.error('Save collage failed:', e);
      Alert.alert(S.collages.saveFailed, e.message);
    } finally {
      setSaving(false);
    }
  }

  const canvasReady = view.drawSize > 0;
  const selectedItem = placedItems.find(p => p.id === selectedId);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <View style={[styles.container, { paddingTop: insets.top + 8 }]}>
          <View style={styles.header}>
            <TouchableOpacity onPress={requestClose} style={styles.iconBtn} hitSlop={8}>
              <Ionicons name="chevron-back" size={24} color={C.ink} />
            </TouchableOpacity>
            <TextInput
              style={styles.titleInput}
              value={title}
              onChangeText={(v) => { setTitle(v); setDirty(true); }}
              placeholder={S.collages.titlePlaceholder}
              placeholderTextColor="#bbb"
              autoCorrect={false}
              returnKeyType="done"
            />
            <TouchableOpacity
              onPress={() => { setIsPrivate(v => !v); setDirty(true); }}
              style={styles.iconBtn}
              hitSlop={8}
            >
              <Ionicons
                name={isPrivate ? 'lock-closed' : 'lock-open-outline'}
                size={20}
                color={isPrivate ? C.ink : '#ccc'}
              />
            </TouchableOpacity>
            <TouchableOpacity onPress={handleExport} style={styles.iconBtn} hitSlop={8}>
              <Ionicons name="download-outline" size={20} color="#999" />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={handleSave}
              style={styles.saveBtn}
              disabled={saving}
              hitSlop={4}
            >
              <Text style={[styles.saveText, saving && styles.saveTextDisabled]}>
                {saving ? S.collages.saving : S.collages.save}
              </Text>
            </TouchableOpacity>
          </View>

          <View
            style={styles.canvasContainer}
            onLayout={e => {
              const { width, height } = e.nativeEvent.layout;
              setCanvasSize({ width, height });
            }}
          >
            {canvasReady && (
              <GestureDetector gesture={composedGesture}>
                <Canvas
                  ref={canvasRef}
                  style={{ width: canvasSize.width, height: canvasSize.height }}
                >
                  <Rect x={0} y={0} width={canvasSize.width} height={canvasSize.height} color={C.surface} />
                  <Group
                    transform={[
                      { translateX: view.offsetX },
                      { translateY: view.offsetY },
                      { scale: view.scale },
                    ]}
                  >
                    <Rect x={0} y={0} width={LOGICAL_SIZE} height={LOGICAL_SIZE} color="white" />
                    {placedItems.map(item => (
                      <PlacedItem
                        key={item.id}
                        item={item}
                        isSelected={item.id === selectedId}
                        viewScale={view.scale}
                        activeId={activeId}
                        liveX={liveX}
                        liveY={liveY}
                        liveScale={liveScale}
                        liveRot={liveRot}
                      />
                    ))}
                  </Group>
                </Canvas>
              </GestureDetector>
            )}
            {canvasReady && placedItems.filter(p => !p.skImage).map(item => {
              const screenX = view.offsetX + item.x * view.scale;
              const screenY = view.offsetY + item.y * view.scale;
              return (
                <View
                  key={`spinner_${item.id}`}
                  pointerEvents="none"
                  style={[styles.spinner, { left: screenX - 10, top: screenY - 10 }]}
                >
                  <ActivityIndicator size="small" color="#999" />
                </View>
              );
            })}
          </View>

          <View style={[styles.bottomBar, { paddingBottom: Math.max(insets.bottom, 8) }]}>
            <View style={[styles.selectionBar, !selectedItem && styles.hidden]}>
              <TouchableOpacity
                style={styles.removeBtn}
                onPress={() => {
                  setPlacedItems(prev => prev.filter(p => p.id !== selectedId));
                  setSelectedId(null);
                  setDirty(true);
                }}
              >
                <Text style={styles.removeBtnText}>{S.common.remove}</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setSelectedId(null)} style={styles.doneBtn}>
                <Text style={styles.doneBtnText}>{S.common.done}</Text>
              </TouchableOpacity>
            </View>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.trayContent}
              style={[styles.tray, selectedItem && styles.hidden]}
            >
              {(tagItems ?? []).map(item => (
                <TouchableOpacity
                  key={item.id}
                  style={styles.trayItem}
                  onPress={() => addToCanvas(item)}
                >
                  {item.image_url && (
                    <Image
                      source={{ uri: thumbOf(item) }}
                      style={styles.trayImage}
                      cachePolicy="memory-disk"
                      contentFit="cover"
                    />
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
      </View>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: C.bg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingBottom: 10,
    gap: 6,
  },
  iconBtn: {
    padding: 4,
  },
  titleInput: {
    flex: 1,
    fontSize: 16,
    color: C.ink,
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  saveBtn: {
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  saveText: {
    fontSize: 16,
    fontWeight: '500',
    color: C.ink,
  },
  saveTextDisabled: {
    color: '#999',
  },
  canvasContainer: {
    flex: 1,
    backgroundColor: C.surface,
  },
  spinner: {
    position: 'absolute',
    width: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bottomBar: {
    height: 92,
    backgroundColor: '#fff',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#E5E5E5',
  },
  selectionBar: {
    ...StyleSheet.absoluteFillObject,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
  },
  tray: {
    ...StyleSheet.absoluteFillObject,
  },
  hidden: {
    display: 'none',
  },
  removeBtn: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: C.redSoft,
  },
  removeBtnText: {
    fontSize: 15,
    color: C.red,
  },
  doneBtn: {
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  doneBtnText: {
    fontSize: 15,
    color: C.ink,
  },
  trayContent: {
    padding: 12,
    gap: 10,
    alignItems: 'center',
  },
  trayItem: {
    alignItems: 'center',
    width: 64,
  },
  trayImage: {
    width: 56,
    height: 56,
    borderRadius: 8,
    backgroundColor: C.surface,
  },
});
