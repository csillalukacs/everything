import { useMemo, useState } from 'react'
import { S } from '../../../shared/strings'
import { locationSuggestionsFromItems } from '../../../shared/items'
import { FEATURED_TAG_NAME, isFeaturedTag } from '../../../shared/featuredTag'
import { AppleIcon } from '../components/Icons'
import LocationPicker from './LocationPicker'

export default function BatchEditSheet({ visible, onClose, onApply, allTags = [], items = [], selectedCount, activeTag = null, loading = false }) {
  const locationSuggestions = useMemo(() => locationSuggestionsFromItems(items), [items])
  const [pendingTags, setPendingTags] = useState([])
  const [addingTag, setAddingTag] = useState(false)
  const [newTagInput, setNewTagInput] = useState('')
  const [year, setYear] = useState('')
  const [acquired, setAcquired] = useState(null)
  const [removeActiveTag, setRemoveActiveTag] = useState(false)
  const removableTag = activeTag && activeTag.id !== '__untagged__' && activeTag.name ? activeTag : null

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
    setRemoveActiveTag(false)
  }

  function buildAcquiredPatch() {
    const y = year.trim()
    const yearNum = y ? parseInt(y, 10) : null
    const validYear = yearNum && yearNum >= 1800 && yearNum <= 2100 ? yearNum : null
    if (!validYear && !acquired) return null
    const patch = {}
    if (validYear) patch.acquired_year = validYear
    if (acquired) {
      patch.acquired_location = acquired.location ?? null
      patch.acquired_lat = acquired.lat ?? null
      patch.acquired_lng = acquired.lng ?? null
    }
    return patch
  }

  function handleApply() {
    const removeTagId = removeActiveTag && removableTag ? removableTag.id : null
    onApply({ addTags: pendingTags, acquiredPatch: buildAcquiredPatch(), removeTagId })
    reset()
  }

  function handleClose() {
    if (loading) return
    reset()
    onClose()
  }

  const allTagNames = allTags.map(t => (typeof t === 'string' ? t : t.name))
  const tagOptions = [...new Set([...allTagNames, ...pendingTags])].sort((a, b) => {
    if (a === FEATURED_TAG_NAME) return -1
    if (b === FEATURED_TAG_NAME) return 1
    return a.localeCompare(b)
  })
  const hasChanges = pendingTags.length > 0 || year.trim().length > 0 || !!acquired || (removeActiveTag && !!removableTag)

  return (
    <div className="sheet-overlay" onClick={e => e.target === e.currentTarget && handleClose()}>
      <div className="sheet sheet-batch-edit">
        <p className="sheet-title">{S.batchEdit.title(selectedCount)}</p>

        <div>
          <p className="batch-section-label">{S.batchEdit.addTags}</p>
          <div className="tag-scroll">
            {tagOptions.map(tag => {
              const active = pendingTags.includes(tag)
              const featured = tag === FEATURED_TAG_NAME
              return (
                <button
                  key={tag}
                  className={`chip${active ? ' chip-active' : ''}`}
                  onClick={() => toggleTag(tag)}
                >{featured && <AppleIcon size={14} />}{tag}</button>
              )
            })}
            {addingTag ? (
              <div className="new-tag-row">
                <input
                  className="new-tag-input"
                  placeholder={S.itemForm.tagPlaceholder}
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

        {removableTag && (
          <div>
            <p className="batch-section-label">{S.batchEdit.removeTag}</p>
            <button
              className={`chip${removeActiveTag ? ' chip-active' : ''}`}
              onClick={() => setRemoveActiveTag(v => !v)}
            >{isFeaturedTag(removableTag) && <AppleIcon size={14} />}{removableTag.name}</button>
          </div>
        )}

        <div>
          <p className="batch-section-label">{S.batchEdit.setLocation}</p>
          <LocationPicker value={acquired} onChange={setAcquired} placeholder={S.batchEdit.leaveBlankToSkip} suggestions={locationSuggestions} />
        </div>

        <div>
          <p className="batch-section-label">{S.batchEdit.setYear}</p>
          <input
            className="name-input"
            placeholder={S.batchEdit.leaveBlankToSkip}
            inputMode="numeric"
            maxLength={4}
            value={year}
            onChange={e => setYear(e.target.value.replace(/[^0-9]/g, '').slice(0, 4))}
          />
        </div>

        <button
          className="btn-primary"
          onClick={handleApply}
          disabled={!hasChanges || loading}
        >{loading ? '...' : S.common.apply}</button>
      </div>
    </div>
  )
}
