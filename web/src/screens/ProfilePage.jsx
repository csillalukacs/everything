import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useParams, useSearchParams, Link, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { fetchAllItems, fetchItemCount } from '../../../shared/itemsApi'
import { cityOf, acquiredFields, thumbOf, imagePathsForItem, isRetired, sameTagSet } from '../../../shared/items'
import { parseQuery, matchItem } from '../../../shared/searchQuery'
import { sortItems, newRandomSeed } from '../../../shared/sortItems'
import { submitReport, blockUser, unblockUser } from '../../../shared/moderation'
import { followUser, unfollowUser, fetchFollowCounts } from '../../../shared/follows'
import { fetchLikedItemIds, addLike, removeLike } from '../../../shared/likesApi'
import { UUID_RE } from '../../../shared/identifiers'
import { formatDateLabel, usageRecencyTier, usageGlowCss } from '../../../shared/dates'
import { S } from '../../../shared/strings'
import { FEATURED_TAG_NAME, isFeaturedTag, sortTagsFeaturedFirst, findFeaturedTag, ensureFeaturedTag } from '../../../shared/featuredTag'
import ItemDetailModal from './ItemDetailModal'
import AddItemModal from './AddItemModal'
import BatchEditSheet from './BatchEditSheet'
import FilterDropdown from './FilterDropdown'
import LockIcon from '../components/LockIcon'
import SearchBar from '../components/SearchBar'
import TagFilterChips from '../components/TagFilterChips'
import { TrashIcon } from '../components/Icons'
import ProfileHeader from '../components/ProfileHeader'
import FollowListModal from './FollowListModal'
import ProfileSheet from './ProfileSheet'
import ManageTagsSheet from './ManageTagsSheet'
import { itemsCacheKey, tagsCacheKey, profileCacheKey, countCacheKey, likesCacheKey } from '../../../shared/cacheKeys'
import { readCache, writeCache } from '../lib/cache'

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
  const explicitSortParam = searchParams.get('sort') || null
  const tagParam = searchParams.get('tag') || null

  const [userId, setUserId] = useState(null)
  const [notFound, setNotFound] = useState(false)
  const [items, setItems] = useState([])
  const [itemCount, setItemCount] = useState(null)
  const [allTags, setAllTags] = useState([])
  const [profileName, setProfileName] = useState(null)
  const [username, setUsername] = useState(null)
  const [avatarUrl, setAvatarUrl] = useState(null)
  const [avatarThumbUrl, setAvatarThumbUrl] = useState(null)
  const [loading, setLoading] = useState(true)
  const [isOwner, setIsOwner] = useState(false)
  const [sessionUserId, setSessionUserId] = useState(null)
  const [isLoggedIn, setIsLoggedIn] = useState(false) // any signed-in viewer (sessionUserId is owner-only)
  const [home, setHome] = useState(null)
  const [selectedIds, setSelectedIds] = useState(new Set())
  const [addModalVisible, setAddModalVisible] = useState(false)
  const [batchEditVisible, setBatchEditVisible] = useState(false)
  const [manageTagsVisible, setManageTagsVisible] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [randomSeed, setRandomSeed] = useState(() => newRandomSeed())
  const [reportingProfile, setReportingProfile] = useState(false)
  const [isBlocked, setIsBlocked] = useState(false)
  const [isFollowing, setIsFollowing] = useState(false)
  const [followCounts, setFollowCounts] = useState({ followers: 0, following: 0 })
  const [followListMode, setFollowListMode] = useState(null)
  const [profileSheetOpen, setProfileSheetOpen] = useState(false)
  const [likedItemIds, setLikedItemIds] = useState(() => new Set())

  const batchMode = selectedIds.size > 0

  const selectedItem = itemIdParam ? (items.find(i => i.id === itemIdParam) ?? null) : null

  // Keep the page scroll position stable around the detail modal. Saving an edit
  // reorders the grid (edited item jumps to the top under the default sort) and
  // would otherwise leave the page scrolled to the top — both while the modal is
  // still open and after it closes. Pin scroll to where it was when the modal
  // opened, restoring on any items change while open and on close.
  const savedScrollRef = useRef(0)
  const prevItemParamRef = useRef(itemIdParam)
  useLayoutEffect(() => {
    const had = prevItemParamRef.current
    prevItemParamRef.current = itemIdParam
    if (!had && itemIdParam) savedScrollRef.current = window.scrollY
    else if (itemIdParam || had) window.scrollTo(0, savedScrollRef.current)
  }, [itemIdParam, items])

  // Retired (graveyard) items are excluded from the active collection; they live in
  // the owner-only graveyard view. selectedItem still resolves against the full list.
  const activeItems = useMemo(() => items.filter(i => !isRetired(i)), [items])
  const retiredItems = useMemo(() => items.filter(isRetired), [items])

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
    if (!tag) updateParams({ tag: 'all' })
    else if (tag.id === '__untagged__') updateParams({ tag: '__untagged__' })
    else if (isFeaturedTag(tag)) updateParams({ tag: null })
    else updateParams({ tag: tag.name })
  }

  const activeTag = useMemo(() => {
    if (tagParam === 'all') return null
    if (tagParam === '__untagged__') return { id: '__untagged__' }
    if (!tagParam || tagParam === FEATURED_TAG_NAME) {
      return findFeaturedTag(allTags)
        ?? findFeaturedTag(items.flatMap(i => i.tags ?? []))
        ?? { id: '__featured__', name: FEATURED_TAG_NAME, is_private: false }
    }
    const fromAll = allTags.find(t => t.name === tagParam)
    if (fromAll) return fromAll
    for (const item of items) {
      const t = (item.tags ?? []).find(t => t.name === tagParam)
      if (t) return t
    }
    return null
  }, [tagParam, allTags, items])

  const defaultSortForContext = isFeaturedTag(activeTag) ? 'random' : 'edited'
  const sortParam = explicitSortParam ?? defaultSortForContext

  useEffect(() => {
    async function load() {
      const slugIsUuid = UUID_RE.test(slug)
      const { data: { session } } = await supabase.auth.getSession()

      // Reset per-profile state so navigating between profiles (e.g. via the
      // following list) doesn't leave the previous profile's data on the new one:
      // the owner UI (settings/stats/bell links, favorites/graveyard entries) and
      // the grid itself. Everything is re-derived below once the slug resolves;
      // the owner fast-path re-seeds the grid from cache in this same run, so
      // returning to our own profile still doesn't flash.
      setIsOwner(false)
      setSessionUserId(null)
      setIsBlocked(false)
      setIsFollowing(false)
      setItems([])
      setAllTags([])
      setItemCount(null)
      setLoading(true)

      // Fast path: if this is our own profile, paint the header + grid from cache
      // before the network resolves the slug, so returning from a sub-page
      // (graveyard/favorites) keeps the header in place instead of flashing white.
      if (session) {
        const cachedProfile = readCache(profileCacheKey(session.user.id))
        const ownsSlug = (slugIsUuid && slug === session.user.id)
          || (cachedProfile?.username && cachedProfile.username.toLowerCase() === slug.toLowerCase())
        if (ownsSlug) {
          if (cachedProfile) {
            setProfileName(cachedProfile.display_name)
            setUsername(cachedProfile.username)
            setAvatarUrl(cachedProfile.avatar_url ?? null)
            setAvatarThumbUrl(cachedProfile.avatar_thumb_url ?? null)
            setHome(cachedProfile.home_location
              ? { location: cachedProfile.home_location, lat: cachedProfile.home_lat, lng: cachedProfile.home_lng }
              : null)
          }
          const cachedItems = readCache(itemsCacheKey(session.user.id))
          const cachedTags = readCache(tagsCacheKey(session.user.id))
          const cachedCount = readCache(countCacheKey(session.user.id))
          const cachedLikes = readCache(likesCacheKey(session.user.id))
          setUserId(session.user.id)
          setIsOwner(true)
          setSessionUserId(session.user.id)
          setIsLoggedIn(true)
          if (cachedItems) setItems(cachedItems)
          if (cachedTags) setAllTags(cachedTags)
          if (cachedCount != null) setItemCount(cachedCount)
          // Seed favorites here too (same moment as items) so the favorites chip
          // count appears in lock-step with the graveyard count.
          if (cachedLikes) setLikedItemIds(new Set(cachedLikes))
          if (cachedItems) setLoading(false)
        }
      }

      let resolvedId = null
      let resolvedProfile = null
      const cols = 'user_id, display_name, username, home_location, home_lat, home_lng, avatar_url, avatar_thumb_url'
      if (slugIsUuid) {
        resolvedId = slug
        const { data } = await supabase
          .from('profiles')
          .select(cols)
          .eq('user_id', slug)
          .maybeSingle()
        resolvedProfile = data
      } else {
        const { data } = await supabase
          .from('profiles')
          .select(cols)
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
        // Preserve the query string (e.g. ?item=… from a notification) across the
        // canonical-username redirect.
        navigate(`/u/${resolvedProfile.username}${window.location.search}`, { replace: true })
        return
      }
      setUserId(resolvedId)
      if (resolvedProfile) {
        setProfileName(resolvedProfile.display_name)
        setUsername(resolvedProfile.username)
        setAvatarUrl(resolvedProfile.avatar_url ?? null)
        setAvatarThumbUrl(resolvedProfile.avatar_thumb_url ?? null)
        setHome(resolvedProfile.home_location
          ? { location: resolvedProfile.home_location, lat: resolvedProfile.home_lat, lng: resolvedProfile.home_lng }
          : null)
      }

      let ownerSession = false
      let blocked = false
      const isOwnerView = session && session.user.id === resolvedId
      // Cache your own profile so collection sub-pages (graveyard, favorites) can
      // render the header from cache instead of flashing the user id while it loads.
      if (isOwnerView && resolvedProfile) writeCache(profileCacheKey(resolvedId), resolvedProfile)
      if (isOwnerView) {
        const cachedItems = readCache(itemsCacheKey(resolvedId))
        const cachedTags = readCache(tagsCacheKey(resolvedId))
        if (cachedItems) setItems(cachedItems)
        if (cachedTags) setAllTags(cachedTags)
        if (cachedItems) setLoading(false)
      }

      if (session) {
        setIsLoggedIn(true)
        const displayName = 'user'
        await supabase.from('profiles').upsert({ user_id: session.user.id, display_name: displayName }, { ignoreDuplicates: true })
        if (session.user.id === resolvedId) {
          ownerSession = true
          setIsOwner(true)
          setSessionUserId(session.user.id)
          const { data: tagsData } = await supabase.from('tags').select('*').eq('user_id', session.user.id).order('name')
          if (tagsData) {
            let next = tagsData
            if (!next.some(isFeaturedTag)) {
              const created = await ensureFeaturedTag(supabase, session.user.id, next)
              if (created) next = [...next, created]
            }
            setAllTags(next)
            writeCache(tagsCacheKey(resolvedId), next)
          }
        } else {
          const { data: blk } = await supabase
            .from('blocks')
            .select('id')
            .eq('blocker_id', session.user.id)
            .eq('blocked_id', resolvedId)
            .maybeSingle()
          blocked = !!blk
          setIsBlocked(blocked)
          if (!blocked) {
            const { data: fol } = await supabase
              .from('follows')
              .select('id')
              .eq('follower_id', session.user.id)
              .eq('followed_id', resolvedId)
              .maybeSingle()
            setIsFollowing(!!fol)
          }
        }
      }

      // Don't fetch a blocked user's things — the profile renders a blocked notice instead.
      if (blocked) {
        setLoading(false)
        return
      }

      const publicOnly = !ownerSession
      fetchItemCount(supabase, { userId: resolvedId, publicOnly })
        .then(c => {
          setItemCount(c)
          // Cache your own count so sub-pages can show "· N things" without a flash.
          if (ownerSession) writeCache(countCacheKey(resolvedId), c)
        })
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

  // Follow counts are shown to signed-in users only; reload when the profile
  // resolves or our follow state toward them changes (following bumps their
  // follower count).
  useEffect(() => {
    if (!userId || !isLoggedIn) return // counts are signed-in only
    let cancelled = false
    fetchFollowCounts(supabase, userId)
      .then(c => { if (!cancelled) setFollowCounts(c) })
      .catch(e => console.error('fetchFollowCounts error:', e))
    return () => { cancelled = true }
  }, [userId, isLoggedIn, isFollowing])

  // The viewer's favorites (for the heart state on this profile's items). Fetched
  // for any signed-in viewer; only matters when viewing someone else's things.
  const [viewerId, setViewerId] = useState(null)
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) { setViewerId(null); setLikedItemIds(new Set()); return }
      setViewerId(session.user.id)
      // Seed from cache so the favorites chip count shows instantly (like the
      // graveyard count), then refresh + rewrite from the network.
      const cached = readCache(likesCacheKey(session.user.id))
      if (cached) setLikedItemIds(new Set(cached))
      fetchLikedItemIds(supabase, session.user.id)
        .then(ids => { setLikedItemIds(new Set(ids)); writeCache(likesCacheKey(session.user.id), ids) })
        .catch(e => console.error('fetchLikedItemIds error:', e))
    })
  }, [slug])

  function handleToggleLike(itemId, next) {
    if (!viewerId) return
    const optimistic = new Set(likedItemIds)
    if (next) optimistic.add(itemId); else optimistic.delete(itemId)
    setLikedItemIds(optimistic)
    writeCache(likesCacheKey(viewerId), [...optimistic])
    ;(async () => {
      try {
        if (next) await addLike(supabase, { userId: viewerId, itemId })
        else await removeLike(supabase, { userId: viewerId, itemId })
      } catch (e) {
        console.error('toggle like error:', e)
        const reverted = new Set(likedItemIds)
        setLikedItemIds(reverted)
        writeCache(likesCacheKey(viewerId), [...reverted])
      }
    })()
  }

  const featuredRedirectCheckedRef = useRef(false)
  useEffect(() => {
    if (loading || featuredRedirectCheckedRef.current) return
    featuredRedirectCheckedRef.current = true
    if (searchParams.get('tag')) return
    const hasFeatured = items.some(i => (i.tags ?? []).some(isFeaturedTag))
    if (!hasFeatured) {
      const next = new URLSearchParams(searchParams)
      next.set('tag', 'all')
      setSearchParams(next, { replace: true })
    }
  }, [loading, items, searchParams, setSearchParams])

  useEffect(() => { featuredRedirectCheckedRef.current = false }, [slug])

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
    } else if (selectedItem && image_url && image_url !== selectedItem.image_url) {
      const match = (selectedItem.previous_images ?? []).find(p => p?.url === image_url)
      if (match) thumb_url = match.thumb_url ?? null
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
    if (!sameTagSet(selectedItem?.tags ?? [], resolved))
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

  async function handleRetire(reason, epitaph) {
    const target = selectedItem
    closeItem()
    const patch = { retired_at: new Date().toISOString(), retire_reason: reason || null, epitaph: epitaph || null }
    const { error } = await supabase.from('items').update(patch).eq('id', target.id)
    if (!error) {
      setItems(prev => prev.map(i => i.id === target.id ? { ...i, ...patch } : i))
      setItemCount(c => (c == null ? null : Math.max(0, c - 1)))
    }
  }

  async function handleResurrect() {
    const target = selectedItem
    closeItem()
    const patch = { retired_at: null, retire_reason: null, epitaph: null }
    const { error } = await supabase.from('items').update(patch).eq('id', target.id)
    if (!error) {
      setItems(prev => prev.map(i => i.id === target.id ? { ...i, ...patch } : i))
      setItemCount(c => (c == null ? null : c + 1))
    }
  }

  async function handleReportProfile(reason) {
    setReportingProfile(false)
    try {
      await submitReport(supabase, { reporterId: sessionUserId, targetType: 'profile', targetId: userId, targetUserId: userId, reason })
    } catch (e) {
      console.error('submitReport error:', e)
    }
    alert(S.moderation.reportThanksBody)
  }

  async function handleBlockProfile() {
    const name = profileName || (username ? `@${username}` : 'this user')
    if (!window.confirm(`${S.moderation.blockConfirmTitle(name)}\n${S.moderation.blockConfirmBody}`)) return
    try {
      await blockUser(supabase, { blockerId: sessionUserId, blockedId: userId })
    } catch (e) {
      console.error('blockUser error:', e)
    }
    setIsBlocked(true)
    setIsFollowing(false)
    closeItem()
    alert(S.moderation.blockedDone(name))
  }

  async function handleToggleFollow() {
    // viewerId is the signed-in viewer (set for any session); sessionUserId is
    // owner-only, so it would be null for the people who'd actually follow.
    if (!viewerId) return
    const next = !isFollowing
    setIsFollowing(next)
    try {
      if (next) await followUser(supabase, { followerId: viewerId, followedId: userId })
      else await unfollowUser(supabase, { followerId: viewerId, followedId: userId })
    } catch (e) {
      console.error('toggle follow error:', e)
      setIsFollowing(!next)
    }
  }

  async function handleUnblockProfile() {
    const name = profileName || (username ? `@${username}` : 'this user')
    if (!window.confirm(`${S.moderation.unblockConfirmTitle(name)}\n${S.moderation.unblockConfirmBody}`)) return
    try {
      await unblockUser(supabase, { blockerId: sessionUserId, blockedId: userId })
    } catch (e) {
      console.error('unblockUser error:', e)
    }
    setIsBlocked(false)
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

  async function handleBatchEdit({ addTags, acquiredPatch, removeTagId }) {
    if (addTags.length === 0 && !acquiredPatch && !removeTagId) { setBatchEditVisible(false); return }
    const resolved = addTags.length > 0 ? await ensureTags(addTags) : []
    if (resolved === null) return
    const ids = [...selectedIds]

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
  activeItems.forEach(item => {
    ;(item.tags ?? []).forEach(tag => {
      if (!tag.is_private) tagMap.set(tag.id, tag)
    })
  })
  const visibleTagsList = [...tagMap.values()]
  if (!visibleTagsList.some(isFeaturedTag)) {
    visibleTagsList.push({ id: '__featured__', name: FEATURED_TAG_NAME, is_private: false })
  }
  const visibleTags = sortTagsFeaturedFirst(visibleTagsList)

  const sortedItems = useMemo(
    () => sortItems(activeItems, sortParam, randomSeed),
    [activeItems, sortParam, randomSeed],
  )

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
    const set = new Set(activeItems.map(i => i.acquired_year).filter(y => y != null))
    return [...set].sort((a, b) => b - a)
  }, [activeItems])

  const availableCities = useMemo(() => {
    const set = new Set(activeItems.map(i => cityOf(i.acquired_location)).filter(Boolean))
    return [...set].sort((a, b) => a.localeCompare(b))
  }, [activeItems])

  const hasMissingYear = activeItems.some(i => i.acquired_year == null)
  const hasMissingCity = activeItems.some(i => cityOf(i.acquired_location) == null)

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
    : isFeaturedTag(activeTag)
      ? searchedItems.filter(i => (i.tags ?? []).some(isFeaturedTag))
      : activeTag
        ? searchedItems.filter(i => (i.tags ?? []).some(t => t.id === activeTag.id))
        : searchedItems
  const visibleItemIds = new Set(filteredItems.map(i => i.id))

  const tagCounts = new Map()
  let untaggedCount = 0
  let featuredCount = 0
  for (const item of searchedItems) {
    const tagsArr = item.tags ?? []
    if (tagsArr.length === 0) untaggedCount++
    for (const t of tagsArr) {
      tagCounts.set(t.id, (tagCounts.get(t.id) ?? 0) + 1)
      if (isFeaturedTag(t)) featuredCount++
    }
  }
  tagCounts.set('__featured__', featuredCount)

  const totalTagCounts = new Map()
  for (const item of activeItems) {
    for (const t of (item.tags ?? [])) totalTagCounts.set(t.id, (totalTagCounts.get(t.id) ?? 0) + 1)
  }

  async function handleRenameTag(tagId, normalized) {
    const { error } = await supabase.from('tags').update({ name: normalized }).eq('id', tagId)
    if (error) return { error }
    setAllTags(prev => prev.map(t => t.id === tagId ? { ...t, name: normalized } : t))
    setItems(prev => prev.map(i => ({
      ...i,
      tags: (i.tags ?? []).map(t => t.id === tagId ? { ...t, name: normalized } : t),
    })))
    return {}
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
      <ProfileHeader
        slug={slug}
        userId={userId}
        profileName={profileName}
        username={username}
        avatarUrl={avatarUrl}
        avatarThumbUrl={avatarThumbUrl}
        home={home}
        itemCount={itemCount}
        isOwner={isOwner}
        isLoggedIn={isLoggedIn}
        viewerId={viewerId}
        onLogOut={async () => { await supabase.auth.signOut(); navigate('/') }}
        sessionUserId={sessionUserId}
        isBlocked={isBlocked}
        isFollowing={isFollowing}
        onToggleFollow={!isOwner && viewerId ? handleToggleFollow : undefined}
        onOpenSheet={isLoggedIn ? () => setProfileSheetOpen(true) : undefined}
      />

      {!isOwner && !isBlocked && reportingProfile && (
        <div className="retire-panel">
          <div className="retire-panel-title">{S.moderation.reportTitle}</div>
          <div className="retire-reason-chips">
            {S.moderation.reasons.map(r => (
              <button key={r.value} type="button" className="chip" onClick={() => handleReportProfile(r.value)}>{r.label}</button>
            ))}
          </div>
          <div className="retire-panel-actions">
            <button className="link-btn" onClick={() => setReportingProfile(false)}>{S.common.cancel}</button>
          </div>
        </div>
      )}

      {isOwner && (
        <div className="collection-entries">
          {retiredItems.length > 0 && (
            <button className="graveyard-entry" onClick={() => navigate('/graveyard')}>
              {S.graveyard.emoji} {S.graveyard.entry} · {retiredItems.length}
            </button>
          )}
          <button className="graveyard-entry" onClick={() => navigate('/favorites')}>
            ♥ {S.favorites.entry}{likedItemIds.size > 0 ? ` · ${likedItemIds.size}` : ''}
          </button>
        </div>
      )}

      {isBlocked ? (
        <div className="blocked-notice">
          <p className="blocked-notice-title">{S.moderation.profileBlocked(profileName || (username ? `@${username}` : 'this user'))}</p>
          <p className="blocked-notice-hint">{S.moderation.profileBlockedHint}</p>
          <button className="link-btn link-btn-dark" onClick={handleUnblockProfile}>{S.moderation.unblock}</button>
        </div>
      ) : (
      <>
      <div className="search-row">
        <SearchBar value={searchQuery} onChange={setSearchQuery} />
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
          active={sortParam !== defaultSortForContext}
          value={sortParam}
          onChange={v => {
            if (v === 'random') setRandomSeed(newRandomSeed())
            updateParams({ sort: v === defaultSortForContext ? null : v })
          }}
          options={[
            { value: 'newest', label: S.filters.sort.newest },
            { value: 'oldest', label: S.filters.sort.oldest },
            { value: 'edited', label: S.filters.sort.lastEdited },
            { value: 'name-asc', label: S.filters.sort.nameAZ },
            { value: 'name-desc', label: S.filters.sort.nameZA },
            { value: 'acquired-desc', label: S.filters.sort.acquiredNewest },
            { value: 'acquired-asc', label: S.filters.sort.acquiredOldest },
            { value: 'used-recent', label: S.filters.sort.usedRecent },
            { value: 'used-often', label: S.filters.sort.usedOften },
            { value: 'random', label: S.filters.sort.random },
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

      <TagFilterChips
        tags={isOwner ? allTags : visibleTags}
        activeTag={activeTag}
        onChangeActiveTag={setActiveTag}
        totalCount={searchedItems.length}
        untaggedCount={untaggedCount}
        tagCounts={tagCounts}
        showUntagged={isOwner}
        onManagePress={isOwner ? () => setManageTagsVisible(true) : undefined}
      />

      <div className="grid">
        {sortedItems.map(item => {
          const isSelected = selectedIds.has(item.id)
          const visible = visibleItemIds.has(item.id)
          const glow = usageGlowCss(usageRecencyTier(item.last_used_on))
          return (
            <div
              key={item.id}
              className={`card${isSelected ? ' card-selected' : ''}${visible ? '' : ' card-hidden'}`}
              style={glow ? { background: glow } : undefined}
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

      {sortedItems.length === 0 && (
        <div className="graveyard-empty">
          <p>{isOwner
            ? (items.length === 0 ? S.collection.emptyOwn : S.common.noMatches)
            : S.profileView.nothingPublic}</p>
        </div>
      )}

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
                <TrashIcon size={18} color="#E53935" />
              </button>
              <button className="batch-tag-btn" onClick={() => setBatchEditVisible(true)}>{S.common.edit}</button>
            </div>
          </div>
          )
        })() : (
          <button className="fab" onClick={() => setAddModalVisible(true)}>+</button>
        )
      )}
      </>
      )}

      <ItemDetailModal
        visible={!!selectedItem}
        item={selectedItem}
        onClose={closeItem}
        onSave={isOwner ? handleUpdate : undefined}
        onDelete={isOwner ? handleDelete : undefined}
        onRetire={isOwner ? handleRetire : undefined}
        onResurrect={isOwner ? handleResurrect : undefined}
        sessionUserId={sessionUserId}
        liked={selectedItem ? likedItemIds.has(selectedItem.id) : false}
        onToggleLike={!isOwner && viewerId ? handleToggleLike : undefined}
        onBlocked={() => setIsBlocked(true)}
        onUsageChange={(id, patch) => setItems(prev => prev.map(i => i.id === id ? { ...i, ...patch } : i))}
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

          <ManageTagsSheet
            visible={manageTagsVisible}
            onClose={() => setManageTagsVisible(false)}
            tags={allTags}
            totalTagCounts={totalTagCounts}
            onRename={handleRenameTag}
            onDelete={handleDeleteTag}
            onToggleTagPrivacy={handleToggleTagPrivacy}
          />
        </>
      )}

      <ProfileSheet
        visible={profileSheetOpen}
        onClose={() => setProfileSheetOpen(false)}
        profile={{ user_id: userId, display_name: profileName, username, avatar_url: avatarUrl, avatar_thumb_url: avatarThumbUrl }}
        counts={followCounts}
        isOwn={isOwner}
        isFollowing={isFollowing}
        isBlocked={isBlocked}
        onToggleFollow={viewerId ? handleToggleFollow : undefined}
        onReport={() => { setProfileSheetOpen(false); setReportingProfile(true) }}
        onBlock={() => { setProfileSheetOpen(false); handleBlockProfile() }}
        onUnblock={() => { setProfileSheetOpen(false); handleUnblockProfile() }}
        onShowFollows={mode => { setProfileSheetOpen(false); setFollowListMode(mode) }}
      />

      <FollowListModal
        visible={!!followListMode}
        userId={userId}
        mode={followListMode}
        onClose={() => setFollowListMode(null)}
      />
    </div>
  )
}
