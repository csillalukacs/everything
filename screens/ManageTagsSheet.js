import { Ionicons } from '@expo/vector-icons';
import { useMemo, useState } from 'react';
import { FlatList, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import BottomSheet from './BottomSheet';
import { S } from '../shared/strings';
import { filterAndSortTags, validateTagRename } from '../shared/tagManagement';

export default function ManageTagsSheet({
  visible,
  onClose,
  tags,
  totalTagCounts,
  onRename,
  onDelete,
  onToggleTagPrivacy,
}) {
  const [search, setSearch] = useState('');
  const [renamingTagId, setRenamingTagId] = useState(null);
  const [renameDraft, setRenameDraft] = useState('');
  const [renameError, setRenameError] = useState(null);

  const listData = useMemo(() => filterAndSortTags(tags, search), [tags, search]);

  function startRenameTag(tag) {
    setRenamingTagId(tag.id);
    setRenameDraft(tag.name);
    setRenameError(null);
  }

  function cancelRenameTag() {
    setRenamingTagId(null);
    setRenameDraft('');
    setRenameError(null);
  }

  async function commitRenameTag(tag) {
    const { ok, normalized, reason } = validateTagRename(tag, renameDraft, tags);
    if (!ok) {
      if (reason === 'duplicate') { setRenameError(S.collection.tagNameTaken); return; }
      cancelRenameTag();
      return;
    }
    const result = await onRename(tag.id, normalized);
    if (result?.error) { setRenameError(S.collection.tagNameTaken); return; }
    cancelRenameTag();
  }

  function handleClose() {
    setSearch('');
    cancelRenameTag();
    onClose();
  }

  return (
    <BottomSheet visible={visible} onClose={handleClose} sheetStyle={styles.sheet}>
      <View style={styles.header}>
        <Text style={styles.title}>{S.collection.manageTags(tags.length)}</Text>
        <TouchableOpacity onPress={handleClose}>
          <Text style={styles.done}>{S.common.done}</Text>
        </TouchableOpacity>
      </View>
      <View style={styles.searchContainer}>
        <Ionicons name="search" size={16} color="#999" />
        <TextInput
          style={styles.searchInput}
          placeholder={S.collection.searchTags}
          placeholderTextColor="#999"
          value={search}
          onChangeText={setSearch}
          autoCorrect={false}
          autoCapitalize="none"
        />
        {search.length > 0 && (
          <TouchableOpacity onPress={() => setSearch('')}>
            <Ionicons name="close-circle" size={16} color="#999" />
          </TouchableOpacity>
        )}
      </View>
      <FlatList
        style={styles.list}
        data={listData}
        keyExtractor={tag => tag.id}
        keyboardShouldPersistTaps="handled"
        ListEmptyComponent={
          <Text style={styles.empty}>
            {tags.length === 0 ? S.collection.noTagsYet : S.common.noMatches}
          </Text>
        }
        renderItem={({ item: tag, index }) => {
          const isRenaming = renamingTagId === tag.id;
          return (
            <View style={[styles.row, index < listData.length - 1 && styles.rowBorder]}>
              <View style={styles.tagInfo}>
                {isRenaming ? (
                  <TextInput
                    style={[styles.tagName, styles.renameInput, renameError && styles.renameInputError]}
                    value={renameDraft}
                    onChangeText={(v) => { setRenameDraft(v); if (renameError) setRenameError(null); }}
                    onSubmitEditing={() => commitRenameTag(tag)}
                    onBlur={() => commitRenameTag(tag)}
                    autoFocus
                    autoCorrect={false}
                    autoCapitalize="none"
                    returnKeyType="done"
                  />
                ) : (
                  <Text style={styles.tagName} numberOfLines={1}>{tag.name}</Text>
                )}
                {!isRenaming && (
                  <Text style={styles.tagCount}>{totalTagCounts.get(tag.id) ?? 0}</Text>
                )}
                {isRenaming && renameError && (
                  <Text style={styles.renameError} numberOfLines={1}>{renameError}</Text>
                )}
              </View>
              <View style={styles.actions}>
                {isRenaming ? (
                  <TouchableOpacity onPress={cancelRenameTag}>
                    <Text style={styles.done}>{S.common.cancel}</Text>
                  </TouchableOpacity>
                ) : (
                  <>
                    <TouchableOpacity onPress={() => startRenameTag(tag)} style={styles.lockBtn}>
                      <Ionicons name="pencil-outline" size={16} color="#999" />
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => onToggleTagPrivacy(tag)} style={styles.lockBtn}>
                      <Ionicons
                        name={tag.is_private ? 'lock-closed' : 'lock-open-outline'}
                        size={16}
                        color={tag.is_private ? '#2D2D2D' : '#ccc'}
                      />
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => onDelete(tag)}>
                      <Text style={styles.deleteBtn}>{S.common.delete}</Text>
                    </TouchableOpacity>
                  </>
                )}
              </View>
            </View>
          );
        }}
      />
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
  title: {
    fontSize: 15,
    fontWeight: '500',
    color: '#2D2D2D',
  },
  done: {
    fontSize: 15,
    color: '#999',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    height: 36,
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: '#E0E0E0',
    backgroundColor: '#fff',
    marginBottom: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: '#2D2D2D',
    paddingVertical: 0,
  },
  list: {
    flex: 1,
  },
  empty: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
    paddingVertical: 32,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
  },
  rowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: '#E8E3DD',
  },
  tagInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginRight: 12,
  },
  tagName: {
    fontSize: 15,
    color: '#2D2D2D',
  },
  tagCount: {
    fontSize: 12,
    color: '#999',
  },
  renameInput: {
    flex: 1,
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderWidth: 1.5,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    backgroundColor: '#fff',
  },
  renameInputError: {
    borderColor: '#E74C3C',
  },
  renameError: {
    fontSize: 11,
    color: '#E74C3C',
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  lockBtn: {
    padding: 2,
  },
  deleteBtn: {
    fontSize: 13,
    color: '#E74C3C',
  },
});
