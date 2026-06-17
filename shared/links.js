// Canonical share/deep-link URLs, shared by mobile + web so both apps agree on
// the exact path shape. These are https universal/app links: they open the
// native app when installed and fall back to the web app in a browser.
//
// Keep the path shape in sync with the routes:
//   mobile: app/u/[slug].js        -> /u/<slug>?item=<id>
//   web:    web/src/main.jsx       -> /u/:slug  (?item handled in App.jsx)

export const SITE_URL = 'https://things.whimsylabs.xyz';

// TestFlight beta invite for the iOS app, surfaced by the web "get the app"
// banner + header link. Replace with the real public TestFlight URL.
export const APP_TESTFLIGHT_URL = 'https://testflight.apple.com/join/RRrEReSj';

export const profileUrl = (slug) => `${SITE_URL}/u/${slug}`;

export const itemUrl = (slug, itemId) => `${profileUrl(slug)}?item=${itemId}`;
