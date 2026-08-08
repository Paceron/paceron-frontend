import api from '../services/api.js';

const mockGetState = jest.fn(() => ({ token: null, refreshToken: null, refreshSession: jest.fn(), logout: jest.fn() }));

jest.mock('../store/auth-store.js', () => ({
  useAuthStore: { getState: (...args) => mockGetState(...args) },
}));

describe('api client error handling', () => {
  afterEach(() => { global.fetch = undefined; });

  test('throws backend message on error response', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 409,
      json: async () => ({ status_code: 409, code: 'CONFLICT', message: 'El email ya está registrado.' }),
    });

    await expect(api.post('/auth/register', {})).rejects.toMatchObject({
      message: 'El email ya está registrado.',
      status: 409,
    });
  });

  test('falls back to status message when body has no message', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => { throw new Error('no body'); },
    });

    await expect(api.get('/auth/user')).rejects.toMatchObject({
      message: 'Request failed with status 500',
      status: 500,
    });
  });

  test('falls back to status message when body has no message field', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 400,
      json: async () => ({ code: 'BAD_REQUEST' }),
    });

    await expect(api.get('/auth/user')).rejects.toMatchObject({
      message: 'Request failed with status 400',
      status: 400,
    });
  });
});

describe('api client 401 refresh interceptor', () => {
  afterEach(() => { global.fetch = undefined; });

  test('refreshes once on 401 and retries the original request with the new token', async () => {
    const refreshSession = jest.fn().mockImplementation(async () => {
      mockGetState.mockReturnValue({ token: 'new-token', refreshToken: 'new-refresh', refreshSession, logout: jest.fn() });
      return 'new-token';
    });
    mockGetState.mockReturnValue({ token: 'old-token', refreshToken: 'old-refresh', refreshSession, logout: jest.fn() });

    let call = 0;
    global.fetch = jest.fn().mockImplementation(async (_url, options) => {
      call += 1;
      if (call === 1) {
        expect(options.headers.Authorization).toBe('Bearer old-token');
        return { ok: false, status: 401, json: async () => ({ message: 'Token expirado.' }) };
      }
      expect(options.headers.Authorization).toBe('Bearer new-token');
      return { ok: true, status: 200, json: async () => ({ data: 'ok' }) };
    });

    const result = await api.get('/teams');
    expect(result).toEqual({ data: 'ok' });
    expect(refreshSession).toHaveBeenCalledTimes(1);
    expect(global.fetch).toHaveBeenCalledTimes(2);
  });

  test('logs out and propagates the original 401 when the refresh itself fails', async () => {
    const logout = jest.fn().mockResolvedValue();
    const refreshSession = jest.fn().mockRejectedValue(new Error('refresh token vencido'));
    mockGetState.mockReturnValue({ token: 'old-token', refreshToken: 'old-refresh', refreshSession, logout });

    global.fetch = jest.fn().mockResolvedValue({ ok: false, status: 401, json: async () => ({ message: 'Token expirado.' }) });

    await expect(api.get('/teams')).rejects.toMatchObject({ status: 401 });
    expect(logout).toHaveBeenCalledTimes(1);
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  test('two concurrent 401s share a single refresh call', async () => {
    let resolveRefresh;
    const refreshSession = jest.fn().mockImplementation(() => new Promise((resolve) => { resolveRefresh = resolve; }));
    mockGetState.mockReturnValue({ token: 'old-token', refreshToken: 'old-refresh', refreshSession, logout: jest.fn() });

    global.fetch = jest.fn().mockImplementation(async (_url, options) => {
      if (options.headers.Authorization === 'Bearer old-token') {
        return { ok: false, status: 401, json: async () => ({ message: 'Token expirado.' }) };
      }
      return { ok: true, status: 200, json: async () => ({ data: 'ok' }) };
    });

    const p1 = api.get('/teams');
    const p2 = api.get('/groups');
    // Deja que ambas requests iniciales lleguen al 401 y disparen el interceptor
    // antes de resolver el refresh — simula la carrera real entre 2 requests.
    await new Promise((resolve) => setTimeout(resolve, 0));
    mockGetState.mockReturnValue({ token: 'new-token', refreshToken: 'new-refresh', refreshSession, logout: jest.fn() });
    resolveRefresh({ access_token: 'new-token' });

    await Promise.all([p1, p2]);
    expect(refreshSession).toHaveBeenCalledTimes(1);
  });

  test('a 401 with no refresh token in the store passes through without attempting a refresh', async () => {
    // Cubre el caso de un 401 de credenciales inválidas en el login mismo
    // (donde todavía no hay refreshToken, porque el usuario no está
    // logueado) — no debe intentar refrescar ni loopear.
    const refreshSession = jest.fn();
    mockGetState.mockReturnValue({ token: null, refreshToken: null, refreshSession, logout: jest.fn() });
    global.fetch = jest.fn().mockResolvedValue({ ok: false, status: 401, json: async () => ({ message: 'Credenciales inválidas.' }) });

    await expect(api.post('/auth/login', {})).rejects.toMatchObject({ status: 401, message: 'Credenciales inválidas.' });
    expect(refreshSession).not.toHaveBeenCalled();
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  test('skipAuthRefresh opts a request out of the interceptor even with a valid refresh token', async () => {
    // Cubre POST /users/{id}/trainer-role: un 401 ahí es "contraseña
    // incorrecta" (negocio), no "sesión vencida" — aunque haya un
    // refreshToken válido en el store, no debe intentar refrescar.
    const refreshSession = jest.fn();
    mockGetState.mockReturnValue({ token: 'old-token', refreshToken: 'old-refresh', refreshSession, logout: jest.fn() });
    global.fetch = jest.fn().mockResolvedValue({ ok: false, status: 401, json: async () => ({ message: 'Contraseña incorrecta.' }) });

    await expect(api.post('/users/1/trainer-role', { password: 'wrong' }, { skipAuthRefresh: true }))
      .rejects.toMatchObject({ status: 401, message: 'Contraseña incorrecta.' });
    expect(refreshSession).not.toHaveBeenCalled();
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  test('api.patch also accepts skipAuthRefresh via its options param', async () => {
    // Cubre PATCH /users/{id}/password: mismo caso de negocio que
    // trainer-role de arriba, pero por PATCH.
    const refreshSession = jest.fn();
    mockGetState.mockReturnValue({ token: 'old-token', refreshToken: 'old-refresh', refreshSession, logout: jest.fn() });
    global.fetch = jest.fn().mockResolvedValue({ ok: false, status: 401, json: async () => ({ message: 'Contraseña actual incorrecta.' }) });

    await expect(api.patch('/users/1/password', { current_password: 'wrong' }, { skipAuthRefresh: true }))
      .rejects.toMatchObject({ status: 401, message: 'Contraseña actual incorrecta.' });
    expect(refreshSession).not.toHaveBeenCalled();
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });
});
