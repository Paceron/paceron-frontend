import {
  mockListGroups, mockGetGroup, mockCreateGroup, mockUpdateGroup, mockDeleteGroup, mockGetGroupUsers,
  __seedDefaultGroup, __resetMockGroups,
} from '../services/__mocks__/groups-mock.js';

beforeEach(() => {
  __resetMockGroups();
});

describe('groups-mock', () => {
  test('__seedDefaultGroup creates a group with is_main true for the given team', async () => {
    const seeded = __seedDefaultGroup('7');
    expect(seeded.is_main).toBe(true);
    expect(seeded.team_id).toBe(7);
    const groups = await mockListGroups('7', 1);
    expect(groups).toEqual([seeded]);
  });

  test('mockCreateGroup adds a non-main group scoped to the team', async () => {
    __seedDefaultGroup('7');
    const created = await mockCreateGroup({ team_id: 7, name: 'Avanzados', description: 'Ritmo alto' });
    expect(created.is_main).toBe(false);
    expect(created.name).toBe('Avanzados');
    const groups = await mockListGroups('7', 1);
    expect(groups).toHaveLength(2);
  });

  test('mockListGroups only returns groups for the requested team', async () => {
    __seedDefaultGroup('7');
    __seedDefaultGroup('8');
    const groups = await mockListGroups('7', 1);
    expect(groups.every((g) => g.team_id === 7)).toBe(true);
  });

  test('mockGetGroup returns the group by id, throws for an unknown id', async () => {
    const seeded = __seedDefaultGroup('7');
    expect(await mockGetGroup(seeded.id)).toEqual(seeded);
    await expect(mockGetGroup(999999)).rejects.toThrow();
  });

  test('mockUpdateGroup merges fields and updates updated_at', async () => {
    const seeded = __seedDefaultGroup('7');
    const updated = await mockUpdateGroup(seeded.id, { name: 'Nuevo nombre' });
    expect(updated.name).toBe('Nuevo nombre');
  });

  test('mockDeleteGroup removes the group from subsequent listings', async () => {
    const seeded = __seedDefaultGroup('7');
    await mockDeleteGroup(seeded.id);
    expect(await mockListGroups('7', 1)).toEqual([]);
  });

  test('mockGetGroupUsers returns an empty array when nobody was added', async () => {
    const seeded = __seedDefaultGroup('7');
    expect(await mockGetGroupUsers(seeded.id)).toEqual([]);
  });
});
