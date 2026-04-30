import { useEffect, useRef, useState } from 'react';
import {
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { supabase } from '../lib/supabase';

const USERNAME_RE = /^[a-z0-9_]{3,20}$/;

export default function ProfileScreen({ visible, onClose, session, itemCount }) {
  const [displayName, setDisplayName] = useState('');
  const [editingName, setEditingName] = useState(false);
  const [nameInput, setNameInput] = useState('');
  const [username, setUsername] = useState(null);
  const [editingUsername, setEditingUsername] = useState(false);
  const [usernameInput, setUsernameInput] = useState('');
  const [usernameError, setUsernameError] = useState(null);
  const [savingUsername, setSavingUsername] = useState(false);
  const inputRef = useRef(null);
  const usernameRef = useRef(null);

  useEffect(() => {
    if (!visible || !session) return;
    supabase
      .from('profiles')
      .select('display_name, username')
      .eq('user_id', session.user.id)
      .maybeSingle()
      .then(({ data }) => {
        const name = data?.display_name ?? session.user.user_metadata?.full_name ?? session.user.email;
        setDisplayName(name);
        setNameInput(name);
        setUsername(data?.username ?? null);
        setUsernameInput(data?.username ?? '');
      });
  }, [visible, session]);

  useEffect(() => {
    if (editingName) inputRef.current?.focus();
  }, [editingName]);

  useEffect(() => {
    if (editingUsername) usernameRef.current?.focus();
  }, [editingUsername]);

  async function saveName() {
    const trimmed = nameInput.trim();
    if (trimmed && trimmed !== displayName) {
      await supabase.from('profiles').upsert({ user_id: session.user.id, display_name: trimmed });
      setDisplayName(trimmed);
    } else {
      setNameInput(displayName);
    }
    setEditingName(false);
  }

  async function saveUsername() {
    const trimmed = usernameInput.trim().toLowerCase();
    setUsernameError(null);
    if (trimmed === (username ?? '')) {
      setEditingUsername(false);
      return;
    }
    setSavingUsername(true);
    if (trimmed === '') {
      const { error } = await supabase.from('profiles').update({ username: null }).eq('user_id', session.user.id);
      setSavingUsername(false);
      if (!error) {
        setUsername(null);
        setEditingUsername(false);
      }
      return;
    }
    if (!USERNAME_RE.test(trimmed)) {
      setUsernameError('3–20 chars: a–z, 0–9, _');
      setSavingUsername(false);
      return;
    }
    const { data: existing } = await supabase
      .from('profiles')
      .select('user_id')
      .ilike('username', trimmed)
      .maybeSingle();
    if (existing && existing.user_id !== session.user.id) {
      setUsernameError('username taken');
      setSavingUsername(false);
      return;
    }
    const { error } = await supabase
      .from('profiles')
      .update({ username: trimmed })
      .eq('user_id', session.user.id);
    setSavingUsername(false);
    if (error) {
      setUsernameError(/reserved/i.test(error.message) ? 'username reserved' : 'username taken');
      return;
    }
    setUsername(trimmed);
    setUsernameInput(trimmed);
    setEditingUsername(false);
  }

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={onClose}>
        <TouchableOpacity style={styles.sheet} activeOpacity={1} onPress={() => {}}>
          <View style={styles.header}>
            <Text style={styles.title}>profile</Text>
            <TouchableOpacity onPress={onClose}>
              <Text style={styles.done}>done</Text>
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false}>
            <View style={styles.section}>
              <Text style={styles.label}>name</Text>
              {editingName ? (
                <TextInput
                  ref={inputRef}
                  style={styles.nameInput}
                  value={nameInput}
                  onChangeText={setNameInput}
                  returnKeyType="done"
                  onSubmitEditing={saveName}
                  onBlur={saveName}
                />
              ) : (
                <TouchableOpacity onPress={() => setEditingName(true)}>
                  <Text style={styles.nameValue}>{displayName}</Text>
                </TouchableOpacity>
              )}
            </View>

            <View style={styles.section}>
              <Text style={styles.label}>username</Text>
              {editingUsername ? (
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
                      placeholder="username"
                      placeholderTextColor="#bbb"
                      returnKeyType="done"
                      onSubmitEditing={saveUsername}
                      editable={!savingUsername}
                    />
                  </View>
                  {usernameError && <Text style={styles.usernameError}>{usernameError}</Text>}
                  <Text style={styles.usernameHint}>your profile will live at /u/{usernameInput || 'username'}</Text>
                </>
              ) : (
                <TouchableOpacity onPress={() => setEditingUsername(true)}>
                  <Text style={username ? styles.nameValue : styles.usernamePlaceholder}>
                    {username ? `@${username}` : 'set username'}
                  </Text>
                </TouchableOpacity>
              )}
            </View>

            <View style={styles.section}>
              <Text style={styles.label}>collection</Text>
              <Text style={styles.countValue}>
                {itemCount} {itemCount === 1 ? 'object' : 'objects'}
              </Text>
            </View>

            <View style={styles.section}>
              <Text style={styles.label}>account</Text>
              <Text style={styles.email}>{session?.user.email}</Text>
            </View>

            <TouchableOpacity
              style={styles.logoutBtn}
              onPress={() => { onClose(); supabase.auth.signOut(); }}
            >
              <Text style={styles.logoutText}>log out</Text>
            </TouchableOpacity>
          </ScrollView>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#F5F0EB',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 24,
    paddingBottom: 48,
    maxHeight: '70%',
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
  section: {
    marginBottom: 28,
  },
  label: {
    fontSize: 11,
    color: '#999',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 8,
  },
  nameValue: {
    fontSize: 20,
    fontWeight: '300',
    color: '#2D2D2D',
    letterSpacing: 0.3,
  },
  nameInput: {
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
  usernamePlaceholder: {
    fontSize: 20,
    fontWeight: '300',
    color: '#999',
    letterSpacing: 0.3,
  },
  usernameError: {
    fontSize: 13,
    color: '#E74C3C',
    marginTop: 6,
  },
  usernameHint: {
    fontSize: 12,
    color: '#999',
    marginTop: 6,
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
