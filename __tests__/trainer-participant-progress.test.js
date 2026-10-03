import { countSetsForExercise, nextExercise, totalSetsForSession } from '../utils/trainer-participant-progress.js';

const EXERCISES = [
  { id: 10, name: 'Caminata', repeatCount: 1 },
  { id: 11, name: 'Sentadillas', repeatCount: 3 },
  { id: 12, name: 'Elongación', repeatCount: null },
];

describe('countSetsForExercise', () => {
  test('repeatCount definido', () => {
    expect(countSetsForExercise(EXERCISES, 11)).toBe(3);
  });

  test('repeatCount null -- mínimo 1', () => {
    expect(countSetsForExercise(EXERCISES, 12)).toBe(1);
  });

  test('ejercicio no encontrado -- 0', () => {
    expect(countSetsForExercise(EXERCISES, 999)).toBe(0);
  });

  test('compara id como string -- ids mixtos number/string no fallan', () => {
    expect(countSetsForExercise(EXERCISES, '11')).toBe(3);
  });
});

describe('totalSetsForSession', () => {
  test('suma repeatCount de todos los ejercicios', () => {
    expect(totalSetsForSession(EXERCISES)).toBe(5);
  });

  test('lista vacía o undefined -- 0', () => {
    expect(totalSetsForSession([])).toBe(0);
    expect(totalSetsForSession(undefined)).toBe(0);
  });
});

describe('nextExercise', () => {
  test('0 series resueltas -- el primer ejercicio, serie 1', () => {
    expect(nextExercise(EXERCISES, 0)).toEqual({ exerciseName: 'Caminata', setNumber: 1 });
  });

  test('terminó el primer ejercicio (1 serie) -- pasa al segundo, serie 1', () => {
    expect(nextExercise(EXERCISES, 1)).toEqual({ exerciseName: 'Sentadillas', setNumber: 1 });
  });

  test('en medio del segundo ejercicio (repeatCount 3) -- serie correcta', () => {
    // 1 (Caminata) + 1 (Sentadillas serie 1) = 2 resueltas -> sigue Sentadillas serie 2
    expect(nextExercise(EXERCISES, 2)).toEqual({ exerciseName: 'Sentadillas', setNumber: 2 });
  });

  test('resolvió todo -- null', () => {
    expect(nextExercise(EXERCISES, totalSetsForSession(EXERCISES))).toBeNull();
  });

  test('lista vacía -- null', () => {
    expect(nextExercise([], 0)).toBeNull();
  });
});
