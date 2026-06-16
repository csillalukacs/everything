import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { S } from '../../../shared/strings'
import { locationSuggestionsFromItems, isRetired } from '../../../shared/items'
import { dayKey, relativeDay, dayKeyLabel } from '../../../shared/dates'
import { recordUsage, removeUsage, fetchItemUsages } from '../../../shared/usagesApi'
import { submitReport, blockUser } from '../../../shared/moderation'
import { supabase } from '../lib/supabase'
import LocationPicker from './LocationPicker'
import TagInput from './TagInput'
import LockIcon from '../components/LockIcon'
import Avatar from '../components/Avatar'
import { AppleIcon } from '../components/Icons'
import { isFeaturedTag } from '../../../shared/featuredTag'

export default function ItemDetailModal({ visible, item, onClose, onDelete, onSave, onRetire, onResurrect, allTags = [], items = [], sessionUserId, onUsageChange, onBlocked, liked = false, onToggleLike, onPrev, onNext, onTagPress, onYearPress, onCityPress }) {
  const locationSuggestions = useMemo(() => locationSuggestionsFromItems(items), [items])
  const [usageCount, setUsageCount] = useState(0)
  const [lastUsedOn, setLastUsedOn] = useState(null)
  const [usedDays, setUsedDays] = useState(() => new Set())
  const [usageBusy, setUsageBusy] = useState(false)
  const [usagePulse, setUsagePulse] = useState(false)
  const [addingUse, setAddingUse] = useState(false)
  const [pendingUseDate, setPendingUseDate] = useState('')
  const [editing, setEditing] = useState(false)
  const [editName, setEditName] = useState('')
  const [editDescription, setEditDescription] = useState('')
  const [editPhoto, setEditPhoto] = useState(null)
  const [editPhotoThumb, setEditPhotoThumb] = useState(null)
  const [editPreview, setEditPreview] = useState(null)
  const [editImageAddedAt, setEditImageAddedAt] = useState(null)
  const [editPreviousImages, setEditPreviousImages] = useState([])
  const [displayedIdx, setDisplayedIdx] = useState(0)
  const [editTags, setEditTags] = useState([])
  const [editPrivate, setEditPrivate] = useState(false)
  const [editYear, setEditYear] = useState('')
  const [editAcquired, setEditAcquired] = useState(null)
  const [saving, setSaving] = useState(false)
  const [retiring, setRetiring] = useState(false)
  const [retireReason, setRetireReason] = useState(null)
  const [retireEpitaph, setRetireEpitaph] = useState('')
  const [reporting, setReporting] = useState(false)
  const [likePulse, setLikePulse] = useState(false)
  const fileInputRef = useRef(null)

  function handleToggleLike() {
    if (!onToggleLike || !item) return
    if (!liked) {
      setLikePulse(true)
      setTimeout(() => setLikePulse(false), 300)
    }
    onToggleLike(item.id, !liked)
  }

  useEffect(() => { setDisplayedIdx(0); setRetiring(false); setRetireReason(null); setRetireEpitaph(''); setReporting(false); setAddingUse(false); setPendingUseDate('') }, [item?.id])

  useEffect(() => {
    setUsageCount(item?.usage_count ?? 0)
    setLastUsedOn(item?.last_used_on ?? null)
    setUsedDays(new Set())
  }, [item?.id])

  // Load the logged days when viewing an item you own, so the usage log shows without entering edit.
  useEffect(() => {
    if (!visible || !item?.id || !(sessionUserId && item.user_id === sessionUserId)) return
    loadUsageDays()
  }, [visible, item?.id, sessionUserId])

  const isOwnerItem = !!sessionUserId && item?.user_id === sessionUserId
  const todayKey = dayKey(new Date())
  const usedToday = lastUsedOn === todayKey
  // Logged days other than today (the "use today" button covers today), most recent first.
  const pastDays = useMemo(
    () => [...usedDays].filter(k => k !== todayKey).sort().reverse(),
    [usedDays, todayKey],
  )

  function applyUsage(count, last) {
    setUsageCount(count)
    setLastUsedOn(last)
    if (item) onUsageChange?.(item.id, { usage_count: count, last_used_on: last })
  }

  async function reloadRollup() {
    const { data } = await supabase
      .from('items')
      .select('usage_count, last_used_on')
      .eq('id', item.id)
      .maybeSingle()
    if (data) applyUsage(data.usage_count ?? 0, data.last_used_on ?? null)
  }

  async function handleUseToday() {
    if (usageBusy || !item) return
    setUsageBusy(true)
    try {
      if (usedToday) {
        await removeUsage(supabase, { itemId: item.id, usedOn: todayKey })
        await reloadRollup()
      } else {
        setUsagePulse(true)
        setTimeout(() => setUsagePulse(false), 300)
        await recordUsage(supabase, { itemId: item.id, userId: item.user_id, usedOn: todayKey, onFeed: true })
        applyUsage(usageCount + 1, todayKey)
      }
    } catch (e) {
      console.error('handleUseToday error:', e)
    } finally {
      setUsageBusy(false)
    }
  }

  async function loadUsageDays() {
    try {
      const rows = await fetchItemUsages(supabase, item.id)
      setUsedDays(new Set(rows.map(r => r.used_on)))
    } catch (e) {
      console.error('fetchItemUsages error:', e)
    }
  }

  async function handleBackfillToggle(key, adding) {
    setUsedDays(prev => {
      const next = new Set(prev)
      if (adding) next.add(key); else next.delete(key)
      return next
    })
    try {
      if (adding) await recordUsage(supabase, { itemId: item.id, userId: item.user_id, usedOn: key, onFeed: false })
      else await removeUsage(supabase, { itemId: item.id, usedOn: key })
      await reloadRollup()
    } catch (e) {
      console.error('handleBackfillToggle error:', e)
    }
  }

  if (!visible || !item) return null

  function enterEdit() {
    setEditName(item.name ?? '')
    setEditDescription(item.description ?? '')
    setEditPhoto(item.image_url)
    setEditPhotoThumb(item.thumb_url ?? null)
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
    setEditPhotoThumb(null)
    setEditPreview(null)
    setEditDescription('')
    setDisplayedIdx(0)
  }

  function handleImageChange(f) {
    if (!f) return
    if (typeof editPhoto === 'string' && editPhoto.startsWith('http')) {
      const kept = { url: editPhoto, thumb_url: editPhotoThumb ?? null, added_at: editImageAddedAt ?? item?.created_at }
      setEditPreviousImages(prev => [kept, ...prev])
    }
    setEditImageAddedAt(new Date().toISOString())
    setDisplayedIdx(0)
    setEditPhoto(f)
    setEditPhotoThumb(null)
    setEditPreview(URL.createObjectURL(f))
  }

  function makeFeatured(displayIdx) {
    if (displayIdx <= 0) return
    const prevIdx = displayIdx - 1
    const chosen = editPreviousImages[prevIdx]
    if (!chosen?.url) return
    const demoted = { url: editPhoto, thumb_url: editPhotoThumb, added_at: editImageAddedAt }
    setEditPhoto(chosen.url)
    setEditPhotoThumb(chosen.thumb_url ?? null)
    setEditPreview(chosen.url)
    setEditImageAddedAt(chosen.added_at ?? null)
    setEditPreviousImages(prev => prev.map((e, i) => i === prevIdx ? demoted : e))
    setDisplayedIdx(0)
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
    setEditPhotoThumb(null)
    setEditPreview(null)
    setEditDescription('')
    setDisplayedIdx(0)
  }

  function cancelRetire() {
    setRetiring(false)
    setRetireReason(null)
    setRetireEpitaph('')
  }

  function confirmRetire() {
    onRetire?.(retireReason ?? null, retireEpitaph.trim() || null)
    cancelRetire()
  }

  const ownerName = item.profile?.display_name
    || (item.profile?.username ? `@${item.profile.username}` : 'this user')

  async function handleReport(reason) {
    setReporting(false)
    try {
      await submitReport(supabase, { reporterId: sessionUserId, targetType: 'item', targetId: item.id, targetUserId: item.user_id, reason })
    } catch (e) {
      console.error('submitReport error:', e)
    }
    alert(S.moderation.reportThanksBody)
  }

  async function handleBlock() {
    if (!window.confirm(`${S.moderation.blockConfirmTitle(ownerName)}\n${S.moderation.blockConfirmBody}`)) return
    try {
      await blockUser(supabase, { blockerId: sessionUserId, blockedId: item.user_id })
    } catch (e) {
      console.error('blockUser error:', e)
    }
    alert(S.moderation.blockedDone(ownerName))
    onBlocked?.(item.user_id)
    onClose()
  }

  const itemTags = item.tags ?? []
  const retired = isRetired(item)
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
            {editing ? S.common.cancel : '✕'}
          </button>
          {!editing && (
            <div className="nav-buttons">
              <button onClick={onPrev} disabled={!onPrev} className="nav-btn">‹</button>
              <button onClick={onNext} disabled={!onNext} className="nav-btn">›</button>
            </div>
          )}
          {onSave && !retired && (
            <button
              className="link-btn link-btn-dark"
              onClick={editing ? handleSave : enterEdit}
              disabled={saving}
            >{editing ? (saving ? S.common.saving : S.common.save) : S.common.edit}</button>
          )}
        </div>

        <div className="detail-layout">
          <div className="detail-image-col">
            <div className="detail-image-wrap">
              {displayedPhoto && (
                <img src={displayedPhoto} alt={item.name || ''} className="detail-image" />
              )}
              {!editing && !isOwnerItem && onToggleLike && (
                <button
                  type="button"
                  className={`heart-overlay${likePulse ? ' heart-pulse' : ''}`}
                  onClick={handleToggleLike}
                  aria-label={liked ? S.favorites.favorited : S.favorites.favorite}
                >
                  <span className="heart-glyph">{liked ? '♥' : '♡'}</span>
                </button>
              )}
              {showThumbnails && (
                <div className={`thumbnail-row thumbnail-row-overlay${editing ? ' thumbnail-row-overlay-editing' : ''}`}>
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
                          <img src={entry.thumb_url || entry.url} alt="" />
                        </button>
                        {removable && (
                          <button
                            type="button"
                            className="thumbnail-remove"
                            onClick={() => removePreviousPhoto(idx - 1)}
                            aria-label={S.a11y.removePhoto}
                          >×</button>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
              {editing && (
                <>
                  <button
                    type="button"
                    className={`privacy-corner${editPrivate ? ' privacy-corner-on' : ''}`}
                    onClick={() => setEditPrivate(prev => !prev)}
                    title={editPrivate ? S.a11y.privateClickPublic : S.a11y.publicClickPrivate}
                  >
                    <LockIcon size={14} color="#fff" open={!editPrivate} />
                  </button>
                  <div className="image-overlay" onClick={() => fileInputRef.current?.click()}>
                    {S.common.newPhoto}
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
            {(displayedDate || (editing && showThumbnails)) && (
              <div className="photo-extras">
                <div className="photo-meta-row">
                  {displayedDate ? (
                    <p className="photo-date">
                      {S.itemForm.photoFrom(new Date(displayedDate).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }))}
                    </p>
                  ) : <span className="photo-date-spacer" />}
                  {editing && showThumbnails && (
                    <button
                      type="button"
                      className={`cover-btn${safeDisplayedIdx > 0 ? '' : ' cover-btn-hidden'}`}
                      onClick={() => makeFeatured(safeDisplayedIdx)}
                      disabled={safeDisplayedIdx === 0}
                    >☆ {S.itemForm.useAsCover}</button>
                  )}
                </div>
              </div>
            )}
          </div>

          <div className="detail-info-col">
            <div className="detail-info-col-inner">
            {editing ? (
              <>
                <input
                  className="name-input"
                  placeholder={S.itemForm.namePlaceholder}
                  value={editName}
                  onChange={e => setEditName(e.target.value)}
                />
                <textarea
                  className="description-input"
                  placeholder={S.itemForm.descriptionPlaceholder}
                  value={editDescription}
                  onChange={e => setEditDescription(e.target.value)}
                />
                <TagInput value={editTags} onChange={setEditTags} allTags={allTags} />
                <LocationPicker value={editAcquired} onChange={setEditAcquired} placeholder={S.itemForm.cityPlaceholder} suggestions={locationSuggestions} />
                <input
                  className="name-input year-input-full"
                  type="number"
                  placeholder={S.itemForm.yearPlaceholder}
                  min={1800}
                  max={2100}
                  value={editYear}
                  onChange={e => setEditYear(e.target.value.replace(/[^0-9]/g, '').slice(0, 4))}
                />
              </>
            ) : (
              <>
                {item.profile && (() => {
                  const slug = item.profile.username || item.user_id
                  const ownerName = item.profile.display_name || (item.profile.username ? `@${item.profile.username}` : 'someone')
                  return (
                    <Link to={`/u/${slug}`} className="owner-link" onClick={onClose}>
                      <Avatar profile={{ ...item.profile, user_id: item.user_id }} size={32} />
                      <div className="owner-link-text">
                        <div className="owner-link-name">{ownerName}</div>
                        {item.profile.display_name && item.profile.username && (
                          <div className="owner-link-handle">@{item.profile.username}</div>
                        )}
                      </div>
                      <span className="owner-link-chevron">›</span>
                    </Link>
                  )
                })()}
                <div className="detail-name-row">
                  {item.name && <h2 className="detail-name">{item.name}</h2>}
                  {item.is_private && <LockIcon size={14} color="#999" />}
                </div>
                {itemTags.length > 0 && (
                  <div className="tag-row">
                    {itemTags.map(tag => {
                      const featured = isFeaturedTag(tag)
                      const icon = featured
                        ? <AppleIcon size={12} />
                        : tag.is_private ? <LockIcon size={9} color="#bbb" /> : null
                      return onTagPress ? (
                        <button key={tag.id} className="tag-badge" onClick={() => onTagPress(tag)}>
                          {icon}{tag.name}
                        </button>
                      ) : (
                        <span key={tag.id} className="tag-badge">
                          {icon}{tag.name}
                        </span>
                      )
                    })}
                  </div>
                )}
                {retired && (
                  <div className="tombstone">
                    <span className="tombstone-emoji">{S.graveyard.emoji}</span>
                    <div>
                      <div className="tombstone-retired">
                        {S.graveyard.retiredOn(new Date(item.retired_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }))}
                      </div>
                      {item.retire_reason && <div className="tombstone-reason">{S.graveyard.reasonLine(item.retire_reason)}</div>}
                      {item.epitaph && <div className="tombstone-epitaph">“{item.epitaph}”</div>}
                    </div>
                  </div>
                )}
                {item.description && <p className="detail-description">{item.description}</p>}
                {isOwnerItem && !retired && (
                  <div className="usage-section">
                    <div className="usage-row">
                      <button
                        type="button"
                        className={`use-today-btn${usedToday ? ' use-today-btn-on' : ''}${usagePulse ? ' use-today-pulse' : ''}`}
                        onClick={handleUseToday}
                        disabled={usageBusy}
                      >
                        {usedToday ? '✓ ' : '+ '}{usedToday ? S.usage.usedToday : S.usage.useToday}
                      </button>
                      <span className="usage-stat">
                        {usageCount === 0
                          ? S.usage.neverUsed
                          : `${S.usage.timesUsed(usageCount)} · ${S.usage.lastUsed(relativeDay(lastUsedOn))}`}
                      </span>
                    </div>
                    <div className="usage-history-header">
                      <span className="usage-history-title">{S.usage.historyTitle}</span>
                      <button
                        type="button"
                        className="add-entry-btn"
                        onClick={() => {
                          setAddingUse(a => !a)
                          setPendingUseDate(todayKey)
                        }}
                      >
                        + {S.usage.addEntry}
                      </button>
                    </div>
                    {addingUse && (
                      <div className="usage-add-row">
                        <input
                          type="date"
                          className="add-entry-input"
                          max={todayKey}
                          value={pendingUseDate}
                          onChange={e => setPendingUseDate(e.target.value)}
                        />
                        <button
                          type="button"
                          className="usage-add-confirm"
                          disabled={!pendingUseDate || usedDays.has(pendingUseDate)}
                          onClick={() => {
                            if (pendingUseDate && !usedDays.has(pendingUseDate)) handleBackfillToggle(pendingUseDate, true)
                            setAddingUse(false)
                            setPendingUseDate('')
                          }}
                        >
                          {S.usage.addDate}
                        </button>
                      </div>
                    )}
                    {pastDays.length > 0 ? (
                      <div className="usage-history-list">
                        {pastDays.map(key => (
                          <div key={key} className="usage-history-row">
                            <span className="usage-history-date">{dayKeyLabel(key)}</span>
                            <button
                              type="button"
                              className="usage-day-chip-x"
                              onClick={() => handleBackfillToggle(key, false)}
                              aria-label="remove"
                            >×</button>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="usage-history-empty">{S.usage.noHistory}</div>
                    )}
                  </div>
                )}
                {(item.acquired_location || item.acquired_year) && (
                  <p className="detail-acquired">
                    {S.itemForm.acquired}
                    {item.acquired_location && (
                      <>
                        {S.itemForm.acquiredIn}
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
                        {S.itemForm.acquiredSeparator}
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
                  {S.itemForm.addedOn(new Date(item.created_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }))}
                </p>
                {retiring ? (
                  <div className="retire-panel">
                    <div className="retire-panel-title">{S.graveyard.emoji} {S.graveyard.retireTitle}</div>
                    <div className="retire-reason-chips">
                      {S.graveyard.reasonOptions.map(opt => (
                        <button
                          key={opt}
                          type="button"
                          className={`chip${retireReason === opt ? ' chip-active' : ''}`}
                          onClick={() => setRetireReason(retireReason === opt ? null : opt)}
                        >{opt}</button>
                      ))}
                    </div>
                    <textarea
                      className="description-input"
                      placeholder={S.graveyard.epitaphPlaceholder}
                      value={retireEpitaph}
                      onChange={e => setRetireEpitaph(e.target.value)}
                    />
                    <div className="retire-panel-actions">
                      <button className="link-btn" onClick={cancelRetire}>{S.common.cancel}</button>
                      <button className="link-btn link-btn-dark" onClick={confirmRetire}>{S.graveyard.confirmRetire}</button>
                    </div>
                  </div>
                ) : (
                  (onRetire || onResurrect || onDelete) && (
                    <div className="detail-actions">
                      {onResurrect && retired && (
                        <button className="retire-btn" onClick={onResurrect}>{S.graveyard.emoji} {S.graveyard.resurrect}</button>
                      )}
                      {onRetire && !retired && (
                        <button className="retire-btn" onClick={() => setRetiring(true)}>{S.graveyard.emoji} {S.graveyard.retire}</button>
                      )}
                      {onDelete && <button className="delete-btn" onClick={onDelete}>{S.itemForm.deleteItem}</button>}
                    </div>
                  )
                )}
                {!isOwnerItem && (
                  reporting ? (
                    <div className="retire-panel">
                      <div className="retire-panel-title">{S.moderation.reportTitle}</div>
                      <div className="retire-reason-chips">
                        {S.moderation.reasons.map(r => (
                          <button key={r.value} type="button" className="chip" onClick={() => handleReport(r.value)}>{r.label}</button>
                        ))}
                      </div>
                      <div className="retire-panel-actions">
                        <button className="link-btn" onClick={() => setReporting(false)}>{S.common.cancel}</button>
                      </div>
                    </div>
                  ) : (
                    <div className="detail-actions">
                      <button className="retire-btn" onClick={() => setReporting(true)}>{S.moderation.report}</button>
                      <button className="delete-btn" onClick={handleBlock}>{S.moderation.blockUser(ownerName)}</button>
                    </div>
                  )
                )}
              </>
            )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
