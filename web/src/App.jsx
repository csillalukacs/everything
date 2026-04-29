import { useEffect, useState } from 'react'

function LockIcon({ size = 10, color = 'currentColor', open = false }) {
  const d = open
    ? 'M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-6 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm-1-7V6c0-1.71 1.39-3.1 3.1-3.1 1.71 0 3.1 1.39 3.1 3.1v2H9z'
    : 'M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-6 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm3.1-9H8.9V6c0-1.71 1.39-3.1 3.1-3.1 1.71 0 3.1 1.39 3.1 3.1v2z'
  return <svg width={size} height={size} viewBox="0 0 24 24" fill={color} aria-hidden><path d={d} /></svg>
}
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
  const [manageTagsVisible, setManageTagsVisible] = useState(false)

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
      .select('*, tags(id, name, is_private)')
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

  async function handleSave(name, file, tagNames, isPrivate) {
    const publicUrl = await uploadImage(file)
    if (!publicUrl) return

    const { data, error } = await supabase
      .from('items')
      .insert({ name: name || null, image_url: publicUrl, is_private: isPrivate ?? false })
      .select()
      .single()
    if (error) return

    const resolved = await ensureTags(tagNames)
    if (!resolved) return
    await setItemTags(data.id, resolved.map(t => t.id))

    setItems(prev => [{ ...data, tags: resolved }, ...prev])
    setAddModalVisible(false)
  }

  async function handleUpdate(name, photoOrFile, tagNames, isPrivate) {
    let image_url = typeof photoOrFile === 'string' ? photoOrFile : null
    if (photoOrFile instanceof File) {
      image_url = await uploadImage(photoOrFile)
      if (!image_url) return
    }

    const { data, error } = await supabase
      .from('items')
      .update({ name: name || null, image_url, is_private: isPrivate ?? false })
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

  async function handleDeleteTag(tag) {
    await supabase.from('item_tags').delete().eq('tag_id', tag.id)
    const { error } = await supabase.from('tags').delete().eq('id', tag.id)
    if (!error) {
      setTags(prev => prev.filter(t => t.id !== tag.id))
      setItems(prev => prev.map(i => ({ ...i, tags: (i.tags ?? []).filter(t => t.id !== tag.id) })))
      if (activeTag?.id === tag.id) setActiveTag(null)
    }
  }

  async function handleToggleTagPrivacy(tag) {
    const newPrivate = !tag.is_private
    const { error } = await supabase.from('tags').update({ is_private: newPrivate }).eq('id', tag.id)
    if (!error) setTags(prev => prev.map(t => t.id === tag.id ? { ...t, is_private: newPrivate } : t))
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

  const allTagObjects = tags
  const filteredItems = activeTag
    ? activeTag.id === '__untagged__'
      ? items.filter(i => (i.tags ?? []).length === 0)
      : items.filter(i => (i.tags ?? []).some(t => t.id === activeTag.id))
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
          <button
            className={`chip${activeTag?.id === '__untagged__' ? ' chip-active' : ''}`}
            onClick={() => setActiveTag(activeTag?.id === '__untagged__' ? null : { id: '__untagged__' })}
          >untagged</button>
          {tags.map(tag => (
            <button
              key={tag.id}
              className={`chip${activeTag?.id === tag.id ? ' chip-active' : ''}`}
              onClick={() => setActiveTag(activeTag?.id === tag.id ? null : tag)}
            >{tag.is_private && <LockIcon size={10} color="currentColor" />}{tag.name}</button>
          ))}
          <button className="chip chip-dashed" onClick={() => setManageTagsVisible(true)}>manage</button>
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
              {item.is_private && !batchMode && (
                <div className="card-private-badge"><LockIcon size={10} color="#fff" /></div>
              )}
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
        allTags={allTagObjects}
      />

      <ItemDetailModal
        visible={!!selectedItem}
        item={selectedItem}
        onClose={() => setSelectedItem(null)}
        onDelete={handleDelete}
        onSave={handleUpdate}
        allTags={allTagObjects}
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
        allTags={allTagObjects}
        selectedCount={selectedIds.size}
        loading={batchTagging}
      />

      {manageTagsVisible && (
        <div className="sheet-overlay" onClick={() => setManageTagsVisible(false)}>
          <div className="sheet" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <span className="sheet-title">manage tags</span>
              <button className="link-btn" onClick={() => setManageTagsVisible(false)}>done</button>
            </div>
            {tags.length === 0
              ? <p className="manage-tags-empty">no tags yet</p>
              : tags.map(tag => (
                <div key={tag.id} className="manage-tag-row">
                  <span className="manage-tag-name">{tag.name}</span>
                  <div className="manage-tag-actions">
                    <button
                      className={`manage-tag-lock${tag.is_private ? ' manage-tag-lock-on' : ''}`}
                      onClick={() => handleToggleTagPrivacy(tag)}
                      title={tag.is_private ? 'make public' : 'make private'}
                    >
                      <LockIcon size={14} color={tag.is_private ? '#2D2D2D' : '#ccc'} open={!tag.is_private} />
                    </button>
                    <button className="manage-tag-delete" onClick={() => handleDeleteTag(tag)}>delete</button>
                  </div>
                </div>
              ))
            }
          </div>
        </div>
      )}
    </div>
  )
}
