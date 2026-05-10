import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from './lib/supabase'
import { fetchPublicFeed } from '../../shared/itemsApi'
import { thumbOf } from '../../shared/items'
import { relativeTime } from '../../shared/dates'
import { S } from '../../shared/strings'
import AuthScreen from './screens/AuthScreen'
import ItemDetailModal from './screens/ItemDetailModal'

export default function App() {
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)
  const [username, setUsername] = useState(null)
  const [feedItems, setFeedItems] = useState([])
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
    if (!session) { setUsername(null); setFeedItems([]); return }
    supabase
      .from('profiles')
      .select('username')
      .eq('user_id', session.user.id)
      .maybeSingle()
      .then(({ data }) => setUsername(data?.username ?? null))

    let cancelled = false
    setFeedLoading(true)
    fetchPublicFeed(supabase, { limit: 50 })
      .then(rows => { if (!cancelled) setFeedItems(rows) })
      .catch(e => console.error('fetchPublicFeed error:', e))
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
      ) : feedItems.length === 0 ? (
        <div className="centered" style={{ height: 'auto', padding: '60px 0' }}>
          <p style={{ color: '#999' }}>{S.feed.feedEmpty}</p>
        </div>
      ) : (
        <div className="feed-list">
          {feedItems.map(item => {
            const slug = item.profile?.username || item.user_id
            const name = item.profile?.display_name || item.profile?.username || 'someone'
            const time = relativeTime(item.created_at)
            return (
              <article
                key={item.id}
                className="feed-row"
                onClick={() => setSelectedItem(item)}
                role="button"
                tabIndex={0}
                onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setSelectedItem(item) } }}
              >
                <div className="feed-row-text">
                  <p className="feed-poster-line">
                    <Link
                      to={`/u/${slug}`}
                      className="feed-poster-name"
                      onClick={e => e.stopPropagation()}
                    >{name}</Link>
                    <span className="feed-poster-action"> {S.feed.addedNewItem}</span>
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
        onClose={() => setSelectedItem(null)}
      />
    </div>
  )
}
