import { useAuthStore } from '../store/auth-store.js';

jest.mock('../services/auth.js', () => ({
  login: jest.fn(),
  register: jest.fn(),
  refresh: jest.fn(),
  logout: jest.fn(),
}));

jest.mock('../services/roles.js', () => ({
  assignRole: jest.fn(),
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

// theme-provider.jsx importa nativewind/expo-system-ui (RN puro, no
// transformable por Jest fuera de un componente) — se mockea igual que el
// resto de las dependencias de auth-store.js. El store solo llama a
// seedDefaultTheme() fire-and-forget; su comportamiento interno no es
// responsabilidad de estos tests (ver providers/theme-provider.jsx).
jest.mock('../providers/theme-provider.jsx', () => ({
  seedDefaultTheme: jest.fn(),
}));

// queryClient vive fuera de este store (lib/query-client.js) — auth-store.js
// solo lo usa para sembrar/limpiar el cache de perfil (login/logout) e
// invalidar permisos (register). El comportamiento real del cache es
// responsabilidad de hooks/use-user.js, no de estos tests.
jest.mock('../lib/query-client.js', () => ({
  queryClient: { clear: jest.fn(), setQueryData: jest.fn(), invalidateQueries: jest.fn() },
}));

import { login as loginService, register as registerService, refresh as refreshService, logout as logoutService } from '../services/auth.js';
import { assignRole } from '../services/roles.js';
import * as storage from '../services/storage.js';
import { queryClient } from '../lib/query-client.js';

const LOGIN_OK = {
  access_token: 'tok', refresh_token: 'ref', expires_in: 3600,
  user: { user_id: 3, name: 'pepe', surname: 'lota', email: 'a@b.com', status: 'active' },
};

beforeEach(() => {
  // eslint-disable-next-line import/namespace -- __reset solo existe en el mock de jest.mock(), no en el módulo real
  storage.__reset();
  jest.clearAllMocks();
  assignRole.mockResolvedValue({});
  logoutService.mockResolvedValue({ message: 'ok' });
  useAuthStore.setState({ token: null, refreshToken: null, expiresAt: null, hydrated: false, activeRole: 'runner', userId: null });
});

describe('auth store', () => {
  test('starts empty and not hydrated', () => {
    const s = useAuthStore.getState();
    expect(s.userId).toBeNull();
    expect(s.token).toBeNull();
    expect(s.hydrated).toBe(false);
  });

  test('login stores token + userId and persists, seeding the profile cache', async () => {
    loginService.mockResolvedValue(LOGIN_OK);
    const res = await useAuthStore.getState().login('a@b.com', 'pw');
    expect(res).toEqual({ success: true });
    const s = useAuthStore.getState();
    expect(s.userId).toBe(3);
    expect(s.token).toBe('tok');
    expect(s.refreshToken).toBe('ref');
    expect(storage.setItem).toHaveBeenCalled();
    expect(queryClient.setQueryData).toHaveBeenCalledWith(['user', 3], expect.objectContaining({ userId: 3, email: 'a@b.com' }));
  });

  test('login failure returns backend error message', async () => {
    loginService.mockRejectedValue(Object.assign(new Error('Credenciales inválidas.'), { status: 401 }));
    const res = await useAuthStore.getState().login('a@b.com', 'pw');
    expect(res).toEqual({ success: false, error: 'Credenciales inválidas.' });
    expect(useAuthStore.getState().token).toBeNull();
  });

  test('register auto-logins on success and invalidates permissions', async () => {
    registerService.mockResolvedValue({ user_id: 2, email: 'a@b.com', status: 'active' });
    loginService.mockResolvedValue(LOGIN_OK);
    const res = await useAuthStore.getState().register({ email: 'a@b.com', password: 'pw', name: 'pepe' });
    expect(res).toEqual({ success: true });
    expect(registerService).toHaveBeenCalledWith(expect.objectContaining({ email: 'a@b.com' }));
    expect(loginService).toHaveBeenCalledWith('a@b.com', 'pw');
    expect(useAuthStore.getState().token).toBe('tok');
    expect(assignRole).toHaveBeenCalledWith(3, 'corredor');
    expect(queryClient.invalidateQueries).toHaveBeenCalledWith({ queryKey: ['permissions', 3] });
  });

  test('register failure returns error and does not login', async () => {
    registerService.mockRejectedValue(Object.assign(new Error('El email ya está registrado.'), { status: 409 }));
    const res = await useAuthStore.getState().register({ email: 'a@b.com', password: 'pw' });
    expect(res).toEqual({ success: false, error: 'El email ya está registrado.' });
    expect(loginService).not.toHaveBeenCalled();
  });

  test('hydrate loads persisted session', async () => {
    await storage.setItem('paceron.auth', JSON.stringify({
      userId: 9, token: 'persisted', refreshToken: 'r', expiresAt: 1, activeRole: 'runner',
    }));
    await useAuthStore.getState().hydrate();
    const s = useAuthStore.getState();
    expect(s.token).toBe('persisted');
    expect(s.userId).toBe(9);
    expect(s.hydrated).toBe(true);
  });

  test('hydrate normalizes a missing userId to null instead of breaking', async () => {
    await storage.setItem('paceron.auth', JSON.stringify({ token: 'persisted', activeRole: 'runner' }));
    await useAuthStore.getState().hydrate();
    const s = useAuthStore.getState();
    expect(s.userId).toBeNull();
    expect(s.hydrated).toBe(true);
  });

  test('hydrate falls back to the nested user.userId from pre-migration sessions', async () => {
    // Toda sesión persistida por el store previo a esta migración tiene el
    // user_id anidado en `user`, no en la raíz — sin este fallback, todo
    // usuario ya logueado en producción pierde su sesión en el primer
    // hydrate() tras el deploy de esta rama.
    await storage.setItem('paceron.auth', JSON.stringify({
      user: { userId: 42, email: 'x@y.com' }, token: 'persisted', activeRole: 'runner',
    }));
    await useAuthStore.getState().hydrate();
    expect(useAuthStore.getState().userId).toBe(42);
  });

  test('logout clears state, storage and the profile cache', async () => {
    useAuthStore.setState({ userId: 1, token: 'abc', refreshToken: 'rt' });
    await storage.setItem('paceron.auth', 'x');
    await useAuthStore.getState().logout();
    const s = useAuthStore.getState();
    expect(s.userId).toBeNull();
    expect(s.token).toBeNull();
    expect(storage.removeItem).toHaveBeenCalledWith('paceron.auth');
    expect(queryClient.clear).toHaveBeenCalled();
  });

  test('logout calls the revoke endpoint with the current refresh token', async () => {
    useAuthStore.setState({ userId: 1, token: 'abc', refreshToken: 'rt-123' });
    await useAuthStore.getState().logout();
    expect(logoutService).toHaveBeenCalledWith('rt-123');
  });

  test('logout clears local state even if the revoke call fails', async () => {
    useAuthStore.setState({ userId: 1, token: 'abc', refreshToken: 'rt-123' });
    logoutService.mockRejectedValueOnce(new Error('network down'));
    await useAuthStore.getState().logout();
    expect(useAuthStore.getState().userId).toBeNull();
  });

  test('logout does not call the revoke endpoint when there is no refresh token', async () => {
    useAuthStore.setState({ userId: 1, token: 'abc', refreshToken: null });
    await useAuthStore.getState().logout();
    expect(logoutService).not.toHaveBeenCalled();
  });

  test('refreshSession rotates the token pair and persists the new session', async () => {
    useAuthStore.setState({ userId: 1, token: 'old-token', refreshToken: 'old-refresh', activeRole: 'runner' });
    refreshService.mockResolvedValue({ access_token: 'new-token', refresh_token: 'new-refresh', expires_in: 3600 });
    const newToken = await useAuthStore.getState().refreshSession();
    expect(newToken).toBe('new-token');
    const s = useAuthStore.getState();
    expect(s.token).toBe('new-token');
    expect(s.refreshToken).toBe('new-refresh');
    expect(storage.setItem).toHaveBeenCalled();
  });

  test('refreshSession throws when there is no refresh token to use', async () => {
    useAuthStore.setState({ userId: 1, token: 'old-token', refreshToken: null });
    await expect(useAuthStore.getState().refreshSession()).rejects.toThrow();
  });
});

describe('role switching (activeRole, local-only)', () => {
  test('switchRole toggles between runner and trainer and persists', async () => {
    useAuthStore.setState({ userId: 1, token: 'tok', activeRole: 'runner' });
    await useAuthStore.getState().switchRole();
    expect(useAuthStore.getState().activeRole).toBe('trainer');

    await useAuthStore.getState().switchRole();
    expect(useAuthStore.getState().activeRole).toBe('runner');
  });

  test('resetActiveRoleIfInvalid forces activeRole back to runner', () => {
    useAuthStore.setState({ userId: 1, token: 'tok', activeRole: 'trainer' });
    useAuthStore.getState().resetActiveRoleIfInvalid();
    expect(useAuthStore.getState().activeRole).toBe('runner');
  });
});
