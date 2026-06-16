import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { fetchAllItems } from '../../../shared/itemsApi'
import { isRetired, imagePathsForItem, thumbOf } from '../../../shared/items'
import { S } from '../../../shared/strings'
import ItemDetailModal from './ItemDetailModal'
import ProfileHeader from '../components/ProfileHeader'
import LockIcon from '../components/LockIcon'
import { profileCacheKey, countCacheKey } from '../../../shared/cacheKeys'
import { readCache, writeCache } from '../lib/cache'

const PROFILE_COLS = 'display_name, username, avatar_url, avatar_thumb_url, home_location, home_lat, home_lng'

export default function GraveyardPage() {
  const navigate = useNavigate()
  const [sessionUserId, setSessionUserId] = useState(null)
  const [profile, setProfile] = useState(null)
  const [collectionCount, setCollectionCount] = useState(null)
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedId, setSelectedId] = useState(null)

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) { navigate('/'); return }
      setSessionUserId(session.user.id)
      const cachedProfile = readCache(profileCacheKey(session.user.id))
      if (cachedProfile) setProfile(cachedProfile)
      const cachedCount = readCache(countCacheKey(session.user.id))
      if (cachedCount != null) setCollectionCount(cachedCount)
      try {
        const [profRes, fetched] = await Promise.all([
          supabase.from('profiles').select(PROFILE_COLS).eq('user_id', session.user.id).maybeSingle(),
          fetchAllItems(supabase, { userId: session.user.id }),
        ])
        if (profRes.data) {
          setProfile(profRes.data)
          writeCache(profileCacheKey(session.user.id), profRes.data)
        }
        setItems(fetched)
        const count = fetched.filter(i => !isRetired(i)).length
        setCollectionCount(count)
        writeCache(countCacheKey(session.user.id), count)
      } catch (e) {
        console.error('GraveyardPage load error:', e)
      } finally {
        setLoading(false)
      }
    })
  }, [navigate])

  const retiredItems = useMemo(
    () => items.filter(isRetired).sort((a, b) => new Date(b.retired_at) - new Date(a.retired_at)),
    [items],
  )
  const home = profile?.home_location
    ? { location: profile.home_location, lat: profile.home_lat, lng: profile.home_lng }
    : null

  const selectedItem = selectedId ? (retiredItems.find(i => i.id === selectedId) ?? null) : null
  const idx = retiredItems.findIndex(i => i.id === selectedId)

  async function deleteStorageForItems(itemsToDelete) {
    const paths = itemsToDelete.flatMap(imagePathsForItem)
    if (paths.length === 0) return
    const { error } = await supabase.functions.invoke('r2-delete', { body: { paths } })
    if (error) console.warn('R2 delete failed (orphans left for cleanup):', error)
  }

  async function handleResurrect() {
    const target = selectedItem
    setSelectedId(null)
    const patch = { retired_at: null, retire_reason: null, epitaph: null }
    const { error } = await supabase.from('items').update(patch).eq('id', target.id)
    if (!error) {
      setItems(prev => prev.map(i => i.id === target.id ? { ...i, ...patch } : i))
      // The item rejoins the active collection — keep the cached count in sync.
      setCollectionCount(c => {
        if (c == null) return c
        const next = c + 1
        if (sessionUserId) writeCache(countCacheKey(sessionUserId), next)
        return next
      })
    }
  }

  async function handleDelete() {
    const target = selectedItem
    setSelectedId(null)
    const { error } = await supabase.from('items').delete().eq('id', target.id)
    if (!error) {
      setItems(prev => prev.filter(i => i.id !== target.id))
      deleteStorageForItems([target])
    }
  }

  return (
    <div className="app">
      <ProfileHeader
        slug={profile?.username || sessionUserId}
        userId={sessionUserId}
        profileName={profile?.display_name}
        username={profile?.username}
        avatarUrl={profile?.avatar_url}
        avatarThumbUrl={profile?.avatar_thumb_url}
        home={home}
        itemCount={collectionCount}
        isOwner
      />

      <div className="graveyard-bar">
        <button className="link-btn graveyard-back" onClick={() => navigate(-1)}>‹</button>
        <h2 className="graveyard-title">{S.graveyard.emoji} {S.graveyard.title}</h2>
        <span className="graveyard-count">
          {retiredItems.length === 0 ? S.graveyard.subtitle : S.graveyard.count(retiredItems.length)}
        </span>
      </div>

      {loading ? (
        <div className="centered" style={{ height: 'auto', padding: '60px 0' }}>
          <div className="spinner" />
        </div>
      ) : retiredItems.length === 0 ? (
        <div className="graveyard-empty">
          <div className="graveyard-empty-emoji">{S.graveyard.emoji}</div>
          <p>{S.graveyard.empty}</p>
          <p className="graveyard-empty-hint">{S.graveyard.emptyHint}</p>
        </div>
      ) : (
        <div className="grid">
          {retiredItems.map(item => (
            <div key={item.id} className="card" onClick={() => setSelectedId(item.id)}>
              {item.image_url && <img src={thumbOf(item)} alt={item.name || ''} loading="lazy" />}
              {item.is_private && (
                <div className="card-private-badge"><LockIcon size={10} color="#fff" /></div>
              )}
            </div>
          ))}
        </div>
      )}

      <ItemDetailModal
        visible={!!selectedItem}
        item={selectedItem}
        sessionUserId={sessionUserId}
        onClose={() => setSelectedId(null)}
        onResurrect={handleResurrect}
        onDelete={handleDelete}
        onPrev={idx > 0 ? () => setSelectedId(retiredItems[idx - 1].id) : null}
        onNext={idx >= 0 && idx < retiredItems.length - 1 ? () => setSelectedId(retiredItems[idx + 1].id) : null}
      />
    </div>
  )
}
