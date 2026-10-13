import { toComparisonListModel, toSessionComparisonModel } from '../services/normalizers.js';
import { __resetMockComparison, __setMockComparisonNow, mockGetComparisons, mockGetSessionComparison } from '../services/__mocks__/activity-comparison-mock.js';

describe('activity comparison normalizers', () => {
  it('maps the session DTO and keeps missing targets as null', () => {
    const model = toSessionComparisonModel({
      session_instance_id: 455, athlete_user_id: 19, date: '2026-10-12', session_name: 'caminar',
      team_id: 16, team_name: 'Los cracks', group_id: null, group_name: null, is_presencial: false,
      started_at: '2026-10-12T13:00:05Z', ended_at: null, status: 'finished', kinds: ['liviano'],
      exercises: [{
        exercise_instance_id: 1001, name: 'caminar', role: 'main', kind: 'liviano', intensity: null, has_target: false,
        planned: { sets: 1, minutes: null, distance_m: null, speed_kph: null, pace_sec_per_km: null },
        sets: [{ set_number: 1, status: 'completed', extra: false, feedback_id: 181, duration_ms: 1000, distance_meters: null, pace_sec_per_km: null, rpe: 7, compliance_pct: 100, deviation_duration_ms: null, deviation_distance_m: null }],
        completed_sets: 1, skipped_sets: 0, compliance_pct: 100,
      }],
      totals: { planned_sets: 1, completed_sets: 1, skipped_sets: 0, unregistered_sets: 0, planned_duration_ms: null, actual_duration_ms: 1000, planned_distance_m: null, actual_distance_m: 0 },
      compliance_pct: 100,
    });

    expect(model.sessionInstanceId).toBe('455');
    expect(model.athleteUserId).toBe('19');
    expect(model.teamId).toBe('16');
    expect(model.groupId).toBeNull();
    expect(model.endedAt).toBeNull();
    expect(model.exercises[0].planned.minutes).toBeNull();
    expect(model.exercises[0].sets[0].deviationDurationMs).toBeNull();
    expect(model.exercises[0].sets[0].feedbackId).toBe('181');
    expect(model.exercises[0].sets[0].rpe).toBe(7);
    expect(model.totals.plannedDurationMs).toBeNull();
    expect(model.totals.actualDurationMs).toBe(1000);
  });

  it('maps the list DTO with flattened totals and defaults', () => {
    const model = toComparisonListModel({
      date_from: '2026-10-01', date_to: '2026-10-13',
      sessions: [{ session_instance_id: 454, date: '2026-10-13', session_name: 'caminar', status: 'none', kinds: [], planned_sets: 3, completed_sets: 0, skipped_sets: 0, unregistered_sets: 3, planned_duration_ms: 1800000, actual_duration_ms: 0, planned_distance_m: null, actual_distance_m: 0, compliance_pct: 0 }],
    });
    expect(model.sessions[0].totals.plannedSets).toBe(3);
    expect(model.sessions[0].totals.plannedDurationMs).toBe(1800000);
    expect(model.summary).toEqual({ sessionsPlanned: 0, sessionsWithActivity: 0, avgCompliancePct: 0 });
    expect(toComparisonListModel(null)).toBeNull();
    expect(toSessionComparisonModel(undefined)).toBeNull();
  });
});

describe('activity comparison mock', () => {
  beforeEach(() => __setMockComparisonNow(new Date(2026, 9, 13, 12, 0, 0)));
  afterEach(() => __resetMockComparison());

  it('reproduces the HU case: complete, half and skipped → 50 %', async () => {
    const session = toSessionComparisonModel(await mockGetSessionComparison({ sessionInstanceId: '455' }));
    expect(session.date).toBe('2026-10-12');
    expect(session.exercises.map((e) => e.compliancePct)).toEqual([100, 50, 0]);
    expect(session.compliancePct).toBe(50);
    expect(session.exercises[1].sets[0].deviationDurationMs).toBe(-300000);
  });

  it('counts extra sets apart and scores distance targets', async () => {
    const session = toSessionComparisonModel(await mockGetSessionComparison({ sessionInstanceId: 300 }));
    const intervals = session.exercises[1];
    expect(intervals.sets).toHaveLength(4);
    expect(intervals.sets[3].extra).toBe(true);
    expect(intervals.sets[3].compliancePct).toBeNull();
    expect(intervals.sets[1].compliancePct).toBe(75);
    expect(intervals.compliancePct).toBe(58.3);
    expect(session.exercises[0].hasTarget).toBe(false);
  });

  it('fails with 404 for an unknown session', async () => {
    await expect(mockGetSessionComparison({ sessionInstanceId: 1 })).rejects.toMatchObject({ status: 404 });
  });

  it('filters the list by range and kind and summarizes it', async () => {
    const all = toComparisonListModel(await mockGetComparisons({ dateFrom: '2026-09-13', dateTo: '2026-10-13' }));
    expect(all.sessions.map((s) => s.sessionInstanceId)).toEqual(['300', '455', '454']);
    expect(all.summary.sessionsPlanned).toBe(3);
    expect(all.summary.sessionsWithActivity).toBe(2);

    const onlyDistance = toComparisonListModel(await mockGetComparisons({ dateFrom: '2026-09-13', dateTo: '2026-10-13', kind: 'velocidad_distancia' }));
    expect(onlyDistance.sessions.map((s) => s.sessionInstanceId)).toEqual(['300']);

    const empty = toComparisonListModel(await mockGetComparisons({ dateFrom: '2026-01-01', dateTo: '2026-01-31' }));
    expect(empty.sessions).toEqual([]);
    expect(empty.summary.avgCompliancePct).toBe(0);
  });
});
