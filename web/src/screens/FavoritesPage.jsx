import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { fetchFavorites, fetchLikedItemIds, addLike, removeLike } from '../../../shared/likesApi'
import { fetchBlockedIds, fetchBlockedByIds } from '../../../shared/moderation'
import { thumbOf } from '../../../shared/items'
import { S } from '../../../shared/strings'
import ItemDetailModal from './ItemDetailModal'

export default function FavoritesPage() {
  const navigate = useNavigate()
  const [viewerId, setViewerId] = useState(null)
  const [favorites, setFavorites] = useState([])
  const [likedItemIds, setLikedItemIds] = useState(() => new Set())
  const [loading, setLoading] = useState(true)
  const [selectedId, setSelectedId] = useState(null)

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) { navigate('/'); return }
      setViewerId(session.user.id)
      try {
        const [blocked, blockedBy] = await Promise.all([
          fetchBlockedIds(supabase, session.user.id),
          fetchBlockedByIds(supabase),
        ])
        const [rows, likedIds] = await Promise.all([
          fetchFavorites(supabase, session.user.id, { blockedIds: blocked, blockedByIds: blockedBy }),
          fetchLikedItemIds(supabase, session.user.id),
        ])
        setFavorites(rows)
        setLikedItemIds(new Set(likedIds))
      } catch (e) {
        console.error('fetchFavorites error:', e)
      } finally {
        setLoading(false)
      }
    })
  }, [navigate])

  async function handleToggleLike(itemId, next) {
    if (!viewerId) return
    setLikedItemIds(prev => {
      const n = new Set(prev)
      if (next) n.add(itemId); else n.delete(itemId)
      return n
    })
    try {
      if (next) await addLike(supabase, { userId: viewerId, itemId })
      else await removeLike(supabase, { userId: viewerId, itemId })
    } catch (e) {
      console.error('toggle like error:', e)
      setLikedItemIds(prev => {
        const n = new Set(prev)
        if (next) n.delete(itemId); else n.add(itemId)
        return n
      })
    }
  }

  // Un-favorited items drop out of the grid live (the heart mutates likedItemIds).
  const visibleFavorites = useMemo(
    () => favorites.filter(i => likedItemIds.has(i.id)),
    [favorites, likedItemIds],
  )

  const selectedItem = selectedId ? (visibleFavorites.find(i => i.id === selectedId) ?? null) : null
  const idx = visibleFavorites.findIndex(i => i.id === selectedId)

  return (
    <div className="app">
      <header className="header">
        <div>
          <h1 className="profile-name">{S.favorites.title}</h1>
          <p className="subtitle">
            {visibleFavorites.length === 0 ? S.favorites.subtitle : S.favorites.count(visibleFavorites.length)}
          </p>
        </div>
        <div className="header-links" style={{ marginTop: 8 }}>
          <Link to="/" className="link-btn">{S.appName}</Link>
        </div>
      </header>

      {loading ? (
        <div className="centered" style={{ height: 'auto', padding: '60px 0' }}>
          <div className="spinner" />
        </div>
      ) : visibleFavorites.length === 0 ? (
        <div className="centered" style={{ height: 'auto', padding: '60px 0', flexDirection: 'column', gap: 8 }}>
          <p style={{ color: '#999' }}>{S.favorites.empty}</p>
          <p style={{ color: '#bbb', fontSize: 13 }}>{S.favorites.emptyHint}</p>
        </div>
      ) : (
        <div className="grid">
          {visibleFavorites.map(item => (
            <div key={item.id} className="card" onClick={() => setSelectedId(item.id)}>
              {item.image_url && <img src={thumbOf(item)} alt={item.name || ''} loading="lazy" />}
            </div>
          ))}
        </div>
      )}

      <ItemDetailModal
        visible={!!selectedItem}
        item={selectedItem}
        sessionUserId={viewerId}
        liked={selectedItem ? likedItemIds.has(selectedItem.id) : false}
        onToggleLike={handleToggleLike}
        onClose={() => setSelectedId(null)}
        onPrev={idx > 0 ? () => setSelectedId(visibleFavorites[idx - 1].id) : null}
        onNext={idx >= 0 && idx < visibleFavorites.length - 1 ? () => setSelectedId(visibleFavorites[idx + 1].id) : null}
      />
    </div>
  )
}
