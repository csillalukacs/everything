import { useState } from 'react'

export default function BatchTagSheet({ visible, onClose, onApply, allTags = [], selectedCount, loading = false }) {
  const [pendingTags, setPendingTags] = useState([])
  const [addingTag, setAddingTag] = useState(false)
  const [newTagInput, setNewTagInput] = useState('')

  if (!visible) return null

  function toggleTag(tag) {
    setPendingTags(prev => prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag])
  }

  function handleConfirmNewTag() {
    const trimmed = newTagInput.trim().toLowerCase()
    if (trimmed && !pendingTags.includes(trimmed)) setPendingTags(prev => [...prev, trimmed])
    setAddingTag(false)
    setNewTagInput('')
  }

  function handleApply() {
    onApply(pendingTags)
    setPendingTags([])
    setAddingTag(false)
    setNewTagInput('')
  }

  function handleClose() {
    if (loading) return
    setPendingTags([])
    setAddingTag(false)
    setNewTagInput('')
    onClose()
  }

  const allTagNames = allTags.map(t => (typeof t === 'string' ? t : t.name))
  const tagOptions = [...new Set([...allTagNames, ...pendingTags])].sort()

  return (
    <div className="sheet-overlay" onClick={e => e.target === e.currentTarget && handleClose()}>
      <div className="sheet">
        <p className="sheet-title">
          add tags to {selectedCount} item{selectedCount !== 1 ? 's' : ''}
        </p>
        <div className="tag-scroll">
          {tagOptions.map(tag => {
            const active = pendingTags.includes(tag)
            return (
              <button
                key={tag}
                className={`chip${active ? ' chip-active' : ''}`}
                onClick={() => toggleTag(tag)}
              >{tag}</button>
            )
          })}
          {addingTag ? (
            <div className="new-tag-row">
              <input
                className="new-tag-input"
                placeholder="tag"
                value={newTagInput}
                onChange={e => setNewTagInput(e.target.value)}
                autoFocus
                onKeyDown={e => e.key === 'Enter' && handleConfirmNewTag()}
                onBlur={handleConfirmNewTag}
              />
              <button onClick={handleConfirmNewTag} className="new-tag-confirm">✓</button>
            </div>
          ) : (
            <button className="chip chip-dashed" onClick={() => setAddingTag(true)}>+</button>
          )}
        </div>
        <button
          className="btn-primary"
          onClick={handleApply}
          disabled={pendingTags.length === 0 || loading}
        >{loading ? '...' : 'apply'}</button>
      </div>
    </div>
  )
}
