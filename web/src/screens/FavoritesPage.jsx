import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { fetchFavorites, fetchLikedItemIds, addLike, removeLike } from '../../../shared/likesApi'
import { fetchItemCount } from '../../../shared/itemsApi'
import { fetchBlockedIds, fetchBlockedByIds } from '../../../shared/moderation'
import { thumbOf } from '../../../shared/items'
import { S } from '../../../shared/strings'
import ItemDetailModal from './ItemDetailModal'
import ProfileHeader from '../components/ProfileHeader'
import { profileCacheKey, countCacheKey, favoritesCacheKey, likesCacheKey } from '../../../shared/cacheKeys'
import { readCache, writeCache } from '../lib/cache'

const PROFILE_COLS = 'display_name, username, avatar_url, avatar_thumb_url, home_location, home_lat, home_lng'

export default function FavoritesPage() {
  const navigate = useNavigate()
  const [viewerId, setViewerId] = useState(null)
  const [profile, setProfile] = useState(null)
  const [collectionCount, setCollectionCount] = useState(null)
  const [favorites, setFavorites] = useState([])
  const [likedItemIds, setLikedItemIds] = useState(() => new Set())
  const [loading, setLoading] = useState(true)
  const [selectedId, setSelectedId] = useState(null)

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) { navigate('/'); return }
      setViewerId(session.user.id)
      const cachedProfile = readCache(profileCacheKey(session.user.id))
      if (cachedProfile) setProfile(cachedProfile)
      const cachedCount = readCache(countCacheKey(session.user.id))
      if (cachedCount != null) setCollectionCount(cachedCount)
      // Show the last-known favorites right away; only spin if we've never loaded.
      const cachedFavorites = readCache(favoritesCacheKey(session.user.id))
      const cachedLikes = readCache(likesCacheKey(session.user.id))
      if (cachedFavorites) { setFavorites(cachedFavorites); setLoading(false) }
      if (cachedLikes) setLikedItemIds(new Set(cachedLikes))
      try {
        const [blocked, blockedBy, profRes, count] = await Promise.all([
          fetchBlockedIds(supabase, session.user.id),
          fetchBlockedByIds(supabase),
          supabase.from('profiles').select(PROFILE_COLS).eq('user_id', session.user.id).maybeSingle(),
          fetchItemCount(supabase, { userId: session.user.id }),
        ])
        if (profRes.data) {
          setProfile(profRes.data)
          writeCache(profileCacheKey(session.user.id), profRes.data)
        }
        setCollectionCount(count)
        writeCache(countCacheKey(session.user.id), count)
        const [rows, likedIds] = await Promise.all([
          fetchFavorites(supabase, session.user.id, { blockedIds: blocked, blockedByIds: blockedBy }),
          fetchLikedItemIds(supabase, session.user.id),
        ])
        setFavorites(rows)
        setLikedItemIds(new Set(likedIds))
        writeCache(favoritesCacheKey(session.user.id), rows)
        writeCache(likesCacheKey(session.user.id), likedIds)
      } catch (e) {
        console.error('FavoritesPage load error:', e)
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
      writeCache(likesCacheKey(viewerId), [...n])
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
        writeCache(likesCacheKey(viewerId), [...n])
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
  const home = profile?.home_location
    ? { location: profile.home_location, lat: profile.home_lat, lng: profile.home_lng }
    : null

  return (
    <div className="app">
      <ProfileHeader
        slug={profile?.username || viewerId}
        userId={viewerId}
        profileName={profile?.display_name}
        username={profile?.username}
        avatarUrl={profile?.avatar_url}
        avatarThumbUrl={profile?.avatar_thumb_url}
        home={home}
        itemCount={collectionCount}
        isOwner
        isLoggedIn
        onLogOut={async () => { await supabase.auth.signOut(); navigate('/') }}
        sessionUserId={viewerId}
      />

      <div className="graveyard-bar">
        <button className="link-btn graveyard-back" onClick={() => navigate(-1)}>‹</button>
        <h2 className="graveyard-title">♥ {S.favorites.title}</h2>
        <span className="graveyard-count">
          {visibleFavorites.length === 0 ? S.favorites.subtitle : S.favorites.count(visibleFavorites.length)}
        </span>
      </div>

      {loading ? (
        <div className="centered" style={{ height: 'auto', padding: '60px 0' }}>
          <div className="spinner" />
        </div>
      ) : visibleFavorites.length === 0 ? (
        <div className="graveyard-empty">
          <div className="graveyard-empty-emoji">♡</div>
          <p>{S.favorites.empty}</p>
          <p className="graveyard-empty-hint">{S.favorites.emptyHint}</p>
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
