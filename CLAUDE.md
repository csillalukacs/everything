# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Two apps in this repo

There are **two parallel apps** sharing the same Supabase backend:

1. **Mobile / native** — Expo React Native at the repo root (`App.js`, `screens/*.js`). This is the primary app per the original design.
2. **Web** — a separate React + Vite app under [`web/`](web/) (`web/src/App.jsx`, `web/src/screens/*.jsx`). It is **not** built from `App.js` — it is a hand-written web port with its own components and CSS. When the user says "on web" or reports a browser-only issue, edit files under `web/src/`, not the root.

Features added to one app usually need to be mirrored in the other. Check both before assuming a feature is missing.

## Commands

```bash
# Mobile / native (root)
npx expo start          # Start dev server (opens Expo Go / Metro bundler)
npx expo run:ios        # Build and run on iOS simulator
npx expo run:android    # Build and run on Android emulator
npx expo start --web    # Runs App.js in a browser via react-native-web (limited — distinct from the web/ app)

# Web app (web/)
cd web && npm run dev      # Vite dev server
cd web && npm run build    # Production build to web/dist
```

No test suite or linter is configured.

## Architecture (mobile / native)

**everything** is an Expo React Native app ("a home for your stuff") — a personal item catalogue with photo capture, tagging, and a free-form collage canvas.

### State and data flow

`App.js` is the single root component and owns all application state: `session`, `items`, `tags`, `activeTag`, `selectedItem`, `selectedIds`, and modal visibility flags. There is no navigation library or global state manager — everything flows down via props and up via callbacks.

All database and storage operations go through Supabase (`lib/supabase.js`). The Supabase client uses `AsyncStorage` for session persistence.

### Data model (Supabase)

- **items** — `id`, `name`, `image_url`, `user_id`, `created_at`
- **tags** — `id`, `name`, `user_id`
- **item_tags** — junction table (`item_id`, `tag_id`)
- Items are fetched with `select('*, tags(id, name)')` so tags are embedded in each item object.
- Images are uploaded to the `item-images` Supabase Storage bucket as base64, keyed by `{user_id}/{timestamp}.{ext}`.

### Screens (all rendered as `<Modal>` overlays, not navigation routes)

| File | Role |
|---|---|
| `screens/AuthScreen.js` | Google OAuth via `expo-auth-session` + `expo-web-browser` |
| `screens/AddItemModal.js` | Camera capture or library pick → background removal → tag + name → upload |
| `screens/ItemDetailModal.js` | View/edit a single item; prev/next navigation through filtered list |
| `screens/BatchTagSheet.js` | Bottom sheet to apply tags to multiple selected items |
| `screens/CanvasScreen.js` | Free-form collage: drag/pinch/rotate items on a Skia canvas |

### Key libraries

- **`@shopify/react-native-skia`** — used exclusively in `CanvasScreen` for rendering placed items, computing tight pixel bounds (`computeTightBounds`), and exporting as PNG.
- **`react-native-gesture-handler`** — simultaneous pan + pinch + rotation gestures in `CanvasScreen`. Gestures use `.runOnJS(true)` and refs to bridge async state.
- **`@jacobjmc/react-native-background-remover`** — called after every photo capture or library pick in `AddItemModal`.
- **`expo-auth-session` / `expo-web-browser`** — handles the Google OAuth redirect flow on both iOS and Android.

### Design conventions

- Color palette: `#F5F0EB` (warm beige bg), `#2D2D2D` (dark text/accent), `#E8E3DD` (secondary bg), `#999` (muted text).
- All styles are co-located with their component via `StyleSheet.create`.
- Tag names are always stored and compared lowercased. `ensureTags()` in `App.js` upserts tags by name and returns the resolved tag objects.
- Batch-select mode activates when `selectedIds.size > 0`; long-press on a card enters it.

## Architecture (web app)

The web app under [`web/`](web/) is a React + Vite SPA that talks to the same Supabase project.

- Entry: [`web/src/main.jsx`](web/src/main.jsx) → [`web/src/App.jsx`](web/src/App.jsx) (router) → [`web/src/screens/ProfilePage.jsx`](web/src/screens/ProfilePage.jsx) is the main screen.
- Routing uses `react-router-dom`; profiles live at `/:userId`.
- Styling is plain CSS in [`web/src/App.css`](web/src/App.css) — same color palette as the native app. No Tailwind, no CSS-in-JS.
- Modals/sheets are conditionally rendered `<div className="sheet-overlay">` blocks, not React Native `<Modal>`. The same color palette and class naming conventions are used.
- Supabase client lives at [`web/src/lib/supabase.js`](web/src/lib/supabase.js), separate from the mobile one.
- Screens roughly mirror the mobile screens (`AddItemModal.jsx`, `ItemDetailModal.jsx`, `BatchTagSheet.jsx`, `AuthScreen.jsx`, `ProfilePage.jsx`) but are independent re-implementations.
