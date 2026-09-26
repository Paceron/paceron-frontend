import { buildPointsPayload, buildSetPayload, COMPLETION_STATUS } from '../utils/session-sync-payload.js';

const RUN = {
  id: 1,
  session_instance_id: '42',
  session_date: '2026-09-24',
  team_id: '7',
  athlete_user_id: '99',
  report_source: 'corredor',
};

describe('buildSetPayload', () => {
  test('set finished → completion_status completed con todos los campos', () => {
    const payload = buildSetPayload({
      set: {
        id: 5,
        exercise_instance_id: '3',
        set_number: 0,
        status: 'finished',
        started_at: '2026-09-24T10:00:00.000Z',
        ended_at: '2026-09-24T10:00:12.500Z',
        duration_ms: 12500,
        active_duration_ms: 11000,
        distance_meters: 34.2,
      },
      run: RUN,
    });

    expect(payload).toEqual({
      team_id: 7,
      assigned_session_id: 42,
      assigned_exercise_id: 3,
      athlete_user_id: 99,
      report_source: 'corredor',
      session_date: '2026-09-24',
      set_number: 0,
      completion_status: COMPLETION_STATUS.COMPLETED,
      started_at: '2026-09-24T10:00:00.000Z',
      ended_at: '2026-09-24T10:00:12.500Z',
      duration_ms: 12500,
      active_duration_ms: 11000,
      distance_meters: 34.2,
    });
  });

  test('set skipped → nulos en tiempos y distancia', () => {
    const payload = buildSetPayload({
      set: { id: 6, exercise_instance_id: '3', set_number: 1, status: 'skipped', started_at: null },
      run: RUN,
    });

    expect(payload.completion_status).toBe(COMPLETION_STATUS.SKIPPED);
    expect(payload.started_at).toBeNull();
    expect(payload.ended_at).toBeNull();
    expect(payload.duration_ms).toBeNull();
    expect(payload.active_duration_ms).toBeNull();
    expect(payload.distance_meters).toBeNull();
  });

  test('coerce ids a Number incluso desde strings', () => {
    const payload = buildSetPayload({
      set: { id: 5, exercise_instance_id: '3', set_number: 0, status: 'finished' },
      run: RUN,
    });
    expect(payload.assigned_session_id).toBe(42);
    expect(payload.assigned_exercise_id).toBe(3);
  });

  test('team_id null se mantiene null', () => {
    const payload = buildSetPayload({
      set: { id: 5, exercise_instance_id: '3', set_number: 0, status: 'finished' },
      run: { ...RUN, team_id: null },
    });
    expect(payload.team_id).toBeNull();
  });
});

describe('buildPointsPayload', () => {
  test('mapea order, ids y convierte ms a ISO', () => {
    const payload = buildPointsPayload({
      run: RUN,
      set: { id: 5, exercise_instance_id: '3' },
      points: [
        { id: 1, point_order: 0, latitude: -34.6, longitude: -58.38, recorded_at_ms: 1727183800000 },
        { id: 2, point_order: 1, latitude: -34.61, longitude: -58.37, recorded_at_ms: 1727183801000 },
      ],
    });

    expect(payload.points).toHaveLength(2);
    expect(payload.points[0]).toEqual({
      order: 0,
      session_instance_id: 42,
      exercise_instance_id: 3,
      latitude: -34.6,
      longitude: -58.38,
      recorded_at: new Date(1727183800000).toISOString(),
    });
    expect(payload.points[1].order).toBe(1);
  });

  test('puntos vacíos → array vacío', () => {
    const payload = buildPointsPayload({ run: RUN, set: { id: 5, exercise_instance_id: '3' }, points: [] });
    expect(payload.points).toEqual([]);
  });
});