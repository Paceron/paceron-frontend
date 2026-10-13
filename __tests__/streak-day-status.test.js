import { streakDayVisual } from '../utils/streak-day-status.js';

describe('streakDayVisual', () => {
  test('completed -> verde', () => {
    expect(streakDayVisual('completed')).toEqual({ color: '#22c55e', label: 'Completado' });
  });

  test('failed -> rojo', () => {
    expect(streakDayVisual('failed').color).toBe('#ef4444');
  });

  test('skipped -> gris', () => {
    expect(streakDayVisual('skipped').color).toBe('#94a3b8');
  });

  test('pending -> neutro', () => {
    expect(streakDayVisual('pending').color).toBe('#cbd5e1');
  });

  test('estado desconocido cae a pending', () => {
    expect(streakDayVisual('bogus')).toEqual(streakDayVisual('pending'));
  });
});
