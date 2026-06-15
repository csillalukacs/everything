import * as AuthSession from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';
import { useState } from 'react';
import { Modal, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { supabase } from '../lib/supabase';
import { S } from '../shared/strings';
import { C } from '../shared/theme';
import { APPLE_SIGN_IN } from '../featureFlags';

WebBrowser.maybeCompleteAuthSession();

// APPLE_SIGN_IN comes from featureFlags.js — the same flag app.config.js uses to
// add the entitlement-bearing plugin, so build + runtime can't drift. The native
// module is `require`d lazily (not statically imported) so that when the flag is
// off, its native view manager is never touched and the app runs without the
// entitlement. See featureFlags.js for how to turn it on.
const AppleAuthentication = APPLE_SIGN_IN ? require('expo-apple-authentication') : null;

export default function AuthScreen() {
  const [showEmail, setShowEmail] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [termsVisible, setTermsVisible] = useState(false);

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

  async function signInWithApple() {
    setError(null);
    try {
      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
      });
      if (credential.identityToken) {
        const { error } = await supabase.auth.signInWithIdToken({
          provider: 'apple',
          token: credential.identityToken,
        });
        if (error) setError(S.auth.signInFailed);
      }
    } catch (e) {
      if (e.code === 'ERR_REQUEST_CANCELED') return;
      console.warn('Apple sign-in failed:', e?.code, e?.message, e);
      setError(`${S.auth.signInFailed} (${e?.code || 'unknown'})`);
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

      {APPLE_SIGN_IN && Platform.OS === 'ios' && (
        <AppleAuthentication.AppleAuthenticationButton
          buttonType={AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN}
          buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
          cornerRadius={10}
          style={styles.appleButton}
          onPress={signInWithApple}
        />
      )}

      {error && !showEmail ? <Text style={styles.errorTop}>{error}</Text> : null}

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

      <Text style={styles.terms}>
        {S.auth.agreePrefix}
        <Text style={styles.termsLink} onPress={() => setTermsVisible(true)}>{S.legal.termsLink}</Text>
        {S.auth.agreeSuffix}
      </Text>

      <Modal visible={termsVisible} animationType="slide" onRequestClose={() => setTermsVisible(false)}>
        <View style={styles.termsModal}>
          <View style={styles.termsHeader}>
            <Text style={styles.termsTitle}>{S.legal.termsTitle}</Text>
            <TouchableOpacity onPress={() => setTermsVisible(false)} hitSlop={8}>
              <Text style={styles.termsClose}>{S.common.done}</Text>
            </TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={styles.termsBody} showsVerticalScrollIndicator={false}>
            {S.legal.body.map((para, i) => (
              <Text key={i} style={styles.termsPara}>{para}</Text>
            ))}
          </ScrollView>
        </View>
      </Modal>
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
  appleButton: {
    height: 48,
    marginTop: 12,
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
  errorTop: {
    color: C.redDark,
    fontSize: 14,
    marginTop: 16,
  },
  terms: {
    marginTop: 28,
    fontSize: 12,
    lineHeight: 18,
    color: C.muted,
  },
  termsLink: {
    color: C.ink,
    textDecorationLine: 'underline',
  },
  termsModal: {
    flex: 1,
    backgroundColor: C.bg,
    paddingTop: 60,
    paddingHorizontal: 24,
  },
  termsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  termsTitle: {
    fontSize: 22,
    fontWeight: '500',
    color: C.ink,
    flex: 1,
  },
  termsClose: {
    fontSize: 16,
    color: C.blue,
  },
  termsBody: {
    paddingBottom: 60,
    gap: 16,
  },
  termsPara: {
    fontSize: 15,
    lineHeight: 23,
    color: C.ink,
  },
});
