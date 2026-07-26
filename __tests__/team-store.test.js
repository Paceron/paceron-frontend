import { useTeamStore, getTeamMemberLimit, TEAM_MEMBER_LIMITS, DEFAULT_GROUP_NAME } from '../store/team-store.js';

describe('getTeamMemberLimit', () => {
  test('resolves the limit for each known tier', () => {
    expect(getTeamMemberLimit('base')).toBe(TEAM_MEMBER_LIMITS.base);
    expect(getTeamMemberLimit('pro')).toBe(TEAM_MEMBER_LIMITS.pro);
    expect(getTeamMemberLimit('premium')).toBe(TEAM_MEMBER_LIMITS.premium);
  });

  test('falls back to base for an unknown or missing tier', () => {
    expect(getTeamMemberLimit('unknown')).toBe(TEAM_MEMBER_LIMITS.base);
    expect(getTeamMemberLimit(undefined)).toBe(TEAM_MEMBER_LIMITS.base);
  });
});

describe('team store', () => {
  const initialTeams = useTeamStore.getState().teams;

  beforeEach(() => {
    useTeamStore.setState({ teams: initialTeams, selectedTeamId: null });
  });

  test('createTeam appends the new team and selects it', () => {
    const team = useTeamStore.getState().createTeam({
      name: 'Fondistas del Oeste',
      maxMembers: 10,
      description: 'Grupo de entrenamiento',
      requirements: 'Nivel intermedio',
      level: 'amateur',
      groups: [{ id: 'group-draft-1', name: 'Avanzados', trainingPlanId: 'plan-21k' }],
      invitedEmails: [{ email: 'a@b.com', groupId: 'group-draft-1' }],
    });

    const s = useTeamStore.getState();
    expect(s.teams).toContainEqual(team);
    expect(s.teams.length).toBe(initialTeams.length + 1);
    expect(s.selectedTeamId).toBe(team.id);
    expect(team.name).toBe('Fondistas del Oeste');
    expect(team.invitedEmails).toEqual([{ email: 'a@b.com', groupId: 'group-draft-1' }]);
  });

  test('createTeam always adds a default "Sin grupo" group besides the drafted ones', () => {
    const team = useTeamStore.getState().createTeam({
      name: 'Con grupos',
      maxMembers: 10,
      groups: [{ id: 'group-draft-1', name: 'Avanzados', trainingPlanId: null }],
    });

    const defaultGroup = team.groups.find((g) => g.isDefault);
    expect(team.groups).toHaveLength(2);
    expect(defaultGroup.name).toBe(DEFAULT_GROUP_NAME);
    expect(team.groups.some((g) => g.name === 'Avanzados')).toBe(true);
  });

  test('createTeam resolves invites without a chosen group to the default group', () => {
    const team = useTeamStore.getState().createTeam({
      name: 'Sin grupos propios',
      maxMembers: 10,
      invitedEmails: [{ email: 'sin-grupo@b.com', groupId: '' }],
    });

    const defaultGroup = team.groups.find((g) => g.isDefault);
    expect(team.invitedEmails).toEqual([{ email: 'sin-grupo@b.com', groupId: defaultGroup.id }]);
  });

  test('createTeam defaults photoUri to null and invitedEmails to an empty array', () => {
    const team = useTeamStore.getState().createTeam({ name: 'Sin datos opcionales', maxMembers: 10 });
    expect(team.photoUri).toBeNull();
    expect(team.invitedEmails).toEqual([]);
    expect(team.groups).toHaveLength(1);
    expect(team.groups[0].isDefault).toBe(true);
  });
});
