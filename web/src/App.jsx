import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from './lib/supabase'
import { fetchFeedEvents } from '../../shared/itemsApi'
import { thumbOf } from '../../shared/items'
import { relativeTime } from '../../shared/dates'
import { S } from '../../shared/strings'
import AuthScreen from './screens/AuthScreen'
import ItemDetailModal from './screens/ItemDetailModal'
import Avatar from './components/Avatar'

export default function App() {
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)
  const [username, setUsername] = useState(null)
  const [feedEvents, setFeedEvents] = useState([])
  const [feedLoading, setFeedLoading] = useState(true)
  const [selectedItem, setSelectedItem] = useState(null)

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
    if (!session) { setUsername(null); setFeedEvents([]); return }
    supabase
      .from('profiles')
      .select('username')
      .eq('user_id', session.user.id)
      .maybeSingle()
      .then(({ data }) => setUsername(data?.username ?? null))

    let cancelled = false
    setFeedLoading(true)
    fetchFeedEvents(supabase, { limit: 50 })
      .then(rows => { if (!cancelled) setFeedEvents(rows) })
      .catch(e => console.error('fetchFeedEvents error:', e))
      .finally(() => { if (!cancelled) setFeedLoading(false) })
    return () => { cancelled = true }
  }, [session])

  if (loading) return (
    <div className="centered"><div className="spinner" /></div>
  )

  if (!session) return <AuthScreen />

  return (
    <div className="app">
      <header className="header">
        <div>
          <h1 className="title">{S.appName}</h1>
          <p className="subtitle">{S.appTagline}</p>
        </div>
        <div className="header-right">
          <div className="header-links">
            <Link to={`/u/${username ?? session.user.id}`} className="link-btn">{S.feed.myCollection}</Link>
            <button className="link-btn" onClick={() => supabase.auth.signOut()}>{S.common.logOut}</button>
          </div>
        </div>
      </header>

      {feedLoading ? (
        <div className="centered" style={{ height: 'auto', padding: '60px 0' }}>
          <div className="spinner" />
        </div>
      ) : feedEvents.length === 0 ? (
        <div className="centered" style={{ height: 'auto', padding: '60px 0' }}>
          <p style={{ color: '#999' }}>{S.feed.feedEmpty}</p>
        </div>
      ) : (
        <div className="feed-list">
          {feedEvents.map(event => {
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
                  {item.description && (
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
        onClose={() => setSelectedItem(null)}
      />
    </div>
  )
}
