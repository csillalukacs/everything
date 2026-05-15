import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { removeBackground } from '@jacobjmc/react-native-background-remover';
import {
  ActivityIndicator,
  Dimensions,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  Share,
  StyleSheet,
  Text,
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
import { useCollection } from '../lib/CollectionProvider';
import { locationSuggestionsFromItems } from '../shared/items';
import { S } from '../shared/strings';
import CameraCaptureModal from './CameraCaptureModal';
import Avatar from './Avatar';
import TagInput from './TagInput';
import PhotoStrip from './PhotoStrip';
import ItemFieldsEditor from './ItemFieldsEditor';

export default function ItemDetailModal({ item, visible, onClose, onDelete, onSave, allTags = [], autoEdit = false, onPrev, onNext, onTagPress, onYearPress, onCityPress }) {
  const router = useRouter();
  const { items, session, profile } = useCollection();
  const locationSuggestions = useMemo(() => locationSuggestionsFromItems(items), [items]);
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
  const ocrPromiseRef = useRef(null);
  const scrollRef = useRef(null);
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
    setEditing(true);
  }

  function cancelEdit() {
    setEditing(false);
    setEditDescription('');
    setDisplayedIdx(0);
    ocrPromiseRef.current = null;
  }

  async function handleCaptured(uri) {
    setCameraVisible(false);
    if (editPhoto && editPhoto.startsWith('http')) {
      const kept = { url: editPhoto, thumb_url: item?.thumb_url ?? null, added_at: editImageAddedAt ?? item?.created_at };
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

  async function handleShare() {
    const isMine = session?.user?.id === item.user_id;
    const slug = isMine
      ? (profile?.username || session?.user?.id)
      : (item.profile?.username || item.user_id);
    if (!slug) return;
    const url = `things://u/${slug}?item=${item.id}`;
    const name = item.name?.trim();
    try {
      await Share.share({
        message: name ? `${name}\n${url}` : url,
        url,
      });
    } catch {}
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
  const displayPhoto = allPhotos[safeDisplayedIdx]?.url;

  const photoStrip = (
    <PhotoStrip
      photos={allPhotos}
      selectedIdx={safeDisplayedIdx}
      onSelect={setDisplayedIdx}
      editable={editing}
      onRemove={removePreviousPhoto}
    />
  );
  const itemTags = item.tags ?? [];

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
          {editing ? (
            <TouchableOpacity onPress={handleSave} style={styles.headerButton} disabled={saving}>
              <Text style={[styles.headerButtonText, styles.saveText]}>
                {saving ? S.common.saving : S.common.save}
              </Text>
            </TouchableOpacity>
          ) : (
            <View style={styles.rightButtons}>
              <TouchableOpacity onPress={handleShare} style={styles.headerButton}>
                <Ionicons name="share-outline" size={24} color="#2D2D2D" />
              </TouchableOpacity>
              {onSave && (
                <TouchableOpacity onPress={enterEdit} style={styles.headerButton}>
                  <Text style={styles.headerButtonText}>{S.common.edit}</Text>
                </TouchableOpacity>
              )}
            </View>
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

            {photoStrip}

            <CameraCaptureModal
              visible={cameraVisible}
              onCapture={handleCaptured}
              onCancel={() => setCameraVisible(false)}
            />

            <View style={styles.editFields}>
              <TagInput
                allTags={allTags}
                selectedTags={editTags}
                onChange={setEditTags}
                onStartAdding={() => setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 150)}
              />
              <ItemFieldsEditor
                name={editName}
                onNameChange={setEditName}
                description={editDescription}
                onDescriptionChange={setEditDescription}
                acquired={editAcquired}
                onAcquiredChange={setEditAcquired}
                year={editYear}
                onYearChange={setEditYear}
                locationSuggestions={locationSuggestions}
              />
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
            {photoStrip}
            <View style={styles.info}>
              {item.profile && (
                <TouchableOpacity
                  style={styles.ownerRow}
                  activeOpacity={0.7}
                  onPress={() => {
                    const slug = item.profile.username || item.user_id;
                    onClose?.();
                    router.push(`/u/${slug}`);
                  }}
                >
                  <Avatar profile={{ ...item.profile, user_id: item.user_id }} size={32} />
                  <View style={styles.ownerText}>
                    <Text style={styles.ownerName} numberOfLines={1}>
                      {item.profile.display_name || (item.profile.username ? `@${item.profile.username}` : 'someone')}
                    </Text>
                    {item.profile.display_name && item.profile.username && (
                      <Text style={styles.ownerHandle} numberOfLines={1}>@{item.profile.username}</Text>
                    )}
                  </View>
                  <Ionicons name="chevron-forward" size={18} color="#999" />
                </TouchableOpacity>
              )}
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
  rightButtons: {
    flexDirection: 'row',
    alignItems: 'center',
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
  ownerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E8E3DD',
  },
  ownerText: {
    flex: 1,
  },
  ownerName: {
    fontSize: 14,
    color: '#2D2D2D',
    fontWeight: '500',
  },
  ownerHandle: {
    fontSize: 12,
    color: '#999',
    marginTop: 1,
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
  description: {
    fontSize: 14,
    color: '#555',
    lineHeight: 21,
  },
});
