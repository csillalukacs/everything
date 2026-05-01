import AsyncStorage from '@react-native-async-storage/async-storage';
import { readAsStringAsync, EncodingType } from 'expo-file-system/legacy';
import { decode } from 'base64-arraybuffer';
import { Image } from 'expo-image';
import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { supabase } from './supabase';

const itemsCacheKey = userId => `cache:items:${userId}`;
const tagsCacheKey = userId => `cache:tags:${userId}`;

const CollectionContext = createContext(null);

export function CollectionProvider({ children }) {
  const [session, setSession] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [items, setItems] = useState([]);
  const [tags, setTags] = useState([]);

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
      setTags([]);
      return;
    }
    let cancelled = false;
    (async () => {
      const [itemsStr, tagsStr] = await Promise.all([
        AsyncStorage.getItem(itemsCacheKey(session.user.id)),
        AsyncStorage.getItem(tagsCacheKey(session.user.id)),
      ]);
      if (cancelled) return;
      setItems(itemsStr ? JSON.parse(itemsStr) : []);
      setTags(tagsStr ? JSON.parse(tagsStr) : []);
      fetchItems(session.user.id);
      fetchTags(session.user.id);
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session]);

  useEffect(() => {
    if (!session) return;
    AsyncStorage.setItem(itemsCacheKey(session.user.id), JSON.stringify(items));
  }, [items, session]);

  useEffect(() => {
    if (!session) return;
    AsyncStorage.setItem(tagsCacheKey(session.user.id), JSON.stringify(tags));
  }, [tags, session]);

  async function fetchItems(uid) {
    const { data, error } = await supabase
      .from('items')
      .select('*, tags(id, name, is_private)')
      .eq('user_id', uid)
      .order('created_at', { ascending: false });
    if (!error) {
      setItems(data);
      const urls = data.map(i => i.image_url).filter(Boolean);
      if (urls.length) Image.prefetch(urls, { cachePolicy: 'memory-disk' });
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

  async function addItem(name, photoUri, tagNames, isPrivate, description) {
    const publicUrl = await uploadLocalPhoto(photoUri);
    if (!publicUrl) return null;
    const { data, error } = await supabase
      .from('items')
      .insert({ name: name || null, description: description || null, image_url: publicUrl, is_private: isPrivate ?? false })
      .select()
      .single();
    if (error) return null;
    const resolved = await ensureTags(tagNames);
    if (!resolved) return null;
    await setItemTags(data.id, resolved.map(t => t.id));
    const newItem = { ...data, tags: resolved };
    setItems(prev => [newItem, ...prev]);
    Image.prefetch(publicUrl, { cachePolicy: 'memory-disk' });
    return newItem;
  }

  async function updateItem(id, name, photoOrUri, tagNames, isPrivate, description) {
    let image_url = photoOrUri;
    if (photoOrUri && !photoOrUri.startsWith('http')) {
      image_url = await uploadLocalPhoto(photoOrUri);
      if (!image_url) return null;
    }
    const { data, error } = await supabase
      .from('items')
      .update({ name: name || null, description: description || null, image_url, is_private: isPrivate ?? false })
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
    if (!error) setItems(prev => prev.filter(i => i.id !== id));
  }

  async function batchTagItems(ids, tagNames) {
    const resolved = await ensureTags(tagNames);
    if (!resolved) return;
    setItems(prev => prev.map(item => {
      if (!ids.includes(item.id)) return item;
      const existing = item.tags ?? [];
      const existingIds = new Set(existing.map(t => t.id));
      const merged = [...existing, ...resolved.filter(t => !existingIds.has(t.id))];
      return { ...item, tags: merged };
    }));
    const rows = ids.flatMap(item_id => resolved.map(t => ({ item_id, tag_id: t.id })));
    const { error } = await supabase
      .from('item_tags')
      .upsert(rows, { onConflict: 'item_id,tag_id', ignoreDuplicates: true });
    if (error) console.error('Batch tag error:', error);
  }

  async function batchDeleteItems(ids) {
    await supabase.from('item_tags').delete().in('item_id', ids);
    const { error } = await supabase.from('items').delete().in('id', ids);
    if (!error) setItems(prev => prev.filter(i => !ids.includes(i.id)));
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

  return (
    <CollectionContext.Provider value={{
      session,
      authLoading,
      items,
      tags,
      ensureTags,
      addItem,
      updateItem,
      deleteItem,
      batchTagItems,
      batchDeleteItems,
      batchTogglePrivacy,
      deleteTag,
      toggleTagPrivacy,
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
