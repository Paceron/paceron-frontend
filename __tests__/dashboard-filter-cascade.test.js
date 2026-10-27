import {
  METRIC_KINDS,
  availableMetricKinds,
  exercisesForKind,
  reconcileExercise,
} from '../utils/dashboard-filter-cascade.js';

// La cascada tipo → ejercicio → rangos. Estas dos funciones son la parte que se
// puede probar del filtro, y la que más fácil se rompe en silencio: un
// ejercicio que queda elegido de un tipo que ya no es el de arriba es un estado
// imposible visible, y `kind` + `exercise_id` juntos son un 400 del backend.

const EXERCISES = [
  { id: 1, name: 'Calentamiento', kind: 'liviano' },
  { id: 2, name: 'Elongación', kind: 'elongacion' },
  { id: 3, name: 'Ritmo continuo 5 km', kind: 'ritmo_continuo' },
  { id: 4, name: 'Ritmo continuo 10 km', kind: 'ritmo_continuo' },
  { id: 5, name: 'Preferencias 1000 m', kind: 'velocidad_distancia' },
  { id: 6, name: 'Velocidad máxima 60 s', kind: 'velocidad_tiempo' },
];

describe('dashboard filter cascade — los tres tipos con métrica', () => {
  test('son tres, y liviano/elongacion quedan afuera', () => {
    expect(METRIC_KINDS).toEqual(['ritmo_continuo', 'velocidad_distancia', 'velocidad_tiempo']);
    expect(METRIC_KINDS).not.toContain('liviano');
    expect(METRIC_KINDS).not.toContain('elongacion');
  });

  test('con tipo elegido, solo los de ese tipo', () => {
    expect(exercisesForKind(EXERCISES, 'ritmo_continuo').map((exercise) => exercise.id)).toEqual([3, 4]);
    expect(exercisesForKind(EXERCISES, 'velocidad_tiempo').map((exercise) => exercise.id)).toEqual([6]);
  });

  test('sin tipo (el "todos") ofrece los de los tres tipos métricos y ningún otro', () => {
    const offered = exercisesForKind(EXERCISES, '');
    expect(offered.map((exercise) => exercise.id)).toEqual([3, 4, 5, 6]);
    expect(offered.some((exercise) => exercise.kind === 'liviano')).toBe(false);
    expect(offered.some((exercise) => exercise.kind === 'elongacion')).toBe(false);
  });

  test('un tipo que no existe no ofrece nada, en vez de ofrecerlos todos', () => {
    expect(exercisesForKind(EXERCISES, 'jogging')).toEqual([]);
  });

  test('una lista que todavía no cargó no rompe', () => {
    expect(exercisesForKind(undefined, 'ritmo_continuo')).toEqual([]);
  });
});

describe('dashboard filter cascade — reconciliar el ejercicio al cambiar de tipo', () => {
  test('el ejercicio sigue elegido si es del tipo nuevo', () => {
    expect(reconcileExercise(EXERCISES, 'ritmo_continuo', 4)).toBe(4);
    expect(reconcileExercise(EXERCISES, '', 5)).toBe(5);
  });

  test('el ejercicio se deselecciona si ya no es del tipo nuevo', () => {
    // El caso de la spec: "Pasadas 1000 m" con `ritmo_continuo` arriba.
    expect(reconcileExercise(EXERCISES, 'ritmo_continuo', 5)).toBeNull();
    expect(reconcileExercise(EXERCISES, 'ritmo_continuo', 6)).toBeNull();
  });

  test('volver al "todos" no borra un ejercicio que sigue en la lista', () => {
    expect(reconcileExercise(EXERCISES, '', 3)).toBe(3);
  });

  test('el id se compara normalizado: el de la lista es number y el elegido string', () => {
    expect(reconcileExercise(EXERCISES, 'ritmo_continuo', '4')).toBe(4);
    expect(reconcileExercise(EXERCISES, 'ritmo_continuo', '5')).toBeNull();
  });

  test('sin ejercicio elegido el resultado es null (no hay nada que reconciliar)', () => {
    expect(reconcileExercise(EXERCISES, 'ritmo_continuo', '')).toBeNull();
    expect(reconcileExercise(EXERCISES, 'ritmo_continuo', null)).toBeNull();
    expect(reconcileExercise(EXERCISES, 'ritmo_continuo', undefined)).toBeNull();
  });

  test('un ejercicio que no está en la lista se deselecciona', () => {
    expect(reconcileExercise(EXERCISES, 'ritmo_continuo', 999)).toBeNull();
  });
});
describe('dashboard filter cascade — tipos ofrecidos según el catálogo', () => {
  test('solo los tipos que tienen al menos un ejercicio', () => {
    expect(availableMetricKinds(EXERCISES)).toEqual(METRIC_KINDS);
    const catalogWithoutTimeSpeed = EXERCISES.filter((exercise) => exercise.kind !== 'velocidad_tiempo');
    expect(availableMetricKinds(catalogWithoutTimeSpeed)).toEqual(['ritmo_continuo', 'velocidad_distancia']);
  });

  test('liviano y elongacion no cuentan aunque existan en el catálogo', () => {
    expect(availableMetricKinds([{ id: 1, kind: 'liviano' }, { id: 2, kind: 'elongacion' }])).toEqual([]);
  });

  test('sin catálogo no ofrece ningún tipo', () => {
    expect(availableMetricKinds(undefined)).toEqual([]);
    expect(availableMetricKinds([])).toEqual([]);
  });
});
