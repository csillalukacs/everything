import { useEffect, useState } from 'react'
import { S } from '../../../shared/strings'
import LocationPicker from './LocationPicker'

export default function EditProfileSheet({
  visible,
  onClose,
  initialName,
  initialUsername,
  initialHome,
  onSaveName,
  onSaveUsername,
  onSaveHome,
}) {
  const [name, setName] = useState(initialName ?? '')
  const [username, setUsername] = useState(initialUsername ?? '')
  const [home, setHome] = useState(initialHome ?? null)
  const [usernameStatus, setUsernameStatus] = useState(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!visible) return
    setName(initialName ?? '')
    setUsername(initialUsername ?? '')
    setHome(initialHome ?? null)
    setUsernameStatus(null)
    setSaving(false)
  }, [visible, initialName, initialUsername, initialHome])

  if (!visible) return null

  function close() {
    if (saving) return
    onClose()
  }

  async function handleSave() {
    setSaving(true)
    setUsernameStatus(null)
    const trimmedName = name.trim()
    const trimmedUsername = username.trim().toLowerCase()
    const initialHomeLoc = initialHome?.location ?? null
    const homeLoc = home?.location ?? null

    if (trimmedName !== (initialName ?? '').trim()) {
      await onSaveName(trimmedName)
    }
    if (trimmedUsername !== (initialUsername ?? '').toLowerCase()) {
      const status = await onSaveUsername(trimmedUsername)
      if (status) {
        setUsernameStatus(status)
        setSaving(false)
        return
      }
    }
    if (homeLoc !== initialHomeLoc
      || home?.lat !== initialHome?.lat
      || home?.lng !== initialHome?.lng) {
      await onSaveHome(home)
    }
    setSaving(false)
    onClose()
  }

  return (
    <div className="sheet-overlay" onClick={e => e.target === e.currentTarget && close()}>
      <div className="sheet sheet-edit-profile">
        <p className="sheet-title">{S.profile.edit}</p>

        <div>
          <p className="batch-section-label">{S.profile.displayName}</p>
          <input
            className="name-input"
            placeholder={S.profile.displayNamePlaceholder}
            value={name}
            onChange={e => setName(e.target.value)}
            autoFocus
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
          <button className="link-btn" onClick={close} disabled={saving}>{S.common.cancel}</button>
          <button className="btn-primary" onClick={handleSave} disabled={saving}>
            {saving ? S.common.saving : S.common.save}
          </button>
        </div>
      </div>
    </div>
  )
}
