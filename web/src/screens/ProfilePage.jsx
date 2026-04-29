import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import ItemDetailModal from './ItemDetailModal'

export default function ProfilePage() {
  const { userId } = useParams()
  const [items, setItems] = useState([])
  const [profileName, setProfileName] = useState(null)
  const [loading, setLoading] = useState(true)
  const [activeTag, setActiveTag] = useState(null)
  const [selectedItem, setSelectedItem] = useState(null)

  useEffect(() => {
    async function load() {
      const { data: { session } } = await supabase.auth.getSession()
      if (session) {
        const displayName = session.user.user_metadata?.full_name || session.user.email
        supabase.from('profiles').upsert({ user_id: session.user.id, display_name: displayName })
      }

      const [{ data: profile }, { data: fetchedItems }] = await Promise.all([
        supabase
          .from('profiles')
          .select('display_name')
          .eq('user_id', userId)
          .maybeSingle(),
        supabase
          .from('items')
          .select('*, tags(id, name, is_private)')
          .eq('user_id', userId)
          .eq('is_private', false)
          .order('created_at', { ascending: false }),
      ])
      if (profile) setProfileName(profile.display_name)
      if (fetchedItems) setItems(fetchedItems)
      setLoading(false)
    }
    load()
  }, [userId])

  const tagMap = new Map()
  items.forEach(item => {
    ;(item.tags ?? []).forEach(tag => {
      if (!tag.is_private) tagMap.set(tag.id, tag)
    })
  })
  const tags = [...tagMap.values()].sort((a, b) => a.name.localeCompare(b.name))

  const filteredItems = activeTag
    ? items.filter(i => (i.tags ?? []).some(t => t.id === activeTag.id))
    : items

  if (loading) {
    return (
      <div className="centered">
        <div className="spinner" />
      </div>
    )
  }

  return (
    <div className="app">
      <header className="header">
        <div>
          <h1 className="profile-name">{profileName ?? userId.split('-')[0]}</h1>
          <p className="subtitle">
            {items.length} {items.length === 1 ? 'object' : 'objects'}
          </p>
        </div>
        <Link to="/" className="link-btn" style={{ marginTop: 8 }}>everything</Link>
      </header>

      {tags.length > 0 && (
        <div className="filter-scroll">
          <button
            className={`chip${!activeTag ? ' chip-active' : ''}`}
            onClick={() => setActiveTag(null)}
          >all</button>
          {tags.map(tag => (
            <button
              key={tag.id}
              className={`chip${activeTag?.id === tag.id ? ' chip-active' : ''}`}
              onClick={() => setActiveTag(activeTag?.id === tag.id ? null : tag)}
            >{tag.name}</button>
          ))}
        </div>
      )}

      <div className="grid">
        {filteredItems.map(item => (
          <div
            key={item.id}
            className="card"
            onClick={() => setSelectedItem(item)}
          >
            {item.image_url && <img src={item.image_url} alt={item.name || ''} />}
          </div>
        ))}
      </div>

      <ItemDetailModal
        visible={!!selectedItem}
        item={selectedItem}
        onClose={() => setSelectedItem(null)}
        onPrev={(() => {
          const idx = filteredItems.findIndex(i => i.id === selectedItem?.id)
          return idx > 0 ? () => setSelectedItem(filteredItems[idx - 1]) : null
        })()}
        onNext={(() => {
          const idx = filteredItems.findIndex(i => i.id === selectedItem?.id)
          return idx < filteredItems.length - 1 ? () => setSelectedItem(filteredItems[idx + 1]) : null
        })()}
      />
    </div>
  )
}
