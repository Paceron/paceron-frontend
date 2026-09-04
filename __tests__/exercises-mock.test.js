import {
  mockListExercises, mockGetExercise, mockCreateExercise, mockUpdateExercise, mockDeleteExercise, __resetMockExercises,
} from '../services/__mocks__/exercises-mock.js';

beforeEach(() => {
  __resetMockExercises();
});

describe('exercises-mock', () => {
  test('mockListExercises devuelve el catálogo sembrado, filtrable por owner_id', async () => {
    const all = await mockListExercises();
    expect(all.length).toBeGreaterThan(0);
    const forOwner1 = await mockListExercises({ ownerId: 1 });
    expect(forOwner1.every((e) => e.owner_id === 1)).toBe(true);
    expect(await mockListExercises({ ownerId: 999 })).toEqual([]);
  });

  test('mockGetExercise devuelve el ejercicio por id, tira 404-like para uno desconocido', async () => {
    const exercise = await mockGetExercise(1);
    expect(exercise.id).toBe(1);
    await expect(mockGetExercise(9999)).rejects.toThrow('Ejercicio no encontrado.');
  });

  test('mockCreateExercise agrega un ejercicio nuevo con id incremental', async () => {
    const before = await mockListExercises();
    const created = await mockCreateExercise({ owner_id: 7, name: 'Series 800m', kind: 'running', distance_m: 800, speed_kph: 12 });
    const after = await mockListExercises();
    expect(after.length).toBe(before.length + 1);
    expect(created.name).toBe('Series 800m');
    expect(created.kind).toBe('running');
    expect(created.video_url).toBeNull();
  });

  test('mockCreateExercise persiste muscle_group para un ejercicio de elongación', async () => {
    const created = await mockCreateExercise({ owner_id: 7, name: 'Elongación de aductores', kind: 'elongation', muscle_group: 'aductores' });
    expect(created.muscle_group).toBe('aductores');
    expect((await mockGetExercise(created.id)).muscle_group).toBe('aductores');
  });

  test('mockUpdateExercise mergea los campos dados', async () => {
    const updated = await mockUpdateExercise(1, { name: 'Nombre nuevo' });
    expect(updated.name).toBe('Nombre nuevo');
    expect((await mockGetExercise(1)).name).toBe('Nombre nuevo');
  });

  test('mockDeleteExercise saca el ejercicio de la lista', async () => {
    await mockDeleteExercise(1);
    await expect(mockGetExercise(1)).rejects.toThrow();
  });
});
