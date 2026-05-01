import { Stack } from 'expo-router';
import { ActivityIndicator, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { CollectionProvider, useCollection } from '../lib/CollectionProvider';
import AuthScreen from '../screens/AuthScreen';

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
      <Stack.Screen name="index" />
      <Stack.Screen name="canvas" />
      <Stack.Screen
        name="profile"
        options={{
          presentation: 'transparentModal',
          animation: 'none',
          contentStyle: { backgroundColor: 'transparent' },
        }}
      />
      <Stack.Screen name="u/[slug]" />
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <CollectionProvider>
      <RootStack />
      <StatusBar style="dark" />
    </CollectionProvider>
  );
}
