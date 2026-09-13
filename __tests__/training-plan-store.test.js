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
  getTrainingPlan as getTrainingPlanService,
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
  // list/get/create/update/delete/clone de TrainingPlan viven ahora en
  // hooks/use-training-plans.js (TanStack Query, sin test dedicado —
  // mismo criterio que hooks/use-exercises.js/use-sessions.js, ver
  // CLAUDE.md). Este store solo conserva la limpieza local que dispara
  // el onSuccess de deletePlan.
  test('cleanupAfterPlanDeleted saca el plan de myPlans y limpia trainingPlanId de cualquier grupo que lo tuviera', () => {
    useTrainingPlanStore.setState({
      myPlans: [{ id: '1' }],
      groupTrainingPlanIds: { g1: '1', g2: '2' },
    });

    useTrainingPlanStore.getState().cleanupAfterPlanDeleted('1');

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
