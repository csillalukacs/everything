import { useRouter } from 'expo-router';
import { useCollection } from '../lib/CollectionProvider';
import ProfileScreen from '../screens/ProfileScreen';

export default function SettingsRoute() {
  const router = useRouter();
  const { session, items } = useCollection();
  return (
    <ProfileScreen
      visible
      onClose={() => router.back()}
      session={session}
      itemCount={items.length}
    />
  );
}
