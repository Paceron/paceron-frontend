import { useCallback, useRef } from 'react';
import * as Location from 'expo-location';
import { logDebug } from '../utils/debug-log.js';

// Igual que hooks/use-gps-tracker.js (por-serie, NO se toca) pero pensado
// para correr sin cortes desde el Play hasta finalizar toda la sesión
// presencial -- sin gate por serie activa, sin `getInitialPoint` (no hace
// falta un punto instantáneo por serie: el watch corre de punta a punta).
// Mismos parámetros de precisión ya probados y documentados en
// use-gps-tracker.js -- no cambiar sin releer esa justificación.
export function useSessionGpsTracker(enabled) {
  const subscriptionRef = useRef(null);
  const startedRef = useRef(false);
  // Diagnóstico: antes este hook no logueaba nada -- ni que arrancó, ni que
  // falló en silencio (el catch original tragaba el error sin dejar rastro),
  // ni que efectivamente llegó al menos un punto real del GPS. Sin esto, un
  // "no veo el punto del corredor en el mapa" no se podía distinguir entre
  // "nunca arrancó el tracker", "arrancó pero el SO nunca le dio un fix" o "sí
  // llegan puntos pero el envío por WS falla" (2026-10-01).
  const loggedFirstPointRef = useRef(false);

  const stop = useCallback(async () => {
    const subscription = subscriptionRef.current;
    subscriptionRef.current = null;
    startedRef.current = false;
    if (subscription) await subscription.remove();
  }, []);

  const start = useCallback(
    async ({ onPoint } = {}) => {
      if (!enabled || startedRef.current) {
        logDebug(`[gps] start() no-op (enabled=${enabled} yaIniciado=${startedRef.current})`);
        return;
      }
      startedRef.current = true;
      loggedFirstPointRef.current = false;
      logDebug('[gps] start() pidiendo watchPositionAsync');
      try {
        const subscription = await Location.watchPositionAsync(
          {
            accuracy: Location.Accuracy.High,
            timeInterval: 1000,
            distanceInterval: 1,
          },
          (position) => {
            if (!loggedFirstPointRef.current) {
              loggedFirstPointRef.current = true;
              logDebug(`[gps] primer punto recibido lat=${position.coords.latitude} lng=${position.coords.longitude} accuracy=${position.coords.accuracy}`);
            }
            onPoint?.({
              latitude: position.coords.latitude,
              longitude: position.coords.longitude,
              timestamp: position.timestamp,
              accuracy: position.coords.accuracy,
            });
          },
        );
        subscriptionRef.current = subscription;
        logDebug('[gps] watchPositionAsync OK, suscripción activa');
      } catch (error) {
        startedRef.current = false;
        logDebug(`[gps] watchPositionAsync ERROR ${error?.message ?? error}`);
      }
    },
    [enabled],
  );

  return { start, stop };
}
