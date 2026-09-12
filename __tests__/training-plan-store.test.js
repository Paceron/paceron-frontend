import { useTrainingPlanStore, buildEmptyPlanDays } from '../store/training-plan-store.js';

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
  listCurrentPlanMarks: jest.fn(),
  markPlanAsCurrent: jest.fn(),
  unmarkPlanAsCurrent: jest.fn(),
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
  listCurrentPlanMarks as listCurrentPlanMarksService,
  markPlanAsCurrent as markPlanAsCurrentService,
  unmarkPlanAsCurrent as unmarkPlanAsCurrentService,
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

import { listTeams as listTeamsService } from '../services/teams.js';
import { listGroups as listGroupsService, getGroupUsers as getGroupUsersService } from '../services/groups.js';

const PLAN_DTO = {
  id: 1, owner_id: 7, name: 'Base 5K', description: 'desc',
  days: [
    { sequence_no: 1, kind: 'training', other_name: null, session_id: 9 },
    { sequence_no: 2, kind: 'rest', other_name: null, session_id: null },
    { sequence_no: 3, kind: 'rest', other_name: null, session_id: null },
    { sequence_no: 4, kind: 'rest', other_name: null, session_id: null },
    { sequence_no: 5, kind: 'rest', other_name: null, session_id: null },
    { sequence_no: 6, kind: 'rest', other_name: null, session_id: null },
    { sequence_no: 7, kind: 'rest', other_name: null, session_id: null },
  ],
  created_at: '2026-01-01T00:00:00.000Z', updated_at: '2026-01-01T00:00:00.000Z',
};

beforeEach(() => {
  jest.clearAllMocks();
  useTrainingPlanStore.setState({ plans: [], myPlans: [], myCurrentPlanIds: [], groupTrainingPlanIds: {} });
  listTeamsService.mockResolvedValue([]);
  listGroupsService.mockResolvedValue([]);
  listCurrentPlanMarksService.mockResolvedValue([]);
});

describe('buildEmptyPlanDays', () => {
  test('arma dayCount días numerados 1..dayCount, todos rest, sin día de la semana', () => {
    const days = buildEmptyPlanDays(10);
    expect(days).toHaveLength(10);
    expect(days.map((d) => d.sequenceNo)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    expect(days.every((d) => d.kind === 'rest')).toBe(true);
    expect(days.every((d) => !('dayOfWeek' in d))).toBe(true);
  });

  test('con dayCount 2, arma exactamente 2 días', () => {
    expect(buildEmptyPlanDays(2)).toHaveLength(2);
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
      ownerId: 7, name: 'Base 5K', description: 'desc', days: [],
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
    useTrainingPlanStore.setState({
      plans: [{ id: '1' }], myPlans: [{ id: '1' }],
      groupTrainingPlanIds: { g1: '1', g2: '2' },
    });
    deleteTrainingPlanService.mockResolvedValue(null);

    const result = await useTrainingPlanStore.getState().deletePlan('1');

    expect(result.success).toBe(true);
    expect(useTrainingPlanStore.getState().plans).toEqual([]);
    expect(useTrainingPlanStore.getState().myPlans).toEqual([]);
    const { groupTrainingPlanIds } = useTrainingPlanStore.getState();
    expect(groupTrainingPlanIds.g1).toBeUndefined();
    expect(groupTrainingPlanIds.g2).toBe('2'); // no relacionado, no se toca
  });

  test('assignToGroup setea trainingPlanId en groupTrainingPlanIds', () => {
    const result = useTrainingPlanStore.getState().assignToGroup('t1', 'g1', '5');
    expect(result.success).toBe(true);
    expect(useTrainingPlanStore.getState().groupTrainingPlanIds.g1).toBe('5');
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

    // El grupo ya tiene un plan asignado localmente (assignToGroup — ver
    // test de arriba) antes de que fetchMyPlans lo lea.
    useTrainingPlanStore.setState({ groupTrainingPlanIds: { 50: '7' } });

    const result = await useTrainingPlanStore.getState().fetchMyPlans(42);

    expect(result.success).toBe(true);
    const ids = useTrainingPlanStore.getState().myPlans.map((p) => p.id).sort();
    expect(ids).toEqual(['7', '9']);
  });

  test('fetchMyPlans trae los marcados como actuales, filtrados contra los planes realmente asignados', async () => {
    listTeamsService.mockResolvedValue([]);
    listRunnerPlanAssignmentsService.mockResolvedValue([{ id: 1, plan_id: 9, user_id: 42, assigned_at: '' }]);
    getTrainingPlanService.mockImplementation(async (planId) => ({ ...PLAN_DTO, id: Number(planId) }));
    // '8' no está en la lista de asignados — no debería colarse en myCurrentPlanIds.
    listCurrentPlanMarksService.mockResolvedValue([
      { id: 1, plan_id: 9, user_id: 42, marked_at: '' },
      { id: 2, plan_id: 8, user_id: 42, marked_at: '' },
    ]);

    await useTrainingPlanStore.getState().fetchMyPlans(42);

    expect(useTrainingPlanStore.getState().myCurrentPlanIds).toEqual(['9']);
  });

  test('markCurrentPlan agrega el id a myCurrentPlanIds', async () => {
    useTrainingPlanStore.setState({ myCurrentPlanIds: [] });
    markPlanAsCurrentService.mockResolvedValue({ id: 1, plan_id: 9, user_id: 42, marked_at: '' });
    const result = await useTrainingPlanStore.getState().markCurrentPlan(42, '9');
    expect(markPlanAsCurrentService).toHaveBeenCalledWith(42, '9');
    expect(result.success).toBe(true);
    expect(useTrainingPlanStore.getState().myCurrentPlanIds).toEqual(['9']);
  });

  test('markCurrentPlan devuelve error legible si el servicio rechaza (tope de 2)', async () => {
    useTrainingPlanStore.setState({ myCurrentPlanIds: ['1', '2'] });
    markPlanAsCurrentService.mockRejectedValue(new Error('Ya tenés 2 planes marcados como actuales — desmarcá uno primero.'));
    const result = await useTrainingPlanStore.getState().markCurrentPlan(42, '9');
    expect(result).toEqual({ success: false, error: 'Ya tenés 2 planes marcados como actuales — desmarcá uno primero.' });
    expect(useTrainingPlanStore.getState().myCurrentPlanIds).toEqual(['1', '2']);
  });

  test('unmarkCurrentPlan saca el id de myCurrentPlanIds', async () => {
    useTrainingPlanStore.setState({ myCurrentPlanIds: ['1', '9'] });
    unmarkPlanAsCurrentService.mockResolvedValue(null);
    const result = await useTrainingPlanStore.getState().unmarkCurrentPlan(42, '9');
    expect(unmarkPlanAsCurrentService).toHaveBeenCalledWith(42, '9');
    expect(result.success).toBe(true);
    expect(useTrainingPlanStore.getState().myCurrentPlanIds).toEqual(['1']);
  });
});
