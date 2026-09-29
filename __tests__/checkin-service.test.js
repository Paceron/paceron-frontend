import { getSessionAttendance, registerCheckin } from '../services/attendance.js';
import { __resetAttendanceMock } from '../services/__mocks__/attendance-mock.js';

// `services/attendance.js` arrastra `api.js` → `auth-store.js` → `storage.js`
// (SecureStore, que es nativo). Se mockea el auth store igual que en
// api-client.test.js, que es el precedente del repo para probar services.
//
// Y el config, porque `USE_MOCKS` sale de `EXPO_PUBLIC_USE_MOCKS` y en el
// entorno de test no está seteado: sin esto el service se va a la API real y la
// request queda colgada hasta el timeout. Mockear el módulo (y no asignar
// process.env) es lo que funciona, porque `jest.mock` se hoistea por encima de
// los imports y una asignación a process.env no.
jest.mock('../config/env.js', () => ({
  USE_MOCKS: true,
  API_BASE_URL: 'https://api.test/api/v1',
  WEB_ORIGIN: 'https://web.test',
  FRONT_ENVIRONMENT: 'test',
}));

jest.mock('../store/auth-store.js', () => ({
  useAuthStore: { getState: () => ({ token: null, refreshToken: null, refreshSession: jest.fn(), logout: jest.fn() }) },
}));

const TEAM = 4;
const SESSION = 503; // una sesión sin asistencias sembradas, para el 201 limpio

beforeEach(() => { __resetAttendanceMock(); });

describe('registro del corredor (mock)', () => {
  test('201 cuando la asistencia se registra por primera vez', async () => {
    const r = await registerCheckin({ teamId: TEAM, sessionInstanceId: SESSION });
    expect(r).toEqual({ message: 'asistencia registrada' });
  });

  // El 200 NO es un error: es el caso idempotente. La pantalla lo pinta con check
  // verde (D7) y no con X, porque la asistencia quedó registrada igual.
  test('200 con el mensaje de "ya registrada" en el segundo intento', async () => {
    await registerCheckin({ teamId: TEAM, sessionInstanceId: SESSION });
    const r = await registerCheckin({ teamId: TEAM, sessionInstanceId: SESSION });
    expect(r).toEqual({ message: 'esta asistencia fue previamente registrada' });
  });

  test('403 cuando el corredor no es del equipo', async () => {
    await expect(registerCheckin({ teamId: 99, sessionInstanceId: SESSION }))
      .rejects.toMatchObject({ status: 403 });
  });

  test('404 cuando la sesión no existe', async () => {
    await expect(registerCheckin({ teamId: TEAM, sessionInstanceId: 9999 }))
      .rejects.toMatchObject({ status: 404 });
  });

  test('el registro queda persistido: el summary de la grilla lo cuenta', async () => {
    await registerCheckin({ teamId: TEAM, sessionInstanceId: SESSION });
    const grid = await getSessionAttendance(SESSION, TEAM, 4);
    expect(grid.summary.attended).toBe(1);
    expect(grid.roster.find((r) => r.user_id === 101)?.status).toBe('attended');
  });
});
