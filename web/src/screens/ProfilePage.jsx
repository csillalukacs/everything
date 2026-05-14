import { useEffect, useMemo, useRef, useState } from 'react'
import { useParams, useSearchParams, Link, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { fetchAllItems, fetchItemCount } from '../../../shared/itemsApi'
import { cityOf, acquiredFields, thumbOf, imagePathsForItem } from '../../../shared/items'
import { parseQuery, matchItem } from '../../../shared/searchQuery'
import { UUID_RE } from '../../../shared/identifiers'
import { formatDateLabel } from '../../../shared/dates'
import { S } from '../../../shared/strings'
import ItemDetailModal from './ItemDetailModal'
import AddItemModal from './AddItemModal'
import BatchEditSheet from './BatchEditSheet'
import FilterDropdown from './FilterDropdown'
import LockIcon from '../components/LockIcon'

const itemsCacheKey = userId => `cache:items:${userId}`
const tagsCacheKey = userId => `cache:tags:${userId}`

function readCache(key) {
  try { const raw = localStorage.getItem(key); return raw ? JSON.parse(raw) : null } catch { return null }
}
function writeCache(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)) } catch { /* quota or disabled — ignore */ }
}

function SettingsIcon({ size = 16, color = 'currentColor' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  )
}

function PencilIcon({ size = 14, color = 'currentColor' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
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
  const [itemCount, setItemCount] = useState(null)
  const [allTags, setAllTags] = useState([])
  const [profileName, setProfileName] = useState(null)
  const [username, setUsername] = useState(null)
  const [loading, setLoading] = useState(true)
  const [isOwner, setIsOwner] = useState(false)
  const [sessionUserId, setSessionUserId] = useState(null)
  const [home, setHome] = useState(null)
  const [selectedIds, setSelectedIds] = useState(new Set())
  const [addModalVisible, setAddModalVisible] = useState(false)
  const [batchEditVisible, setBatchEditVisible] = useState(false)
  const [manageTagsVisible, setManageTagsVisible] = useState(false)
  const [manageTagSearch, setManageTagSearch] = useState('')
  const [renamingTagId, setRenamingTagId] = useState(null)
  const [renameDraft, setRenameDraft] = useState('')
  const [renameError, setRenameError] = useState(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchHelpOpen, setSearchHelpOpen] = useState(false)
  const searchHelpRef = useRef(null)

  useEffect(() => {
    if (!searchHelpOpen) return
    function onDocClick(e) {
      if (searchHelpRef.current && !searchHelpRef.current.contains(e.target)) {
        setSearchHelpOpen(false)
      }
    }
    function onKey(e) { if (e.key === 'Escape') setSearchHelpOpen(false) }
    document.addEventListener('mousedown', onDocClick)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDocClick)
      document.removeEventListener('keydown', onKey)
    }
  }, [searchHelpOpen])

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
        const displayName = 'user'
        await supabase.from('profiles').upsert({ user_id: session.user.id, display_name: displayName }, { ignoreDuplicates: true })
        if (session.user.id === resolvedId) {
          ownerSession = true
          setIsOwner(true)
          setSessionUserId(session.user.id)
          const { data: tagsData } = await supabase.from('tags').select('*').eq('user_id', session.user.id).order('name')
          if (tagsData) {
            setAllTags(tagsData)
            writeCache(tagsCacheKey(resolvedId), tagsData)
          }
        }
      }

      const publicOnly = !ownerSession
      fetchItemCount(supabase, { userId: resolvedId, publicOnly })
        .then(setItemCount)
        .catch(e => console.error('fetchItemCount error:', e))

      try {
        const fetchedItems = await fetchAllItems(supabase, { userId: resolvedId, publicOnly })
        setItems(fetchedItems)
        if (ownerSession) writeCache(itemsCacheKey(resolvedId), fetchedItems)
      } catch (e) {
        console.error('fetchAllItems error:', e)
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

  async function makeThumbnail(file, maxW = 400) {
    try {
      const bitmap = await createImageBitmap(file)
      const scale = Math.min(1, maxW / bitmap.width)
      const w = Math.round(bitmap.width * scale)
      const h = Math.round(bitmap.height * scale)
      const canvas = document.createElement('canvas')
      canvas.width = w
      canvas.height = h
      canvas.getContext('2d').drawImage(bitmap, 0, 0, w, h)
      return await new Promise(resolve => canvas.toBlob(resolve, 'image/webp', 0.85))
    } catch (e) {
      console.warn('Thumbnail generation failed:', e)
      return null
    }
  }

  async function uploadImage(file) {
    const ext = (file.name.split('.').pop() || 'jpg').toLowerCase()
    const thumbBlob = await makeThumbnail(file)

    const { data: presign, error: presignErr } = await supabase.functions.invoke('r2-presign', {
      body: { ext, contentType: file.type },
    })
    if (presignErr || !presign) { console.error('Presign error:', presignErr); return null }
    const { main, thumb, cacheControl } = presign

    const mainRes = await fetch(main.uploadUrl, {
      method: 'PUT',
      body: file,
      headers: { 'Content-Type': file.type, 'Cache-Control': cacheControl },
    })
    if (!mainRes.ok) { console.error('Main upload failed:', mainRes.status); return null }

    let thumb_url = null
    if (thumbBlob) {
      const thumbRes = await fetch(thumb.uploadUrl, {
        method: 'PUT',
        body: thumbBlob,
        headers: { 'Content-Type': 'image/webp', 'Cache-Control': cacheControl },
      })
      if (thumbRes.ok) thumb_url = thumb.publicUrl
      else console.warn('Thumb upload failed:', thumbRes.status)
    }
    return { image_url: main.publicUrl, thumb_url }
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

  async function handleSave(name, file, tagNames, isPrivate, description, acquired, uploadPromise) {
    const uploaded = await (uploadPromise ?? uploadImage(file))
    if (!uploaded) return
    const { image_url, thumb_url } = uploaded
    const { data, error } = await supabase
      .from('items')
      .insert({
        name: name || null,
        description: description || null,
        image_url,
        thumb_url,
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
    setItemCount(c => (c == null ? null : c + 1))
    setAddModalVisible(false)
  }

  async function handleUpdate(name, photoOrFile, tagNames, isPrivate, description, acquired, previousImages, imageAddedAt) {
    let image_url = typeof photoOrFile === 'string' ? photoOrFile : null
    let thumb_url = selectedItem?.thumb_url ?? null
    const isNewPhoto = photoOrFile instanceof File
    if (isNewPhoto) {
      const uploaded = await uploadImage(photoOrFile)
      if (!uploaded) return
      image_url = uploaded.image_url
      thumb_url = uploaded.thumb_url
    }
    const { data, error } = await supabase
      .from('items')
      .update({
        name: name || null,
        description: description || null,
        image_url,
        thumb_url,
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

  async function deleteStorageForItems(itemsToDelete) {
    const paths = itemsToDelete.flatMap(imagePathsForItem)
    if (paths.length === 0) return
    const { error } = await supabase.functions.invoke('r2-delete', { body: { paths } })
    if (error) console.warn('R2 delete failed (orphans left for cleanup):', error)
  }

  async function handleDelete() {
    const itemToDelete = selectedItem
    closeItem()
    const { error } = await supabase.from('items').delete().eq('id', itemToDelete.id)
    if (!error) {
      setItems(prev => prev.filter(i => i.id !== itemToDelete.id))
      setItemCount(c => (c == null ? null : Math.max(0, c - 1)))
      deleteStorageForItems([itemToDelete])
    }
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

  async function handleBatchEdit({ addTags, acquired, removeTagId }) {
    if (addTags.length === 0 && !acquired && !removeTagId) { setBatchEditVisible(false); return }
    const resolved = addTags.length > 0 ? await ensureTags(addTags) : []
    if (resolved === null) return
    const ids = [...selectedIds]
    const acquiredPatch = acquired ? acquiredFields(acquired) : null

    setItems(prev => prev.map(item => {
      if (!selectedIds.has(item.id)) return item
      const next = { ...item }
      let nextTags = item.tags ?? []
      if (removeTagId) nextTags = nextTags.filter(t => t.id !== removeTagId)
      if (resolved.length > 0) {
        const existingIds = new Set(nextTags.map(t => t.id))
        nextTags = [...nextTags, ...resolved.filter(t => !existingIds.has(t.id))]
      }
      if (removeTagId || resolved.length > 0) next.tags = nextTags
      if (acquiredPatch) Object.assign(next, acquiredPatch)
      return next
    }))
    setBatchEditVisible(false)
    setSelectedIds(new Set())

    if (removeTagId) {
      const { error } = await supabase
        .from('item_tags')
        .delete()
        .eq('tag_id', removeTagId)
        .in('item_id', ids)
      if (error) console.error('Batch remove tag error:', error)
    }
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
    const targets = items.filter(i => ids.includes(i.id))
    setSelectedIds(new Set())
    await supabase.from('item_tags').delete().in('item_id', ids)
    const { error } = await supabase.from('items').delete().in('id', ids)
    if (!error) {
      setItems(prev => prev.filter(i => !ids.includes(i.id)))
      setItemCount(c => (c == null ? null : Math.max(0, c - ids.length)))
      if (targets.length > 0) deleteStorageForItems(targets)
    }
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
      case 'edited': return arr.sort((a, b) => new Date(b.updated_at ?? b.created_at) - new Date(a.updated_at ?? a.created_at))
      case 'name-asc': return arr.sort(cmpName)
      case 'name-desc': return arr.sort((a, b) => -cmpName(a, b))
      case 'acquired-desc': return arr.sort((a, b) => -cmpYear(a, b))
      case 'acquired-asc': return arr.sort(cmpYear)
      default: return arr.sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
    }
  }, [items, sortParam])

  const queryAst = useMemo(() => parseQuery(searchQuery), [searchQuery])
  const fromDate = fromParam ? new Date(fromParam) : null
  const toDate = toParam ? new Date(toParam + 'T23:59:59') : null
  const cityParamLower = cityParam?.toLowerCase() ?? null
  const searchedItems = sortedItems.filter(i => {
    if (!matchItem(i, queryAst)) return false
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
        ? S.filters.addedOn(formatDateLabel(fromParam))
        : S.filters.addedRange(fromParam ? formatDateLabel(fromParam) : null, toParam ? formatDateLabel(toParam) : null))
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

  function cancelRenameTag() {
    setRenamingTagId(null)
    setRenameDraft('')
    setRenameError(null)
  }

  function startRenameTag(tag) {
    setRenamingTagId(tag.id)
    setRenameDraft(tag.name)
    setRenameError(null)
  }

  async function commitRenameTag(tag) {
    const normalized = renameDraft.trim().toLowerCase()
    if (!normalized || normalized === tag.name) { cancelRenameTag(); return }
    if (allTags.some(t => t.id !== tag.id && t.name === normalized)) {
      setRenameError(S.collection.tagNameTaken)
      return
    }
    const { error } = await supabase.from('tags').update({ name: normalized }).eq('id', tag.id)
    if (error) { setRenameError(S.collection.tagNameTaken); return }
    setAllTags(prev => prev.map(t => t.id === tag.id ? { ...t, name: normalized } : t))
    setItems(prev => prev.map(i => ({
      ...i,
      tags: (i.tags ?? []).map(t => t.id === tag.id ? { ...t, name: normalized } : t),
    })))
    cancelRenameTag()
  }

  function closeManageTags() {
    setManageTagsVisible(false)
    setManageTagSearch('')
    cancelRenameTag()
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
        <p style={{ color: '#999' }}>{S.profileView.notFound(slug)}</p>
        <Link to="/" className="link-btn">{S.appName}</Link>
      </div>
    )
  }

  return (
    <div className="app">
      <header className="header">
        <div>
          <div className="profile-name-row">
            <h1 className="profile-name">{profileName ?? username ?? userId.split('-')[0]}{itemCount != null ? ` · ${S.profile.objectCount(itemCount)}` : ''}</h1>
          </div>
          {username && <p className="profile-username-readonly">@{username}</p>}
          {home?.location && (
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
          {isOwner && <Link to="/settings" className="link-btn">{S.profile.settings}</Link>}
          {isOwner && <Link to="/stats" className="link-btn">{S.stats.title}</Link>}
          <Link to="/" className="link-btn">{S.appName}</Link>
        </div>
      </header>

      <div className="search-row">
        <div className="search-container" ref={searchHelpRef}>
          <svg className="search-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#999" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <circle cx="11" cy="11" r="7" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            type="text"
            className="search-input"
            placeholder={S.common.search}
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
          />
          {searchQuery && (
            <button className="search-clear" onClick={() => setSearchQuery('')} aria-label={S.a11y.clearSearch}>×</button>
          )}
          <button
            type="button"
            className={`search-help-button${searchHelpOpen ? ' search-help-button-active' : ''}`}
            onClick={() => setSearchHelpOpen(v => !v)}
            aria-label={S.a11y.searchHelp}
            aria-expanded={searchHelpOpen}
          >?</button>
          {searchHelpOpen && (
            <div className="search-help-popover" role="dialog" aria-label={S.searchHelp.title}>
              <div className="search-help-title">{S.searchHelp.title}</div>
              <div className="search-help-intro">{S.searchHelp.intro}</div>
              <ul className="search-help-list">
                {S.searchHelp.examples.map(ex => (
                  <li key={ex.code}>
                    <button
                      type="button"
                      className="search-help-code"
                      onClick={() => {
                        setSearchQuery(ex.code)
                        setSearchHelpOpen(false)
                      }}
                    >{ex.code}</button>
                    <span className="search-help-desc">{ex.desc}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
        {(availableYears.length > 0 || hasMissingYear) && (
          <FilterDropdown
            ariaLabel={S.a11y.filterByYear}
            active={!!yearParam}
            value={yearParam ?? ''}
            onChange={v => updateParams({ year: v || null, yearMin: null, yearMax: null })}
            options={[
              { value: '', label: S.filters.allYears },
              ...(hasMissingYear ? [{ value: 'none', label: S.collection.noYear }] : []),
              ...availableYears.map(y => ({ value: String(y), label: String(y) })),
            ]}
          />
        )}
        {(availableCities.length > 0 || hasMissingCity) && (
          <FilterDropdown
            ariaLabel={S.a11y.filterByCity}
            active={!!cityParam}
            value={cityParam ?? ''}
            onChange={v => updateParams({ city: v || null })}
            options={[
              { value: '', label: S.filters.allCities },
              ...(hasMissingCity ? [{ value: 'none', label: S.collection.noCity }] : []),
              ...availableCities.map(c => ({ value: c, label: c })),
            ]}
          />
        )}
        <FilterDropdown
          ariaLabel={S.a11y.sort}
          active={sortParam !== 'newest'}
          value={sortParam}
          onChange={v => updateParams({ sort: v === 'newest' ? null : v })}
          options={[
            { value: 'newest', label: S.filters.sort.newest },
            { value: 'oldest', label: S.filters.sort.oldest },
            { value: 'edited', label: S.filters.sort.lastEdited },
            { value: 'name-asc', label: S.filters.sort.nameAZ },
            { value: 'name-desc', label: S.filters.sort.nameZA },
            { value: 'acquired-desc', label: S.filters.sort.acquiredNewest },
            { value: 'acquired-asc', label: S.filters.sort.acquiredOldest },
          ]}
        />
        {yearRangeLabel && (
          <button
            className="filter-select filter-select-active filter-date-chip"
            onClick={() => updateParams({ yearMin: null, yearMax: null })}
            title={S.a11y.clearYearRange}
          >{yearRangeLabel} ×</button>
        )}
        {dateRangeLabel && (
          <button
            className="filter-select filter-select-active filter-date-chip"
            onClick={() => updateParams({ from: null, to: null })}
            title={S.a11y.clearDateFilter}
          >{dateRangeLabel} ×</button>
        )}
      </div>

      {isOwner ? (
        allTags.length > 0 && (
          <div className="filter-row">
            <div className="filter-scroll">
              <button className={`chip${!activeTag ? ' chip-active' : ''}`} onClick={() => setActiveTag(null)}>{S.common.all}<span className="chip-count">{searchedItems.length}</span></button>
              <button
                className={`chip${activeTag?.id === '__untagged__' ? ' chip-active' : ''}`}
                onClick={() => setActiveTag(activeTag?.id === '__untagged__' ? null : { id: '__untagged__' })}
              >{S.collection.untagged}<span className="chip-count">{untaggedCount}</span></button>
              {allTags.map(tag => (
                <button
                  key={tag.id}
                  className={`chip${activeTag?.id === tag.id ? ' chip-active' : ''}`}
                  onClick={() => setActiveTag(activeTag?.id === tag.id ? null : tag)}
                >{tag.is_private && <LockIcon size={10} color="currentColor" />}{tag.name}<span className="chip-count">{tagCounts.get(tag.id) ?? 0}</span></button>
              ))}
            </div>
            <button className="chip filter-manage-btn" onClick={() => setManageTagsVisible(true)} aria-label={S.common.manage}><SettingsIcon size={18} color="#999" /></button>
          </div>
        )
      ) : (
        visibleTags.length > 0 && (
          <div className="filter-scroll">
            <button className={`chip${!activeTag ? ' chip-active' : ''}`} onClick={() => setActiveTag(null)}>{S.common.all}<span className="chip-count">{searchedItems.length}</span></button>
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
              {item.image_url && <img src={thumbOf(item)} alt={item.name || ''} loading="lazy" />}
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
        batchMode ? (() => {
          const allVisibleSelected = filteredItems.length > 0 && filteredItems.every(i => selectedIds.has(i.id))
          const toggleSelectAllVisible = () => {
            setSelectedIds(prev => {
              const next = new Set(prev)
              if (allVisibleSelected) filteredItems.forEach(i => next.delete(i.id))
              else filteredItems.forEach(i => next.add(i.id))
              return next
            })
          }
          return (
          <div className="batch-bar">
            <button className="batch-cancel" onClick={() => setSelectedIds(new Set())}>{S.common.cancel}</button>
            <button className="batch-cancel" onClick={toggleSelectAllVisible}>{allVisibleSelected ? S.common.deselectAll : S.common.selectAll}</button>
            <span className="batch-count">{S.batchEdit.selectedCount(selectedIds.size)}</span>
            <div className="batch-actions">
              <button className="batch-icon-btn" onClick={handleBatchTogglePrivacy} title={S.a11y.lockUnlock}>
                <LockIcon size={18} color="#fff" open={![...selectedIds].every(id => items.find(i => i.id === id)?.is_private)} />
              </button>
              <button className="batch-icon-btn batch-delete-btn" onClick={handleBatchDelete} title={S.common.delete}>
                <TrashIcon size={18} color="#ff6b6b" />
              </button>
              <button className="batch-tag-btn" onClick={() => setBatchEditVisible(true)}>{S.common.edit}</button>
            </div>
          </div>
          )
        })() : (
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
        items={items}
        onTagPress={tag => updateParams({ tag: tag.name, item: null })}
        onYearPress={year => updateParams({ year: String(year), yearMin: null, yearMax: null, city: null, tag: null, from: null, to: null, item: null })}
        onCityPress={city => updateParams({ city, year: null, yearMin: null, yearMax: null, tag: null, from: null, to: null, item: null })}
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
            onUpload={uploadImage}
            allTags={allTags}
            items={items}
          />

          <BatchEditSheet
            visible={batchEditVisible}
            onClose={() => setBatchEditVisible(false)}
            onApply={handleBatchEdit}
            allTags={allTags}
            items={items}
            selectedCount={selectedIds.size}
            activeTag={activeTag}
          />

          {manageTagsVisible && (
            <div className="sheet-overlay" onClick={closeManageTags}>
              <div className="sheet sheet-manage-tags" onClick={e => e.stopPropagation()}>
                <div className="modal-header">
                  <span className="sheet-title">{S.collection.manageTags(allTags.length)}</span>
                  <button className="link-btn" onClick={closeManageTags}>{S.common.done}</button>
                </div>
                <div className="search-container manage-tag-search">
                  <svg className="search-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#999" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                    <circle cx="11" cy="11" r="7" />
                    <line x1="21" y1="21" x2="16.65" y2="16.65" />
                  </svg>
                  <input
                    type="text"
                    className="search-input"
                    placeholder={S.collection.searchTags}
                    value={manageTagSearch}
                    onChange={e => setManageTagSearch(e.target.value)}
                    autoFocus
                  />
                  {manageTagSearch && (
                    <button className="search-clear" onClick={() => setManageTagSearch('')} aria-label={S.a11y.clearSearch}>×</button>
                  )}
                </div>
                <div className="manage-tag-list">
                  {manageTagsList.length === 0
                    ? <p className="manage-tags-empty">{allTags.length === 0 ? S.collection.noTagsYet : S.common.noMatches}</p>
                    : manageTagsList.map(tag => {
                      const isRenaming = renamingTagId === tag.id
                      return (
                        <div key={tag.id} className="manage-tag-row">
                          <div className="manage-tag-info">
                            {isRenaming ? (
                              <input
                                type="text"
                                className={`manage-tag-rename-input${renameError ? ' manage-tag-rename-input-error' : ''}`}
                                value={renameDraft}
                                onChange={e => { setRenameDraft(e.target.value); if (renameError) setRenameError(null) }}
                                onKeyDown={e => {
                                  if (e.key === 'Enter') commitRenameTag(tag)
                                  else if (e.key === 'Escape') cancelRenameTag()
                                }}
                                onBlur={() => commitRenameTag(tag)}
                                autoFocus
                              />
                            ) : (
                              <span className="manage-tag-name">{tag.name}</span>
                            )}
                            {!isRenaming && (
                              <span className="manage-tag-count">{totalTagCounts.get(tag.id) ?? 0}</span>
                            )}
                            {isRenaming && renameError && (
                              <span className="manage-tag-rename-error">{renameError}</span>
                            )}
                          </div>
                          <div className="manage-tag-actions">
                            {isRenaming ? (
                              <button className="link-btn" onMouseDown={e => e.preventDefault()} onClick={cancelRenameTag}>{S.common.cancel}</button>
                            ) : (
                              <>
                                <button
                                  className="manage-tag-lock"
                                  onClick={() => startRenameTag(tag)}
                                  title={S.common.rename}
                                >
                                  <PencilIcon size={14} color="#2D2D2D" />
                                </button>
                                <button
                                  className={`manage-tag-lock${tag.is_private ? ' manage-tag-lock-on' : ''}`}
                                  onClick={() => handleToggleTagPrivacy(tag)}
                                  title={tag.is_private ? S.a11y.makePublic : S.a11y.makePrivate}
                                >
                                  <LockIcon size={14} color={tag.is_private ? '#2D2D2D' : '#ccc'} open={!tag.is_private} />
                                </button>
                                <button className="manage-tag-delete" onClick={() => handleDeleteTag(tag)}>{S.common.delete}</button>
                              </>
                            )}
                          </div>
                        </div>
                      )
                    })
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
