import { Ionicons } from '@expo/vector-icons';
import { Tabs, useRouter } from 'expo-router';
import { StyleSheet, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

function CustomTabBar({ state, navigation }) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const currentRoute = state.routes[state.index]?.name;

  function go(name) {
    if (currentRoute !== name) navigation.navigate(name);
  }

  return (
    <View style={[styles.bar, { paddingBottom: Math.max(insets.bottom, 12) }]}>
      <TouchableOpacity
        style={styles.sideBtn}
        onPress={() => go('feed')}
        accessibilityLabel="feed"
      >
        <Ionicons
          name={currentRoute === 'feed' ? 'home' : 'home-outline'}
          size={26}
          color={currentRoute === 'feed' ? '#2D2D2D' : '#999'}
        />
      </TouchableOpacity>

      <View style={styles.plusWrap}>
        <TouchableOpacity
          style={styles.plusBtn}
          onPress={() => router.push('/add')}
          accessibilityLabel="add item"
        >
          <Ionicons name="add" size={32} color="#fff" />
        </TouchableOpacity>
      </View>

      <TouchableOpacity
        style={styles.sideBtn}
        onPress={() => go('index')}
        accessibilityLabel="your collection"
      >
        <Ionicons
          name={currentRoute === 'index' ? 'person-circle' : 'person-circle-outline'}
          size={28}
          color={currentRoute === 'index' ? '#2D2D2D' : '#999'}
        />
      </TouchableOpacity>
    </View>
  );
}

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{ headerShown: false }}
      tabBar={props => <CustomTabBar {...props} />}
    >
      <Tabs.Screen name="feed" />
      <Tabs.Screen name="index" />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingTop: 12,
    paddingHorizontal: 24,
    backgroundColor: '#F5F0EB',
    borderTopWidth: 1,
    borderTopColor: '#E8E3DD',
  },
  sideBtn: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 8,
  },
  plusWrap: {
    width: 72,
    alignItems: 'center',
  },
  plusBtn: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#2D2D2D',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: -28,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
});
