import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { supabase } from '../lib/supabase';
import { useCollection } from '../lib/CollectionProvider';
import { USERNAME_RE } from '../shared/identifiers';
import { locationSuggestionsFromItems } from '../shared/items';
import { S } from '../shared/strings';
import LocationPicker from './LocationPicker';
import BottomSheet from './BottomSheet';
import Avatar from './Avatar';

function EditActions({ onSave, onCancel, disabled }) {
  return (
    <View style={styles.editActions}>
      <TouchableOpacity onPress={onCancel} hitSlop={10} style={styles.actionBtn} disabled={disabled}>
        <Ionicons name="close" size={20} color="#999" />
      </TouchableOpacity>
      <TouchableOpacity onPress={onSave} hitSlop={10} style={styles.actionBtn} disabled={disabled}>
        <Ionicons name="checkmark" size={20} color="#2D2D2D" />
      </TouchableOpacity>
    </View>
  );
}

export default function ProfileScreen({ visible, onClose, session, itemCount }) {
  const { items, profile, updateProfile, uploadLocalPhoto } = useCollection();
  const locationSuggestions = useMemo(() => locationSuggestionsFromItems(items), [items]);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [displayName, setDisplayName] = useState('');
  const [nameInput, setNameInput] = useState('');
  const [username, setUsername] = useState(null);
  const [usernameInput, setUsernameInput] = useState('');
  const [usernameError, setUsernameError] = useState(null);
  const [savingUsername, setSavingUsername] = useState(false);
  const [home, setHome] = useState(null);
  const [homeInput, setHomeInput] = useState(null);
  const [editingField, setEditingField] = useState(null);
  const inputRef = useRef(null);
  const usernameRef = useRef(null);

  function startEdit(field) {
    setUsernameError(null);
    if (field === 'name') setNameInput(displayName);
    if (field === 'username') setUsernameInput(username ?? '');
    if (field === 'home') setHomeInput(home);
    setEditingField(field);
  }

  function cancelEdit() {
    setEditingField(null);
    setUsernameError(null);
  }

  useEffect(() => {
    if (!visible) {
      setEditingField(null);
      setUsernameError(null);
    }
  }, [visible]);

  useEffect(() => {
    if (!visible || !session) return;
    supabase
      .from('profiles')
      .select('display_name, username, home_location, home_lat, home_lng')
      .eq('user_id', session.user.id)
      .maybeSingle()
      .then(({ data }) => {
        const name = data?.display_name ?? '';
        setDisplayName(name);
        setNameInput(name);
        setUsername(data?.username ?? null);
        setUsernameInput(data?.username ?? '');
        setHome(data?.home_location
          ? { location: data.home_location, lat: data.home_lat, lng: data.home_lng }
          : null);
      });
  }, [visible, session]);

  async function saveHome(next) {
    setHome(next);
    await supabase
      .from('profiles')
      .update({
        home_location: next?.location ?? null,
        home_lat: next?.lat ?? null,
        home_lng: next?.lng ?? null,
      })
      .eq('user_id', session.user.id);
  }

  useEffect(() => {
    if (editingField === 'name') inputRef.current?.focus();
    if (editingField === 'username') usernameRef.current?.focus();
  }, [editingField]);

  async function saveName() {
    const trimmed = nameInput.trim();
    if (trimmed && trimmed !== displayName) {
      await supabase.from('profiles').upsert({ user_id: session.user.id, display_name: trimmed });
      setDisplayName(trimmed);
    }
    setEditingField(null);
  }

  async function saveUsername() {
    const trimmed = usernameInput.trim().toLowerCase();
    setUsernameError(null);
    if (trimmed === (username ?? '')) {
      setEditingField(null);
      return;
    }
    setSavingUsername(true);
    if (trimmed === '') {
      const { error } = await supabase.from('profiles').update({ username: null }).eq('user_id', session.user.id);
      setSavingUsername(false);
      if (!error) {
        setUsername(null);
        setEditingField(null);
      }
      return;
    }
    if (!USERNAME_RE.test(trimmed)) {
      setUsernameError(S.profile.usernameInvalidMobile);
      setSavingUsername(false);
      return;
    }
    const { data: existing } = await supabase
      .from('profiles')
      .select('user_id')
      .ilike('username', trimmed)
      .maybeSingle();
    if (existing && existing.user_id !== session.user.id) {
      setUsernameError(S.profile.usernameTaken);
      setSavingUsername(false);
      return;
    }
    const { error } = await supabase
      .from('profiles')
      .update({ username: trimmed })
      .eq('user_id', session.user.id);
    setSavingUsername(false);
    if (error) {
      setUsernameError(/reserved/i.test(error.message) ? S.profile.usernameReserved : S.profile.usernameTaken);
      return;
    }
    setUsername(trimmed);
    setUsernameInput(trimmed);
    setEditingField(null);
  }

  async function saveHomeEdit() {
    const changed = (homeInput?.lat ?? null) !== (home?.lat ?? null)
      || (homeInput?.lng ?? null) !== (home?.lng ?? null);
    if (changed) await saveHome(homeInput);
    setEditingField(null);
  }

  async function pickAvatar() {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') return;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.85,
    });
    if (result.canceled) return;
    setUploadingAvatar(true);
    try {
      const image = await ImageManipulator.manipulate(result.assets[0].uri).renderAsync();
      const { uri } = await image.saveAsync({ format: SaveFormat.JPEG, compress: 0.9 });
      const uploaded = await uploadLocalPhoto(uri);
      if (!uploaded) return;
      await updateProfile({ avatar_url: uploaded.image_url, avatar_thumb_url: uploaded.thumb_url });
    } finally {
      setUploadingAvatar(false);
    }
  }

  return (
    <BottomSheet visible={visible} onClose={onClose} sheetStyle={styles.sheet}>
      <View style={styles.header}>
        <Text style={styles.title}>{S.profile.title}</Text>
        <TouchableOpacity onPress={onClose}>
          <Text style={styles.done}>{S.common.done}</Text>
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
            <View style={styles.avatarSection}>
              <TouchableOpacity onPress={pickAvatar} disabled={uploadingAvatar} activeOpacity={0.8}>
                <Avatar profile={{ ...profile, user_id: session?.user.id }} size={96} />
                <View style={styles.avatarBadge}>
                  {uploadingAvatar
                    ? <ActivityIndicator size="small" color="#fff" />
                    : <Ionicons name="camera-outline" size={16} color="#fff" />
                  }
                </View>
              </TouchableOpacity>
            </View>

            <View style={styles.section}>
              <View style={styles.labelRow}>
                <Text style={styles.label}>{S.profile.name}</Text>
                {editingField === 'name' && (
                  <EditActions onSave={saveName} onCancel={cancelEdit} />
                )}
              </View>
              {editingField === 'name' ? (
                <TextInput
                  ref={inputRef}
                  style={styles.input}
                  value={nameInput}
                  onChangeText={setNameInput}
                  returnKeyType="done"
                  onSubmitEditing={saveName}
                />
              ) : (
                <View style={styles.displayRow}>
                  <Text style={styles.displayValue}>{displayName}</Text>
                  <TouchableOpacity
                    onPress={() => startEdit('name')}
                    hitSlop={10}
                    style={styles.editBtn}
                  >
                    <Ionicons name="pencil-outline" size={16} color="#999" />
                  </TouchableOpacity>
                </View>
              )}
            </View>

            <View style={styles.section}>
              <View style={styles.labelRow}>
                <Text style={styles.label}>{S.profile.username}</Text>
                {editingField === 'username' && (
                  <EditActions onSave={saveUsername} onCancel={cancelEdit} disabled={savingUsername} />
                )}
              </View>
              {editingField === 'username' ? (
                <>
                  <View style={styles.usernameRow}>
                    <Text style={styles.usernameAt}>@</Text>
                    <TextInput
                      ref={usernameRef}
                      style={styles.usernameInput}
                      value={usernameInput}
                      onChangeText={text => { setUsernameInput(text.toLowerCase()); setUsernameError(null); }}
                      autoCapitalize="none"
                      autoCorrect={false}
                      maxLength={20}
                      placeholder={S.profile.usernamePlaceholder}
                      placeholderTextColor="#bbb"
                      returnKeyType="done"
                      onSubmitEditing={saveUsername}
                      editable={!savingUsername}
                    />
                  </View>
                  {usernameError && <Text style={styles.usernameError}>{usernameError}</Text>}
                  <Text style={styles.hint}>{S.profile.usernameHint(usernameInput)}</Text>
                </>
              ) : (
                <View style={styles.displayRow}>
                  <Text style={username ? styles.displayValue : styles.placeholderValue}>
                    {username ? `@${username}` : S.profile.setUsername}
                  </Text>
                  <TouchableOpacity
                    onPress={() => startEdit('username')}
                    hitSlop={10}
                    style={styles.editBtn}
                  >
                    <Ionicons name="pencil-outline" size={16} color="#999" />
                  </TouchableOpacity>
                </View>
              )}
            </View>

            <View style={styles.section}>
              <View style={styles.labelRow}>
                <Text style={styles.label}>{S.profile.homeCity}</Text>
                {editingField === 'home' ? (
                  <EditActions onSave={saveHomeEdit} onCancel={cancelEdit} />
                ) : home && (
                  <TouchableOpacity onPress={() => saveHome(null)}>
                    <Text style={styles.homeRemove}>{S.common.remove}</Text>
                  </TouchableOpacity>
                )}
              </View>
              {editingField === 'home' ? (
                <LocationPicker
                  value={homeInput}
                  onChange={setHomeInput}
                  placeholder={S.profile.setHomeCity}
                  suggestions={locationSuggestions}
                />
              ) : (
                <View style={styles.displayRow}>
                  <Text style={home ? styles.displayValue : styles.placeholderValue}>
                    {home?.location ?? S.profile.setHomeCity}
                  </Text>
                  <TouchableOpacity
                    onPress={() => startEdit('home')}
                    hitSlop={10}
                    style={styles.editBtn}
                  >
                    <Ionicons name="pencil-outline" size={16} color="#999" />
                  </TouchableOpacity>
                </View>
              )}
              <Text style={styles.hint}>{S.profile.homeCityPublicHint}</Text>
            </View>

            <View style={styles.section}>
              <View style={styles.labelRow}>
                <Text style={styles.label}>{S.profile.collection}</Text>
              </View>
              <Text style={styles.countValue}>{S.profile.objectCount(itemCount)}</Text>
            </View>

            <View style={styles.section}>
              <View style={styles.labelRow}>
                <Text style={styles.label}>{S.profile.account}</Text>
              </View>
              <Text style={styles.email}>{session?.user.email}</Text>
            </View>

            <TouchableOpacity
              style={styles.logoutBtn}
              onPress={() => { onClose(); supabase.auth.signOut(); }}
            >
              <Text style={styles.logoutText}>{S.common.logOut}</Text>
            </TouchableOpacity>
      </ScrollView>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  sheet: {
    backgroundColor: '#F5F0EB',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 24,
    paddingBottom: 48,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 28,
  },
  title: {
    fontSize: 15,
    fontWeight: '500',
    color: '#2D2D2D',
  },
  done: {
    fontSize: 15,
    color: '#999',
  },
  avatarSection: {
    alignItems: 'center',
    marginBottom: 28,
  },
  avatarBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#2D2D2D',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#F5F0EB',
  },
  section: {
    marginBottom: 28,
  },
  label: {
    fontSize: 11,
    color: '#999',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  displayRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  displayValue: {
    flex: 1,
    fontSize: 20,
    fontWeight: '300',
    color: '#2D2D2D',
    letterSpacing: 0.3,
  },
  placeholderValue: {
    flex: 1,
    fontSize: 20,
    fontWeight: '300',
    color: '#999',
    letterSpacing: 0.3,
  },
  editBtn: {
    paddingLeft: 12,
    paddingVertical: 4,
  },
  input: {
    fontSize: 20,
    fontWeight: '300',
    color: '#2D2D2D',
    letterSpacing: 0.3,
    backgroundColor: '#fff',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  usernameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 10,
    paddingHorizontal: 14,
  },
  usernameAt: {
    fontSize: 20,
    fontWeight: '300',
    color: '#999',
  },
  usernameInput: {
    flex: 1,
    fontSize: 20,
    fontWeight: '300',
    color: '#2D2D2D',
    letterSpacing: 0.3,
    paddingVertical: 10,
    paddingLeft: 2,
  },
  usernameError: {
    fontSize: 13,
    color: '#E74C3C',
    marginTop: 6,
  },
  hint: {
    fontSize: 12,
    color: '#999',
    marginTop: 6,
  },
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  editActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  actionBtn: {
    paddingVertical: 2,
    paddingHorizontal: 2,
  },
  homeRemove: {
    fontSize: 12,
    color: '#999',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  countValue: {
    fontSize: 20,
    fontWeight: '300',
    color: '#2D2D2D',
    letterSpacing: 0.3,
  },
  email: {
    fontSize: 14,
    color: '#999',
  },
  logoutBtn: {
    marginTop: 8,
    paddingVertical: 14,
    alignItems: 'center',
    backgroundColor: '#E8E3DD',
    borderRadius: 12,
  },
  logoutText: {
    fontSize: 15,
    color: '#E74C3C',
  },
});
