import { haversineMeters } from './distance.js';

// Límites confirmados por backend (Gap 33 punto 30, docs/BACKEND_API_GAPS.md)
// -- validados también client-side para dar feedback antes del 400 real.
export const MAX_ROUTE_VERTICES = 500;
export const MAX_ROUTE_METERS = 100_000;

// Largo total de una ruta dibujada a mano (puntos en orden), sumando cada
// tramo consecutivo con la misma fórmula haversine que ya usa el filtro de
// calidad GPS (utils/distance.js) -- no se duplica el cálculo, solo se
// aplica a una secuencia de puntos "limpios" (sin filtro de ruido, estos
// puntos los puso el usuario a mano, no un receptor GPS).
export function totalRouteMeters(points) {
  const valid = points ?? [];
  if (valid.length < 2) return 0;
  let total = 0;
  for (let i = 1; i < valid.length; i++) {
    total += haversineMeters(valid[i - 1].lat, valid[i - 1].lng, valid[i].lat, valid[i].lng);
  }
  return total;
}

// Estado derivado para habilitar/deshabilitar "Confirmar" en el picker y
// mostrar el aviso ANTES de que el backend rechace con 400 (UX, no
// reemplaza la validación real del servidor).
export function routeLimitStatus(points) {
  const valid = points ?? [];
  const totalMeters = totalRouteMeters(valid);
  return {
    totalMeters,
    vertexCount: valid.length,
    exceedsVertices: valid.length > MAX_ROUTE_VERTICES,
    exceedsLength: totalMeters > MAX_ROUTE_METERS,
  };
}

const METERS_PER_DEGREE_LAT = 111_320;

// Distancia mínima (metros) de un punto a cada SEGMENTO de la polilínea
// (no solo a sus vértices) -- proyección plana local (equirectangular,
// centrada en cada segmento), igual criterio de aproximación que ya usa el
// resto de este archivo/utils/map-bounds.js para distancias cortas (escala
// de una ruta de running, no geodesia de largo alcance). Pensada para el
// gate de "se alejó de la ruta esperada" durante un intento en vivo --
// comparar contra el punto de inicio solo no alcanza, un corredor puede
// desviarse a mitad de camino.
function distanceToSegmentMeters(point, a, b) {
  const midLat = (a.lat + b.lat) / 2;
  const metersPerDegreeLng = METERS_PER_DEGREE_LAT * Math.cos((midLat * Math.PI) / 180);
  const toXY = (p) => ({
    x: (p.lng - a.lng) * metersPerDegreeLng,
    y: (p.lat - a.lat) * METERS_PER_DEGREE_LAT,
  });
  const p = toXY(point);
  const b2 = toXY(b);
  const lenSq = b2.x * b2.x + b2.y * b2.y;
  if (lenSq === 0) return Math.hypot(p.x, p.y);
  let t = (p.x * b2.x + p.y * b2.y) / lenSq;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(p.x - t * b2.x, p.y - t * b2.y);
}

export function distanceToRouteMeters(point, routeCoordinates) {
  const coords = routeCoordinates ?? [];
  if (coords.length < 2) return Infinity;
  let min = Infinity;
  for (let i = 1; i < coords.length; i++) {
    const a = { lat: coords[i - 1][1], lng: coords[i - 1][0] };
    const b = { lat: coords[i][1], lng: coords[i][0] };
    const d = distanceToSegmentMeters(point, a, b);
    if (d < min) min = d;
  }
  return min;
}

const REFERENCE_PACE_MIN_PER_KM = 12;
const TIMEOUT_MARGIN_FACTOR = 2;
const MIN_TIMEOUT_MS = 30 * 60_000;

// Timeout de un intento de ruta en vivo -- derivado del largo total, no un
// tope fijo (una ruta de 500m y una de 20km no deberían compartir número).
// Pace de referencia deliberadamente lento (caminata, no running) + margen
// x2 -- el objetivo es detectar "se olvidó la app corriendo", no apurar a
// nadie.
export function computeRouteTimeoutMs(totalMeters) {
  const estimatedMs = (totalMeters / 1000) * REFERENCE_PACE_MIN_PER_KM * 60_000;
  return Math.max(MIN_TIMEOUT_MS, estimatedMs * TIMEOUT_MARGIN_FACTOR);
}
