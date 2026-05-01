import { Stack, useRouter } from 'expo-router';
import { useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useShareIntent } from 'expo-share-intent';
import { CollectionProvider, useCollection } from '../lib/CollectionProvider';
import AuthScreen from '../screens/AuthScreen';

const transparentSheetOptions = {
  presentation: 'transparentModal',
  animation: 'none',
  contentStyle: { backgroundColor: 'transparent' },
};

function RootStack() {
  const { session, authLoading } = useCollection();
  const router = useRouter();
  const { hasShareIntent, shareIntent, resetShareIntent } = useShareIntent();

  useEffect(() => {
    if (!session || !hasShareIntent) return;
    const file = shareIntent?.files?.[0];
    if (!file?.path) return;
    router.push({ pathname: '/add', params: { sharedUri: file.path } });
    resetShareIntent();
  }, [session, hasShareIntent, shareIntent, resetShareIntent, router]);

  if (authLoading) {
    return (
      <View style={{ flex: 1, backgroundColor: '#F5F0EB', alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color="#999" />
      </View>
    );
  }

  if (!session) return <AuthScreen />;

  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: '#F5F0EB' } }}>
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="settings" options={transparentSheetOptions} />
      <Stack.Screen name="add" options={transparentSheetOptions} />
      <Stack.Screen name="u/[slug]" />
      <Stack.Screen name="canvas" />
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <CollectionProvider>
        <RootStack />
        <StatusBar style="dark" />
      </CollectionProvider>
    </SafeAreaProvider>
  );
}
