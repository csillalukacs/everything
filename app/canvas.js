import { useRouter } from 'expo-router';
import { useCollection } from '../lib/CollectionProvider';
import CanvasScreen from '../screens/CanvasScreen';

export default function CanvasRoute() {
  const router = useRouter();
  const { items } = useCollection();
  return <CanvasScreen visible onClose={() => router.back()} items={items} />;
}
