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
// llega, no una confirmación de algo que el usuario disparó. Repetido (no un
// solo pulso) para que un aviso/alerta se note de verdad en el bolsillo --
// el primer pulso es siempre sincrónico (el caller puede verificarlo sin
// esperar), los siguientes van con un pequeño delay.
const repeatImpact = (style, times, gapMs) => {
  Haptics.impactAsync(style);
  for (let i = 1; i < times; i += 1) {
    setTimeout(() => Haptics.impactAsync(style), i * gapMs);
  }
};

export const notifyAviso = () => {
  if (isMobile) repeatImpact(Haptics.ImpactFeedbackStyle.Medium, 2, 180);
};

export const notifyAlerta = () => {
  if (isMobile) repeatImpact(Haptics.ImpactFeedbackStyle.Heavy, 3, 180);
};
