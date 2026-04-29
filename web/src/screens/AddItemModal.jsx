import { useRef, useState } from 'react'

export default function AddItemModal({ visible, onClose, onSave, allTags = [] }) {
  const [file, setFile] = useState(null)
  const [preview, setPreview] = useState(null)
  const [name, setName] = useState('')
  const [tags, setTags] = useState([])
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
    await onSave(name.trim(), file, tags)
    setFile(null)
    setPreview(null)
    setName('')
    setTags([])
    setSaving(false)
  }

  function handleClose() {
    setFile(null)
    setPreview(null)
    setName('')
    setTags([])
    setAddingTag(false)
    setNewTagName('')
    onClose()
  }

  const tagOptions = [...new Set([...allTags, ...tags])].sort()

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
            return (
              <button
                key={tag}
                className={`chip${selected ? ' chip-active' : ''}`}
                onClick={() => toggleTag(tag)}
              >{tag}</button>
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
      </div>
    </div>
  )
}
