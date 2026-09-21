import { isCalendarDayClosed } from '../utils/calendar-day-closed.js';

const NOW = new Date(2026, 9, 15, 10, 0, 0); // 2026-10-15 10:00 local

describe('isCalendarDayClosed', () => {
  test('fecha pasada siempre está cerrada', () => {
    expect(isCalendarDayClosed('2026-10-14', {}, NOW)).toBe(true);
    expect(isCalendarDayClosed('2026-10-14', { isPresencial: true, presencialTimeFrom: '23:00' }, NOW)).toBe(true);
  });

  test('fecha futura nunca está cerrada', () => {
    expect(isCalendarDayClosed('2026-10-16', {}, NOW)).toBe(false);
    expect(isCalendarDayClosed('2026-10-16', { isPresencial: false }, NOW)).toBe(false);
  });

  test('hoy, no presencial, está cerrado', () => {
    expect(isCalendarDayClosed('2026-10-15', { isPresencial: false }, NOW)).toBe(true);
  });

  test('hoy, presencial, antes del horario de inicio, no está cerrado', () => {
    expect(isCalendarDayClosed('2026-10-15', { isPresencial: true, presencialTimeFrom: '12:00' }, NOW)).toBe(false);
  });

  test('hoy, presencial, después del horario de inicio, está cerrado', () => {
    expect(isCalendarDayClosed('2026-10-15', { isPresencial: true, presencialTimeFrom: '08:00' }, NOW)).toBe(true);
  });

  test('hoy, presencial, exactamente en el horario de inicio, está cerrado', () => {
    expect(isCalendarDayClosed('2026-10-15', { isPresencial: true, presencialTimeFrom: '10:00' }, NOW)).toBe(true);
  });

  test('hoy, presencial sin presencialTimeFrom cargado, no está cerrado', () => {
    expect(isCalendarDayClosed('2026-10-15', { isPresencial: true, presencialTimeFrom: null }, NOW)).toBe(false);
  });
});
