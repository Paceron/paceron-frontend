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

const METERS_PER_DEGREE_LAT = 111320;

// Agranda un rectángulo [west,south,east,north] un `marginRatio` de su
// propio span por lado, con un piso en metros (`minMarginMeters`) para que
// una ruta muy corta (o degenerada, un solo punto) no quede con un área de
// pan prácticamente del tamaño del punto mismo. Pensado para
// `Camera.maxBounds` de @maplibre/maplibre-react-native (mismo formato
// [west,south,east,north] que `computeBounds`, confirmado en
// types/LngLatBounds.d.ts) -- restringe el panning del pre-start de un
// intento de ruta a una zona razonable alrededor del trazado, sin dejar
// pan infinito.
export function expandBounds(bounds, { marginRatio = 0.5, minMarginMeters = 150 } = {}) {
  if (!bounds) return null;
  const [west, south, east, north] = bounds;
  const midLat = (north + south) / 2;
  const lngMetersPerDegree = METERS_PER_DEGREE_LAT * Math.cos((midLat * Math.PI) / 180);
  const lngSpanMeters = (east - west) * lngMetersPerDegree;
  const latSpanMeters = (north - south) * METERS_PER_DEGREE_LAT;
  const lngMarginDeg = Math.max(lngSpanMeters * marginRatio, minMarginMeters) / lngMetersPerDegree;
  const latMarginDeg = Math.max(latSpanMeters * marginRatio, minMarginMeters) / METERS_PER_DEGREE_LAT;
  return [west - lngMarginDeg, south - latMarginDeg, east + lngMarginDeg, north + latMarginDeg];
}
