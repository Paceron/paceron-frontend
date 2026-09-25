import { useCallback, useRef } from 'react';
import * as Location from 'expo-location';

// Sampleo continuo de posición mientras dura una serie. NO pide permisos —
// eso ya se resolvió una sola vez por sesión en el pre-start (ver
// session-pre-start-screen.jsx); si `enabled` es falso, no hace nada.
export function useGpsTracker(enabled) {
  const subscriptionRef = useRef(null);
  const startedRef = useRef(false);

  // Punto inicial de la serie (al terminar el countdown). Fallback a
  // lastKnownPosition como en use-location-picker.js. Devuelve null si el
  // GPS no está disponible — la toma sigue sin distancias.
  const getInitialPoint = useCallback(async () => {
    try {
      const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.BestForNavigation });
      if (position?.coords) {
        return { latitude: position.coords.latitude, longitude: position.coords.longitude, timestamp: position.timestamp };
      }
    } catch {
      // fallthrough al fallback de caché
    }
    try {
      const last = await Location.getLastKnownPositionAsync();
      if (last?.coords) {
        return { latitude: last.coords.latitude, longitude: last.coords.longitude, timestamp: last.timestamp };
      }
    } catch {
      // nada que hacer — sin punto inicial
    }
    return null;
  }, []);

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
            accuracy: Location.Accuracy.Balanced,
            timeInterval: 1000,
            distanceInterval: 1,
          },
          (position) => {
            onPoint?.({
              latitude: position.coords.latitude,
              longitude: position.coords.longitude,
              timestamp: position.timestamp,
            });
          },
        );
        subscriptionRef.current = subscription;
      } catch {
        // GPS indisponible — se sigue sin distancias (startedRef se resetea
        // para permitir reintentar la próxima serie)
        startedRef.current = false;
      }
    },
    [enabled],
  );

  return { start, stop, getInitialPoint };
}