import { useCallback, useMemo, useState } from 'react';
import * as Location from 'expo-location';
import { routeLimitStatus } from '../utils/route-geometry.js';

function geojsonToPoints(geojson) {
  if (!geojson?.coordinates) return [];
  return geojson.coordinates.map(([lng, lat]) => ({ lat, lng }));
}

function pointsToGeojson(points) {
  return { type: 'LineString', coordinates: points.map((p) => [p.lng, p.lat]) };
}

// Estado del picker de dibujo de ruta (Spec 4c) -- agnóstico de plataforma,
// usado por los dos pickers (nativo/web, mismo split que LocationPicker).
// `value`/`onChange` siguen el contrato de GeoJSON LineString que espera
// `POST /teams/{id}/competitions` (route).
export function useRouteDrawPicker({ value, onChange }) {
  const [points, setPoints] = useState(() => geojsonToPoints(value));
  // `confirmed` (pedido real, 2026-10-16: "con mas de dos puntos marcados
  // le doy a confirmar ruta pero nada me indica que realmente se
  // confirmo") -- se prende en confirm(), se apaga con cualquier edición
  // posterior (agregar/deshacer/limpiar) para que el indicador nunca
  // mienta sobre si LO QUE SE VE AHORA es lo confirmado.
  const [confirmed, setConfirmed] = useState(false);
  const [locating, setLocating] = useState(false);
  const [locateError, setLocateError] = useState(null);

  const addPoint = (lat, lng) => { setPoints((prev) => [...prev, { lat, lng }]); setConfirmed(false); };
  const undoLast = () => { setPoints((prev) => prev.slice(0, -1)); setConfirmed(false); };
  const clear = () => { setPoints([]); setConfirmed(false); };

  const limitStatus = useMemo(() => routeLimitStatus(points), [points]);
  const canConfirm = points.length >= 2 && !limitStatus.exceedsVertices && !limitStatus.exceedsLength;

  const confirm = () => {
    if (!canConfirm) return;
    onChange(pointsToGeojson(points));
    setConfirmed(true);
  };

  // Centra el mapa en la ubicación real del usuario -- pedido real,
  // 2026-10-16: "es imposible llegar a una dirección deseada" sin esto, el
  // mapa arranca siempre en el centro default (Buenos Aires). Mismo
  // patrón que hooks/use-location-picker.js#locate, pero sin side effects
  // de Toast/haptics acá (hook agnóstico de plataforma, cada picker
  // decide cómo avisar el error) -- devuelve {lat,lng} o null, el caller
  // mueve SU PROPIA cámara (ref nativo vs maplibregl.Map en web).
  //
  // `silent` (pedido real, 2026-10-17: "quiero que el mapa enfoque por
  // defecto en la ubicacion actual... en todas las plataformas") -- el
  // intento automático al abrir el picker no debe prender el spinner del
  // botón "mi ubicación" ni mostrar un mensaje de error si el permiso
  // está denegado (es un intento silencioso de fondo, no una acción del
  // usuario); el botón explícito sigue llamando sin opciones (silent por
  // default en false) y se comporta exactamente igual que antes.
  const locateMe = useCallback(async ({ silent = false } = {}) => {
    if (!silent) {
      setLocating(true);
      setLocateError(null);
    }
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        if (!silent) setLocateError('Necesitamos permiso de ubicación para esto.');
        return null;
      }
      let position;
      try {
        position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.BestForNavigation });
      } catch {
        position = await Location.getLastKnownPositionAsync();
      }
      if (!position) {
        if (!silent) setLocateError('No pudimos obtener tu ubicación actual.');
        return null;
      }
      return { lat: position.coords.latitude, lng: position.coords.longitude };
    } catch {
      if (!silent) setLocateError('No pudimos obtener tu ubicación actual.');
      return null;
    } finally {
      if (!silent) setLocating(false);
    }
  }, []);

  return { points, addPoint, undoLast, clear, confirm, confirmed, limitStatus, canConfirm, locateMe, locating, locateError };
}
