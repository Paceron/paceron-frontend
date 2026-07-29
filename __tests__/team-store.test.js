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
    expect(team.invitedEmails).toEqual([{
      email: 'a@b.com',
      groupId: 'group-draft-1',
      invitedAt: expect.any(String),
      registered: expect.any(Boolean),
    }]);
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
    expect(team.invitedEmails).toEqual([{
      email: 'sin-grupo@b.com',
      groupId: defaultGroup.id,
      invitedAt: expect.any(String),
      registered: expect.any(Boolean),
    }]);
  });

  test('createTeam defaults photoUri to null and invitedEmails to an empty array', () => {
    const team = useTeamStore.getState().createTeam({ name: 'Sin datos opcionales', maxMembers: 10 });
    expect(team.photoUri).toBeNull();
    expect(team.invitedEmails).toEqual([]);
    expect(team.groups).toHaveLength(1);
    expect(team.groups[0].isDefault).toBe(true);
  });

  test('createTeam defaults showGroupsToRunners to false — not exposed in the creation wizard', () => {
    const team = useTeamStore.getState().createTeam({ name: 'Sin config de privacidad', maxMembers: 10 });
    expect(team.showGroupsToRunners).toBe(false);
  });

  test('createTeam stores country/province/city, defaulting to null when not provided', () => {
    const withLocation = useTeamStore.getState().createTeam({
      name: 'Con ubicación', maxMembers: 10, country: 'ARG', province: 'MZ', city: 'Mendoza Capital',
    });
    expect(withLocation.country).toBe('ARG');
    expect(withLocation.province).toBe('MZ');
    expect(withLocation.city).toBe('Mendoza Capital');

    const withoutLocation = useTeamStore.getState().createTeam({ name: 'Sin ubicación', maxMembers: 10 });
    expect(withoutLocation.country).toBeNull();
    expect(withoutLocation.province).toBeNull();
    expect(withoutLocation.city).toBeNull();
  });

  test('createTeam defaults to status activo and generates a mock roster referencing real groups', () => {
    const team = useTeamStore.getState().createTeam({ name: 'Con roster', maxMembers: 10 });

    expect(team.status).toBe('activo');
    expect(team.members.length).toBeGreaterThan(0);
    const groupIds = team.groups.map((g) => g.id);
    team.members.forEach((member) => {
      expect(groupIds).toContain(member.groupId);
      expect(member.name).toEqual(expect.any(String));
      expect(member.email).toMatch(/^[a-z]+\.[a-z]+@mail\.com$/);
      expect(member.subscriptionStatus).toEqual(expect.any(String));
      expect(new Date(member.joinedAt).toString()).not.toBe('Invalid Date');
      expect(new Date(member.joinedAt).getTime()).toBeLessThan(Date.now());
    });
  });

  test('mock teams ship with a status, groups and a roster out of the box', () => {
    initialTeams.forEach((team) => {
      expect(team.status).toBe('activo');
      expect(team.groups.length).toBeGreaterThan(0);
      expect(team.members.length).toBeGreaterThan(0);
      const groupIds = team.groups.map((g) => g.id);
      team.members.forEach((member) => expect(groupIds).toContain(member.groupId));
    });
  });

  test('mock team-1 ships with seeded pending invitations referencing real groups', () => {
    const team1 = initialTeams.find((t) => t.id === 'team-1');
    expect(team1.invitedEmails.length).toBeGreaterThan(0);
    const groupIds = team1.groups.map((g) => g.id);
    team1.invitedEmails.forEach((invite) => {
      expect(groupIds).toContain(invite.groupId);
      expect(typeof invite.registered).toBe('boolean');
      expect(new Date(invite.invitedAt).toString()).not.toBe('Invalid Date');
    });
  });

  test('updateTeam merges only the given fields into the matching team', () => {
    const target = initialTeams[0];
    useTeamStore.getState().updateTeam(target.id, { name: 'Nuevo nombre', description: 'Nueva descripción' });

    const updated = useTeamStore.getState().teams.find((t) => t.id === target.id);
    expect(updated.name).toBe('Nuevo nombre');
    expect(updated.description).toBe('Nueva descripción');
    expect(updated.groups).toEqual(target.groups);
    expect(updated.members).toEqual(target.members);

    const others = useTeamStore.getState().teams.filter((t) => t.id !== target.id);
    expect(others).toEqual(initialTeams.filter((t) => t.id !== target.id));
  });

  test('updateGroup merges only the given fields into the matching group of the matching team', () => {
    const target = initialTeams[0];
    const targetGroup = target.groups[0];
    useTeamStore.getState().updateGroup(target.id, targetGroup.id, { name: 'Grupo renombrado', trainingPlanId: 'plan-5k' });

    const updatedTeam = useTeamStore.getState().teams.find((t) => t.id === target.id);
    const updatedGroup = updatedTeam.groups.find((g) => g.id === targetGroup.id);
    expect(updatedGroup.name).toBe('Grupo renombrado');
    expect(updatedGroup.trainingPlanId).toBe('plan-5k');

    const otherGroups = updatedTeam.groups.filter((g) => g.id !== targetGroup.id);
    expect(otherGroups).toEqual(target.groups.filter((g) => g.id !== targetGroup.id));
  });

  test('addInvitedEmails appends new invites and ignores emails already invited', () => {
    const target = initialTeams.find((t) => t.id === 'team-1');
    const before = target.invitedEmails.length;
    const alreadyInvitedEmail = target.invitedEmails[0].email.toUpperCase();

    useTeamStore.getState().addInvitedEmails(target.id, [
      { email: 'corredora.nueva@example.com', groupId: '' },
      { email: alreadyInvitedEmail, groupId: '' },
    ]);

    const updated = useTeamStore.getState().teams.find((t) => t.id === target.id);
    expect(updated.invitedEmails).toHaveLength(before + 1);
    const added = updated.invitedEmails.find((inv) => inv.email === 'corredora.nueva@example.com');
    const defaultGroup = updated.groups.find((g) => g.isDefault);
    expect(added.groupId).toBe(defaultGroup.id);
    expect(typeof added.registered).toBe('boolean');
    expect(new Date(added.invitedAt).toString()).not.toBe('Invalid Date');
  });
});
