import { useAuthStore } from '../store/auth-store.js';

jest.mock('../services/auth.js', () => ({
  login: jest.fn(),
  register: jest.fn(),
}));

jest.mock('../services/storage.js', () => {
  let store = {};
  return {
    getItem: jest.fn(async (k) => (k in store ? store[k] : null)),
    setItem: jest.fn(async (k, v) => { store[k] = v; }),
    removeItem: jest.fn(async (k) => { delete store[k]; }),
    __reset: () => { store = {}; },
  };
});

import { login as loginService, register as registerService } from '../services/auth.js';
import * as storage from '../services/storage.js';

const LOGIN_OK = {
  user: { user_id: 3, name: 'pepe', surname: 'lota', email: 'a@b.com', status: 'active' },
  authorization: { access_token: 'tok', refresh_token: 'ref', expires_in: 3600 },
};

beforeEach(() => {
  storage.__reset();
  jest.clearAllMocks();
  useAuthStore.setState({ user: null, token: null, refreshToken: null, expiresAt: null, hydrated: false, activeRole: 'runner', trainerActivated: false });
});

describe('auth store', () => {
  test('starts empty and not hydrated', () => {
    const s = useAuthStore.getState();
    expect(s.user).toBeNull();
    expect(s.token).toBeNull();
    expect(s.hydrated).toBe(false);
  });

  test('login stores normalized user + token and persists', async () => {
    loginService.mockResolvedValue(LOGIN_OK);
    const res = await useAuthStore.getState().login('a@b.com', 'pw');
    expect(res).toEqual({ success: true });
    const s = useAuthStore.getState();
    expect(s.user).toEqual(expect.objectContaining({ userId: 3, email: 'a@b.com' }));
    expect(s.token).toBe('tok');
    expect(s.refreshToken).toBe('ref');
    expect(storage.setItem).toHaveBeenCalled();
  });

  test('login failure returns backend error message', async () => {
    loginService.mockRejectedValue(Object.assign(new Error('Credenciales inválidas.'), { status: 401 }));
    const res = await useAuthStore.getState().login('a@b.com', 'pw');
    expect(res).toEqual({ success: false, error: 'Credenciales inválidas.' });
    expect(useAuthStore.getState().token).toBeNull();
  });

  test('register auto-logins on success', async () => {
    registerService.mockResolvedValue({ user_id: 2, email: 'a@b.com', status: 'active' });
    loginService.mockResolvedValue(LOGIN_OK);
    const res = await useAuthStore.getState().register({ email: 'a@b.com', password: 'pw', name: 'pepe' });
    expect(res).toEqual({ success: true });
    expect(registerService).toHaveBeenCalledWith(expect.objectContaining({ email: 'a@b.com' }));
    expect(loginService).toHaveBeenCalledWith('a@b.com', 'pw');
    expect(useAuthStore.getState().token).toBe('tok');
  });

  test('register failure returns error and does not login', async () => {
    registerService.mockRejectedValue(Object.assign(new Error('El email ya está registrado.'), { status: 409 }));
    const res = await useAuthStore.getState().register({ email: 'a@b.com', password: 'pw' });
    expect(res).toEqual({ success: false, error: 'El email ya está registrado.' });
    expect(loginService).not.toHaveBeenCalled();
  });

  test('hydrate loads persisted session', async () => {
    await storage.setItem('paceron.auth', JSON.stringify({
      user: { userId: 9, email: 'x@y.com' }, token: 'persisted', refreshToken: 'r', expiresAt: 1,
    }));
    await useAuthStore.getState().hydrate();
    const s = useAuthStore.getState();
    expect(s.token).toBe('persisted');
    expect(s.user).toEqual(expect.objectContaining({ userId: 9 }));
    expect(s.hydrated).toBe(true);
  });

  test('logout clears state and storage', async () => {
    useAuthStore.setState({ user: { userId: 1 }, token: 'abc' });
    await storage.setItem('paceron.auth', 'x');
    await useAuthStore.getState().logout();
    const s = useAuthStore.getState();
    expect(s.user).toBeNull();
    expect(s.token).toBeNull();
    expect(storage.removeItem).toHaveBeenCalledWith('paceron.auth');
  });
});

describe('role management (local-only)', () => {
  test('starts with default role state', () => {
    const s = useAuthStore.getState();
    expect(s.activeRole).toBe('runner');
    expect(s.trainerActivated).toBe(false);
  });

  test('activateTrainerProfile sets trainerActivated, keeps role as runner', async () => {
    useAuthStore.setState({ user: { userId: 1 }, token: 'tok' });
    await useAuthStore.getState().activateTrainerProfile();
    const s = useAuthStore.getState();
    expect(s.trainerActivated).toBe(true);
    expect(s.activeRole).toBe('runner');
    expect(storage.setItem).toHaveBeenCalled();
  });

  test('switchRole toggles activeRole only when trainerActivated', async () => {
    useAuthStore.setState({ user: { userId: 1 }, token: 'tok', trainerActivated: false, activeRole: 'runner' });
    await useAuthStore.getState().switchRole();
    expect(useAuthStore.getState().activeRole).toBe('runner');

    useAuthStore.setState({ trainerActivated: true });
    await useAuthStore.getState().switchRole();
    expect(useAuthStore.getState().activeRole).toBe('trainer');
    await useAuthStore.getState().switchRole();
    expect(useAuthStore.getState().activeRole).toBe('runner');
  });

  test('logout resets role state to defaults', async () => {
    useAuthStore.setState({ user: { userId: 1 }, token: 'tok', activeRole: 'trainer', trainerActivated: true });
    await useAuthStore.getState().logout();
    const s = useAuthStore.getState();
    expect(s.activeRole).toBe('runner');
    expect(s.trainerActivated).toBe(false);
  });
});
