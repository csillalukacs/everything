# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Two apps in this repo

There are **two parallel apps** sharing the same Supabase backend:

1. **Mobile / native** — Expo React Native at the repo root, using **Expo Router** (file-based routing). Routes live under [`app/`](app/), screen components under [`screens/`](screens/). This is the primary app per the original design.
2. **Web** — a separate React + Vite app under [`web/`](web/) (`web/src/App.jsx`, `web/src/screens/*.jsx`). It is **not** built from the mobile app — it is a hand-written web port with its own components and CSS. When the user says "on web" or reports a browser-only issue, edit files under `web/src/`, not the root.

Features added to one app usually need to be mirrored in the other. Check both before assuming a feature is missing.

## Commands

```bash
# Mobile / native (root)
npx expo start          # Start dev server (opens Expo Go / Metro bundler)
npx expo run:ios        # Build and run on iOS simulator
npx expo run:android    # Build and run on Android emulator
npx expo start --web    # Runs the mobile app in a browser via react-native-web (limited — distinct from the web/ app)

# Web app (web/)
cd web && npm run dev      # Vite dev server
cd web && npm run build    # Production build to web/dist
```

No test suite or linter is configured.

## Architecture (mobile / native)

**everything** is an Expo React Native app ("a home for your stuff") — a personal item catalogue with photo capture, tagging, and a free-form collage canvas.

### State and data flow

App-wide state — `session`, `items`, `tags`, and all collection mutators (`addItem`, `updateItem`, `deleteItem`, `batchTagItems`, `deleteTag`, etc.) — lives in [`lib/CollectionProvider.js`](lib/CollectionProvider.js), exposed via `useCollection()`. Screen-local state (search query, active tag filter, batch selection, modal flags) lives in the screen file that uses it.

All database and storage operations go through Supabase (`lib/supabase.js`). The Supabase client uses `AsyncStorage` for session persistence. Items and tags are also cached in `AsyncStorage` keyed by user_id for fast cold starts.

### Data model (Supabase)

- **items** — `id`, `name`, `image_url`, `user_id`, `created_at`
- **tags** — `id`, `name`, `user_id`
- **item_tags** — junction table (`item_id`, `tag_id`)
- Items are fetched with `select('*, tags(id, name)')` so tags are embedded in each item object.
- Images are uploaded to the `item-images` Supabase Storage bucket as base64, keyed by `{user_id}/{timestamp}.{ext}`.

### Routes (`app/`)

The app uses a bottom tab bar with three buttons: **feed** (left), **+** (center, opens the add-item flow as a route), **collection** (right). The `+` is rendered by a custom tab bar inside [`app/(tabs)/_layout.js`](app/(tabs)/_layout.js) — it isn't an actual tab, it's a `router.push('/add')` button.

| Route file | Path | Role |
|---|---|---|
| `app/_layout.js` | — | Root: `SafeAreaProvider`, `CollectionProvider`, auth gate (`AuthScreen` if no session), `<Stack>` |
| `app/(tabs)/_layout.js` | — | Custom tab bar: feed \| + \| collection |
| `app/(tabs)/feed.js` | `/feed` | Feed (placeholder) |
| `app/(tabs)/index.js` | `/` | Your collection — profile-styled header (display_name, @username, item count), settings-gear top-right, search/grid/batch flows |
| `app/add.js` | `/add` | Camera/library → background removal → save (presented as transparent modal) |
| `app/settings.js` | `/settings` | Your own settings sheet (display name, username, logout) — reached via gear icon on `/` |
| `app/u/[slug].js` | `/u/<username\|uuid>` | Public profile view; redirects to `/` if `slug` resolves to current user |
| `app/canvas.js` | `/canvas` | Free-form collage canvas — currently hidden (no UI entry point), kept for future |

### Screen components (`screens/`)

These are reused by the routes above. Most are still rendered as `<Modal>` overlays from inside route files (transient flows like add-item, item-detail, batch-tag). Routes that use a `<Modal>`-based screen pass `visible={true}` and `onClose={() => router.back()}`.

| File | Role |
|---|---|
| `screens/AuthScreen.js` | Google OAuth via `expo-auth-session` + `expo-web-browser` |
| `screens/AddItemModal.js` | Camera capture or library pick → background removal → tag + name → upload |
| `screens/ItemDetailModal.js` | View/edit a single item; prev/next navigation through filtered list. Edit/delete buttons hidden when `onSave`/`onDelete` not provided (read-only mode) |
| `screens/BatchTagSheet.js` | Bottom sheet to apply tags to multiple selected items |
| `screens/CanvasScreen.js` | Free-form collage: drag/pinch/rotate items on a Skia canvas |
| `screens/ProfileScreen.js` | Your own settings sheet (mounted by `app/settings.js`) |
| `screens/ProfileViewScreen.js` | Read-only public profile (mounted by `app/u/[slug].js`) |
| `screens/OpenProfileSheet.js` | Bottom sheet to type/paste a username and navigate to `/u/<slug>` |

### Deep linking

The `scheme: "everything"` in `app.json` plus Expo Router's automatic linking config means `everything://u/alice` opens `/u/alice` natively. HTTPS universal links require additional platform-side setup (`apple-app-site-association`, `assetlinks.json`) — not yet configured.

### Key libraries

- **`@shopify/react-native-skia`** — used exclusively in `CanvasScreen` for rendering placed items, computing tight pixel bounds (`computeTightBounds`), and exporting as PNG.
- **`react-native-gesture-handler`** — simultaneous pan + pinch + rotation gestures in `CanvasScreen`. Gestures use `.runOnJS(true)` and refs to bridge async state.
- **`@jacobjmc/react-native-background-remover`** — called after every photo capture or library pick in `AddItemModal`.
- **`expo-auth-session` / `expo-web-browser`** — handles the Google OAuth redirect flow on both iOS and Android.

### Design conventions

- Color palette: `#F5F0EB` (warm beige bg), `#2D2D2D` (dark text/accent), `#E8E3DD` (secondary bg), `#999` (muted text).
- All styles are co-located with their component via `StyleSheet.create`.
- Tag names are always stored and compared lowercased. `ensureTags()` in `CollectionProvider` upserts tags by name and returns the resolved tag objects.
- Batch-select mode activates when `selectedIds.size > 0`; long-press on a card enters it.

## Architecture (web app)

The web app under [`web/`](web/) is a React + Vite SPA that talks to the same Supabase project.

- Entry: [`web/src/main.jsx`](web/src/main.jsx) → [`web/src/App.jsx`](web/src/App.jsx) (router) → [`web/src/screens/ProfilePage.jsx`](web/src/screens/ProfilePage.jsx) is the main screen.
- Routing uses `react-router-dom`; profiles live at `/:userId`.
- Styling is plain CSS in [`web/src/App.css`](web/src/App.css) — same color palette as the native app. No Tailwind, no CSS-in-JS.
- Modals/sheets are conditionally rendered `<div className="sheet-overlay">` blocks, not React Native `<Modal>`. The same color palette and class naming conventions are used.
- Supabase client lives at [`web/src/lib/supabase.js`](web/src/lib/supabase.js), separate from the mobile one.
- Screens roughly mirror the mobile screens (`AddItemModal.jsx`, `ItemDetailModal.jsx`, `BatchTagSheet.jsx`, `AuthScreen.jsx`, `ProfilePage.jsx`) but are independent re-implementations.
