// Single source of truth for build-time + runtime feature toggles.
//
// CommonJS on purpose: this file is `require`d by app.config.js (Node, during
// prebuild) AND imported by app screens (React Native, via Metro). CommonJS
// resolves cleanly in both worlds.
//
// APPLE_SIGN_IN gates Sign in with Apple, which needs the
// `expo-apple-authentication` config plugin (adds the entitlement) AND the
// "Sign In with Apple" capability on a *paid* Apple Developer account.
//   - false: builds locally on a free/personal team; no Apple button, no entitlement.
//   - true:  app.config.js adds the plugin and AuthScreen renders the Apple button.
//
// After flipping this, run `npx expo prebuild --clean` so the native project
// picks up the entitlement change.
module.exports = {
  APPLE_SIGN_IN: false,
};
