import { useTeamStore, getTeamMemberLimit, TEAM_MEMBER_LIMITS, DEFAULT_GROUP_NAME, selectAdministeredTeams } from '../store/team-store.js';

jest.mock('../services/teams.js', () => ({
  createTeam: jest.fn(),
  getTeam: jest.fn(),
  listTeams: jest.fn(),
  updateTeam: jest.fn(),
  updateTeamAddress: jest.fn(),
  deleteTeam: jest.fn(),
}));

import {
  createTeam as createTeamService,
  getTeam as getTeamService,
  listTeams as listTeamsService,
  updateTeam as updateTeamService,
  updateTeamAddress as updateTeamAddressService,
  deleteTeam as deleteTeamService,
} from '../services/teams.js';

const TEAM_DTO = {
  id: 1, name: 'Fondistas del Oeste', description: 'Grupo de entrenamiento', level: 'amateur',
  max_members: 10, owner_id: 7, requirements: 'Nivel intermedio', status: 'activo',
  country: null, province: null, city: null, street: null, number: null,
  created_at: '2026-01-01T00:00:00.000Z', updated_at: '2026-01-01T00:00:00.000Z',
};

beforeEach(() => {
  jest.clearAllMocks();
  useTeamStore.setState({ teams: [], selectedTeamId: null });
});

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
  test('createTeam calls the service, decorates the response, appends and selects it', async () => {
    createTeamService.mockResolvedValue(TEAM_DTO);
    const result = await useTeamStore.getState().createTeam({
      name: 'Fondistas del Oeste', maxMembers: 10, description: 'Grupo de entrenamiento',
      requirements: 'Nivel intermedio', level: 'amateur', ownerId: 7,
      groups: [{ id: 'group-draft-1', name: 'Avanzados', trainingPlanId: 'plan-21k' }],
      invitedEmails: [{ email: 'a@b.com', groupId: 'group-draft-1' }],
    });

    expect(createTeamService).toHaveBeenCalledWith(expect.objectContaining({ name: 'Fondistas del Oeste', max_members: 10, owner_id: 7 }));
    expect(result.success).toBe(true);
    expect(result.team.id).toBe('1');
    const s = useTeamStore.getState();
    expect(s.teams).toContainEqual(result.team);
    expect(s.selectedTeamId).toBe('1');
    expect(result.team.invitedEmails).toEqual([{
      email: 'a@b.com', groupId: 'group-draft-1', invitedAt: expect.any(String), registered: expect.any(Boolean),
    }]);
  });

  test('createTeam always adds a default "Sin grupo" group besides the drafted ones', async () => {
    createTeamService.mockResolvedValue(TEAM_DTO);
    const result = await useTeamStore.getState().createTeam({
      name: 'Con grupos', maxMembers: 10, ownerId: 7,
      groups: [{ id: 'group-draft-1', name: 'Avanzados', trainingPlanId: null }],
    });
    const defaultGroup = result.team.groups.find((g) => g.isDefault);
    expect(result.team.groups).toHaveLength(2);
    expect(defaultGroup.name).toBe(DEFAULT_GROUP_NAME);
    expect(result.team.groups.some((g) => g.name === 'Avanzados')).toBe(true);
  });

  test('createTeam resolves invites without a chosen group to the default group', async () => {
    createTeamService.mockResolvedValue(TEAM_DTO);
    const result = await useTeamStore.getState().createTeam({
      name: 'Sin grupos propios', maxMembers: 10, ownerId: 7,
      invitedEmails: [{ email: 'sin-grupo@b.com', groupId: '' }],
    });
    const defaultGroup = result.team.groups.find((g) => g.isDefault);
    expect(result.team.invitedEmails).toEqual([{
      email: 'sin-grupo@b.com', groupId: defaultGroup.id, invitedAt: expect.any(String), registered: expect.any(Boolean),
    }]);
  });

  test('createTeam defaults photoUri to null and invitedEmails to an empty array', async () => {
    createTeamService.mockResolvedValue(TEAM_DTO);
    const result = await useTeamStore.getState().createTeam({ name: 'Sin datos opcionales', maxMembers: 10, ownerId: 7 });
    expect(result.team.photoUri).toBeNull();
    expect(result.team.invitedEmails).toEqual([]);
    expect(result.team.groups).toHaveLength(1);
    expect(result.team.groups[0].isDefault).toBe(true);
  });

  test('createTeam defaults showGroupsToRunners to false — not exposed in the creation wizard', async () => {
    createTeamService.mockResolvedValue(TEAM_DTO);
    const result = await useTeamStore.getState().createTeam({ name: 'Sin config de privacidad', maxMembers: 10, ownerId: 7 });
    expect(result.team.showGroupsToRunners).toBe(false);
  });

  test('createTeam chains updateTeamAddress when the payload has location fields, and merges the address into the team', async () => {
    createTeamService.mockResolvedValue(TEAM_DTO);
    updateTeamAddressService.mockResolvedValue({});
    const result = await useTeamStore.getState().createTeam({
      name: 'Con ubicación', maxMembers: 10, ownerId: 7, country: 'ARG', province: 'MZ', city: 'Mendoza Capital',
    });
    expect(updateTeamAddressService).toHaveBeenCalledWith('1', { country: 'ARG', province: 'MZ', city: 'Mendoza Capital' });
    expect(result.success).toBe(true);
    expect(result.addressWarning).toBeUndefined();
    expect(result.team.country).toBe('ARG');
    expect(result.team.province).toBe('MZ');
    expect(result.team.city).toBe('Mendoza Capital');
  });

  test('createTeam does not call updateTeamAddress when no location field was filled', async () => {
    createTeamService.mockResolvedValue(TEAM_DTO);
    const result = await useTeamStore.getState().createTeam({ name: 'Sin ubicación', maxMembers: 10, ownerId: 7 });
    expect(updateTeamAddressService).not.toHaveBeenCalled();
    expect(result.team.country).toBeNull();
  });

  test('createTeam succeeds with a soft addressWarning when the address call fails — the team already exists', async () => {
    createTeamService.mockResolvedValue(TEAM_DTO);
    updateTeamAddressService.mockRejectedValue(new Error('falló'));
    const result = await useTeamStore.getState().createTeam({
      name: 'Con dirección fallida', maxMembers: 10, ownerId: 7, country: 'ARG', province: 'MZ', city: 'Mendoza Capital',
    });
    expect(result.success).toBe(true);
    expect(result.addressWarning).toBe(true);
    expect(useTeamStore.getState().teams).toContainEqual(result.team);
  });

  test('createTeam returns a failure result when the service call rejects', async () => {
    createTeamService.mockRejectedValue(new Error('Equipo inválido.'));
    const result = await useTeamStore.getState().createTeam({ name: 'X', maxMembers: 10, ownerId: 7 });
    expect(result).toEqual({ success: false, error: 'Equipo inválido.' });
    expect(useTeamStore.getState().teams).toEqual([]);
  });

  test('createTeam defaults to status activo and generates a mock roster referencing real groups', async () => {
    createTeamService.mockResolvedValue(TEAM_DTO);
    const result = await useTeamStore.getState().createTeam({ name: 'Con roster', maxMembers: 10, ownerId: 7 });
    expect(result.team.status).toBe('activo');
    expect(result.team.members.length).toBeGreaterThan(0);
    const groupIds = result.team.groups.map((g) => g.id);
    result.team.members.forEach((member) => {
      expect(groupIds).toContain(member.groupId);
      expect(member.name).toEqual(expect.any(String));
      expect(member.email).toMatch(/^[a-z]+\.[a-z]+@mail\.com$/);
      expect(member.subscriptionStatus).toEqual(expect.any(String));
      expect(new Date(member.joinedAt).toString()).not.toBe('Invalid Date');
      expect(new Date(member.joinedAt).getTime()).toBeLessThan(Date.now());
    });
  });

  test('fetchTeams lists teams from the service and decorates each one', async () => {
    listTeamsService.mockResolvedValue([TEAM_DTO, { ...TEAM_DTO, id: 2, name: 'Otro equipo', owner_id: 9 }]);
    const result = await useTeamStore.getState().fetchTeams();
    expect(result).toEqual({ success: true });
    const s = useTeamStore.getState();
    expect(s.teams).toHaveLength(2);
    expect(s.teams[0].groups.some((g) => g.isDefault)).toBe(true);
    expect(s.teams[0].members.length).toBeGreaterThan(0);
  });

  test('fetchTeams preserves local-only fields (groups) for a team already known in this session', async () => {
    createTeamService.mockResolvedValue(TEAM_DTO);
    const created = await useTeamStore.getState().createTeam({
      name: 'Con grupo propio', maxMembers: 10, ownerId: 7,
      groups: [{ id: 'group-draft-1', name: 'Avanzados', trainingPlanId: null }],
    });
    listTeamsService.mockResolvedValue([TEAM_DTO]);
    await useTeamStore.getState().fetchTeams();
    const refetched = useTeamStore.getState().teams.find((t) => t.id === created.team.id);
    expect(refetched.groups.some((g) => g.name === 'Avanzados')).toBe(true);
  });

  test('fetchTeams returns a failure result when the service call rejects', async () => {
    listTeamsService.mockRejectedValue(new Error('Sin conexión.'));
    const result = await useTeamStore.getState().fetchTeams();
    expect(result).toEqual({ success: false, error: 'Sin conexión.' });
  });

  test('fetchTeam adds a team not yet in the store (deep-link) and decorates it', async () => {
    getTeamService.mockResolvedValue(TEAM_DTO);
    const result = await useTeamStore.getState().fetchTeam('1');
    expect(result).toEqual({ success: true });
    const team = useTeamStore.getState().teams.find((t) => t.id === '1');
    expect(team.groups.some((g) => g.isDefault)).toBe(true);
    expect(team.members.length).toBeGreaterThan(0);
  });

  test('fetchTeam returns a failure result when the service call rejects', async () => {
    getTeamService.mockRejectedValue(new Error('Equipo no encontrado.'));
    const result = await useTeamStore.getState().fetchTeam('999');
    expect(result).toEqual({ success: false, error: 'Equipo no encontrado.' });
  });

  test('updateTeam merges the updated fields, calls the service and keeps local-only fields', async () => {
    createTeamService.mockResolvedValue(TEAM_DTO);
    const created = await useTeamStore.getState().createTeam({ name: 'Original', maxMembers: 10, ownerId: 7 });
    updateTeamService.mockResolvedValue({ ...TEAM_DTO, name: 'Nuevo nombre', description: 'Nueva descripción' });

    const result = await useTeamStore.getState().updateTeam(created.team.id, {
      name: 'Nuevo nombre', description: 'Nueva descripción', showGroupsToRunners: true,
    });

    expect(updateTeamService).toHaveBeenCalledWith(created.team.id, expect.objectContaining({ name: 'Nuevo nombre', description: 'Nueva descripción' }));
    expect(result.success).toBe(true);
    expect(result.team.name).toBe('Nuevo nombre');
    expect(result.team.showGroupsToRunners).toBe(true);
    expect(result.team.groups).toEqual(created.team.groups);
  });

  test('updateTeam chains updateTeamAddress and does not persist address fields locally when it fails', async () => {
    createTeamService.mockResolvedValue(TEAM_DTO);
    const created = await useTeamStore.getState().createTeam({ name: 'Original', maxMembers: 10, ownerId: 7 });
    updateTeamService.mockResolvedValue(TEAM_DTO);
    updateTeamAddressService.mockRejectedValue(new Error('falló'));

    const result = await useTeamStore.getState().updateTeam(created.team.id, {
      name: 'Original', country: 'ARG', province: 'MZ', city: 'Mendoza Capital',
    });
    expect(result.success).toBe(true);
    expect(result.addressWarning).toBe(true);
    expect(result.team.country).toBeNull();
  });

  test('updateTeam does not overwrite an already-saved address when a later address update fails', async () => {
    createTeamService.mockResolvedValue(TEAM_DTO);
    const created = await useTeamStore.getState().createTeam({ name: 'Original', maxMembers: 10, ownerId: 7 });

    updateTeamService.mockResolvedValue(TEAM_DTO);
    updateTeamAddressService.mockResolvedValue({});
    const firstUpdate = await useTeamStore.getState().updateTeam(created.team.id, {
      name: 'Original', country: 'ARG', province: 'MZ', city: 'Mendoza Capital',
    });
    expect(firstUpdate.team.country).toBe('ARG');

    updateTeamAddressService.mockRejectedValue(new Error('falló'));
    const secondUpdate = await useTeamStore.getState().updateTeam(created.team.id, {
      name: 'Original', country: 'ARG', province: 'CD', city: 'Córdoba Capital',
    });
    expect(secondUpdate.success).toBe(true);
    expect(secondUpdate.addressWarning).toBe(true);
    expect(secondUpdate.team.country).toBe('ARG');
    expect(secondUpdate.team.province).toBe('MZ');
    expect(secondUpdate.team.city).toBe('Mendoza Capital');
  });

  test('updateTeam returns a failure result for an unknown team', async () => {
    const result = await useTeamStore.getState().updateTeam('does-not-exist', { name: 'X' });
    expect(result).toEqual({ success: false, error: 'Equipo no encontrado.' });
    expect(updateTeamService).not.toHaveBeenCalled();
  });

  test('updateGroup merges only the given fields into the matching group of the matching team', async () => {
    createTeamService.mockResolvedValue(TEAM_DTO);
    const created = await useTeamStore.getState().createTeam({
      name: 'Con grupo', maxMembers: 10, ownerId: 7,
      groups: [{ id: 'group-draft-1', name: 'Avanzados', trainingPlanId: null }],
    });
    const targetGroup = created.team.groups.find((g) => g.id === 'group-draft-1');

    useTeamStore.getState().updateGroup(created.team.id, targetGroup.id, { name: 'Grupo renombrado', trainingPlanId: 'plan-5k' });

    const updatedTeam = useTeamStore.getState().teams.find((t) => t.id === created.team.id);
    const updatedGroup = updatedTeam.groups.find((g) => g.id === targetGroup.id);
    expect(updatedGroup.name).toBe('Grupo renombrado');
    expect(updatedGroup.trainingPlanId).toBe('plan-5k');
  });

  test('addInvitedEmails appends new invites and ignores emails already invited', async () => {
    createTeamService.mockResolvedValue(TEAM_DTO);
    const created = await useTeamStore.getState().createTeam({
      name: 'Con invitación', maxMembers: 10, ownerId: 7,
      invitedEmails: [{ email: 'ya.invitada@example.com', groupId: '' }],
    });

    useTeamStore.getState().addInvitedEmails(created.team.id, [
      { email: 'corredora.nueva@example.com', groupId: '' },
      { email: 'YA.INVITADA@example.com', groupId: '' },
    ]);

    const updated = useTeamStore.getState().teams.find((t) => t.id === created.team.id);
    expect(updated.invitedEmails).toHaveLength(2);
    expect(updated.invitedEmails.some((inv) => inv.email === 'corredora.nueva@example.com')).toBe(true);
  });

  test('deleteTeam calls the service and removes the team from the store', async () => {
    createTeamService.mockResolvedValue(TEAM_DTO);
    const created = await useTeamStore.getState().createTeam({ name: 'A borrar', maxMembers: 10, ownerId: 7 });
    deleteTeamService.mockResolvedValue(null);

    const result = await useTeamStore.getState().deleteTeam(created.team.id, 7);

    expect(deleteTeamService).toHaveBeenCalledWith(created.team.id, 7);
    expect(result).toEqual({ success: true });
    expect(useTeamStore.getState().teams.find((t) => t.id === created.team.id)).toBeUndefined();
  });

  test('deleteTeam clears selectedTeamId when the deleted team was selected', async () => {
    createTeamService.mockResolvedValue(TEAM_DTO);
    const created = await useTeamStore.getState().createTeam({ name: 'A borrar', maxMembers: 10, ownerId: 7 });
    expect(useTeamStore.getState().selectedTeamId).toBe(created.team.id);
    deleteTeamService.mockResolvedValue(null);

    await useTeamStore.getState().deleteTeam(created.team.id, 7);

    expect(useTeamStore.getState().selectedTeamId).toBeNull();
  });

  test('deleteTeam returns a failure result when the service call rejects, without removing the team', async () => {
    createTeamService.mockResolvedValue(TEAM_DTO);
    const created = await useTeamStore.getState().createTeam({ name: 'No se borra', maxMembers: 10, ownerId: 7 });
    deleteTeamService.mockRejectedValue(new Error('No autorizado.'));

    const result = await useTeamStore.getState().deleteTeam(created.team.id, 7);

    expect(result).toEqual({ success: false, error: 'No autorizado.' });
    expect(useTeamStore.getState().teams.find((t) => t.id === created.team.id)).toBeDefined();
  });
});

describe('selectAdministeredTeams', () => {
  test('filters teams by ownerId and returns an empty array without a userId', () => {
    const teams = [{ id: '1', ownerId: 7 }, { id: '2', ownerId: 9 }];
    expect(selectAdministeredTeams(teams, 7)).toEqual([{ id: '1', ownerId: 7 }]);
    expect(selectAdministeredTeams(teams, null)).toEqual([]);
  });
});
