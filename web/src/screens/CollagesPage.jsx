import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { fetchItemCount } from '../../../shared/itemsApi'
import { UUID_RE } from '../../../shared/identifiers'
import { S } from '../../../shared/strings'
import ProfileHeader from '../components/ProfileHeader'
import LockIcon from '../components/LockIcon'

export default function CollagesPage() {
  const { slug } = useParams()
  const navigate = useNavigate()

  const [userId, setUserId] = useState(null)
  const [profileName, setProfileName] = useState(null)
  const [username, setUsername] = useState(null)
  const [avatarUrl, setAvatarUrl] = useState(null)
  const [avatarThumbUrl, setAvatarThumbUrl] = useState(null)
  const [home, setHome] = useState(null)
  const [isOwner, setIsOwner] = useState(false)
  const [notFound, setNotFound] = useState(false)
  const [loading, setLoading] = useState(true)
  const [itemCount, setItemCount] = useState(null)
  const [collages, setCollages] = useState([])
  const [viewing, setViewing] = useState(null)

  useEffect(() => {
    let cancelled = false
    async function load() {
      const slugIsUuid = UUID_RE.test(slug)
      const cols = 'user_id, display_name, username, home_location, home_lat, home_lng, avatar_url, avatar_thumb_url'
      const { data: profile } = slugIsUuid
        ? await supabase.from('profiles').select(cols).eq('user_id', slug).maybeSingle()
        : await supabase.from('profiles').select(cols).ilike('username', slug).maybeSingle()
      if (cancelled) return

      if (!profile) {
        setNotFound(true)
        setLoading(false)
        return
      }
      if (slugIsUuid && profile.username) {
        navigate(`/u/${profile.username}/collages`, { replace: true })
        return
      }

      const resolvedId = profile.user_id
      setUserId(resolvedId)
      setProfileName(profile.display_name)
      setUsername(profile.username)
      setAvatarUrl(profile.avatar_url ?? null)
      setAvatarThumbUrl(profile.avatar_thumb_url ?? null)
      setHome(profile.home_location
        ? { location: profile.home_location, lat: profile.home_lat, lng: profile.home_lng }
        : null)

      const { data: { session } } = await supabase.auth.getSession()
      if (cancelled) return
      const ownerSession = !!session && session.user.id === resolvedId
      setIsOwner(ownerSession)

      const publicOnly = !ownerSession
      fetchItemCount(supabase, { userId: resolvedId, publicOnly })
        .then(c => { if (!cancelled) setItemCount(c) })
        .catch(e => console.error('fetchItemCount error:', e))

      const { data: collageRows, error } = await supabase
        .from('collages')
        .select('id, title, cover_url, cover_thumb_url, is_private, updated_at')
        .eq('user_id', resolvedId)
        .order('updated_at', { ascending: false })
      if (cancelled) return
      if (error) console.error('fetch collages error:', error)
      setCollages((collageRows ?? []).filter(c => c.cover_url || c.cover_thumb_url))
      setLoading(false)
    }
    load()
    return () => { cancelled = true }
  }, [slug, navigate])

  useEffect(() => {
    if (!viewing) return
    function onKey(e) { if (e.key === 'Escape') setViewing(null) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [viewing])

  if (notFound) {
    return (
      <div className="app">
        <div className="centered" style={{ padding: '60px 0' }}>
          <p style={{ color: '#999' }}>{S.profileView.notFound(slug)}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="app">
      <ProfileHeader
        slug={slug}
        userId={userId}
        profileName={profileName}
        username={username}
        avatarUrl={avatarUrl}
        avatarThumbUrl={avatarThumbUrl}
        home={home}
        itemCount={itemCount}
        collageCount={collages.length}
        isOwner={isOwner}
      />

      {loading ? (
        <div className="centered" style={{ height: 'auto', padding: '60px 0' }}>
          <div className="spinner" />
        </div>
      ) : collages.length === 0 ? (
        <div className="centered" style={{ height: 'auto', padding: '60px 0' }}>
          <p style={{ color: '#999' }}>{S.collages.empty}</p>
        </div>
      ) : (
        <div className="collages-grid">
          {collages.map(c => (
            <button
              key={c.id}
              type="button"
              className="collages-grid-tile"
              onClick={() => setViewing(c)}
              title={c.title || S.collages.untitled}
            >
              <img
                src={c.cover_thumb_url || c.cover_url}
                alt={c.title || ''}
                loading="lazy"
              />
              {c.is_private && (
                <div className="collage-tile-lock"><LockIcon size={10} color="#fff" /></div>
              )}
            </button>
          ))}
        </div>
      )}

      {viewing && (
        <div className="sheet-overlay" onClick={() => setViewing(null)} role="dialog">
          <div className="collage-viewer" onClick={e => e.stopPropagation()}>
            <img src={viewing.cover_url || viewing.cover_thumb_url} alt={viewing.title || ''} />
            {viewing.title && <p className="collage-viewer-title">{viewing.title}</p>}
          </div>
        </div>
      )}
    </div>
  )
}
