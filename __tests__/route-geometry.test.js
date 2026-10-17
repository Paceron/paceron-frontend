import { totalRouteMeters, routeLimitStatus, buildRoutePreviewPoints, MAX_ROUTE_VERTICES, MAX_ROUTE_METERS } from '../utils/route-geometry.js';

describe('totalRouteMeters', () => {
  test('sin puntos o un solo punto -> 0', () => {
    expect(totalRouteMeters([])).toBe(0);
    expect(totalRouteMeters([{ lat: -34.6, lng: -58.4 }])).toBe(0);
  });

  test('suma los tramos consecutivos', () => {
    const points = [
      { lat: -34.6037, lng: -58.3816 },
      { lat: -34.6137, lng: -58.3816 }, // ~1113m al sur
    ];
    const total = totalRouteMeters(points);
    expect(total).toBeGreaterThan(1000);
    expect(total).toBeLessThan(1200);
  });
});

describe('routeLimitStatus', () => {
  test('ruta chica no excede nada', () => {
    const points = [{ lat: -34.6, lng: -58.4 }, { lat: -34.601, lng: -58.4 }];
    const status = routeLimitStatus(points);
    expect(status.exceedsVertices).toBe(false);
    expect(status.exceedsLength).toBe(false);
    expect(status.vertexCount).toBe(2);
  });

  test('más de 500 vértices excede', () => {
    const points = Array.from({ length: 501 }, (_, i) => ({ lat: -34.6 + i * 0.0001, lng: -58.4 }));
    expect(routeLimitStatus(points).exceedsVertices).toBe(true);
  });

  test('largo total mayor a 100km excede', () => {
    const points = [{ lat: -34.0, lng: -58.4 }, { lat: -35.0, lng: -58.4 }];
    expect(routeLimitStatus(points).exceedsLength).toBe(true);
  });

  test('constantes exportadas con los valores confirmados por backend', () => {
    expect(MAX_ROUTE_VERTICES).toBe(500);
    expect(MAX_ROUTE_METERS).toBe(100_000);
  });
});

describe('buildRoutePreviewPoints', () => {
  test('sin coordenadas o un solo punto, o sin width/height -> []', () => {
    expect(buildRoutePreviewPoints([], { width: 100, height: 100 })).toEqual([]);
    expect(buildRoutePreviewPoints([[-58.4, -34.6]], { width: 100, height: 100 })).toEqual([]);
    expect(buildRoutePreviewPoints([[-58.4, -34.6], [-58.41, -34.61]], { width: 0, height: 100 })).toEqual([]);
  });

  test('misma cantidad de puntos que la entrada, todos dentro del viewBox', () => {
    const coordinates = [[-58.4, -34.6], [-58.41, -34.6], [-58.41, -34.61], [-58.4, -34.61]];
    const points = buildRoutePreviewPoints(coordinates, { width: 100, height: 80, padding: 4 });
    expect(points).toHaveLength(4);
    points.forEach((p) => {
      expect(p.x).toBeGreaterThanOrEqual(0);
      expect(p.x).toBeLessThanOrEqual(100);
      expect(p.y).toBeGreaterThanOrEqual(0);
      expect(p.y).toBeLessThanOrEqual(80);
    });
  });

  test('ruta recta este-oeste no colapsa a un punto -- usa el eje chico', () => {
    // Mismo lat (recta este-oeste pura): latSpan=0, pero igual se dibuja
    // horizontal ocupando el ancho, no un punto único.
    const coordinates = [[-58.40, -34.6], [-58.41, -34.6]];
    const points = buildRoutePreviewPoints(coordinates, { width: 100, height: 80, padding: 4 });
    expect(points[0].x).not.toBeCloseTo(points[1].x, 1);
    expect(points[0].y).toBeCloseTo(points[1].y, 5);
  });

  test('el punto más al norte queda con y menor (más arriba)', () => {
    const coordinates = [[-58.4, -34.60], [-58.4, -34.61]]; // segundo más al sur
    const points = buildRoutePreviewPoints(coordinates, { width: 100, height: 80 });
    expect(points[0].y).toBeLessThan(points[1].y);
  });
});
