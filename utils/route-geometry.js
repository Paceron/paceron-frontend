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

// Proyecta coordenadas lat/lng a un viewBox SVG para el frame-preview de la
// fila de competencia (RouteThumbnail, Spec 4c) -- pedido real, 2026-10-16:
// la fila no mostraba ningún trazado visual de la ruta, solo el título.
// Equirectangular simple (no haversine, es solo para DIBUJAR la forma a
// escala chica, no para medir distancia real -- eso lo sigue haciendo
// totalRouteMeters arriba) con corrección por coseno de latitud para que un
// tramo este-oeste no se vea más corto de lo que es en la pantalla.
export function buildRoutePreviewPoints(coordinates, { width, height, padding = 4 } = {}) {
  const valid = coordinates ?? [];
  if (valid.length < 2 || !width || !height) return [];

  const lats = valid.map(([, lat]) => lat);
  const lngs = valid.map(([lng]) => lng);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs);
  const maxLng = Math.max(...lngs);
  const latSpan = maxLat - minLat || 1e-6;
  const cosLat = Math.cos((((minLat + maxLat) / 2) * Math.PI) / 180) || 1;
  const lngSpan = (maxLng - minLng) * cosLat || 1e-6;

  const innerW = Math.max(0, width - padding * 2);
  const innerH = Math.max(0, height - padding * 2);
  const scale = Math.min(innerW / lngSpan, innerH / latSpan);
  const offsetX = padding + (innerW - lngSpan * scale) / 2;
  const offsetY = padding + (innerH - latSpan * scale) / 2;

  return valid.map(([lng, lat]) => ({
    x: offsetX + (lng - minLng) * cosLat * scale,
    // y invertido -- latitud mayor (norte) dibuja más arriba.
    y: offsetY + (maxLat - lat) * scale,
  }));
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
