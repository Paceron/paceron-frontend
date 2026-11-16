import { isCalendarDayClosed } from '../utils/calendar-day-closed.js';

const NOW = new Date('2026-10-15T13:00:00.000Z'); // 2026-10-15 10:00 en Argentina

describe('isCalendarDayClosed', () => {
  test('fecha pasada siempre está cerrada', () => {
    expect(isCalendarDayClosed('2026-10-14', {}, NOW)).toBe(true);
    expect(isCalendarDayClosed('2026-10-14', { isPresencial: true, presencialTimeFrom: '23:00' }, NOW)).toBe(true);
  });

  test('fecha futura nunca está cerrada', () => {
    expect(isCalendarDayClosed('2026-10-16', {}, NOW)).toBe(false);
    expect(isCalendarDayClosed('2026-10-16', { isPresencial: false }, NOW)).toBe(false);
  });

  test('hoy, no presencial, permanece abierto', () => {
    expect(isCalendarDayClosed('2026-10-15', { isPresencial: false }, NOW)).toBe(false);
  });

  test('hoy, presencial, permanece abierto antes de su hora de inicio', () => {
    expect(isCalendarDayClosed('2026-10-15', { isPresencial: true, presencialTimeFrom: '12:00' }, NOW)).toBe(false);
  });

  test('hoy, presencial, permanece abierto aunque ya haya empezado', () => {
    expect(isCalendarDayClosed('2026-10-15', { isPresencial: true, presencialTimeFrom: '08:00' }, NOW)).toBe(false);
  });

  test('hoy, presencial, sigue abierto hasta el cambio de fecha argentina', () => {
    const argentina2359 = new Date('2026-10-16T02:59:00.000Z');
    expect(isCalendarDayClosed('2026-10-15', { isPresencial: true, presencialTimeFrom: '08:00' }, argentina2359)).toBe(false);
  });

  test('el día anterior se cierra al llegar la medianoche argentina', () => {
    const argentinaMidnight = new Date('2026-10-16T03:00:00.000Z');
    expect(isCalendarDayClosed('2026-10-15', {}, argentinaMidnight)).toBe(true);
    expect(isCalendarDayClosed('2026-10-16', {}, argentinaMidnight)).toBe(false);
  });

  test('hoy, presencial sin presencialTimeFrom cargado, no está cerrado', () => {
    expect(isCalendarDayClosed('2026-10-15', { isPresencial: true, presencialTimeFrom: null }, NOW)).toBe(false);
  });
});
