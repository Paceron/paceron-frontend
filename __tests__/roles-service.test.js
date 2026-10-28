const env = { USE_MOCKS: false };

jest.mock('../config/env.js', () => env);
jest.mock('../services/api.js', () => ({
  __esModule: true,
  default: { post: jest.fn(async () => ({})) },
}));

import api from '../services/api.js';
import { activateTrainerRole } from '../services/roles.js';

describe('activateTrainerRole', () => {
  beforeEach(() => api.post.mockClear());

  test('envía únicamente la contraseña al activar el rol entrenador', async () => {
    await activateTrainerRole(7, { password: 'secret123' });

    expect(api.post).toHaveBeenCalledWith(
      '/users/7/trainer-role',
      { password: 'secret123' },
      { skipAuthRefresh: true },
    );
  });
});
