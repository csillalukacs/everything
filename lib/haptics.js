import * as Haptics from 'expo-haptics';

// Thin wrapper over expo-haptics so call sites stay one-liners and the whole
// app's haptics can be tuned (or muted) in one place. Native-only; the methods
// no-op on platforms without a haptics engine.
export const haptics = {
  tap: () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium),
  light: () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light),
  select: () => Haptics.selectionAsync(),
  success: () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success),
  warn: () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning),
};
