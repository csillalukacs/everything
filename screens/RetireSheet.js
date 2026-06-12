import { useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import BottomSheet from './BottomSheet';
import { S } from '../shared/strings';

// Collects an optional reason + epitaph and retires the item. The primary button
// works with nothing filled in (one-tap retire); the fields are optional.
export default function RetireSheet({ visible, onClose, onConfirm }) {
  const [reason, setReason] = useState(null);
  const [epitaph, setEpitaph] = useState('');

  function reset() {
    setReason(null);
    setEpitaph('');
  }

  function handleClose() {
    reset();
    onClose();
  }

  function handleConfirm() {
    onConfirm({ reason: reason ?? null, epitaph: epitaph.trim() || null });
    reset();
  }

  return (
    <BottomSheet visible={visible} onClose={handleClose} keyboardAvoiding sheetStyle={styles.sheet}>
      <Text style={styles.title}>{S.graveyard.emoji}  {S.graveyard.retireTitle}</Text>
      <Text style={styles.hint}>{S.graveyard.retireHint}</Text>

      <View>
        <Text style={styles.sectionLabel}>{S.graveyard.reasonLabel}</Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.chips}
        >
          {S.graveyard.reasonOptions.map(opt => {
            const active = reason === opt;
            return (
              <TouchableOpacity
                key={opt}
                style={[styles.chip, active && styles.chipActive]}
                onPress={() => setReason(active ? null : opt)}
              >
                <Text style={[styles.chipText, active && styles.chipTextActive]}>{opt}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      <View>
        <Text style={styles.sectionLabel}>{S.graveyard.epitaphLabel}</Text>
        <TextInput
          style={styles.input}
          placeholder={S.graveyard.epitaphPlaceholder}
          placeholderTextColor="#bbb"
          value={epitaph}
          onChangeText={setEpitaph}
          multiline
        />
      </View>

      <TouchableOpacity style={styles.confirmBtn} onPress={handleConfirm}>
        <Text style={styles.confirmBtnText}>{S.graveyard.emoji}  {S.graveyard.confirmRetire}</Text>
      </TouchableOpacity>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  sheet: {
    backgroundColor: '#F5F0EB',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 20,
    paddingHorizontal: 24,
    paddingBottom: 40,
    gap: 14,
  },
  title: {
    fontSize: 17,
    color: '#2D2D2D',
    fontWeight: '500',
  },
  hint: {
    fontSize: 13,
    color: '#999',
    marginTop: -8,
  },
  sectionLabel: {
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 1,
    color: '#999',
    marginBottom: 8,
  },
  chips: {
    gap: 8,
    paddingVertical: 4,
    alignItems: 'center',
  },
  chip: {
    paddingHorizontal: 14,
    height: 34,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: '#E0E0E0',
    backgroundColor: '#fff',
    justifyContent: 'center',
  },
  chipActive: {
    backgroundColor: '#2D2D2D',
    borderColor: '#2D2D2D',
  },
  chipText: {
    fontSize: 13,
    color: '#999',
  },
  chipTextActive: {
    color: '#fff',
  },
  input: {
    backgroundColor: '#fff',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    color: '#2D2D2D',
    minHeight: 48,
  },
  confirmBtn: {
    backgroundColor: '#2D2D2D',
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 4,
  },
  confirmBtnText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '500',
  },
});
