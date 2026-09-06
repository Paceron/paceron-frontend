import * as Haptics from 'expo-haptics';
import { isMobile } from './platform.js';

// No-op fuera de mobile — RNW no implementa la API nativa de haptics,
// mismo criterio que usePullToRefresh/RefreshControl.
export const notifySuccess = () => {
  if (isMobile) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
};

export const notifyError = () => {
  if (isMobile) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
};

export const notifyWarning = () => {
  if (isMobile) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
};
