import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { supabase } from '../../lib/supabase';
import { useCollection } from '../../lib/CollectionProvider';
import ProfileViewScreen from '../../screens/ProfileViewScreen';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default function ProfileSlugRoute() {
  const { slug } = useLocalSearchParams();
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
        router.replace('/');
      } else {
        setShouldShow(true);
        setResolving(false);
      }
    })();
    return () => { cancelled = true; };
  }, [slug, session, router]);

  if (resolving || !shouldShow) {
    return (
      <View style={{ flex: 1, backgroundColor: '#F5F0EB', alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color="#999" />
      </View>
    );
  }

  return <ProfileViewScreen visible slug={slug} onClose={() => router.back()} />;
}
