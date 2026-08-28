import {
  mockListSessions, mockGetSession, mockCreateSession, mockUpdateSession, mockDeleteSession, __resetMockSessions,
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

  test('mockCreateSession agrega una sesión nueva referenciando ejercicios por id, con defaults de repeat/rest', async () => {
    const before = await mockListSessions();
    const created = await mockCreateSession({
      owner_id: 7, name: 'Trote regenerativo', description: null,
      warmup_exercise_id: 1, main_exercise_id: 2, cooldown_exercise_id: 3,
    });
    const after = await mockListSessions();
    expect(after.length).toBe(before.length + 1);
    expect(created.name).toBe('Trote regenerativo');
    expect(created.main_repeat_count).toBe(1);
    expect(created.main_rest_minutes).toBe(0);
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
});
