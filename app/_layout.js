import { Stack, useRouter } from 'expo-router';
import { useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { CollectionProvider, useCollection } from '../lib/CollectionProvider';
import { useShareIntent } from '../lib/shareIntent';
import AuthScreen from '../screens/AuthScreen';
import DeleteSnackbar from '../screens/DeleteSnackbar';
import { C } from '../shared/theme';

const transparentSheetOptions = {
  presentation: 'transparentModal',
  animation: 'none',
  contentStyle: { backgroundColor: 'transparent' },
};

function RootStack() {
  const { session, authLoading } = useCollection();
  const router = useRouter();
  const { hasShareIntent, shareIntent, resetShareIntent } = useShareIntent();

  // A photo shared into the app from elsewhere: jump straight into /add seeded
  // with the shared image. No-op on builds without share intent (see
  // lib/shareIntent). Wait for a session so we don't push behind the auth gate.
  useEffect(() => {
    if (!session || !hasShareIntent) return;
    const file = shareIntent?.files?.[0];
    if (!file?.path) return;
    router.push({ pathname: '/add', params: { sharedUri: file.path } });
    resetShareIntent();
  }, [session, hasShareIntent, shareIntent, resetShareIntent, router]);

  if (authLoading) {
    return (
      <View style={{ flex: 1, backgroundColor: C.bg, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color="#999" />
      </View>
    );
  }

  if (!session) return <AuthScreen />;

  return (
    <>
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: C.bg } }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="add" options={transparentSheetOptions} />
        <Stack.Screen name="u/[slug]" />
        <Stack.Screen name="stats" />
        <Stack.Screen name="notifications" options={{ animation: 'slide_from_bottom' }} />
        <Stack.Screen name="favorites" />
        <Stack.Screen name="canvas" />
      </Stack>
      <DeleteSnackbar />
    </>
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
