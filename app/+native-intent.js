// Expo Router calls this for every incoming deep link before resolving a route.
//
// When iOS opens the app through the share extension it hands the router a URL
// like `things://dataUrl=<key>`, which matches no route and flashes the
// "Unmatched Route" screen. We catch that URL and redirect to `/` so the app
// lands on home; the useShareIntent effect in app/_layout.js then reads the
// shared file and pushes /add.
//
// Share intent only ships on distribution builds (see featureFlags.js), so on a
// local free-team build we never require the package — every other deep link
// passes through untouched.
import { SHARE_INTENT } from '../featureFlags';

export function redirectSystemPath({ path }) {
  if (SHARE_INTENT) {
    try {
      const { getShareExtensionKey } = require('expo-share-intent');
      if (path.includes(`dataUrl=${getShareExtensionKey()}`)) {
        return '/';
      }
    } catch {
      return '/';
    }
  }
  return path;
}
