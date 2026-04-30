import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from './lib/supabase'
import AuthScreen from './screens/AuthScreen'

const itemsCacheKey = userId => `cache:items:${userId}`

function readCache(key) {
  try { const raw = localStorage.getItem(key); return raw ? JSON.parse(raw) : null } catch { return null }
}
function writeCache(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)) } catch { /* ignore */ }
}

function getDailyItem(items) {
  if (!items.length) return null
  const dateStr = new Date().toISOString().slice(0, 10)
  let hash = 0
  for (const ch of dateStr) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0
  return items[hash % items.length]
}

export default function App() {
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)
  const [items, setItems] = useState([])

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
    if (!session) { setItems([]); return }
    const cached = readCache(itemsCacheKey(session.user.id))
    if (cached) setItems(cached)
    supabase
      .from('items')
      .select('*, tags(id, name, is_private)')
      .eq('user_id', session.user.id)
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        if (data) {
          setItems(data)
          writeCache(itemsCacheKey(session.user.id), data)
        }
      })
  }, [session])

  if (loading) return (
    <div className="centered"><div className="spinner" /></div>
  )

  if (!session) return <AuthScreen />

  const dailyItem = getDailyItem(items)

  return (
    <div className="app">
      <header className="header">
        <div>
          <h1 className="title">everything</h1>
          <p className="subtitle">a home for your stuff</p>
        </div>
        <div className="header-right">
          <div className="header-links">
            <Link to={`/u/${session.user.id}`} className="link-btn">my collection</Link>
            <button className="link-btn" onClick={() => supabase.auth.signOut()}>log out</button>
          </div>
        </div>
      </header>

      {items.length === 0 ? (
        <div className="centered" style={{ flexDirection: 'column', gap: 16 }}>
          <p style={{ color: '#999' }}>you haven't added anything yet</p>
          <Link to={`/u/${session.user.id}`} className="link-btn link-btn-dark">add your first item</Link>
        </div>
      ) : dailyItem && (
        <div className="daily-item">
          <p className="daily-label">item of the day</p>
          {dailyItem.image_url && (
            <div className="daily-image-wrap">
              <img src={dailyItem.image_url} alt={dailyItem.name || ''} className="daily-image" />
            </div>
          )}
          {dailyItem.name && <h2 className="daily-name">{dailyItem.name}</h2>}
          {dailyItem.description && <p className="daily-description">{dailyItem.description}</p>}
          {(dailyItem.tags ?? []).length > 0 && (
            <div className="tag-row" style={{ justifyContent: 'center' }}>
              {(dailyItem.tags ?? []).map(tag => (
                <span key={tag.id} className="tag-badge">{tag.name}</span>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
