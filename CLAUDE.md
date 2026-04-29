# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npx expo start          # Start dev server (opens Expo Go / Metro bundler)
npx expo run:ios        # Build and run on iOS simulator
npx expo run:android    # Build and run on Android emulator
npx expo start --web    # Run in browser (limited — native-only APIs won't work)
```

No test suite or linter is configured.

## Architecture

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
