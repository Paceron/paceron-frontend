import {
  __resetRunnerSessionMock,
  __seedRunnerSession,
  mockCreateRunnerSession,
  mockFinishRunnerSession,
  mockGetRunnerSession,
  mockGetSessionFeedback,
  mockUpdateWorkoutFeedback,
} from '../services/__mocks__/runner-session-mock.js';
import {
  __resetWorkoutFeedbackMock,
  mockCreateWorkoutFeedback,
  mockCreateWorkoutFeedbackPoints,
} from '../services/__mocks__/workoutFeedback-mock.js';

const baseBody = { start_date: '2026-09-24T10:00:00.000Z' };

beforeEach(() => {
  __resetRunnerSessionMock();
  __resetWorkoutFeedbackMock();
});

describe('mockCreateRunnerSession', () => {
  test('crea el estado wip con start_date', async () => {
    const res = await mockCreateRunnerSession(101, baseBody);
    expect(res.data).toMatchObject({ session_instance_id: 101, status: 'wip', start_date: baseBody.start_date });
    expect(res.data.end_date).toBeNull();
  });

  test('idempotente: segunda creación devuelve el mismo estado, sin duplicar ni resetear', async () => {
    const first = await mockCreateRunnerSession(101, baseBody);
    const second = await mockCreateRunnerSession(101, baseBody);
    expect(second.data.id).toBe(first.data.id);
    expect(second.data.status).toBe('wip');
  });

  test('no vuelve a bajar una sesión ya terminada a wip', async () => {
    await mockCreateRunnerSession(101, baseBody);
    await mockFinishRunnerSession(101, {});
    const res = await mockCreateRunnerSession(101, baseBody);
    expect(res.data.status).toBe('finished');
  });

  test('misma instancia, distintos atletas → filas separadas', async () => {
    const a = await mockCreateRunnerSession(101, { ...baseBody, athlete_user_id: 3 });
    const b = await mockCreateRunnerSession(101, { ...baseBody, athlete_user_id: 9 });
    expect(a.data.id).not.toBe(b.data.id);
  });
});

describe('mockFinishRunnerSession', () => {
  test('pasa de wip a finished y marca end_date', async () => {
    await mockCreateRunnerSession(101, baseBody);
    const res = await mockFinishRunnerSession(101, {});
    expect(res.data.status).toBe('finished');
    expect(res.data.end_date).toBeTruthy();
  });

  test('idempotente: terminada dos veces devuelve el mismo estado', async () => {
    await mockCreateRunnerSession(101, baseBody);
    await mockFinishRunnerSession(101, {});
    const res = await mockFinishRunnerSession(101, {});
    expect(res.data.status).toBe('finished');
  });

  test('404 si no existe el estado', async () => {
    await expect(mockFinishRunnerSession(999, {})).rejects.toMatchObject({ status: 404 });
  });
});

describe('mockGetRunnerSession', () => {
  test('404 sin fila (el caller la interpreta como "sin estado" → modo manual)', async () => {
    await expect(mockGetRunnerSession(999, 1)).rejects.toMatchObject({ status: 404 });
  });

  test('devuelve la fila existente', async () => {
    await mockCreateRunnerSession(101, { ...baseBody, athlete_user_id: 3 });
    const res = await mockGetRunnerSession(101, 3);
    expect(res.data.status).toBe('wip');
    expect(res.data.athlete_user_id).toBe(3);
  });
});

describe('mockGetSessionFeedback', () => {
  const seed = (payload) =>
    mockCreateWorkoutFeedback({
      assigned_session_id: 101,
      assigned_exercise_id: 501,
      set_number: 1,
      athlete_user_id: 3,
      status: 'completed',
      ...payload,
    });

  test('solo feedback del mismo atleta; devuelve los activos de la sesión', async () => {
    await seed({ set_number: 1 });
    await seed({ set_number: 2, athlete_user_id: 9 });
    const res = await mockGetSessionFeedback(101, 3);
    expect(res.data).toHaveLength(1);
    expect(res.data[0].set_number).toBe(1);
    expect(res.data[0].assigned_session_id).toBe(101);
  });

  test('points_count refleja los puntos del feedback', async () => {
    const { data } = await seed({});
    await mockCreateWorkoutFeedbackPoints(data.id, {
      points: [{ order: 0, lat: -34.6, lon: -58.4, t: 123 }],
    });
    const res = await mockGetSessionFeedback(101, 3);
    expect(res.data[0].points_count).toBe(1);
  });
});

describe('mockUpdateWorkoutFeedback', () => {
  test('edita una fila existente y devuelve los datos actualizados', async () => {
    const { data } = await mockCreateWorkoutFeedback({ assigned_session_id: 101, assigned_exercise_id: 501, set_number: 1, athlete_user_id: 3 });
    const res = await mockUpdateWorkoutFeedback(data.id, { duration_ms: 210000 });
    expect(res.data.duration_ms).toBe(210000);
  });

  test('404 si el feedback no existe', async () => {
    await expect(mockUpdateWorkoutFeedback(123, { duration_ms: 210000 })).rejects.toMatchObject({ status: 404 });
  });
});

describe('__seedRunnerSession', () => {
  test('siembra determinista para pruebas de la revisión', async () => {
    const row = __seedRunnerSession({ session_instance_id: 7, athlete_user_id: 3, status: 'finished' });
    expect(row.status).toBe('finished');
    const res = await mockGetRunnerSession(7, 3);
    expect(res.data.id).toBe(row.id);
    expect(res.data.status).toBe('finished');
  });
});