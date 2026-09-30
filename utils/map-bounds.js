// Rectángulo mínimo que contiene todos los puntos, formato [west, south, east,
// north] -- el que espera cameraRef.current.fitBounds() de
// @maplibre/maplibre-react-native. Pura a propósito: la llamada imperativa a
// la cámara real no es testeable en Jest, pero el cálculo del rectángulo sí.
export function computeBounds(points) {
  const valid = (points ?? []).filter(
    (p) => typeof p?.latitude === 'number' && typeof p?.longitude === 'number',
  );
  if (valid.length === 0) return null;

  let west = valid[0].longitude;
  let east = valid[0].longitude;
  let south = valid[0].latitude;
  let north = valid[0].latitude;

  for (const point of valid) {
    if (point.longitude < west) west = point.longitude;
    if (point.longitude > east) east = point.longitude;
    if (point.latitude < south) south = point.latitude;
    if (point.latitude > north) north = point.latitude;
  }

  return [west, south, east, north];
}
