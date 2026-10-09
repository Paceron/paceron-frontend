import { createAudioPlayer } from 'expo-audio';
import { isMobile } from './platform.js';

// Sonido corto de severidad "alerta" (Gap 27, mensajería en sesión en vivo).
// createAudioPlayer (no el hook useAudioPlayer) porque esto se dispara desde
// un listener de WS/efecto, no desde el render de un componente. No-op fuera
// de mobile, mismo criterio que utils/haptics.js -- RNW no necesita esto y
// expo-audio en web sería otro camino (HTMLAudioElement) sin motivo de peso
// para mantenerlo andando ahí.
let player = null;

export function playAlertSound() {
  if (!isMobile) return;
  try {
    if (!player) player = createAudioPlayer(require('../assets/sounds/session-alert.wav'));
    player.seekTo(0);
    player.play();
  } catch {
    // Dispositivo sin audio disponible, o el módulo no está listo todavía --
    // la alerta ya se mostró por modal + haptics, el sonido es un refuerzo,
    // no la única señal (ver utils/session-message-delivery.js).
  }
}
