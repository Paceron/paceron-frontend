import { buildExerciseStatLine } from '../components/plans/exercise-kind-meta.js';

describe('buildExerciseStatLine', () => {
  test('arma minutos para caminata/trote', () => {
    expect(buildExerciseStatLine({ minutes: 20, distanceM: null, speedKph: null, muscleGroup: null })).toBe('20 min');
  });

  test('arma distancia + ritmo para ritmo continuo/corrida', () => {
    expect(buildExerciseStatLine({ minutes: null, distanceM: 3000, speedKph: 10, muscleGroup: null })).toBe('3000 m · 10 km/h');
  });

  test('resuelve el nombre legible del grupo muscular para elongación', () => {
    expect(buildExerciseStatLine({ minutes: null, distanceM: null, speedKph: null, muscleGroup: 'cuadriceps' })).toBe('Cuádriceps');
  });

  test('ignora un muscleGroup que no está en el catálogo', () => {
    expect(buildExerciseStatLine({ minutes: null, distanceM: null, speedKph: null, muscleGroup: 'no-existe' })).toBe('');
  });

  test('suma el descanso entre series cuando repeatCount > 1', () => {
    const line = buildExerciseStatLine({ minutes: null, distanceM: 400, speedKph: 14, muscleGroup: null }, { repeatCount: 4, restMinutes: 2 });
    expect(line).toBe('400 m · 14 km/h · descanso 2 min entre series');
  });

  test('devuelve cadena vacía si no hay ningún dato característico', () => {
    expect(buildExerciseStatLine({ minutes: null, distanceM: null, speedKph: null, muscleGroup: null })).toBe('');
  });
});
