# e2e smoke tests (Android + iOS)

Automated, repeatable end-to-end smoke tests for the `things` mobile app, driving a real
Android emulator / iOS simulator. Catches "did a change break a whole screen" regressions
(e.g. the Stats Google-Maps crash, or a missing new-user empty state) without manual clicking.

## How it works

`smoke.py` drives a **running** emulator/simulator and asserts expected content + absence
of a crash / React Native redbox at each step, screenshotting as it goes. It is
**label-driven**: it locates controls via the accessibility tree (`uiautomator dump` on
Android, `idb ui describe-all` on iOS) and taps element centres, so it tolerates
layout/resolution differences instead of hardcoding pixel coordinates.

These are **dev builds** served by Metro, so a JS error surfaces as a visible redbox —
ideal for detection. (In a release build the same error would be a hard crash.)

## Setup

1. **Test accounts** — create three in Supabase Auth (Add user → "Auto Confirm" checked),
   all with the same password:
   - `test1` — stable account **with items, including ≥1 private item** (run the `seed`
     suite once to add the private one). Used read-only + as the follow target.
   - `test2` — mutable account (destructive add/delete + multi-user follower).
   - `test3` — never-touched **empty** account (new-user / empty-state checks).
2. **Config** — `cp e2e/.env.example e2e/.env` and fill in the account emails, password,
   `test1`'s user UID (Supabase → Users → test1 → User UID), and app id/scheme.
   `e2e/.env` is gitignored.
3. **Tooling** — Android SDK + a booted emulator; for iOS, `idb-companion` + `fb-idb`
   (Python 3.12) + a booted simulator. See `zlocal/til.md` for the idb install notes.
4. **Devices + Metro must be running** (see "Restarting the environment" below).

## Suites

`e2e/run.sh <platform> <suite>` — platform: `android` | `ios` | `both`

- **`smoke`** (default) — read-only happy path on **test1**: cold start → sign-in (only if
  signed out) → collection, feed, today, notifications, **Stats** (renders, no redbox/crash,
  top-cities). *Android 8/8, iOS 8/8.*
- **`empty`** — new-user / empty-state on **test3**: collection empty state, Today with no
  items (no crash on an empty 3×3), notifications empty, Stats empty state (no
  divide-by-zero). *Android 7/7, iOS 7/7.* (Found a real bug: the new-user collection had
  no empty state — fixed; see `zlocal/ANDROID_TEST_FINDINGS.md` #3.)
- **`destructive`** — add/delete lifecycle on **test2**: baseline count → add → count +1 →
  delete → back to baseline. Self-cleaning. The add step captures a photo: Android picks
  the most-recent shot from the system photo library; iOS shoots the simulator camera (a
  usable test frame) via the shutter, since the iOS photo picker runs out of process and
  isn't scriptable. *Android 5/5, iOS 5/5.*
- **`multiuser`** — cross-user follow on a single device via account switching + deep links
  (test2 → test1): deep-link to test1's profile → follow → friends feed non-empty →
  **privacy** (public-only count test2 sees < test1's own total → private item hidden) →
  switch to test1 → "followed you" notification → unfollow cleanup. *Android 9/9, iOS 9/9.*
- **`seed`** — one-time setup (excluded from `all`): signs in as test1 and adds one
  **private** item via the UI, so the multiuser privacy check has something to hide.
  *Android + iOS.*
- **`all`** — runs smoke + empty + destructive + multiuser (not seed).

The suites switch accounts as needed and dismiss the OS "save password" / OAuth-consent
dialogs that appear after a sign-in.

## Running

```bash
e2e/run.sh android smoke        # quick read-only check
e2e/run.sh android empty
e2e/run.sh android destructive
e2e/run.sh android multiuser
e2e/run.sh both all
e2e/run.sh android seed         # one-time: give test1 a private item
```

`run.sh` loads `e2e/.env`, puts adb/idb on PATH, forces a UTF-8 locale, and runs `smoke.py`.

### Output
Each run writes to `e2e/runs/<timestamp>/` (gitignored):
- `<platform>_<suite>_NN_<step>.png` — a screenshot per step
- `report_<platform>_<suite>.json` — structured pass/fail results

Console prints `[PASS]/[FAIL]` per step and a `passed/total` summary. **Exit 0 = all
passed, 1 = at least one failure** (so it can gate a scheduled run / CI).

## Restarting the environment

The emulator/simulator and Metro stop between sessions. Restart with:
```bash
npx expo start --port 8081 &                              # Metro (serves both)
emulator -avd things_pixel7 -gpu swiftshader_indirect &   # Android emulator
xcrun simctl boot "iPhone 16"; open -a Simulator          # iOS simulator
```

## Known limitations
- All suites (smoke, empty, destructive, multiuser, seed) pass on **both** Android and iOS.
  The iOS add flow captures from the simulator camera rather than the system photo picker
  (which runs out of process and isn't scriptable) — see `open_add_and_capture`.
- **Google / Apple sign-in** isn't exercised (needs a real provider browser flow); email only.
- **Map tiles** aren't asserted (only that Stats doesn't crash and the city sections render).
- Not CI-ready as-is: needs a live emulator/simulator + Metro (no headless/device-farm setup).
