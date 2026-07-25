import { useTeamStore, getTeamMemberLimit, TEAM_MEMBER_LIMITS } from '../store/team-store.js';

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
      invitedEmails: ['a@b.com'],
    });

    const s = useTeamStore.getState();
    expect(s.teams).toContainEqual(team);
    expect(s.teams.length).toBe(initialTeams.length + 1);
    expect(s.selectedTeamId).toBe(team.id);
    expect(team.name).toBe('Fondistas del Oeste');
    expect(team.invitedEmails).toEqual(['a@b.com']);
  });

  test('createTeam defaults photoUri to null and invitedEmails to an empty array', () => {
    const team = useTeamStore.getState().createTeam({ name: 'Sin datos opcionales', maxMembers: 10 });
    expect(team.photoUri).toBeNull();
    expect(team.invitedEmails).toEqual([]);
  });
});
