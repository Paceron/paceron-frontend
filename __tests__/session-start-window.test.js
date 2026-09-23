import { canStartAsyncSession, canStartPresencialSession } from '../utils/session-start-window.js';

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
});
