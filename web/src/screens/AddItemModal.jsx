import { useMemo, useRef, useState } from 'react'
import { S } from '../../../shared/strings'
import { locationSuggestionsFromItems } from '../../../shared/items'
import LocationPicker from './LocationPicker'
import TagInput from './TagInput'
import LockIcon from '../components/LockIcon'

export default function AddItemModal({ visible, onClose, onSave, allTags = [], items = [] }) {
  const locationSuggestions = useMemo(() => locationSuggestionsFromItems(items), [items])
  const [file, setFile] = useState(null)
  const [preview, setPreview] = useState(null)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [tags, setTags] = useState([])
  const [isPrivate, setIsPrivate] = useState(false)
  const [saving, setSaving] = useState(false)
  const [year, setYear] = useState('')
  const [acquired, setAcquired] = useState(null)
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

  function buildAcquired() {
    const y = year.trim()
    const yearNum = y ? parseInt(y, 10) : null
    const validYear = yearNum && yearNum >= 1800 && yearNum <= 2100 ? yearNum : null
    if (!validYear && !acquired) return null
    return { year: validYear, location: acquired?.location ?? null, lat: acquired?.lat ?? null, lng: acquired?.lng ?? null }
  }

  function resetState() {
    setFile(null)
    setPreview(null)
    setName('')
    setDescription('')
    setTags([])
    setIsPrivate(false)
    setYear('')
    setAcquired(null)
  }

  async function handleSave() {
    if (!file) return
    setSaving(true)
    await onSave(name.trim(), file, tags, isPrivate, description.trim(), buildAcquired())
    resetState()
    setSaving(false)
  }

  function handleClose() {
    resetState()
    onClose()
  }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && handleClose()}>
      <div className="modal">
        <div className="modal-header">
          <button className="link-btn" onClick={handleClose}>{S.common.cancel}</button>
          <span className="modal-title">{S.addItem.title}</span>
          <button
            className="link-btn link-btn-dark"
            onClick={handleSave}
            disabled={!file || saving}
          >{saving ? S.common.saving : S.common.save}</button>
        </div>

        {preview ? (
          <div className="image-preview-wrap">
            <img src={preview} alt="" className="image-preview" />
            <button
              type="button"
              className={`privacy-corner${isPrivate ? ' privacy-corner-on' : ''}`}
              onClick={() => setIsPrivate(prev => !prev)}
              title={isPrivate ? S.a11y.privateClickPublic : S.a11y.publicClickPrivate}
            >
              <LockIcon size={14} color="#fff" open={!isPrivate} />
            </button>
            <div className="image-overlay" onClick={() => { setFile(null); setPreview(null) }}>{S.common.retake}</div>
          </div>
        ) : (
          <div
            className="drop-zone"
            onClick={() => fileInputRef.current?.click()}
            onDragOver={e => e.preventDefault()}
            onDrop={handleDrop}
          >
            <span className="drop-zone-icon">+</span>
            <span className="drop-zone-text">{S.addItem.clickOrDragToAddPhoto}</span>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              style={{ display: 'none' }}
              onChange={e => handleFileChange(e.target.files[0])}
            />
          </div>
        )}

        <div className="modal-fields">
          <TagInput value={tags} onChange={setTags} allTags={allTags} />
          <input
            className="name-input"
            placeholder={S.itemForm.namePlaceholder}
            value={name}
            onChange={e => setName(e.target.value)}
          />
          <textarea
            className="description-input"
            placeholder={S.itemForm.descriptionPlaceholder}
            value={description}
            onChange={e => setDescription(e.target.value)}
          />
          <input
            className="name-input year-input-full"
            type="number"
            placeholder={S.itemForm.yearPlaceholder}
            min={1800}
            max={2100}
            value={year}
            onChange={e => setYear(e.target.value.replace(/[^0-9]/g, '').slice(0, 4))}
          />
          <LocationPicker value={acquired} onChange={setAcquired} placeholder={S.itemForm.cityPlaceholder} suggestions={locationSuggestions} />
        </div>
      </div>
    </div>
  )
}
