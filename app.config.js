// Dynamic config layered on top of app.json. Expo reads app.json first and
// passes it here as `config`; we return it with conditional tweaks.
//
// The only thing this adds today: when APPLE_SIGN_IN is on, the
// expo-apple-authentication plugin is included so prebuild writes the
// com.apple.developer.applesignin entitlement. The same flag gates the Apple
// button at runtime (see screens/AuthScreen.js), so both stay in sync.
const { APPLE_SIGN_IN } = require('./featureFlags');

module.exports = ({ config }) => {
  const plugins = [...(config.plugins || [])];
  if (APPLE_SIGN_IN && !plugins.includes('expo-apple-authentication')) {
    plugins.push('expo-apple-authentication');
  }
  return { ...config, plugins };
};
