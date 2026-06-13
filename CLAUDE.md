# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Two apps in this repo

There are **two parallel apps** sharing the same Supabase backend:

1. **Mobile / native** — Expo React Native at the repo root, using **Expo Router** (file-based routing). Routes live under [`app/`](app/), screen components under [`screens/`](screens/). This is the primary app per the original design.
2. **Web** — a separate React + Vite app under [`web/`](web/) (`web/src/App.jsx`, `web/src/screens/*.jsx`). It is **not** built from the mobile app — it is a hand-written web port with its own components and CSS. When the user says "on web" or reports a browser-only issue, edit files under `web/src/`, not the root.

Features added to one app usually need to be mirrored in the other. Check both before assuming a feature is missing.

### Shared code ([`shared/`](shared/))

Platform-agnostic JavaScript shared by both apps lives at [`shared/`](shared/). Modules here must have **no React, no React Native, no DOM, no AsyncStorage/localStorage** — pure JS only. Both Metro and Vite resolve relative imports here directly (`../shared/...` from mobile, `../../../shared/...` from `web/src/screens/`).

Current modules:
- [`shared/itemsApi.js`](shared/itemsApi.js) — `fetchAllItems(client, opts)` (paginates internally via `.range()`, page size 1000, safe past PostgREST `db-max-rows`), `fetchPublicFeed(client, { limit })` for the cross-user public feed, `fetchItemCount(client, opts)` (uses `count: 'exact', head: true`). Pass a Supabase client; both apps' clients work. The `tags(id, name, is_private)` join is the default columns.
- [`shared/searchQuery.js`](shared/searchQuery.js) — the search DSL parser + matcher used by both apps. Supports `tag:`, `acquired:` (alias `year:`), `added:` (alias `created:`), `used:` (alias `lastused:`, date on `last_used_on`), `uses:` (count on `usage_count`), `city:`, `name:`, `desc:` (alias `description:`), `ocr:`, plus quoted phrases, negation (`-tag:foo`), `OR` between adjacent tokens, range (`2020..2024`), comparisons (`>`, `<`), and special values (`none`, `today`, `yesterday`). Unknown fields silently match nothing. Tests in [`shared/searchQuery.test.js`](shared/searchQuery.test.js).
- [`shared/dates.js`](shared/dates.js) — `MONTH_NAMES`, day/week/month bucketing (`dayKey`, `weekKey`, `monthKey`, `bucketize`), date list generators (`lastNDays`, `lastNWeeks`, `lastNMonths`), streak math (`computeStreak`, `computeLongestStreak`), label formatters, `formatDateLabel`.
- [`shared/stats.js`](shared/stats.js) — `PIE_PALETTE`, `PIE_UNTAGGED_COLOR`, `buildTagDistribution(items)`, `computeYearStats(items)`, `buildMapGroups(items)`.
- [`shared/items.js`](shared/items.js) — `cityOf(loc)` (extracts city from "City, Country"), `acquiredFields(acquired)` (the standard `acquired_year/location/lat/lng` patch), helpers for `previous_images` array entries.
- [`shared/avatar.js`](shared/avatar.js) — `avatarInitial(profile)`, `avatarColor(profile)` (deterministic palette), `avatarSrc(profile)` (prefers `avatar_thumb_url`, falls back to `avatar_url`).
- [`shared/tagManagement.js`](shared/tagManagement.js) — `filterAndSortTags(tags, query)`, `validateTagRename(tag, draft, allTags)`.
- [`shared/cacheKeys.js`](shared/cacheKeys.js) — `itemsCacheKey(userId)`, `tagsCacheKey(userId)`, `dailyCacheKey(userId)`.
- [`shared/identifiers.js`](shared/identifiers.js) — `UUID_RE`, `USERNAME_RE`.
- [`shared/strings.js`](shared/strings.js) — centralised user-facing strings under `S.<area>.<key>`. Use these instead of hard-coding copy; both apps import `S` from here.

When you find code duplicated across mobile and web that's pure JS, prefer extracting to `shared/` over re-duplicating.

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

# Tests (shared only)
node --test shared/searchQuery.test.js
```

No linter is configured. Only [`shared/`](shared/) has tests today.

Manual test plan lives in [TESTING.md](TESTING.md) — keep it in sync when adding or changing user-facing behavior.

## Architecture (mobile / native)

**things** (the app's name in `app.json`, despite the repo being called `everything`) is an Expo React Native app ("a home for your stuff") — a personal item catalogue with photo capture, OCR, tagging, privacy controls, acquired-location tracking, a public feed, a stats dashboard, and a daily "Today" reveal.

### State and data flow

App-wide state — `session`, `items`, `tags`, profile data, and all collection mutators (`addItem`, `updateItem`, `deleteItem`, `batchEditItems`, `ensureTags`, `deleteTag`, `renameTag`, `setTagPrivacy`, etc.) — lives in [`lib/CollectionProvider.js`](lib/CollectionProvider.js), exposed via `useCollection()`. Screen-local state (search query, active tag filter, batch selection, modal flags) lives in the screen file that uses it.

All database and storage operations go through Supabase (`lib/supabase.js`). The Supabase client uses `AsyncStorage` for session persistence. Items and tags are cached in `AsyncStorage` keyed by user_id (`shared/cacheKeys.js`) for fast cold starts; the cache is overwritten on each successful fetch and cleared on sign-out.

### Data model (Supabase)

- **items** — `id`, `user_id`, `name`, `description`, `image_url`, `thumb_url`, `previous_images` (JSON array of `{ url, thumb_url, added_at }`), `image_added_at`, `is_private`, `ocr_text`, `acquired_year`, `acquired_location`, `acquired_lat`, `acquired_lng`, `created_at`, `updated_at`.
- **tags** — `id`, `user_id`, `name` (lowercased), `is_private`.
- **item_tags** — junction table (`item_id`, `tag_id`).
- **profiles** — `user_id`, `display_name`, `username` (lowercased, unique case-insensitive), `avatar_url`, `avatar_thumb_url`, `home_location`, `home_lat`, `home_lng`.
- Items are fetched with `select('*, tags(id, name, is_private)')` so tags are embedded in each item object.
- Schema patches are tracked under [`sql/`](sql/) — append a new file per change rather than mutating old ones.

### Image storage (Cloudflare R2)

Image uploads go through Supabase Edge Functions:
- [`supabase/functions/r2-presign`](supabase/functions/r2-presign) returns a presigned PUT URL. The client uploads the main image and a baked WebP thumbnail (≤400 px) separately. The function returns the public URLs.
- [`supabase/functions/r2-delete`](supabase/functions/r2-delete) removes objects when an item is deleted (or when an entry leaves `previous_images`). Failure is logged, not surfaced — orphans are acceptable.

Thumbnails are baked client-side (Skia on mobile, canvas on web) at upload time; do **not** add server-side image transformation. Both `image_url` and `thumb_url` are persisted. The bucket is public — privacy is enforced by the items query, not by the storage layer (known gap, see TESTING.md PR11).

### Routes (`app/`)

The bottom tab bar has three icon tabs — **feed** (home), **today**, **collection** (profile) — plus a centered floating **+** button rendered by the custom tab bar in [`app/(tabs)/_layout.js`](app/(tabs)/_layout.js). The `+` is not a tab; it `router.push('/add')`s the add-item flow. Stats and Canvas are pushed routes, not tabs.

| Route file | Path | Role |
|---|---|---|
| `app/_layout.js` | — | Root: `SafeAreaProvider`, `CollectionProvider`, auth gate (`AuthScreen` if no session), `<Stack>` |
| `app/(tabs)/_layout.js` | — | Custom tab bar: feed \| today \| collection, with floating + |
| `app/(tabs)/feed.js` | `/feed` | Public feed across users (most recent 50 public items, via `fetchPublicFeed`) |
| `app/(tabs)/today.js` | `/today` | Daily 3×3 flip-card reveal of items, shuffled deterministically per day per user (`dailyCacheKey`) |
| `app/(tabs)/index.js` | `/` | Your collection — profile-styled header, settings gear, search/filter/grid/batch flows |
| `app/add.js` | `/add` | Camera/library → background removal → OCR → save (transparent modal route) |
| `app/stats.js` | `/stats` | Stats dashboard (totals, streaks, day/week/month buckets, tag pie, year distribution, acquired-city map) |
| `app/u/[slug].js` | `/u/<username\|uuid>` | Public profile view; redirects to `/` if `slug` resolves to current user |
| `app/canvas.js` | `/canvas` | Free-form Skia collage canvas — currently hidden (no UI entry point), kept for future |

### Screen components (`screens/`)

These are reused by the routes above. Most are rendered as `<Modal>` overlays from inside route files (transient flows). Routes that use a `<Modal>`-based screen pass `visible={true}` and `onClose={() => router.back()}`.

| File | Role |
|---|---|
| `screens/AuthScreen.js` | Google OAuth via `expo-auth-session` + `expo-web-browser` |
| `screens/AddItemModal.js` | Camera capture or library pick → background removal → OCR → tag + name + acquired fields → upload |
| `screens/CameraCaptureModal.js` | Standalone camera screen (also reachable from item-detail "replace photo") |
| `screens/ItemDetailModal.js` | View/edit a single item; prev/next through filtered list; `onTagPress`/`onYearPress`/`onCityPress` callbacks let the parent re-filter the grid; multi-image swipe via `PhotoStrip`. Edit/delete hidden when `onSave`/`onDelete` not provided (read-only mode) |
| `screens/ItemFieldsEditor.js` | Editor for name + description + acquired_year + acquired_location (used by add + edit) |
| `screens/ItemGrid.js` | Square-tile grid used by your collection + public profile |
| `screens/PhotoStrip.js` | Multi-image carousel for an item's main photo + `previous_images` |
| `screens/TagInput.js` | Tag chip input with existing-tag suggestions, lock badges for private tags |
| `screens/TagFilterChips.js` | Horizontal tag-chip filter row with live counts |
| `screens/SearchBar.js` | Search input with clear-X; query string flows into `shared/searchQuery.js` |
| `screens/FilterSheet.js` | Year / city / date filter bottom sheet |
| `screens/BatchBar.js` | Top bar in batch-select mode (count, privacy toggle, delete, edit, cancel) |
| `screens/BatchEditSheet.js` | Bottom sheet to additively apply tags / acquired year to selected items |
| `screens/ManageTagsSheet.js` | Rename, delete, toggle privacy on tags; search within |
| `screens/LocationPicker.js` | Map + geocoding picker for acquired_location and home_location |
| `screens/Avatar.js` | Renders profile avatar (image or initial-on-color), shared by header + feed |
| `screens/ProfileScreen.js` | Your own settings sheet — mounted in-tree by `app/(tabs)/index.js`, opened via gear icon |
| `screens/ProfileViewScreen.js` | Read-only public profile (mounted by `app/u/[slug].js`) |
| `screens/OpenProfileSheet.js` | Bottom sheet to type/paste a username/UUID/URL and navigate to `/u/<slug>` |
| `screens/StatsScreen.js` | Stats dashboard route body |
| `screens/StatsComponents.js` | `StatCard`, `Bar`, `PieChart`, etc. — shared by `StatsScreen` |
| `screens/BottomSheet.js` | Reusable sheet primitive used by most bottom sheets |
| `screens/CanvasScreen.js` | Free-form collage: drag/pinch/rotate items on a Skia canvas (hidden) |

### Deep linking

The `scheme: "things"` in `app.json` plus Expo Router's automatic linking config means `things://u/alice` opens `/u/alice` natively. HTTPS universal links require additional platform-side setup (`apple-app-site-association`, `assetlinks.json`) — not yet configured.

### Key libraries

- **`@shopify/react-native-skia`** — used in `CanvasScreen` (compositing) and at upload time for thumbnail baking + tight pixel bounds (`computeTightBounds`).
- **`react-native-gesture-handler`** — simultaneous pan + pinch + rotation in `CanvasScreen` (gestures use `.runOnJS(true)` and refs to bridge async state).
- **`@jacobjmc/react-native-background-remover`** — called after every photo capture or library pick in `AddItemModal` / `CameraCaptureModal`.
- **`expo-auth-session` / `expo-web-browser`** — Google OAuth redirect flow on iOS and Android.
- **`expo-image`** — used for grid thumbnails with `cachePolicy: 'memory-disk'`; `Image.prefetch` is called eagerly after upload to keep grid scroll smooth.
- **`react-native-maps`** — acquired-city map in `StatsScreen` and the location picker.

## Architecture (web app)

The web app under [`web/`](web/) is a React + Vite SPA that talks to the same Supabase project.

- Entry: [`web/src/main.jsx`](web/src/main.jsx) → [`web/src/App.jsx`](web/src/App.jsx) (router + feed) → screens.
- Routing uses `react-router-dom`. The web app's own home (`/`) renders the public feed inside `App.jsx` (calls `fetchPublicFeed`); profiles live at `/:userId`; the active item is reflected in `?item=<id>`.
- Styling is plain CSS in [`web/src/App.css`](web/src/App.css) — same color palette as the native app. No Tailwind, no CSS-in-JS.
- Modals/sheets are conditionally rendered `<div className="sheet-overlay">` blocks (not React Native `<Modal>`); same class naming conventions throughout.
- Supabase client lives at [`web/src/lib/supabase.js`](web/src/lib/supabase.js); localStorage caching lives in [`web/src/lib/cache.js`](web/src/lib/cache.js) (uses `shared/cacheKeys.js` keys); geocoding helpers in [`web/src/lib/geocode.js`](web/src/lib/geocode.js).
- Web screens (`web/src/screens/`): `AuthScreen`, `ProfilePage` (your-or-their grid), `SettingsPage` (web analog of `ProfileScreen`), `AddItemModal`, `ItemDetailModal`, `BatchEditSheet`, `ManageTagsSheet`, `FilterDropdown`, `LocationPicker`, `TagInput`, `StatsPage`. Web reusable components live under `web/src/components/` (`Avatar`, `Icons`, `LockIcon`, `SearchBar`, `StatsComponents`, `TagFilterChips`).
- Map on web uses Leaflet; mobile uses `react-native-maps`. Both consume `buildMapGroups()` from `shared/stats.js`.
- Web parity gaps to be aware of: there is no web equivalent of the **Today** screen or **Canvas**.

## Coding guidelines

These are repo-specific conventions. Apply them when writing or reviewing changes here. The general guidance in your system prompt (no premature abstraction, no unrequested error handling, no narration comments, etc.) still applies.

**Cross-app changes.** When you change a user-facing behavior, check whether the other app has the same surface and update it too. Don't ship visible drift between mobile and web without a reason.

**Where new code goes.**
- Pure JS that mobile and web both need → [`shared/`](shared/). No React/RN/DOM/storage imports allowed there.
- Mobile-only UI → [`screens/`](screens/) (component file) or [`app/`](app/) (route).
- Web-only UI → `web/src/screens/` (route-like) or `web/src/components/` (small reusable).
- Database/storage glue → [`lib/CollectionProvider.js`](lib/CollectionProvider.js) on mobile, the equivalent screen on web (web does not have a single provider; mutations are inline in their screens — match the convention rather than refactoring it on the side).

**Strings.** User-facing copy goes in [`shared/strings.js`](shared/strings.js) under `S.<area>.<key>`, imported on both sides. Don't hard-code copy in components.

**Tags.** Always stored and compared **lowercased** + trimmed. Use `ensureTags()` from `CollectionProvider` to upsert by name; never insert tags directly. Tag privacy is a separate `is_private` column — renaming a tag must not change its privacy.

**Privacy.**
- Items: `is_private` is the single source of truth. The lock badge in the grid and detail view reads from this. Default for new items is **public** (false).
- Tags: `is_private` per tag. Private tags must be hidden from non-owner views — filter them out in `ProfileViewScreen` / `ProfilePage` chip rows and inside `ItemDetailModal` when in read-only mode.
- Owner views always show everything regardless of privacy.
- The image bucket is public; do not rely on storage-level privacy.

**Search.** Anything search-shaped must go through [`shared/searchQuery.js`](shared/searchQuery.js). Don't add ad-hoc `.includes()` filtering on the items array. New fields go in `VALID_FIELDS`; aliases go in `FIELD_ALIASES`; add a unit test in `shared/searchQuery.test.js`.

**Dates.** Use the helpers in [`shared/dates.js`](shared/dates.js) for any bucketing, streak math, or formatted labels. Don't reach for `date-fns` or `dayjs` — the helpers are the project's idiom and avoid a dependency.

**Caching.** Cache keys come from [`shared/cacheKeys.js`](shared/cacheKeys.js). Cache write is **after** a successful fetch/mutation, not optimistically — the optimistic state lives in memory. Cache is cleared on sign-out.

**Images.**
- Upload via `r2-presign`; never PUT directly to a Supabase storage bucket.
- Always bake a `thumb_url` at upload time. Grids and avatars must consume thumbs, not full-resolution images.
- Use `Image.prefetch(thumb_url || image_url, { cachePolicy: 'memory-disk' })` after upload so the next grid render is hot.
- When an item gets a new photo, push the old `{ image_url, thumb_url, image_added_at }` into `previous_images` rather than discarding it.

**Schema changes.** Add a new file under [`sql/`](sql/) — don't mutate existing ones. Update the data-model section above when you do.

**Avatars.** Always render via the `Avatar` component (mobile) or `Avatar` (web) so the initial-on-color fallback stays consistent. Use `avatarSrc(profile)` from `shared/avatar.js` to pick the URL — it prefers the thumbnail.

**Identifiers.** Use `UUID_RE` and `USERNAME_RE` from [`shared/identifiers.js`](shared/identifiers.js) anywhere you parse a slug (search sheet, route guard, profile resolution).

**Design system.**
- Color palette ("Bauhaus on white" — high contrast, no beige/orange). The single source of truth is [`shared/theme.js`](shared/theme.js) (the `C` object), mirrored as CSS variables in the `:root` block of [`web/src/App.css`](web/src/App.css). Re-skinning the app = editing those two places. Core tokens: `bg` `#FFFFFF`, `surface` `#F2F2F2`, `line` `#E0E0E0`, `ink` `#111111` (text/dark accents/strong borders), `muted` `#999`, accents `red` `#E53935` / `blue` `#1E88E5` / `yellow` `#FDD835` (plus `redDark`/`redSoft` for destructive states). **Don't hard-code hex for these** — import `C` (mobile) or use `var(--token)` (web CSS). Categorical palettes (avatar, pie chart, usage-recency tints) live in `shared/avatar.js`, `shared/stats.js`, `shared/dates.js`. Don't introduce new accent colors without a reason.
- Mobile: styles are co-located via `StyleSheet.create` at the bottom of each component file; reference `C` from `shared/theme` for color values.
- Web: plain CSS classes in `web/src/App.css`; reuse existing class names (`sheet-overlay`, `chip`, `card`, etc.) before inventing new ones.

**Batch mode (mobile).** Activated when `selectedIds.size > 0`; entered via long-press on a card. Cards in batch mode show the selection circle in place of the lock badge. Batch tag edits must be **additive** — never strip existing tags.

**TESTING.md.** When you add or change a user-facing behavior, add or update the matching `Xn` row in [TESTING.md](TESTING.md). Tag with `(Mobile)`, `(Web)`, or `(Both)`. If you find the test plan disagrees with the code, the code is usually right — fix the plan.
