import { useState } from 'react'
import LocationPicker from './LocationPicker'

export default function BatchEditSheet({ visible, onClose, onApply, allTags = [], selectedCount, loading = false }) {
  const [pendingTags, setPendingTags] = useState([])
  const [addingTag, setAddingTag] = useState(false)
  const [newTagInput, setNewTagInput] = useState('')
  const [year, setYear] = useState('')
  const [acquired, setAcquired] = useState(null)

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

  function reset() {
    setPendingTags([])
    setAddingTag(false)
    setNewTagInput('')
    setYear('')
    setAcquired(null)
  }

  function buildAcquired() {
    const y = year.trim()
    const yearNum = y ? parseInt(y, 10) : null
    const validYear = yearNum && yearNum >= 1800 && yearNum <= 2100 ? yearNum : null
    if (!validYear && !acquired) return null
    return { year: validYear, location: acquired?.location ?? null, lat: acquired?.lat ?? null, lng: acquired?.lng ?? null }
  }

  function handleApply() {
    onApply({ addTags: pendingTags, acquired: buildAcquired() })
    reset()
  }

  function handleClose() {
    if (loading) return
    reset()
    onClose()
  }

  const allTagNames = allTags.map(t => (typeof t === 'string' ? t : t.name))
  const tagOptions = [...new Set([...allTagNames, ...pendingTags])].sort()
  const hasChanges = pendingTags.length > 0 || year.trim().length > 0 || !!acquired

  return (
    <div className="sheet-overlay" onClick={e => e.target === e.currentTarget && handleClose()}>
      <div className="sheet sheet-batch-edit">
        <p className="sheet-title">
          edit {selectedCount} item{selectedCount !== 1 ? 's' : ''}
        </p>

        <div>
          <p className="batch-section-label">add tags</p>
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
        </div>

        <div>
          <p className="batch-section-label">set year</p>
          <input
            className="name-input"
            placeholder="leave blank to skip"
            inputMode="numeric"
            maxLength={4}
            value={year}
            onChange={e => setYear(e.target.value.replace(/[^0-9]/g, '').slice(0, 4))}
          />
        </div>

        <div>
          <p className="batch-section-label">set location</p>
          <LocationPicker value={acquired} onChange={setAcquired} placeholder="leave blank to skip" />
        </div>

        <button
          className="btn-primary"
          onClick={handleApply}
          disabled={!hasChanges || loading}
        >{loading ? '...' : 'apply'}</button>
      </div>
    </div>
  )
}
