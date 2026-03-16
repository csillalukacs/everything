import { useState } from 'react';
import {
  Alert,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { supabase } from '../lib/supabase';

export default function AuthScreen() {
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  async function sendCode() {
    if (!email.trim()) return;
    setLoading(true);
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { shouldCreateUser: true },
    });
    setLoading(false);
    if (error) {
      Alert.alert('Error', error.message);
    } else {
      setSent(true);
    }
  }

  async function verifyCode() {
    if (!code.trim()) return;
    setLoading(true);
    const { error } = await supabase.auth.verifyOtp({
      email: email.trim(),
      token: code.trim(),
      type: 'email',
    });
    setLoading(false);
    if (error) Alert.alert('Error', error.message);
    // on success, onAuthStateChange in App.js will update the session
  }

  if (sent) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>everything</Text>
        <Text style={styles.subtitle}>check your email</Text>
        <Text style={styles.hint}>enter the 8-digit code we sent to {email}</Text>

        <TextInput
          style={styles.input}
          placeholder="00000000"
          placeholderTextColor="#bbb"
          value={code}
          onChangeText={setCode}
          keyboardType="number-pad"
          maxLength={8}
          returnKeyType="done"
          onSubmitEditing={verifyCode}
        />
        <TouchableOpacity
          style={[styles.button, loading && styles.buttonDisabled]}
          onPress={verifyCode}
          disabled={loading}
        >
          <Text style={styles.buttonText}>
            {loading ? 'verifying...' : 'verify'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.back} onPress={() => setSent(false)}>
          <Text style={styles.backText}>use a different email</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>everything</Text>
      <Text style={styles.subtitle}>your personal inventory</Text>

      <TextInput
        style={styles.input}
        placeholder="your email"
        placeholderTextColor="#bbb"
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        keyboardType="email-address"
        returnKeyType="done"
        onSubmitEditing={sendCode}
      />
      <TouchableOpacity
        style={[styles.button, loading && styles.buttonDisabled]}
        onPress={sendCode}
        disabled={loading}
      >
        <Text style={styles.buttonText}>
          {loading ? 'sending...' : 'send code'}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F0EB',
    paddingTop: 120,
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
    marginBottom: 48,
  },
  hint: {
    fontSize: 14,
    color: '#666',
    marginBottom: 24,
  },
  input: {
    backgroundColor: '#fff',
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: '#2D2D2D',
    marginBottom: 12,
  },
  button: {
    backgroundColor: '#2D2D2D',
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
  },
  back: {
    marginTop: 24,
    alignItems: 'center',
  },
  backText: {
    color: '#999',
    fontSize: 14,
    textDecorationLine: 'underline',
  },
});
