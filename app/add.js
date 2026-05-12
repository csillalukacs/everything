import { useRouter } from 'expo-router';
import { useCollection } from '../lib/CollectionProvider';
import AddItemModal from '../screens/AddItemModal';

export default function AddRoute() {
  const router = useRouter();
  const { tags, addItem } = useCollection();

  async function handleSave(name, photoUri, tagNames, isPrivate, description, acquired, ocrText, uploadPromise) {
    const created = await addItem(name, photoUri, tagNames, isPrivate, description, acquired, ocrText, uploadPromise);
    if (created) router.back();
  }

  return (
    <AddItemModal
      visible
      onClose={() => router.back()}
      onSave={handleSave}
      allTags={tags}
    />
  );
}
