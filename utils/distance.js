const EARTH_RADIUS_METERS = 6371000;

const toRad = (deg) => (deg * Math.PI) / 180;

// Distancia haversine entre dos puntos en metros. Es un valor absoluto por
// definición (la distancia entre dos puntos no depende de la dirección), así
// que acumular pares consecutivos da la distancia recorrida sin importar los
// vaivenes.
export function haversineMeters(lat1, lng1, lat2, lng2) {
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return EARTH_RADIUS_METERS * c;
}

// Velocidad máxima plausible para descartar saltos de GPS. 12 m/s ≈ 43 km/h:
// correr a eso es un sprint absoluto, cualquier tramos más largo que eso entre
// dos puntos seguidos NO es movimiento real, es un salto del receptor (o un
// multilínea del Reflector en Buildings, que tira miles de metros de golpe).
export const MAX_PLAUSIBLE_SPEED_MPS = 12;

// Acepta un tramo entre dos puntos GPS solo si:
//  1. hay coordenadas y timestamps válidos en ambos, y
//  2. el accuracy del punto nuevo no es una bola (>= MAX_ACCURACY_METERS), y
//  3. la velocidad implícita no supera MAX_PLAUSIBLE_SPEED_MPS.
//
// El filtro (2) es lo que frena el contador cuando estás QUIETO: el GPS
// sigue emitiendo puntos, pero con radio de error grande, y cada micro-desviación
// de esos puntos se acumulaba como metros falsos. El (3) frena los saltos de
// cientos de metros. Devuelve los metros del tramo, o null si el punto se
// descarta (no se suma distancia ni se persiste).
export function acceptGpsLeg({ from, to, maxSpeedMps = MAX_PLAUSIBLE_SPEED_MPS, maxAccuracyMeters = 30 }) {
  if (!from || !to) return null;
  const { latitude: toLat, longitude: toLng, timestamp: toTs, accuracy } = to;
  if (![toLat, toLng, toTs].every((v) => Number.isFinite(v))) return null;
  // (2) radio de error demasiado grande → no sirve para medir
  if (Number.isFinite(accuracy) && accuracy > maxAccuracyMeters) return null;

  const fromTs = from.timestamp;
  if (!Number.isFinite(fromTs)) return null;
  const leg = haversineMeters(from.latitude, from.longitude, toLat, toLng);

  const elapsedSeconds = (toTs - fromTs) / 1000;
  // Δt 0 o negativo: dos puntos con el mismo timestamp no permiten calcular
  // velocidad, pero el tramo es geo real y chico — se acepta (el filtro de
  // accuracy ya cubrió el ruido de standing still).
  if (elapsedSeconds > 0) {
    const speed = leg / elapsedSeconds;
    if (speed > maxSpeedMps) return null;
  }
  return leg;
}

// Formato "X m" / "X.XX km" para distancias — usado por la toma en vivo y por
// la pantalla de revisión (spec session-registration-review: reusar, no
// duplicar). Extraído 2026-09-24 desde training-session-active-screen.jsx.
export function formatMeters(value) {
  const meters = Number(value);
  if (value == null || !Number.isFinite(meters) || meters < 0) return '—';
  if (meters < 1000) return `${Math.round(meters)} m`;
  return `${(meters / 1000).toFixed(2)} km`;
}