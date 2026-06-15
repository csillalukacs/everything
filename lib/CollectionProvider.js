import AsyncStorage from '@react-native-async-storage/async-storage';
import { readAsStringAsync, EncodingType } from 'expo-file-system/legacy';
import { decode } from 'base64-arraybuffer';
import { Image } from 'expo-image';
import { Skia, ImageFormat } from '@shopify/react-native-skia';
import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { supabase } from './supabase';
import { fetchAllItems, fetchItemCount } from '../shared/itemsApi';
import { recordUsage, removeUsage } from '../shared/usagesApi';
import { acquiredFields, imagePathFromUrl, imagePathsForItem, thumbOf, isRetired } from '../shared/items';
import { dayKey } from '../shared/dates';
import { itemsCacheKey, tagsCacheKey } from '../shared/cacheKeys';
import { ensureFeaturedTag, isFeaturedTag } from '../shared/featuredTag';
import { fetchBlockedIds, blockUser, unblockUser, submitReport } from '../shared/moderation';
import { fetchFollowingIds, followUser, unfollowUser } from '../shared/follows';
import { fetchUnreadNotificationCount, markNotificationsRead } from '../shared/notifications';
import { AppState } from 'react-native';

const CollectionContext = createContext(null);

export function CollectionProvider({ children }) {
  const [session, setSession] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [items, setItems] = useState([]);
  const [itemCount, setItemCount] = useState(null);
  const [itemsLoading, setItemsLoading] = useState(true);
  const [tags, setTags] = useState([]);
  const [profile, setProfile] = useState(null);
  const [batchModeActive, setBatchModeActive] = useState(false);
  const [blockedIds, setBlockedIds] = useState(() => new Set());
  const [followingIds, setFollowingIds] = useState(() => new Set());
  const [unreadNotifications, setUnreadNotifications] = useState(0);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setAuthLoading(false);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!session) {
      setItems([]);
      setItemCount(null);
      setItemsLoading(false);
      setTags([]);
      setProfile(null);
      setBlockedIds(new Set());
      setFollowingIds(new Set());
      setUnreadNotifications(0);
      return;
    }
    let cancelled = false;
    setItemsLoading(true);
    (async () => {
      const [itemsStr, tagsStr] = await Promise.all([
        AsyncStorage.getItem(itemsCacheKey(session.user.id)),
        AsyncStorage.getItem(tagsCacheKey(session.user.id)),
      ]);
      if (cancelled) return;
      const cachedItems = itemsStr ? JSON.parse(itemsStr) : [];
      setItems(cachedItems);
      setItemCount(cachedItems.filter(i => !isRetired(i)).length || null);
      setTags(tagsStr ? JSON.parse(tagsStr) : []);
      fetchItems(session.user.id).finally(() => {
        if (!cancelled) setItemsLoading(false);
      });
      refreshItemCount(session.user.id);
      fetchTags(session.user.id);
      fetchProfile(session.user.id);
      fetchBlockedIds(supabase, session.user.id)
        .then(ids => { if (!cancelled) setBlockedIds(new Set(ids)); })
        .catch(e => console.error('fetchBlockedIds error:', e));
      fetchFollowingIds(supabase, session.user.id)
        .then(ids => { if (!cancelled) setFollowingIds(new Set(ids)); })
        .catch(e => console.error('fetchFollowingIds error:', e));
      fetchUnreadNotificationCount(supabase, session.user.id)
        .then(n => { if (!cancelled) setUnreadNotifications(n); })
        .catch(e => console.error('fetchUnreadNotificationCount error:', e));
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session]);

  // Notifications aren't real-time; refresh the unread count whenever the app
  // returns to the foreground so the bell badge stays roughly current.
  useEffect(() => {
    if (!session) return;
    const sub = AppState.addEventListener('change', state => {
      if (state === 'active') refreshNotifications();
    });
    return () => sub.remove();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session]);

  async function refreshNotifications() {
    if (!session) return;
    try {
      setUnreadNotifications(await fetchUnreadNotificationCount(supabase, session.user.id));
    } catch (e) {
      console.error('refreshNotifications error:', e);
    }
  }

  // Mark everything read (called when the notifications screen opens) and clear the badge.
  async function readNotifications() {
    if (!session) return;
    setUnreadNotifications(0);
    try {
      await markNotificationsRead(supabase, session.user.id);
    } catch (e) {
      console.error('readNotifications error:', e);
    }
  }

  async function fetchProfile(uid) {
    const { data } = await supabase
      .from('profiles')
      .select('display_name, username, avatar_url, avatar_thumb_url')
      .eq('user_id', uid)
      .maybeSingle();
    setProfile(data ?? null);
  }

  async function updateProfile(patch) {
    if (!session) return null;
    const { data, error } = await supabase
      .from('profiles')
      .update(patch)
      .eq('user_id', session.user.id)
      .select('display_name, username, avatar_url, avatar_thumb_url')
      .single();
    if (error) return { error };
    setProfile(data);
    return { data };
  }

  async function blockContent(blockedId) {
    if (!session || !blockedId || blockedId === session.user.id) return;
    setBlockedIds(prev => new Set(prev).add(blockedId));
    // Blocking removes any follow in either direction (enforced in the DB too);
    // drop our outgoing follow from local state immediately.
    setFollowingIds(prev => {
      if (!prev.has(blockedId)) return prev;
      const next = new Set(prev);
      next.delete(blockedId);
      return next;
    });
    try {
      await blockUser(supabase, { blockerId: session.user.id, blockedId });
    } catch (e) {
      console.error('blockContent error:', e);
    }
  }

  async function followContent(followedId) {
    if (!session || !followedId || followedId === session.user.id) return;
    setFollowingIds(prev => new Set(prev).add(followedId));
    try {
      await followUser(supabase, { followerId: session.user.id, followedId });
    } catch (e) {
      console.error('followContent error:', e);
      setFollowingIds(prev => {
        const next = new Set(prev);
        next.delete(followedId);
        return next;
      });
    }
  }

  async function unfollowContent(followedId) {
    if (!session || !followedId) return;
    setFollowingIds(prev => {
      const next = new Set(prev);
      next.delete(followedId);
      return next;
    });
    try {
      await unfollowUser(supabase, { followerId: session.user.id, followedId });
    } catch (e) {
      console.error('unfollowContent error:', e);
    }
  }

  async function unblockContent(blockedId) {
    if (!session || !blockedId) return;
    setBlockedIds(prev => {
      const next = new Set(prev);
      next.delete(blockedId);
      return next;
    });
    try {
      await unblockUser(supabase, { blockerId: session.user.id, blockedId });
    } catch (e) {
      console.error('unblockContent error:', e);
    }
  }

  async function reportContent({ targetType, targetId, targetUserId, reason }) {
    if (!session) return;
    try {
      await submitReport(supabase, { reporterId: session.user.id, targetType, targetId, targetUserId, reason });
    } catch (e) {
      console.error('reportContent error:', e);
    }
  }

  useEffect(() => {
    if (!session) return;
    AsyncStorage.setItem(itemsCacheKey(session.user.id), JSON.stringify(items));
  }, [items, session]);

  useEffect(() => {
    if (!session) return;
    AsyncStorage.setItem(tagsCacheKey(session.user.id), JSON.stringify(tags));
  }, [tags, session]);

  async function fetchItems(uid) {
    try {
      const data = await fetchAllItems(supabase, { userId: uid });
      setItems(data);
      const urls = data.map(thumbOf).filter(Boolean);
      if (urls.length) Image.prefetch(urls, { cachePolicy: 'memory-disk' });
    } catch (e) {
      console.error('fetchItems error:', e);
    }
  }

  async function refreshItemCount(uid) {
    try {
      const c = await fetchItemCount(supabase, { userId: uid });
      setItemCount(c);
    } catch (e) {
      console.error('fetchItemCount error:', e);
    }
  }

  async function fetchTags(uid) {
    const { data, error } = await supabase
      .from('tags')
      .select('*')
      .eq('user_id', uid)
      .order('name');
    if (error) return;
    let next = data;
    if (!next.some(isFeaturedTag)) {
      const created = await ensureFeaturedTag(supabase, uid, next);
      if (created) next = [...next, created];
    }
    setTags(next);
  }

  const refresh = useCallback(async () => {
    if (!session) return;
    const uid = session.user.id;
    await Promise.all([
      fetchItems(uid),
      refreshItemCount(uid),
      fetchTags(uid),
      fetchProfile(uid),
    ]);
  }, [session]);

  const ensureTags = useCallback(async (tagNames) => {
    const lowered = [...new Set(tagNames.map(n => n.trim().toLowerCase()).filter(Boolean))];
    if (lowered.length === 0) return [];
    const byName = new Map(tags.map(t => [t.name, t]));
    const newNames = lowered.filter(n => !byName.has(n));
    if (newNames.length > 0) {
      const { data, error } = await supabase
        .from('tags')
        .insert(newNames.map(name => ({ name, user_id: session.user.id })))
        .select();
      if (error) { console.error('Tag insert error:', error); return null; }
      setTags(prev => [...prev, ...data]);
      data.forEach(t => byName.set(t.name, t));
    }
    return lowered.map(n => byName.get(n));
  }, [tags, session]);

  async function setItemTags(itemId, tagIds) {
    await supabase.from('item_tags').delete().eq('item_id', itemId);
    if (tagIds.length === 0) return;
    await supabase.from('item_tags').insert(tagIds.map(tag_id => ({ item_id: itemId, tag_id })));
  }

  async function makeThumbBytes(photoUri, maxW = 400) {
    try {
      const data = await Skia.Data.fromURI(photoUri);
      if (!data) return null;
      const skImg = Skia.Image.MakeImageFromEncoded(data);
      if (!skImg) return null;
      const w = skImg.width();
      const h = skImg.height();
      const scale = Math.min(1, maxW / w);
      const targetW = Math.round(w * scale);
      const targetH = Math.round(h * scale);
      const surface = Skia.Surface.Make(targetW, targetH);
      if (!surface) return null;
      const canvas = surface.getCanvas();
      canvas.drawImageRect(
        skImg,
        Skia.XYWHRect(0, 0, w, h),
        Skia.XYWHRect(0, 0, targetW, targetH),
        Skia.Paint(),
      );
      surface.flush();
      return surface.makeImageSnapshot().encodeToBytes(ImageFormat.WEBP, 85);
    } catch (e) {
      console.warn('Thumb generation failed:', e);
      return null;
    }
  }

  async function uploadSkiaImage(skImg) {
    if (!skImg) return null;
    const w = skImg.width();
    const h = skImg.height();

    const mainBytes = skImg.encodeToBytes(ImageFormat.JPEG, 88);
    if (!mainBytes) return null;

    let thumbBytes = null;
    const maxThumb = 400;
    const tScale = Math.min(1, maxThumb / Math.max(w, h));
    const tw = Math.round(w * tScale);
    const th = Math.round(h * tScale);
    const surface = Skia.Surface.Make(tw, th);
    if (surface) {
      const canvas = surface.getCanvas();
      canvas.drawImageRect(skImg, Skia.XYWHRect(0, 0, w, h), Skia.XYWHRect(0, 0, tw, th), Skia.Paint());
      surface.flush();
      thumbBytes = surface.makeImageSnapshot().encodeToBytes(ImageFormat.WEBP, 85);
    }

    const { data: presign, error: presignErr } = await supabase.functions.invoke('r2-presign', {
      body: { ext: 'jpg', contentType: 'image/jpeg' },
    });
    if (presignErr || !presign) { console.error('Presign error:', presignErr); return null; }
    const { main, thumb, cacheControl } = presign;

    const mainRes = await fetch(main.uploadUrl, {
      method: 'PUT',
      body: mainBytes,
      headers: { 'Content-Type': 'image/jpeg', 'Cache-Control': cacheControl },
    });
    if (!mainRes.ok) { console.error('Main upload failed:', mainRes.status); return null; }

    let thumb_url = null;
    if (thumbBytes) {
      const thumbRes = await fetch(thumb.uploadUrl, {
        method: 'PUT',
        body: thumbBytes,
        headers: { 'Content-Type': 'image/webp', 'Cache-Control': cacheControl },
      });
      if (thumbRes.ok) thumb_url = thumb.publicUrl;
      else console.warn('Thumb upload failed:', thumbRes.status);
    }
    return { image_url: main.publicUrl, thumb_url };
  }

  async function uploadLocalPhoto(photoUri) {
    const ext = (photoUri.split('.').pop() || 'jpg').toLowerCase();
    const contentType = ext === 'jpg' ? 'image/jpeg' : `image/${ext}`;

    const [base64, thumbBytes] = await Promise.all([
      readAsStringAsync(photoUri, { encoding: EncodingType.Base64 }),
      makeThumbBytes(photoUri),
    ]);

    const { data: presign, error: presignErr } = await supabase.functions.invoke('r2-presign', {
      body: { ext, contentType },
    });
    if (presignErr || !presign) { console.error('Presign error:', presignErr); return null; }
    const { main, thumb, cacheControl } = presign;

    const mainRes = await fetch(main.uploadUrl, {
      method: 'PUT',
      body: decode(base64),
      headers: { 'Content-Type': contentType, 'Cache-Control': cacheControl },
    });
    if (!mainRes.ok) { console.error('Main upload failed:', mainRes.status); return null; }

    let thumb_url = null;
    if (thumbBytes) {
      const thumbRes = await fetch(thumb.uploadUrl, {
        method: 'PUT',
        body: thumbBytes,
        headers: { 'Content-Type': 'image/webp', 'Cache-Control': cacheControl },
      });
      if (thumbRes.ok) thumb_url = thumb.publicUrl;
      else console.warn('Thumb upload failed:', thumbRes.status);
    }
    return { image_url: main.publicUrl, thumb_url };
  }

  async function addItem(name, photoUri, tagNames, isPrivate, description, acquired, ocrText, uploadPromise) {
    const uploaded = await (uploadPromise ?? uploadLocalPhoto(photoUri));
    if (!uploaded) return null;
    const { image_url, thumb_url } = uploaded;
    const { data, error } = await supabase
      .from('items')
      .insert({
        name: name || null,
        description: description || null,
        image_url,
        thumb_url,
        is_private: isPrivate ?? false,
        ocr_text: ocrText || null,
        ...acquiredFields(acquired),
      })
      .select()
      .single();
    if (error) return null;
    const resolved = await ensureTags(tagNames);
    if (!resolved) return null;
    await setItemTags(data.id, resolved.map(t => t.id));
    const newItem = { ...data, tags: resolved };
    setItems(prev => [newItem, ...prev]);
    setItemCount(c => (c == null ? null : c + 1));
    Image.prefetch(thumb_url || image_url, { cachePolicy: 'memory-disk' });
    return newItem;
  }

  async function updateItem(id, name, photoOrUri, tagNames, isPrivate, description, acquired, ocrText, previousImages, imageAddedAt) {
    let image_url = photoOrUri;
    const current = items.find(i => i.id === id);
    let thumb_url = current?.thumb_url ?? null;
    const isNewPhoto = photoOrUri && !photoOrUri.startsWith('http');
    if (isNewPhoto) {
      const uploaded = await uploadLocalPhoto(photoOrUri);
      if (!uploaded) return null;
      image_url = uploaded.image_url;
      thumb_url = uploaded.thumb_url;
    } else if (current && image_url && image_url !== current.image_url) {
      const match = (current.previous_images ?? []).find(p => p?.url === image_url);
      if (match) thumb_url = match.thumb_url ?? null;
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
        ...(ocrText !== undefined ? { ocr_text: ocrText || null } : {}),
        ...(previousImages !== undefined ? { previous_images: previousImages } : {}),
        ...(imageAddedAt !== undefined ? { image_added_at: imageAddedAt } : (isNewPhoto ? { image_added_at: new Date().toISOString() } : {})),
      })
      .eq('id', id)
      .select()
      .single();
    if (error) return null;
    const resolved = await ensureTags(tagNames);
    if (!resolved) return null;
    await setItemTags(data.id, resolved.map(t => t.id));
    const updated = { ...data, tags: resolved };
    setItems(prev => prev.map(i => i.id === updated.id ? updated : i));
    if (isNewPhoto) Image.prefetch(thumb_url || image_url, { cachePolicy: 'memory-disk' });
    return updated;
  }

  // Re-read the trigger-maintained usage rollups for one item into memory. Used after
  // a usage delete (where we can't derive the new last_used_on locally).
  async function refreshItemUsage(itemId) {
    const { data } = await supabase
      .from('items')
      .select('usage_count, last_used_on')
      .eq('id', itemId)
      .maybeSingle();
    if (data) setItems(prev => prev.map(i => i.id === itemId ? { ...i, ...data } : i));
    return data;
  }

  // One-tap "used this today" — produces a public feed event. No-op if already used today.
  async function markUsedToday(item) {
    const usedOn = dayKey(new Date());
    if (item.last_used_on === usedOn) return item;
    try {
      await recordUsage(supabase, { itemId: item.id, userId: session.user.id, usedOn, onFeed: true });
    } catch (e) {
      console.error('markUsedToday error:', e);
      return null;
    }
    const patch = { usage_count: (item.usage_count ?? 0) + 1, last_used_on: usedOn };
    setItems(prev => prev.map(i => i.id === item.id ? { ...i, ...patch } : i));
    return { ...item, ...patch };
  }

  async function unmarkUsedToday(item) {
    const usedOn = dayKey(new Date());
    try {
      await removeUsage(supabase, { itemId: item.id, usedOn });
    } catch (e) {
      console.error('unmarkUsedToday error:', e);
      return null;
    }
    return refreshItemUsage(item.id);
  }

  // Edit-mode backfill — silent (no feed event). usedOn is a 'YYYY-MM-DD' day key.
  async function addUsage(item, usedOn) {
    try {
      await recordUsage(supabase, { itemId: item.id, userId: session.user.id, usedOn, onFeed: false });
    } catch (e) {
      console.error('addUsage error:', e);
      return null;
    }
    return refreshItemUsage(item.id);
  }

  async function removeUsageOn(item, usedOn) {
    try {
      await removeUsage(supabase, { itemId: item.id, usedOn });
    } catch (e) {
      console.error('removeUsageOn error:', e);
      return null;
    }
    return refreshItemUsage(item.id);
  }

  async function deleteStorageForItems(itemsToDelete) {
    const paths = itemsToDelete.flatMap(imagePathsForItem);
    if (paths.length === 0) return;
    const { error } = await supabase.functions.invoke('r2-delete', { body: { paths } });
    if (error) console.warn('R2 delete failed (orphans left for cleanup):', error);
  }

  async function deleteStorageForCollageCovers(collageRows) {
    const paths = collageRows.flatMap(c => [c?.cover_url, c?.cover_thumb_url])
      .map(imagePathFromUrl)
      .filter(Boolean);
    if (paths.length === 0) return;
    const { error } = await supabase.functions.invoke('r2-delete', { body: { paths } });
    if (error) console.warn('R2 delete failed (orphan covers left for cleanup):', error);
  }

  async function createCollage({ tagId, title, layout, isPrivate, coverUrl, coverThumbUrl }) {
    const { data, error } = await supabase
      .from('collages')
      .insert({
        user_id: session.user.id,
        tag_id: tagId,
        title: title ?? '',
        layout,
        is_private: isPrivate ?? false,
        cover_url: coverUrl ?? null,
        cover_thumb_url: coverThumbUrl ?? null,
      })
      .select()
      .single();
    if (error) { console.error('createCollage error:', error); return null; }
    return data;
  }

  async function updateCollage(id, patch) {
    let oldCover = null;
    if (patch.cover_url !== undefined || patch.cover_thumb_url !== undefined) {
      const { data } = await supabase
        .from('collages')
        .select('cover_url, cover_thumb_url')
        .eq('id', id)
        .single();
      oldCover = data ?? null;
    }
    const { data, error } = await supabase
      .from('collages')
      .update({ ...patch, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();
    if (error) { console.error('updateCollage error:', error); return null; }
    if (oldCover) {
      const stale = [];
      if (patch.cover_url !== undefined && oldCover.cover_url && oldCover.cover_url !== patch.cover_url) stale.push({ cover_url: oldCover.cover_url });
      if (patch.cover_thumb_url !== undefined && oldCover.cover_thumb_url && oldCover.cover_thumb_url !== patch.cover_thumb_url) stale.push({ cover_thumb_url: oldCover.cover_thumb_url });
      if (stale.length) deleteStorageForCollageCovers(stale);
    }
    return data;
  }

  async function deleteCollage(id) {
    const { data: row } = await supabase
      .from('collages')
      .select('cover_url, cover_thumb_url')
      .eq('id', id)
      .single();
    const { error } = await supabase.from('collages').delete().eq('id', id);
    if (error) { console.error('deleteCollage error:', error); return false; }
    if (row) deleteStorageForCollageCovers([row]);
    return true;
  }

  async function countCollagesForTag(tagId) {
    const { count, error } = await supabase
      .from('collages')
      .select('id', { count: 'exact', head: true })
      .eq('tag_id', tagId);
    if (error) return 0;
    return count ?? 0;
  }

  // Retire an item into the graveyard. One-tap: reason + epitaph are optional.
  // retired_at doubles as "when last retired"; the item leaves the active collection.
  async function retireItem(item, { reason = null, epitaph = null } = {}) {
    const retiredAt = new Date().toISOString();
    const patch = {
      retired_at: retiredAt,
      retire_reason: reason || null,
      epitaph: epitaph || null,
    };
    const { error } = await supabase.from('items').update(patch).eq('id', item.id);
    if (error) { console.error('retireItem error:', error); return null; }
    setItems(prev => prev.map(i => i.id === item.id ? { ...i, ...patch } : i));
    setItemCount(c => (c == null ? null : Math.max(0, c - 1)));
    return { ...item, ...patch };
  }

  // Bring a retired item back to the collection, clearing its retirement record.
  async function resurrectItem(item) {
    const patch = { retired_at: null, retire_reason: null, epitaph: null };
    const { error } = await supabase.from('items').update(patch).eq('id', item.id);
    if (error) { console.error('resurrectItem error:', error); return null; }
    setItems(prev => prev.map(i => i.id === item.id ? { ...i, ...patch } : i));
    setItemCount(c => (c == null ? null : c + 1));
    return { ...item, ...patch };
  }

  async function deleteItem(id) {
    const target = items.find(i => i.id === id);
    const { error } = await supabase.from('items').delete().eq('id', id);
    if (!error) {
      setItems(prev => prev.filter(i => i.id !== id));
      setItemCount(c => (c == null ? null : Math.max(0, c - 1)));
      if (target) deleteStorageForItems([target]);
    }
  }

  async function batchEditItems(ids, { addTags = [], acquiredPatch = null } = {}) {
    const resolved = addTags.length > 0 ? await ensureTags(addTags) : [];
    if (resolved === null) return;

    setItems(prev => prev.map(item => {
      if (!ids.includes(item.id)) return item;
      const next = { ...item };
      if (resolved.length > 0) {
        const existing = item.tags ?? [];
        const existingIds = new Set(existing.map(t => t.id));
        next.tags = [...existing, ...resolved.filter(t => !existingIds.has(t.id))];
      }
      if (acquiredPatch) Object.assign(next, acquiredPatch);
      return next;
    }));

    if (resolved.length > 0) {
      const rows = ids.flatMap(item_id => resolved.map(t => ({ item_id, tag_id: t.id })));
      const { error } = await supabase
        .from('item_tags')
        .upsert(rows, { onConflict: 'item_id,tag_id', ignoreDuplicates: true });
      if (error) console.error('Batch tag error:', error);
    }
    if (acquiredPatch) {
      const { error } = await supabase.from('items').update(acquiredPatch).in('id', ids);
      if (error) console.error('Batch acquired error:', error);
    }
  }

  async function batchDeleteItems(ids) {
    const targets = items.filter(i => ids.includes(i.id));
    await supabase.from('item_tags').delete().in('item_id', ids);
    const { error } = await supabase.from('items').delete().in('id', ids);
    if (!error) {
      setItems(prev => prev.filter(i => !ids.includes(i.id)));
      setItemCount(c => (c == null ? null : Math.max(0, c - ids.length)));
      if (targets.length > 0) deleteStorageForItems(targets);
    }
  }

  async function batchTogglePrivacy(ids) {
    const allPrivate = ids.every(id => items.find(i => i.id === id)?.is_private);
    const newPrivate = !allPrivate;
    await supabase.from('items').update({ is_private: newPrivate }).in('id', ids);
    setItems(prev => prev.map(i => ids.includes(i.id) ? { ...i, is_private: newPrivate } : i));
  }

  async function deleteTag(tagId) {
    const target = tags.find(t => t.id === tagId);
    if (isFeaturedTag(target)) return;
    const { data: collageRows } = await supabase
      .from('collages')
      .select('cover_url, cover_thumb_url')
      .eq('tag_id', tagId);
    await supabase.from('item_tags').delete().eq('tag_id', tagId);
    const { error } = await supabase.from('tags').delete().eq('id', tagId);
    if (!error) {
      setTags(prev => prev.filter(t => t.id !== tagId));
      setItems(prev => prev.map(i => ({ ...i, tags: (i.tags ?? []).filter(t => t.id !== tagId) })));
      if (collageRows?.length) deleteStorageForCollageCovers(collageRows);
    }
  }

  async function toggleTagPrivacy(tag) {
    const newPrivate = !tag.is_private;
    const { error } = await supabase.from('tags').update({ is_private: newPrivate }).eq('id', tag.id);
    if (!error) setTags(prev => prev.map(t => t.id === tag.id ? { ...t, is_private: newPrivate } : t));
  }

  async function renameTag(tagId, newName) {
    const normalized = (newName ?? '').trim().toLowerCase();
    if (!normalized) return { error: 'empty' };
    const current = tags.find(t => t.id === tagId);
    if (!current) return { error: 'not_found' };
    if (isFeaturedTag(current)) return { error: 'protected' };
    if (current.name === normalized) return { ok: true };
    if (tags.some(t => t.id !== tagId && t.name === normalized)) return { error: 'taken' };
    const { error } = await supabase.from('tags').update({ name: normalized }).eq('id', tagId);
    if (error) return { error: 'db' };
    setTags(prev => prev.map(t => t.id === tagId ? { ...t, name: normalized } : t));
    setItems(prev => prev.map(i => ({
      ...i,
      tags: (i.tags ?? []).map(t => t.id === tagId ? { ...t, name: normalized } : t),
    })));
    return { ok: true };
  }

  return (
    <CollectionContext.Provider value={{
      session,
      authLoading,
      items,
      itemCount,
      itemsLoading,
      tags,
      profile,
      updateProfile,
      refresh,
      ensureTags,
      uploadLocalPhoto,
      uploadSkiaImage,
      addItem,
      updateItem,
      deleteItem,
      retireItem,
      resurrectItem,
      markUsedToday,
      unmarkUsedToday,
      addUsage,
      removeUsageOn,
      batchEditItems,
      batchDeleteItems,
      batchTogglePrivacy,
      deleteTag,
      toggleTagPrivacy,
      renameTag,
      createCollage,
      updateCollage,
      deleteCollage,
      countCollagesForTag,
      batchModeActive,
      setBatchModeActive,
      blockedIds,
      blockContent,
      unblockContent,
      reportContent,
      followingIds,
      followContent,
      unfollowContent,
      unreadNotifications,
      refreshNotifications,
      readNotifications,
    }}>
      {children}
    </CollectionContext.Provider>
  );
}

export function useCollection() {
  const ctx = useContext(CollectionContext);
  if (!ctx) throw new Error('useCollection must be used inside CollectionProvider');
  return ctx;
}
