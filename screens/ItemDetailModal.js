import { Ionicons } from '@expo/vector-icons';
import { useEffect, useRef, useState } from 'react';
import { removeBackground } from '@jacobjmc/react-native-background-remover';
import {
  ActivityIndicator,
  Dimensions,
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
import { Image } from 'expo-image';
import { GestureDetector, Gesture, GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, { useSharedValue, useAnimatedStyle, withSpring, withTiming } from 'react-native-reanimated';
import { runOnJS } from 'react-native-worklets';

const SCREEN_WIDTH = Dimensions.get('window').width;
import { cropToContent } from '../lib/cropToContent';
import { ocrImage } from '../lib/ocr';
import { S } from '../shared/strings';
import CameraCaptureModal from './CameraCaptureModal';
import LocationPicker from './LocationPicker';

export default function ItemDetailModal({ item, visible, onClose, onDelete, onSave, allTags = [], autoEdit = false, onPrev, onNext, onTagPress, onYearPress, onCityPress }) {
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editPhoto, setEditPhoto] = useState(null);
  const [editImageAddedAt, setEditImageAddedAt] = useState(null);
  const [editPreviousImages, setEditPreviousImages] = useState([]);
  const [displayedIdx, setDisplayedIdx] = useState(0);
  const [editTags, setEditTags] = useState([]);
  const [editPrivate, setEditPrivate] = useState(false);
  const [editYear, setEditYear] = useState('');
  const [editAcquired, setEditAcquired] = useState(null);
  const [saving, setSaving] = useState(false);
  const [removingBg, setRemovingBg] = useState(false);
  const [cameraVisible, setCameraVisible] = useState(false);
  const [nameEditable, setNameEditable] = useState(false);
  const [addingTag, setAddingTag] = useState(false);
  const [newTagName, setNewTagName] = useState('');
  const nameInputRef = useRef(null);
  const scrollRef = useRef(null);
  const ocrPromiseRef = useRef(null);
  const translateX = useSharedValue(0);
  const pendingDir = useRef(null);

  function triggerPrev() {
    pendingDir.current = 'prev';
    onPrev();
  }

  function triggerNext() {
    pendingDir.current = 'next';
    onNext();
  }

  const swipeGesture = Gesture.Pan()
    .activeOffsetX([-20, 20])
    .failOffsetY([-20, 20])
    .onUpdate((e) => {
      translateX.value = e.translationX;
    })
    .onEnd((e) => {
      const threshold = 80;
      if (e.translationX > threshold && onPrev) {
        translateX.value = withTiming(SCREEN_WIDTH, { duration: 200 }, (finished) => {
          if (finished) runOnJS(triggerPrev)();
        });
      } else if (e.translationX < -threshold && onNext) {
        translateX.value = withTiming(-SCREEN_WIDTH, { duration: 200 }, (finished) => {
          if (finished) runOnJS(triggerNext)();
        });
      } else {
        translateX.value = withSpring(0);
      }
    });

  useEffect(() => {
    setDisplayedIdx(0);
    if (!pendingDir.current) return;
    translateX.value = pendingDir.current === 'next' ? SCREEN_WIDTH : -SCREEN_WIDTH;
    translateX.value = withTiming(0, { duration: 220 });
    pendingDir.current = null;
  }, [item?.id]);

  const swipeStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));

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
    setEditDescription(item.description ?? '');
    setEditPhoto(item.image_url);
    setEditImageAddedAt(item.image_added_at ?? item.created_at);
    setEditPreviousImages(item.previous_images ?? []);
    setDisplayedIdx(0);
    setEditTags((item.tags ?? []).map(t => t.name));
    setEditPrivate(item.is_private ?? false);
    setEditYear(item.acquired_year ? String(item.acquired_year) : '');
    setEditAcquired(item.acquired_location
      ? { location: item.acquired_location, lat: item.acquired_lat, lng: item.acquired_lng }
      : null);
    setNameEditable(false);
    setEditing(true);
  }

  function cancelEdit() {
    setEditing(false);
    setAddingTag(false);
    setNewTagName('');
    setEditDescription('');
    setDisplayedIdx(0);
    ocrPromiseRef.current = null;
  }

  async function handleCaptured(uri) {
    setCameraVisible(false);
    if (editPhoto && editPhoto.startsWith('http')) {
      const kept = { url: editPhoto, added_at: editImageAddedAt ?? item?.created_at };
      setEditPreviousImages(prev => [kept, ...prev]);
    }
    setEditImageAddedAt(new Date().toISOString());
    setDisplayedIdx(0);
    setEditPhoto(uri);
    setRemovingBg(true);
    ocrPromiseRef.current = ocrImage(uri);
    try {
      const cleaned = await removeBackground(uri);
      setEditPhoto(await cropToContent(cleaned));
    } finally {
      setRemovingBg(false);
    }
  }

  function removePreviousPhoto(idx) {
    setEditPreviousImages(prev => prev.filter((_, i) => i !== idx));
    setDisplayedIdx(curr => {
      const removedDisplayIdx = idx + 1;
      if (curr === removedDisplayIdx) return 0;
      if (curr > removedDisplayIdx) return curr - 1;
      return curr;
    });
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

  function buildAcquired() {
    const y = editYear.trim();
    const yearNum = y ? parseInt(y, 10) : null;
    const validYear = yearNum && yearNum >= 1800 && yearNum <= 2100 ? yearNum : null;
    return {
      year: validYear,
      location: editAcquired?.location ?? null,
      lat: editAcquired?.lat ?? null,
      lng: editAcquired?.lng ?? null,
    };
  }

  async function handleSave() {
    setSaving(true);
    const ocrText = ocrPromiseRef.current ? await ocrPromiseRef.current : undefined;
    await onSave(editName.trim(), editPhoto, editTags, editPrivate, editDescription.trim(), buildAcquired(), ocrText, editPreviousImages, editImageAddedAt);
    ocrPromiseRef.current = null;
    setSaving(false);
    setEditing(false);
    setEditDescription('');
    setDisplayedIdx(0);
  }

  if (!item) return null;

  const allPhotos = editing
    ? [{ url: editPhoto, added_at: editImageAddedAt }, ...editPreviousImages]
    : [
        { url: item.image_url, added_at: item.image_added_at ?? item.created_at },
        ...(item.previous_images ?? []),
      ];
  const safeDisplayedIdx = Math.min(displayedIdx, allPhotos.length - 1);
  const displayedEntry = allPhotos[safeDisplayedIdx] ?? {};
  const displayPhoto = displayedEntry.url;
  const displayedDate = displayedEntry.added_at;

  function renderPhotoExtras() {
    const hasMultiple = allPhotos.filter(p => p?.url).length > 1;
    if (!hasMultiple && !displayedDate) return null;
    return (
      <View style={styles.photoExtras}>
        {displayedDate ? (
          <Text style={styles.photoDate}>
            {S.itemForm.photoFrom(new Date(displayedDate).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }))}
          </Text>
        ) : null}
        {hasMultiple && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.thumbnailScroll}
            contentContainerStyle={styles.thumbnailRow}
          >
            {allPhotos.map((entry, idx) => {
              if (!entry?.url) return null;
              const selected = idx === safeDisplayedIdx;
              const removable = editing && idx > 0;
              return (
                <View key={`${entry.url}-${idx}`} style={styles.thumbnailWrap}>
                  <TouchableOpacity
                    onPress={() => setDisplayedIdx(idx)}
                    style={[styles.thumbnail, selected && styles.thumbnailSelected]}
                    activeOpacity={0.8}
                  >
                    <Image source={{ uri: entry.url }} style={styles.thumbnailImage} cachePolicy="memory-disk" contentFit="cover" />
                  </TouchableOpacity>
                  {removable && (
                    <TouchableOpacity
                      onPress={() => removePreviousPhoto(idx - 1)}
                      style={styles.thumbnailRemove}
                      hitSlop={6}
                    >
                      <Ionicons name="close" size={14} color="#fff" />
                    </TouchableOpacity>
                  )}
                </View>
              );
            })}
          </ScrollView>
        )}
      </View>
    );
  }
  const itemTags = item.tags ?? [];
  const allTagNames = allTags.map(t => (typeof t === 'string' ? t : t.name));
  const tagPrivacyMap = Object.fromEntries(allTags.filter(t => typeof t === 'object').map(t => [t.name, t.is_private]));
  const tagOptions = [...new Set([...allTagNames, ...editTags])].sort();

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={editing ? cancelEdit : onClose}>
      <GestureHandlerRootView style={{ flex: 1 }}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View style={styles.header}>
          <TouchableOpacity onPress={editing ? cancelEdit : onClose} style={styles.headerButton}>
            {editing
              ? <Text style={styles.headerButtonText}>{S.common.cancel}</Text>
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
          {onSave ? (
            <TouchableOpacity onPress={editing ? handleSave : enterEdit} style={styles.headerButton} disabled={saving}>
              <Text style={[styles.headerButtonText, editing && styles.saveText]}>
                {editing ? (saving ? S.common.saving : S.common.save) : S.common.edit}
              </Text>
            </TouchableOpacity>
          ) : (
            <View style={styles.headerButton} />
          )}
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
                ? <Image source={{ uri: displayPhoto }} style={styles.image} cachePolicy="memory-disk" contentFit="cover" />
                : <View style={styles.imagePlaceholder} />
              }
              {removingBg ? (
                <View style={styles.photoOverlay}>
                  <ActivityIndicator color="#fff" />
                  <Text style={styles.photoActionText}>{S.common.removingBackground}</Text>
                </View>
              ) : (
                <TouchableOpacity style={styles.photoOverlay} onPress={() => setCameraVisible(true)}>
                  <View style={styles.photoAction}>
                    <Ionicons name="camera-outline" size={22} color="#fff" />
                    <Text style={styles.photoActionText}>{S.common.changePhoto}</Text>
                  </View>
                </TouchableOpacity>
              )}
              <TouchableOpacity
                style={[styles.privacyCorner, editPrivate && styles.privacyCornerOn]}
                onPress={() => setEditPrivate(prev => !prev)}
              >
                <Ionicons
                  name={editPrivate ? 'lock-closed' : 'lock-open-outline'}
                  size={16}
                  color="#fff"
                />
              </TouchableOpacity>
            </View>

            {renderPhotoExtras()}

            <CameraCaptureModal
              visible={cameraVisible}
              onCapture={handleCaptured}
              onCancel={() => setCameraVisible(false)}
            />

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
                      placeholder={S.itemForm.tagPlaceholder}
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
                  placeholder={S.itemForm.namePlaceholder}
                  placeholderTextColor="#bbb"
                  editable={nameEditable}
                  pointerEvents={nameEditable ? 'auto' : 'none'}
                  returnKeyType="done"
                  onSubmitEditing={Keyboard.dismiss}
                />
              </TouchableOpacity>
              <TextInput
                style={styles.nameInput}
                value={editDescription}
                onChangeText={setEditDescription}
                placeholder={S.itemForm.descriptionPlaceholder}
                placeholderTextColor="#bbb"
                returnKeyType="done"
                onSubmitEditing={Keyboard.dismiss}
              />

              <TextInput
                style={styles.nameInput}
                placeholder={S.itemForm.yearPlaceholder}
                placeholderTextColor="#bbb"
                value={editYear}
                onChangeText={t => setEditYear(t.replace(/[^0-9]/g, '').slice(0, 4))}
                keyboardType="number-pad"
                maxLength={4}
                returnKeyType="done"
                onSubmitEditing={Keyboard.dismiss}
              />

              <LocationPicker value={editAcquired} onChange={setEditAcquired} placeholder={S.itemForm.cityPlaceholder} />
            </View>
          </ScrollView>
        ) : (
          <GestureDetector gesture={swipeGesture}>
          <Animated.View style={[{ flex: 1 }, swipeStyle]}>
            <View style={styles.imageContainer}>
              {displayPhoto
                ? <Image source={{ uri: displayPhoto }} style={styles.image} cachePolicy="memory-disk" contentFit="cover" />
                : <View style={styles.imagePlaceholder} />
              }
            </View>
            {renderPhotoExtras()}
            <View style={styles.info}>
              <View style={styles.nameRow}>
                {item.name ? <Text style={styles.name}>{item.name}</Text> : null}
                {item.is_private && <Ionicons name="lock-closed" size={16} color="#999" style={styles.privateLockIcon} />}
              </View>
              {itemTags.length > 0 && (
                <View style={styles.tagRow}>
                  {itemTags.map(tag => {
                    const Wrapper = onTagPress ? TouchableOpacity : View;
                    return (
                      <Wrapper
                        key={tag.id}
                        style={styles.tagBadge}
                        {...(onTagPress ? { onPress: () => onTagPress(tag) } : {})}
                      >
                        {tag.is_private && <Ionicons name="lock-closed" size={9} color="#bbb" />}
                        <Text style={styles.tagBadgeText}>{tag.name}</Text>
                      </Wrapper>
                    );
                  })}
                </View>
              )}
              {item.description ? <Text style={styles.description}>{item.description}</Text> : null}
              {(item.acquired_location || item.acquired_year) && (
                <Text style={styles.acquired}>
                  {S.itemForm.acquired}
                  {item.acquired_location ? (
                    <>
                      <Text>{S.itemForm.acquiredIn}</Text>
                      {onCityPress ? (
                        <Text
                          style={styles.acquiredLink}
                          onPress={() => onCityPress(item.acquired_location.split(',')[0])}
                        >{item.acquired_location.split(',')[0]}</Text>
                      ) : <Text>{item.acquired_location.split(',')[0]}</Text>}
                    </>
                  ) : null}
                  {item.acquired_year ? (
                    <>
                      <Text>{S.itemForm.acquiredSeparator}</Text>
                      {onYearPress ? (
                        <Text
                          style={styles.acquiredLink}
                          onPress={() => onYearPress(item.acquired_year)}
                        >{item.acquired_year}</Text>
                      ) : <Text>{item.acquired_year}</Text>}
                    </>
                  ) : null}
                </Text>
              )}
              <Text style={styles.date}>
                {S.itemForm.addedOn(new Date(item.created_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }))}
              </Text>
            </View>
            {onDelete && (
              <TouchableOpacity style={styles.deleteButton} onPress={onDelete}>
                <Text style={styles.deleteText}>{S.itemForm.deleteItem}</Text>
              </TouchableOpacity>
            )}
          </Animated.View>
          </GestureDetector>
        )}
      </KeyboardAvoidingView>
      </GestureHandlerRootView>
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
    backgroundColor: '#2D2D2D',
  },
  date: {
    fontSize: 13,
    color: '#999',
  },
  acquired: {
    fontSize: 16,
    color: '#2D2D2D',
    fontWeight: '500',
  },
  acquiredLink: {
    textDecorationLine: 'underline',
    textDecorationColor: '#ccc',
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
  description: {
    fontSize: 14,
    color: '#555',
    lineHeight: 21,
  },
  photoExtras: {
    marginBottom: 16,
    marginTop: -8,
  },
  photoDate: {
    fontSize: 12,
    color: '#999',
    marginBottom: 8,
  },
  thumbnailScroll: {
    flexGrow: 0,
  },
  thumbnailRow: {
    gap: 8,
    paddingVertical: 4,
  },
  thumbnailWrap: {
    position: 'relative',
  },
  thumbnail: {
    width: 56,
    height: 56,
    borderRadius: 10,
    overflow: 'hidden',
    backgroundColor: '#E8E3DD',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  thumbnailSelected: {
    borderColor: '#2D2D2D',
  },
  thumbnailImage: {
    width: '100%',
    height: '100%',
  },
  thumbnailRemove: {
    position: 'absolute',
    top: -6,
    right: -6,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#2D2D2D',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
