import { toWorkoutFeedbackHistoryItemModel, toWorkoutFeedbackHistoryResponseModel } from '../services/normalizers.js';

const rawItem = {
  id: 501, athlete_user_id: 12, athlete_name: 'Juan Pérez',
  team_id: 3, team_name: 'Runners Norte', group_id: 7, group_name: 'Elite AM',
  session_instance_id: 88, date: '2026-09-25', session_name: 'Series de velocidad',
  exercise_id: 44, exercise_name: 'Series 400m', catalog_exercise_id: 9, set_number: 2,
  completion_status: 'completed', duration_ms: 95000, active_duration_ms: 90000,
  distance_meters: 412.5, started_at: '2026-09-25T08:15:00Z', ended_at: '2026-09-25T08:16:35Z',
};

describe('toWorkoutFeedbackHistoryItemModel', () => {
  test('mapea snake_case a camelCase con ids como string', () => {
    expect(toWorkoutFeedbackHistoryItemModel(rawItem)).toEqual({
      id: '501', athleteUserId: '12', athleteName: 'Juan Pérez',
      teamId: '3', teamName: 'Runners Norte', groupId: '7', groupName: 'Elite AM',
      sessionInstanceId: '88', date: '2026-09-25', sessionName: 'Series de velocidad',
      exerciseId: '44', exerciseName: 'Series 400m', catalogExerciseId: '9', setNumber: 2,
      completionStatus: 'completed', durationMs: 95000, activeDurationMs: 90000,
      distanceMeters: 412.5, startedAt: '2026-09-25T08:15:00Z', endedAt: '2026-09-25T08:16:35Z',
    });
  });

  test('huérfano: team/group/catalog null se preservan como null, no como "null" string', () => {
    const orphan = { ...rawItem, team_id: null, team_name: null, group_id: null, group_name: null, catalog_exercise_id: null, session_name: null, exercise_name: null };
    const result = toWorkoutFeedbackHistoryItemModel(orphan);
    expect(result.teamId).toBeNull();
    expect(result.groupId).toBeNull();
    expect(result.catalogExerciseId).toBeNull();
    expect(result.sessionName).toBeNull();
    expect(result.exerciseName).toBeNull();
  });
});

describe('toWorkoutFeedbackHistoryResponseModel', () => {
  test('mapea items, paginación y pools de segundo nivel', () => {
    const dto = {
      items: [rawItem],
      total: 137, page: 1, page_size: 20,
      available_athletes: [{ id: 12, name: 'Juan Pérez' }],
      available_exercises: [{ id: 9, name: 'Series 400m' }],
    };
    const result = toWorkoutFeedbackHistoryResponseModel(dto);
    expect(result.total).toBe(137);
    expect(result.page).toBe(1);
    expect(result.pageSize).toBe(20);
    expect(result.items).toHaveLength(1);
    expect(result.items[0].id).toBe('501');
    expect(result.availableAthletes).toEqual([{ id: '12', name: 'Juan Pérez' }]);
    expect(result.availableExercises).toEqual([{ id: '9', name: 'Series 400m' }]);
  });

  test('items/pools ausentes no rompen (arrays vacíos)', () => {
    const result = toWorkoutFeedbackHistoryResponseModel({ total: 0, page: 1, page_size: 20 });
    expect(result.items).toEqual([]);
    expect(result.availableAthletes).toEqual([]);
    expect(result.availableExercises).toEqual([]);
  });
});
