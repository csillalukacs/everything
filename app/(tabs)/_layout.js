import { Ionicons } from '@expo/vector-icons';
import { Tabs, useRouter } from 'expo-router';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useCollection } from '../../lib/CollectionProvider';
import { S } from '../../shared/strings';
import { C } from '../../shared/theme';

const TAB_BAR_HEIGHT = 70;

function CustomTabBar({ state, navigation }) {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { unreadNotifications } = useCollection();
  const currentRoute = state.routes[state.index]?.name;

  function go(name) {
    if (currentRoute !== name) navigation.navigate(name);
  }

  return (
    <View style={[styles.bar, { paddingBottom: Math.max(insets.bottom, 12) }]}>
      <TouchableOpacity
        style={styles.tabBtn}
        onPress={() => go('feed')}
        accessibilityLabel={S.a11y.feed}
      >
        <Ionicons
          name={currentRoute === 'feed' ? 'home' : 'home-outline'}
          size={26}
          color={currentRoute === 'feed' ? C.ink : '#999'}
        />
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.tabBtn}
        onPress={() => go('today')}
        accessibilityLabel={S.a11y.today}
      >
        <Ionicons
          name={currentRoute === 'today' ? 'today' : 'today-outline'}
          size={24}
          color={currentRoute === 'today' ? C.ink : '#999'}
        />
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.tabBtn}
        onPress={() => router.push('/notifications')}
        accessibilityLabel={S.a11y.notifications}
      >
        <View>
          <Ionicons name="notifications-outline" size={24} color="#999" />
          {unreadNotifications > 0 && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{unreadNotifications > 99 ? '99+' : unreadNotifications}</Text>
            </View>
          )}
        </View>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.tabBtn}
        onPress={() => go('index')}
        accessibilityLabel={S.a11y.yourCollection}
      >
        <Ionicons
          name={currentRoute === 'index' ? 'person-circle' : 'person-circle-outline'}
          size={28}
          color={currentRoute === 'index' ? C.ink : '#999'}
        />
      </TouchableOpacity>
    </View>
  );
}

function FloatingAddButton() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { batchModeActive } = useCollection();
  if (batchModeActive) return null;
  const bottomOffset = TAB_BAR_HEIGHT + Math.max(insets.bottom, 12) + 12;
  return (
    <TouchableOpacity
      style={[styles.fab, { bottom: bottomOffset }]}
      onPress={() => router.push('/add')}
      accessibilityLabel={S.a11y.addItem}
      activeOpacity={0.85}
    >
      <Ionicons name="add" size={30} color="#fff" />
    </TouchableOpacity>
  );
}

export default function TabsLayout() {
  return (
    <View style={{ flex: 1 }}>
      <Tabs
        screenOptions={{ headerShown: false }}
        tabBar={props => <CustomTabBar {...props} />}
      >
        <Tabs.Screen name="feed" />
        <Tabs.Screen name="today" />
        <Tabs.Screen name="index" />
      </Tabs>
      <FloatingAddButton />
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingTop: 6,
    paddingHorizontal: 24,
    backgroundColor: C.bg,
    borderTopWidth: 1,
    borderTopColor: C.surface,
  },
  tabBtn: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 8,
  },
  badge: {
    position: 'absolute',
    top: -4,
    right: -6,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    paddingHorizontal: 4,
    backgroundColor: C.red,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '700',
  },
  fab: {
    position: 'absolute',
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: C.ink,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 6,
  },
});
