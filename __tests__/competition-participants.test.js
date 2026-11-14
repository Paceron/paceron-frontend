import {
  buildParticipantRows,
  filterParticipants,
  sortParticipantsByName,
} from '../utils/competition-participants.js';

describe('buildParticipantRows', () => {
  const members = [
    { userId: '2', name: 'Ana Gómez', photoUrl: 'https://cdn.test/ana.jpg' },
    { userId: 3, name: 'Beto Suárez', photoUrl: null },
  ];
  const progress = [
    { userId: '2', value: 1200, complianceRatio: null, hasAttempt: false },
    { userId: 3, value: null, complianceRatio: 87, hasAttempt: true },
  ];

  test('resuelve nombre, foto y progreso por userId, con fallback', () => {
    expect(
      buildParticipantRows({ participantUserIds: [2, 3, 99], members, progress }),
    ).toEqual([
      {
        userId: '2',
        name: 'Ana Gómez',
        photoUrl: 'https://cdn.test/ana.jpg',
        progress: progress[0],
      },
      {
        userId: '3',
        name: 'Beto Suárez',
        photoUrl: null,
        progress: progress[1],
      },
      {
        userId: '99',
        name: 'Corredor',
        photoUrl: null,
        progress: null,
      },
    ]);
  });

  test('sin arrays devuelve una lista vacía', () => {
    expect(buildParticipantRows({})).toEqual([]);
    expect(buildParticipantRows()).toEqual([]);
  });
});

describe('sortParticipantsByName', () => {
  test('ordena alfabéticamente ignorando acentos y mayúsculas, desempata por userId', () => {
    const rows = [
      { userId: '10', name: 'Álvaro' },
      { userId: '2', name: 'ana' },
      { userId: '3', name: 'Ana' },
      { userId: '1', name: 'Zoe' },
    ];
    expect(sortParticipantsByName(rows).map((row) => row.userId)).toEqual([
      '10',
      '2',
      '3',
      '1',
    ]);
  });

  test('no muta el array original', () => {
    const rows = [
      { userId: '1', name: 'Zoe' },
      { userId: '2', name: 'Ana' },
    ];
    const sorted = sortParticipantsByName(rows);
    expect(rows.map((row) => row.name)).toEqual(['Zoe', 'Ana']);
    expect(sorted).not.toBe(rows);
  });

  test('sin argumentos devuelve una lista vacía', () => {
    expect(sortParticipantsByName()).toEqual([]);
  });
});

describe('filterParticipants', () => {
  const rows = [
    { userId: '1', name: 'Núñez' },
    { userId: '2', name: 'Ana Gómez' },
    { userId: '3', name: 'Muñoz' },
  ];

  test('matchea con y sin acentos, sin importar mayúsculas', () => {
    expect(filterParticipants(rows, 'nunez').map((row) => row.userId)).toEqual(['1']);
    expect(filterParticipants(rows, 'NÚÑEZ').map((row) => row.userId)).toEqual(['1']);
    expect(filterParticipants(rows, 'gómez').map((row) => row.userId)).toEqual(['2']);
  });

  test('sin coincidencias devuelve una lista vacía', () => {
    expect(filterParticipants(rows, 'zzz')).toEqual([]);
  });

  test('query vacío devuelve las filas tal cual', () => {
    expect(filterParticipants(rows, '')).toBe(rows);
    expect(filterParticipants(rows)).toBe(rows);
  });
});
