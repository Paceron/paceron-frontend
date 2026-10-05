import { computeBounds } from '../utils/map-bounds.js';

describe('computeBounds', () => {
  test('sin puntos devuelve null', () => {
    expect(computeBounds([])).toBeNull();
  });

  test('un solo punto -- bounds degenerados en ese punto', () => {
    expect(computeBounds([{ latitude: -34.6, longitude: -58.4 }])).toEqual([-58.4, -34.6, -58.4, -34.6]);
  });

  test('varios puntos -- envuelve el rectángulo mínimo', () => {
    const points = [
      { latitude: -34.6, longitude: -58.4 },
      { latitude: -34.5, longitude: -58.45 },
      { latitude: -34.65, longitude: -58.38 },
    ];
    expect(computeBounds(points)).toEqual([-58.45, -34.65, -58.38, -34.5]);
  });

  test('ignora puntos sin latitude/longitude numéricos', () => {
    const points = [
      { latitude: -34.6, longitude: -58.4 },
      { latitude: null, longitude: -58.45 },
      {},
    ];
    expect(computeBounds(points)).toEqual([-58.4, -34.6, -58.4, -34.6]);
  });
});
