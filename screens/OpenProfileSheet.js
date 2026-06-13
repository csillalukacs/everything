import { useEffect, useRef, useState } from 'react';
import {
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { S } from '../shared/strings';
import BottomSheet from './BottomSheet';
import { C } from '../shared/theme';

function parseSlug(input) {
  const trimmed = input.trim();
  if (!trimmed) return null;
  const urlMatch = trimmed.match(/\/u\/([^/?#\s]+)/i);
  if (urlMatch) return urlMatch[1].toLowerCase();
  return trimmed.replace(/^@+/, '').toLowerCase();
}

export default function OpenProfileSheet({ visible, onClose, onOpen }) {
  const [input, setInput] = useState('');
  const inputRef = useRef(null);

  useEffect(() => {
    if (visible) {
      setInput('');
      const t = setTimeout(() => inputRef.current?.focus(), 50);
      return () => clearTimeout(t);
    }
  }, [visible]);

  function submit() {
    const slug = parseSlug(input);
    if (!slug) return;
    onOpen(slug);
  }

  return (
    <BottomSheet visible={visible} onClose={onClose} keyboardAvoiding sheetStyle={styles.sheet}>
      <View style={styles.header}>
        <Text style={styles.title}>{S.openProfile.title}</Text>
        <TouchableOpacity onPress={onClose}>
          <Text style={styles.cancel}>{S.common.cancel}</Text>
        </TouchableOpacity>
      </View>
      <Text style={styles.label}>{S.profile.username}</Text>
      <View style={{ flexDirection: 'row', alignItems: 'center', width: '100%', gap: 3 }}>
        <Text style={{ fontSize: 22, color: '#999' }}>@</Text>
        <TextInput
          ref={inputRef}
          style={[styles.input, { flex: 1 }]}
          value={input}
          onChangeText={setInput}
          placeholder={S.profile.usernameExample}
          placeholderTextColor="#bbb"
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="go"
          onSubmitEditing={submit}
        />
      </View>
      <TouchableOpacity
        style={[styles.goBtn, !parseSlug(input) && styles.goBtnDisabled]}
        onPress={submit}
        disabled={!parseSlug(input)}
      >
        <Text style={styles.goBtnText}>{S.common.go}</Text>
      </TouchableOpacity>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  sheet: {
    backgroundColor: C.bg,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 24,
    paddingBottom: 32,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  title: {
    fontSize: 15,
    fontWeight: '500',
    color: C.ink,
  },
  cancel: {
    fontSize: 15,
    color: '#999',
  },
  label: {
    fontSize: 11,
    color: '#999',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 8,
  },
  input: {
    fontSize: 18,
    fontWeight: '300',
    color: C.ink,
    backgroundColor: '#fff',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 16,
  },
  goBtn: {
    backgroundColor: C.ink,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  goBtnDisabled: {
    backgroundColor: C.line,
  },
  goBtnText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '500',
  },
});
