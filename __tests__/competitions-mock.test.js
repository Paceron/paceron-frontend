import {
  mockListCompetitions,
  mockCreateCompetition,
  mockApproveCompetition,
  mockRejectCompetition,
  mockCancelCompetition,
  mockCloseCompetition,
  __resetMockCompetitions,
} from '../services/__mocks__/competitions-mock.js';

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
