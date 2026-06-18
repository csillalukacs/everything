import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { supabase } from '../../lib/supabase';
import { useCollection } from '../../lib/CollectionProvider';
import ProfileViewScreen from '../../screens/ProfileViewScreen';
import { UUID_RE } from '../../shared/identifiers';
import { C } from '../../shared/theme';

export default function ProfileSlugRoute() {
  const { slug, item, tag } = useLocalSearchParams();
  const router = useRouter();
  const { session } = useCollection();
  const [resolving, setResolving] = useState(true);
  const [shouldShow, setShouldShow] = useState(false);

  useEffect(() => {
    if (!slug) return;
    let cancelled = false;
    (async () => {
      if (!session) { setShouldShow(true); setResolving(false); return; }
      let resolvedId = null;
      if (UUID_RE.test(slug)) {
        resolvedId = slug;
      } else {
        const { data } = await supabase
          .from('profiles')
          .select('user_id')
          .ilike('username', slug)
          .maybeSingle();
        resolvedId = data?.user_id ?? null;
      }
      if (cancelled) return;
      if (resolvedId === session.user.id) {
        const qs = new URLSearchParams();
        if (item) qs.set('item', item);
        if (tag) qs.set('tag', tag);
        const query = qs.toString();
        router.replace(query ? `/?${query}` : '/');
      } else {
        setShouldShow(true);
        setResolving(false);
      }
    })();
    return () => { cancelled = true; };
  }, [slug, session, router]);

  if (resolving || !shouldShow) {
    return (
      <View style={{ flex: 1, backgroundColor: C.bg, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color="#999" />
      </View>
    );
  }

  return <ProfileViewScreen visible slug={slug} initialItemId={item} initialTag={tag} onClose={() => router.back()} />;
}
