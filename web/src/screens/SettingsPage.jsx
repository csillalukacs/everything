import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { USERNAME_RE } from '../../../shared/identifiers'
import { S } from '../../../shared/strings'
import LocationPicker from './LocationPicker'
import Avatar from '../components/Avatar'

export default function SettingsPage() {
  const navigate = useNavigate()
  const fileInputRef = useRef(null)
  const [userId, setUserId] = useState(null)
  const [name, setName] = useState('')
  const [initialName, setInitialName] = useState('')
  const [username, setUsername] = useState('')
  const [initialUsername, setInitialUsername] = useState('')
  const [home, setHome] = useState(null)
  const [initialHome, setInitialHome] = useState(null)
  const [avatarUrl, setAvatarUrl] = useState(null)
  const [avatarThumbUrl, setAvatarThumbUrl] = useState(null)
  const [uploadingAvatar, setUploadingAvatar] = useState(false)
  const [usernameStatus, setUsernameStatus] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) { navigate('/'); return }
      setUserId(session.user.id)
      supabase
        .from('profiles')
        .select('display_name, username, home_location, home_lat, home_lng, avatar_url, avatar_thumb_url')
        .eq('user_id', session.user.id)
        .maybeSingle()
        .then(({ data }) => {
          setName(data?.display_name ?? '')
          setInitialName(data?.display_name ?? '')
          setUsername(data?.username ?? '')
          setInitialUsername(data?.username ?? '')
          const h = data?.home_location
            ? { location: data.home_location, lat: data.home_lat, lng: data.home_lng }
            : null
          setHome(h)
          setInitialHome(h)
          setAvatarUrl(data?.avatar_url ?? null)
          setAvatarThumbUrl(data?.avatar_thumb_url ?? null)
          setLoading(false)
        })
    })
  }, [navigate])

  async function makeThumbnail(file, maxW = 400) {
    try {
      const bitmap = await createImageBitmap(file)
      const scale = Math.min(1, maxW / bitmap.width)
      const w = Math.round(bitmap.width * scale)
      const h = Math.round(bitmap.height * scale)
      const canvas = document.createElement('canvas')
      canvas.width = w
      canvas.height = h
      canvas.getContext('2d').drawImage(bitmap, 0, 0, w, h)
      return await new Promise(resolve => canvas.toBlob(resolve, 'image/webp', 0.85))
    } catch (e) {
      console.warn('Thumbnail generation failed:', e)
      return null
    }
  }

  async function handleAvatarFile(file) {
    if (!file || !userId) return
    setUploadingAvatar(true)
    try {
      const ext = (file.name.split('.').pop() || 'jpg').toLowerCase()
      const thumbBlob = await makeThumbnail(file)
      const { data: presign, error: presignErr } = await supabase.functions.invoke('r2-presign', {
        body: { ext, contentType: file.type },
      })
      if (presignErr || !presign) { console.error('Presign error:', presignErr); return }
      const { main, thumb, cacheControl } = presign

      const mainRes = await fetch(main.uploadUrl, {
        method: 'PUT',
        body: file,
        headers: { 'Content-Type': file.type, 'Cache-Control': cacheControl },
      })
      if (!mainRes.ok) { console.error('Main upload failed:', mainRes.status); return }

      let newThumbUrl = null
      if (thumbBlob) {
        const thumbRes = await fetch(thumb.uploadUrl, {
          method: 'PUT',
          body: thumbBlob,
          headers: { 'Content-Type': 'image/webp', 'Cache-Control': cacheControl },
        })
        if (thumbRes.ok) newThumbUrl = thumb.publicUrl
        else console.warn('Thumb upload failed:', thumbRes.status)
      }
      const { error } = await supabase
        .from('profiles')
        .update({ avatar_url: main.publicUrl, avatar_thumb_url: newThumbUrl })
        .eq('user_id', userId)
      if (error) { console.error('Avatar save error:', error); return }
      setAvatarUrl(main.publicUrl)
      setAvatarThumbUrl(newThumbUrl)
    } finally {
      setUploadingAvatar(false)
    }
  }

  async function persistUsername(trimmed) {
    if (trimmed === (initialUsername ?? '').toLowerCase()) return null
    if (trimmed === '') {
      const { error } = await supabase.from('profiles').update({ username: null }).eq('user_id', userId)
      return error ? 'taken' : null
    }
    if (!USERNAME_RE.test(trimmed)) return 'invalid'
    const { data: existing } = await supabase
      .from('profiles')
      .select('user_id')
      .ilike('username', trimmed)
      .maybeSingle()
    if (existing && existing.user_id !== userId) return 'taken'
    const { error } = await supabase.from('profiles').update({ username: trimmed }).eq('user_id', userId)
    if (error) return /reserved/i.test(error.message) ? 'reserved' : 'taken'
    return null
  }

  async function handleSave() {
    setSaving(true)
    setUsernameStatus(null)
    const trimmedName = name.trim()
    const trimmedUsername = username.trim().toLowerCase()
    const initialHomeLoc = initialHome?.location ?? null
    const homeLoc = home?.location ?? null

    if (trimmedName && trimmedName !== (initialName ?? '').trim()) {
      await supabase.from('profiles').upsert({ user_id: userId, display_name: trimmedName })
      setInitialName(trimmedName)
    }
    if (trimmedUsername !== (initialUsername ?? '').toLowerCase()) {
      const status = await persistUsername(trimmedUsername)
      if (status) {
        setUsernameStatus(status)
        setSaving(false)
        return
      }
      setInitialUsername(trimmedUsername)
    }
    if (homeLoc !== initialHomeLoc
      || home?.lat !== initialHome?.lat
      || home?.lng !== initialHome?.lng) {
      await supabase
        .from('profiles')
        .update({
          home_location: home?.location ?? null,
          home_lat: home?.lat ?? null,
          home_lng: home?.lng ?? null,
        })
        .eq('user_id', userId)
      setInitialHome(home)
    }
    setSaving(false)
    navigate(`/u/${trimmedUsername || userId}`)
  }

  if (loading) {
    return <div className="centered"><div className="spinner" /></div>
  }

  const targetSlug = initialUsername || userId || ''

  return (
    <div className="app">
      <header className="header">
        <div>
          <h1 className="profile-name">{S.profile.settings}</h1>
        </div>
        <div className="header-links" style={{ marginTop: 8 }}>
          <Link to={`/u/${targetSlug}`} className="link-btn">{S.feed.myCollection}</Link>
          <Link to="/" className="link-btn">{S.appName}</Link>
        </div>
      </header>

      <div className="sheet sheet-edit-profile" style={{ margin: '24px auto 0' }}>
        <div style={{ display: 'flex', justifyContent: 'center' }}>
          <label className="avatar-edit" title="change profile picture">
            <Avatar
              profile={{
                user_id: userId,
                display_name: name,
                username,
                avatar_url: avatarUrl,
                avatar_thumb_url: avatarThumbUrl,
              }}
              size={96}
            />
            <span className="avatar-edit-badge">{uploadingAvatar ? '…' : '✎'}</span>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              style={{ display: 'none' }}
              disabled={uploadingAvatar}
              onChange={e => handleAvatarFile(e.target.files?.[0])}
            />
          </label>
        </div>

        <div>
          <p className="batch-section-label">{S.profile.displayName}</p>
          <input
            className="name-input"
            placeholder={S.profile.displayNamePlaceholder}
            value={name}
            onChange={e => setName(e.target.value)}
          />
        </div>

        <div>
          <p className="batch-section-label">{S.profile.username}</p>
          <input
            className="name-input"
            placeholder={S.profile.usernamePlaceholder}
            value={username}
            onChange={e => {
              setUsername(e.target.value.toLowerCase())
              setUsernameStatus(null)
            }}
            maxLength={20}
            autoCapitalize="none"
            autoCorrect="off"
          />
          {usernameStatus === 'invalid' && (
            <p className="profile-username-msg profile-username-error">{S.profile.usernameInvalidWeb}</p>
          )}
          {usernameStatus === 'taken' && (
            <p className="profile-username-msg profile-username-error">{S.profile.usernameTakenShort}</p>
          )}
          {usernameStatus === 'reserved' && (
            <p className="profile-username-msg profile-username-error">{S.profile.usernameReservedShort}</p>
          )}
        </div>

        <div>
          <p className="batch-section-label">{S.profile.homeCity}</p>
          <LocationPicker value={home} onChange={setHome} placeholder={S.profile.setHomeCity} />
        </div>

        <div className="sheet-edit-profile-actions">
          <button className="btn-primary" onClick={handleSave} disabled={saving}>
            {saving ? S.common.saving : S.common.save}
          </button>
          <button className="link-btn" onClick={async () => { await supabase.auth.signOut(); navigate('/') }}>
            {S.common.logOut}
          </button>
        </div>
      </div>
    </div>
  )
}
