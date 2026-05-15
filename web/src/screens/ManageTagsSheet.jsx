import { useMemo, useState } from 'react'
import { S } from '../../../shared/strings'
import { filterAndSortTags, validateTagRename } from '../../../shared/tagManagement'
import { isFeaturedTag } from '../../../shared/featuredTag'
import LockIcon from '../components/LockIcon'
import { AppleIcon, PencilIcon, SearchIcon } from '../components/Icons'

export default function ManageTagsSheet({
  visible,
  onClose,
  tags,
  totalTagCounts,
  onRename,
  onDelete,
  onToggleTagPrivacy,
}) {
  const [search, setSearch] = useState('')
  const [renamingTagId, setRenamingTagId] = useState(null)
  const [renameDraft, setRenameDraft] = useState('')
  const [renameError, setRenameError] = useState(null)

  const listData = useMemo(() => filterAndSortTags(tags, search), [tags, search])

  function startRenameTag(tag) {
    setRenamingTagId(tag.id)
    setRenameDraft(tag.name)
    setRenameError(null)
  }

  function cancelRenameTag() {
    setRenamingTagId(null)
    setRenameDraft('')
    setRenameError(null)
  }

  async function commitRenameTag(tag) {
    const { ok, normalized, reason } = validateTagRename(tag, renameDraft, tags)
    if (!ok) {
      if (reason === 'duplicate') { setRenameError(S.collection.tagNameTaken); return }
      cancelRenameTag()
      return
    }
    const result = await onRename(tag.id, normalized)
    if (result?.error) { setRenameError(S.collection.tagNameTaken); return }
    cancelRenameTag()
  }

  function handleClose() {
    setSearch('')
    cancelRenameTag()
    onClose()
  }

  if (!visible) return null

  return (
    <div className="sheet-overlay" onClick={handleClose}>
      <div className="sheet sheet-manage-tags" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <span className="sheet-title">{S.collection.manageTags(tags.length)}</span>
          <button className="link-btn" onClick={handleClose}>{S.common.done}</button>
        </div>
        <div className="search-container manage-tag-search">
          <SearchIcon className="search-icon" />
          <input
            type="text"
            className="search-input"
            placeholder={S.collection.searchTags}
            value={search}
            onChange={e => setSearch(e.target.value)}
            autoFocus
          />
          {search && (
            <button className="search-clear" onClick={() => setSearch('')} aria-label={S.a11y.clearSearch}>×</button>
          )}
        </div>
        <div className="manage-tag-list">
          {listData.length === 0
            ? <p className="manage-tags-empty">{tags.length === 0 ? S.collection.noTagsYet : S.common.noMatches}</p>
            : listData.map(tag => {
              const isRenaming = renamingTagId === tag.id
              const featured = isFeaturedTag(tag)
              return (
                <div key={tag.id} className="manage-tag-row">
                  <div className="manage-tag-info">
                    {featured && <AppleIcon size={16} />}
                    {isRenaming ? (
                      <input
                        type="text"
                        className={`manage-tag-rename-input${renameError ? ' manage-tag-rename-input-error' : ''}`}
                        value={renameDraft}
                        onChange={e => { setRenameDraft(e.target.value); if (renameError) setRenameError(null) }}
                        onKeyDown={e => {
                          if (e.key === 'Enter') commitRenameTag(tag)
                          else if (e.key === 'Escape') cancelRenameTag()
                        }}
                        onBlur={() => commitRenameTag(tag)}
                        autoFocus
                      />
                    ) : (
                      <span className="manage-tag-name">{tag.name}</span>
                    )}
                    {!isRenaming && (
                      <span className="manage-tag-count">{totalTagCounts.get(tag.id) ?? 0}</span>
                    )}
                    {isRenaming && renameError && (
                      <span className="manage-tag-rename-error">{renameError}</span>
                    )}
                  </div>
                  <div className="manage-tag-actions">
                    {isRenaming ? (
                      <button className="link-btn" onMouseDown={e => e.preventDefault()} onClick={cancelRenameTag}>{S.common.cancel}</button>
                    ) : (
                      <>
                        {!featured && (
                          <button
                            className="manage-tag-lock"
                            onClick={() => startRenameTag(tag)}
                            title={S.common.rename}
                          >
                            <PencilIcon size={14} color="#2D2D2D" />
                          </button>
                        )}
                        <button
                          className={`manage-tag-lock${tag.is_private ? ' manage-tag-lock-on' : ''}`}
                          onClick={() => onToggleTagPrivacy(tag)}
                          title={tag.is_private ? S.a11y.makePublic : S.a11y.makePrivate}
                        >
                          <LockIcon size={14} color={tag.is_private ? '#2D2D2D' : '#ccc'} open={!tag.is_private} />
                        </button>
                        {!featured && (
                          <button className="manage-tag-delete" onClick={() => onDelete(tag)}>{S.common.delete}</button>
                        )}
                      </>
                    )}
                  </div>
                </div>
              )
            })
          }
        </div>
      </div>
    </div>
  )
}
