import { resolveCompetitionWinner } from '../utils/competition-winner.js';

const members = [
  { userId: '2', name: 'Ana Gómez' },
  { userId: 3, name: 'Beto Suárez' },
  { userId: '7', name: 'Carla Díaz' },
];

describe('resolveCompetitionWinner', () => {
  test('resuelve un único ganador por nombre', () => {
    expect(resolveCompetitionWinner({ winnerUserIds: ['2'], members })).toEqual({
      kind: 'winner',
      names: ['Ana Gómez'],
      text: 'Ana Gómez',
    });
  });

  test('resuelve empate con dos ganadores', () => {
    expect(resolveCompetitionWinner({ winnerUserIds: [2, '3'], members })).toEqual({
      kind: 'tie',
      names: ['Ana Gómez', 'Beto Suárez'],
      text: 'Empate: Ana Gómez y Beto Suárez',
    });
  });

  test('resuelve empate con más de dos ganadores', () => {
    expect(resolveCompetitionWinner({ winnerUserIds: ['2', '3', '7'], members }).text).toBe(
      'Empate: Ana Gómez, Beto Suárez y Carla Díaz',
    );
  });

  test('sin ganadores devuelve el texto de ausencia de intentos', () => {
    expect(resolveCompetitionWinner({ winnerUserIds: [], members })).toEqual({
      kind: 'none',
      names: [],
      text: 'Sin ganador: no hubo intentos registrados.',
    });
  });

  test('usa Corredor cuando el ganador no está en el roster', () => {
    expect(resolveCompetitionWinner({ winnerUserIds: ['99'], members }).text).toBe('Corredor');
  });

  test('ignora ids duplicados', () => {
    expect(resolveCompetitionWinner({ winnerUserIds: ['2', '2'], members })).toEqual({
      kind: 'winner',
      names: ['Ana Gómez'],
      text: 'Ana Gómez',
    });
  });

  test('sin argumentos devuelve ausencia de ganador', () => {
    expect(resolveCompetitionWinner().kind).toBe('none');
  });
});
