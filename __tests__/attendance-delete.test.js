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
