import { useRef, useState } from 'react'

function LockIcon({ size = 10, color = 'currentColor', open = false }) {
  const d = open
    ? 'M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-6 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm-1-7V6c0-1.71 1.39-3.1 3.1-3.1 1.71 0 3.1 1.39 3.1 3.1v2H9z'
    : 'M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-6 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm3.1-9H8.9V6c0-1.71 1.39-3.1 3.1-3.1 1.71 0 3.1 1.39 3.1 3.1v2z'
  return <svg width={size} height={size} viewBox="0 0 24 24" fill={color} aria-hidden><path d={d} /></svg>
}

export default function ItemDetailModal({ visible, item, onClose, onDelete, onSave, allTags = [], onPrev, onNext }) {
  const [editing, setEditing] = useState(false)
  const [editName, setEditName] = useState('')
  const [editDescription, setEditDescription] = useState('')
  const [editPhoto, setEditPhoto] = useState(null)
  const [editPreview, setEditPreview] = useState(null)
  const [editTags, setEditTags] = useState([])
  const [editPrivate, setEditPrivate] = useState(false)
  const [saving, setSaving] = useState(false)
  const [addingTag, setAddingTag] = useState(false)
  const [newTagName, setNewTagName] = useState('')
  const fileInputRef = useRef(null)

  if (!visible || !item) return null

  function enterEdit() {
    setEditName(item.name ?? '')
    setEditDescription(item.description ?? '')
    setEditPhoto(item.image_url)
    setEditPreview(item.image_url)
    setEditTags((item.tags ?? []).map(t => t.name))
    setEditPrivate(item.is_private ?? false)
    setEditing(true)
  }

  function cancelEdit() {
    setEditing(false)
    setAddingTag(false)
    setNewTagName('')
    setEditPhoto(null)
    setEditPreview(null)
    setEditDescription('')
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
    await onSave(editName.trim(), editPhoto, editTags, editPrivate, editDescription.trim())
    setSaving(false)
    setEditing(false)
    setEditPhoto(null)
    setEditPreview(null)
    setEditDescription('')
  }

  const itemTags = item.tags ?? []
  const allTagNames = allTags.map(t => (typeof t === 'string' ? t : t.name))
  const tagPrivacyMap = Object.fromEntries(allTags.filter(t => typeof t === 'object').map(t => [t.name, t.is_private]))
  const tagOptions = [...new Set([...allTagNames, ...editTags])].sort()

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
          {onSave && (
            <button
              className="link-btn link-btn-dark"
              onClick={editing ? handleSave : enterEdit}
              disabled={saving}
            >{editing ? (saving ? 'saving...' : 'save') : 'edit'}</button>
          )}
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
                  value={editName}
                  onChange={e => setEditName(e.target.value)}
                />
                <textarea
                  className="description-input"
                  placeholder="description (optional)"
                  value={editDescription}
                  onChange={e => setEditDescription(e.target.value)}
                />
                <button
                  className={`privacy-toggle${editPrivate ? ' privacy-toggle-on' : ''}`}
                  onClick={() => setEditPrivate(prev => !prev)}
                >
                  <LockIcon size={12} color={editPrivate ? '#2D2D2D' : '#bbb'} open={!editPrivate} />
                  {editPrivate ? 'private' : 'public'}
                </button>
              </>
            ) : (
              <>
                <div className="detail-name-row">
                  {item.name && <h2 className="detail-name">{item.name}</h2>}
                  {item.is_private && <LockIcon size={14} color="#999" />}
                </div>
                {itemTags.length > 0 && (
                  <div className="tag-row">
                    {itemTags.map(tag => (
                      <span key={tag.id} className="tag-badge">
                        {tag.is_private && <LockIcon size={9} color="#bbb" />}{tag.name}
                      </span>
                    ))}
                  </div>
                )}
                {item.description && <p className="detail-description">{item.description}</p>}
                <p className="detail-date">
                  added {new Date(item.created_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                </p>
                {onDelete && <button className="delete-btn" onClick={onDelete}>delete item</button>}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
