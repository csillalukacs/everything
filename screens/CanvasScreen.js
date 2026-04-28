import * as FileSystem from 'expo-file-system/legacy';
import * as MediaLibrary from 'expo-media-library';
import { useEffect, useRef, useState } from 'react';
import {
  Alert,
  Image,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
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

const INITIAL_SIZE = 120;
const SCAN_SIZE = 64;

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

export default function CanvasScreen({ visible, onClose, items }) {
  const [placedItems, setPlacedItems] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [canvasSize, setCanvasSize] = useState({ width: 0, height: 0 });
  const canvasRef = useCanvasRef();

  // Refs so gesture callbacks always see latest state
  const placedItemsRef = useRef([]);
  const selectedIdRef = useRef(null);
  const panStartRef = useRef(null);
  const pinchStartRef = useRef(null);
  const rotStartRef = useRef(null);

  useEffect(() => { placedItemsRef.current = placedItems; }, [placedItems]);
  useEffect(() => { selectedIdRef.current = selectedId; }, [selectedId]);

  // Load Skia image whenever a new item with skImage=null is added
  useEffect(() => {
    placedItems.forEach(item => {
      if (item.skImage === null) {
        Skia.Data.fromURI(item.imageUrl).then(data => {
          const skImg = Skia.Image.MakeImageFromEncoded(data);
          if (skImg) {
            const maxDim = Math.max(skImg.width(), skImg.height());
            const scale = INITIAL_SIZE / maxDim;
            const w = skImg.width() * scale;
            const h = skImg.height() * scale;
            const tightBounds = computeTightBounds(skImg, w, h);
            setPlacedItems(prev => prev.map(p =>
              p.id === item.id
                ? { ...p, skImage: skImg, width: w, height: h, tightBounds }
                : p
            ));
          }
        });
      }
    });
  }, [placedItems.map(p => p.id).join(',')]);

  // Reset state when modal closes
  useEffect(() => {
    if (!visible) {
      setPlacedItems([]);
      setSelectedId(null);
    }
  }, [visible]);

  function addToCanvas(collectionItem) {
    const id = String(Date.now());
    setPlacedItems(prev => [...prev, {
      id,
      imageUrl: collectionItem.image_url,
      skImage: null,
      x: canvasSize.width / 2,
      y: canvasSize.height / 2,
      scale: 1,
      rotation: 0,
      width: INITIAL_SIZE,
      height: INITIAL_SIZE,
    }]);
    setSelectedId(id);
  }

  function hitTest(touchX, touchY) {
    const items = placedItemsRef.current;
    for (let i = items.length - 1; i >= 0; i--) {
      const item = items[i];
      if (!item.skImage) continue;

      const dx = touchX - item.x;
      const dy = touchY - item.y;
      const cos = Math.cos(-item.rotation);
      const sin = Math.sin(-item.rotation);
      const localX = (cos * dx - sin * dy) / item.scale;
      const localY = (sin * dx + cos * dy) / item.scale;

      const b = item.tightBounds ?? { minX: -item.width / 2, minY: -item.height / 2, maxX: item.width / 2, maxY: item.height / 2 };
      if (localX >= b.minX && localX <= b.maxX && localY >= b.minY && localY <= b.maxY) return item.id;
    }
    return null;
  }

  function updateSelected(updates) {
    const id = selectedIdRef.current;
    if (!id) return;
    setPlacedItems(prev => prev.map(p => p.id === id ? { ...p, ...updates } : p));
  }

  const tapGesture = Gesture.Tap().runOnJS(true).onEnd((e) => {
    const hit = hitTest(e.x, e.y);
    setSelectedId(hit);
  });

  const panGesture = Gesture.Pan().runOnJS(true)
    .onBegin((e) => {
      const hit = hitTest(e.x, e.y);
      if (hit) {
        setSelectedId(hit);
        const item = placedItemsRef.current.find(p => p.id === hit);
        panStartRef.current = { x: item.x, y: item.y };
      } else {
        panStartRef.current = null;
        setSelectedId(null);
      }
    })
    .onChange((e) => {
      if (!panStartRef.current) return;
      const id = selectedIdRef.current;
      if (!id) return;
      setPlacedItems(prev => prev.map(p =>
        p.id === id
          ? { ...p, x: panStartRef.current.x + e.translationX, y: panStartRef.current.y + e.translationY }
          : p
      ));
    });

  const pinchGesture = Gesture.Pinch().runOnJS(true)
    .onBegin(() => {
      const item = placedItemsRef.current.find(p => p.id === selectedIdRef.current);
      pinchStartRef.current = item?.scale ?? 1;
    })
    .onChange((e) => {
      if (pinchStartRef.current === null) return;
      updateSelected({ scale: Math.max(0.1, pinchStartRef.current * e.scale) });
    });

  const rotationGesture = Gesture.Rotation().runOnJS(true)
    .onBegin(() => {
      const item = placedItemsRef.current.find(p => p.id === selectedIdRef.current);
      rotStartRef.current = item?.rotation ?? 0;
    })
    .onChange((e) => {
      if (rotStartRef.current === null) return;
      updateSelected({ rotation: rotStartRef.current + e.rotation });
    });

  const composedGesture = Gesture.Simultaneous(
    Gesture.Race(tapGesture, panGesture),
    pinchGesture,
    rotationGesture,
  );

  async function handleExport() {
    try {
      if (!canvasRef.current) {
        Alert.alert('Error', 'Canvas not ready');
        return;
      }
      const { status } = await MediaLibrary.requestPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission needed', 'Allow photo library access to save the canvas.');
        return;
      }
      const snapshot = canvasRef.current.makeImageSnapshot();
      if (!snapshot) {
        Alert.alert('Error', 'Failed to snapshot canvas');
        return;
      }
      const base64 = snapshot.encodeToBase64(ImageFormat.PNG, 100);
      const uri = FileSystem.cacheDirectory + `canvas_${Date.now()}.png`;
      await FileSystem.writeAsStringAsync(uri, base64, { encoding: FileSystem.EncodingType.Base64 });
      await MediaLibrary.saveToLibraryAsync(uri);
      Alert.alert('Saved', 'Canvas saved to your photo library.');
    } catch (e) {
      Alert.alert('Export failed', e.message);
    }
  }

  const canvasReady = canvasSize.width > 0 && canvasSize.height > 0;

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <View style={styles.container}>

          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity onPress={onClose} style={styles.headerBtn}>
              <Text style={styles.headerBtnText}>cancel</Text>
            </TouchableOpacity>
            <Text style={styles.headerTitle}>canvas</Text>
            <TouchableOpacity onPress={handleExport} style={styles.headerBtn}>
              <Text style={[styles.headerBtnText, styles.exportText]}>export</Text>
            </TouchableOpacity>
          </View>

          {/* Canvas area */}
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
                  {/* White background */}
                  <Rect x={0} y={0} width={canvasSize.width} height={canvasSize.height} color="white" />

                  {/* Placed items */}
                  {placedItems.map(item => {
                    const hw = item.width / 2;
                    const hh = item.height / 2;

                    if (!item.skImage) {
                      return (
                        <Rect key={item.id} x={item.x - hw} y={item.y - hh} width={item.width} height={item.height} color="#E8E3DD" />
                      );
                    }
                    const isSelected = item.id === selectedId;
                    return (
                      <Group
                        key={item.id}
                        transform={[
                          { translateX: item.x },
                          { translateY: item.y },
                          { rotate: item.rotation },
                          { scale: item.scale },
                        ]}
                      >
                        <SkiaImage
                          image={item.skImage}
                          x={-hw}
                          y={-hh}
                          width={item.width}
                          height={item.height}
                          fit="contain"
                        />
                        {isSelected && (() => {
                          const b = item.tightBounds ?? { minX: -hw, minY: -hh, maxX: hw, maxY: hh };
                          const pad = 3 / item.scale;
                          return <Rect x={b.minX - pad} y={b.minY - pad} width={b.maxX - b.minX + pad * 2} height={b.maxY - b.minY + pad * 2} color="#2D2D2D" style="stroke" strokeWidth={1.5 / item.scale} />;
                        })()}
                      </Group>
                    );
                  })}
                </Canvas>
              </GestureDetector>
            )}
          </View>

          {/* Bottom bar */}
          <View style={styles.bottomBar}>
            {selectedId ? (
              <View style={styles.selectionBar}>
                <TouchableOpacity
                  style={styles.removeBtn}
                  onPress={() => {
                    setPlacedItems(prev => prev.filter(p => p.id !== selectedId));
                    setSelectedId(null);
                  }}
                >
                  <Text style={styles.removeBtnText}>remove</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => setSelectedId(null)} style={styles.doneBtn}>
                  <Text style={styles.doneBtnText}>done</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.trayContent}
              >
                {items.map(item => (
                  <TouchableOpacity
                    key={item.id}
                    style={styles.trayItem}
                    onPress={() => addToCanvas(item)}
                  >
                    {item.image_url && (
                      <Image source={{ uri: item.image_url }} style={styles.trayImage} />
                    )}
                  </TouchableOpacity>
                ))}
              </ScrollView>
            )}
          </View>

        </View>
      </GestureHandlerRootView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F0EB',
    paddingTop: 60,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 12,
  },
  headerBtn: {
    padding: 4,
    minWidth: 60,
  },
  headerBtnText: {
    fontSize: 16,
    color: '#2D2D2D',
  },
  exportText: {
    fontWeight: '500',
    textAlign: 'right',
  },
  headerTitle: {
    fontSize: 16,
    color: '#2D2D2D',
    letterSpacing: 1,
  },
  canvasContainer: {
    flex: 1,
    backgroundColor: '#E8E3DD',
  },
  bottomBar: {
    height: 100,
    backgroundColor: '#fff',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#E5E5E5',
  },
  selectionBar: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
  },
  removeBtn: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: '#FDF0EE',
  },
  removeBtnText: {
    fontSize: 15,
    color: '#E74C3C',
  },
  doneBtn: {
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  doneBtnText: {
    fontSize: 15,
    color: '#2D2D2D',
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
    backgroundColor: '#E8E3DD',
  },
});
