#!/usr/bin/env bash
# Build + run the things dev client on a physical Android device.
#
# Usage:  npm run android:device   (or ./scripts/run-android-device.sh)
#
# Auto-detects the Android SDK and JDK 17 so it works on any macOS dev setup
# (respects ANDROID_HOME / JAVA_HOME if you've already exported them).
set -euo pipefail

# --- Android SDK ---------------------------------------------------------
if [ -z "${ANDROID_HOME:-}" ]; then
  for d in "$HOME/Library/Android/sdk" \
           "/opt/homebrew/share/android-commandlinetools" \
           "/usr/local/share/android-commandlinetools"; do
    [ -d "$d/platform-tools" ] && { export ANDROID_HOME="$d"; break; }
  done
fi
if [ -z "${ANDROID_HOME:-}" ] || [ ! -x "$ANDROID_HOME/platform-tools/adb" ]; then
  echo "Could not find the Android SDK. Set ANDROID_HOME, or install it" >&2
  echo "(brew install --cask android-commandlinetools, or Android Studio)." >&2
  exit 1
fi

# --- JDK 17 --------------------------------------------------------------
if [ -z "${JAVA_HOME:-}" ]; then
  if [ -d "/opt/homebrew/opt/openjdk@17" ]; then
    export JAVA_HOME="/opt/homebrew/opt/openjdk@17"
  elif /usr/libexec/java_home -v 17 >/dev/null 2>&1; then
    export JAVA_HOME="$(/usr/libexec/java_home -v 17)"
  fi
fi

export PATH="${JAVA_HOME:+$JAVA_HOME/bin:}$ANDROID_HOME/platform-tools:$ANDROID_HOME/emulator:$PATH"

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

# Pick the first connected device whose serial is NOT an emulator.
DEVICE="$(adb devices | awk '/\tdevice$/{print $1}' | grep -v '^emulator-' | head -1 || true)"

if [ -z "$DEVICE" ]; then
  cat <<'EOF'
No physical Android device detected over adb.

On the phone (one-time):
  1. Settings → About phone → tap "Build number" 7× to unlock Developer options.
  2. Settings → System → Developer options → enable "USB debugging".
  3. Plug the phone into the computer with a USB-data cable (not charge-only).
  4. On the phone, tap "Allow" on the "Allow USB debugging?" prompt
     (check "Always allow from this computer").

Then re-run. Verify the phone shows up with:
  adb devices        # should list a serial in state "device" (not "unauthorized")
EOF
  exit 1
fi

echo "Target device: $DEVICE"

# Pin every adb / Gradle install to this device (avoids the emulator stealing it).
export ANDROID_SERIAL="$DEVICE"

# Let the phone reach the Metro bundler running on this machine (localhost:8081).
adb -s "$DEVICE" reverse tcp:8081 tcp:8081 >/dev/null
echo "adb reverse 8081 set up."

# Build, install, and launch the dev client on the device.
npx expo run:android
