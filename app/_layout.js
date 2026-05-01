import { Stack } from 'expo-router';
import { ActivityIndicator, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { CollectionProvider, useCollection } from '../lib/CollectionProvider';
import AuthScreen from '../screens/AuthScreen';

const transparentSheetOptions = {
  presentation: 'transparentModal',
  animation: 'none',
  contentStyle: { backgroundColor: 'transparent' },
};

function RootStack() {
  const { session, authLoading } = useCollection();

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
