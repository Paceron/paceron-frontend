import { useTrainingPlanStore, getPlanStatus, buildEmptyPlanDays, dayLabel, PLAN_DURATION_OPTIONS } from '../store/training-plan-store.js';
import { useTeamStore } from '../store/team-store.js';

jest.mock('../services/trainingPlans.js', () => ({
  listTrainingPlans: jest.fn(),
  getTrainingPlan: jest.fn(),
  createTrainingPlan: jest.fn(),
  updateTrainingPlan: jest.fn(),
  deleteTrainingPlan: jest.fn(),
  cloneTrainingPlan: jest.fn(),
  listRunnerPlanAssignments: jest.fn(),
  assignPlanToRunner: jest.fn(),
  unassignPlanFromRunner: jest.fn(),
}));

import {
  listTrainingPlans as listTrainingPlansService,
  getTrainingPlan as getTrainingPlanService,
  createTrainingPlan as createTrainingPlanService,
  updateTrainingPlan as updateTrainingPlanService,
  deleteTrainingPlan as deleteTrainingPlanService,
  cloneTrainingPlan as cloneTrainingPlanService,
  listRunnerPlanAssignments as listRunnerPlanAssignmentsService,
  assignPlanToRunner as assignPlanToRunnerService,
} from '../services/trainingPlans.js';

jest.mock('../services/teams.js', () => ({
  createTeam: jest.fn(),
  getTeam: jest.fn(),
  listTeams: jest.fn(),
  updateTeam: jest.fn(),
  updateTeamAddress: jest.fn(),
  deleteTeam: jest.fn(),
}));

jest.mock('../services/groups.js', () => ({
  listGroups: jest.fn(),
  createGroup: jest.fn(),
  updateGroup: jest.fn(),
  deleteGroup: jest.fn(),
  getGroupUsers: jest.fn(),
  addGroupUser: jest.fn(),
  removeGroupUser: jest.fn(),
}));

jest.mock('../services/invitations.js', () => ({
  inviteToTeam: jest.fn(),
  listTeamInvitations: jest.fn(),
  listMyInvitations: jest.fn(),
  acceptInvitation: jest.fn(),
  rejectInvitation: jest.fn(),
}));

import { listTeams as listTeamsService } from '../services/teams.js';
import { listGroups as listGroupsService, getGroupUsers as getGroupUsersService } from '../services/groups.js';

const PLAN_DTO = {
  id: 1, owner_id: 7, name: 'Base 5K', description: 'desc', duration_days: 7,
  days: [
    { sequence_no: 1, day_of_week: 'monday', kind: 'training', other_name: null, session_id: 9 },
    { sequence_no: 2, day_of_week: 'tuesday', kind: 'rest', other_name: null, session_id: null },
    { sequence_no: 3, day_of_week: 'wednesday', kind: 'rest', other_name: null, session_id: null },
    { sequence_no: 4, day_of_week: 'thursday', kind: 'rest', other_name: null, session_id: null },
    { sequence_no: 5, day_of_week: 'friday', kind: 'rest', other_name: null, session_id: null },
    { sequence_no: 6, day_of_week: 'saturday', kind: 'rest', other_name: null, session_id: null },
    { sequence_no: 7, day_of_week: 'sunday', kind: 'rest', other_name: null, session_id: null },
  ],
  created_at: '2026-01-01T00:00:00.000Z', updated_at: '2026-01-01T00:00:00.000Z',
};

beforeEach(() => {
  jest.clearAllMocks();
  useTrainingPlanStore.setState({ plans: [], myPlans: [] });
  useTeamStore.setState({ teams: [], myMemberTeams: [], selectedTeamId: null, myInvitations: [] });
  listGroupsService.mockResolvedValue([]);
});

describe('getPlanStatus', () => {
  test('activo cuando todavía no pasó la caducidad', () => {
    const plan = { createdAt: new Date().toISOString(), durationDays: 7 };
    expect(getPlanStatus(plan)).toBe('activo');
  });

  test('vencido cuando ya pasó la caducidad', () => {
    const plan = { createdAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(), durationDays: 7 };
    expect(getPlanStatus(plan)).toBe('vencido');
  });
});

describe('buildEmptyPlanDays', () => {
  test('arma los 7 días en orden lunes a domingo, todos rest', () => {
    const days = buildEmptyPlanDays();
    expect(days).toHaveLength(7);
    expect(days.map((d) => d.dayOfWeek)).toEqual(['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']);
    expect(days.every((d) => d.kind === 'rest')).toBe(true);
    expect(days.map((d) => d.sequenceNo)).toEqual([1, 2, 3, 4, 5, 6, 7]);
  });
});

describe('dayLabel / PLAN_DURATION_OPTIONS', () => {
  test('traduce el día de la semana al español', () => {
    expect(dayLabel('monday')).toBe('Lunes');
    expect(dayLabel('sunday')).toBe('Domingo');
  });

  test('soporta exactamente 7 y 14 días', () => {
    expect(PLAN_DURATION_OPTIONS).toEqual([7, 14]);
  });
});

describe('training plan store', () => {
  test('fetchPlans trae y normaliza los planes del entrenador', async () => {
    listTrainingPlansService.mockResolvedValue([PLAN_DTO]);
    const result = await useTrainingPlanStore.getState().fetchPlans(7);
    expect(listTrainingPlansService).toHaveBeenCalledWith({ ownerId: 7 });
    expect(result.success).toBe(true);
    const { plans } = useTrainingPlanStore.getState();
    expect(plans).toHaveLength(1);
    expect(plans[0].id).toBe('1');
    expect(plans[0].days).toHaveLength(7);
    expect(plans[0].days[0].sessionId).toBe('9');
  });

  test('createPlan agrega el plan creado a la lista', async () => {
    createTrainingPlanService.mockResolvedValue(PLAN_DTO);
    const result = await useTrainingPlanStore.getState().createPlan({
      ownerId: 7, name: 'Base 5K', description: 'desc', durationDays: 7, days: [],
    });
    expect(result.success).toBe(true);
    expect(useTrainingPlanStore.getState().plans).toContainEqual(result.plan);
  });

  test('updatePlan reemplaza el plan en la lista', async () => {
    useTrainingPlanStore.setState({ plans: [{ id: '1', name: 'Viejo' }] });
    updateTrainingPlanService.mockResolvedValue({ ...PLAN_DTO, name: 'Nuevo nombre' });
    const result = await useTrainingPlanStore.getState().updatePlan('1', { name: 'Nuevo nombre' });
    expect(result.success).toBe(true);
    expect(useTrainingPlanStore.getState().plans[0].name).toBe('Nuevo nombre');
  });

  test('clonePlan agrega el clon a la lista', async () => {
    cloneTrainingPlanService.mockResolvedValue({ ...PLAN_DTO, id: 2, name: 'Base 5K (copia)' });
    const result = await useTrainingPlanStore.getState().clonePlan('1');
    expect(result.success).toBe(true);
    expect(result.plan.name).toBe('Base 5K (copia)');
    expect(useTrainingPlanStore.getState().plans.map((p) => p.id)).toContain('2');
  });

  test('deletePlan saca el plan de plans/myPlans y limpia trainingPlanId de cualquier grupo que lo tuviera', async () => {
    useTrainingPlanStore.setState({ plans: [{ id: '1' }], myPlans: [{ id: '1' }] });
    useTeamStore.setState({
      teams: [{ id: 't1', groups: [{ id: 'g1', trainingPlanId: '1' }, { id: 'g2', trainingPlanId: '2' }] }],
    });
    deleteTrainingPlanService.mockResolvedValue(null);

    const result = await useTrainingPlanStore.getState().deletePlan('1');

    expect(result.success).toBe(true);
    expect(useTrainingPlanStore.getState().plans).toEqual([]);
    expect(useTrainingPlanStore.getState().myPlans).toEqual([]);
    const [team] = useTeamStore.getState().teams;
    expect(team.groups.find((g) => g.id === 'g1').trainingPlanId).toBeNull();
    expect(team.groups.find((g) => g.id === 'g2').trainingPlanId).toBe('2'); // no relacionado, no se toca
  });

  test('assignToGroup setea trainingPlanId en el grupo correcto vía team-store', () => {
    useTeamStore.setState({ teams: [{ id: 't1', groups: [{ id: 'g1', trainingPlanId: null }] }] });
    const result = useTrainingPlanStore.getState().assignToGroup('t1', 'g1', '5');
    expect(result.success).toBe(true);
    expect(useTeamStore.getState().teams[0].groups[0].trainingPlanId).toBe('5');
  });

  test('assignToRunner llama al servicio con planId y userId', async () => {
    assignPlanToRunnerService.mockResolvedValue({});
    const result = await useTrainingPlanStore.getState().assignToRunner('1', 42);
    expect(assignPlanToRunnerService).toHaveBeenCalledWith('1', 42);
    expect(result.success).toBe(true);
  });

  test('fetchMyPlans junta la asignación individual con el plan del grupo del que es miembro, sin duplicar', async () => {
    listTeamsService.mockResolvedValue([{ id: 5, name: 'Equipo', owner_id: 99, status: 'activo' }]);
    listGroupsService.mockResolvedValue([{ id: 50, team_id: 5, name: 'General', is_main: true, created_at: '', updated_at: '' }]);
    getGroupUsersService.mockResolvedValue([{ user_id: 42 }]);
    listRunnerPlanAssignmentsService.mockResolvedValue([{ id: 1, plan_id: 9, user_id: 42, assigned_at: '' }]);
    getTrainingPlanService.mockImplementation(async (planId) => ({ ...PLAN_DTO, id: Number(planId) }));

    // El grupo ya tiene un plan asignado localmente (setGroupTrainingPlan
    // — ver test de arriba) antes de que fetchMyPlans lo lea. fetchMyPlans
    // llama fetchGroups() por dentro, que preserva ese trainingPlanId ya
    // en memoria al mergear la respuesta fresca del mock (mismo criterio
    // que team-store.js#fetchGroups ya usa en el resto de la app).
    useTeamStore.setState({ teams: [{ id: '5', groups: [{ id: '50', trainingPlanId: '7' }] }], myMemberTeams: [{ id: '5' }] });

    const result = await useTrainingPlanStore.getState().fetchMyPlans(42);

    expect(result.success).toBe(true);
    const ids = useTrainingPlanStore.getState().myPlans.map((p) => p.id).sort();
    expect(ids).toEqual(['7', '9']);
  });
});
