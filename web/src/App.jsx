import { useEffect, useState } from 'react'
import { supabase } from './lib/supabase'
import AuthScreen from './screens/AuthScreen'
import AddItemModal from './screens/AddItemModal'
import ItemDetailModal from './screens/ItemDetailModal'
import BatchTagSheet from './screens/BatchTagSheet'

export default function App() {
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)
  const [items, setItems] = useState([])
  const [tags, setTags] = useState([])
  const [activeTag, setActiveTag] = useState(null)
  const [selectedItem, setSelectedItem] = useState(null)
  const [selectedIds, setSelectedIds] = useState(new Set())
  const [addModalVisible, setAddModalVisible] = useState(false)
  const [batchTagVisible, setBatchTagVisible] = useState(false)
  const [batchTagging, setBatchTagging] = useState(false)

  const batchMode = selectedIds.size > 0

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
    if (session) {
      fetchItems()
      fetchTags()
    } else {
      setItems([])
      setTags([])
    }
  }, [session])

  async function fetchItems() {
    const { data, error } = await supabase
      .from('items')
      .select('*, tags(id, name)')
      .order('created_at', { ascending: false })
    if (!error) setItems(data)
  }

  async function fetchTags() {
    const { data, error } = await supabase
      .from('tags')
      .select('*')
      .order('name')
    if (!error) setTags(data)
  }

  async function ensureTags(tagNames) {
    const lowered = [...new Set(tagNames.map(n => n.trim().toLowerCase()).filter(Boolean))]
    if (lowered.length === 0) return []

    const byName = new Map(tags.map(t => [t.name, t]))
    const newNames = lowered.filter(n => !byName.has(n))

    let created = []
    if (newNames.length > 0) {
      const { data, error } = await supabase
        .from('tags')
        .insert(newNames.map(name => ({ name, user_id: session.user.id })))
        .select()
      if (error) { console.error('Tag insert error:', error); return null }
      created = data
      setTags(prev => [...prev, ...created])
      created.forEach(t => byName.set(t.name, t))
    }

    return lowered.map(n => byName.get(n))
  }

  async function setItemTags(itemId, tagIds) {
    await supabase.from('item_tags').delete().eq('item_id', itemId)
    if (tagIds.length === 0) return
    await supabase.from('item_tags').insert(tagIds.map(tag_id => ({ item_id: itemId, tag_id })))
  }

  async function uploadImage(file) {
    const ext = file.name.split('.').pop()
    const path = `${session.user.id}/${Date.now()}.${ext}`
    const { error } = await supabase.storage
      .from('item-images')
      .upload(path, file, { contentType: file.type })
    if (error) { console.error('Upload error:', error); return null }
    return supabase.storage.from('item-images').getPublicUrl(path).data.publicUrl
  }

  async function handleSave(name, file, tagNames) {
    const publicUrl = await uploadImage(file)
    if (!publicUrl) return

    const { data, error } = await supabase
      .from('items')
      .insert({ name: name || null, image_url: publicUrl })
      .select()
      .single()
    if (error) return

    const resolved = await ensureTags(tagNames)
    if (!resolved) return
    await setItemTags(data.id, resolved.map(t => t.id))

    setItems(prev => [{ ...data, tags: resolved }, ...prev])
    setAddModalVisible(false)
  }

  async function handleUpdate(name, photoOrFile, tagNames) {
    let image_url = typeof photoOrFile === 'string' ? photoOrFile : null
    if (photoOrFile instanceof File) {
      image_url = await uploadImage(photoOrFile)
      if (!image_url) return
    }

    const { data, error } = await supabase
      .from('items')
      .update({ name: name || null, image_url })
      .eq('id', selectedItem.id)
      .select()
      .single()
    if (error) return

    const resolved = await ensureTags(tagNames)
    if (!resolved) return
    await setItemTags(data.id, resolved.map(t => t.id))

    const updated = { ...data, tags: resolved }
    setItems(prev => prev.map(i => i.id === updated.id ? updated : i))
    setSelectedItem(updated)
  }

  async function handleDelete() {
    const itemToDelete = selectedItem
    setSelectedItem(null)
    const { error } = await supabase.from('items').delete().eq('id', itemToDelete.id)
    if (!error) setItems(prev => prev.filter(i => i.id !== itemToDelete.id))
  }

  function toggleBatchSelect(itemId) {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(itemId)) next.delete(itemId)
      else next.add(itemId)
      return next
    })
  }

  async function handleBatchTag(tagNames) {
    if (tagNames.length === 0) {
      setBatchTagVisible(false)
      return
    }
    setBatchTagging(true)
    const resolved = await ensureTags(tagNames)
    if (!resolved) { setBatchTagging(false); return }
    const newTagIds = resolved.map(t => t.id)
    for (const itemId of selectedIds) {
      const item = items.find(i => i.id === itemId)
      const existingIds = (item?.tags ?? []).map(t => t.id)
      await setItemTags(itemId, [...new Set([...existingIds, ...newTagIds])])
    }
    await fetchItems()
    setBatchTagging(false)
    setBatchTagVisible(false)
    setSelectedIds(new Set())
  }

  const allTagNames = tags.map(t => t.name)
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

  if (!session) return <AuthScreen />

  return (
    <div className="app">
      <header className="header">
        <div>
          <h1 className="title">everything</h1>
          <p className="subtitle">a home for your stuff</p>
        </div>
        <div className="header-right">
          <span className="header-meta">
            {session.user.user_metadata?.full_name || session.user.email}
            {' · '}
            {items.length} {items.length === 1 ? 'item' : 'items'}
          </span>
          <button className="link-btn" onClick={() => supabase.auth.signOut()}>log out</button>
        </div>
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
        {filteredItems.map(item => {
          const isSelected = selectedIds.has(item.id)
          return (
            <div
              key={item.id}
              className={`card${isSelected ? ' card-selected' : ''}`}
              onClick={() => batchMode ? toggleBatchSelect(item.id) : setSelectedItem(item)}
              onContextMenu={e => { e.preventDefault(); toggleBatchSelect(item.id) }}
            >
              {item.image_url && <img src={item.image_url} alt={item.name || ''} />}
              {batchMode && (
                <div className={`selection-circle${isSelected ? ' selection-circle-active' : ''}`}>
                  {isSelected && <span>✓</span>}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {batchMode ? (
        <div className="batch-bar">
          <button className="batch-cancel" onClick={() => setSelectedIds(new Set())}>cancel</button>
          <span className="batch-count">{selectedIds.size} selected</span>
          <button className="batch-tag-btn" onClick={() => setBatchTagVisible(true)}>tag</button>
        </div>
      ) : (
        <button className="fab" onClick={() => setAddModalVisible(true)}>+</button>
      )}

      <AddItemModal
        visible={addModalVisible}
        onClose={() => setAddModalVisible(false)}
        onSave={handleSave}
        allTags={allTagNames}
      />

      <ItemDetailModal
        visible={!!selectedItem}
        item={selectedItem}
        onClose={() => setSelectedItem(null)}
        onDelete={handleDelete}
        onSave={handleUpdate}
        allTags={allTagNames}
        onPrev={(() => {
          const idx = filteredItems.findIndex(i => i.id === selectedItem?.id)
          return idx > 0 ? () => setSelectedItem(filteredItems[idx - 1]) : null
        })()}
        onNext={(() => {
          const idx = filteredItems.findIndex(i => i.id === selectedItem?.id)
          return idx < filteredItems.length - 1 ? () => setSelectedItem(filteredItems[idx + 1]) : null
        })()}
      />

      <BatchTagSheet
        visible={batchTagVisible}
        onClose={() => setBatchTagVisible(false)}
        onApply={handleBatchTag}
        allTags={allTagNames}
        selectedCount={selectedIds.size}
        loading={batchTagging}
      />
    </div>
  )
}
