import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { fetchNotifications, markNotificationsRead } from '../../../shared/notifications'
import { fetchBlockedIds } from '../../../shared/moderation'
import { thumbOf } from '../../../shared/items'
import { relativeTime } from '../../../shared/dates'
import { S } from '../../../shared/strings'
import { notificationsCacheKey } from '../../../shared/cacheKeys'
import { readCache, writeCache } from '../lib/cache'
import Avatar from './Avatar'

export default function NotificationsBell({ sessionUserId, unreadCount, onMarkedRead }) {
  const navigate = useNavigate()
  const wrapRef = useRef(null)
  const [open, setOpen] = useState(false)
  const [rows, setRows] = useState([])
  const [blockedIds, setBlockedIds] = useState(() => new Set())
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!open) return
    function onDown(e) {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false)
    }
    function onKey(e) { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  function toggle() {
    const next = !open
    setOpen(next)
    if (!next || !sessionUserId) return
    // Show the last-known list right away; only spin if we've never loaded.
    const cached = readCache(notificationsCacheKey(sessionUserId))
    if (cached) { setRows(cached); setLoading(false) }
    else setLoading(true)
    Promise.all([
      fetchNotifications(supabase, sessionUserId),
      fetchBlockedIds(supabase, sessionUserId),
    ])
      .then(([data, blocked]) => {
        setRows(data)
        setBlockedIds(new Set(blocked))
        writeCache(notificationsCacheKey(sessionUserId), data)
      })
      .catch(e => console.error('fetchNotifications error:', e))
      .finally(() => setLoading(false))
    // Opening the dropdown clears the badge.
    markNotificationsRead(supabase, sessionUserId)
      .then(() => onMarkedRead?.())
      .catch(e => console.error('markNotificationsRead error:', e))
  }

  const visible = rows.filter(n => !blockedIds.has(n.actor_id))

  return (
    <div className="notif-bell-wrap" ref={wrapRef}>
      <button
        type="button"
        className="notif-bell"
        aria-label={S.a11y.notifications}
        aria-expanded={open}
        onClick={toggle}
      >
        🔔
        {unreadCount > 0 && (
          <span className="notif-badge">{unreadCount > 99 ? '99+' : unreadCount}</span>
        )}
      </button>

      {open && (
        <div className="notif-popup">
          <div className="notif-popup-header">{S.notifications.title}</div>
          {loading ? (
            <div className="centered" style={{ height: 'auto', padding: '32px 0' }}>
              <div className="spinner" />
            </div>
          ) : visible.length === 0 ? (
            <div className="centered" style={{ height: 'auto', padding: '32px 0' }}>
              <p style={{ color: '#999' }}>{S.notifications.empty}</p>
            </div>
          ) : (
            <div className="notif-list">
              {visible.map(n => {
                const name = n.actor.display_name || n.actor.username || 'someone'
                const time = relativeTime(n.created_at)
                const thumb = n.item ? thumbOf(n.item) : null
                const profileTo = `/u/${n.actor.username || n.actor.user_id}`
                // The actor's name/avatar open their profile; tapping anywhere else on
                // a 'like' opens your own thing, while a 'follow' just opens the profile.
                const rowTo = n.type === 'like' && n.item_id
                  ? `/u/${sessionUserId}?item=${n.item_id}`
                  : profileTo
                const goProfile = () => { setOpen(false); navigate(profileTo) }
                return (
                  <div
                    key={n.id}
                    className={`notif-row${n.read_at ? '' : ' notif-row-unread'}`}
                    onClick={e => { if (!e.target.closest('button')) { setOpen(false); navigate(rowTo) } }}
                  >
                    <button type="button" className="notif-avatar-btn" onClick={goProfile}>
                      <Avatar profile={n.actor} size={40} />
                    </button>
                    <p className="notif-text">
                      <button type="button" className="notif-name" onClick={goProfile}>{name}</button>
                      <span className="notif-action"> {n.type === 'like' ? S.notifications.liked : S.notifications.followed}</span>
                      {time && <span className="notif-time"> · {time}</span>}
                    </p>
                    {thumb && <img src={thumb} alt="" className="notif-thumb" />}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
