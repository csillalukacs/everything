import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { S } from '../shared/strings';

export default function TagInput({ allTags = [], selectedTags, onChange, onStartAdding }) {
  const [addingTag, setAddingTag] = useState(false);
  const [newTagName, setNewTagName] = useState('');

  const allTagNames = allTags.map(t => (typeof t === 'string' ? t : t.name));
  const tagPrivacyMap = Object.fromEntries(allTags.filter(t => typeof t === 'object').map(t => [t.name, t.is_private]));
  const tagOptions = [...new Set([...allTagNames, ...selectedTags])].sort();

  function toggleTag(tag) {
    onChange(selectedTags.includes(tag) ? selectedTags.filter(t => t !== tag) : [...selectedTags, tag]);
  }

  function handleConfirmNewTag() {
    const trimmed = newTagName.trim().toLowerCase();
    if (!trimmed) {
      setAddingTag(false);
      setNewTagName('');
      return;
    }
    if (!selectedTags.includes(trimmed)) onChange([...selectedTags, trimmed]);
    setAddingTag(false);
    setNewTagName('');
  }

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={styles.tagScroll}
      contentContainerStyle={styles.tagScrollContent}
    >
      {tagOptions.map(tag => {
        const selected = selectedTags.includes(tag);
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
          onPress={() => {
            setAddingTag(true);
            onStartAdding?.();
          }}
        >
          <Ionicons name="add" size={16} color="#999" />
        </TouchableOpacity>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  tagScroll: {
    flexGrow: 0,
    marginBottom: 12,
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
});
