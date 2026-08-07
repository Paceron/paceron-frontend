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
  activateTrainerRole: jest.fn(),
  deactivateTrainerRole: jest.fn(),
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
import { assignRole, getPermissions, activateTrainerRole as activateTrainerRoleService, deactivateTrainerRole as deactivateTrainerRoleService } from '../services/roles.js';
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

  test('refreshSession rotates the token pair and persists the new session', async () => {
    useAuthStore.setState({
      user: { userId: 1 }, token: 'old-token', refreshToken: 'old-refresh', activeRole: 'runner', roles: [],
    });
    refreshService.mockResolvedValue({ access_token: 'new-token', refresh_token: 'new-refresh', expires_in: 3600 });
    const newToken = await useAuthStore.getState().refreshSession();
    expect(newToken).toBe('new-token');
    const s = useAuthStore.getState();
    expect(s.token).toBe('new-token');
    expect(s.refreshToken).toBe('new-refresh');
    expect(storage.setItem).toHaveBeenCalled();
  });

  test('refreshSession throws when there is no refresh token to use', async () => {
    useAuthStore.setState({ user: { userId: 1 }, token: 'old-token', refreshToken: null });
    await expect(useAuthStore.getState().refreshSession()).rejects.toThrow();
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

  test('activateTrainerRole calls the dedicated endpoint and refreshes the user + roles', async () => {
    useAuthStore.setState({ user: { userId: 1, name: 'Demo', surname: 'User' }, token: 'tok', roles: [] });
    activateTrainerRoleService.mockResolvedValue({ id: 1, user_id: 1, role_id: 2, status: 'active' });
    getUserService.mockResolvedValue({ user_id: 1, name: 'Demo', surname: 'User', bank_alias: 'mi.alias' });
    getPermissions.mockResolvedValue({
      user_id: 1,
      roles: [{ id: 2, name: 'entrenador', tier: 'base', permissions: [] }],
    });
    const result = await useAuthStore.getState().activateTrainerRole('mi.alias', 'mi-password');
    expect(result.success).toBe(true);
    expect(activateTrainerRoleService).toHaveBeenCalledWith(1, { password: 'mi-password', bankAlias: 'mi.alias' });
    expect(useAuthStore.getState().user.bankAlias).toBe('mi.alias');
    expect(useAuthStore.getState().roles.some((r) => r.name === 'entrenador')).toBe(true);
  });

  test('activateTrainerRole returns the backend error on failure (e.g. wrong password)', async () => {
    useAuthStore.setState({ user: { userId: 1 }, token: 'tok', roles: [] });
    activateTrainerRoleService.mockRejectedValue(Object.assign(new Error('Contraseña incorrecta.'), { status: 401 }));
    const result = await useAuthStore.getState().activateTrainerRole('mi.alias', 'wrong-password');
    expect(result).toEqual({ success: false, error: 'Contraseña incorrecta.' });
  });

  test('deactivateTrainerRole calls the dedicated endpoint', async () => {
    useAuthStore.setState({ user: { userId: 1 }, token: 'tok', activeRole: 'trainer', roles: [{ id: 2, name: 'entrenador', tier: 'base', permissions: [] }] });
    deactivateTrainerRoleService.mockResolvedValue({ message: 'ok' });
    getPermissions.mockResolvedValue({ user_id: 1, roles: [] });
    const result = await useAuthStore.getState().deactivateTrainerRole();
    expect(result.success).toBe(true);
    expect(deactivateTrainerRoleService).toHaveBeenCalledWith(1);
    expect(useAuthStore.getState().activeRole).toBe('runner');
  });

  test('deactivateTrainerRole surfaces the backend 409 message when the user leads active teams', async () => {
    useAuthStore.setState({ user: { userId: 1 }, token: 'tok', activeRole: 'trainer', roles: [] });
    deactivateTrainerRoleService.mockRejectedValue(Object.assign(new Error('No podés desactivar el rol mientras lideres equipos activos.'), { status: 409 }));
    const result = await useAuthStore.getState().deactivateTrainerRole();
    expect(result).toEqual({ success: false, error: 'No podés desactivar el rol mientras lideres equipos activos.' });
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
