import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from './lib/supabase'
import { fetchFeedEvents } from '../../shared/itemsApi'
import { fetchBlockedIds, fetchBlockedByIds } from '../../shared/moderation'
import { fetchFollowingIds } from '../../shared/follows'
import { fetchLikedItemIds, addLike, removeLike } from '../../shared/likesApi'
import { thumbOf } from '../../shared/items'
import { relativeTime } from '../../shared/dates'
import { S } from '../../shared/strings'
import { APP_TESTFLIGHT_URL } from '../../shared/links'
import { feedCacheKey } from '../../shared/cacheKeys'
import { readCache, writeCache } from './lib/cache'
import AuthScreen from './screens/AuthScreen'
import ItemDetailModal from './screens/ItemDetailModal'
import Avatar from './components/Avatar'
import NotificationsBell from './components/NotificationsBell'

export default function App() {
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)
  const [username, setUsername] = useState(null)
  const [feedEvents, setFeedEvents] = useState([])
  const [feedLoading, setFeedLoading] = useState(true)
  const [selectedItem, setSelectedItem] = useState(null)
  const [blockedIds, setBlockedIds] = useState(() => new Set())
  const [blockedByIds, setBlockedByIds] = useState(() => new Set())
  const [followingIds, setFollowingIds] = useState(() => new Set())
  const [likedItemIds, setLikedItemIds] = useState(() => new Set())
  const [activeTab, setActiveTab] = useState('everyone')

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setLoading(false)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
    })
    return () => subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (!session) {
      setUsername(null); setFeedEvents([]); setBlockedIds(new Set()); setBlockedByIds(new Set()); setFollowingIds(new Set()); setLikedItemIds(new Set())
      return
    }
    supabase
      .from('profiles')
      .select('username')
      .eq('user_id', session.user.id)
      .maybeSingle()
      .then(({ data }) => setUsername(data?.username ?? null))

    fetchBlockedIds(supabase, session.user.id)
      .then(ids => setBlockedIds(new Set(ids)))
      .catch(e => console.error('fetchBlockedIds error:', e))
    fetchBlockedByIds(supabase)
      .then(ids => setBlockedByIds(new Set(ids)))
      .catch(e => console.error('fetchBlockedByIds error:', e))
    fetchFollowingIds(supabase, session.user.id)
      .then(ids => setFollowingIds(new Set(ids)))
      .catch(e => console.error('fetchFollowingIds error:', e))
    fetchLikedItemIds(supabase, session.user.id)
      .then(ids => setLikedItemIds(new Set(ids)))
      .catch(e => console.error('fetchLikedItemIds error:', e))
  }, [session])

  useEffect(() => {
    if (!session) return
    let cancelled = false
    const everyone = activeTab === 'everyone'
    if (everyone) {
      const cached = readCache(feedCacheKey(session.user.id))
      if (cached) { setFeedEvents(cached); setFeedLoading(false) }
      else setFeedLoading(true)
    } else {
      setFeedLoading(true)
    }
    const opts = everyone ? { limit: 50 } : { limit: 50, authorIds: [...followingIds] }
    fetchFeedEvents(supabase, opts)
      .then(rows => {
        if (cancelled) return
        setFeedEvents(rows)
        if (everyone) writeCache(feedCacheKey(session.user.id), rows)
      })
      .catch(e => console.error('fetchFeedEvents error:', e))
      .finally(() => { if (!cancelled) setFeedLoading(false) })
    return () => { cancelled = true }
  }, [session, activeTab, followingIds])

  if (loading) return (
    <div className="centered"><div className="spinner" /></div>
  )

  if (!session) return <AuthScreen />

  // Hide both people I've blocked and people who've blocked me (so my updates
  // stay off their feed too).
  const visibleEvents = feedEvents.filter(
    e => !blockedIds.has(e.item.user_id) && !blockedByIds.has(e.item.user_id),
  )

  async function handleToggleLike(itemId, next) {
    setLikedItemIds(prev => {
      const n = new Set(prev)
      if (next) n.add(itemId); else n.delete(itemId)
      return n
    })
    try {
      if (next) await addLike(supabase, { userId: session.user.id, itemId })
      else await removeLike(supabase, { userId: session.user.id, itemId })
    } catch (e) {
      console.error('toggle like error:', e)
      setLikedItemIds(prev => {
        const n = new Set(prev)
        if (next) n.delete(itemId); else n.add(itemId)
        return n
      })
    }
  }

  return (
    <div className="app">
      <header className="header">
        <div>
          <h1 className="title">{S.appName}</h1>
          <p className="subtitle">{S.appTagline}</p>
        </div>
        <div className="header-right">
          <div className="header-links">
            <a
              className="link-btn"
              href={APP_TESTFLIGHT_URL}
              target="_blank"
              rel="noopener noreferrer"
            >{S.webApp.getApp}</a>
            <NotificationsBell sessionUserId={session.user.id} />
            <Link to={`/u/${username ?? session.user.id}`} className="link-btn">{S.feed.myCollection}</Link>
            <button className="link-btn" onClick={() => supabase.auth.signOut()}>{S.common.logOut}</button>
          </div>
        </div>
      </header>

      <div className="feed-tabs">
        {['everyone', 'friends'].map(tab => (
          <button
            key={tab}
            className={`feed-tab${activeTab === tab ? ' feed-tab-active' : ''}`}
            onClick={() => setActiveTab(tab)}
          >
            {tab === 'everyone' ? S.feed.tabEveryone : S.feed.tabFriends}
          </button>
        ))}
      </div>

      {feedLoading ? (
        <div className="centered" style={{ height: 'auto', padding: '60px 0' }}>
          <div className="spinner" />
        </div>
      ) : visibleEvents.length === 0 ? (
        <div className="centered" style={{ height: 'auto', padding: '60px 0' }}>
          <p style={{ color: '#999' }}>{activeTab === 'friends' ? S.feed.friendsEmpty : S.feed.feedEmpty}</p>
        </div>
      ) : (
        <div className="feed-list">
          {visibleEvents.map(event => {
            const item = event.item
            const slug = item.profile?.username || item.user_id
            const name = item.profile?.display_name || item.profile?.username || 'someone'
            const time = relativeTime(event.at)
            const action = event.type === 'usage' ? S.feed.usedItem : S.feed.addedNewItem
            return (
              <article
                key={event.key}
                className="feed-row"
                onClick={() => setSelectedItem(item)}
                role="button"
                tabIndex={0}
                onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setSelectedItem(item) } }}
              >
                <Link
                  to={`/u/${slug}`}
                  className="feed-poster-avatar"
                  onClick={e => e.stopPropagation()}
                >
                  <Avatar profile={{ ...(item.profile ?? {}), user_id: item.user_id }} size={36} />
                </Link>
                <div className="feed-row-text">
                  <p className="feed-poster-line">
                    <Link
                      to={`/u/${slug}`}
                      className="feed-poster-name"
                      onClick={e => e.stopPropagation()}
                    >{name}</Link>
                    <span className="feed-poster-action"> {action}</span>
                    {time && <span className="feed-poster-time"> · {time}</span>}
                  </p>
                  {item.name && <h2 className="feed-item-name">{item.name}</h2>}
                  {event.type !== 'usage' && item.description && (
                    <p className="feed-item-description">{item.description}</p>
                  )}
                </div>
                {item.image_url && (
                  <div className="feed-thumb-wrap">
                    <img src={thumbOf(item)} alt={item.name || ''} className="feed-thumb" />
                  </div>
                )}
              </article>
            )
          })}
        </div>
      )}

      <ItemDetailModal
        visible={!!selectedItem}
        item={selectedItem}
        sessionUserId={session.user.id}
        liked={selectedItem ? likedItemIds.has(selectedItem.id) : false}
        onToggleLike={handleToggleLike}
        onClose={() => setSelectedItem(null)}
        onBlocked={id => {
          setBlockedIds(prev => new Set(prev).add(id))
          setFollowingIds(prev => { const n = new Set(prev); n.delete(id); return n })
        }}
      />
    </div>
  )
}
