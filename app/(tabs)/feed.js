import { StyleSheet, Text, View } from 'react-native';

export default function Feed() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>feed</Text>
      <Text style={styles.subtitle}>coming soon</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F0EB',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  title: {
    fontSize: 32,
    fontWeight: '300',
    letterSpacing: 1,
    color: '#2D2D2D',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: '#999',
  },
});
