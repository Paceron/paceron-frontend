import {
  RADAR_AXES,
  normalizeRadarAxes,
  radarPolygon,
} from '../utils/dashboard-chart.js';

const summary = (overrides = {}) => ({
  totals: {
    achieved_speed_kph: 15,
    target_speed_kph: 16,
    target_distance_m: 20_000,
    achieved_target_distance_m: 15_000,
    compliance_rate: 75,
    ...overrides.totals,
  },
  trend: { trend_pct: 4, ...overrides.trend },
  consistency: { cv: 0.08, ...overrides.consistency },
});

const axisById = (axes, id) => axes.find((axis) => axis.id === id);

describe('normalizeRadarAxes', () => {
  test('devuelve los cinco ejes del contrato, en orden y con su clave de unidad', () => {
    const axes = normalizeRadarAxes(summary());
    expect(axes.map((axis) => axis.id)).toEqual(['speed', 'volume', 'consistency', 'compliance', 'trend']);
    expect(RADAR_AXES).toHaveLength(5);
    expect(axes.map((axis) => axis.unitKey)).toEqual(['speed', 'distance', null, 'compliance', 'delta']);
  });

  test('cada eje trae su bajada, y la de volumen habla de logrado contra objetivo', () => {
    const axes = normalizeRadarAxes(summary());
    // El "i" de cada barrita muestra `hint` tal cual: un eje sin bajada queda con
    // un tooltip vacío. Volumen (gap 44, 2026-11-12) dejó de hablar de un tope
    // fijo en km -- ahora es logrado/objetivo, así que el hint tiene que hablar
    // de "objetivo", no de un número de km hardcodeado.
    expect(axes.every((axis) => typeof axis.hint === 'string' && axis.hint.trim().length > 0)).toBe(true);
    expect(axisById(axes, 'volume').hint).toMatch(/objetivo/i);
  });

  test('lee los tres contenedores reales, no un objeto plano', () => {
    const axes = normalizeRadarAxes(summary());
    expect(axisById(axes, 'speed').value).toBeCloseTo(93.75, 2);
    expect(axisById(axes, 'compliance').value).toBe(75);
    // trend_pct vive en `trend`, cv en `consistency`: mezclarlos da null.
    expect(axisById(axes, 'trend').value).toBe(70);
    expect(axisById(axes, 'consistency').value).toBeCloseTo(92, 6);
  });

  test('el eje de consistencia está INVERTIDO: más dispersión es menor valor', () => {
    const loose = normalizeRadarAxes(summary({ consistency: { cv: 0.08 } }));
    const tight = normalizeRadarAxes(summary({ consistency: { cv: 0.02 } }));
    expect(axisById(tight, 'consistency').value).toBeGreaterThan(axisById(loose, 'consistency').value);
  });

  test('cv de 0 da el máximo del eje', () => {
    const axes = normalizeRadarAxes(summary({ consistency: { cv: 0 } }));
    expect(axisById(axes, 'consistency').value).toBe(100);
  });

  test('TODOS los ejes quedan dentro de [0, 100] con valores extremos', () => {
    // trend_pct = +12 daría 50 + 60 = 110 sin recortar; cv = 1,2 daría -20.
    const axes = normalizeRadarAxes(summary({
      trend: { trend_pct: 12 },
      consistency: { cv: 1.2 },
      totals: { compliance_rate: 180, achieved_speed_kph: 40 },
    }));
    for (const axis of axes) {
      expect({ id: axis.id, value: axis.value, inRange: axis.value === null || (axis.value >= 0 && axis.value <= 100) }).toEqual({
        id: axis.id,
        value: axis.value,
        inRange: true,
      });
    }
    expect(axisById(axes, 'trend').value).toBe(100);
    expect(axisById(axes, 'consistency').value).toBe(0);
    expect(axisById(axes, 'compliance').value).toBe(100);
    expect(axisById(axes, 'speed').value).toBe(100);
  });

  test('un eje sin dato queda null y disponible: false, nunca 0', () => {
    // `100 − (null × 100)` da 100 en JS: sin el descarte, un corredor con una
    // sola serie vería "consistencia perfecta" sobre un punto que no existe.
    const axes = normalizeRadarAxes(summary({
      consistency: { cv: null },
      trend: { trend_pct: null },
      totals: { target_speed_kph: null },
    }));
    expect(axisById(axes, 'consistency')).toMatchObject({ value: null, raw: null, available: false });
    expect(axisById(axes, 'trend')).toMatchObject({ value: null, available: false });
    expect(axisById(axes, 'speed')).toMatchObject({ value: null, available: false });
    // Los que sí tienen dato siguen disponibles.
    expect(axisById(axes, 'volume').available).toBe(true);
    expect(axisById(axes, 'compliance').available).toBe(true);
  });

  test('el volumen se normaliza contra el objetivo de distancia (gap 44), no contra un tope fijo', () => {
    const half = normalizeRadarAxes(summary({ totals: { target_distance_m: 20_000, achieved_target_distance_m: 10_000 } }));
    expect(axisById(half, 'volume').value).toBe(50);
    const full = normalizeRadarAxes(summary({ totals: { target_distance_m: 20_000, achieved_target_distance_m: 20_000 } }));
    expect(axisById(full, 'volume').value).toBe(100);
    // Corrí más de lo pedido: se recorta en 100, el eje no pasa el máximo.
    const over = normalizeRadarAxes(summary({ totals: { target_distance_m: 20_000, achieved_target_distance_m: 30_000 } }));
    expect(axisById(over, 'volume').value).toBe(100);
  });

  test('target_distance_m null o no positivo deja el eje sin dato, no en 0', () => {
    const noTarget = normalizeRadarAxes(summary({ totals: { target_distance_m: null, achieved_target_distance_m: null } }));
    expect(axisById(noTarget, 'volume')).toMatchObject({ value: null, available: false });
    const zeroTarget = normalizeRadarAxes(summary({ totals: { target_distance_m: 0, achieved_target_distance_m: 0 } }));
    expect(axisById(zeroTarget, 'volume')).toMatchObject({ value: null, available: false });
    const negativeTarget = normalizeRadarAxes(summary({ totals: { target_distance_m: -500 } }));
    expect(axisById(negativeTarget, 'volume')).toMatchObject({ value: null, available: false });
  });

  test('con objetivo positivo y nada logrado, el eje queda en 0 -- disponible, no "sin dato"', () => {
    const axes = normalizeRadarAxes(summary({ totals: { target_distance_m: 20_000, achieved_target_distance_m: 0 } }));
    expect(axisById(axes, 'volume')).toMatchObject({ value: 0, available: true });
  });

  test('el eje de ritmo necesita ambos valores: sin objetivo no se inventa un 0', () => {
    const axes = normalizeRadarAxes(summary({ totals: { achieved_speed_kph: 15, target_speed_kph: null } }));
    expect(axisById(axes, 'speed')).toMatchObject({ value: null, raw: 15, reference: null });
  });

  test('un objetivo de cero no divide por cero', () => {
    const axes = normalizeRadarAxes(summary({ totals: { target_speed_kph: 0 } }));
    expect(axisById(axes, 'speed').value).toBeNull();
  });

  test('el resumen trae el valor real de cada eje, no solo el normalizado', () => {
    const axes = normalizeRadarAxes(summary());
    expect(axisById(axes, 'speed')).toMatchObject({ raw: 15, reference: 16 });
    // `raw` es lo LOGRADO (mismo criterio que speed: raw = achieved, reference
    // = target) -- no el total de distancia del período, que mezclaría series
    // con y sin objetivo de distancia (gap 44).
    expect(axisById(axes, 'volume')).toMatchObject({ raw: 15_000, reference: 20_000 });
    expect(axisById(axes, 'trend').raw).toBe(4);
  });

  test('sin respuesta devuelve los cinco ejes ausentes, sin tirar', () => {
    const axes = normalizeRadarAxes();
    expect(axes).toHaveLength(5);
    expect(axes.every((axis) => axis.value === null && axis.available === false)).toBe(true);
  });
});

describe('radarPolygon', () => {
  const axes = normalizeRadarAxes(summary());

  test('con los cinco ejes con dato cierra un polígono', () => {
    const shape = radarPolygon(axes, { cx: 100, cy: 100, radius: 80 });
    expect(shape.present).toBe(5);
    expect(shape.missing).toBe(0);
    expect(shape.closed).toBe(true);
    expect(shape.path.endsWith(' Z')).toBe(true);
  });

  test('un eje ausente SALE del polígono: la arista lo saltea en vez de pasar por el centro', () => {
    const withMissing = axes.map((axis) => (axis.id === 'compliance' ? { ...axis, value: null, available: false } : axis));
    const shape = radarPolygon(withMissing, { cx: 100, cy: 100, radius: 80 });
    expect(shape.present).toBe(4);
    expect(shape.missing).toBe(1);

    // El vértice ausente queda en el centro (donde el path NO pasa) y ningún
    // segmento del path lo toca: esa es la diferencia con "cerrar por el centro".
    const missing = shape.points.find((point) => point.id === 'compliance');
    expect([missing.x, missing.y]).toEqual([100, 100]);
    const coords = shape.path.replace(/[MZ]/g, ' ').trim().split(/[ L]+/).map(Number);
    const vertexPairs = [];
    for (let index = 0; index < coords.length; index += 2) vertexPairs.push([coords[index], coords[index + 1]]);
    // 4 vértices: el quinto es el que falta, y el cierre es el `Z` del path.
    expect(vertexPairs).toHaveLength(4);
    expect(vertexPairs).not.toContainEqual([100, 100]);
  });

  test('con un solo eje con dato no hay polígono', () => {
    const one = axes.map((axis, index) => (index === 0 ? axis : { ...axis, value: null, available: false }));
    const shape = radarPolygon(one, { cx: 0, cy: 0, radius: 10 });
    expect(shape.present).toBe(1);
    expect(shape.path).toBeNull();
  });

  test('con dos ejes con dato devuelve el segmento abierto, sin inventar el resto', () => {
    const two = axes.map((axis, index) => (index < 2 ? axis : { ...axis, value: null, available: false }));
    const shape = radarPolygon(two, { cx: 0, cy: 0, radius: 10 });
    expect(shape.present).toBe(2);
    expect(shape.closed).toBe(false);
    expect(shape.path.endsWith(' Z')).toBe(false);
  });

  test('un valor fuera de [0, 100] se recorta en el radio, no se dibuja fuera', () => {
    const shape = radarPolygon(
      [{ id: 'a', label: 'A', value: 140 }, { id: 'b', label: 'B', value: 20 }, { id: 'c', label: 'C', value: 60 }],
      { cx: 0, cy: 0, radius: 100 },
    );
    const a = shape.points.find((point) => point.id === 'a');
    expect(Math.hypot(a.x, a.y)).toBeCloseTo(100, 2);
    const b = shape.points.find((point) => point.id === 'b');
    expect(Math.hypot(b.x, b.y)).toBeCloseTo(20, 2);
  });

  test('devuelve el radio exterior de cada eje para rotularlo', () => {
    const shape = radarPolygon(axes, { cx: 100, cy: 100, radius: 80 });
    shape.points.forEach((point) => {
      expect(Math.hypot(point.outerX - 100, point.outerY - 100)).toBeCloseTo(80, 2);
    });
  });

  test('sin ejes no tira', () => {
    const shape = radarPolygon(undefined, { cx: 0, cy: 0, radius: 50 });
    expect(shape).toMatchObject({ points: [], path: null, present: 0 });
  });
});
