import { useEffect, useRef, useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

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
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={onClose}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.kavWrap}
          pointerEvents="box-none"
        >
          <TouchableOpacity style={styles.sheet} activeOpacity={1} onPress={() => {}}>
            <View style={styles.header}>
              <Text style={styles.title}>open profile</Text>
              <TouchableOpacity onPress={onClose}>
                <Text style={styles.cancel}>cancel</Text>
              </TouchableOpacity>
            </View>
            <Text style={styles.label}>username or link</Text>
            <TextInput
              ref={inputRef}
              style={styles.input}
              value={input}
              onChangeText={setInput}
              placeholder="@alice or /u/alice"
              placeholderTextColor="#bbb"
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="go"
              onSubmitEditing={submit}
            />
            <TouchableOpacity
              style={[styles.goBtn, !parseSlug(input) && styles.goBtnDisabled]}
              onPress={submit}
              disabled={!parseSlug(input)}
            >
              <Text style={styles.goBtnText}>go</Text>
            </TouchableOpacity>
          </TouchableOpacity>
        </KeyboardAvoidingView>
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
  kavWrap: {
    width: '100%',
  },
  sheet: {
    backgroundColor: '#F5F0EB',
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
    color: '#2D2D2D',
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
    color: '#2D2D2D',
    backgroundColor: '#fff',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 16,
  },
  goBtn: {
    backgroundColor: '#2D2D2D',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  goBtnDisabled: {
    backgroundColor: '#D5CFC8',
  },
  goBtnText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '500',
  },
});
