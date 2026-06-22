// Dynamic config layered on top of app.json. Expo reads app.json first and
// passes it here as `config`; we return it with conditional tweaks.
//
// All three of these gate config plugins that write paid-account entitlements,
// so they are added only on a distribution build (see featureFlags.js). When the
// flag is off (local free-team build) the plugin is not added, so prebuild writes
// no entitlement and signing succeeds. Each flag also gates the matching runtime
// code (AuthScreen / share intent / lib/push) so build + JS stay in sync.
const {
  APPLE_SIGN_IN,
  SHARE_INTENT,
  PUSH_NOTIFICATIONS,
  SHARE_INTENT_APP_GROUP,
} = require('./featureFlags');

module.exports = ({ config }) => {
  const plugins = [...(config.plugins || [])];
  if (APPLE_SIGN_IN && !plugins.includes('expo-apple-authentication')) {
    plugins.push('expo-apple-authentication');
  }

  // Share extension. Needs an iOS App Group entitlement (paid account), so it is
  // added only on a distribution build. The App Group id must match the one
  // registered on the paid team. androidIntentFilters lets the OS offer "things"
  // when sharing an image on Android.
  if (SHARE_INTENT) {
    plugins.push([
      'expo-share-intent',
      {
        iosAppGroupIdentifier: SHARE_INTENT_APP_GROUP,
        iosActivationRules: { NSExtensionActivationSupportsImageWithMaxCount: 1 },
        androidIntentFilters: ['image/*'],
      },
    ]);
  }

  // Push notifications. expo-notifications adds the aps-environment entitlement at
  // build time; pairs with the APNs key in the Expo/EAS credentials (paid account)
  // and lib/push at runtime.
  if (PUSH_NOTIFICATIONS && !plugins.includes('expo-notifications')) {
    plugins.push('expo-notifications');
  }

  // Google Maps SDK for Android key. react-native-maps' MapView crashes on Android
  // at onCreate without it; the StatsScreen map is gated on this key being present
  // (see screens/StatsScreen.js). Supply via the GOOGLE_MAPS_ANDROID_KEY env var
  // (EAS secret / .env). iOS uses Apple Maps and needs no key.
  const android = { ...(config.android || {}) };
  const mapsKey = process.env.GOOGLE_MAPS_ANDROID_KEY;
  if (mapsKey) {
    android.config = {
      ...(android.config || {}),
      googleMaps: { ...(android.config?.googleMaps || {}), apiKey: mapsKey },
    };
  }

  return { ...config, plugins, android };
};
