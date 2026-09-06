import { buildExerciseStatLine, buildExerciseName } from '../components/plans/exercise-kind-meta.js';

describe('buildExerciseStatLine', () => {
  test('omite minutos si fueron el protagonista del nombre (walking/jogging sin distancia)', () => {
    expect(buildExerciseStatLine({ kind: 'jogging', minutes: 20, distanceM: null, speedKph: null, muscleGroup: null })).toBe('');
  });

  test('muestra minutos como secundario cuando el nombre usó distancia', () => {
    expect(buildExerciseStatLine({ kind: 'jogging', minutes: 10, distanceM: 1500, speedKph: null, muscleGroup: null })).toBe('10 min');
  });

  test('ritmo continuo/corrida: nunca repite la distancia (queda en el nombre), arma el ritmo', () => {
    expect(buildExerciseStatLine({ kind: 'cruising', minutes: null, distanceM: 3000, speedKph: 10, muscleGroup: null })).toBe('10 km/h');
  });

  test('ya no repite el grupo muscular (queda en el nombre de elongación)', () => {
    expect(buildExerciseStatLine({ kind: 'elongation', minutes: null, distanceM: null, speedKph: null, muscleGroup: 'cuadriceps' })).toBe('');
  });

  test('suma el descanso entre series cuando repeatCount > 1', () => {
    const line = buildExerciseStatLine({ kind: 'running', minutes: null, distanceM: 400, speedKph: 14, muscleGroup: null }, { repeatCount: 4, restMinutes: 2 });
    expect(line).toBe('14 km/h · descanso 2 min entre series');
  });

  test('devuelve cadena vacía si no hay ningún dato característico', () => {
    expect(buildExerciseStatLine({ kind: 'walking', minutes: null, distanceM: null, speedKph: null, muscleGroup: null })).toBe('');
  });
});

describe('buildExerciseName', () => {
  test.each([
    ['walking', 'light', 'Caminata suave 20 min'],
    ['walking', 'moderate', 'Caminata moderada 20 min'],
    ['jogging', 'vigorous', 'Trote fuerte 20 min'],
  ])('arma nombre con minutos cuando no hay distancia (%s, %s)', (kind, intensity, expected) => {
    expect(buildExerciseName({ kind, intensity, minutes: 20, distanceM: null, muscleGroup: null })).toBe(expected);
  });

  test('usa metros bajo 1000', () => {
    expect(buildExerciseName({ kind: 'running', intensity: 'vigorous', minutes: null, distanceM: 400, muscleGroup: null })).toBe('Corrida fuerte 400m');
  });

  test('usa km entero desde 1000', () => {
    expect(buildExerciseName({ kind: 'cruising', intensity: 'light', minutes: null, distanceM: 8000, muscleGroup: null })).toBe('Ritmo continuo suave 8km');
  });

  test('usa km con un decimal si no es entero', () => {
    expect(buildExerciseName({ kind: 'jogging', intensity: 'light', minutes: null, distanceM: 1500, muscleGroup: null })).toBe('Trote suave 1.5km');
  });

  test('el ejemplo original: trote suave 3km', () => {
    expect(buildExerciseName({ kind: 'jogging', intensity: 'light', minutes: null, distanceM: 3000, muscleGroup: null })).toBe('Trote suave 3km');
  });

  test('walking/jogging prefieren distancia por sobre minutos cuando hay ambas', () => {
    expect(buildExerciseName({ kind: 'walking', intensity: 'moderate', minutes: 8, distanceM: 600, muscleGroup: null })).toBe('Caminata moderada 600m');
  });

  test('elongation se nombra por grupo muscular, sin intensidad', () => {
    expect(buildExerciseName({ kind: 'elongation', intensity: null, minutes: null, distanceM: null, muscleGroup: 'psoas' })).toBe('Elongación de psoas / flexores de cadera');
  });

  test('degrada con gracia sin intensidad ni número', () => {
    expect(buildExerciseName({ kind: 'running', intensity: null, minutes: null, distanceM: null, muscleGroup: null })).toBe('Corrida');
  });

  test('degrada con gracia en elongation sin grupo muscular', () => {
    expect(buildExerciseName({ kind: 'elongation', intensity: null, minutes: null, distanceM: null, muscleGroup: null })).toBe('Elongación');
  });

  test('kind desconocido devuelve cadena vacía', () => {
    expect(buildExerciseName({ kind: 'unknown', intensity: null, minutes: null, distanceM: null, muscleGroup: null })).toBe('');
  });
});
