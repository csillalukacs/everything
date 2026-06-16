import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { fetchNotifications, markNotificationsRead } from '../../../shared/notifications'
import { fetchBlockedIds } from '../../../shared/moderation'
import { relativeTime } from '../../../shared/dates'
import { S } from '../../../shared/strings'
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
      Promise.all([
        fetchNotifications(supabase, session.user.id),
        fetchBlockedIds(supabase, session.user.id),
      ])
        .then(([data, blocked]) => {
          setRows(data)
          setBlockedIds(new Set(blocked))
        })
        .catch(e => console.error('fetchNotifications error:', e))
        .finally(() => setLoading(false))
      // Opening the screen clears the badge.
      markNotificationsRead(supabase, session.user.id)
        .catch(e => console.error('markNotificationsRead error:', e))
    })
  }, [navigate])

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
