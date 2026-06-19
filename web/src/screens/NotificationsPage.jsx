import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { fetchNotifications, markNotificationsRead, subscribeToNotifications } from '../../../shared/notifications'
import { groupConsecutive } from '../../../shared/grouping'
import { fetchBlockedIds } from '../../../shared/moderation'
import { thumbOf } from '../../../shared/items'
import { relativeTime, dayKey } from '../../../shared/dates'
import { S } from '../../../shared/strings'
import { notificationsCacheKey } from '../../../shared/cacheKeys'
import { readCache, writeCache } from '../lib/cache'
import Avatar from '../components/Avatar'
import PhotoStack from '../components/PhotoStack'

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
          {groupConsecutive(visible, n => n.actor_id, n => (n.type === 'like' ? 'like' : null), n => dayKey(new Date(n.created_at))).map(group => {
            const first = group.entries[0]
            const name = first.actor.display_name || first.actor.username || 'someone'
            const profileTo = `/u/${first.actor.username || first.actor.user_id}`

            if (group.entries.length > 1) {
              const count = group.entries.length
              const time = relativeTime(first.created_at)
              const unread = group.entries.some(n => !n.read_at)
              const thumbs = group.entries.map(n => n.item && thumbOf(n.item)).filter(Boolean)
              return (
                <div
                  key={group.key}
                  className={`notif-row${unread ? ' notif-row-unread' : ''}`}
                  onClick={e => { if (!e.target.closest('a')) navigate(profileTo) }}
                >
                  <Link to={profileTo}>
                    <Avatar profile={first.actor} size={40} />
                  </Link>
                  <p className="notif-text">
                    <Link to={profileTo} className="notif-name">{name}</Link>
                    <span className="notif-action"> {S.notifications.likedThings(count)}</span>
                    {time && <span className="notif-time"> · {time}</span>}
                  </p>
                  {thumbs.length > 0 && <PhotoStack thumbs={thumbs} size={44} />}
                </div>
              )
            }

            const n = first
            const time = relativeTime(n.created_at)
            const thumb = n.item ? thumbOf(n.item) : null
            // The actor's name always opens their profile; tapping anywhere else on a
            // 'like' opens your own thing, while a 'follow' just opens the profile.
            const rowTo = n.type === 'like' && n.item_id
              ? `/u/${sessionUserId}?item=${n.item_id}`
              : profileTo
            return (
              <div
                key={n.id}
                className={`notif-row${n.read_at ? '' : ' notif-row-unread'}`}
                // Let the inner profile links handle their own clicks; everything
                // else on the row opens the item (or the profile, for a follow).
                onClick={e => { if (!e.target.closest('a')) navigate(rowTo) }}
              >
                <Link to={profileTo}>
                  <Avatar profile={n.actor} size={40} />
                </Link>
                <p className="notif-text">
                  <Link to={profileTo} className="notif-name">{name}</Link>
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
  )
}
