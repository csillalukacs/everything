import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { useCollection } from '../lib/CollectionProvider';
import { supabase } from '../lib/supabase';
import CanvasScreen from '../screens/CanvasScreen';
import { C } from '../shared/theme';

export default function CanvasRoute() {
  const router = useRouter();
  const { items } = useCollection();
  const params = useLocalSearchParams();
  const collageId = params.collageId ? String(params.collageId) : null;
  const paramTagId = params.tagId ? String(params.tagId) : null;
  const [collage, setCollage] = useState(null);
  const [loaded, setLoaded] = useState(!collageId);

  useEffect(() => {
    if (!collageId) return;
    let cancelled = false;
    supabase
      .from('collages')
      .select('id, tag_id, title, layout, is_private')
      .eq('id', collageId)
      .single()
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error || !data) { router.back(); return; }
        setCollage(data);
        setLoaded(true);
      });
    return () => { cancelled = true; };
  }, [collageId, router]);

  const tagId = collage?.tag_id ?? paramTagId;
  const tagItems = useMemo(() => {
    if (!tagId) return [];
    return items.filter(i => (i.tags ?? []).some(t => t.id === tagId));
  }, [items, tagId]);

  if (!loaded) {
    return (
      <View style={{ flex: 1, backgroundColor: C.bg, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color="#999" />
      </View>
    );
  }

  return (
    <CanvasScreen
      onClose={() => router.back()}
      collageId={collage?.id ?? null}
      tagId={tagId}
      tagItems={tagItems}
      initialTitle={collage?.title ?? ''}
      initialIsPrivate={collage?.is_private ?? false}
      initialLayout={collage?.layout ?? null}
    />
  );
}
