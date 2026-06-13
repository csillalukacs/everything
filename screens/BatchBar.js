import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { S } from '../shared/strings';
import { C } from '../shared/theme';

export default function BatchBar({ selectedIds, items, onCancel, onTogglePrivacy, onDelete, onEdit }) {
  const allPrivate = [...selectedIds].every(id => items.find(i => i.id === id)?.is_private);
  return (
    <View style={styles.batchBar}>
      <TouchableOpacity onPress={onCancel} style={styles.btn}>
        <Text style={styles.cancelText}>{S.common.cancel}</Text>
      </TouchableOpacity>
      <Text style={styles.count}>{S.batchEdit.selectedCount(selectedIds.size)}</Text>
      <View style={styles.actions}>
        <TouchableOpacity onPress={onTogglePrivacy} style={styles.icon}>
          <Ionicons name={allPrivate ? 'lock-closed' : 'lock-open-outline'} size={18} color="#fff" />
        </TouchableOpacity>
        <TouchableOpacity onPress={onDelete} style={styles.icon}>
          <Ionicons name="trash-outline" size={18} color={C.red} />
        </TouchableOpacity>
        <TouchableOpacity onPress={onEdit} style={styles.btn}>
          <Text style={styles.editText}>{S.common.edit}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  batchBar: {
    position: 'absolute',
    left: 24,
    right: 24,
    bottom: 10,
    height: 56,
    borderRadius: 28,
    backgroundColor: C.ink,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  btn: {
    padding: 8,
    minWidth: 56,
  },
  cancelText: {
    color: '#aaa',
    fontSize: 15,
  },
  count: {
    color: '#fff',
    fontSize: 14,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  icon: {
    padding: 8,
  },
  editText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '500',
    textAlign: 'right',
  },
});
