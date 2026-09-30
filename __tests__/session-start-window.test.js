import { canStartAsyncSession, canStartPresencialSession, canStartSession, isPastSessionDate } from '../utils/session-start-window.js';

const NOW = new Date(2026, 9, 15, 10, 0, 0); // 2026-10-15 10:00 local

describe('canStartAsyncSession', () => {
  test('hoy, entrenamiento no presencial, habilitado', () => {
    expect(canStartAsyncSession({ kind: 'training', isPresencial: false, date: '2026-10-15' }, NOW)).toBe(true);
  });

  test('otro día, deshabilitado', () => {
    expect(canStartAsyncSession({ kind: 'training', isPresencial: false, date: '2026-10-16' }, NOW)).toBe(false);
  });

  // El nombre de la función es engañoso: no es "puede el corredor empezar", es
  // "esta sesión es asíncrona y es hoy". La presencial la maneja `canStartSession`.
  test('presencial, no es asíncrona', () => {
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

// Bug del 2026-09-28: el call site ramificaba por ROL
// (`role === 'runner' ? canStartAsyncSession : canStartPresencialSession`), y como
// `canStartAsyncSession` excluye la presencial, el corredor se quedaba sin botón
// en toda sesión presencial — exactamente al revés de lo que dice el modal, que
// sí le mostraba que la sesión era presencial.
describe('canStartSession', () => {
  const HOY = '2026-10-15'; // NOW es 2026-10-15 10:00
  const asincrona = { kind: 'training', isPresencial: false, date: HOY };
  const presencial = { kind: 'training', isPresencial: true, date: HOY, presencialTimeFrom: '10:00' };

  test('la presencial de HOY se puede arrancar', () => {
    expect(canStartSession(presencial, NOW)).toBe(true);
  });

  // El caso que estaba roto, y el motivo de sacar la ventana: el corredor llega
  // cuando llega. El horario del gimnasio no es el reloj de su teléfono.
  test('presencial a cualquier hora del día, no solo ±30 min del horario', () => {
    for (const hora of ['06:00', '10:00', '16:00', '23:00']) {
      expect(canStartSession({ ...presencial, presencialTimeFrom: hora }, NOW)).toBe(true);
    }
  });

  test('la asíncrona de HOY se puede arrancar (no cambió)', () => {
    expect(canStartSession(asincrona, NOW)).toBe(true);
  });

  test('la misma regla para las dos modalidades, sin importar la hora', () => {
    for (const modalidad of [asincrona, presencial]) {
      expect(canStartSession(modalidad, NOW)).toBe(canStartSession({ ...modalidad }, NOW));
    }
  });

  test('otro día, deshabilitado en las dos modalidades', () => {
    expect(canStartSession({ ...asincrona, date: '2026-10-16' }, NOW)).toBe(false);
    expect(canStartSession({ ...presencial, date: '2026-10-16' }, NOW)).toBe(false);
  });

  test('ayer, deshabilitado (pasa al Registro de Sesión)', () => {
    expect(canStartSession({ ...asincrona, date: '2026-10-14' }, NOW)).toBe(false);
    expect(canStartSession({ ...presencial, date: '2026-10-14' }, NOW)).toBe(false);
  });

  // La presencial sin horario cargado no puede ser la excepción que rompe la
  // regla: la regla ya no mira el horario.
  test('presencial sin presencialTimeFrom, igual habilitada', () => {
    expect(canStartSession({ ...presencial, presencialTimeFrom: null }, NOW)).toBe(true);
  });

  test('descanso u otra actividad, deshabilitado', () => {
    expect(canStartSession({ kind: 'rest', isPresencial: false, date: HOY }, NOW)).toBe(false);
    expect(canStartSession({ kind: 'other', isPresencial: true, date: HOY, presencialTimeFrom: '10:00' }, NOW)).toBe(false);
  });

  test('sin asignación, false y sin romper', () => {
    expect(canStartSession(null, NOW)).toBe(false);
    expect(canStartSession(undefined, NOW)).toBe(false);
  });
});
