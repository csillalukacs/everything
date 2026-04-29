import { useRef, useState } from 'react'

function LockIcon({ size = 10, color = 'currentColor', open = false }) {
  const d = open
    ? 'M12 1C9.24 1 7 3.24 7 6v1H5c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V9c0-1.1-.9-2-2-2h-2V6c0-2.76-2.24-5-5-5zm-1 14c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm3.1-7H8.9V6c0-1.71 1.39-3.1 3.1-3.1 1.71 0 3.1 1.39 3.1 3.1v2zM17 7h-2V6c0-2.76-2.24-5-5-5S5 3.24 5 6v1'
    : 'M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-6 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm3.1-9H8.9V6c0-1.71 1.39-3.1 3.1-3.1 1.71 0 3.1 1.39 3.1 3.1v2z'
  return <svg width={size} height={size} viewBox="0 0 24 24" fill={color} aria-hidden><path d={d} /></svg>
}

export default function AddItemModal({ visible, onClose, onSave, allTags = [] }) {
  const [file, setFile] = useState(null)
  const [preview, setPreview] = useState(null)
  const [name, setName] = useState('')
  const [tags, setTags] = useState([])
  const [isPrivate, setIsPrivate] = useState(false)
  const [saving, setSaving] = useState(false)
  const [addingTag, setAddingTag] = useState(false)
  const [newTagName, setNewTagName] = useState('')
  const fileInputRef = useRef(null)

  if (!visible) return null

  function handleFileChange(f) {
    if (!f) return
    setFile(f)
    setPreview(URL.createObjectURL(f))
  }

  function handleDrop(e) {
    e.preventDefault()
    const f = e.dataTransfer.files[0]
    if (f?.type.startsWith('image/')) handleFileChange(f)
  }

  function toggleTag(tag) {
    setTags(prev => prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag])
  }

  function handleConfirmNewTag() {
    const trimmed = newTagName.trim().toLowerCase()
    if (trimmed && !tags.includes(trimmed)) setTags(prev => [...prev, trimmed])
    setAddingTag(false)
    setNewTagName('')
  }

  async function handleSave() {
    if (!file) return
    setSaving(true)
    await onSave(name.trim(), file, tags, isPrivate)
    setFile(null)
    setPreview(null)
    setName('')
    setTags([])
    setIsPrivate(false)
    setSaving(false)
  }

  function handleClose() {
    setFile(null)
    setPreview(null)
    setName('')
    setTags([])
    setIsPrivate(false)
    setAddingTag(false)
    setNewTagName('')
    onClose()
  }

  const allTagNames = allTags.map(t => (typeof t === 'string' ? t : t.name))
  const tagPrivacyMap = Object.fromEntries(allTags.filter(t => typeof t === 'object').map(t => [t.name, t.is_private]))
  const tagOptions = [...new Set([...allTagNames, ...tags])].sort()

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && handleClose()}>
      <div className="modal">
        <div className="modal-header">
          <button className="link-btn" onClick={handleClose}>cancel</button>
          <span className="modal-title">add item</span>
          <button
            className="link-btn link-btn-dark"
            onClick={handleSave}
            disabled={!file || saving}
          >{saving ? 'saving...' : 'save'}</button>
        </div>

        {preview ? (
          <div className="image-preview-wrap" onClick={() => { setFile(null); setPreview(null) }}>
            <img src={preview} alt="" className="image-preview" />
            <div className="image-overlay">retake</div>
          </div>
        ) : (
          <div
            className="drop-zone"
            onClick={() => fileInputRef.current?.click()}
            onDragOver={e => e.preventDefault()}
            onDrop={handleDrop}
          >
            <span className="drop-zone-icon">+</span>
            <span className="drop-zone-text">click or drag to add a photo</span>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              style={{ display: 'none' }}
              onChange={e => handleFileChange(e.target.files[0])}
            />
          </div>
        )}

        <div className="tag-scroll">
          {tagOptions.map(tag => {
            const selected = tags.includes(tag)
            const isTagPrivate = tagPrivacyMap[tag]
            return (
              <button
                key={tag}
                className={`chip${selected ? ' chip-active' : ''}`}
                onClick={() => toggleTag(tag)}
              >{isTagPrivate && <LockIcon size={10} color="currentColor" />}{tag}</button>
            )
          })}
          {addingTag ? (
            <div className="new-tag-row">
              <input
                className="new-tag-input"
                placeholder="tag"
                value={newTagName}
                onChange={e => setNewTagName(e.target.value)}
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

        <input
          className="name-input"
          placeholder="name (optional)"
          value={name}
          onChange={e => setName(e.target.value)}
        />
        <button
          className={`privacy-toggle${isPrivate ? ' privacy-toggle-on' : ''}`}
          onClick={() => setIsPrivate(prev => !prev)}
        >
          <LockIcon size={12} color={isPrivate ? '#2D2D2D' : '#bbb'} open={!isPrivate} />
          {isPrivate ? 'private' : 'public'}
        </button>
      </div>
    </div>
  )
}
