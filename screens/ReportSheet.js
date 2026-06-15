import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import BottomSheet from './BottomSheet';
import { S } from '../shared/strings';
import { C } from '../shared/theme';

// Pick-a-reason sheet shared by item detail + profile view. The caller owns the
// actual report submission (via useCollection().reportContent) so this stays dumb.
export default function ReportSheet({ visible, onClose, onPick }) {
  return (
    <BottomSheet visible={visible} onClose={onClose} sheetStyle={styles.sheet}>
      <Text style={styles.title}>{S.moderation.reportTitle}</Text>
      <Text style={styles.subtitle}>{S.moderation.reportSubtitle}</Text>
      <View style={styles.list}>
        {S.moderation.reasons.map(reason => (
          <TouchableOpacity
            key={reason.value}
            style={styles.row}
            onPress={() => onPick(reason.value)}
            activeOpacity={0.7}
          >
            <Text style={styles.rowText}>{reason.label}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  sheet: {
    backgroundColor: C.bg,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 20,
    paddingBottom: 36,
    paddingHorizontal: 24,
  },
  title: {
    fontSize: 20,
    fontWeight: '500',
    color: C.ink,
  },
  subtitle: {
    fontSize: 14,
    color: C.muted,
    marginTop: 4,
    marginBottom: 8,
  },
  list: {
    marginTop: 8,
  },
  row: {
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: C.surface,
  },
  rowText: {
    fontSize: 16,
    color: C.ink,
  },
});
