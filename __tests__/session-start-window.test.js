import { canStartAsyncSession, canStartPresencialSession, isPastSessionDate } from '../utils/session-start-window.js';

const NOW = new Date(2026, 9, 15, 10, 0, 0); // 2026-10-15 10:00 local

describe('canStartAsyncSession', () => {
  test('hoy, entrenamiento no presencial, habilitado', () => {
    expect(canStartAsyncSession({ kind: 'training', isPresencial: false, date: '2026-10-15' }, NOW)).toBe(true);
  });

  test('otro día, deshabilitado', () => {
    expect(canStartAsyncSession({ kind: 'training', isPresencial: false, date: '2026-10-16' }, NOW)).toBe(false);
  });

  test('presencial, deshabilitado (lo arranca el entrenador)', () => {
    expect(canStartAsyncSession({ kind: 'training', isPresencial: true, date: '2026-10-15' }, NOW)).toBe(false);
  });

  test('descanso u otra actividad, deshabilitado', () => {
    expect(canStartAsyncSession({ kind: 'rest', isPresencial: false, date: '2026-10-15' }, NOW)).toBe(false);
    expect(canStartAsyncSession({ kind: 'other', isPresencial: false, date: '2026-10-15' }, NOW)).toBe(false);
  });
});

describe('canStartPresencialSession', () => {
  const base = { kind: 'training', isPresencial: true, date: '2026-10-15' };

  test('dentro de la ventana de 30 min antes del horario, habilitado', () => {
    expect(canStartPresencialSession({ ...base, presencialTimeFrom: '10:29' }, NOW)).toBe(true);
  });

  test('dentro de la ventana de 30 min después del horario, habilitado', () => {
    expect(canStartPresencialSession({ ...base, presencialTimeFrom: '09:31' }, NOW)).toBe(true);
  });

  test('fuera de la ventana (más de 30 min antes), deshabilitado', () => {
    expect(canStartPresencialSession({ ...base, presencialTimeFrom: '10:31' }, NOW)).toBe(false);
  });

  test('fuera de la ventana (más de 30 min después), deshabilitado', () => {
    expect(canStartPresencialSession({ ...base, presencialTimeFrom: '09:29' }, NOW)).toBe(false);
  });

  test('otro día, deshabilitado aunque el horario coincida', () => {
    expect(canStartPresencialSession({ ...base, date: '2026-10-16', presencialTimeFrom: '10:00' }, NOW)).toBe(false);
  });

  test('sin presencialTimeFrom cargado, deshabilitado', () => {
    expect(canStartPresencialSession({ ...base, presencialTimeFrom: null }, NOW)).toBe(false);
  });

  test('no presencial, deshabilitado', () => {
    expect(canStartPresencialSession({ ...base, isPresencial: false, presencialTimeFrom: '10:00' }, NOW)).toBe(false);
  });

  test('con presencialTimeTo cargado, la ventana cubre todo el horario (no solo ±30min del inicio)', () => {
    // Arrancó a las 08:00, termina a las 11:00 -- a las 10:00 (NOW) ya pasaron
    // más de 30 min desde el inicio, pero la sesión sigue en curso.
    expect(canStartPresencialSession({ ...base, presencialTimeFrom: '08:00', presencialTimeTo: '11:00' }, NOW)).toBe(true);
  });

  test('con presencialTimeTo cargado, deshabilitado después del horario de fin', () => {
    expect(canStartPresencialSession({ ...base, presencialTimeFrom: '08:00', presencialTimeTo: '09:30' }, NOW)).toBe(false);
  });

  test('con presencialTimeTo cargado, sigue respetando los 30 min de margen antes del inicio', () => {
    expect(canStartPresencialSession({ ...base, presencialTimeFrom: '11:00', presencialTimeTo: '13:00' }, NOW)).toBe(false);
  });
});

describe('isPastSessionDate', () => {
  test('fecha anterior a hoy → true', () => {
    expect(isPastSessionDate({ date: '2026-10-14' }, NOW)).toBe(true);
  });

  test('hoy → false', () => {
    expect(isPastSessionDate({ date: '2026-10-15' }, NOW)).toBe(false);
  });

  test('fecha futura → false', () => {
    expect(isPastSessionDate({ date: '2026-10-16' }, NOW)).toBe(false);
  });

  test('independiente del kind: cualquier día vencido entra al registro', () => {
    expect(isPastSessionDate({ kind: 'rest', date: '2026-10-01' }, NOW)).toBe(true);
    expect(isPastSessionDate({ kind: 'cancelled', date: '2026-10-01' }, NOW)).toBe(true);
  });
});
