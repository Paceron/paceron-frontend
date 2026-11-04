import { streakDayVisual } from '../utils/streak-day-status.js';

describe('streakDayVisual', () => {
  test('completed -> verde de marca', () => {
    expect(streakDayVisual('completed')).toEqual({ color: '#8cc63e', textColor: '#ffffff', label: 'Completado' });
  });

  test('pending -> texto oscuro (fondo claro)', () => {
    expect(streakDayVisual('pending').textColor).toBe('#475569');
  });

  test('failed -> rojo', () => {
    expect(streakDayVisual('failed').color).toBe('#f43f5e');
  });

  test('skipped -> gris oscuro', () => {
    expect(streakDayVisual('skipped').color).toBe('#64748b');
  });

  test('pending -> neutro', () => {
    expect(streakDayVisual('pending').color).toBe('#cbd5e1');
  });

  test('estado desconocido cae a pending', () => {
    expect(streakDayVisual('bogus')).toEqual(streakDayVisual('pending'));
  });
});
