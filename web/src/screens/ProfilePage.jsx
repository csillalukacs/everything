import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import ItemDetailModal from './ItemDetailModal'

export default function ProfilePage() {
  const { userId } = useParams()
  const [items, setItems] = useState([])
  const [allTags, setAllTags] = useState([])
  const [profileName, setProfileName] = useState(null)
  const [loading, setLoading] = useState(true)
  const [activeTag, setActiveTag] = useState(null)
  const [selectedItem, setSelectedItem] = useState(null)
  const [isOwner, setIsOwner] = useState(false)
  const [editingName, setEditingName] = useState(false)
  const [nameInput, setNameInput] = useState('')
  const [sessionUserId, setSessionUserId] = useState(null)

  useEffect(() => {
    async function load() {
      const { data: { session } } = await supabase.auth.getSession()
      if (session) {
        const displayName = session.user.user_metadata?.full_name || session.user.email
        await supabase.from('profiles').upsert({ user_id: session.user.id, display_name: displayName }, { ignoreDuplicates: true })
        if (session.user.id === userId) {
          setIsOwner(true)
          setSessionUserId(session.user.id)
          const { data: tagsData } = await supabase.from('tags').select('*').order('name')
          if (tagsData) setAllTags(tagsData)
        }
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
      if (profile) {
        setProfileName(profile.display_name)
        setNameInput(profile.display_name ?? '')
      }
      if (fetchedItems) setItems(fetchedItems)
      setLoading(false)
    }
    load()
  }, [userId])

  async function uploadImage(file) {
    const ext = file.name.split('.').pop()
    const path = `${sessionUserId}/${Date.now()}.${ext}`
    const { error } = await supabase.storage.from('item-images').upload(path, file, { contentType: file.type })
    if (error) return null
    return supabase.storage.from('item-images').getPublicUrl(path).data.publicUrl
  }

  async function ensureTags(tagNames) {
    const lowered = [...new Set(tagNames.map(n => n.trim().toLowerCase()).filter(Boolean))]
    if (lowered.length === 0) return []
    const byName = new Map(allTags.map(t => [t.name, t]))
    const newNames = lowered.filter(n => !byName.has(n))
    if (newNames.length > 0) {
      const { data, error } = await supabase
        .from('tags')
        .insert(newNames.map(name => ({ name, user_id: sessionUserId })))
        .select()
      if (error) return null
      setAllTags(prev => [...prev, ...data])
      data.forEach(t => byName.set(t.name, t))
    }
    return lowered.map(n => byName.get(n))
  }

  async function setItemTags(itemId, tagIds) {
    await supabase.from('item_tags').delete().eq('item_id', itemId)
    if (tagIds.length > 0)
      await supabase.from('item_tags').insert(tagIds.map(tag_id => ({ item_id: itemId, tag_id })))
  }

  async function handleUpdate(name, photoOrFile, tagNames, isPrivate, description) {
    let image_url = typeof photoOrFile === 'string' ? photoOrFile : null
    if (photoOrFile instanceof File) {
      image_url = await uploadImage(photoOrFile)
      if (!image_url) return
    }
    const { data, error } = await supabase
      .from('items')
      .update({ name: name || null, description: description || null, image_url, is_private: isPrivate ?? false })
      .eq('id', selectedItem.id)
      .select()
      .single()
    if (error) return
    const resolved = await ensureTags(tagNames)
    if (!resolved) return
    await setItemTags(data.id, resolved.map(t => t.id))
    const updated = { ...data, tags: resolved }
    if (isPrivate) {
      setItems(prev => prev.filter(i => i.id !== updated.id))
      setSelectedItem(null)
    } else {
      setItems(prev => prev.map(i => i.id === updated.id ? updated : i))
      setSelectedItem(updated)
    }
  }

  async function handleDelete() {
    const itemToDelete = selectedItem
    setSelectedItem(null)
    const { error } = await supabase.from('items').delete().eq('id', itemToDelete.id)
    if (!error) setItems(prev => prev.filter(i => i.id !== itemToDelete.id))
  }

  const tagMap = new Map()
  items.forEach(item => {
    ;(item.tags ?? []).forEach(tag => {
      if (!tag.is_private) tagMap.set(tag.id, tag)
    })
  })
  const visibleTags = [...tagMap.values()].sort((a, b) => a.name.localeCompare(b.name))

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
          {isOwner && editingName ? (
            <input
              className="profile-name-input"
              value={nameInput}
              onChange={e => setNameInput(e.target.value)}
              onBlur={async () => {
                const trimmed = nameInput.trim()
                if (trimmed && trimmed !== profileName) {
                  await supabase.from('profiles').upsert({ user_id: userId, display_name: trimmed })
                  setProfileName(trimmed)
                } else {
                  setNameInput(profileName ?? '')
                }
                setEditingName(false)
              }}
              onKeyDown={e => { if (e.key === 'Enter') e.target.blur() }}
              autoFocus
            />
          ) : (
            <h1
              className={`profile-name${isOwner ? ' profile-name-editable' : ''}`}
              onClick={() => isOwner && setEditingName(true)}
            >{profileName ?? userId.split('-')[0]} : {items.length} {items.length === 1 ? 'object' : 'objects'}</h1>
          )}
        </div>
        <Link to="/" className="link-btn" style={{ marginTop: 8 }}>everything</Link>
      </header>

      {visibleTags.length > 0 && (
        <div className="filter-scroll">
          <button
            className={`chip${!activeTag ? ' chip-active' : ''}`}
            onClick={() => setActiveTag(null)}
          >all</button>
          {visibleTags.map(tag => (
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
        onSave={isOwner ? handleUpdate : undefined}
        onDelete={isOwner ? handleDelete : undefined}
        allTags={allTags}
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
