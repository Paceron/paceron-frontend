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