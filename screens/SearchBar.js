import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Modal, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { S } from '../shared/strings';
import { C } from '../shared/theme';

export default function SearchBar({ value, onChange, rightAdornment }) {
  const [helpVisible, setHelpVisible] = useState(false);

  return (
    <View style={styles.searchRow}>
      <View style={styles.searchContainer}>
        <Ionicons name="search" size={16} color="#999" />
        <TextInput
          style={styles.searchInput}
          placeholder={S.common.search}
          placeholderTextColor="#999"
          value={value}
          onChangeText={onChange}
          autoCorrect={false}
          autoCapitalize="none"
          returnKeyType="search"
        />
        {value.length > 0 && (
          <TouchableOpacity onPress={() => onChange('')}>
            <Ionicons name="close-circle" size={16} color="#999" />
          </TouchableOpacity>
        )}
        <TouchableOpacity
          style={styles.searchHelpButton}
          onPress={() => setHelpVisible(true)}
          accessibilityLabel={S.a11y.searchHelp}
          hitSlop={8}
        >
          <Text style={styles.searchHelpButtonText}>?</Text>
        </TouchableOpacity>
      </View>
      {rightAdornment}

      <Modal
        visible={helpVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setHelpVisible(false)}
      >
        <TouchableOpacity
          style={styles.searchHelpBackdrop}
          activeOpacity={1}
          onPress={() => setHelpVisible(false)}
        >
          <TouchableOpacity activeOpacity={1} style={styles.searchHelpCard} onPress={() => {}}>
            <Text style={styles.searchHelpTitle}>{S.searchHelp.title}</Text>
            <Text style={styles.searchHelpIntro}>{S.searchHelp.intro}</Text>
            <ScrollView style={styles.searchHelpList}>
              {S.searchHelp.examples.map(ex => (
                <TouchableOpacity
                  key={ex.code}
                  style={styles.searchHelpRow}
                  onPress={() => {
                    onChange(ex.code);
                    setHelpVisible(false);
                  }}
                >
                  <Text style={styles.searchHelpCode}>{ex.code}</Text>
                  <Text style={styles.searchHelpDesc}>{ex.desc}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  searchContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    height: 40,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: '#E0E0E0',
    backgroundColor: '#fff',
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: C.ink,
    paddingVertical: 0,
  },
  searchHelpButton: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1.5,
    borderColor: '#E0E0E0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchHelpButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#999',
    lineHeight: 14,
  },
  searchHelpBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  searchHelpCard: {
    width: '100%',
    maxWidth: 420,
    maxHeight: '80%',
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
  },
  searchHelpTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: C.ink,
    marginBottom: 4,
  },
  searchHelpIntro: {
    fontSize: 13,
    color: '#999',
    marginBottom: 12,
  },
  searchHelpList: {
    flexGrow: 0,
  },
  searchHelpRow: {
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: C.line,
  },
  searchHelpCode: {
    fontFamily: 'Menlo',
    fontSize: 13,
    color: C.ink,
    marginBottom: 2,
  },
  searchHelpDesc: {
    fontSize: 12,
    color: '#666',
  },
});
