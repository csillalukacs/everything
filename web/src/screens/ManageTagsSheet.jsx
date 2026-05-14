import { useMemo, useState } from 'react'
import { S } from '../../../shared/strings'
import { filterAndSortTags, validateTagRename } from '../../../shared/tagManagement'
import LockIcon from '../components/LockIcon'

function PencilIcon({ size = 14, color = 'currentColor' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
    </svg>
  )
}

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
          <svg className="search-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#999" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <circle cx="11" cy="11" r="7" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
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
              return (
                <div key={tag.id} className="manage-tag-row">
                  <div className="manage-tag-info">
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
                        <button
                          className="manage-tag-lock"
                          onClick={() => startRenameTag(tag)}
                          title={S.common.rename}
                        >
                          <PencilIcon size={14} color="#2D2D2D" />
                        </button>
                        <button
                          className={`manage-tag-lock${tag.is_private ? ' manage-tag-lock-on' : ''}`}
                          onClick={() => onToggleTagPrivacy(tag)}
                          title={tag.is_private ? S.a11y.makePublic : S.a11y.makePrivate}
                        >
                          <LockIcon size={14} color={tag.is_private ? '#2D2D2D' : '#ccc'} open={!tag.is_private} />
                        </button>
                        <button className="manage-tag-delete" onClick={() => onDelete(tag)}>{S.common.delete}</button>
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
