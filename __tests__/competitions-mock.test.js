import {
  mockListCompetitions,
  mockCreateCompetition,
  mockApproveCompetition,
  mockRejectCompetition,
  mockCancelCompetition,
  mockCloseCompetition,
  mockCreateCompetitionAttempt,
  mockGetCompetition,
  mockGetCompetitionAttempts,
  mockSeedDynamicRouteCompetitionStart,
  __resetMockCompetitions,
} from '../services/__mocks__/competitions-mock.js';
import { __seedRunnerSession, __resetRunnerSessionMock } from '../services/__mocks__/runner-session-mock.js';
import { toCreateCompetitionPayload, toCompetitionModel } from '../services/normalizers.js';

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
    const competition = await mockCreateCompetition(1, { name: 'Nueva', type: 'metric', metric: 'distance', start_at: '2026-11-01', end_at: '2026-11-07', participants: [2, 3] }, { isTrainerCreator: true });
    expect(competition.status).toBe('active');
    const { data } = await mockListCompetitions(1);
    expect(data).toHaveLength(4);
  });

  test('crear como corredor -> queda pending_approval', async () => {
    const competition = await mockCreateCompetition(1, { name: 'Propuesta', type: 'metric', metric: 'distance', start_at: '2026-11-01', end_at: '2026-11-07', participants: [2, 3] }, { isTrainerCreator: false });
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
      type: 'route', route_geojson: JSON.stringify({ type: 'LineString', coordinates: [[-58.4, -34.6], [-58.41, -34.61]] }),
      acceptance_radius_meters: 50, participants: [2, 3],
    }, { isTrainerCreator: true });
    const attempt = await mockCreateCompetitionAttempt(competition.id, 2);
    expect(attempt.session_instance_id).toBe(competition.session_instance_id);
    expect(attempt.session_instance.exercises).toHaveLength(1);
  });

  test('segundo intento del mismo atleta sin max_attempts (sin límite) -> éxito', async () => {
    const competition = await mockCreateCompetition(1, {
      type: 'route', route_geojson: JSON.stringify({ type: 'LineString', coordinates: [[-58.4, -34.6], [-58.41, -34.61]] }),
      acceptance_radius_meters: 50, participants: [2, 3],
    }, { isTrainerCreator: true });
    const first = await mockCreateCompetitionAttempt(competition.id, 2);
    const second = await mockCreateCompetitionAttempt(competition.id, 2);
    expect(second.session_instance_id).not.toBe(first.session_instance_id);
  });

  test('atleta no participante -> error', async () => {
    const competition = await mockCreateCompetition(1, {
      type: 'route', route_geojson: JSON.stringify({ type: 'LineString', coordinates: [[-58.4, -34.6], [-58.41, -34.61]] }),
      acceptance_radius_meters: 50, participants: [2, 3],
    }, { isTrainerCreator: true });
    await expect(mockCreateCompetitionAttempt(competition.id, 9)).rejects.toThrow('No participás');
  });

  test('competencia pending_approval -> error', async () => {
    const competition = await mockCreateCompetition(1, {
      type: 'route', route_geojson: JSON.stringify({ type: 'LineString', coordinates: [[-58.4, -34.6], [-58.41, -34.61]] }),
      acceptance_radius_meters: 50, participants: [2, 3],
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
    expect(data.progress).toHaveLength(data.participants.length);
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
      expect(c.participants).toContain(1);
    });
  });

  test('seed 7 es type=route del equipo 5, activa, con instancia sintética e user_id 1 participando (Spec 4c)', async () => {
    const { data } = await mockListCompetitions(5);
    const competition = data.find((c) => c.id === 7);
    expect(competition.type).toBe('route');
    expect(competition.status).toBe('active');
    expect(competition.participants).toContain(1);
    expect(JSON.parse(competition.route).coordinates.length).toBeGreaterThanOrEqual(2);
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
      type: 'route', route_geojson: JSON.stringify({ type: 'LineString', coordinates: [[-58.3, -34.6], [-58.31, -34.61]] }),
      acceptance_radius_meters: 50, participants: [1, 101],
    }, { isTrainerCreator: true });
    expect(created.session_instance_id).not.toBe(9000);
  });

  test('seed 8 es la competencia de ruta dinámica, reubicable una sola vez por GPS real', async () => {
    const { data } = await mockListCompetitions(5);
    const before = data.find((c) => c.id === 8);
    expect(before.type).toBe('route');
    expect(before.status).toBe('active');
    expect(before.participants).toContain(1);
    const beforeRoute = JSON.parse(before.route);

    const changed = mockSeedDynamicRouteCompetitionStart(-10, -70);
    expect(changed).toBe(true);
    const { data: afterList } = await mockListCompetitions(5);
    const after = afterList.find((c) => c.id === 8);
    const afterRoute = JSON.parse(after.route);
    expect(afterRoute.coordinates[0]).toEqual([-70, -10]);
    // El resto del trazado se traslada por el mismo delta -- no colapsa a
    // un solo punto ni cambia de forma/largo.
    expect(afterRoute.coordinates.length).toBe(beforeRoute.coordinates.length);
    expect(afterRoute.coordinates[0]).not.toEqual(afterRoute.coordinates[1]);

    // Segunda llamada -- no reubica de nuevo (ya se fijó una vez).
    const changedAgain = mockSeedDynamicRouteCompetitionStart(40, 40);
    expect(changedAgain).toBe(false);
    const { data: stillList } = await mockListCompetitions(5);
    expect(JSON.parse(stillList.find((c) => c.id === 8).route).coordinates[0]).toEqual([-70, -10]);
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

describe('mockCreateCompetitionAttempt -- max_attempts', () => {
  beforeEach(() => {
    __resetMockCompetitions();
  });

  test('con max_attempts=2, el primer intento reusa la instancia de la competencia', async () => {
    const competition = await mockCreateCompetition(1, {
      type: 'route', route_geojson: JSON.stringify({ type: 'LineString', coordinates: [[-58.4, -34.6], [-58.41, -34.61]] }),
      acceptance_radius_meters: 50, max_attempts: 2, participants: [2, 3],
    }, { isTrainerCreator: true });
    const attempt = await mockCreateCompetitionAttempt(competition.id, 2);
    expect(attempt.session_instance_id).toBe(competition.session_instance_id);
  });

  test('con max_attempts=2, el segundo intento del mismo atleta mintea una instancia nueva', async () => {
    const competition = await mockCreateCompetition(1, {
      type: 'route', route_geojson: JSON.stringify({ type: 'LineString', coordinates: [[-58.4, -34.6], [-58.41, -34.61]] }),
      acceptance_radius_meters: 50, max_attempts: 2, participants: [2, 3],
    }, { isTrainerCreator: true });
    const first = await mockCreateCompetitionAttempt(competition.id, 2);
    const second = await mockCreateCompetitionAttempt(competition.id, 2);
    expect(second.session_instance_id).not.toBe(first.session_instance_id);
  });

  test('con max_attempts=2, el tercer intento del mismo atleta -> error', async () => {
    const competition = await mockCreateCompetition(1, {
      type: 'route', route_geojson: JSON.stringify({ type: 'LineString', coordinates: [[-58.4, -34.6], [-58.41, -34.61]] }),
      acceptance_radius_meters: 50, max_attempts: 2, participants: [2, 3],
    }, { isTrainerCreator: true });
    await mockCreateCompetitionAttempt(competition.id, 2);
    await mockCreateCompetitionAttempt(competition.id, 2);
    await expect(mockCreateCompetitionAttempt(competition.id, 2)).rejects.toThrow('máximo de intentos');
  });

  test('sin max_attempts en el payload -> null (sin límite), confirmado por backend 2026-10-23', async () => {
    const competition = await mockCreateCompetition(1, {
      type: 'route', route_geojson: JSON.stringify({ type: 'LineString', coordinates: [[-58.4, -34.6], [-58.41, -34.61]] }),
      acceptance_radius_meters: 50, participants: [2, 3],
    }, { isTrainerCreator: true });
    expect(competition.max_attempts).toBeNull();
  });
});

describe('mockGetCompetitionAttempts', () => {
  // Reseed explícito de los 2 intentos de la seed 7/atleta 101 -- el seed de
  // módulo (runner-session-mock.js) se agrega UNA vez al cargar el módulo, y
  // un test anterior en este mismo archivo ("metric sessions_count agrega...")
  // llama __resetRunnerSessionMock(), que lo vacía para el resto de la
  // corrida. Sin este beforeEach, estos tests dependen del ORDEN de
  // ejecución dentro del archivo -- bug real encontrado corriendo los tests
  // (0 intentos en vez de 2).
  beforeEach(() => {
    __resetMockCompetitions();
    __resetRunnerSessionMock();
    __seedRunnerSession({ id: 9000, session_instance_id: 9000, athlete_user_id: 101, status: 'finished', start_date: '2026-10-18T14:02:00Z', end_date: '2026-10-18T14:03:47Z', competition_id: 7 });
    __seedRunnerSession({ id: 9001, session_instance_id: 9010, athlete_user_id: 101, status: 'finished', start_date: '2026-10-19T09:00:00Z', end_date: '2026-10-19T09:03:05Z', competition_id: 7 });
  });

  test('devuelve los 2 intentos seed de la atleta 101 contra la competencia 7, con compliance_ratio distinto', async () => {
    const { data } = await mockGetCompetitionAttempts(7, 101);
    expect(data).toHaveLength(2);
    const bySessionInstance = Object.fromEntries(data.map((a) => [a.session_instance_id, a]));
    expect(bySessionInstance[9000].compliance_ratio).toBeGreaterThan(bySessionInstance[9010].compliance_ratio);
    expect(bySessionInstance[9000].duration_ms).toBe(107000);
    expect(bySessionInstance[9010].duration_ms).toBe(185000);
  });

  test('atleta sin intentos -> lista vacía, no error', async () => {
    const { data } = await mockGetCompetitionAttempts(7, 102);
    expect(data).toEqual([]);
  });
});

describe('mockGetCompetition -- progress de type=route (Gap 36)', () => {
  // Mismo motivo que el beforeEach de mockGetCompetitionAttempts arriba.
  beforeEach(() => {
    __resetMockCompetitions();
    __resetRunnerSessionMock();
    __seedRunnerSession({ id: 9000, session_instance_id: 9000, athlete_user_id: 101, status: 'finished', start_date: '2026-10-18T14:02:00Z', end_date: '2026-10-18T14:03:47Z', competition_id: 7 });
    __seedRunnerSession({ id: 9001, session_instance_id: 9010, athlete_user_id: 101, status: 'finished', start_date: '2026-10-19T09:00:00Z', end_date: '2026-10-19T09:03:05Z', competition_id: 7 });
  });

  test('el mejor intento de la atleta 101 contra la seed 7 aparece en progress', async () => {
    const { data } = await mockGetCompetition(7);
    const own = data.progress.find((p) => p.user_id === 101);
    expect(own.session_instance_id).toBe(9000);
    expect(own.compliance_ratio).toBeGreaterThan(0);
    expect(own.duration_ms).toBe(107000);
  });

  test('un participante sin intentos tiene compliance_ratio/duration_ms/session_instance_id null y has_attempt false', async () => {
    const { data } = await mockGetCompetition(7);
    const noAttempts = data.progress.find((p) => p.user_id === 102);
    expect(noAttempts.compliance_ratio).toBeNull();
    expect(noAttempts.duration_ms).toBeNull();
    expect(noAttempts.session_instance_id).toBeNull();
    expect(noAttempts.has_attempt).toBe(false);
  });

  // Bug real reportado 2026-10-25: un intento terminado sin feedback/puntos
  // GPS (arrancó y terminó parado en el mismo lugar) da compliance_ratio
  // null -- antes el ranking lo mostraba igual que "nunca intentó". `user_id
  // 1` participa de la seed 7 pero no tiene ningún `__seedRunnerSession` en
  // el beforeEach de arriba -- se agrega acá, sin feedback asociado.
  test('un intento terminado sin feedback (compliance no calculable) tiene has_attempt true aunque compliance_ratio sea null', async () => {
    __seedRunnerSession({ id: 9002, session_instance_id: 9020, athlete_user_id: 1, status: 'finished', start_date: '2026-10-20T10:00:00Z', end_date: '2026-10-20T10:00:05Z', competition_id: 7 });
    const { data } = await mockGetCompetition(7);
    const own = data.progress.find((p) => p.user_id === 1);
    expect(own.compliance_ratio).toBeNull();
    expect(own.has_attempt).toBe(true);
  });
});

describe('pipeline completo: form -> toCreateCompetitionPayload -> mockCreateCompetition -> toCompetitionModel', () => {
  // Reproduce el camino real de create-competition-modal.jsx de punta a
  // punta -- es exactamente la cadena donde el bug real de
  // 'ParticipantIDs'/route se escondía: cada pieza (normalizer de ida,
  // mock, normalizer de vuelta) tenía su propio test aislado y pasaba, pero
  // ningún test encadenaba las tres contra el shape que el backend real
  // exige. Reemplaza la verificación manual en preview (bloqueada por
  // flakiness del click simulado en el picker de mapa).
  beforeEach(() => {
    __resetMockCompetitions();
  });

  test('crear una competencia de ruta con el form completo persiste route y participantes correctamente', async () => {
    const route = { type: 'LineString', coordinates: [[-58.365, -34.66], [-58.364, -34.661], [-58.3635, -34.6605]] };
    const payload = toCreateCompetitionPayload({
      type: 'route',
      startAt: '2026-10-29',
      route,
      acceptanceRadiusMeters: '50',
      maxAttempts: '3',
      participantUserIds: ['101', '102'],
    });

    const created = await mockCreateCompetition(5, payload, { isTrainerCreator: true });
    const model = toCompetitionModel(created);

    expect(model.route).toEqual(route);
    expect(model.participantUserIds).toEqual(['101', '102']);
    expect(model.maxAttempts).toBe(3);
    expect(model.status).toBe('active');

    // Y que sobreviva un roundtrip completo por el listado también (mismo
    // camino que competitions-tab.jsx).
    const { data: list } = await mockListCompetitions(5);
    const fromList = toCompetitionModel(list.find((c) => c.id === created.id));
    expect(fromList.route).toEqual(route);
    expect(fromList.participantUserIds).toEqual(['101', '102']);
  });

  test('crear una competencia metric con el form completo persiste participantes correctamente', async () => {
    const payload = toCreateCompetitionPayload({
      type: 'metric', startAt: '2026-10-29', metric: 'distance', endAt: '2026-11-05',
      participantUserIds: ['2', '3'],
    });
    const created = await mockCreateCompetition(1, payload, { isTrainerCreator: true });
    const model = toCompetitionModel(created);
    expect(model.participantUserIds).toEqual(['2', '3']);
    expect(model.route).toBeNull();
  });
});
