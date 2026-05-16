import { Ionicons } from '@expo/vector-icons';
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { S } from '../shared/strings';
import BottomSheet from './BottomSheet';

const SORT_OPTIONS = [
  { value: 'newest', label: S.filters.sort.newest },
  { value: 'oldest', label: S.filters.sort.oldest },
  { value: 'edited', label: S.filters.sort.lastEdited },
  { value: 'name-asc', label: S.filters.sort.nameAZ },
  { value: 'name-desc', label: S.filters.sort.nameZA },
  { value: 'acquired-desc', label: S.filters.sort.acquiredNewest },
  { value: 'acquired-asc', label: S.filters.sort.acquiredOldest },
  { value: 'random', label: S.filters.sort.random },
];

export default function FilterSheet({
  visible,
  onClose,
  availableYears,
  availableCities,
  hasMissingYear,
  hasMissingCity,
  activeYear,
  activeCity,
  onChangeYear,
  onChangeCity,
  sortMode,
  onChangeSort,
}) {
  const hasAny = availableYears.length > 0 || hasMissingYear || availableCities.length > 0 || hasMissingCity;
  const filtersActive = !!(activeYear || activeCity);

  return (
    <BottomSheet visible={visible} onClose={onClose} sheetStyle={styles.sheet}>
      <View style={styles.header}>
        <Text style={styles.title}>filters</Text>
        <View style={styles.headerActions}>
          {filtersActive && (
            <TouchableOpacity onPress={() => { onChangeYear(null); onChangeCity(null); }}>
              <Text style={styles.clear}>{S.common.clear}</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity onPress={onClose}>
            <Text style={styles.done}>{S.common.done}</Text>
          </TouchableOpacity>
        </View>
      </View>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
            {onChangeSort && (
              <>
                <Text style={[styles.sectionTitle, styles.sectionTitleFirst]}>{S.filters.sort.label}</Text>
                <View style={styles.chips}>
                  {SORT_OPTIONS.map(opt => {
                    const active = (sortMode ?? 'newest') === opt.value;
                    return (
                      <TouchableOpacity
                        key={`s-${opt.value}`}
                        style={[styles.chip, active && styles.chipActive]}
                        onPress={() => onChangeSort(opt.value)}
                      >
                        <Text style={[styles.chipText, active && styles.chipTextActive]}>{opt.label}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </>
            )}
            {(availableYears.length > 0 || hasMissingYear) && (
              <>
                <Text style={styles.sectionTitle}>year</Text>
                <View style={styles.chips}>
                  {hasMissingYear && (() => {
                    const active = activeYear === 'none';
                    return (
                      <TouchableOpacity
                        key="y-none"
                        style={[styles.chip, active && styles.chipActive]}
                        onPress={() => onChangeYear(active ? null : 'none')}
                      >
                        <Text style={[styles.chipText, active && styles.chipTextActive]}>{S.collection.noYear}</Text>
                      </TouchableOpacity>
                    );
                  })()}
                  {availableYears.map(y => {
                    const active = activeYear === y;
                    return (
                      <TouchableOpacity
                        key={`y-${y}`}
                        style={[styles.chip, active && styles.chipActive]}
                        onPress={() => onChangeYear(active ? null : y)}
                      >
                        <Text style={[styles.chipText, active && styles.chipTextActive]}>{y}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </>
            )}
            {(availableCities.length > 0 || hasMissingCity) && (
              <>
                <Text style={styles.sectionTitle}>city</Text>
                <View style={styles.chips}>
                  {hasMissingCity && (() => {
                    const active = activeCity === 'none';
                    return (
                      <TouchableOpacity
                        key="c-none"
                        style={[styles.chip, active && styles.chipActive]}
                        onPress={() => onChangeCity(active ? null : 'none')}
                      >
                        <Ionicons name="location-outline" size={11} color={active ? '#fff' : '#999'} />
                        <Text style={[styles.chipText, active && styles.chipTextActive]}>{S.collection.noCity}</Text>
                      </TouchableOpacity>
                    );
                  })()}
                  {availableCities.map(c => {
                    const active = activeCity === c;
                    return (
                      <TouchableOpacity
                        key={`c-${c}`}
                        style={[styles.chip, active && styles.chipActive]}
                        onPress={() => onChangeCity(active ? null : c)}
                      >
                        <Ionicons name="location-outline" size={11} color={active ? '#fff' : '#999'} />
                        <Text style={[styles.chipText, active && styles.chipTextActive]}>{c}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </>
            )}
            {!hasAny && !onChangeSort && (
              <Text style={styles.empty}>no filters available</Text>
            )}
      </ScrollView>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  sheet: {
    backgroundColor: '#F5F0EB',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 24,
    height: '70%',
    maxHeight: 560,
    width: '100%',
    maxWidth: 480,
    alignSelf: 'center',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
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
  clear: {
    fontSize: 14,
    color: '#E74C3C',
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 24,
  },
  sectionTitle: {
    fontSize: 13,
    color: '#999',
    marginTop: 16,
    marginBottom: 10,
    letterSpacing: 0.5,
  },
  sectionTitleFirst: {
    marginTop: 0,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
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
  chipText: {
    fontSize: 13,
    color: '#999',
  },
  chipTextActive: {
    color: '#fff',
  },
  empty: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
    paddingVertical: 32,
  },
});
