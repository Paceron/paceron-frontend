import {
  mockActivateTrainerRole, mockDeactivateTrainerRole, mockGetPermissions, __resetMockRoles,
} from '../services/__mocks__/roles-mock.js';

beforeEach(() => {
  __resetMockRoles();
});

describe('mockActivateTrainerRole', () => {
  test('activates the role when a password is provided', async () => {
    const res = await mockActivateTrainerRole(1, { password: 'secret123' });
    expect(res).toEqual(expect.objectContaining({ user_id: 1, role_id: 2, status: 'active' }));
  });

  test('rejects when no password is provided', async () => {
    await expect(mockActivateTrainerRole(1, { password: '' }))
      .rejects.toMatchObject({ status: 400 });
  });
});

describe('mockDeactivateTrainerRole', () => {
  test('deactivates a previously activated role', async () => {
    await mockActivateTrainerRole(1, { password: 'secret123' });
    const res = await mockDeactivateTrainerRole(1);
    expect(res).toEqual(expect.objectContaining({ message: expect.any(String) }));
  });
});

describe('mockGetPermissions — el corredor demo no puede cambiar de rol', () => {
  test('el 101 (Lucía, miembro del equipo demo) es corredor y nada más', async () => {
    const res = await mockGetPermissions(101);
    expect(res.user_id).toBe(101);
    expect(res.roles.map((r) => r.name)).toEqual(['corredor']);
  });

  test('ni siquiera cuando la asignación mutable tiene los dos roles', async () => {
    await mockActivateTrainerRole(1, { password: 'secret123' });

    // La cuenta demo (id 1) lee esa asignación mutable...
    const demo = await mockGetPermissions(1);
    expect(demo.roles.map((r) => r.name)).toEqual(['corredor', 'entrenador']);

    // ...y el corredor demo no, aunque la lista tenga 'entrenador'.
    const runner = await mockGetPermissions(101);
    expect(runner.roles.map((r) => r.name)).toEqual(['corredor']);
  });
});
