import { rankMeta } from '../utils/leaderboard-rank-meta.js';

describe('rankMeta', () => {
  test('puesto 1 -> medalla dorada', () => {
    expect(rankMeta(1)).toEqual({ icon: 'medal', color: '#eab308' });
  });

  test('puesto 2 -> medalla plateada', () => {
    expect(rankMeta(2)).toEqual({ icon: 'medal', color: '#94a3b8' });
  });

  test('puesto 3 -> medalla bronce', () => {
    expect(rankMeta(3)).toEqual({ icon: 'medal', color: '#b45309' });
  });

  test('puesto 4 -> sin medalla (null)', () => {
    expect(rankMeta(4)).toBeNull();
  });

  test('puesto 7 (fuera del top 5, fila propia) -> sin medalla (null)', () => {
    expect(rankMeta(7)).toBeNull();
  });
});
