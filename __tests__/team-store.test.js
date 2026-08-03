import { useTeamStore, getTeamMemberLimit, TEAM_MEMBER_LIMITS, selectAdministeredTeams } from '../store/team-store.js';

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

jest.mock('../services/groups.js', () => ({
  listGroups: jest.fn(),
  createGroup: jest.fn(),
  updateGroup: jest.fn(),
  deleteGroup: jest.fn(),
  getGroupUsers: jest.fn(),
  addGroupUser: jest.fn(),
  removeGroupUser: jest.fn(),
}));

import {
  listGroups as listGroupsService, createGroup as createGroupService,
  updateGroup as updateGroupService, deleteGroup as deleteGroupService,
  getGroupUsers as getGroupUsersService, addGroupUser as addGroupUserService,
  removeGroupUser as removeGroupUserService,
} from '../services/groups.js';

jest.mock('../services/invitations.js', () => ({
  inviteToTeam: jest.fn(),
  listTeamInvitations: jest.fn(),
  listMyInvitations: jest.fn(),
  acceptInvitation: jest.fn(),
  rejectInvitation: jest.fn(),
}));

import {
  inviteToTeam as inviteToTeamService, listTeamInvitations as listTeamInvitationsService,
  listMyInvitations as listMyInvitationsService, acceptInvitation as acceptInvitationService,
  rejectInvitation as rejectInvitationService,
} from '../services/invitations.js';

const TEAM_DTO = {
  id: 1, name: 'Fondistas del Oeste', description: 'Grupo de entrenamiento', level: 'amateur',
  max_members: 10, owner_id: 7, requirements: 'Nivel intermedio', status: 'activo',
  country: null, province: null, city: null, street: null, number: null,
  show_groups_to_runners: false,
  created_at: '2026-01-01T00:00:00.000Z', updated_at: '2026-01-01T00:00:00.000Z',
};

const DEFAULT_GROUP_DTO = { id: 100, team_id: 1, name: 'General', description: null, is_main: true, created_at: '2026-01-01T00:00:00.000Z', updated_at: '2026-01-01T00:00:00.000Z' };

beforeEach(() => {
  jest.clearAllMocks();
  useTeamStore.setState({ teams: [], selectedTeamId: null });
  // Default para tests que llaman createTeam solo como setup (updateGroup,
  // deleteTeam, etc.) y no les importa el detalle del GET /groups final —
  // los tests que sí lo verifican explícitamente sobreescriben este mock
  // con su propio escenario.
  listGroupsService.mockResolvedValue([DEFAULT_GROUP_DTO]);
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
    listGroupsService.mockResolvedValue([DEFAULT_GROUP_DTO]);
    const result = await useTeamStore.getState().createTeam({
      name: 'Fondistas del Oeste', maxMembers: 10, description: 'Grupo de entrenamiento',
      requirements: 'Nivel intermedio', level: 'amateur', ownerId: 7,
    });

    expect(createTeamService).toHaveBeenCalledWith(expect.objectContaining({ name: 'Fondistas del Oeste', max_members: 10, owner_id: 7 }));
    expect(result.success).toBe(true);
    expect(result.team.id).toBe('1');
    const s = useTeamStore.getState();
    expect(s.teams).toContainEqual(result.team);
    expect(s.selectedTeamId).toBe('1');
  });

  test('createTeam defaults showGroupsToRunners to false — not exposed in the creation wizard', async () => {
    createTeamService.mockResolvedValue(TEAM_DTO);
    listGroupsService.mockResolvedValue([DEFAULT_GROUP_DTO]);
    const result = await useTeamStore.getState().createTeam({ name: 'Sin config de privacidad', maxMembers: 10, ownerId: 7 });
    expect(result.team.showGroupsToRunners).toBe(false);
  });

  test('createTeam defaults photoUri to null and invitations to an empty array', async () => {
    createTeamService.mockResolvedValue(TEAM_DTO);
    listGroupsService.mockResolvedValue([DEFAULT_GROUP_DTO]);
    const result = await useTeamStore.getState().createTeam({ name: 'Sin datos opcionales', maxMembers: 10, ownerId: 7 });
    expect(result.team.photoUri).toBeNull();
    expect(result.team.invitations).toEqual([]);
    expect(result.team.groups).toHaveLength(1);
    expect(result.team.groups[0].isDefault).toBe(true);
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

  test('createTeam defaults to status activo and leaves members empty (roster comes from useTeamRoster, not the store)', async () => {
    createTeamService.mockResolvedValue(TEAM_DTO);
    listGroupsService.mockResolvedValue([DEFAULT_GROUP_DTO]);
    const result = await useTeamStore.getState().createTeam({ name: 'Con roster', maxMembers: 10, ownerId: 7 });
    expect(result.team.status).toBe('activo');
    expect(result.team.members).toEqual([]);
  });

  test('createTeam creates the extra draft groups against the backend', async () => {
    createTeamService.mockResolvedValue(TEAM_DTO);
    const AVANZADOS_DTO = { id: 101, team_id: 1, name: 'Avanzados', description: null, is_main: false, created_at: '2026-01-01T00:00:00.000Z', updated_at: '2026-01-01T00:00:00.000Z' };
    createGroupService.mockResolvedValue(AVANZADOS_DTO);
    listGroupsService.mockResolvedValue([DEFAULT_GROUP_DTO, AVANZADOS_DTO]);

    const result = await useTeamStore.getState().createTeam({
      name: 'Con grupo extra', maxMembers: 10, ownerId: 7,
      groups: [{ id: 'group-draft-1', name: 'Avanzados', description: null, trainingPlanId: 'plan-10k' }],
    });

    expect(createGroupService).toHaveBeenCalledWith({ team_id: 1, name: 'Avanzados' });
    expect(result.team.groups).toHaveLength(2);
    const avanzados = result.team.groups.find((g) => g.name === 'Avanzados');
    expect(avanzados.trainingPlanId).toBe('plan-10k');
  });

  test('createTeam succeeds with groupsWarning when an extra group fails to create', async () => {
    createTeamService.mockResolvedValue(TEAM_DTO);
    createGroupService.mockRejectedValue(new Error('falló'));
    listGroupsService.mockResolvedValue([DEFAULT_GROUP_DTO]);
    const result = await useTeamStore.getState().createTeam({
      name: 'Con grupo que falla', maxMembers: 10, ownerId: 7,
      groups: [{ id: 'group-draft-1', name: 'Avanzados', description: null, trainingPlanId: null }],
    });
    expect(result.success).toBe(true);
    expect(result.groupsWarning).toBe(true);
  });

  test('fetchTeams lists teams from the service and decorates each one', async () => {
    listTeamsService.mockResolvedValue([TEAM_DTO, { ...TEAM_DTO, id: 2, name: 'Otro equipo', owner_id: 9 }]);
    const result = await useTeamStore.getState().fetchTeams();
    expect(result).toEqual({ success: true });
    const s = useTeamStore.getState();
    expect(s.teams).toHaveLength(2);
    expect(s.teams[0].groups).toEqual([]);
    expect(s.teams[0].members).toEqual([]);
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
    expect(team.groups).toEqual([]);
    expect(team.members).toEqual([]);
  });

  test('fetchTeam returns a failure result when the service call rejects', async () => {
    getTeamService.mockRejectedValue(new Error('Equipo no encontrado.'));
    const result = await useTeamStore.getState().fetchTeam('999');
    expect(result).toEqual({ success: false, error: 'Equipo no encontrado.' });
  });

  test('updateTeam merges the updated fields, calls the service and keeps local-only fields', async () => {
    createTeamService.mockResolvedValue(TEAM_DTO);
    const created = await useTeamStore.getState().createTeam({ name: 'Original', maxMembers: 10, ownerId: 7 });
    updateTeamService.mockResolvedValue({ ...TEAM_DTO, name: 'Nuevo nombre', description: 'Nueva descripción', show_groups_to_runners: true });

    const result = await useTeamStore.getState().updateTeam(created.team.id, {
      name: 'Nuevo nombre', description: 'Nueva descripción', showGroupsToRunners: true,
    });

    expect(updateTeamService).toHaveBeenCalledWith(created.team.id, expect.objectContaining({ name: 'Nuevo nombre', description: 'Nueva descripción', show_groups_to_runners: true }));
    expect(result.success).toBe(true);
    expect(result.team.name).toBe('Nuevo nombre');
    expect(result.team.showGroupsToRunners).toBe(true);
    expect(result.team.groups).toEqual(created.team.groups);
  });

  test('updateTeam reads showGroupsToRunners from the backend response, not from the local echo', async () => {
    createTeamService.mockResolvedValue(TEAM_DTO);
    const created = await useTeamStore.getState().createTeam({ name: 'Original', maxMembers: 10, ownerId: 7 });
    updateTeamService.mockResolvedValue({ ...TEAM_DTO, show_groups_to_runners: false });

    const result = await useTeamStore.getState().updateTeam(created.team.id, { showGroupsToRunners: true });

    expect(result.team.showGroupsToRunners).toBe(false);
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

describe('fetchGroups', () => {
  const GROUP_DTO = { id: 1, team_id: 1, name: 'General', description: null, is_main: true, created_at: '2026-01-01T00:00:00.000Z', updated_at: '2026-01-01T00:00:00.000Z' };

  test('fetches groups for a team and decorates the team with them', async () => {
    useTeamStore.setState({ teams: [{ id: '1', name: 'X', groups: [], members: [] }] });
    listGroupsService.mockResolvedValue([GROUP_DTO]);
    const result = await useTeamStore.getState().fetchGroups('1', 7);
    expect(result).toEqual({ success: true });
    const team = useTeamStore.getState().teams.find((t) => t.id === '1');
    expect(team.groups).toEqual([{ id: '1', teamId: '1', name: 'General', description: null, isDefault: true, trainingPlanId: null, createdAt: GROUP_DTO.created_at, updatedAt: GROUP_DTO.updated_at }]);
  });

  test('preserves a locally chosen trainingPlanId for a group already known in this session', async () => {
    useTeamStore.setState({ teams: [{ id: '1', name: 'X', groups: [{ id: '1', teamId: '1', name: 'General', isDefault: true, trainingPlanId: 'plan-5k' }], members: [] }] });
    listGroupsService.mockResolvedValue([GROUP_DTO]);
    await useTeamStore.getState().fetchGroups('1', 7);
    const team = useTeamStore.getState().teams.find((t) => t.id === '1');
    expect(team.groups[0].trainingPlanId).toBe('plan-5k');
  });

  test('leaves groups empty when the team has none yet', async () => {
    useTeamStore.setState({ teams: [{ id: '1', name: 'X', groups: [], members: [] }] });
    listGroupsService.mockResolvedValue([]);
    await useTeamStore.getState().fetchGroups('1', 7);
    const team = useTeamStore.getState().teams.find((t) => t.id === '1');
    expect(team.groups).toEqual([]);
  });

  test('returns a failure result when the service call rejects', async () => {
    listGroupsService.mockRejectedValue(new Error('Sin conexión.'));
    const result = await useTeamStore.getState().fetchGroups('1', 7);
    expect(result).toEqual({ success: false, error: 'Sin conexión.' });
  });
});

describe('createGroupInTeam / updateGroupReal / deleteGroupReal', () => {
  beforeEach(() => {
    useTeamStore.setState({
      teams: [{ id: '1', name: 'X', groups: [{ id: '1', teamId: '1', name: 'General', isDefault: true, trainingPlanId: null }], members: [] }],
    });
    getGroupUsersService.mockResolvedValue([]);
    addGroupUserService.mockResolvedValue({});
    removeGroupUserService.mockResolvedValue({});
  });

  test('createGroupInTeam posts the group and appends it to team.groups', async () => {
    createGroupService.mockResolvedValue({ id: 2, team_id: 1, name: 'Avanzados', description: null, is_main: false, created_at: 'x', updated_at: 'x' });
    const result = await useTeamStore.getState().createGroupInTeam('1', { name: 'Avanzados' });
    expect(createGroupService).toHaveBeenCalledWith({ team_id: 1, name: 'Avanzados' });
    expect(result.success).toBe(true);
    expect(result.group.name).toBe('Avanzados');
    const team = useTeamStore.getState().teams.find((t) => t.id === '1');
    expect(team.groups).toHaveLength(2);
  });

  test('createGroupInTeam returns a failure result when the service call rejects', async () => {
    createGroupService.mockRejectedValue(new Error('falló'));
    const result = await useTeamStore.getState().createGroupInTeam('1', { name: 'Avanzados' });
    expect(result).toEqual({ success: false, error: 'falló' });
  });

  test('updateGroupReal updates the group in place, keeps trainingPlanId untouched', async () => {
    updateGroupService.mockResolvedValue({ id: 1, team_id: 1, name: 'Nuevo nombre', description: null, is_main: true, created_at: 'x', updated_at: 'y' });
    const result = await useTeamStore.getState().updateGroupReal('1', '1', { name: 'Nuevo nombre' });
    expect(result.success).toBe(true);
    expect(result.group.name).toBe('Nuevo nombre');
    const team = useTeamStore.getState().teams.find((t) => t.id === '1');
    expect(team.groups[0].name).toBe('Nuevo nombre');
    expect(team.groups[0].trainingPlanId).toBeNull();
  });

  test('deleteGroupReal removes the group from team.groups', async () => {
    useTeamStore.setState({
      teams: [{ id: '1', name: 'X', groups: [
        { id: '1', teamId: '1', name: 'General', isDefault: true },
        { id: '2', teamId: '1', name: 'Avanzados', isDefault: false },
      ], members: [] }],
    });
    deleteGroupService.mockResolvedValue(null);
    const result = await useTeamStore.getState().deleteGroupReal('1', '2');
    expect(result).toEqual({ success: true });
    const team = useTeamStore.getState().teams.find((t) => t.id === '1');
    expect(team.groups.map((g) => g.id)).toEqual(['1']);
  });

  test('deleteGroupReal returns a failure result when the service call rejects', async () => {
    deleteGroupService.mockRejectedValue(new Error('El grupo tiene corredores asignados.'));
    const result = await useTeamStore.getState().deleteGroupReal('1', '2');
    expect(result).toEqual({ success: false, error: 'El grupo tiene corredores asignados.' });
  });

  test('deleteGroupReal reassigns the deleted group\'s members to the default group first', async () => {
    useTeamStore.setState({
      teams: [{ id: '1', name: 'X', groups: [
        { id: '1', teamId: '1', name: 'General', isDefault: true },
        { id: '2', teamId: '1', name: 'Avanzados', isDefault: false },
      ], members: [] }],
    });
    getGroupUsersService.mockResolvedValue([{ user_id: 42 }, { user_id: 43 }]);
    deleteGroupService.mockResolvedValue(null);
    const result = await useTeamStore.getState().deleteGroupReal('1', '2');
    expect(result).toEqual({ success: true });
    expect(getGroupUsersService).toHaveBeenCalledWith('2');
    expect(removeGroupUserService).toHaveBeenCalledWith('2', 42);
    expect(addGroupUserService).toHaveBeenCalledWith('1', '1', 42);
    expect(removeGroupUserService).toHaveBeenCalledWith('2', 43);
    expect(addGroupUserService).toHaveBeenCalledWith('1', '1', 43);
  });

  test('deleteGroupReal skips reassignment when deleting the default group itself', async () => {
    deleteGroupService.mockResolvedValue(null);
    await useTeamStore.getState().deleteGroupReal('1', '1');
    expect(getGroupUsersService).not.toHaveBeenCalled();
  });
});

describe('fetchInvitations / sendInvite', () => {
  const INVITATION_DTO = { id: 1, team_id: 1, invitee_email: 'a@b.com', invitee_id: null, invitee_name: null, status: 'pending', expires_at: '2026-08-07T00:00:00.000Z', created_at: '2026-07-31T00:00:00.000Z' };

  beforeEach(() => {
    useTeamStore.setState({ teams: [{ id: '1', name: 'X', groups: [], members: [], invitations: [] }] });
  });

  test('fetchInvitations lists invitations for the team and normalizes them', async () => {
    listTeamInvitationsService.mockResolvedValue([INVITATION_DTO]);
    const result = await useTeamStore.getState().fetchInvitations('1');
    expect(result).toEqual({ success: true });
    const team = useTeamStore.getState().teams.find((t) => t.id === '1');
    expect(team.invitations).toEqual([{
      id: '1', teamId: '1', email: 'a@b.com', inviteeId: null, inviteeName: null,
      groupId: null, teamName: null,
      status: 'pending', expiresAt: '2026-08-07T00:00:00.000Z', createdAt: '2026-07-31T00:00:00.000Z',
    }]);
  });

  test('fetchInvitations returns a failure result when the service call rejects', async () => {
    listTeamInvitationsService.mockRejectedValue(new Error('Sin conexión.'));
    const result = await useTeamStore.getState().fetchInvitations('1');
    expect(result).toEqual({ success: false, error: 'Sin conexión.' });
  });

  test('sendInvite invites with the group payload and refetches the pending list', async () => {
    inviteToTeamService.mockResolvedValue({ message: 'Invitación enviada.' });
    listTeamInvitationsService.mockResolvedValue([INVITATION_DTO]);
    const result = await useTeamStore.getState().sendInvite('1', 'a@b.com', '3');
    expect(inviteToTeamService).toHaveBeenCalledWith('1', { email: 'a@b.com', group_id: 3 });
    expect(result).toEqual({ success: true });
    const team = useTeamStore.getState().teams.find((t) => t.id === '1');
    expect(team.invitations).toHaveLength(1);
  });

  test('sendInvite omits group_id when no group is chosen', async () => {
    inviteToTeamService.mockResolvedValue({ message: 'Invitación enviada.' });
    listTeamInvitationsService.mockResolvedValue([]);
    await useTeamStore.getState().sendInvite('1', 'a@b.com', '');
    expect(inviteToTeamService).toHaveBeenCalledWith('1', { email: 'a@b.com' });
  });

  test('sendInvite returns a failure result when the service call rejects', async () => {
    inviteToTeamService.mockRejectedValue(new Error('Email inválido.'));
    const result = await useTeamStore.getState().sendInvite('1', 'no-es-un-email', '');
    expect(result).toEqual({ success: false, error: 'Email inválido.' });
  });
});

describe('fetchMyInvitations / acceptMyInvitation / rejectMyInvitation', () => {
  const MY_INVITATION_DTO = {
    id: 5, team_id: 1, invitee_email: 'demo@paceron.com', invitee_id: null, invitee_name: null,
    group_id: null, team_name: 'Corredores del Sur', status: 'pending',
    expires_at: '2026-08-07T00:00:00.000Z', created_at: '2026-07-31T00:00:00.000Z',
  };

  beforeEach(() => {
    useTeamStore.setState({ myInvitations: [] });
  });

  test('fetchMyInvitations lists and normalizes the current user\'s pending invitations', async () => {
    listMyInvitationsService.mockResolvedValue([MY_INVITATION_DTO]);
    const result = await useTeamStore.getState().fetchMyInvitations(1, 'demo@paceron.com');
    expect(listMyInvitationsService).toHaveBeenCalledWith(1, 'demo@paceron.com');
    expect(result).toEqual({ success: true });
    expect(useTeamStore.getState().myInvitations).toEqual([{
      id: '5', teamId: '1', email: 'demo@paceron.com', inviteeId: null, inviteeName: null,
      groupId: null, teamName: 'Corredores del Sur', status: 'pending',
      expiresAt: '2026-08-07T00:00:00.000Z', createdAt: '2026-07-31T00:00:00.000Z',
    }]);
  });

  test('fetchMyInvitations returns a failure result when the service call rejects', async () => {
    listMyInvitationsService.mockRejectedValue(new Error('Sin conexión.'));
    const result = await useTeamStore.getState().fetchMyInvitations(1, 'demo@paceron.com');
    expect(result).toEqual({ success: false, error: 'Sin conexión.' });
  });

  test('acceptMyInvitation removes the invitation from myInvitations on success', async () => {
    useTeamStore.setState({ myInvitations: [{ id: '5', teamId: '1' }] });
    acceptInvitationService.mockResolvedValue({ message: 'Invitación aceptada.' });
    const result = await useTeamStore.getState().acceptMyInvitation('5', 1);
    expect(acceptInvitationService).toHaveBeenCalledWith('5', 1);
    expect(result).toEqual({ success: true });
    expect(useTeamStore.getState().myInvitations).toEqual([]);
  });

  test('acceptMyInvitation returns a failure result and keeps the invitation when the service call rejects', async () => {
    useTeamStore.setState({ myInvitations: [{ id: '5', teamId: '1' }] });
    acceptInvitationService.mockRejectedValue(new Error('Invitación vencida.'));
    const result = await useTeamStore.getState().acceptMyInvitation('5', 1);
    expect(result).toEqual({ success: false, error: 'Invitación vencida.' });
    expect(useTeamStore.getState().myInvitations).toHaveLength(1);
  });

  test('rejectMyInvitation removes the invitation from myInvitations on success', async () => {
    useTeamStore.setState({ myInvitations: [{ id: '5', teamId: '1' }] });
    rejectInvitationService.mockResolvedValue({ message: 'Invitación rechazada.' });
    const result = await useTeamStore.getState().rejectMyInvitation('5', 1);
    expect(rejectInvitationService).toHaveBeenCalledWith('5', 1);
    expect(result).toEqual({ success: true });
    expect(useTeamStore.getState().myInvitations).toEqual([]);
  });
});
