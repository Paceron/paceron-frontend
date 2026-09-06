import { buildExerciseStatLine } from '../components/plans/exercise-kind-meta.js';

describe('buildExerciseStatLine', () => {
  test('arma intensidad cuando está cargada', () => {
    expect(buildExerciseStatLine({ intensity: 'light', minutes: null, distanceM: null, speedKph: null, muscleGroup: null })).toBe('Suave');
  });

  test('arma minutos para caminata/trote', () => {
    expect(buildExerciseStatLine({ intensity: null, minutes: 20, distanceM: null, speedKph: null, muscleGroup: null })).toBe('20 min');
  });

  test('arma distancia + ritmo para ritmo continuo/corrida', () => {
    expect(buildExerciseStatLine({ intensity: null, minutes: null, distanceM: 3000, speedKph: 10, muscleGroup: null })).toBe('3000 m · 10 km/h');
  });

  test('resuelve el nombre legible del grupo muscular para elongación', () => {
    expect(buildExerciseStatLine({ intensity: null, minutes: null, distanceM: null, speedKph: null, muscleGroup: 'cuadriceps' })).toBe('Cuádriceps');
  });

  test('ignora un muscleGroup que no está en el catálogo', () => {
    expect(buildExerciseStatLine({ intensity: null, minutes: null, distanceM: null, speedKph: null, muscleGroup: 'no-existe' })).toBe('');
  });

  test('combina cualquier cantidad de campos opcionales, sin atarlos a un tipo', () => {
    const line = buildExerciseStatLine({ intensity: 'vigorous', minutes: null, distanceM: 400, speedKph: 14, muscleGroup: null }, { repeatCount: 4, restMinutes: 2 });
    expect(line).toBe('Fuerte · 400 m · 14 km/h · descanso 2 min entre series');
  });

  test('devuelve cadena vacía si no hay ningún dato característico', () => {
    expect(buildExerciseStatLine({ intensity: null, minutes: null, distanceM: null, speedKph: null, muscleGroup: null })).toBe('');
  });
});
