import { appendFeedEvent, filterFeedByAthlete } from '../utils/trainer-records-feed.js';

const EVENT_A = { id: 'a', athleteUserId: '12', athleteName: 'Juan', exerciseName: 'Caminata', setNumber: 1, status: 'finished', timestamp: 1000 };
const EVENT_B = { id: 'b', athleteUserId: '13', athleteName: 'Ana', exerciseName: 'Sentadillas', setNumber: 1, status: 'skipped', timestamp: 2000 };

describe('appendFeedEvent', () => {
  test('agrega al tope (más reciente primero)', () => {
    const feed = appendFeedEvent([EVENT_A], EVENT_B);
    expect(feed).toEqual([EVENT_B, EVENT_A]);
  });

  test('feed vacío -- el evento queda solo', () => {
    expect(appendFeedEvent([], EVENT_A)).toEqual([EVENT_A]);
  });

  test('mismo id ya presente -- lo reemplaza en vez de duplicar (edición de una serie ya vista)', () => {
    const updated = { ...EVENT_A, status: 'skipped' };
    const feed = appendFeedEvent([EVENT_A, EVENT_B], updated);
    expect(feed).toHaveLength(2);
    expect(feed.find((e) => e.id === 'a').status).toBe('skipped');
  });

  test('no muta el array original', () => {
    const original = [EVENT_A];
    appendFeedEvent(original, EVENT_B);
    expect(original).toEqual([EVENT_A]);
  });
});

describe('filterFeedByAthlete', () => {
  const feed = [EVENT_B, EVENT_A];

  test('sin athleteUserId devuelve todo tal cual', () => {
    expect(filterFeedByAthlete(feed, null)).toBe(feed);
    expect(filterFeedByAthlete(feed, undefined)).toBe(feed);
  });

  test('con athleteUserId filtra por ese atleta', () => {
    expect(filterFeedByAthlete(feed, '12')).toEqual([EVENT_A]);
  });

  test('compara como string -- un number también matchea', () => {
    expect(filterFeedByAthlete(feed, 13)).toEqual([EVENT_B]);
  });
});
