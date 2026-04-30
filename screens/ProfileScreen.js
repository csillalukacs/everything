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

export default function ProfileScreen({ visible, onClose, session, itemCount }) {
  const [displayName, setDisplayName] = useState('');
  const [editingName, setEditingName] = useState(false);
  const [nameInput, setNameInput] = useState('');
  const inputRef = useRef(null);

  useEffect(() => {
    if (!visible || !session) return;
    supabase
      .from('profiles')
      .select('display_name')
      .eq('user_id', session.user.id)
      .maybeSingle()
      .then(({ data }) => {
        const name = data?.display_name ?? session.user.user_metadata?.full_name ?? session.user.email;
        setDisplayName(name);
        setNameInput(name);
      });
  }, [visible, session]);

  useEffect(() => {
    if (editingName) inputRef.current?.focus();
  }, [editingName]);

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
