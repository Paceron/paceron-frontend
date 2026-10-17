import { totalRouteMeters, routeLimitStatus, MAX_ROUTE_VERTICES, MAX_ROUTE_METERS } from '../utils/route-geometry.js';

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
