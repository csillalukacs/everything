import { Ionicons } from '@expo/vector-icons';
import {
  Dimensions,
  Image,
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

const SCREEN_WIDTH = Dimensions.get('window').width;

export default function ItemDetailModal({ item, category, visible, onClose, onEdit, onDelete }) {
  if (!item) return null;

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={styles.container}>

        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <Ionicons name="chevron-down" size={28} color="#2D2D2D" />
          </TouchableOpacity>
          <TouchableOpacity onPress={onEdit} style={styles.editButton}>
            <Text style={styles.editText}>edit</Text>
          </TouchableOpacity>
        </View>

        {/* Photo */}
        <View style={[styles.imageContainer, category && { borderColor: category.color, borderWidth: 3 }]}>
          {item.image_url ? (
            <Image source={{ uri: item.image_url }} style={styles.image} />
          ) : (
            <View style={styles.imagePlaceholder} />
          )}
        </View>

        {/* Info */}
        <View style={styles.info}>
          <Text style={styles.name}>{item.name}</Text>

          {category && (
            <View style={[styles.categoryChip, { backgroundColor: category.color }]}>
              <Text style={styles.categoryText}>{category.name}</Text>
            </View>
          )}

          <Text style={styles.date}>
            added {new Date(item.created_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
          </Text>
        </View>

        {/* Delete */}
        <TouchableOpacity style={styles.deleteButton} onPress={onDelete}>
          <Text style={styles.deleteText}>delete item</Text>
        </TouchableOpacity>

      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F0EB',
    paddingTop: 60,
    paddingHorizontal: 24,
    paddingBottom: 40,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  closeButton: {
    padding: 4,
  },
  editButton: {
    padding: 4,
  },
  editText: {
    fontSize: 16,
    color: '#2D2D2D',
  },
  imageContainer: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: 20,
    overflow: 'hidden',
    backgroundColor: '#E8E3DD',
    marginBottom: 24,
  },
  image: {
    width: '100%',
    height: '100%',
  },
  imagePlaceholder: {
    flex: 1,
    backgroundColor: '#E8E3DD',
  },
  info: {
    gap: 12,
    flex: 1,
  },
  name: {
    fontSize: 28,
    fontWeight: '300',
    color: '#2D2D2D',
    letterSpacing: 0.5,
  },
  categoryChip: {
    alignSelf: 'flex-start',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
  },
  categoryText: {
    fontSize: 13,
    color: '#2D2D2D',
  },
  date: {
    fontSize: 13,
    color: '#999',
  },
  deleteButton: {
    paddingVertical: 16,
    alignItems: 'center',
  },
  deleteText: {
    fontSize: 16,
    color: '#E74C3C',
  },
});
