import { haversineMeters } from '../utils/distance.js';

describe('haversineMeters', () => {
  test('mismo punto da 0 metros', () => {
    expect(haversineMeters(-34.6037, -58.3816, -34.6037, -58.3816)).toBe(0);
  });

  test('1 grado de longitud en el ecuador ≈ 111.19 km', () => {
    const meters = haversineMeters(0, 0, 0, 1);
    expect(meters).toBeGreaterThan(110000);
    expect(meters).toBeLessThan(112000);
  });

  test('1 grado de latitud ≈ 111.19 km', () => {
    const meters = haversineMeters(0, 0, 1, 0);
    expect(meters).toBeGreaterThan(110000);
    expect(meters).toBeLessThan(112000);
  });

  test('es simétrica (a→b igual que b→a)', () => {
    const ab = haversineMeters(-34.6037, -58.3816, -34.5, -58.3);
    const ba = haversineMeters(-34.5, -58.3, -34.6037, -58.3816);
    expect(Math.abs(ab - ba)).toBeLessThan(0.001);
  });

  test('la diagonal es mayor que cada componente (triángulo)', () => {
    const dLat = haversineMeters(0, 0, 1, 0);
    const dLng = haversineMeters(0, 0, 0, 1);
    const diag = haversineMeters(0, 0, 1, 1);
    expect(diag).toBeGreaterThan(dLat);
    expect(diag).toBeGreaterThan(dLng);
  });

  test('nunca devuelve negativo para puntos cercanos de ida y vuelta', () => {
    // ida y vuelta sobre la misma traza: suma de segmentos ≥ distancia directa
    const via = haversineMeters(-34.6, -58.38, -34.6, -58.36) + haversineMeters(-34.6, -58.36, -34.6, -58.38);
    expect(via).toBeGreaterThan(0);
  });
});