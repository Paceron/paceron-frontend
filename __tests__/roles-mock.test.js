import {
  mockActivateTrainerRole, mockDeactivateTrainerRole, __resetMockRoles,
} from '../services/__mocks__/roles-mock.js';

beforeEach(() => {
  __resetMockRoles();
});

describe('mockActivateTrainerRole', () => {
  test('activates the role when a password is provided', async () => {
    const res = await mockActivateTrainerRole(1, { password: 'secret123', bankAlias: 'mi.alias' });
    expect(res).toEqual(expect.objectContaining({ user_id: 1, role_id: 2, status: 'active' }));
  });

  test('rejects when no password is provided', async () => {
    await expect(mockActivateTrainerRole(1, { password: '', bankAlias: 'mi.alias' }))
      .rejects.toMatchObject({ status: 400 });
  });
});

describe('mockDeactivateTrainerRole', () => {
  test('deactivates a previously activated role', async () => {
    await mockActivateTrainerRole(1, { password: 'secret123', bankAlias: 'mi.alias' });
    const res = await mockDeactivateTrainerRole(1);
    expect(res).toEqual(expect.objectContaining({ message: expect.any(String) }));
  });
});
