import api from '../services/api.js';
import { deleteAttendance } from '../services/attendance.js';

jest.mock('../store/auth-store.js', () => ({
  useAuthStore: { getState: () => ({ token: null, refreshToken: null, refreshSession: jest.fn(), logout: jest.fn() }) },
}));

// USE_MOCKS en false para que la función vaya por `api.delete` y se pueda
// inspeccionar la URL real. El test anterior de check-in mocks USE_MOCKS para
// probar el mock; acá interesa el otro lado del `if`.
jest.mock('../config/env.js', () => ({
  USE_MOCKS: false,
  API_BASE_URL: 'https://api.test/api/v1',
  WEB_ORIGIN: 'https://web.test',
  FRONT_ENVIRONMENT: 'test',
}));

const mockDelete = jest.fn().mockResolvedValue(null);
jest.mock('../services/api.js', () => ({ __esModule: true, default: { delete: (...a) => mockDelete(...a) } }));

describe('deleteAttendance', () => {
  beforeEach(() => { mockDelete.mockClear(); });

  test('manda attendance_id en el path y team_id en el query', async () => {
    // El `team_id` NO es opcional aunque no haya ":team_id" en el path: es contra
    // ese equipo que el backend autoriza el borrado, y sin él no puede decidir
    // entre 403 y 404. Mandarlo como `undefined` degrada el error a algo que no
    // describe el problema real.
    await deleteAttendance(4321, 4);
    expect(mockDelete).toHaveBeenCalledWith('/attendance/4321?team_id=4');
  });

  // El bug de 2026-09-28: la pantalla llamaba `deleteAttendance(row.attendance_id)`
  // con un solo argumento y la fila seguía el evento del gesto, así que la URL
  // terminaba siendo `/attendance/undefined?team_id=undefined`.
  test('los dos argumentos llegan efectivamente en la URL', async () => {
    await deleteAttendance(99, 7);
    const url = mockDelete.mock.calls[0][0];
    expect(url).not.toContain('undefined');
    expect(url).toBe('/attendance/99?team_id=7');
  });
});

describe('deleteAttendance: guarda de argumentos', () => {
  beforeEach(() => { mockDelete.mockClear(); });

  // La clase de bug que se coló el 2026-09-28: un id que no llega al hook como
  // número produce `/attendance/undefined` y un 400 del backend que no dice que
  // el problema es del caller. Con la guarda, el fallo es local y dice qué pidió.
  test('rechaza undefined, null, string y no-enteros SIN pegarle al backend', async () => {
    for (const bad of [undefined, null, NaN, 0, -1, 1.5, '22', '', {}]) {
      await expect(deleteAttendance(bad, 29)).rejects.toThrow(/attendance_id inválido/);
    }
    expect(mockDelete).not.toHaveBeenCalled();
  });

  test('el mensaje nombra el valor recibido y qué espera', async () => {
    await expect(deleteAttendance(undefined, 29)).rejects.toThrow(/undefined/);
    await expect(deleteAttendance(undefined, 29)).rejects.toThrow(/id numérico/);
  });

  // El id de la grilla llega como número del JSON del backend, así que se exige
  // entero positivo y no se castea nada: un string acá es el síntoma de que el
  // caller está leyendo el campo equivocado, que es justo el bug que se busca.
  test('un id numérico válido pasa y sale en la URL', async () => {
    await deleteAttendance(22, 29);
    expect(mockDelete).toHaveBeenCalledWith('/attendance/22?team_id=29');
  });
});
