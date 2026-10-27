import { computeBounds, expandBounds } from '../utils/map-bounds.js';

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

describe('expandBounds', () => {
  test('null -- devuelve null', () => {
    expect(expandBounds(null)).toBeNull();
  });

  test('punto degenerado (span 0) -- usa el piso mínimo en metros, no queda en 0', () => {
    const bounds = [-58.4, -34.6, -58.4, -34.6];
    const expanded = expandBounds(bounds, { minMarginMeters: 150 });
    expect(expanded[0]).toBeLessThan(bounds[0]);
    expect(expanded[2]).toBeGreaterThan(bounds[2]);
    expect(expanded[1]).toBeLessThan(bounds[1]);
    expect(expanded[3]).toBeGreaterThan(bounds[3]);
  });

  test('rectángulo con span real -- el margen escala con marginRatio, no con el piso', () => {
    // ~1.1km de alto (0.01 grados de latitud), bastante más que el piso de
    // 150m -- el margen efectivo tiene que salir de marginRatio, no del piso.
    const bounds = [-58.41, -34.61, -58.4, -34.6];
    const expanded = expandBounds(bounds, { marginRatio: 0.5, minMarginMeters: 150 });
    const latSpan = bounds[3] - bounds[1];
    const latMargin = expanded[3] - bounds[3];
    // Margen esperado ~= 50% del span -- con tolerancia amplia (no testea la
    // conversión grados<->metros exacta, solo que escala con el span real).
    expect(latMargin).toBeGreaterThan(latSpan * 0.3);
    expect(latMargin).toBeLessThan(latSpan * 0.7);
  });

  test('el rectángulo expandido siempre contiene al original', () => {
    const bounds = [-58.45, -34.65, -58.38, -34.5];
    const expanded = expandBounds(bounds);
    expect(expanded[0]).toBeLessThanOrEqual(bounds[0]);
    expect(expanded[1]).toBeLessThanOrEqual(bounds[1]);
    expect(expanded[2]).toBeGreaterThanOrEqual(bounds[2]);
    expect(expanded[3]).toBeGreaterThanOrEqual(bounds[3]);
  });
});
