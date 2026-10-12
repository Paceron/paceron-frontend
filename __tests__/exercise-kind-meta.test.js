// Tests actualizados con el reemplazo del enum de tipos (antes: walking/jogging/
// elongation/cruising/running, con `intensity` y SIN gating por tipo — cualquier
// combinación de campos era válida para cualquier tipo). Ahora `buildExerciseStatLine`
// consulta la matriz de utils/exercise-field-matrix.js y solo muestra lo que el
// tipo permite. Los casos viejos se conservaron con el `kind` que los hace válidos.
import { buildExerciseStatLine, EXERCISE_KIND_META, WARMCOOL_KINDS } from '../components/plans/exercise-kind-meta.js';

// Base con todos los campos en null — cada test declara solo lo que le interesa.
function ex(overrides = {}) {
  return { kind: 'liviano', minutes: null, distanceM: null, speedKph: null, muscleGroup: null, ...overrides };
}

describe('buildExerciseStatLine', () => {
  test('arma minutos para liviano', () => {
    expect(buildExerciseStatLine(ex({ minutes: 20 }))).toBe('20 min');
  });

  test('arma distancia + ritmo para ritmo_continuo', () => {
    expect(buildExerciseStatLine(ex({ kind: 'ritmo_continuo', distanceM: 3000, speedKph: 10 }))).toBe('3000 m · 10 km/h');
  });

  test('arma distancia + ritmo para velocidad_distancia', () => {
    expect(buildExerciseStatLine(ex({ kind: 'velocidad_distancia', distanceM: 400, speedKph: 14 }))).toBe('400 m · 14 km/h');
  });

  test('arma tiempo + ritmo para velocidad_tiempo', () => {
    expect(buildExerciseStatLine(ex({ kind: 'velocidad_tiempo', minutes: 12, speedKph: 14 }))).toBe('12 min · 14 km/h');
  });

  test('resuelve el nombre legible del grupo muscular para elongacion', () => {
    expect(buildExerciseStatLine(ex({ kind: 'elongacion', muscleGroup: 'cuadriceps' }))).toBe('Cuádriceps');
  });

  test('ignora un muscleGroup que no está en el catálogo', () => {
    expect(buildExerciseStatLine(ex({ kind: 'elongacion', muscleGroup: 'no-existe' }))).toBe('');
  });

  test('combina los campos del tipo + descanso', () => {
    const line = buildExerciseStatLine(
      ex({ kind: 'velocidad_distancia', distanceM: 400, speedKph: 14 }),
      { repeatCount: 4, restMinutes: 2 }
    );
    expect(line).toBe('400 m · 14 km/h · descanso 2 min entre series');
  });

  test('devuelve cadena vacía si no hay ningún dato característico', () => {
    expect(buildExerciseStatLine(ex())).toBe('');
  });

  // ── Lo nuevo: la línea respeta la matriz del tipo ──────────────────────

  test('elongacion nunca muestra distancia ni ritmo, aunque vengan cargados', () => {
    const line = buildExerciseStatLine(
      ex({ kind: 'elongacion', minutes: 30, distanceM: 500, speedKph: 12, muscleGroup: 'core' })
    );
    expect(line).toBe('30 min · Core / abdominales');
  });

  test('liviano nunca muestra ritmo ni grupo muscular', () => {
    const line = buildExerciseStatLine(ex({ distanceM: 3000, speedKph: 10, muscleGroup: 'core' }));
    expect(line).toBe('3000 m');
  });

  test('los tipos de velocidad nunca muestran grupo muscular', () => {
    const line = buildExerciseStatLine(ex({ kind: 'ritmo_continuo', minutes: 18, distanceM: 3000, muscleGroup: 'core' }));
    expect(line).toBe('18 min · 3000 m');
  });

  test('un kind desconocido no rompe (línea vacía, no throw)', () => {
    expect(buildExerciseStatLine(ex({ kind: 'walking', minutes: 20 }))).toBe('');
  });
});

describe('EXERCISE_KIND_META', () => {
  test('tiene los 5 tipos nuevos', () => {
    expect(Object.keys(EXERCISE_KIND_META).sort()).toEqual(
      ['elongacion', 'liviano', 'ritmo_continuo', 'velocidad_distancia', 'velocidad_tiempo'].sort()
    );
  });

  test('no expone los tipos viejos', () => {
    for (const old of ['walking', 'jogging', 'elongation', 'cruising', 'running']) {
      expect(EXERCISE_KIND_META[old]).toBeUndefined();
    }
  });

  test('cada tipo tiene label, ícono y color', () => {
    for (const [kind, meta] of Object.entries(EXERCISE_KIND_META)) {
      expect(typeof meta.label).toBe('string');
      expect(typeof meta.icon).toBe('string');
      expect(meta.iconColor).toMatch(/^#[0-9a-f]{6}$/i);
      expect(meta.bg).toContain('dark:');
      expect(meta.text).toContain('dark:');
    }
  });

  test('los 5 íconos son distintos entre sí', () => {
    const icons = Object.values(EXERCISE_KIND_META).map((m) => m.icon);
    expect(new Set(icons).size).toBe(5);
  });

  // El prompt pide explícitamente que ritmo_continuo / velocidad_tiempo /
  // velocidad_distancia se distingan entre sí por ícono.
  test('los 3 tipos de velocidad tienen íconos diferenciados', () => {
    const tres = ['ritmo_continuo', 'velocidad_tiempo', 'velocidad_distancia'].map((k) => EXERCISE_KIND_META[k].icon);
    expect(new Set(tres).size).toBe(3);
  });

  test('ningún tipo comparte ícono ni color con otro', () => {
    const entries = Object.values(EXERCISE_KIND_META);
    expect(new Set(entries.map((m) => m.icon)).size).toBe(entries.length);
    expect(new Set(entries.map((m) => m.iconColor)).size).toBe(entries.length);
  });
});

describe('WARMCOOL_KINDS', () => {
  test('son los tipos de calentamiento y recuperación', () => {
    expect(WARMCOOL_KINDS).toEqual(['liviano', 'elongacion']);
  });

  test('todos existen en EXERCISE_KIND_META', () => {
    for (const kind of WARMCOOL_KINDS) {
      expect(EXERCISE_KIND_META[kind]).toBeDefined();
    }
  });

  test('no incluye tipos que no pueden calentar (el filtro tiene sentido)', () => {
    expect(WARMCOOL_KINDS).not.toContain('ritmo_continuo');
    expect(WARMCOOL_KINDS).not.toContain('velocidad_tiempo');
    expect(WARMCOOL_KINDS).not.toContain('velocidad_distancia');
  });
});
