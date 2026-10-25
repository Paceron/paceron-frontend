import { acceptGpsLeg, haversineMeters, smoothGpsPoint } from '../utils/distance.js';

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
describe('acceptGpsLeg', () => {
  const at = (latitude, longitude, timestamp, accuracy) => ({ latitude, longitude, timestamp, accuracy });

  test('tramo normal a velocidad de carrera → devuelve los metros', () => {
    // ~11 m en 4 s ≈ 2.75 m/s (ritmo de carrera)
    const leg = acceptGpsLeg({
      from: at(-34.6037, -58.3816, 1000, 5),
      to: at(-34.6036, -58.3816, 5000, 5),
    });
    expect(leg).toBeGreaterThan(10);
    expect(leg).toBeLessThan(13);
  });

  test('standing still con accuracy pobre → descarta (el contador NO sube)', () => {
    // El caso que rompía: dos puntos casi iguales pero con radio de error de
    // 80m (típico parado bajo techo). Sin filtro, cada micro-desvío sumaba
    // metros falsos.
    const leg = acceptGpsLeg({
      from: at(-34.6037, -58.3816, 1000, 80),
      to: at(-34.60371, -58.38161, 2000, 85),
    });
    expect(leg).toBeNull();
  });

  test('salto de GPS imposible (muchos km en 1s) → descarta', () => {
    const leg = acceptGpsLeg({
      from: at(-34.6037, -58.3816, 1000, 5),
      to: at(-34.5, -58.3, 1500, 5),
    });
    expect(leg).toBeNull();
  });

  test('salto lento pero sobre el límite de velocidad → descarta', () => {
    // 30 m en 1 s = 30 m/s > 12 m/s máximo plausible.
    const leg = acceptGpsLeg({
      from: at(0, 0, 0, 5),
      to: at(0, 0.00027, 1000, 5),
    });
    expect(leg).toBeNull();
  });

  test('tramo justo POR DEBAJO del límite de velocidad → acepta (el tope es inclusivo)', () => {
    // 0.000107° de longitud ≈ 11.9 m en 1 s ≈ 11.9 m/s, justo debajo de 12.
    const leg = acceptGpsLeg({
      from: at(0, 0, 0, 5),
      to: at(0, 0.000107, 1000, 5),
    });
    expect(leg).toBeGreaterThan(11.8);
    expect(leg).toBeLessThan(12);
  });

  test('accuracy por debajo del umbral → acepta (se puede medir)', () => {
    const leg = acceptGpsLeg({
      from: at(0, 0, 0, 10),
      to: at(0, 0.00009, 1000, 10),
    });
    expect(leg).not.toBeNull();
  });

  test('punto sin accuracy (undefined) → no se descarta por eso', () => {
    const leg = acceptGpsLeg({ from: at(0, 0, 0), to: at(0, 0.00009, 1000) });
    expect(leg).not.toBeNull();
  });

  test('from o to ausente → null', () => {
    expect(acceptGpsLeg({ from: null, to: at(0, 0, 0, 5) })).toBeNull();
    expect(acceptGpsLeg({ from: at(0, 0, 0, 5), to: null })).toBeNull();
  });

  test('coordenadas o timestamp no numéricos → null', () => {
    expect(acceptGpsLeg({ from: at(0, 0, 0, 5), to: at(NaN, 0, 1000, 5) })).toBeNull();
    expect(acceptGpsLeg({ from: at(0, 0, 0, 5), to: at(0, 0, NaN, 5) })).toBeNull();
  });

  test('timestamp sin válido en el punto previo → null (no se puede medir velocidad)', () => {
    expect(acceptGpsLeg({ from: at(0, 0, undefined, 5), to: at(0, 0.00009, 1000, 5) })).toBeNull();
  });

  test('umbral de accuracy configurable', () => {
    const punto = { from: at(0, 0, 0, 50), to: at(0, 0.00001, 1000, 50) };
    expect(acceptGpsLeg(punto)).toBeNull();
    expect(acceptGpsLeg({ ...punto, maxAccuracyMeters: 100 })).not.toBeNull();
  });
});
describe('smoothGpsPoint', () => {
  test('sin punto previo, devuelve el crudo tal cual (sin historial para suavizar)', () => {
    const result = smoothGpsPoint(null, { latitude: -34.6, longitude: -58.4, accuracy: 5 });
    expect(result).toEqual({ latitude: -34.6, longitude: -58.4 });
  });

  test('buena precisión (accuracy bajo) pesa cerca de alphaMax hacia el punto crudo', () => {
    const previous = { latitude: 0, longitude: 0 };
    const raw = { latitude: 1, longitude: 0, accuracy: 5 }; // k=4 default, 4/5=0.8=alphaMax
    const result = smoothGpsPoint(previous, raw);
    expect(result.latitude).toBeCloseTo(0.8, 5);
  });

  test('precisión mala (accuracy alto, pero ya pasó el gate) se clampea a alphaMin', () => {
    const previous = { latitude: 0, longitude: 0 };
    const raw = { latitude: 1, longitude: 0, accuracy: 29 }; // 4/29 ≈ 0.138, clamp a 0.2
    const result = smoothGpsPoint(previous, raw);
    expect(result.latitude).toBeCloseTo(0.2, 5);
  });

  test('accuracy intermedio interpola entre alphaMin y alphaMax', () => {
    const previous = { latitude: 0, longitude: 0 };
    const raw = { latitude: 1, longitude: 0, accuracy: 10 }; // 4/10 = 0.4
    const result = smoothGpsPoint(previous, raw);
    expect(result.latitude).toBeCloseTo(0.4, 5);
  });

  test('sin accuracy en el punto, usa alphaMax (no penaliza un dato que no puede evaluar)', () => {
    const previous = { latitude: 0, longitude: 0 };
    const raw = { latitude: 1, longitude: 0 };
    const result = smoothGpsPoint(previous, raw);
    expect(result.latitude).toBeCloseTo(0.8, 5);
  });

  test('longitude se suaviza con el mismo alpha que latitude', () => {
    const previous = { latitude: 0, longitude: 0 };
    const raw = { latitude: 0, longitude: 2, accuracy: 5 };
    const result = smoothGpsPoint(previous, raw);
    expect(result.longitude).toBeCloseTo(1.6, 5);
  });

  test('opciones custom (k/alphaMin/alphaMax) se respetan', () => {
    const previous = { latitude: 0, longitude: 0 };
    const raw = { latitude: 1, longitude: 0, accuracy: 5 };
    const result = smoothGpsPoint(previous, raw, { k: 1, alphaMin: 0, alphaMax: 1 });
    expect(result.latitude).toBeCloseTo(0.2, 5); // 1/5 = 0.2, sin clamp porque alphaMax=1
  });
});
