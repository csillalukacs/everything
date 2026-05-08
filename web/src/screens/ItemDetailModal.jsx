import { useEffect, useRef, useState } from 'react'
import LocationPicker from './LocationPicker'
import TagInput from './TagInput'

function LockIcon({ size = 10, color = 'currentColor', open = false }) {
  const d = open
    ? 'M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-6 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm-1-7V6c0-1.71 1.39-3.1 3.1-3.1 1.71 0 3.1 1.39 3.1 3.1v2H9z'
    : 'M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-6 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm3.1-9H8.9V6c0-1.71 1.39-3.1 3.1-3.1 1.71 0 3.1 1.39 3.1 3.1v2z'
  return <svg width={size} height={size} viewBox="0 0 24 24" fill={color} aria-hidden><path d={d} /></svg>
}

export default function ItemDetailModal({ visible, item, onClose, onDelete, onSave, allTags = [], onPrev, onNext, onTagPress, onYearPress, onCityPress }) {
  const [editing, setEditing] = useState(false)
  const [editName, setEditName] = useState('')
  const [editDescription, setEditDescription] = useState('')
  const [editPhoto, setEditPhoto] = useState(null)
  const [editPreview, setEditPreview] = useState(null)
  const [editImageAddedAt, setEditImageAddedAt] = useState(null)
  const [editPreviousImages, setEditPreviousImages] = useState([])
  const [displayedIdx, setDisplayedIdx] = useState(0)
  const [editTags, setEditTags] = useState([])
  const [editPrivate, setEditPrivate] = useState(false)
  const [editYear, setEditYear] = useState('')
  const [editAcquired, setEditAcquired] = useState(null)
  const [saving, setSaving] = useState(false)
  const fileInputRef = useRef(null)

  useEffect(() => { setDisplayedIdx(0) }, [item?.id])

  if (!visible || !item) return null

  function enterEdit() {
    setEditName(item.name ?? '')
    setEditDescription(item.description ?? '')
    setEditPhoto(item.image_url)
    setEditPreview(item.image_url)
    setEditImageAddedAt(item.image_added_at ?? item.created_at)
    setEditPreviousImages(item.previous_images ?? [])
    setDisplayedIdx(0)
    setEditTags((item.tags ?? []).map(t => t.name))
    setEditPrivate(item.is_private ?? false)
    setEditYear(item.acquired_year ? String(item.acquired_year) : '')
    setEditAcquired(item.acquired_location
      ? { location: item.acquired_location, lat: item.acquired_lat, lng: item.acquired_lng }
      : null)
    setEditing(true)
  }

  function cancelEdit() {
    setEditing(false)
    setEditPhoto(null)
    setEditPreview(null)
    setEditDescription('')
    setDisplayedIdx(0)
  }

  function handleImageChange(f) {
    if (!f) return
    if (typeof editPhoto === 'string' && editPhoto.startsWith('http')) {
      const kept = { url: editPhoto, added_at: editImageAddedAt ?? item?.created_at }
      setEditPreviousImages(prev => [kept, ...prev])
    }
    setEditImageAddedAt(new Date().toISOString())
    setDisplayedIdx(0)
    setEditPhoto(f)
    setEditPreview(URL.createObjectURL(f))
  }

  function removePreviousPhoto(idx) {
    setEditPreviousImages(prev => prev.filter((_, i) => i !== idx))
    setDisplayedIdx(curr => {
      const removedDisplayIdx = idx + 1
      if (curr === removedDisplayIdx) return 0
      if (curr > removedDisplayIdx) return curr - 1
      return curr
    })
  }

  function buildAcquired() {
    const y = editYear.trim()
    const yearNum = y ? parseInt(y, 10) : null
    const validYear = yearNum && yearNum >= 1800 && yearNum <= 2100 ? yearNum : null
    return {
      year: validYear,
      location: editAcquired?.location ?? null,
      lat: editAcquired?.lat ?? null,
      lng: editAcquired?.lng ?? null,
    }
  }

  async function handleSave() {
    setSaving(true)
    await onSave(editName.trim(), editPhoto, editTags, editPrivate, editDescription.trim(), buildAcquired(), editPreviousImages, editImageAddedAt)
    setSaving(false)
    setEditing(false)
    setEditPhoto(null)
    setEditPreview(null)
    setEditDescription('')
    setDisplayedIdx(0)
  }

  const itemTags = item.tags ?? []
  const allPhotos = editing
    ? [{ url: editPreview, added_at: editImageAddedAt }, ...editPreviousImages]
    : [
        { url: item.image_url, added_at: item.image_added_at ?? item.created_at },
        ...(item.previous_images ?? []),
      ]
  const safeDisplayedIdx = Math.min(displayedIdx, allPhotos.length - 1)
  const displayedEntry = allPhotos[safeDisplayedIdx] ?? {}
  const displayedPhoto = displayedEntry.url
  const displayedDate = displayedEntry.added_at
  const showThumbnails = allPhotos.filter(p => p?.url).length > 1

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
              {displayedPhoto && (
                <img src={displayedPhoto} alt={item.name || ''} className="detail-image" />
              )}
              {editing && (
                <>
                  <button
                    type="button"
                    className={`privacy-corner${editPrivate ? ' privacy-corner-on' : ''}`}
                    onClick={() => setEditPrivate(prev => !prev)}
                    title={editPrivate ? 'private — click to make public' : 'public — click to make private'}
                  >
                    <LockIcon size={14} color="#fff" open={!editPrivate} />
                  </button>
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
                </>
              )}
            </div>
            {(showThumbnails || displayedDate) && (
              <div className="photo-extras">
                {displayedDate && (
                  <p className="photo-date">
                    photo from {new Date(displayedDate).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                  </p>
                )}
                {showThumbnails && (
                  <div className="thumbnail-row">
                    {allPhotos.map((entry, idx) => {
                      if (!entry?.url) return null
                      const selected = idx === safeDisplayedIdx
                      const removable = editing && idx > 0
                      return (
                        <div key={`${idx}-${typeof entry.url === 'string' ? entry.url : 'preview'}`} className="thumbnail-wrap">
                          <button
                            type="button"
                            className={`thumbnail${selected ? ' thumbnail-selected' : ''}`}
                            onClick={() => setDisplayedIdx(idx)}
                          >
                            <img src={entry.url} alt="" />
                          </button>
                          {removable && (
                            <button
                              type="button"
                              className="thumbnail-remove"
                              onClick={() => removePreviousPhoto(idx - 1)}
                              aria-label="remove photo"
                            >×</button>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )}
          </div>

          <div className={`detail-info-col${editing ? ' detail-info-col-editing' : ''}`}>
            {editing ? (
              <>
                <TagInput value={editTags} onChange={setEditTags} allTags={allTags} />
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
                <input
                  className="name-input year-input-full"
                  type="number"
                  placeholder="year acquired (optional)"
                  min={1800}
                  max={2100}
                  value={editYear}
                  onChange={e => setEditYear(e.target.value.replace(/[^0-9]/g, '').slice(0, 4))}
                />
                <LocationPicker value={editAcquired} onChange={setEditAcquired} placeholder="city acquired (optional)" />
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
                      onTagPress ? (
                        <button key={tag.id} className="tag-badge" onClick={() => onTagPress(tag)}>
                          {tag.is_private && <LockIcon size={9} color="#bbb" />}{tag.name}
                        </button>
                      ) : (
                        <span key={tag.id} className="tag-badge">
                          {tag.is_private && <LockIcon size={9} color="#bbb" />}{tag.name}
                        </span>
                      )
                    ))}
                  </div>
                )}
                {item.description && <p className="detail-description">{item.description}</p>}
                {(item.acquired_location || item.acquired_year) && (
                  <p className="detail-acquired">
                    acquired
                    {item.acquired_location && (
                      <>
                        {' in '}
                        {onCityPress ? (
                          <button
                            className="detail-acquired-link"
                            onClick={() => onCityPress(item.acquired_location.split(',')[0])}
                          >{item.acquired_location.split(',')[0]}</button>
                        ) : item.acquired_location.split(',')[0]}
                      </>
                    )}
                    {item.acquired_year && (
                      <>
                        {' · '}
                        {onYearPress ? (
                          <button
                            className="detail-acquired-link"
                            onClick={() => onYearPress(item.acquired_year)}
                          >{item.acquired_year}</button>
                        ) : item.acquired_year}
                      </>
                    )}
                  </p>
                )}
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
