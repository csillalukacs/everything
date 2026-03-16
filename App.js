import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { supabase } from './lib/supabase';

export default function App() {
  const [items, setItems] = useState([]);
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchItems();
  }, []);

  async function fetchItems() {
    const { data, error } = await supabase
      .from('items')
      .select('*')
      .order('created_at', { ascending: false });
    if (!error) setItems(data);
    setLoading(false);
  }

  async function addItem() {
    if (!name.trim()) return;
    const { data, error } = await supabase
      .from('items')
      .insert({ name: name.trim() })
      .select()
      .single();
    if (!error) {
      setItems([data, ...items]);
      setName('');
    }
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>everything</Text>
      <Text style={styles.subtitle}>your personal inventory</Text>

      <View style={styles.inputRow}>
        <TextInput
          style={styles.input}
          placeholder="add an item..."
          placeholderTextColor="#bbb"
          value={name}
          onChangeText={setName}
          onSubmitEditing={addItem}
          returnKeyType="done"
        />
        <TouchableOpacity style={styles.button} onPress={addItem}>
          <Text style={styles.buttonText}>+</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <ActivityIndicator color="#999" style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <Text style={styles.item}>{item.name}</Text>
          )}
          style={styles.list}
        />
      )}

      <StatusBar style="dark" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F0EB',
    paddingTop: 80,
    paddingHorizontal: 24,
  },
  title: {
    fontSize: 40,
    fontWeight: '300',
    letterSpacing: 2,
    color: '#2D2D2D',
  },
  subtitle: {
    fontSize: 14,
    color: '#999',
    marginTop: 8,
    letterSpacing: 1,
    marginBottom: 32,
  },
  inputRow: {
    flexDirection: 'row',
    gap: 8,
  },
  input: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    color: '#2D2D2D',
  },
  button: {
    backgroundColor: '#2D2D2D',
    borderRadius: 10,
    width: 46,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: {
    color: '#fff',
    fontSize: 24,
    lineHeight: 28,
  },
  list: {
    marginTop: 24,
  },
  item: {
    fontSize: 16,
    color: '#2D2D2D',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E8E3DE',
  },
});
