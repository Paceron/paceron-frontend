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

// Severidad "aviso"/"alerta" de la mensajería en sesión en vivo (Gap 27) --
// impactAsync (no notificationAsync, que es para resultado de una acción
// propia tipo "guardado con éxito") porque esto es un impacto EXTERNO que
// llega, no una confirmación de algo que el usuario disparó.
export const notifyAviso = () => {
  if (isMobile) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
};

export const notifyAlerta = () => {
  if (isMobile) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
};
