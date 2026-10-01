import { useCallback, useRef } from 'react';
import * as Location from 'expo-location';

// Igual que hooks/use-gps-tracker.js (por-serie, NO se toca) pero pensado
// para correr sin cortes desde el Play hasta finalizar toda la sesión
// presencial -- sin gate por serie activa, sin `getInitialPoint` (no hace
// falta un punto instantáneo por serie: el watch corre de punta a punta).
// Mismos parámetros de precisión ya probados y documentados en
// use-gps-tracker.js -- no cambiar sin releer esa justificación.
export function useSessionGpsTracker(enabled) {
  const subscriptionRef = useRef(null);
  const startedRef = useRef(false);

  const stop = useCallback(async () => {
    const subscription = subscriptionRef.current;
    subscriptionRef.current = null;
    startedRef.current = false;
    if (subscription) await subscription.remove();
  }, []);

  const start = useCallback(
    async ({ onPoint } = {}) => {
      if (!enabled || startedRef.current) return;
      startedRef.current = true;
      try {
        const subscription = await Location.watchPositionAsync(
          {
            accuracy: Location.Accuracy.High,
            timeInterval: 1000,
            distanceInterval: 1,
          },
          (position) => {
            onPoint?.({
              latitude: position.coords.latitude,
              longitude: position.coords.longitude,
              timestamp: position.timestamp,
              accuracy: position.coords.accuracy,
            });
          },
        );
        subscriptionRef.current = subscription;
      } catch {
        startedRef.current = false;
      }
    },
    [enabled],
  );

  return { start, stop };
}
