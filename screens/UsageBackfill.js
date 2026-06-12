import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { dayKey, lastNDays, MONTH_NAMES } from '../shared/dates';
import { S } from '../shared/strings';

const WEEKDAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

// Backfill grid: the last 30 days as toggleable day chips. Tapping a day logs or removes
// a (silent, no-feed) usage for that day. `usedDays` is a Set of 'YYYY-MM-DD' keys.
export default function UsageBackfill({ usedDays, onToggle }) {
  const days = lastNDays(30).slice().reverse(); // newest first

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{S.usage.backfillTitle}</Text>
      <Text style={styles.hint}>{S.usage.backfillHint}</Text>
      <View style={styles.grid}>
        {days.map(d => {
          const key = dayKey(d);
          const used = usedDays.has(key);
          return (
            <TouchableOpacity
              key={key}
              style={[styles.chip, used && styles.chipOn]}
              onPress={() => onToggle(key, !used)}
              activeOpacity={0.7}
            >
              <Text style={[styles.chipWeekday, used && styles.chipTextOn]}>{WEEKDAYS[d.getDay()]}</Text>
              <Text style={[styles.chipDay, used && styles.chipTextOn]}>{d.getDate()}</Text>
              <Text style={[styles.chipMonth, used && styles.chipTextOn]}>{MONTH_NAMES[d.getMonth()].toLowerCase()}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 4,
  },
  title: {
    fontSize: 15,
    fontWeight: '500',
    color: '#2D2D2D',
  },
  hint: {
    fontSize: 13,
    color: '#999',
    marginBottom: 8,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    width: 48,
    paddingVertical: 8,
    borderRadius: 12,
    alignItems: 'center',
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#E8E3DD',
  },
  chipOn: {
    backgroundColor: '#2D2D2D',
    borderColor: '#2D2D2D',
  },
  chipWeekday: {
    fontSize: 10,
    color: '#999',
  },
  chipDay: {
    fontSize: 17,
    fontWeight: '500',
    color: '#2D2D2D',
  },
  chipMonth: {
    fontSize: 10,
    color: '#999',
  },
  chipTextOn: {
    color: '#fff',
  },
});
