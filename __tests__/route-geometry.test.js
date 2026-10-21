import { totalRouteMeters, routeLimitStatus, MAX_ROUTE_VERTICES, MAX_ROUTE_METERS, distanceToRouteMeters, computeRouteTimeoutMs, computeRouteComplianceRatio } from '../utils/route-geometry.js';

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

describe('distanceToRouteMeters', () => {
  test('ruta con menos de 2 puntos -- Infinity', () => {
    expect(distanceToRouteMeters({ lat: -34.6, lng: -58.4 }, [[-58.4, -34.6]])).toBe(Infinity);
    expect(distanceToRouteMeters({ lat: -34.6, lng: -58.4 }, [])).toBe(Infinity);
  });

  test('punto exactamente sobre un vértice -- 0', () => {
    const route = [[-58.4, -34.6], [-58.39, -34.6]];
    expect(distanceToRouteMeters({ lat: -34.6, lng: -58.4 }, route)).toBeCloseTo(0, 1);
  });

  test('punto a mitad de un segmento recto -- 0 (está sobre la línea)', () => {
    const route = [[-58.4, -34.6], [-58.39, -34.6]];
    expect(distanceToRouteMeters({ lat: -34.6, lng: -58.395 }, route)).toBeCloseTo(0, 1);
  });

  test('punto perpendicular a un segmento -- distancia perpendicular real, no la del vértice más cercano', () => {
    // Segmento horizontal de ~890m (0.01 grados de longitud a esta latitud).
    // El punto está "arriba" del punto medio del segmento, a ~111m (0.001 grados de latitud).
    const route = [[-58.4, -34.6], [-58.39, -34.6]];
    const distance = distanceToRouteMeters({ lat: -34.599, lng: -58.395 }, route);
    expect(distance).toBeGreaterThan(90);
    expect(distance).toBeLessThan(130);
  });

  test('punto más allá del final del último segmento -- distancia al vértice final, no se extrapola', () => {
    const route = [[-58.4, -34.6], [-58.39, -34.6]];
    // Mismo offset de latitud que el caso anterior, pero en longitud MÁS ALLÁ del
    // segundo vértice -- la distancia mínima tiene que ser al vértice, no a una
    // extensión imaginaria de la línea.
    const farPoint = { lat: -34.599, lng: -58.38 };
    const distanceToEndpoint = distanceToRouteMeters({ lat: -34.6, lng: -58.39 }, route);
    const distanceFar = distanceToRouteMeters(farPoint, route);
    expect(distanceFar).toBeGreaterThan(distanceToEndpoint);
  });

  test('ruta con varios segmentos -- toma el mínimo entre todos, no solo el primero', () => {
    const route = [[-58.4, -34.6], [-58.39, -34.6], [-58.39, -34.59]];
    // Este punto está pegado al SEGUNDO segmento (vertical), lejos del primero.
    const point = { lat: -34.595, lng: -58.3895 };
    const distance = distanceToRouteMeters(point, route);
    expect(distance).toBeLessThan(100);
  });
});

describe('computeRouteTimeoutMs', () => {
  test('ruta muy corta -- usa el piso de 30 minutos, no un número casi 0', () => {
    expect(computeRouteTimeoutMs(300)).toBe(30 * 60_000);
  });

  test('ruta larga -- escala con la distancia (pace 12 min/km, margen x2), no con el piso', () => {
    // 10km a 12 min/km = 120 min estimados, x2 de margen = 240 min.
    expect(computeRouteTimeoutMs(10_000)).toBe(240 * 60_000);
  });

  test('es monótono creciente con la distancia', () => {
    expect(computeRouteTimeoutMs(20_000)).toBeGreaterThan(computeRouteTimeoutMs(10_000));
  });
});

describe('computeRouteComplianceRatio', () => {
  const route = [[-58.4, -34.6], [-58.39, -34.6]];

  test('menos de 2 puntos recorridos -- null, no 0%', () => {
    expect(computeRouteComplianceRatio([], route, 50)).toBeNull();
    expect(computeRouteComplianceRatio([{ latitude: -34.6, longitude: -58.4 }], route, 50)).toBeNull();
  });

  test('sin ruta de referencia -- null', () => {
    const points = [{ latitude: -34.6, longitude: -58.4 }, { latitude: -34.6, longitude: -58.395 }];
    expect(computeRouteComplianceRatio(points, [], 50)).toBeNull();
  });

  test('sin radio de aceptación -- null', () => {
    const points = [{ latitude: -34.6, longitude: -58.4 }, { latitude: -34.6, longitude: -58.395 }];
    expect(computeRouteComplianceRatio(points, route, null)).toBeNull();
  });

  test('todo el recorrido sobre la ruta -- 100%', () => {
    const points = [
      { latitude: -34.6, longitude: -58.4 },
      { latitude: -34.6, longitude: -58.398 },
      { latitude: -34.6, longitude: -58.395 },
    ];
    expect(computeRouteComplianceRatio(points, route, 10)).toBeCloseTo(100, 0);
  });

  test('todo el recorrido lejos de la ruta -- 0%', () => {
    const points = [
      { latitude: -34.65, longitude: -58.4 },
      { latitude: -34.65, longitude: -58.395 },
    ];
    expect(computeRouteComplianceRatio(points, route, 10)).toBe(0);
  });

  test('mitad del recorrido dentro, mitad lejos -- a mitad de camino', () => {
    const points = [
      { latitude: -34.6, longitude: -58.4 }, // sobre la ruta
      { latitude: -34.6, longitude: -58.395 }, // sigue sobre la ruta -- tramo cumplido
      { latitude: -34.65, longitude: -58.395 }, // se aleja -- tramo NO cumplido
    ];
    const ratio = computeRouteComplianceRatio(points, route, 10);
    expect(ratio).toBeGreaterThan(0);
    expect(ratio).toBeLessThan(100);
  });
});
