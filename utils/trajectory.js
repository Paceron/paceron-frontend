// Geometría del "Dibujo de Trayectoria": convierte una lista de puntos GPS en
// una polilínea lista para dibujar dentro de un recuadro de tamaño fijo,
// manteniendo las proporciones (a escala) y sin deformar el recorrido.
//
// Puro a propósito (sin SVG ni React) para poder testearlo con Jest: el
// componente solo pega el path que sale de acá.

import { haversineMeters } from './distance.js';

const round = (n) => Math.round(n * 100) / 100;

// Normaliza los puntos a un recuadro `size` x `size`, dejando `padding` de aire
// alrededor. Escala X e Y por separado para que el recorrido SIEMPRE entre en
// el recuadro (si se usara la misma escala, un tramo angosto y largo se iría
// fuera del dibujo). El sesgo de la escala entre ejes es inherente a una figura
// de "fit to box" — se compensa annotando las dimensiones reales, que se
// devuelven en `metersWide` / `metersTall`.
//
// Devuelve null si no hay puntos suficientes para dibujar algo.
export function buildTrajectoryPath(points, { size = 160, padding = 12 } = {}) {
  const valid = (points ?? []).filter(
    (p) => p && Number.isFinite(p.latitude) && Number.isFinite(p.longitude),
  );
  // Con 1 solo punto no hay línea: se puede mostrar el punto, pero no una
  // trayectoria. Con 2 ya hay un tramo.
  if (valid.length < 2) return null;

  const lats = valid.map((p) => p.latitude);
  const lngs = valid.map((p) => p.longitude);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs);
  const maxLng = Math.max(...lngs);

  const inner = size - padding * 2;
  // Un recorrido perfectamente recto en un eje (todos los puntos en la misma
  // latitud, por ejemplo) tiene rango 0 y rompería la división.
  const latSpan = maxLat - minLat || Number.EPSILON;
  const lngSpan = maxLng - minLng || Number.EPSILON;

  const toXY = (p) => {
    const x = padding + ((p.longitude - minLng) / lngSpan) * inner;
    // La latitud crece hacia el norte (arriba en el mapa), el eje Y del SVG
    // crece hacia abajo → se invierte.
    const y = padding + (1 - (p.latitude - minLat) / latSpan) * inner;
    return { x: round(x), y: round(y) };
  };

  const coords = valid.map(toXY);
  const d = coords.map((c, i) => `${i === 0 ? 'M' : 'L'}${c.x} ${c.y}`).join(' ');

  return {
    d,
    start: coords[0],
    end: coords[coords.length - 1],
    // Dimensiones reales del recorrido, para escalarlas junto a la figura.
    metersWide: haversineMeters(minLat, minLng, minLat, maxLng),
    metersTall: haversineMeters(minLat, minLng, maxLat, minLng),
    pointCount: valid.length,
  };
}
