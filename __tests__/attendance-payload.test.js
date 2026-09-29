import { toAttendanceRate, toBulkAttendancePayload } from '../utils/attendance-payload.js';

describe('toBulkAttendancePayload', () => {
  // El body NO es { userIds } plano: los ids van anidados en entries, cada uno
  // como { user_id } (BulkSaveRequest en el backend). Este test es el que
  // protege la regresión.
  test('arma entries anidados, no userIds plano', () => {
    const payload = toBulkAttendancePayload({
      teamId: 1,
      trainingSessionId: 2,
      userIds: [10, 11],
    });

    expect(payload).toEqual({
      team_id: 1,
      training_session_id: 2,
      entries: [{ user_id: 10 }, { user_id: 11 }],
    });
    expect(payload.userIds).toBeUndefined();
    expect(payload.entries).toHaveLength(2);
  });

  test('los user_id salen como números, no como strings', () => {
    // El roster normalizado pasa userId con String() a propósito, y el backend
    // rechaza el body con "cuerpo de solicitud inválido" si user_id no es
    // numérico.
    const payload = toBulkAttendancePayload({
      teamId: '1',
      trainingSessionId: '2',
      userIds: ['10', 11, '12'],
    });

    payload.entries.forEach((entry) => expect(typeof entry.user_id).toBe('number'));
    expect(payload.entries.map((entry) => entry.user_id)).toEqual([10, 11, 12]);
    // El body serializado es lo que va por la red: tiene que tener 10, no "10".
    expect(JSON.parse(JSON.stringify(payload)).entries[0]).toEqual({ user_id: 10 });
  });

  test('un id no numérico se filtra en vez de volverse NaN', () => {
    const payload = toBulkAttendancePayload({
      teamId: 1,
      trainingSessionId: 2,
      userIds: ['10', 'abc', null, undefined, '', 'NaN', NaN, 11],
    });

    expect(payload.entries).toEqual([{ user_id: 10 }, { user_id: 11 }]);
    payload.entries.forEach((entry) => expect(Number.isNaN(entry.user_id)).toBe(false));
  });

  test('userIds vacío, ausente o no-array da entries vacío (no rompe)', () => {
    expect(toBulkAttendancePayload({ teamId: 1, trainingSessionId: 2, userIds: [] }).entries).toEqual([]);
    expect(toBulkAttendancePayload({ teamId: 1, trainingSessionId: 2 }).entries).toEqual([]);
    expect(toBulkAttendancePayload({ teamId: 1, trainingSessionId: 2, userIds: null }).entries).toEqual([]);
  });
});

describe('toAttendanceRate', () => {
  // Roster vacío (0 de 0) es un valor VERDADERO → 0. El spec lo fija
  // explícitamente y el backend lo manda así (buildAttendanceSummary arranca
  // en `rate := 0.0` y solo recalcula si RosterSize > 0). El null queda para
  // lo que de verdad no se sabe: que no venga summary, ni roster_size.
  test('roster vacío devuelve 0, no null (0 de 0 es un dato real)', () => {
    expect(toAttendanceRate({ roster_size: 0, attended: 0, attendance_rate_pct: 0 })).toBe(0);
    expect(toAttendanceRate({ roster_size: 0 })).toBe(0);
  });

  test('summary ausente o roster_size sin dato → null (no se sabe, no es 0)', () => {
    expect(toAttendanceRate({ roster_size: null, attended: 2, attendance_rate_pct: 50 })).toBeNull();
    expect(toAttendanceRate({ roster_size: undefined, attended: 2 })).toBeNull();
    expect(toAttendanceRate({ roster_size: '', attended: 2 })).toBeNull();
    expect(toAttendanceRate(null)).toBeNull();
    expect(toAttendanceRate(undefined)).toBeNull();
    expect(toAttendanceRate({})).toBeNull();
  });

  test('prefiere attendance_rate_pct del backend cuando viene', () => {
    expect(toAttendanceRate({ roster_size: 4, attended: 2, attendance_rate_pct: 50 })).toBe(50);
  });

  test('calcula el porcentaje como fallback cuando no viene attendance_rate_pct', () => {
    expect(toAttendanceRate({ roster_size: 4, attended: 2 })).toBe(50);
    expect(toAttendanceRate({ roster_size: 3, attended: 1 })).toBe(33.3);
  });

  test('redondea a un decimal, igual que el backend', () => {
    expect(toAttendanceRate({ roster_size: 7, attended: 2, attendance_rate_pct: 28.5714285 })).toBe(28.6);
    expect(toAttendanceRate({ roster_size: 3, attended: 1 })).toBe(33.3);
  });

  test('un 0 real (roster con corredores, ninguno %) sí es 0, no null', () => {
    expect(toAttendanceRate({ roster_size: 4, attended: 0, attendance_rate_pct: 0 })).toBe(0);
  });

  test('attendance_rate_pct ausente como null/\'\' no se toma como 0 (mismo bug de currency.js)', () => {
    expect(toAttendanceRate({ roster_size: 4, attended: 2, attendance_rate_pct: null })).toBe(50);
    expect(toAttendanceRate({ roster_size: 4, attended: 2, attendance_rate_pct: '' })).toBe(50);
  });

  test('sin attended ni attendance_rate_pct, no hay dato', () => {
    expect(toAttendanceRate({ roster_size: 4 })).toBeNull();
  });
});
