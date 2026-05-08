import { useEffect, useMemo, useState } from 'react'
import { useParams, useSearchParams, Link, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import ItemDetailModal from './ItemDetailModal'
import AddItemModal from './AddItemModal'
import BatchEditSheet from './BatchEditSheet'
import LocationPicker from './LocationPicker'
import FilterDropdown from './FilterDropdown'

function cityOf(loc) {
  if (!loc) return null
  const c = loc.split(',')[0].trim()
  return c || null
}

function formatDateLabel(s) {
  if (!s) return ''
  const d = new Date(s)
  if (Number.isNaN(d.getTime())) return s
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).toLowerCase()
}

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

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const USERNAME_RE = /^[a-z0-9_]{3,20}$/

export default function ProfilePage() {
  const { slug } = useParams()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const yearParam = searchParams.get('year') || null
  const yearMinParam = searchParams.get('yearMin') || null
  const yearMaxParam = searchParams.get('yearMax') || null
  const cityParam = searchParams.get('city') || null
  const fromParam = searchParams.get('from') || null
  const toParam = searchParams.get('to') || null
  const itemIdParam = searchParams.get('item') || null
  const sortParam = searchParams.get('sort') || 'newest'
  const tagParam = searchParams.get('tag') || null

  const [userId, setUserId] = useState(null)
  const [notFound, setNotFound] = useState(false)
  const [items, setItems] = useState([])
  const [allTags, setAllTags] = useState([])
  const [profileName, setProfileName] = useState(null)
  const [username, setUsername] = useState(null)
  const [loading, setLoading] = useState(true)
  const [isOwner, setIsOwner] = useState(false)
  const [editingName, setEditingName] = useState(false)
  const [nameInput, setNameInput] = useState('')
  const [editingUsername, setEditingUsername] = useState(false)
  const [usernameInput, setUsernameInput] = useState('')
  const [usernameStatus, setUsernameStatus] = useState(null) // null | 'checking' | 'available' | 'taken' | 'invalid' | 'reserved'
  const [sessionUserId, setSessionUserId] = useState(null)
  const [home, setHome] = useState(null)
  const [editingHome, setEditingHome] = useState(false)
  const [selectedIds, setSelectedIds] = useState(new Set())
  const [addModalVisible, setAddModalVisible] = useState(false)
  const [batchEditVisible, setBatchEditVisible] = useState(false)
  const [manageTagsVisible, setManageTagsVisible] = useState(false)
  const [manageTagSearch, setManageTagSearch] = useState('')
  const [searchQuery, setSearchQuery] = useState('')

  const batchMode = selectedIds.size > 0

  const selectedItem = itemIdParam ? (items.find(i => i.id === itemIdParam) ?? null) : null

  function updateParams(patch) {
    const next = new URLSearchParams(searchParams)
    for (const [k, v] of Object.entries(patch)) {
      if (v == null || v === '') next.delete(k)
      else next.set(k, String(v))
    }
    setSearchParams(next)
  }

  function openItem(item) { updateParams({ item: item.id }) }
  function closeItem() { updateParams({ item: null }) }
  function setActiveTag(tag) {
    if (!tag) updateParams({ tag: null })
    else if (tag.id === '__untagged__') updateParams({ tag: '__untagged__' })
    else updateParams({ tag: tag.name })
  }

  const activeTag = useMemo(() => {
    if (!tagParam) return null
    if (tagParam === '__untagged__') return { id: '__untagged__' }
    const fromAll = allTags.find(t => t.name === tagParam)
    if (fromAll) return fromAll
    for (const item of items) {
      const t = (item.tags ?? []).find(t => t.name === tagParam)
      if (t) return t
    }
    return null
  }, [tagParam, allTags, items])

  useEffect(() => {
    async function load() {
      const slugIsUuid = UUID_RE.test(slug)
      const { data: { session } } = await supabase.auth.getSession()

      let resolvedId = null
      let resolvedProfile = null
      if (slugIsUuid) {
        resolvedId = slug
        const { data } = await supabase
          .from('profiles')
          .select('display_name, username, home_location, home_lat, home_lng')
          .eq('user_id', slug)
          .maybeSingle()
        resolvedProfile = data
      } else {
        const { data } = await supabase
          .from('profiles')
          .select('user_id, display_name, username, home_location, home_lat, home_lng')
          .ilike('username', slug)
          .maybeSingle()
        if (data) {
          resolvedId = data.user_id
          resolvedProfile = data
        }
      }

      if (!resolvedId) {
        setNotFound(true)
        setLoading(false)
        return
      }
      if (slugIsUuid && resolvedProfile?.username) {
        navigate(`/u/${resolvedProfile.username}`, { replace: true })
        return
      }
      setUserId(resolvedId)
      if (resolvedProfile) {
        setProfileName(resolvedProfile.display_name)
        setUsername(resolvedProfile.username)
        setNameInput(resolvedProfile.display_name ?? '')
        setUsernameInput(resolvedProfile.username ?? '')
        setHome(resolvedProfile.home_location
          ? { location: resolvedProfile.home_location, lat: resolvedProfile.home_lat, lng: resolvedProfile.home_lng }
          : null)
      }

      let ownerSession = false
      const isOwnerView = session && session.user.id === resolvedId
      if (isOwnerView) {
        const cachedItems = readCache(itemsCacheKey(resolvedId))
        const cachedTags = readCache(tagsCacheKey(resolvedId))
        if (cachedItems) setItems(cachedItems)
        if (cachedTags) setAllTags(cachedTags)
        if (cachedItems) setLoading(false)
      }

      if (session) {
        const displayName = session.user.user_metadata?.full_name || session.user.email
        await supabase.from('profiles').upsert({ user_id: session.user.id, display_name: displayName }, { ignoreDuplicates: true })
        if (session.user.id === resolvedId) {
          ownerSession = true
          setIsOwner(true)
          setSessionUserId(session.user.id)
          const { data: tagsData } = await supabase.from('tags').select('*').order('name')
          if (tagsData) {
            setAllTags(tagsData)
            writeCache(tagsCacheKey(resolvedId), tagsData)
          }
        }
      }

      let itemsQuery = supabase
        .from('items')
        .select('*, tags(id, name, is_private)')
        .eq('user_id', resolvedId)
        .order('created_at', { ascending: false })
      if (!ownerSession) itemsQuery = itemsQuery.eq('is_private', false)

      const { data: fetchedItems } = await itemsQuery
      if (fetchedItems) {
        setItems(fetchedItems)
        if (ownerSession) writeCache(itemsCacheKey(resolvedId), fetchedItems)
      }
      setLoading(false)
    }
    load()
  }, [slug])

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

  function acquiredFields(acquired) {
    return {
      acquired_year: acquired?.year ?? null,
      acquired_location: acquired?.location ?? null,
      acquired_lat: acquired?.lat ?? null,
      acquired_lng: acquired?.lng ?? null,
    }
  }

  async function handleSave(name, file, tagNames, isPrivate, description, acquired) {
    const image_url = await uploadImage(file)
    if (!image_url) return
    const { data, error } = await supabase
      .from('items')
      .insert({
        name: name || null,
        description: description || null,
        image_url,
        is_private: isPrivate ?? false,
        ...acquiredFields(acquired),
      })
      .select()
      .single()
    if (error) return
    const resolved = await ensureTags(tagNames)
    if (!resolved) return
    await setItemTags(data.id, resolved.map(t => t.id))
    setItems(prev => [{ ...data, tags: resolved }, ...prev])
    setAddModalVisible(false)
  }

  async function handleUpdate(name, photoOrFile, tagNames, isPrivate, description, acquired, previousImages, imageAddedAt) {
    let image_url = typeof photoOrFile === 'string' ? photoOrFile : null
    const isNewPhoto = photoOrFile instanceof File
    if (isNewPhoto) {
      image_url = await uploadImage(photoOrFile)
      if (!image_url) return
    }
    const { data, error } = await supabase
      .from('items')
      .update({
        name: name || null,
        description: description || null,
        image_url,
        is_private: isPrivate ?? false,
        ...acquiredFields(acquired),
        ...(previousImages !== undefined ? { previous_images: previousImages } : {}),
        ...(imageAddedAt !== undefined ? { image_added_at: imageAddedAt } : (isNewPhoto ? { image_added_at: new Date().toISOString() } : {})),
      })
      .eq('id', selectedItem.id)
      .select()
      .single()
    if (error) return
    const resolved = await ensureTags(tagNames)
    if (!resolved) return
    await setItemTags(data.id, resolved.map(t => t.id))
    const updated = { ...data, tags: resolved }
    setItems(prev => prev.map(i => i.id === updated.id ? updated : i))
  }

  async function handleDelete() {
    const itemToDelete = selectedItem
    closeItem()
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

  async function handleBatchEdit({ addTags, acquired }) {
    if (addTags.length === 0 && !acquired) { setBatchEditVisible(false); return }
    const resolved = addTags.length > 0 ? await ensureTags(addTags) : []
    if (resolved === null) return
    const ids = [...selectedIds]
    const acquiredPatch = acquired ? acquiredFields(acquired) : null

    setItems(prev => prev.map(item => {
      if (!selectedIds.has(item.id)) return item
      const next = { ...item }
      if (resolved.length > 0) {
        const existing = item.tags ?? []
        const existingIds = new Set(existing.map(t => t.id))
        next.tags = [...existing, ...resolved.filter(t => !existingIds.has(t.id))]
      }
      if (acquiredPatch) Object.assign(next, acquiredPatch)
      return next
    }))
    setBatchEditVisible(false)
    setSelectedIds(new Set())

    if (resolved.length > 0) {
      const rows = ids.flatMap(item_id => resolved.map(t => ({ item_id, tag_id: t.id })))
      const { error } = await supabase
        .from('item_tags')
        .upsert(rows, { onConflict: 'item_id,tag_id', ignoreDuplicates: true })
      if (error) console.error('Batch tag error:', error)
    }
    if (acquiredPatch) {
      const { error } = await supabase.from('items').update(acquiredPatch).in('id', ids)
      if (error) console.error('Batch acquired error:', error)
    }
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

  const sortedItems = useMemo(() => {
    const arr = [...items]
    const cmpName = (a, b) => {
      const an = (a.name ?? '').toLowerCase()
      const bn = (b.name ?? '').toLowerCase()
      if (!an && !bn) return 0
      if (!an) return 1
      if (!bn) return -1
      return an.localeCompare(bn)
    }
    const cmpYear = (a, b) => {
      if (a.acquired_year == null && b.acquired_year == null) return 0
      if (a.acquired_year == null) return 1
      if (b.acquired_year == null) return -1
      return a.acquired_year - b.acquired_year
    }
    switch (sortParam) {
      case 'oldest': return arr.sort((a, b) => new Date(a.created_at) - new Date(b.created_at))
      case 'name-asc': return arr.sort(cmpName)
      case 'name-desc': return arr.sort((a, b) => -cmpName(a, b))
      case 'acquired-desc': return arr.sort((a, b) => -cmpYear(a, b))
      case 'acquired-asc': return arr.sort(cmpYear)
      default: return arr.sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
    }
  }, [items, sortParam])

  const query = searchQuery.trim().toLowerCase()
  const fromDate = fromParam ? new Date(fromParam) : null
  const toDate = toParam ? new Date(toParam + 'T23:59:59') : null
  const cityParamLower = cityParam?.toLowerCase() ?? null
  const searchedItems = sortedItems.filter(i => {
    if (query) {
      const name = (i.name ?? '').toLowerCase()
      const desc = (i.description ?? '').toLowerCase()
      const ocr = (i.ocr_text ?? '').toLowerCase()
      const tagNames = (i.tags ?? []).map(t => t.name.toLowerCase())
      if (!(name.includes(query) || desc.includes(query) || ocr.includes(query) || tagNames.some(n => n.includes(query)))) return false
    }
    if (yearParam === 'none') {
      if (i.acquired_year != null) return false
    } else if (yearParam) {
      if (String(i.acquired_year) !== yearParam) return false
    } else if (yearMinParam || yearMaxParam) {
      if (i.acquired_year == null) return false
      if (yearMinParam && i.acquired_year < parseInt(yearMinParam, 10)) return false
      if (yearMaxParam && i.acquired_year > parseInt(yearMaxParam, 10)) return false
    }
    if (cityParam === 'none') {
      if (cityOf(i.acquired_location) != null) return false
    } else if (cityParamLower) {
      const c = cityOf(i.acquired_location)
      if (!c || c.toLowerCase() !== cityParamLower) return false
    }
    if (fromDate || toDate) {
      const t = new Date(i.created_at)
      if (fromDate && t < fromDate) return false
      if (toDate && t > toDate) return false
    }
    return true
  })

  const availableYears = useMemo(() => {
    const set = new Set(items.map(i => i.acquired_year).filter(y => y != null))
    return [...set].sort((a, b) => b - a)
  }, [items])

  const availableCities = useMemo(() => {
    const set = new Set(items.map(i => cityOf(i.acquired_location)).filter(Boolean))
    return [...set].sort((a, b) => a.localeCompare(b))
  }, [items])

  const hasMissingYear = items.some(i => i.acquired_year == null)
  const hasMissingCity = items.some(i => cityOf(i.acquired_location) == null)

  const dateRangeLabel = fromParam || toParam
    ? (fromParam && toParam && fromParam === toParam
        ? `added ${formatDateLabel(fromParam)}`
        : `added ${fromParam ? formatDateLabel(fromParam) : '…'} – ${toParam ? formatDateLabel(toParam) : '…'}`)
    : null

  const yearRangeLabel = !yearParam && (yearMinParam || yearMaxParam)
    ? (yearMinParam && yearMaxParam && yearMinParam === yearMaxParam
        ? `${yearMinParam}`
        : `${yearMinParam ?? '…'}–${yearMaxParam ?? '…'}`)
    : null

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

  if (notFound) {
    return (
      <div className="centered" style={{ flexDirection: 'column', gap: 12 }}>
        <p style={{ color: '#999' }}>no profile at /u/{slug}</p>
        <Link to="/" className="link-btn">things</Link>
      </div>
    )
  }

  async function saveHome(next) {
    setHome(next)
    await supabase
      .from('profiles')
      .update({
        home_location: next?.location ?? null,
        home_lat: next?.lat ?? null,
        home_lng: next?.lng ?? null,
      })
      .eq('user_id', userId)
  }

  async function saveUsername() {
    const trimmed = usernameInput.trim().toLowerCase()
    if (trimmed === (username ?? '')) {
      setEditingUsername(false)
      setUsernameStatus(null)
      return
    }
    if (trimmed === '') {
      // Clear username
      const { error } = await supabase.from('profiles').update({ username: null }).eq('user_id', userId)
      if (!error) setUsername(null)
      setEditingUsername(false)
      setUsernameStatus(null)
      return
    }
    if (!USERNAME_RE.test(trimmed)) {
      setUsernameStatus('invalid')
      return
    }
    const { data: existing } = await supabase
      .from('profiles')
      .select('user_id')
      .ilike('username', trimmed)
      .maybeSingle()
    if (existing && existing.user_id !== userId) {
      setUsernameStatus('taken')
      return
    }
    const { error } = await supabase
      .from('profiles')
      .update({ username: trimmed })
      .eq('user_id', userId)
    if (error) {
      // The reserved-word trigger raises an exception that surfaces here.
      setUsernameStatus(/reserved/i.test(error.message) ? 'reserved' : 'taken')
      return
    }
    setUsername(trimmed)
    setEditingUsername(false)
    setUsernameStatus(null)
    if (UUID_RE.test(slug)) navigate(`/u/${trimmed}`, { replace: true })
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
            >{profileName ?? username ?? userId.split('-')[0]} : {items.length} {items.length === 1 ? 'object' : 'objects'}</h1>
          )}
          {isOwner && (
            editingUsername ? (
              <div className="profile-username-edit">
                <span className="profile-username-at">@</span>
                <input
                  className="profile-username-input"
                  value={usernameInput}
                  onChange={e => {
                    setUsernameInput(e.target.value.toLowerCase())
                    setUsernameStatus(null)
                  }}
                  onBlur={saveUsername}
                  onKeyDown={e => {
                    if (e.key === 'Enter') e.target.blur()
                    if (e.key === 'Escape') {
                      setUsernameInput(username ?? '')
                      setUsernameStatus(null)
                      setEditingUsername(false)
                    }
                  }}
                  placeholder="username"
                  maxLength={20}
                  autoFocus
                />
                {usernameStatus === 'invalid' && <span className="profile-username-msg profile-username-error">3–20 chars, a–z 0–9 _</span>}
                {usernameStatus === 'taken' && <span className="profile-username-msg profile-username-error">taken</span>}
                {usernameStatus === 'reserved' && <span className="profile-username-msg profile-username-error">reserved</span>}
              </div>
            ) : (
              <button
                className="profile-username-btn"
                onClick={() => { setUsernameInput(username ?? ''); setEditingUsername(true) }}
              >{username ? `@${username}` : 'set username'}</button>
            )
          )}
          {!isOwner && username && (
            <p className="profile-username-readonly">@{username}</p>
          )}
          {isOwner ? (
            editingHome ? (
              <div className="profile-home-edit">
                <LocationPicker
                  value={home}
                  onChange={async next => {
                    if (!next) return
                    await saveHome(next)
                    setEditingHome(false)
                  }}
                  placeholder="set your home city"
                />
                <div className="profile-home-edit-actions">
                  {home && (
                    <button
                      className="link-btn"
                      onClick={async () => { await saveHome(null); setEditingHome(false) }}
                    >remove</button>
                  )}
                  <button className="link-btn" onClick={() => setEditingHome(false)}>done</button>
                </div>
              </div>
            ) : (
              <button
                className="profile-home-btn"
                onClick={() => setEditingHome(true)}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                  <circle cx="12" cy="10" r="3" />
                </svg>
                {home?.location ? home.location.split(',')[0] : 'set home city'}
              </button>
            )
          ) : home?.location && (
            <p className="profile-home-readonly">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                <circle cx="12" cy="10" r="3" />
              </svg>
              {home.location.split(',')[0]}
            </p>
          )}
        </div>
        <div className="header-links" style={{ marginTop: 8 }}>
          {isOwner && <Link to="/stats" className="link-btn">stats</Link>}
          <Link to="/" className="link-btn">things</Link>
        </div>
      </header>

      <div className="search-row">
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
        {(availableYears.length > 0 || hasMissingYear) && (
          <FilterDropdown
            ariaLabel="filter by year"
            active={!!yearParam}
            value={yearParam ?? ''}
            onChange={v => updateParams({ year: v || null, yearMin: null, yearMax: null })}
            options={[
              { value: '', label: 'all years' },
              ...(hasMissingYear ? [{ value: 'none', label: 'no year' }] : []),
              ...availableYears.map(y => ({ value: String(y), label: String(y) })),
            ]}
          />
        )}
        {(availableCities.length > 0 || hasMissingCity) && (
          <FilterDropdown
            ariaLabel="filter by city"
            active={!!cityParam}
            value={cityParam ?? ''}
            onChange={v => updateParams({ city: v || null })}
            options={[
              { value: '', label: 'all cities' },
              ...(hasMissingCity ? [{ value: 'none', label: 'no city' }] : []),
              ...availableCities.map(c => ({ value: c, label: c })),
            ]}
          />
        )}
        <FilterDropdown
          ariaLabel="sort"
          active={sortParam !== 'newest'}
          value={sortParam}
          onChange={v => updateParams({ sort: v === 'newest' ? null : v })}
          options={[
            { value: 'newest', label: 'newest' },
            { value: 'oldest', label: 'oldest' },
            { value: 'name-asc', label: 'name a–z' },
            { value: 'name-desc', label: 'name z–a' },
            { value: 'acquired-desc', label: 'acquired (newest)' },
            { value: 'acquired-asc', label: 'acquired (oldest)' },
          ]}
        />
        {yearRangeLabel && (
          <button
            className="filter-select filter-select-active filter-date-chip"
            onClick={() => updateParams({ yearMin: null, yearMax: null })}
            title="clear year range"
          >{yearRangeLabel} ×</button>
        )}
        {dateRangeLabel && (
          <button
            className="filter-select filter-select-active filter-date-chip"
            onClick={() => updateParams({ from: null, to: null })}
            title="clear date filter"
          >{dateRangeLabel} ×</button>
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
        {sortedItems.map(item => {
          const isSelected = selectedIds.has(item.id)
          const visible = visibleItemIds.has(item.id)
          return (
            <div
              key={item.id}
              className={`card${isSelected ? ' card-selected' : ''}${visible ? '' : ' card-hidden'}`}
              onClick={() => isOwner && batchMode ? toggleBatchSelect(item.id) : openItem(item)}
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
              <button className="batch-tag-btn" onClick={() => setBatchEditVisible(true)}>edit</button>
            </div>
          </div>
        ) : (
          <button className="fab" onClick={() => setAddModalVisible(true)}>+</button>
        )
      )}

      <ItemDetailModal
        visible={!!selectedItem}
        item={selectedItem}
        onClose={closeItem}
        onSave={isOwner ? handleUpdate : undefined}
        onDelete={isOwner ? handleDelete : undefined}
        allTags={allTags}
        onTagPress={tag => updateParams({ tag: tag.name, item: null })}
        onPrev={(() => {
          const idx = filteredItems.findIndex(i => i.id === selectedItem?.id)
          return idx > 0 ? () => openItem(filteredItems[idx - 1]) : null
        })()}
        onNext={(() => {
          const idx = filteredItems.findIndex(i => i.id === selectedItem?.id)
          return idx < filteredItems.length - 1 ? () => openItem(filteredItems[idx + 1]) : null
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

          <BatchEditSheet
            visible={batchEditVisible}
            onClose={() => setBatchEditVisible(false)}
            onApply={handleBatchEdit}
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
