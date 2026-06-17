import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { fetchNotifications, markNotificationsRead, subscribeToNotifications } from '../../../shared/notifications'
import { fetchBlockedIds } from '../../../shared/moderation'
import { relativeTime } from '../../../shared/dates'
import { S } from '../../../shared/strings'
import { notificationsCacheKey } from '../../../shared/cacheKeys'
import { readCache, writeCache } from '../lib/cache'
import Avatar from '../components/Avatar'

export default function NotificationsPage() {
  const navigate = useNavigate()
  const [rows, setRows] = useState([])
  const [blockedIds, setBlockedIds] = useState(() => new Set())
  const [sessionUserId, setSessionUserId] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) { navigate('/'); return }
      setSessionUserId(session.user.id)
      // Show the last-known list right away; only spin if we've never loaded.
      const cached = readCache(notificationsCacheKey(session.user.id))
      if (cached) { setRows(cached); setLoading(false) }
      Promise.all([
        fetchNotifications(supabase, session.user.id),
        fetchBlockedIds(supabase, session.user.id),
      ])
        .then(([data, blocked]) => {
          setRows(data)
          setBlockedIds(new Set(blocked))
          writeCache(notificationsCacheKey(session.user.id), data)
        })
        .catch(e => console.error('fetchNotifications error:', e))
        .finally(() => setLoading(false))
      // Opening the screen clears the badge.
      markNotificationsRead(supabase, session.user.id)
        .catch(e => console.error('markNotificationsRead error:', e))
    })
  }, [navigate])

  // Realtime: a notification arriving while this screen is open should appear in
  // the list, not just bump the badge. Re-fetch on each event and re-mark read so
  // the badge stays clear while you're looking at it.
  useEffect(() => {
    if (!sessionUserId) return
    return subscribeToNotifications(supabase, sessionUserId, () => {
      fetchNotifications(supabase, sessionUserId)
        .then(data => {
          setRows(data)
          writeCache(notificationsCacheKey(sessionUserId), data)
        })
        .catch(e => console.error('fetchNotifications error:', e))
      markNotificationsRead(supabase, sessionUserId)
        .catch(e => console.error('markNotificationsRead error:', e))
    })
  }, [sessionUserId])

  const visible = rows.filter(n => !blockedIds.has(n.actor_id))

  return (
    <div className="app">
      <header className="header">
        <div>
          <h1 className="profile-name">{S.notifications.title}</h1>
        </div>
        <div className="header-links" style={{ marginTop: 8 }}>
          <Link to="/" className="link-btn">{S.appName}</Link>
        </div>
      </header>

      {loading ? (
        <div className="centered" style={{ height: 'auto', padding: '60px 0' }}>
          <div className="spinner" />
        </div>
      ) : visible.length === 0 ? (
        <div className="centered" style={{ height: 'auto', padding: '60px 0' }}>
          <p style={{ color: '#999' }}>{S.notifications.empty}</p>
        </div>
      ) : (
        <div className="notif-list">
          {visible.map(n => {
            const name = n.actor.display_name || n.actor.username || 'someone'
            const time = relativeTime(n.created_at)
            // A 'like' opens your own thing; a 'follow' opens the actor's profile.
            const to = n.type === 'like' && n.item_id
              ? `/u/${sessionUserId}?item=${n.item_id}`
              : `/u/${n.actor.username || n.actor.user_id}`
            return (
              <Link
                key={n.id}
                to={to}
                className={`notif-row${n.read_at ? '' : ' notif-row-unread'}`}
              >
                <Avatar profile={n.actor} size={40} />
                <p className="notif-text">
                  <span className="notif-name">{name}</span>
                  <span className="notif-action"> {n.type === 'like' ? S.notifications.liked : S.notifications.followed}</span>
                  {time && <span className="notif-time"> · {time}</span>}
                </p>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
