import {
  mockListCompetitions,
  mockCreateCompetition,
  mockApproveCompetition,
  mockRejectCompetition,
  mockCancelCompetition,
  mockCloseCompetition,
  mockCreateCompetitionAttempt,
  mockGetCompetition,
  mockSeedDynamicRouteCompetitionStart,
  __resetMockCompetitions,
} from '../services/__mocks__/competitions-mock.js';
import { __seedRunnerSession, __resetRunnerSessionMock } from '../services/__mocks__/runner-session-mock.js';

describe('competitions-mock', () => {
  beforeEach(() => {
    __resetMockCompetitions();
  });

  test('el seed trae 3 competencias del equipo 1, con 3 estados distintos', async () => {
    const { data } = await mockListCompetitions(1);
    expect(data).toHaveLength(3);
    const statuses = data.map((c) => c.status);
    expect(statuses).toContain('active');
    expect(statuses).toContain('pending_approval');
    expect(statuses).toContain('finished');
  });

  test('filtro por status funciona', async () => {
    const { data } = await mockListCompetitions(1, { status: 'active' });
    expect(data).toHaveLength(1);
    expect(data[0].status).toBe('active');
  });

  test('crear como entrenador -> queda active de una', async () => {
    const competition = await mockCreateCompetition(1, { name: 'Nueva', type: 'metric', metric: 'distance', start_at: '2026-11-01', end_at: '2026-11-07', participant_user_ids: [2, 3] }, { isTrainerCreator: true });
    expect(competition.status).toBe('active');
    const { data } = await mockListCompetitions(1);
    expect(data).toHaveLength(4);
  });

  test('crear como corredor -> queda pending_approval', async () => {
    const competition = await mockCreateCompetition(1, { name: 'Propuesta', type: 'metric', metric: 'distance', start_at: '2026-11-01', end_at: '2026-11-07', participant_user_ids: [2, 3] }, { isTrainerCreator: false });
    expect(competition.status).toBe('pending_approval');
  });

  test('aprobar una pending_approval -> queda active', async () => {
    await mockApproveCompetition(2);
    const { data } = await mockListCompetitions(1, { status: 'active' });
    expect(data.map((c) => c.id)).toContain(2);
  });

  test('rechazar con motivo -> queda rejected con el motivo guardado', async () => {
    const competition = await mockRejectCompetition(2, 'Se superpone con otra competencia');
    expect(competition.status).toBe('rejected');
    expect(competition.rejection_reason).toBe('Se superpone con otra competencia');
  });

  test('cancelar -> la fila desaparece por completo (borrado físico real)', async () => {
    await mockCancelCompetition(2);
    const { data } = await mockListCompetitions(1);
    expect(data.map((c) => c.id)).not.toContain(2);
    expect(data).toHaveLength(2);
  });

  test('cerrar una active -> queda finished con al menos un ganador si había participantes', async () => {
    const competition = await mockCloseCompetition(1);
    expect(competition.status).toBe('finished');
    expect(competition.winner_user_ids.length).toBeGreaterThan(0);
  });
});

describe('mockCreateCompetitionAttempt', () => {
  beforeEach(() => {
    __resetMockCompetitions();
  });

  test('crear type=route y correr un intento devuelve la instancia sintética', async () => {
    const competition = await mockCreateCompetition(1, {
      type: 'route', route: { type: 'LineString', coordinates: [[-58.4, -34.6], [-58.41, -34.61]] },
      acceptance_radius_meters: 50, participant_user_ids: [2, 3],
    }, { isTrainerCreator: true });
    const attempt = await mockCreateCompetitionAttempt(competition.id, 2);
    expect(attempt.session_instance_id).toBe(competition.session_instance_id);
    expect(attempt.session_instance.exercises).toHaveLength(1);
  });

  test('segundo intento del mismo atleta -> error', async () => {
    const competition = await mockCreateCompetition(1, {
      type: 'route', route: { type: 'LineString', coordinates: [[-58.4, -34.6], [-58.41, -34.61]] },
      acceptance_radius_meters: 50, participant_user_ids: [2, 3],
    }, { isTrainerCreator: true });
    await mockCreateCompetitionAttempt(competition.id, 2);
    await expect(mockCreateCompetitionAttempt(competition.id, 2)).rejects.toThrow('Ya tenés un intento');
  });

  test('atleta no participante -> error', async () => {
    const competition = await mockCreateCompetition(1, {
      type: 'route', route: { type: 'LineString', coordinates: [[-58.4, -34.6], [-58.41, -34.61]] },
      acceptance_radius_meters: 50, participant_user_ids: [2, 3],
    }, { isTrainerCreator: true });
    await expect(mockCreateCompetitionAttempt(competition.id, 9)).rejects.toThrow('No participás');
  });

  test('competencia pending_approval -> error', async () => {
    const competition = await mockCreateCompetition(1, {
      type: 'route', route: { type: 'LineString', coordinates: [[-58.4, -34.6], [-58.41, -34.61]] },
      acceptance_radius_meters: 50, participant_user_ids: [2, 3],
    }, { isTrainerCreator: false });
    await expect(mockCreateCompetitionAttempt(competition.id, 2)).rejects.toThrow('no está activa');
  });
});

describe('mockGetCompetition', () => {
  beforeEach(() => {
    __resetMockCompetitions();
  });

  test('devuelve progress con un valor por participante', async () => {
    const { data } = await mockGetCompetition(1);
    expect(data.progress).toHaveLength(data.participant_user_ids.length);
    expect(data.progress[0]).toHaveProperty('user_id');
    expect(data.progress[0]).toHaveProperty('value');
  });

  test('seeds 4, 5 y 6 son del equipo 5, activas, metric sessions_count, con user_id 1 participando', async () => {
    const { data } = await mockListCompetitions(5);
    const metricSeeds = data.filter((c) => c.type === 'metric');
    expect(metricSeeds).toHaveLength(3);
    metricSeeds.forEach((c) => {
      expect(c.status).toBe('active');
      expect(c.metric).toBe('sessions_count');
      expect(c.participant_user_ids).toContain(1);
    });
  });

  test('seed 7 es type=route del equipo 5, activa, con instancia sintética e user_id 1 participando (Spec 4c)', async () => {
    const { data } = await mockListCompetitions(5);
    const competition = data.find((c) => c.id === 7);
    expect(competition.type).toBe('route');
    expect(competition.status).toBe('active');
    expect(competition.participant_user_ids).toContain(1);
    expect(competition.route.coordinates.length).toBeGreaterThanOrEqual(2);
    expect(competition.acceptance_radius_meters).toBeGreaterThanOrEqual(5);
    expect(competition.acceptance_radius_meters).toBeLessThanOrEqual(500);
    expect(competition.session_instance_id).toEqual(expect.any(Number));
  });

  test('user_id 1 puede correr un intento contra la seed 7, sin colisionar con instancias creadas en runtime', async () => {
    const attempt = await mockCreateCompetitionAttempt(7, 1);
    expect(attempt.session_instance_id).toBe(9000);
    expect(attempt.session_instance.exercises[0].name).toBe('Corrida');

    // Una competencia nueva creada en runtime no debe reusar el 9000 de la seed.
    const created = await mockCreateCompetition(5, {
      type: 'route', route: { type: 'LineString', coordinates: [[-58.3, -34.6], [-58.31, -34.61]] },
      acceptance_radius_meters: 50, participant_user_ids: [1, 101],
    }, { isTrainerCreator: true });
    expect(created.session_instance_id).not.toBe(9000);
  });

  test('seed 8 es la competencia de ruta dinámica, reubicable una sola vez por GPS real', async () => {
    const { data } = await mockListCompetitions(5);
    const before = data.find((c) => c.id === 8);
    expect(before.type).toBe('route');
    expect(before.status).toBe('active');
    expect(before.participant_user_ids).toContain(1);

    const changed = mockSeedDynamicRouteCompetitionStart(-10, -70);
    expect(changed).toBe(true);
    const { data: afterList } = await mockListCompetitions(5);
    const after = afterList.find((c) => c.id === 8);
    expect(after.route.coordinates[0]).toEqual([-70, -10]);
    // El resto del trazado se traslada por el mismo delta -- no colapsa a
    // un solo punto ni cambia de forma/largo.
    expect(after.route.coordinates.length).toBe(before.route.coordinates.length);
    expect(after.route.coordinates[0]).not.toEqual(after.route.coordinates[1]);

    // Segunda llamada -- no reubica de nuevo (ya se fijó una vez).
    const changedAgain = mockSeedDynamicRouteCompetitionStart(40, 40);
    expect(changedAgain).toBe(false);
    const { data: stillList } = await mockListCompetitions(5);
    expect(stillList.find((c) => c.id === 8).route.coordinates[0]).toEqual([-70, -10]);
  });

  test('seed 6 tiene ventana enteramente futura, no cubre hoy', async () => {
    const { data } = await mockListCompetitions(5);
    const competition = data.find((c) => c.id === 6);
    const todayIso = new Date().toISOString().slice(0, 10);
    expect(competition.start_at > todayIso).toBe(true);
  });

  test('metric sessions_count agrega runner_session finished reales por competencia+atleta', async () => {
    __resetRunnerSessionMock();
    __seedRunnerSession({ session_instance_id: 1, athlete_user_id: 1, competition_id: 4, status: 'finished', start_date: '2026-10-15T10:00:00Z', end_date: '2026-10-15T11:00:00Z' });
    __seedRunnerSession({ session_instance_id: 2, athlete_user_id: 1, competition_id: 4, status: 'finished', start_date: '2026-10-16T10:00:00Z', end_date: '2026-10-16T11:00:00Z' });
    // wip no cuenta, y un competition_id distinto tampoco debe sumar acá.
    __seedRunnerSession({ session_instance_id: 3, athlete_user_id: 1, competition_id: 4, status: 'wip', start_date: '2026-10-17T10:00:00Z' });
    __seedRunnerSession({ session_instance_id: 4, athlete_user_id: 1, competition_id: 5, status: 'finished', start_date: '2026-10-13T10:00:00Z', end_date: '2026-10-13T11:00:00Z' });

    const { data } = await mockGetCompetition(4);
    const own = data.progress.find((p) => p.user_id === 1);
    expect(own.value).toBe(2);
  });
});
