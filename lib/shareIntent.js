// Flag-gated wrapper around expo-share-intent's hook.
//
// Share intent ships only on distribution builds (it needs an iOS App Group
// entitlement — see featureFlags.js). On a local free-team build SHARE_INTENT is
// false, and we must never touch the native module, so we don't `require` the
// package at all and return a static no-op shape instead. The flag is constant
// for the whole build, so this branch is resolved once at module load — the same
// hooks run on every render, which keeps the Rules of Hooks satisfied.
import { SHARE_INTENT } from '../featureFlags';

const NOOP_SHARE_INTENT = {
  hasShareIntent: false,
  shareIntent: null,
  resetShareIntent: () => {},
};

export const useShareIntent = SHARE_INTENT
  ? require('expo-share-intent').useShareIntent
  : () => NOOP_SHARE_INTENT;
