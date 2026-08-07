import { useAuthStore } from '../store/auth-store.js';

jest.mock('../services/auth.js', () => ({
  login: jest.fn(),
  register: jest.fn(),
  getUser: jest.fn(),
  refresh: jest.fn(),
  logout: jest.fn(),
}));

jest.mock('../services/roles.js', () => ({
  assignRole: jest.fn(),
  getPermissions: jest.fn(),
  getRoles: jest.fn(),
  getRoleIdByName: jest.fn(),
}));

jest.mock('../services/user.js', () => ({
  updateUser: jest.fn(),
  changeStatus: jest.fn(),
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

import { login as loginService, register as registerService, getUser as getUserService, refresh as refreshService, logout as logoutService } from '../services/auth.js';
import { assignRole, getPermissions } from '../services/roles.js';
import { updateUser as updateUserService } from '../services/user.js';
import * as storage from '../services/storage.js';

const LOGIN_OK = {
  access_token: 'tok', refresh_token: 'ref', expires_in: 3600,
  user: { user_id: 3, name: 'pepe', surname: 'lota', email: 'a@b.com', status: 'active' },
};

beforeEach(() => {
  // eslint-disable-next-line import/namespace -- __reset solo existe en el mock de jest.mock(), no en el módulo real
  storage.__reset();
  jest.clearAllMocks();
  getPermissions.mockResolvedValue({ user_id: 0, roles: [] });
  assignRole.mockResolvedValue({});
  logoutService.mockResolvedValue({ message: 'ok' });
  useAuthStore.setState({ user: null, token: null, refreshToken: null, expiresAt: null, hydrated: false, activeRole: 'runner', roles: [], rolesLoaded: false });
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
    useAuthStore.setState({ user: { userId: 1 }, token: 'abc', refreshToken: 'rt' });
    await storage.setItem('paceron.auth', 'x');
    await useAuthStore.getState().logout();
    const s = useAuthStore.getState();
    expect(s.user).toBeNull();
    expect(s.token).toBeNull();
    expect(storage.removeItem).toHaveBeenCalledWith('paceron.auth');
  });

  test('logout calls the revoke endpoint with the current refresh token', async () => {
    useAuthStore.setState({ user: { userId: 1 }, token: 'abc', refreshToken: 'rt-123' });
    await useAuthStore.getState().logout();
    expect(logoutService).toHaveBeenCalledWith('rt-123');
  });

  test('logout clears local state even if the revoke call fails', async () => {
    useAuthStore.setState({ user: { userId: 1 }, token: 'abc', refreshToken: 'rt-123' });
    logoutService.mockRejectedValueOnce(new Error('network down'));
    await useAuthStore.getState().logout();
    expect(useAuthStore.getState().user).toBeNull();
  });

  test('logout does not call the revoke endpoint when there is no refresh token', async () => {
    useAuthStore.setState({ user: { userId: 1 }, token: 'abc', refreshToken: null });
    await useAuthStore.getState().logout();
    expect(logoutService).not.toHaveBeenCalled();
  });
});

describe('role management (backend-backed)', () => {
  test('starts with no roles fetched', () => {
    const s = useAuthStore.getState();
    expect(s.roles).toEqual([]);
    expect(s.rolesLoaded).toBe(false);
  });

  test('fetchPermissions populates roles from the service', async () => {
    useAuthStore.setState({ user: { userId: 1 }, token: 'tok' });
    getPermissions.mockResolvedValue({
      user_id: 1,
      roles: [{ id: 1, name: 'corredor', tier: 'base', permissions: [] }],
    });
    await useAuthStore.getState().fetchPermissions();
    const s = useAuthStore.getState();
    expect(s.roles).toEqual([{ id: 1, name: 'corredor', tier: 'base', permissions: [] }]);
    expect(s.rolesLoaded).toBe(true);
  });

  test('activateTrainerRole assigns the role and updates the bank alias', async () => {
    useAuthStore.setState({ user: { userId: 1, name: 'Demo', surname: 'User' }, token: 'tok', roles: [] });
    assignRole.mockResolvedValue({});
    updateUserService.mockResolvedValue({
      user_id: 1, name: 'Demo', surname: 'User', bank_alias: 'mi.alias',
    });
    getPermissions.mockResolvedValue({
      user_id: 1,
      roles: [{ id: 2, name: 'entrenador', tier: 'base', permissions: [] }],
    });
    const result = await useAuthStore.getState().activateTrainerRole('mi.alias');
    expect(result.success).toBe(true);
    expect(assignRole).toHaveBeenCalledWith(1, 'entrenador');
    expect(updateUserService).toHaveBeenCalledWith(1, { bank_alias: 'mi.alias' }, undefined);
    expect(useAuthStore.getState().roles.some((r) => r.name === 'entrenador')).toBe(true);
  });

  test('switchRole only allows switching to a role the user actually has', async () => {
    useAuthStore.setState({ user: { userId: 1 }, token: 'tok', roles: [], activeRole: 'runner' });
    await useAuthStore.getState().switchRole();
    expect(useAuthStore.getState().activeRole).toBe('runner');

    useAuthStore.setState({ roles: [{ id: 2, name: 'entrenador', tier: 'base', permissions: [] }] });
    await useAuthStore.getState().switchRole();
    expect(useAuthStore.getState().activeRole).toBe('trainer');
  });

  test('fetchPermissions demotes a stale trainer activeRole back to runner when the real roles no longer include entrenador', async () => {
    // Reproduce el bug: activeRole quedó en 'trainer' persistido de una
    // sesión vieja, pero los roles reales (backend/mock) ya no incluyen
    // entrenador — sin la corrección, RoleBadge seguía mostrando el tag
    // "Entrenador" mientras profile-screen mostraba "Activar entrenador".
    useAuthStore.setState({ user: { userId: 1 }, token: 'tok', activeRole: 'trainer', roles: [] });
    getPermissions.mockResolvedValue({ user_id: 1, roles: [] });
    await useAuthStore.getState().fetchPermissions();
    expect(useAuthStore.getState().activeRole).toBe('runner');
  });

  test('fetchPermissions keeps activeRole trainer when the real roles still include entrenador', async () => {
    useAuthStore.setState({ user: { userId: 1 }, token: 'tok', activeRole: 'trainer', roles: [] });
    getPermissions.mockResolvedValue({ user_id: 1, roles: [{ id: 2, name: 'entrenador', tier: 'base', permissions: [] }] });
    await useAuthStore.getState().fetchPermissions();
    expect(useAuthStore.getState().activeRole).toBe('trainer');
  });

  test('logout resets roles state', async () => {
    useAuthStore.setState({
      user: { userId: 1 },
      token: 'tok',
      roles: [{ id: 2, name: 'entrenador', tier: 'base', permissions: [] }],
      rolesLoaded: true,
    });
    await useAuthStore.getState().logout();
    const s = useAuthStore.getState();
    expect(s.roles).toEqual([]);
    expect(s.rolesLoaded).toBe(false);
  });
});

describe('hydrate migration', () => {
  test('old persisted session without a roles key normalizes to empty array', async () => {
    await storage.setItem('paceron.auth', JSON.stringify({
      user: { userId: 9, email: 'x@y.com' },
      token: 'persisted',
      activeRole: 'runner',
      trainerActivated: true, // clave vieja — ya no existe en el store
    }));
    getPermissions.mockResolvedValue({ user_id: 9, roles: [] });
    await useAuthStore.getState().hydrate();
    const s = useAuthStore.getState();
    expect(s.roles).toEqual([]);
    expect(s.hydrated).toBe(true);
  });
});
