// Single source of truth for build-time + runtime feature toggles.
//
// CommonJS on purpose: this file is `require`d by app.config.js (Node, during
// prebuild) AND imported by app screens (React Native, via Metro). CommonJS
// resolves cleanly in both worlds.
//
// IS_DISTRIBUTION is the one switch. It is on only for the paid-team /
// TestFlight build and off for everyday local free-team builds. All three
// features below need a *paid* Apple Developer account at build time
// (entitlements / capabilities), so they are derived from it:
//   - APPLE_SIGN_IN       -> com.apple.developer.applesignin entitlement
//   - SHARE_INTENT        -> iOS App Group entitlement (share extension)
//   - PUSH_NOTIFICATIONS  -> aps-environment entitlement + APNs key
//
// The EXPO_PUBLIC_ prefix is mandatory: babel-preset-expo inlines EXPO_PUBLIC_*
// into the JS bundle, so the value is identical in Node (app.config.js during
// prebuild) AND at runtime (AuthScreen / lib/push read these). A plain var would
// be undefined at runtime -> native config and JS would drift.
//
// Turn on for a distribution build by setting the var for the WHOLE build
// (prebuild + archive), e.g.:
//   EXPO_PUBLIC_THINGS_DISTRIBUTION=1 npx expo run:ios --configuration Release
// or `export` it, then launch Xcode from that same shell. After flipping, run
// `npx expo prebuild --clean` so the native project picks up the entitlements.
const IS_DISTRIBUTION = process.env.EXPO_PUBLIC_THINGS_DISTRIBUTION === '1';

// iOS App Group shared by the main app and the share extension. Must match the
// App Group registered on the paid Apple Developer account.
const SHARE_INTENT_APP_GROUP = 'group.xyz.whimsylabs.things';

module.exports = {
  IS_DISTRIBUTION,
  APPLE_SIGN_IN: IS_DISTRIBUTION,
  SHARE_INTENT: IS_DISTRIBUTION,
  PUSH_NOTIFICATIONS: IS_DISTRIBUTION,
  SHARE_INTENT_APP_GROUP,
};
