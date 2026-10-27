import {
  PALETTE_CASES,
  describePalette,
  resolvePaletteCase,
  resolvePrimaryMetric,
  resolveRankingMetric,
  toRankingItems,
} from '../utils/dashboard-palette.js';

const units = {
  speed: 'km/h',
  time: 'ms',
  distance: 'm',
  delta: '%',
  compliance: '%',
  best_time: 'ms',
  percentage_point: 'pp',
};

// Las tres tuplas del contrato, con la forma REAL de /dashboard/metrics/summary:
// `has_target` y `axis` van al tope, `target_speed_kph` dentro de `totals`, y las
// unidades en su propio bloque. Los helpers de abajo los traducen a la firma de
// utils/dashboard-palette.js, que usa los nombres del argumento.
const FULL = {
  axis: 'distance_and_time',
  has_target: true,
  totals: { achieved_speed_kph: 15.2, target_speed_kph: 16, distance_m: 12_000, time_ms: 2_600_000, best_time_ms: 1_500_000 },
  units,
};
const REDUCED = {
  axis: 'distance',
  has_target: true,
  totals: { achieved_speed_kph: 18.4, target_speed_kph: null, distance_m: 205, time_ms: 40_000, best_time_ms: 12_000 },
  units,
};
const WITHOUT = {
  axis: 'time',
  has_target: false,
  totals: { achieved_speed_kph: null, target_speed_kph: null, distance_m: null, time_ms: 900_000, best_time_ms: 780_000 },
  units,
};

const primary = (data, kind) => resolvePrimaryMetric({
  axis: data.axis,
  hasTarget: data.has_target,
  kind,
  targetSpeedKph: data.totals?.target_speed_kph,
  totals: data.totals,
  units: data.units,
});

describe('resolvePaletteCase', () => {
  test('la tupla de tres campos decide, no el kind', () => {
    expect(resolvePaletteCase({ hasTarget: true, axis: 'distance_and_time', targetSpeedKph: 16 })).toBe(PALETTE_CASES.withTarget);
    expect(resolvePaletteCase({ hasTarget: true, axis: 'distance', targetSpeedKph: null })).toBe(PALETTE_CASES.reducedTarget);
    expect(resolvePaletteCase({ hasTarget: true, axis: 'time', targetSpeedKph: null })).toBe(PALETTE_CASES.reducedTarget);
    expect(resolvePaletteCase({ hasTarget: false, axis: 'time', targetSpeedKph: 16 })).toBe(PALETTE_CASES.withoutTarget);
  });

  test('`has_target` solo no alcanza: con objetivo y sin velocidad objetivo NO es A completo', () => {
    // El caso que motiva el tercer palette: 100 m de velocidad máxima tiene
    // objetivo cargado pero no tiene tiempo objetivo, así que la velocidad
    // esperada no se puede derivar de la distancia sola.
    expect(REDUCED.has_target).toBe(true);
    expect(REDUCED.totals.target_speed_kph).toBeNull();
    expect(resolvePaletteCase({ hasTarget: true, axis: REDUCED.axis, targetSpeedKph: null })).not.toBe(PALETTE_CASES.withTarget);
  });

  test('sin respuesta no tira y cae en el caso sin objetivo', () => {
    expect(resolvePaletteCase()).toBe(PALETTE_CASES.withoutTarget);
  });
});

describe('describePalette', () => {
  test('lee la tupla desde la forma de la respuesta', () => {
    expect(describePalette(FULL, 'ritmo_continuo')).toMatchObject({ case: PALETTE_CASES.withTarget, hasPace: true });
    expect(describePalette(REDUCED, 'velocidad_distancia')).toMatchObject({ case: PALETTE_CASES.reducedTarget, hasPace: false });
    expect(describePalette(WITHOUT, 'elongacion')).toMatchObject({ case: PALETTE_CASES.withoutTarget, hasPace: false });
  });
});

describe('resolvePrimaryMetric', () => {
  test('A completo: el ritmo es el número principal', () => {
    expect(primary(FULL, 'ritmo_continuo')).toMatchObject({
      id: 'achieved_speed_kph',
      label: 'Ritmo promedio',
      value: 15.2,
      unit: 'km/h',
      case: PALETTE_CASES.withTarget,
    });
  });

  test('A reducido con eje distancia: la distancia es el número principal', () => {
    expect(primary(REDUCED, 'velocidad_distancia')).toMatchObject({
      id: 'distance_m',
      label: 'Distancia',
      value: 205,
      unit: 'm',
      case: PALETTE_CASES.reducedTarget,
    });
  });

  test('A reducido con eje tiempo (elongacion): el tiempo es el número principal', () => {
    const elongation = { ...REDUCED, axis: 'time', totals: { ...REDUCED.totals, distance_m: null } };
    expect(primary(elongation, 'elongacion')).toMatchObject({
      id: 'time_ms',
      label: 'Tiempo total',
      unit: 'ms',
      case: PALETTE_CASES.reducedTarget,
    });
  });

  test('B: el mejor tiempo es el número grande', () => {
    expect(primary(WITHOUT, 'elongacion')).toMatchObject({
      id: 'best_time_ms',
      label: 'Mejor tiempo',
      value: 780_000,
      unit: 'ms',
      case: PALETTE_CASES.withoutTarget,
    });
  });

  test('`liviano` muestra VOLUMEN, nunca ritmo, aunque tenga velocidad objetivo', () => {
    // El tipo se define por volumen (utils/exercise-field-matrix.js, showSpeed:
    // false): mostrar el ritmo de un calentamiento sería medirlo con una vara que
    // el producto no usa para ese tipo.
    expect(primary(FULL, 'liviano')).toMatchObject({ id: 'distance_m', label: 'Volumen', value: 12_000, unit: 'm' });
    expect(primary({ ...FULL, totals: { ...FULL.totals, distance_m: null } }, 'liviano')).toMatchObject({
      id: 'time_ms',
      label: 'Volumen',
      unit: 'ms',
    });
  });

  test('un dato ausente queda disponible: false y valor null, nunca 0', () => {
    const empty = primary({ ...WITHOUT, totals: { ...WITHOUT.totals, best_time_ms: null } }, 'elongacion');
    expect(empty).toMatchObject({ value: null, available: false });
    expect(empty.value).not.toBe(0);
  });

  test('la unidad sale del bloque `units` de la respuesta, no de un sufijo fijo', () => {
    expect(primary({ ...FULL, units: { speed: 'km/h' } }, 'ritmo_continuo').unit).toBe('km/h');
    expect(primary({ ...FULL, units: {} }, 'ritmo_continuo').unit).toBeNull();
  });
});

describe('resolveRankingMetric', () => {
  test('en B el mejor valor es el menor, así que el orden es ascendente', () => {
    expect(resolveRankingMetric(PALETTE_CASES.withoutTarget)).toEqual({ key: 'best_time_ms', unitKey: 'best_time', sort: 'asc' });
  });

  test('en A manda el ritmo, y en A reducido la distancia', () => {
    expect(resolveRankingMetric(PALETTE_CASES.withTarget)).toEqual({ key: 'mean_speed_kph', unitKey: 'speed', sort: 'desc' });
    expect(resolveRankingMetric(PALETTE_CASES.reducedTarget)).toEqual({ key: 'total_distance_m', unitKey: 'distance', sort: 'desc' });
  });
});

describe('toRankingItems', () => {
  const metric = resolveRankingMetric(PALETTE_CASES.withTarget);

  test('arma una fila por corredor con la magnitud del caso', () => {
    expect(toRankingItems([
      { athlete_user_id: 101, name: 'Lucía', surname: 'Fernández', mean_speed_kph: 16.2 },
      { athlete_user_id: 102, name: 'Martín', surname: 'Gómez', mean_speed_kph: 15.4 },
    ], metric)).toEqual([
      { id: 101, label: 'Lucía Fernández', value: 16.2 },
      { id: 102, label: 'Martín Gómez', value: 15.4 },
    ]);
  });

  test('sin ese dato la fila conserva el null en vez de poner 0', () => {
    expect(toRankingItems([{ athlete_user_id: 7, name: 'Sin ritmo' }], metric)[0].value).toBeNull();
  });

  test('sin series no tira', () => {
    expect(toRankingItems(undefined, metric)).toEqual([]);
  });
});
