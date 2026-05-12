import { Ionicons } from '@expo/vector-icons';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { searchPlaces } from '../lib/geocode';
import { S } from '../shared/strings';

export default function LocationPicker({ value, onChange, placeholder = S.location.defaultPlaceholder, onFocus: onFocusProp, suggestions = [] }) {
  const [query, setQuery] = useState(value?.location ?? '');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [focused, setFocused] = useState(false);
  const debounceRef = useRef(null);
  const reqIdRef = useRef(0);

  useEffect(() => {
    setQuery(value?.location ?? '');
  }, [value?.location]);

  function handleChange(text) {
    setQuery(text);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const trimmed = text.trim();
    if (!trimmed) {
      setResults([]);
      setLoading(false);
      onChange(null);
      return;
    }
    const lower = trimmed.toLowerCase();
    const local = suggestions
      .filter(s => s.location?.toLowerCase().includes(lower))
      .slice(0, 5)
      .map(s => ({ display_name: s.location, lat: s.lat, lng: s.lng }));
    if (local.length > 0) {
      setResults(local);
      setLoading(false);
      return;
    }
    setLoading(true);
    debounceRef.current = setTimeout(async () => {
      const myReq = ++reqIdRef.current;
      const places = await searchPlaces(text);
      if (myReq !== reqIdRef.current) return;
      setResults(places);
      setLoading(false);
    }, 400);
  }

  function pick(place) {
    setQuery(place.display_name);
    setResults([]);
    setFocused(false);
    onChange({ location: place.display_name, lat: place.lat, lng: place.lng });
  }

  function clear() {
    setQuery('');
    setResults([]);
    onChange(null);
  }

  const hasCoords = !!value?.lat && !!value?.lng;
  const showResults = focused && results.length > 0;

  return (
    <View style={styles.wrap}>
      <View style={styles.inputRow}>
        <Ionicons name="location-outline" size={16} color={hasCoords ? '#2D2D2D' : '#bbb'} />
        <TextInput
          style={styles.input}
          placeholder={placeholder}
          placeholderTextColor="#bbb"
          value={query}
          onChangeText={handleChange}
          onFocus={() => { setFocused(true); onFocusProp?.(); }}
          onBlur={() => setTimeout(() => setFocused(false), 150)}
          autoCorrect={false}
          autoCapitalize="words"
        />
        {loading
          ? <ActivityIndicator size="small" color="#999" />
          : query.length > 0 && (
            <TouchableOpacity onPress={clear}>
              <Ionicons name="close-circle" size={16} color="#999" />
            </TouchableOpacity>
          )}
      </View>
      {showResults && (
        <View style={styles.results} onLayout={() => onFocusProp?.()}>
          {results.map((r, i) => (
            <TouchableOpacity
              key={`${r.lat},${r.lng},${i}`}
              style={[styles.result, i < results.length - 1 && styles.resultBorder]}
              onPress={() => pick(r)}
            >
              <Text style={styles.resultText} numberOfLines={2}>{r.display_name}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'relative',
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#fff',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  input: {
    flex: 1,
    fontSize: 14,
    color: '#2D2D2D',
    paddingVertical: 0,
  },
  results: {
    marginTop: 6,
    backgroundColor: '#fff',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    overflow: 'hidden',
  },
  result: {
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  resultBorder: {
    borderBottomWidth: 1,
    borderBottomColor: '#F0EBE5',
  },
  resultText: {
    fontSize: 13,
    color: '#2D2D2D',
  },
});
