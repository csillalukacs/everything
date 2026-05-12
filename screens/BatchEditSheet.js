import { Ionicons } from '@expo/vector-icons';
import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useCollection } from '../lib/CollectionProvider';
import { locationSuggestionsFromItems } from '../shared/items';
import { S } from '../shared/strings';
import LocationPicker from './LocationPicker';
import BottomSheet from './BottomSheet';

export default function BatchEditSheet({ visible, onClose, onApply, allTags = [], selectedCount, loading = false }) {
  const { items } = useCollection();
  const locationSuggestions = useMemo(() => locationSuggestionsFromItems(items), [items]);
  const [pendingTags, setPendingTags] = useState([]);
  const [addingTag, setAddingTag] = useState(false);
  const [newTagInput, setNewTagInput] = useState('');
  const [year, setYear] = useState('');
  const [acquired, setAcquired] = useState(null);

  function toggleTag(tag) {
    setPendingTags(prev => prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]);
  }

  function handleConfirmNewTag() {
    const trimmed = newTagInput.trim().toLowerCase();
    if (trimmed && !pendingTags.includes(trimmed)) {
      setPendingTags(prev => [...prev, trimmed]);
    }
    setAddingTag(false);
    setNewTagInput('');
  }

  function reset() {
    setPendingTags([]);
    setAddingTag(false);
    setNewTagInput('');
    setYear('');
    setAcquired(null);
  }

  function buildAcquired() {
    const y = year.trim();
    const yearNum = y ? parseInt(y, 10) : null;
    const validYear = yearNum && yearNum >= 1800 && yearNum <= 2100 ? yearNum : null;
    if (!validYear && !acquired) return null;
    return { year: validYear, location: acquired?.location ?? null, lat: acquired?.lat ?? null, lng: acquired?.lng ?? null };
  }

  function handleApply() {
    onApply({ addTags: pendingTags, acquired: buildAcquired() });
    reset();
  }

  function handleClose() {
    if (loading) return;
    reset();
    onClose();
  }

  const allTagNames = allTags.map(t => (typeof t === 'string' ? t : t.name));
  const tagOptions = [...new Set([...allTagNames, ...pendingTags])].sort();

  const hasChanges = pendingTags.length > 0 || year.trim().length > 0 || !!acquired;

  const sheetContent = (
    <>
      <Text style={styles.title}>{S.batchEdit.title(selectedCount)}</Text>

      <View>
        <Text style={styles.sectionLabel}>{S.batchEdit.addTags}</Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.chips}
        >
          {tagOptions.map(tag => {
            const active = pendingTags.includes(tag);
            return (
              <TouchableOpacity
                key={tag}
                style={[styles.chip, active && styles.chipActive]}
                onPress={() => toggleTag(tag)}
              >
                <Text style={[styles.chipText, active && styles.chipTextActive]}>{tag}</Text>
              </TouchableOpacity>
            );
          })}
          {addingTag ? (
            <View style={styles.newTagRow}>
              <TextInput
                style={styles.newTagInput}
                placeholder={S.itemForm.tagPlaceholder}
                placeholderTextColor="#bbb"
                value={newTagInput}
                onChangeText={setNewTagInput}
                autoFocus
                returnKeyType="done"
                onSubmitEditing={handleConfirmNewTag}
                onBlur={handleConfirmNewTag}
              />
              <TouchableOpacity onPress={handleConfirmNewTag} style={styles.confirmBtn}>
                <Ionicons name="checkmark" size={18} color="#2D2D2D" />
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity
              style={[styles.chip, styles.chipAdd]}
              onPress={() => setAddingTag(true)}
            >
              <Ionicons name="add" size={16} color="#999" />
            </TouchableOpacity>
          )}
        </ScrollView>
      </View>

      <View>
        <Text style={styles.sectionLabel}>{S.batchEdit.setLocation}</Text>
        <LocationPicker value={acquired} onChange={setAcquired} placeholder={S.batchEdit.leaveBlankToSkip} suggestions={locationSuggestions} />
      </View>

      <View>
        <Text style={styles.sectionLabel}>{S.batchEdit.setYear}</Text>
        <TextInput
          style={styles.input}
          placeholder={S.batchEdit.leaveBlankToSkip}
          placeholderTextColor="#bbb"
          value={year}
          onChangeText={t => setYear(t.replace(/[^0-9]/g, '').slice(0, 4))}
          keyboardType="number-pad"
          maxLength={4}
        />
      </View>

      <TouchableOpacity
        style={[styles.applyBtn, (!hasChanges || loading) && styles.applyBtnDisabled]}
        onPress={handleApply}
        disabled={!hasChanges || loading}
      >
        {loading
          ? <ActivityIndicator color="#fff" />
          : <Text style={styles.applyBtnText}>{S.common.apply}</Text>
        }
      </TouchableOpacity>
    </>
  );

  if (Platform.OS === 'web') {
    return (
      <Modal visible={visible} transparent animationType="fade" onRequestClose={handleClose}>
        <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={handleClose}>
          <TouchableOpacity activeOpacity={1} onPress={() => {}}>
            <View style={styles.dialog}>
              {sheetContent}
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    );
  }

  return (
    <BottomSheet visible={visible} onClose={handleClose} keyboardAvoiding sheetStyle={styles.sheet}>
      {sheetContent}
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  dialog: {
    backgroundColor: '#F5F0EB',
    borderRadius: 20,
    padding: 24,
    width: 380,
    gap: 16,
  },
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
    fontSize: 15,
    color: '#2D2D2D',
    fontWeight: '500',
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
  chipActive: {
    backgroundColor: '#2D2D2D',
    borderColor: '#2D2D2D',
  },
  chipAdd: {
    borderStyle: 'dashed',
  },
  chipText: {
    fontSize: 13,
    color: '#999',
  },
  chipTextActive: {
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
  confirmBtn: {
    padding: 2,
  },
  input: {
    backgroundColor: '#fff',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    color: '#2D2D2D',
  },
  applyBtn: {
    backgroundColor: '#2D2D2D',
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 4,
  },
  applyBtnDisabled: {
    backgroundColor: '#E0E0E0',
  },
  applyBtnText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '500',
  },
});
