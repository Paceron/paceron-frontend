import {
  mockListSessions, mockGetSession, mockCreateSession, mockUpdateSession, mockDeleteSession, mockCloneSession, __resetMockSessions,
} from '../services/__mocks__/sessions-mock.js';

beforeEach(() => {
  __resetMockSessions();
});

describe('sessions-mock', () => {
  test('mockListSessions devuelve el catálogo sembrado, filtrable por owner_id', async () => {
    const all = await mockListSessions();
    expect(all.length).toBeGreaterThan(0);
    const forOwner1 = await mockListSessions({ ownerId: 1 });
    expect(forOwner1.every((s) => s.owner_id === 1)).toBe(true);
    expect(await mockListSessions({ ownerId: 999 })).toEqual([]);
  });

  test('mockGetSession devuelve la sesión por id, tira 404-like para una desconocida', async () => {
    const session = await mockGetSession(1);
    expect(session.id).toBe(1);
    await expect(mockGetSession(9999)).rejects.toThrow('Sesión no encontrada.');
  });

  test('mockCreateSession agrega una sesión nueva con su lista de ejercicios, con defaults de repeat/rest por ejercicio', async () => {
    const before = await mockListSessions();
    const created = await mockCreateSession({
      owner_id: 7, name: 'Trote regenerativo', description: null,
      exercises: [
        { exercise_id: 1, role: 'warmup' },
        { exercise_id: 2, role: 'main' },
        { exercise_id: 2, role: 'main' },
        { exercise_id: 3, role: 'cooldown' },
      ],
    });
    const after = await mockListSessions();
    expect(after.length).toBe(before.length + 1);
    expect(created.name).toBe('Trote regenerativo');
    expect(created.exercises).toHaveLength(4);
    expect(created.exercises.filter((e) => e.role === 'main')).toHaveLength(2);
    expect(created.exercises[0].repeat_count).toBe(1);
    expect(created.exercises[0].rest_minutes).toBe(0);
  });

  test('mockUpdateSession mergea los campos dados', async () => {
    const updated = await mockUpdateSession(1, { name: 'Nombre nuevo' });
    expect(updated.name).toBe('Nombre nuevo');
    expect((await mockGetSession(1)).name).toBe('Nombre nuevo');
  });

  test('mockDeleteSession saca la sesión de la lista', async () => {
    await mockDeleteSession(1);
    await expect(mockGetSession(1)).rejects.toThrow();
  });

  test('mockCloneSession clona con id nuevo, nombre con sufijo "(copia)" y copia profunda de exercises', async () => {
    const original = await mockGetSession(1);
    const clone = await mockCloneSession(1);
    expect(clone.id).not.toBe(original.id);
    expect(clone.name).toBe(`${original.name} (copia)`);
    expect(clone.exercises).toEqual(original.exercises);

    // Deep copy real — mutar el clon no toca el original.
    clone.exercises[0].role = 'cooldown';
    const originalAfter = await mockGetSession(1);
    expect(originalAfter.exercises[0].role).not.toBe('cooldown');
  });

  test('mockCloneSession tira 404-like si el id no existe', async () => {
    await expect(mockCloneSession(9999)).rejects.toThrow();
  });
});
