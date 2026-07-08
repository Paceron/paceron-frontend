import api from '../services/api.js';

jest.mock('../store/auth-store.js', () => ({
  useAuthStore: { getState: () => ({ token: null }) },
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
});
