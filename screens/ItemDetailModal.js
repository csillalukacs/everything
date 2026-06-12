import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { removeBackground } from '@jacobjmc/react-native-background-remover';
import {
  ActivityIndicator,
  Alert,
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
import { useSafeAreaInsets } from 'react-native-safe-area-context';

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
import AppleIcon from './AppleIcon';
import { isFeaturedTag } from '../shared/featuredTag';

export default function ItemDetailModal({ item, visible, onClose, onDelete, onSave, allTags = [], autoEdit = false, onPrev, onNext, onTagPress, onYearPress, onCityPress }) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { items, session, profile } = useCollection();
  const locationSuggestions = useMemo(() => locationSuggestionsFromItems(items), [items]);
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editPhoto, setEditPhoto] = useState(null);
  const [editPhotoThumb, setEditPhotoThumb] = useState(null);
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
  const [infoVisible, setInfoVisible] = useState(false);
  const [menuVisible, setMenuVisible] = useState(false);
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
    setInfoVisible(false);
    setMenuVisible(false);
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
    setEditPhotoThumb(item.thumb_url ?? null);
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
      const kept = { url: editPhoto, thumb_url: editPhotoThumb ?? null, added_at: editImageAddedAt ?? item?.created_at };
      setEditPreviousImages(prev => [kept, ...prev]);
    }
    setEditImageAddedAt(new Date().toISOString());
    setDisplayedIdx(0);
    setEditPhoto(uri);
    setEditPhotoThumb(null);
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

  async function attemptUpdate() {
    const ocrText = ocrPromiseRef.current ? await ocrPromiseRef.current : undefined;
    let savePhoto = editPhoto;
    let savePrevious = editPreviousImages;
    let saveImageAddedAt = editImageAddedAt;
    const selectedIdx = Math.min(displayedIdx, editPreviousImages.length);
    if (selectedIdx > 0) {
      const prevIdx = selectedIdx - 1;
      const chosen = editPreviousImages[prevIdx];
      if (chosen?.url) {
        const demoted = { url: editPhoto, thumb_url: editPhotoThumb, added_at: editImageAddedAt };
        savePhoto = chosen.url;
        saveImageAddedAt = chosen.added_at ?? null;
        savePrevious = editPreviousImages.map((e, i) => i === prevIdx ? demoted : e);
      }
    }
    let timeoutId;
    const timeoutPromise = new Promise(resolve => {
      timeoutId = setTimeout(() => resolve(false), 60000);
    });
    const savePromise = (async () => {
      try {
        return await onSave(editName.trim(), savePhoto, editTags, editPrivate, editDescription.trim(), buildAcquired(), ocrText, savePrevious, saveImageAddedAt);
      } catch (e) {
        console.error('Edit save error:', e);
        return false;
      }
    })();
    const ok = await Promise.race([savePromise, timeoutPromise]);
    clearTimeout(timeoutId);
    return !!ok;
  }

  async function handleSave() {
    setSaving(true);
    const ok = await attemptUpdate();
    setSaving(false);
    if (!ok) {
      Alert.alert(
        S.common.saveFailedTitle,
        S.common.saveFailedMessage,
        [
          { text: S.common.cancel, style: 'cancel' },
          { text: S.common.retry, onPress: handleSave },
        ],
      );
      return;
    }
    ocrPromiseRef.current = null;
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
  const displayedDate = allPhotos[safeDisplayedIdx]?.added_at;
  const isOwner = session?.user?.id && session.user.id === item.user_id;

  const photoStrip = (
    <PhotoStrip
      photos={allPhotos}
      selectedIdx={safeDisplayedIdx}
      onSelect={setDisplayedIdx}
      editable={editing}
      onRemove={removePreviousPhoto}
      style={styles.photoStrip}
    />
  );
  const infoCorner = displayedDate ? (
    <View style={styles.infoCornerWrap} pointerEvents="box-none">
      {infoVisible && (
        <View style={styles.tooltipBubble}>
          <Text style={styles.tooltipText}>
            {S.itemForm.photoFrom(new Date(displayedDate).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }))}
          </Text>
        </View>
      )}
      <TouchableOpacity
        style={styles.infoCorner}
        onPress={() => setInfoVisible(v => !v)}
        hitSlop={6}
      >
        <Ionicons name="information-circle-outline" size={20} color="#2D2D2D" />
      </TouchableOpacity>
    </View>
  ) : null;
  const bottomBar = (photoStrip || infoCorner) ? (
    <View style={[styles.bottomBar, editing && styles.bottomBarEditing]} pointerEvents="box-none">
      {photoStrip}
      <View style={{ flex: 1 }} />
      {infoCorner}
    </View>
  ) : null;
  const itemTags = item.tags ?? [];

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={editing ? cancelEdit : onClose}>
      <GestureHandlerRootView style={{ flex: 1 }}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        {editing ? (
          <ScrollView
            ref={scrollRef}
            style={{ flex: 1 }}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.imageContainer}>
              {displayPhoto
                ? <Image source={{ uri: displayPhoto }} style={styles.image} cachePolicy="memory-disk" contentFit="cover" recyclingKey={displayPhoto} />
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
                    <Text style={styles.photoActionText}>{S.common.newPhoto}</Text>
                  </View>
                </TouchableOpacity>
              )}
              <TouchableOpacity
                style={[styles.privacyCorner, editPrivate && styles.privacyCornerOn]}
                onPress={() => setEditPrivate(prev => !prev)}
              >
                <Ionicons
                  name={editPrivate ? 'lock-closed' : 'lock-open-outline'}
                  size={18}
                  color={editPrivate ? '#fff' : '#2D2D2D'}
                />
              </TouchableOpacity>
              {bottomBar}
            </View>

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
        ) : null}
        {editing && (
          <View style={[styles.editFooter, { paddingBottom: insets.bottom + 24 }]}>
            <TouchableOpacity onPress={cancelEdit} style={styles.editFooterButton}>
              <Text style={styles.editFooterCancel}>{S.common.cancel}</Text>
            </TouchableOpacity>
            <View style={styles.editFooterDivider} />
            <TouchableOpacity onPress={handleSave} disabled={saving} style={styles.editFooterButton}>
              <Text style={styles.editFooterSave}>{saving ? S.common.saving : S.common.save}</Text>
            </TouchableOpacity>
          </View>
        )}
        {!editing && (
          <GestureDetector gesture={swipeGesture}>
          <Animated.View style={[{ flex: 1 }, swipeStyle]}>
            <View style={styles.imageContainer}>
              {displayPhoto
                ? <Image source={{ uri: displayPhoto }} style={styles.image} cachePolicy="memory-disk" contentFit="cover" recyclingKey={displayPhoto} />
                : <View style={styles.imagePlaceholder} />
              }
              <TouchableOpacity style={styles.imageBack} onPress={onClose} hitSlop={8}>
                <Ionicons name="chevron-down" size={22} color="#2D2D2D" />
              </TouchableOpacity>
              {isOwner && (
                <View style={styles.imageMenuWrap} pointerEvents="box-none">
                  <TouchableOpacity style={styles.imageMenuButton} onPress={() => setMenuVisible(v => !v)} hitSlop={8}>
                    <Ionicons name="ellipsis-horizontal" size={20} color="#2D2D2D" />
                  </TouchableOpacity>
                  {menuVisible && (
                    <View style={styles.imageMenu}>
                      <View style={[styles.imageMenuItem, styles.imageMenuItemDisabled]}>
                        <Ionicons name="share-outline" size={18} color="#BBB" />
                        <Text style={[styles.imageMenuItemText, styles.imageMenuItemDisabledText]}>{S.common.share}</Text>
                      </View>
                      {onSave && (
                        <TouchableOpacity
                          style={styles.imageMenuItem}
                          onPress={() => { setMenuVisible(false); enterEdit(); }}
                        >
                          <Ionicons name="pencil-outline" size={18} color="#2D2D2D" />
                          <Text style={styles.imageMenuItemText}>{S.common.edit}</Text>
                        </TouchableOpacity>
                      )}
                      {onDelete && (
                        <TouchableOpacity
                          style={styles.imageMenuItem}
                          onPress={() => { setMenuVisible(false); onDelete(); }}
                        >
                          <Ionicons name="trash-outline" size={18} color="#E74C3C" />
                          <Text style={[styles.imageMenuItemText, styles.imageMenuItemDanger]}>{S.common.delete}</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  )}
                </View>
              )}
              {bottomBar}
            </View>
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
                    const featured = isFeaturedTag(tag);
                    return (
                      <Wrapper
                        key={tag.id}
                        style={styles.tagBadge}
                        {...(onTagPress ? { onPress: () => onTagPress(tag) } : {})}
                      >
                        {featured && <AppleIcon size={12} />}
                        {tag.is_private && !featured && <Ionicons name="lock-closed" size={9} color="#bbb" />}
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
  imageContainer: {
    width: '100%',
    aspectRatio: 1,
    backgroundColor: 'transparent',
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
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  privacyCornerOn: {
    backgroundColor: '#2D2D2D',
  },
  editFooter: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 24,
    backgroundColor: '#2D2D2D',
    marginHorizontal: -24,
    marginBottom: -40,
  },
  editFooterButton: {
    paddingVertical: 12,
    paddingHorizontal: 40,
  },
  editFooterDivider: {
    width: 1,
    alignSelf: 'stretch',
    marginVertical: 10,
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  editFooterCancel: {
    fontSize: 18,
    color: 'rgba(255,255,255,0.7)',
  },
  editFooterSave: {
    fontSize: 18,
    color: '#fff',
    fontWeight: '500',
  },
  bottomBar: {
    position: 'absolute',
    left: 10,
    right: 10,
    bottom: 10,
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
  },
  bottomBarEditing: {
    bottom: 60,
  },
  photoStrip: {
    flexShrink: 1,
  },
  infoCornerWrap: {
    alignItems: 'flex-end',
    paddingBottom: 6,
  },
  infoCorner: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tooltipBubble: {
    marginBottom: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: 'rgba(0,0,0,0.8)',
  },
  tooltipText: {
    fontSize: 12,
    color: '#fff',
  },
  imageBack: {
    position: 'absolute',
    top: 10,
    left: 0,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  imageMenuWrap: {
    position: 'absolute',
    top: 10,
    right: 10,
    alignItems: 'flex-end',
  },
  imageMenuButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  imageMenu: {
    marginTop: 4,
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingVertical: 4,
    minWidth: 140,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 4,
  },
  imageMenuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  imageMenuItemText: {
    fontSize: 14,
    color: '#2D2D2D',
  },
  imageMenuItemDanger: {
    color: '#E74C3C',
  },
  imageMenuItemDisabled: {
    opacity: 1,
  },
  imageMenuItemDisabledText: {
    color: '#BBB',
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
