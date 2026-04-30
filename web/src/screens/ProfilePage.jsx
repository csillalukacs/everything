import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import ItemDetailModal from './ItemDetailModal'
import AddItemModal from './AddItemModal'
import BatchTagSheet from './BatchTagSheet'

const itemsCacheKey = userId => `cache:items:${userId}`
const tagsCacheKey = userId => `cache:tags:${userId}`

function readCache(key) {
  try { const raw = localStorage.getItem(key); return raw ? JSON.parse(raw) : null } catch { return null }
}
function writeCache(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)) } catch { /* quota or disabled — ignore */ }
}

function LockIcon({ size = 10, color = 'currentColor', open = false }) {
  const d = open
    ? 'M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-6 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm-1-7V6c0-1.71 1.39-3.1 3.1-3.1 1.71 0 3.1 1.39 3.1 3.1v2H9z'
    : 'M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-6 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm3.1-9H8.9V6c0-1.71 1.39-3.1 3.1-3.1 1.71 0 3.1 1.39 3.1 3.1v2z'
  return <svg width={size} height={size} viewBox="0 0 24 24" fill={color} aria-hidden><path d={d} /></svg>
}

function BatchLockIcon({ size = 18, color = '#fff', open = false }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="3" y="11" width="18" height="11" rx="2" />
      <path d={open ? 'M7 11V7a5 5 0 0 1 9.9-1' : 'M7 11V7a5 5 0 0 1 10 0v4'} />
    </svg>
  )
}

function TrashIcon({ size = 18, color = 'currentColor' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
      <path d="M10 11v6M14 11v6" />
      <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
    </svg>
  )
}

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
  const [selectedIds, setSelectedIds] = useState(new Set())
  const [addModalVisible, setAddModalVisible] = useState(false)
  const [batchTagVisible, setBatchTagVisible] = useState(false)
  const [manageTagsVisible, setManageTagsVisible] = useState(false)
  const [manageTagSearch, setManageTagSearch] = useState('')
  const [searchQuery, setSearchQuery] = useState('')

  const batchMode = selectedIds.size > 0

  useEffect(() => {
    async function load() {
      const { data: { session } } = await supabase.auth.getSession()
      let ownerSession = false
      const isOwnerView = session && session.user.id === userId
      if (isOwnerView) {
        const cachedItems = readCache(itemsCacheKey(userId))
        const cachedTags = readCache(tagsCacheKey(userId))
        if (cachedItems) setItems(cachedItems)
        if (cachedTags) setAllTags(cachedTags)
        if (cachedItems) setLoading(false)
      }

      if (session) {
        const displayName = session.user.user_metadata?.full_name || session.user.email
        await supabase.from('profiles').upsert({ user_id: session.user.id, display_name: displayName }, { ignoreDuplicates: true })
        if (session.user.id === userId) {
          ownerSession = true
          setIsOwner(true)
          setSessionUserId(session.user.id)
          const { data: tagsData } = await supabase.from('tags').select('*').order('name')
          if (tagsData) {
            setAllTags(tagsData)
            writeCache(tagsCacheKey(userId), tagsData)
          }
        }
      }

      let itemsQuery = supabase
        .from('items')
        .select('*, tags(id, name, is_private)')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
      if (!ownerSession) itemsQuery = itemsQuery.eq('is_private', false)

      const [{ data: profile }, { data: fetchedItems }] = await Promise.all([
        supabase.from('profiles').select('display_name').eq('user_id', userId).maybeSingle(),
        itemsQuery,
      ])
      if (profile) {
        setProfileName(profile.display_name)
        setNameInput(profile.display_name ?? '')
      }
      if (fetchedItems) {
        setItems(fetchedItems)
        if (ownerSession) writeCache(itemsCacheKey(userId), fetchedItems)
      }
      setLoading(false)
    }
    load()
  }, [userId])

  useEffect(() => {
    if (!isOwner || !sessionUserId) return
    writeCache(itemsCacheKey(sessionUserId), items)
  }, [items, isOwner, sessionUserId])

  useEffect(() => {
    if (!isOwner || !sessionUserId) return
    writeCache(tagsCacheKey(sessionUserId), allTags)
  }, [allTags, isOwner, sessionUserId])

  async function uploadImage(file) {
    const ext = file.name.split('.').pop()
    const path = `${sessionUserId}/${Date.now()}.${ext}`
    const { error } = await supabase.storage.from('item-images').upload(path, file, { contentType: file.type, cacheControl: '31536000, immutable' })
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

  async function handleSave(name, file, tagNames, isPrivate, description) {
    const image_url = await uploadImage(file)
    if (!image_url) return
    const { data, error } = await supabase
      .from('items')
      .insert({ name: name || null, description: description || null, image_url, is_private: isPrivate ?? false })
      .select()
      .single()
    if (error) return
    const resolved = await ensureTags(tagNames)
    if (!resolved) return
    await setItemTags(data.id, resolved.map(t => t.id))
    setItems(prev => [{ ...data, tags: resolved }, ...prev])
    setAddModalVisible(false)
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
      setAllTags(prev => prev.filter(t => t.id !== tag.id))
      setItems(prev => prev.map(i => ({ ...i, tags: (i.tags ?? []).filter(t => t.id !== tag.id) })))
      if (activeTag?.id === tag.id) setActiveTag(null)
    }
  }

  async function handleToggleTagPrivacy(tag) {
    const newPrivate = !tag.is_private
    const { error } = await supabase.from('tags').update({ is_private: newPrivate }).eq('id', tag.id)
    if (!error) setAllTags(prev => prev.map(t => t.id === tag.id ? { ...t, is_private: newPrivate } : t))
  }

  async function handleBatchTag(tagNames) {
    if (tagNames.length === 0) { setBatchTagVisible(false); return }
    const resolved = await ensureTags(tagNames)
    if (!resolved) return
    const ids = [...selectedIds]
    setItems(prev => prev.map(item => {
      if (!selectedIds.has(item.id)) return item
      const existing = item.tags ?? []
      const existingIds = new Set(existing.map(t => t.id))
      const merged = [...existing, ...resolved.filter(t => !existingIds.has(t.id))]
      return { ...item, tags: merged }
    }))
    setBatchTagVisible(false)
    setSelectedIds(new Set())
    const rows = ids.flatMap(item_id => resolved.map(t => ({ item_id, tag_id: t.id })))
    const { error } = await supabase
      .from('item_tags')
      .upsert(rows, { onConflict: 'item_id,tag_id', ignoreDuplicates: true })
    if (error) console.error('Batch tag error:', error)
  }

  async function handleBatchDelete() {
    const ids = [...selectedIds]
    setSelectedIds(new Set())
    await supabase.from('item_tags').delete().in('item_id', ids)
    const { error } = await supabase.from('items').delete().in('id', ids)
    if (!error) setItems(prev => prev.filter(i => !ids.includes(i.id)))
  }

  async function handleBatchTogglePrivacy() {
    const ids = [...selectedIds]
    const allPrivate = ids.every(id => items.find(i => i.id === id)?.is_private)
    const newPrivate = !allPrivate
    await supabase.from('items').update({ is_private: newPrivate }).in('id', ids)
    setItems(prev => prev.map(i => ids.includes(i.id) ? { ...i, is_private: newPrivate } : i))
  }

  const tagMap = new Map()
  items.forEach(item => {
    ;(item.tags ?? []).forEach(tag => {
      if (!tag.is_private) tagMap.set(tag.id, tag)
    })
  })
  const visibleTags = [...tagMap.values()].sort((a, b) => a.name.localeCompare(b.name))

  const query = searchQuery.trim().toLowerCase()
  const searchedItems = query
    ? items.filter(i => {
        const name = (i.name ?? '').toLowerCase()
        const desc = (i.description ?? '').toLowerCase()
        const tagNames = (i.tags ?? []).map(t => t.name.toLowerCase())
        return name.includes(query) || desc.includes(query) || tagNames.some(n => n.includes(query))
      })
    : items

  const filteredItems = activeTag?.id === '__untagged__'
    ? searchedItems.filter(i => (i.tags ?? []).length === 0)
    : activeTag
      ? searchedItems.filter(i => (i.tags ?? []).some(t => t.id === activeTag.id))
      : searchedItems
  const visibleItemIds = new Set(filteredItems.map(i => i.id))

  const tagCounts = new Map()
  let untaggedCount = 0
  for (const item of searchedItems) {
    const tagsArr = item.tags ?? []
    if (tagsArr.length === 0) untaggedCount++
    for (const t of tagsArr) tagCounts.set(t.id, (tagCounts.get(t.id) ?? 0) + 1)
  }

  const totalTagCounts = new Map()
  for (const item of items) {
    for (const t of (item.tags ?? [])) totalTagCounts.set(t.id, (totalTagCounts.get(t.id) ?? 0) + 1)
  }

  const manageQuery = manageTagSearch.trim().toLowerCase()
  const manageTagsList = (manageQuery
    ? allTags.filter(t => t.name.toLowerCase().includes(manageQuery))
    : allTags
  ).slice().sort((a, b) => a.name.localeCompare(b.name))

  function closeManageTags() {
    setManageTagsVisible(false)
    setManageTagSearch('')
  }

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

      <div className="search-container">
        <svg className="search-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#999" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <circle cx="11" cy="11" r="7" />
          <line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>
        <input
          type="text"
          className="search-input"
          placeholder="search"
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
        />
        {searchQuery && (
          <button className="search-clear" onClick={() => setSearchQuery('')} aria-label="clear search">×</button>
        )}
      </div>

      {isOwner ? (
        allTags.length > 0 && (
          <div className="filter-row">
            <div className="filter-scroll">
              <button className={`chip${!activeTag ? ' chip-active' : ''}`} onClick={() => setActiveTag(null)}>all<span className="chip-count">{searchedItems.length}</span></button>
              <button
                className={`chip${activeTag?.id === '__untagged__' ? ' chip-active' : ''}`}
                onClick={() => setActiveTag(activeTag?.id === '__untagged__' ? null : { id: '__untagged__' })}
              >untagged<span className="chip-count">{untaggedCount}</span></button>
              {allTags.map(tag => (
                <button
                  key={tag.id}
                  className={`chip${activeTag?.id === tag.id ? ' chip-active' : ''}`}
                  onClick={() => setActiveTag(activeTag?.id === tag.id ? null : tag)}
                >{tag.is_private && <LockIcon size={10} color="currentColor" />}{tag.name}<span className="chip-count">{tagCounts.get(tag.id) ?? 0}</span></button>
              ))}
            </div>
            <button className="chip chip-dashed filter-manage-btn" onClick={() => setManageTagsVisible(true)}>manage</button>
          </div>
        )
      ) : (
        visibleTags.length > 0 && (
          <div className="filter-scroll">
            <button className={`chip${!activeTag ? ' chip-active' : ''}`} onClick={() => setActiveTag(null)}>all<span className="chip-count">{searchedItems.length}</span></button>
            {visibleTags.map(tag => (
              <button
                key={tag.id}
                className={`chip${activeTag?.id === tag.id ? ' chip-active' : ''}`}
                onClick={() => setActiveTag(activeTag?.id === tag.id ? null : tag)}
              >{tag.name}<span className="chip-count">{tagCounts.get(tag.id) ?? 0}</span></button>
            ))}
          </div>
        )
      )}

      <div className="grid">
        {items.map(item => {
          const isSelected = selectedIds.has(item.id)
          const visible = visibleItemIds.has(item.id)
          return (
            <div
              key={item.id}
              className={`card${isSelected ? ' card-selected' : ''}${visible ? '' : ' card-hidden'}`}
              onClick={() => isOwner && batchMode ? toggleBatchSelect(item.id) : setSelectedItem(item)}
              onContextMenu={isOwner ? e => { e.preventDefault(); toggleBatchSelect(item.id) } : undefined}
            >
              {item.image_url && <img src={item.image_url} alt={item.name || ''} loading="lazy" />}
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

      {isOwner && (
        batchMode ? (
          <div className="batch-bar">
            <button className="batch-cancel" onClick={() => setSelectedIds(new Set())}>cancel</button>
            <span className="batch-count">{selectedIds.size} selected</span>
            <div className="batch-actions">
              <button className="batch-icon-btn" onClick={handleBatchTogglePrivacy} title="lock / unlock">
                <BatchLockIcon open={![...selectedIds].every(id => items.find(i => i.id === id)?.is_private)} />
              </button>
              <button className="batch-icon-btn batch-delete-btn" onClick={handleBatchDelete} title="delete">
                <TrashIcon size={18} color="#ff6b6b" />
              </button>
              <button className="batch-tag-btn" onClick={() => setBatchTagVisible(true)}>tag</button>
            </div>
          </div>
        ) : (
          <button className="fab" onClick={() => setAddModalVisible(true)}>+</button>
        )
      )}

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

      {isOwner && (
        <>
          <AddItemModal
            visible={addModalVisible}
            onClose={() => setAddModalVisible(false)}
            onSave={handleSave}
            allTags={allTags}
          />

          <BatchTagSheet
            visible={batchTagVisible}
            onClose={() => setBatchTagVisible(false)}
            onApply={handleBatchTag}
            allTags={allTags}
            selectedCount={selectedIds.size}
          />

          {manageTagsVisible && (
            <div className="sheet-overlay" onClick={closeManageTags}>
              <div className="sheet sheet-manage-tags" onClick={e => e.stopPropagation()}>
                <div className="modal-header">
                  <span className="sheet-title">manage tags · {allTags.length}</span>
                  <button className="link-btn" onClick={closeManageTags}>done</button>
                </div>
                <div className="search-container manage-tag-search">
                  <svg className="search-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#999" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                    <circle cx="11" cy="11" r="7" />
                    <line x1="21" y1="21" x2="16.65" y2="16.65" />
                  </svg>
                  <input
                    type="text"
                    className="search-input"
                    placeholder="search tags"
                    value={manageTagSearch}
                    onChange={e => setManageTagSearch(e.target.value)}
                    autoFocus
                  />
                  {manageTagSearch && (
                    <button className="search-clear" onClick={() => setManageTagSearch('')} aria-label="clear search">×</button>
                  )}
                </div>
                <div className="manage-tag-list">
                  {manageTagsList.length === 0
                    ? <p className="manage-tags-empty">{allTags.length === 0 ? 'no tags yet' : 'no matches'}</p>
                    : manageTagsList.map(tag => (
                      <div key={tag.id} className="manage-tag-row">
                        <div className="manage-tag-info">
                          <span className="manage-tag-name">{tag.name}</span>
                          <span className="manage-tag-count">{totalTagCounts.get(tag.id) ?? 0}</span>
                        </div>
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
            </div>
          )}
        </>
      )}
    </div>
  )
}
