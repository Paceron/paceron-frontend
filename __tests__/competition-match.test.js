import { findActiveMetricCompetitionId } from '../utils/competition-match.js';

function competition(overrides) {
  return {
    id: '1',
    type: 'metric',
    participantUserIds: ['3'],
    startAt: '2026-10-01',
    endAt: '2026-10-07',
    ...overrides,
  };
}

describe('findActiveMetricCompetitionId', () => {
  test('sin competencias devuelve null', () => {
    expect(findActiveMetricCompetitionId([], '3', '2026-10-03')).toBeNull();
  });

  test('sin fecha devuelve null', () => {
    expect(findActiveMetricCompetitionId([competition()], '3', null)).toBeNull();
  });

  test('matchea una competencia dentro de la ventana', () => {
    expect(findActiveMetricCompetitionId([competition()], '3', '2026-10-03')).toBe('1');
  });

  test('fuera de la ventana no matchea', () => {
    expect(findActiveMetricCompetitionId([competition()], '3', '2026-10-10')).toBeNull();
  });

  test('usuario no participante no matchea', () => {
    expect(findActiveMetricCompetitionId([competition()], '9', '2026-10-03')).toBeNull();
  });

  test('type=route nunca matchea', () => {
    expect(findActiveMetricCompetitionId([competition({ type: 'route' })], '3', '2026-10-03')).toBeNull();
  });

  test('endAt null (abierta) matchea si ya empezó', () => {
    expect(findActiveMetricCompetitionId([competition({ endAt: null })], '3', '2026-10-30')).toBe('1');
  });

  test('dos competencias simultáneas: gana la que termina antes', () => {
    const competitions = [
      competition({ id: '1', endAt: '2026-10-20' }),
      competition({ id: '2', endAt: '2026-10-07' }),
    ];
    expect(findActiveMetricCompetitionId(competitions, '3', '2026-10-03')).toBe('2');
  });

  test('competencia abierta (sin endAt) queda última en el desempate', () => {
    const competitions = [
      competition({ id: '1', endAt: null }),
      competition({ id: '2', endAt: '2026-10-07' }),
    ];
    expect(findActiveMetricCompetitionId(competitions, '3', '2026-10-03')).toBe('2');
  });

  test('compara ids como string, no number', () => {
    expect(findActiveMetricCompetitionId([competition({ participantUserIds: ['3'] })], 3, '2026-10-03')).toBe('1');
  });
});
