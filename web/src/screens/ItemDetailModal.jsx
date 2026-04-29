import { useRef, useState } from 'react'

export default function ItemDetailModal({ visible, item, onClose, onDelete, onSave, allTags = [], onPrev, onNext }) {
  const [editing, setEditing] = useState(false)
  const [editName, setEditName] = useState('')
  const [editPhoto, setEditPhoto] = useState(null)
  const [editPreview, setEditPreview] = useState(null)
  const [editTags, setEditTags] = useState([])
  const [saving, setSaving] = useState(false)
  const [addingTag, setAddingTag] = useState(false)
  const [newTagName, setNewTagName] = useState('')
  const fileInputRef = useRef(null)

  if (!visible || !item) return null

  function enterEdit() {
    setEditName(item.name ?? '')
    setEditPhoto(item.image_url)
    setEditPreview(item.image_url)
    setEditTags((item.tags ?? []).map(t => t.name))
    setEditing(true)
  }

  function cancelEdit() {
    setEditing(false)
    setAddingTag(false)
    setNewTagName('')
    setEditPhoto(null)
    setEditPreview(null)
  }

  function handleImageChange(f) {
    if (!f) return
    setEditPhoto(f)
    setEditPreview(URL.createObjectURL(f))
  }

  function toggleTag(tag) {
    setEditTags(prev => prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag])
  }

  function handleConfirmNewTag() {
    const trimmed = newTagName.trim().toLowerCase()
    if (trimmed && !editTags.includes(trimmed)) setEditTags(prev => [...prev, trimmed])
    setAddingTag(false)
    setNewTagName('')
  }

  async function handleSave() {
    setSaving(true)
    await onSave(editName.trim(), editPhoto, editTags)
    setSaving(false)
    setEditing(false)
    setEditPhoto(null)
    setEditPreview(null)
  }

  const itemTags = item.tags ?? []
  const tagOptions = [...new Set([...allTags, ...editTags])].sort()

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && (editing ? cancelEdit() : onClose())}>
      <div className="modal modal-detail">
        <div className="modal-header">
          <button className="link-btn" onClick={editing ? cancelEdit : onClose}>
            {editing ? 'cancel' : '✕'}
          </button>
          {!editing && (
            <div className="nav-buttons">
              <button onClick={onPrev} disabled={!onPrev} className="nav-btn">‹</button>
              <button onClick={onNext} disabled={!onNext} className="nav-btn">›</button>
            </div>
          )}
          <button
            className="link-btn link-btn-dark"
            onClick={editing ? handleSave : enterEdit}
            disabled={saving}
          >{editing ? (saving ? 'saving...' : 'save') : 'edit'}</button>
        </div>

        <div className="detail-layout">
          <div className="detail-image-col">
            <div className="detail-image-wrap">
              {(editing ? editPreview : item.image_url) && (
                <img src={editing ? editPreview : item.image_url} alt={item.name || ''} className="detail-image" />
              )}
              {editing && (
                <div className="image-overlay" onClick={() => fileInputRef.current?.click()}>
                  change image
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    style={{ display: 'none' }}
                    onChange={e => handleImageChange(e.target.files[0])}
                  />
                </div>
              )}
            </div>
          </div>

          <div className="detail-info-col">
            {editing ? (
              <>
                <div className="tag-scroll">
                  {tagOptions.map(tag => {
                    const selected = editTags.includes(tag)
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
                  value={editName}
                  onChange={e => setEditName(e.target.value)}
                />
              </>
            ) : (
              <>
                {item.name && <h2 className="detail-name">{item.name}</h2>}
                {itemTags.length > 0 && (
                  <div className="tag-row">
                    {itemTags.map(tag => (
                      <span key={tag.id} className="tag-badge">{tag.name}</span>
                    ))}
                  </div>
                )}
                <p className="detail-date">
                  added {new Date(item.created_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                </p>
                <button className="delete-btn" onClick={onDelete}>delete item</button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
