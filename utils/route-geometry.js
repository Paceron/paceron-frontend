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
