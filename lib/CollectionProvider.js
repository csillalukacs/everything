import AsyncStorage from '@react-native-async-storage/async-storage';
import { readAsStringAsync, EncodingType } from 'expo-file-system/legacy';
import { decode } from 'base64-arraybuffer';
import { Image } from 'expo-image';
import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { supabase } from './supabase';
import { fetchAllItems, fetchItemCount } from '../shared/itemsApi';
import { acquiredFields } from '../shared/items';

const itemsCacheKey = userId => `cache:items:${userId}`;
const tagsCacheKey = userId => `cache:tags:${userId}`;

const CollectionContext = createContext(null);

export function CollectionProvider({ children }) {
  const [session, setSession] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [items, setItems] = useState([]);
  const [itemCount, setItemCount] = useState(null);
  const [tags, setTags] = useState([]);
  const [profile, setProfile] = useState(null);

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
      setTags([]);
      setProfile(null);
      return;
    }
    let cancelled = false;
    (async () => {
      const [itemsStr, tagsStr] = await Promise.all([
        AsyncStorage.getItem(itemsCacheKey(session.user.id)),
        AsyncStorage.getItem(tagsCacheKey(session.user.id)),
      ]);
      if (cancelled) return;
      const cachedItems = itemsStr ? JSON.parse(itemsStr) : [];
      setItems(cachedItems);
      setItemCount(cachedItems.length || null);
      setTags(tagsStr ? JSON.parse(tagsStr) : []);
      fetchItems(session.user.id);
      refreshItemCount(session.user.id);
      fetchTags(session.user.id);
      fetchProfile(session.user.id);
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session]);

  async function fetchProfile(uid) {
    const { data } = await supabase
      .from('profiles')
      .select('display_name, username')
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
      .select('display_name, username')
      .single();
    if (error) return { error };
    setProfile(data);
    return { data };
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
      const urls = data.map(i => i.image_url).filter(Boolean);
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
    if (!error) setTags(data);
  }

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

  async function uploadLocalPhoto(photoUri) {
    const ext = photoUri.split('.').pop();
    const path = `${session.user.id}/${Date.now()}.${ext}`;
    const base64 = await readAsStringAsync(photoUri, { encoding: EncodingType.Base64 });
    const { error: uploadError } = await supabase.storage
      .from('item-images')
      .upload(path, decode(base64), { contentType: `image/${ext}`, cacheControl: '31536000, immutable' });
    if (uploadError) { console.error('Upload error:', uploadError); return null; }
    const { data: { publicUrl } } = supabase.storage.from('item-images').getPublicUrl(path);
    return publicUrl;
  }

  async function addItem(name, photoUri, tagNames, isPrivate, description, acquired, ocrText) {
    const publicUrl = await uploadLocalPhoto(photoUri);
    if (!publicUrl) return null;
    const { data, error } = await supabase
      .from('items')
      .insert({
        name: name || null,
        description: description || null,
        image_url: publicUrl,
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
    Image.prefetch(publicUrl, { cachePolicy: 'memory-disk' });
    return newItem;
  }

  async function updateItem(id, name, photoOrUri, tagNames, isPrivate, description, acquired, ocrText, previousImages, imageAddedAt) {
    let image_url = photoOrUri;
    const isNewPhoto = photoOrUri && !photoOrUri.startsWith('http');
    if (isNewPhoto) {
      image_url = await uploadLocalPhoto(photoOrUri);
      if (!image_url) return null;
    }
    const { data, error } = await supabase
      .from('items')
      .update({
        name: name || null,
        description: description || null,
        image_url,
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
    if (photoOrUri && !photoOrUri.startsWith('http')) Image.prefetch(image_url, { cachePolicy: 'memory-disk' });
    return updated;
  }

  async function deleteItem(id) {
    const { error } = await supabase.from('items').delete().eq('id', id);
    if (!error) {
      setItems(prev => prev.filter(i => i.id !== id));
      setItemCount(c => (c == null ? null : Math.max(0, c - 1)));
    }
  }

  async function batchEditItems(ids, { addTags = [], acquired = null } = {}) {
    const resolved = addTags.length > 0 ? await ensureTags(addTags) : [];
    if (resolved === null) return;

    const acquiredPatch = acquired ? acquiredFields(acquired) : null;

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
    await supabase.from('item_tags').delete().in('item_id', ids);
    const { error } = await supabase.from('items').delete().in('id', ids);
    if (!error) {
      setItems(prev => prev.filter(i => !ids.includes(i.id)));
      setItemCount(c => (c == null ? null : Math.max(0, c - ids.length)));
    }
  }

  async function batchTogglePrivacy(ids) {
    const allPrivate = ids.every(id => items.find(i => i.id === id)?.is_private);
    const newPrivate = !allPrivate;
    await supabase.from('items').update({ is_private: newPrivate }).in('id', ids);
    setItems(prev => prev.map(i => ids.includes(i.id) ? { ...i, is_private: newPrivate } : i));
  }

  async function deleteTag(tagId) {
    await supabase.from('item_tags').delete().eq('tag_id', tagId);
    const { error } = await supabase.from('tags').delete().eq('id', tagId);
    if (!error) {
      setTags(prev => prev.filter(t => t.id !== tagId));
      setItems(prev => prev.map(i => ({ ...i, tags: (i.tags ?? []).filter(t => t.id !== tagId) })));
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
      tags,
      profile,
      updateProfile,
      ensureTags,
      addItem,
      updateItem,
      deleteItem,
      batchEditItems,
      batchDeleteItems,
      batchTogglePrivacy,
      deleteTag,
      toggleTagPrivacy,
      renameTag,
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
