import * as AuthSession from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';
import { useState } from 'react';
import { StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { supabase } from '../lib/supabase';
import { S } from '../shared/strings';
import { C } from '../shared/theme';

WebBrowser.maybeCompleteAuthSession();

export default function AuthScreen() {
  const [showEmail, setShowEmail] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  async function signInWithGoogle() {
    const redirectUrl = AuthSession.makeRedirectUri();
    console.log('redirect URL:', redirectUrl);

    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: redirectUrl,
        skipBrowserRedirect: true,
      },
    });

    if (error || !data.url) return;

    const result = await WebBrowser.openAuthSessionAsync(data.url, redirectUrl);

    if (result.type === 'success') {
      const url = result.url;
      const params = new URLSearchParams(url.split('#')[1] || url.split('?')[1]);
      const access_token = params.get('access_token');
      const refresh_token = params.get('refresh_token');

      if (access_token) {
        await supabase.auth.setSession({ access_token, refresh_token });
      }
    }
  }

  async function signInWithEmail() {
    setError(null);
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password,
    });
    setLoading(false);
    if (error) setError(S.auth.signInFailed);
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{S.appName}</Text>
      <Text style={styles.subtitle}>{S.appTagline}</Text>

      <TouchableOpacity style={styles.button} onPress={signInWithGoogle}>
        <Text style={styles.buttonText}>{S.auth.continueWithGoogle}</Text>
      </TouchableOpacity>

      {showEmail ? (
        <View style={styles.emailForm}>
          <TextInput
            style={styles.input}
            placeholder={S.auth.emailPlaceholder}
            placeholderTextColor={C.muted}
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            textContentType="emailAddress"
          />
          <TextInput
            style={styles.input}
            placeholder={S.auth.passwordPlaceholder}
            placeholderTextColor={C.muted}
            value={password}
            onChangeText={setPassword}
            autoCapitalize="none"
            autoCorrect={false}
            secureTextEntry
            textContentType="password"
          />
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <TouchableOpacity
            style={[styles.button, loading && styles.buttonDisabled]}
            onPress={signInWithEmail}
            disabled={loading}
          >
            <Text style={styles.buttonText}>{S.auth.signIn}</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <TouchableOpacity style={styles.emailToggle} onPress={() => setShowEmail(true)}>
          <Text style={styles.emailToggleText}>{S.auth.useEmail}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: C.bg,
    paddingTop: 120,
    paddingHorizontal: 24,
  },
  title: {
    fontSize: 40,
    fontWeight: '300',
    letterSpacing: 2,
    color: C.ink,
  },
  subtitle: {
    fontSize: 14,
    color: '#999',
    marginTop: 8,
    letterSpacing: 1,
    marginBottom: 48,
  },
  button: {
    backgroundColor: C.ink,
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
  emailToggle: {
    marginTop: 16,
    alignItems: 'center',
  },
  emailToggleText: {
    color: C.muted,
    fontSize: 14,
  },
  emailForm: {
    marginTop: 24,
    gap: 12,
  },
  input: {
    borderWidth: 1.5,
    borderColor: C.line,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    color: C.ink,
  },
  error: {
    color: C.redDark,
    fontSize: 14,
  },
});
