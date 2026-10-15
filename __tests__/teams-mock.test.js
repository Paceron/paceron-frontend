import { mockCreateTeam, mockGetTeam, mockGetTeamUsers, mockListTeams, mockUpdateTeam, mockUpdateTeamAddress, mockUploadTeamIcon, mockDeleteTeamIcon, __resetMockTeams } from '../services/__mocks__/teams-mock.js';
import { mockListGroups, mockGetGroupUsers } from '../services/__mocks__/groups-mock.js';

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

  test('only teams 4 ("Runners Mendoza") and 5 ("Atletas del Río") ship with a seeded roster — 1/2/3 stay empty on purpose', async () => {
    const teams = await mockListTeams();
    for (const team of teams) {
      const users = await mockGetTeamUsers(team.id);
      if (team.id === 4 || team.id === 5) {
        expect(users.length).toBeGreaterThan(0);
      } else {
        expect(users).toEqual([]);
      }
    }
  });

  test('team 4 roster is split across "General" and "Avanzado" groups, with staggered assignment dates', async () => {
    const users = await mockGetTeamUsers(4);
    expect(users).toHaveLength(6);
    const dates = users.map((u) => new Date(u.assignment_date).getTime());
    expect(new Set(dates).size).toBe(dates.length); // todas distintas, ninguna pisa a otra

    const groups = await mockListGroups(4);
    expect(groups.map((g) => g.name).sort()).toEqual(['Avanzado', 'General']);

    const usersByGroup = await Promise.all(groups.map((g) => mockGetGroupUsers(g.id)));
    const totalGroupedUsers = usersByGroup.reduce((sum, list) => sum + list.length, 0);
    expect(totalGroupedUsers).toBe(6);
  });

  test('team 5 roster includes user_id 1 (demo@paceron.com) as corredor of a team it does not own', async () => {
    const team5 = await mockGetTeam(5);
    expect(team5.owner_id).not.toBe(1);

    const users = await mockGetTeamUsers(5);
    // user_id 1 (demo) + 3 ficticios reusados -- un corredor puede estar en
    // más de un equipo. Sin esto, demo@paceron.com (owner de 1/4) no tenía
    // ningún equipo del que fuera corredor -- useMyMemberTeams excluye los
    // equipos propios explícitamente (bug real, 2026-10-15).
    expect(users).toHaveLength(4);
    expect(users.map((u) => u.user_id)).toContain(1);

    const groups = await mockListGroups(5);
    expect(groups.map((g) => g.name)).toEqual(['General']);
    const groupUsers = await mockGetGroupUsers(groups[0].id);
    expect(groupUsers).toHaveLength(4);
  });

  describe('mockUploadTeamIcon / mockDeleteTeamIcon', () => {
    test('upload devuelve el URI recibido y lo persiste en el equipo', async () => {
      const result = await mockUploadTeamIcon(1, 'file:///tmp/icono.jpg');
      expect(result).toEqual({ icon_url: 'file:///tmp/icono.jpg' });
      const team = await mockGetTeam(1);
      expect(team.icon_url).toBe('file:///tmp/icono.jpg');
    });

    test('delete limpia icon_url del equipo', async () => {
      await mockUploadTeamIcon(1, 'file:///tmp/icono.jpg');
      await mockDeleteTeamIcon(1);
      const team = await mockGetTeam(1);
      expect(team.icon_url).toBeNull();
    });

    test('upload a un equipo inexistente tira error 404-like', async () => {
      await expect(mockUploadTeamIcon(9999, 'file:///tmp/icono.jpg')).rejects.toMatchObject({ status: 404 });
    });
  });
});
