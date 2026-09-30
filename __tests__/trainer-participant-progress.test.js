import { countSetsForExercise, totalSetsForSession } from '../utils/trainer-participant-progress.js';

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
