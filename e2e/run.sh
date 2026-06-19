#!/usr/bin/env bash
# Wrapper for smoke.py: loads e2e/.env, sets up the Android SDK / idb / locale env,
# then runs a suite.
#   Usage: e2e/run.sh [android|ios|both] [smoke|empty|destructive|multiuser|seed|all]
set -euo pipefail

DIR="$(cd "$(dirname "$0")" && pwd)"

# Account + device config (test credentials, app id, AVD/device names) lives in
# e2e/.env (gitignored). Copy e2e/.env.example to e2e/.env and fill it in.
if [ -f "$DIR/.env" ]; then
  set -a; . "$DIR/.env"; set +a
fi

# Android SDK + idb on PATH. Override ANDROID_HOME in .env if yours differs.
export ANDROID_HOME="${ANDROID_HOME:-/opt/homebrew/share/android-commandlinetools}"
export PATH="$HOME/.local/bin:$ANDROID_HOME/platform-tools:$ANDROID_HOME/emulator:/opt/homebrew/bin:$PATH"
export LANG=en_US.UTF-8 LC_ALL=en_US.UTF-8
export ADB="$(command -v adb || echo adb)"
export IDB="$(command -v idb || echo idb)"

PLATFORM="${1:-both}"
SUITE="${2:-smoke}"
exec python3 "$DIR/smoke.py" --platform "$PLATFORM" --suite "$SUITE"
