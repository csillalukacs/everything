import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { fetchFollowList } from '../../../shared/follows'
import { S } from '../../../shared/strings'
import Avatar from '../components/Avatar'

export default function FollowListModal({ visible, userId, mode, onClose }) {
  const [loading, setLoading] = useState(true)
  const [profiles, setProfiles] = useState([])

  useEffect(() => {
    if (!visible || !userId || !mode) return
    let cancelled = false
    setLoading(true)
    fetchFollowList(supabase, userId, mode)
      .then(rows => { if (!cancelled) setProfiles(rows) })
      .catch(e => console.error('fetchFollowList error:', e))
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [visible, userId, mode])

  if (!visible) return null
  const title = mode === 'followers' ? S.social.followersTitle : S.social.followingTitle
  const empty = mode === 'followers' ? S.social.noFollowers : S.social.noFollowing

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal follow-list-modal">
        <div className="modal-header">
          <button className="link-btn" onClick={onClose}>✕</button>
          <h2 className="follow-list-title">{title}</h2>
          <span className="follow-list-header-spacer" />
        </div>
        {loading ? (
          <div className="centered" style={{ height: 'auto', padding: '40px 0' }}><div className="spinner" /></div>
        ) : profiles.length === 0 ? (
          <p className="follow-list-empty">{empty}</p>
        ) : (
          <div className="follow-list">
            {profiles.map(p => {
              const name = p.display_name || (p.username ? `@${p.username}` : 'someone')
              const slug = p.username || p.user_id
              return (
                <Link key={p.user_id} to={`/u/${slug}`} className="follow-list-row" onClick={onClose}>
                  <Avatar profile={p} size={40} />
                  <div className="follow-list-row-text">
                    <div className="follow-list-name">{name}</div>
                    {p.display_name && p.username && <div className="follow-list-handle">@{p.username}</div>}
                  </div>
                </Link>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
