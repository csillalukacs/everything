import { useEffect, useRef, useState } from 'react';
import { Keyboard, StyleSheet, TextInput, TouchableOpacity, View } from 'react-native';
import { S } from '../shared/strings';
import LocationPicker from './LocationPicker';

export default function ItemFieldsEditor({
  name,
  onNameChange,
  description,
  onDescriptionChange,
  acquired,
  onAcquiredChange,
  year,
  onYearChange,
  locationSuggestions,
}) {
  const [nameEditable, setNameEditable] = useState(false);
  const nameInputRef = useRef(null);

  useEffect(() => {
    if (nameEditable) nameInputRef.current?.focus();
  }, [nameEditable]);

  return (
    <View style={styles.fields}>
      <TouchableOpacity activeOpacity={1} onPress={() => setNameEditable(true)}>
        <TextInput
          ref={nameInputRef}
          style={styles.input}
          value={name}
          onChangeText={onNameChange}
          placeholder={S.itemForm.namePlaceholder}
          placeholderTextColor="#bbb"
          editable={nameEditable}
          pointerEvents={nameEditable ? 'auto' : 'none'}
          returnKeyType="done"
          onSubmitEditing={Keyboard.dismiss}
        />
      </TouchableOpacity>
      <TextInput
        style={styles.input}
        value={description}
        onChangeText={onDescriptionChange}
        placeholder={S.itemForm.descriptionPlaceholder}
        placeholderTextColor="#bbb"
        returnKeyType="done"
        onSubmitEditing={Keyboard.dismiss}
      />
      <LocationPicker value={acquired} onChange={onAcquiredChange} placeholder={S.itemForm.cityPlaceholder} suggestions={locationSuggestions} />
      <TextInput
        style={styles.input}
        placeholder={S.itemForm.yearPlaceholder}
        placeholderTextColor="#bbb"
        value={year}
        onChangeText={t => onYearChange(t.replace(/[^0-9]/g, '').slice(0, 4))}
        keyboardType="number-pad"
        maxLength={4}
        returnKeyType="done"
        onSubmitEditing={Keyboard.dismiss}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  fields: {
    gap: 12,
  },
  input: {
    backgroundColor: '#fff',
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 15,
    color: '#2D2D2D',
    borderWidth: 1.5,
    borderColor: '#E0E0E0',
  },
});
