import { Platform } from 'react-native';

export const isWeb = Platform.OS === 'web';
export const isMobile = Platform.OS === 'ios' || Platform.OS === 'android';

// Distingue "browser corriendo en un OS mobile" de isWeb (que es true
// tanto en desktop como en mobile browser). Función, no constante: debe
// evaluarse en cliente — en el prerender estático del export web
// (app.config.js -> web.output: 'static') no existe `navigator`.
// User-agent, nunca viewport/Dimensions — así no se dispara por una
// ventana de desktop angosta, solo por el OS real del visitante.
export function isMobileBrowser() {
  if (!isWeb || typeof navigator === 'undefined') return false;
  return /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
}

export default {
  isWeb,
  isMobile,
  hasNativeSensors: isMobile,
  hasGPS: isMobile,
  canScanQR: isMobile,
};
