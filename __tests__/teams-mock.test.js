import { mockCreateTeam, mockGetTeam, mockListTeams, mockUpdateTeam, mockUpdateTeamAddress, __resetMockTeams } from '../services/__mocks__/teams-mock.js';

beforeEach(() => {
  __resetMockTeams();
});

describe('teams mock adapter', () => {
  test('mockListTeams returns the seeded teams with the backend response shape', async () => {
    const teams = await mockListTeams();
    expect(teams.length).toBeGreaterThan(0);
    teams.forEach((team) => {
      expect(team).toEqual(expect.objectContaining({
        id: expect.any(Number), name: expect.any(String), owner_id: expect.any(Number), status: 'activo',
      }));
    });
  });

  test('mockCreateTeam appends a new team with an incrementing id', async () => {
    const before = await mockListTeams();
    const created = await mockCreateTeam({ name: 'Nuevo equipo', max_members: 10, owner_id: 1 });
    const after = await mockListTeams();
    expect(after.length).toBe(before.length + 1);
    expect(created.name).toBe('Nuevo equipo');
    expect(created.status).toBe('activo');
  });

  test('mockGetTeam returns a single team and throws a 404-like error for an unknown id', async () => {
    const team = await mockGetTeam(1);
    expect(team.id).toBe(1);
    await expect(mockGetTeam(9999)).rejects.toThrow('Equipo no encontrado.');
  });

  test('mockUpdateTeam merges the given fields', async () => {
    const updated = await mockUpdateTeam(1, { name: 'Nombre nuevo' });
    expect(updated.name).toBe('Nombre nuevo');
    expect((await mockGetTeam(1)).name).toBe('Nombre nuevo');
  });

  test('mockUpdateTeamAddress merges only the address fields', async () => {
    const updated = await mockUpdateTeamAddress(1, { country: 'ARG', province: 'MZ', city: 'Mendoza Capital' });
    expect(updated.country).toBe('ARG');
    expect(updated.province).toBe('MZ');
    expect(updated.city).toBe('Mendoza Capital');
  });
});
