// Push-notification registration, gated by PUSH_NOTIFICATIONS (distribution only
// — needs the aps-environment entitlement + an APNs key on the paid account; see
// featureFlags.js). On local free-team builds the flag is off and nothing here
// touches the native module: registerForPush is a no-op and the package is never
// required.
//
// Push is a *delivery* layer on top of the existing in-app notifications: the
// `notifications` row is still written by DB triggers and drives the realtime
// bell badge. A device token registered here lets the send-push edge function
// (supabase/functions/send-push) relay that same event to the OS via Expo Push.
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import { PUSH_NOTIFICATIONS } from '../featureFlags';

const Notifications = PUSH_NOTIFICATIONS ? require('expo-notifications') : null;
const Device = PUSH_NOTIFICATIONS ? require('expo-device') : null;

// Show banners/badges while the app is foregrounded too (otherwise iOS suppresses
// them when the app is open). Safe to call at module load — only when enabled.
if (Notifications) {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: false,
      shouldSetBadge: false,
    }),
  });
}

// Request permission, get this device's Expo push token, and upsert it for the
// signed-in user. Idempotent — the token is unique-keyed in device_tokens, so a
// repeat call just bumps updated_at. Swallows errors (best-effort; a missing
// token only means no push, never a broken app).
export async function registerForPush(client, userId) {
  if (!Notifications || !userId) return;
  // Simulators can't receive push; only real hardware has a token.
  if (Device && !Device.isDevice) return;

  try {
    const { status: existing } = await Notifications.getPermissionsAsync();
    let status = existing;
    if (status !== 'granted') {
      ({ status } = await Notifications.requestPermissionsAsync());
    }
    if (status !== 'granted') return;

    const projectId =
      Constants?.expoConfig?.extra?.eas?.projectId ??
      Constants?.easConfig?.projectId;
    const { data: token } = await Notifications.getExpoPushTokenAsync(
      projectId ? { projectId } : undefined,
    );
    if (!token) return;

    await client
      .from('device_tokens')
      .upsert(
        { user_id: userId, token, platform: Platform.OS, updated_at: new Date().toISOString() },
        { onConflict: 'token' },
      );
  } catch (e) {
    console.error('registerForPush error:', e);
  }
}
