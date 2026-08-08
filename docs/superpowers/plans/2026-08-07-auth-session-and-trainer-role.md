# Auth Session Lifecycle + Trainer Role Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Adapt the frontend to the backend's new auth middleware: a flat login response shape, a real refresh/logout token lifecycle, and a redesigned trainer-role activation/deactivation flow with password confirmation and a new active-teams block rule.

**Architecture:** `services/api.js` gains a reactive 401 interceptor that calls a new `refreshSession()` store action (deduped across concurrent requests) before retrying the original request once; `store/auth-store.js#logout` calls a new backend revoke endpoint (best-effort) before clearing local state; trainer-role activation/deactivation move from a 2-step generic-role flow to 2 new dedicated service functions, with a new password-confirmation modal in the activation UI.

**Tech Stack:** React Native + React Native Web, Zustand, Jest (no component render tests — project convention).

## Global Constraints

- Refresh strategy: **reactive on 401**, not proactive/timer-based (decided in spec).
- Concurrent 401s share a single in-flight refresh promise — never trigger more than one refresh at a time.
- Logout calls the backend revoke endpoint **best-effort** (same pattern as the existing `persist()` — failure never blocks the local logout).
- The 409 "leading active teams" error on trainer deactivation is shown via the **existing generic error toast, using the backend's message verbatim** — no new UI, no custom message.
- The bank alias field in `activate-trainer-screen.jsx` stays **exactly as it is today** (always required, prefilled if the user has one) — the activation payload **always** sends `bank_alias`, never omits it.
- Password travels as a plain string in the request body over HTTPS — same pattern `login()` already uses. No client-side hashing.
- No component render tests (project convention) — the new password modal is verified manually in preview, not with Jest.
- Every `View`/`Text`/`Pressable`/`Modal`/`TextInput` needs a unique `nativeID` + `testID` (ESLint rule `local/require-native-id`, no exceptions).
- The 'corredor' role keeps using the existing generic role endpoints (`assignRole`/`removeRole`) — this plan only touches 'entrenador'.

---

### Task 1: Flatten the login response shape

**Files:**
- Modify: `services/__mocks__/auth-mock.js` (`mockLogin`)
- Modify: `store/auth-store.js:61-80` (`login` action)
- Test: `__tests__/auth-mock.test.js`, `__tests__/auth-store.test.js`

**Interfaces:**
- Consumes: nothing new.
- Produces: `login()`'s success path now reads `result.access_token` / `result.refresh_token` / `result.expires_in` / `result.user` (flat), not `result.authorization.access_token`. Later tasks (2-6) build on this same flat shape for `refresh`/`logout`/trainer-role calls.

- [ ] **Step 1: Update the failing test fixtures first**

In `__tests__/auth-mock.test.js`, replace the `mockLogin` assertions:

```js
import { mockLogin, mockRegister } from '../services/__mocks__/auth-mock.js';

describe('auth mock adapter', () => {
  test('mockLogin returns login response shape', async () => {
    const res = await mockLogin('a@b.com', 'pw');
    expect(res.user).toEqual(expect.objectContaining({ email: 'a@b.com', status: 'active' }));
    expect(res.access_token).toEqual(expect.any(String));
    expect(res.refresh_token).toEqual(expect.any(String));
    expect(res.expires_in).toEqual(expect.any(Number));
  });

  test('mockRegister echoes payload without a token', async () => {
    const res = await mockRegister({ name: 'pepe', surname: 'lota', email: 'a@b.com', dni: '1', birth_date: '01/01/1988' });
    expect(res).toEqual(expect.objectContaining({ name: 'pepe', email: 'a@b.com', status: 'active' }));
    expect(res).not.toHaveProperty('access_token');
  });
});
```

In `__tests__/auth-store.test.js`, replace the `LOGIN_OK` fixture near the top:

```js
const LOGIN_OK = {
  access_token: 'tok', refresh_token: 'ref', expires_in: 3600,
  user: { user_id: 3, name: 'pepe', surname: 'lota', email: 'a@b.com', status: 'active' },
};
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx jest auth-mock.test.js auth-store.test.js`
Expected: FAIL — `mockLogin` still returns the nested `authorization` shape, `login` action still reads `result.authorization.access_token` (undefined against the new flat fixture).

- [ ] **Step 3: Flatten `mockLogin` in `services/__mocks__/auth-mock.js`**

Replace the `mockLogin` function:

```js
export async function mockLogin(email, _password) {
  return {
    access_token: 'mock-access-token',
    refresh_token: 'mock-refresh-token',
    expires_in: 3600,
    user: {
      user_id: 1,
      name: 'Demo',
      surname: 'User',
      email,
      dni: '12345678',
      birth_date: '01/01/1990',
      status: 'active',
      bank_alias: null,
    },
  };
}
```

- [ ] **Step 4: Update `login` in `store/auth-store.js`**

Replace the `login` action body:

```js
  login: async (email, password) => {
    try {
      const result = await loginService(email, password);
      const token = result?.access_token;
      const user = toUserModel(result?.user);
      if (token && user) {
        const expiresAt = result.expires_in ? Date.now() + result.expires_in * 1000 : null;
        const session = { user, token, refreshToken: result.refresh_token ?? null, expiresAt };
        set(session);
        const { activeRole } = get();
        await persist({ ...session, activeRole, roles: [] });
        await get().fetchPermissions();
        return { success: true };
      }
      return { success: false, error: 'Credenciales incorrectas.' };
    } catch (error) {
      return { success: false, error: error.message };
    }
  },
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx jest auth-mock.test.js auth-store.test.js`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add services/__mocks__/auth-mock.js store/auth-store.js __tests__/auth-mock.test.js __tests__/auth-store.test.js
git commit -m "fix(auth): flatten login response shape to match new backend contract"
```

---

### Task 2: Add refresh/logout to the auth service

**Files:**
- Modify: `services/auth.js`
- Modify: `services/__mocks__/auth-mock.js` (add `mockRefresh`, `mockLogout`)
- Test: `__tests__/auth-mock.test.js`

**Interfaces:**
- Consumes: nothing new (independent of Task 1's shape change, but lands after it for a clean sequential diff).
- Produces: `refresh(refreshToken)` → `POST /auth/refresh`, resolves `{access_token, refresh_token, expires_in}`. `logout(refreshToken)` → `POST /auth/logout`, resolves `{message}`. Task 3 and Task 4 import both.

- [ ] **Step 1: Write the failing tests**

Append to `__tests__/auth-mock.test.js`:

```js
import { mockLogin, mockRegister, mockRefresh, mockLogout } from '../services/__mocks__/auth-mock.js';

// ...(mockLogin/mockRegister describe block unchanged from Task 1)...

describe('mockRefresh', () => {
  test('returns a new access/refresh token pair', async () => {
    const res = await mockRefresh('some-refresh-token');
    expect(res.access_token).toEqual(expect.any(String));
    expect(res.refresh_token).toEqual(expect.any(String));
    expect(res.expires_in).toEqual(expect.any(Number));
  });
});

describe('mockLogout', () => {
  test('returns a confirmation message', async () => {
    const res = await mockLogout('some-refresh-token');
    expect(res).toEqual(expect.objectContaining({ message: expect.any(String) }));
  });
});
```

(Update the top `import` line to include `mockRefresh, mockLogout` alongside the existing `mockLogin, mockRegister`.)

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx jest auth-mock.test.js`
Expected: FAIL — `mockRefresh`/`mockLogout` are not exported yet.

- [ ] **Step 3: Add `mockRefresh`/`mockLogout` to `services/__mocks__/auth-mock.js`**

Append to the file:

```js
export async function mockRefresh(_refreshToken) {
  return {
    access_token: 'mock-access-token-refreshed',
    refresh_token: 'mock-refresh-token-refreshed',
    expires_in: 3600,
  };
}

export async function mockLogout(_refreshToken) {
  return { message: 'Sesión cerrada.' };
}
```

- [ ] **Step 4: Add `refresh`/`logout` to `services/auth.js`**

Update the import line and append the 2 new functions:

```js
import api from './api.js';
import { USE_MOCKS } from '../config/env.js';
import { mockLogin, mockRegister, mockGetUser, mockRefresh, mockLogout } from './__mocks__/auth-mock.js';

// ...(login/register/getUser unchanged)...

// POST /api/v1/auth/refresh — auth.RefreshRequest {refresh_token} →
// auth.RefreshResponse {access_token, refresh_token, expires_in}. Rota el
// refresh token: el que se manda queda revocado, el que vuelve es el
// vigente a partir de ahora.
export async function refresh(refreshToken) {
  if (USE_MOCKS) return await mockRefresh(refreshToken);
  return await api.post('/auth/refresh', { refresh_token: refreshToken });
}

// POST /api/v1/auth/logout — auth.LogoutRequest {refresh_token}. Revoca el
// refresh token; el access token sigue válido hasta su expiración natural
// (según el swagger), no hay forma de invalidarlo antes desde el cliente.
export async function logout(refreshToken) {
  if (USE_MOCKS) return await mockLogout(refreshToken);
  return await api.post('/auth/logout', { refresh_token: refreshToken });
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx jest auth-mock.test.js`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add services/auth.js services/__mocks__/auth-mock.js __tests__/auth-mock.test.js
git commit -m "feat(auth): add refresh/logout service functions"
```

---

### Task 3: Wire `logout()` to revoke the refresh token

**Files:**
- Modify: `store/auth-store.js` (import line + `logout` action)
- Test: `__tests__/auth-store.test.js`

**Interfaces:**
- Consumes: `logout(refreshToken)` from Task 2's `services/auth.js`.
- Produces: `logout()` still has the exact same signature and local-clearing behavior callers already rely on — this task only adds a best-effort side call before the existing clear.

- [ ] **Step 1: Write the failing test**

In `__tests__/auth-store.test.js`, update the `services/auth.js` mock factory to include `logout` and `refresh` (needed by this and later tasks):

```js
jest.mock('../services/auth.js', () => ({
  login: jest.fn(),
  register: jest.fn(),
  getUser: jest.fn(),
  refresh: jest.fn(),
  logout: jest.fn(),
}));
```

Update the import line right below it:

```js
import { login as loginService, register as registerService, getUser as getUserService, refresh as refreshService, logout as logoutService } from '../services/auth.js';
```

In `beforeEach`, add a default resolved value so existing tests that call `logout()` don't hit an unmocked rejection:

```js
logoutService.mockResolvedValue({ message: 'ok' });
```

Replace the existing `'logout clears state and storage'` test and add a new one for the revoke call:

```js
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx jest auth-store.test.js`
Expected: FAIL — `logoutService` (the mock) is never called, since `logout()` doesn't call it yet.

- [ ] **Step 3: Update `logout` in `store/auth-store.js`**

```js
  logout: async () => {
    const { refreshToken } = get();
    try {
      if (refreshToken) await logoutService(refreshToken);
    } catch {
      // best-effort — igual que persist(), el logout local sigue aunque
      // esto falle (sin red, refresh token ya vencido, etc.)
    }
    set({
      user: null,
      token: null,
      refreshToken: null,
      expiresAt: null,
      activeRole: 'runner',
      roles: [],
      rolesLoaded: false,
    });
    await removeItem(STORAGE_KEY);
  },
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx jest auth-store.test.js`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add store/auth-store.js __tests__/auth-store.test.js
git commit -m "feat(auth): revoke the refresh token server-side on logout"
```

---

### Task 4: Reactive 401 refresh in the API client

**Files:**
- Modify: `store/auth-store.js` (add `refreshSession` action)
- Modify: `services/api.js` (401 interceptor + in-flight-refresh dedup)
- Test: `__tests__/auth-store.test.js`, `__tests__/api-client.test.js`

**Interfaces:**
- Consumes: `refresh(refreshToken)` from Task 2.
- Produces: `useAuthStore.getState().refreshSession()` — no args, returns the new access token as a string, throws if there's no refresh token or the backend call fails. `services/api.js`'s exported `get`/`post`/`put`/`patch`/`delete` keep their exact existing signatures — no caller anywhere in the app needs to change.

- [ ] **Step 1: Write the failing test for `refreshSession`**

Append to the `describe('auth store', ...)` block in `__tests__/auth-store.test.js`:

```js
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest auth-store.test.js -t refreshSession`
Expected: FAIL — `refreshSession` is not a function yet.

- [ ] **Step 3: Add `refreshSession` to `store/auth-store.js`**

Add it right after the `logout` action:

```js
  // Rota el refresh token (POST /auth/refresh) y persiste el par nuevo.
  // Usado por services/api.js cuando una request pega 401 — ver ahí el
  // interceptor que llama a esto antes de reintentar.
  refreshSession: async () => {
    const { refreshToken, user, activeRole, roles } = get();
    if (!refreshToken) throw new Error('No hay refresh token disponible.');
    const result = await refreshService(refreshToken);
    const expiresAt = result.expires_in ? Date.now() + result.expires_in * 1000 : null;
    set({ token: result.access_token, refreshToken: result.refresh_token, expiresAt });
    await persist({ user, token: result.access_token, refreshToken: result.refresh_token, expiresAt, activeRole, roles });
    return result.access_token;
  },
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest auth-store.test.js -t refreshSession`
Expected: PASS

- [ ] **Step 5: Write the failing tests for the API client interceptor**

Replace the top of `__tests__/api-client.test.js` (the `jest.mock` block and imports) with a configurable mock:

```js
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
});
```

- [ ] **Step 6: Run tests to verify they fail**

Run: `npx jest api-client.test.js`
Expected: FAIL — `services/api.js` doesn't intercept 401 yet, so the retry never happens and `refreshSession`/`logout` are never called.

- [ ] **Step 7: Rewrite `services/api.js`**

```js
import { API_BASE_URL } from '../config/env.js';
import { useAuthStore } from '../store/auth-store.js';

function buildUrl(path) {
  if (/^https?:\/\//i.test(path)) {
    return path;
  }

  return `${API_BASE_URL}${path}`;
}

// Refresh en curso compartido entre requests concurrentes — si varias
// pegan 401 al mismo tiempo, todas esperan este mismo refresh en vez de
// disparar uno cada una.
let refreshPromise = null;

async function request(path, { _isRetry, ...fetchOptions } = {}) {
  const { token } = useAuthStore.getState();
  const headers = {
    'Content-Type': 'application/json',
    ...(fetchOptions.headers || {}),
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(buildUrl(path), {
    ...fetchOptions,
    headers,
  });

  if (response.status === 401 && !_isRetry && useAuthStore.getState().refreshToken) {
    try {
      if (!refreshPromise) {
        refreshPromise = useAuthStore.getState().refreshSession().finally(() => {
          refreshPromise = null;
        });
      }
      await refreshPromise;
      return await request(path, { ...fetchOptions, _isRetry: true });
    } catch {
      await useAuthStore.getState().logout();
      // sigue abajo y deja que la response 401 original se maneje como
      // cualquier otro error — el caller original ve el fallo, no queda colgado
    }
  }

  if (!response.ok) {
    let message = `Request failed with status ${response.status}`;
    try {
      const body = await response.json();
      if (body?.message) message = body.message;
    } catch {
      // sin cuerpo JSON — se usa el mensaje por defecto
    }
    const error = new Error(message);
    error.status = response.status;
    throw error;
  }
  if (response.status === 204) {
    return null;
  }
  return response.json();
}

export default {
  get: async (path) => await request(path, { method: 'GET' }),
  post: async (path, body) => await request(path, { method: 'POST', body: JSON.stringify(body) }),
  put: async (path, body, headers) => await request(path, { method: 'PUT', body: JSON.stringify(body), headers }),
  patch: async (path, body, headers) => await request(path, { method: 'PATCH', body: JSON.stringify(body), headers }),
  delete: async (path) => await request(path, { method: 'DELETE' }),
};
```

- [ ] **Step 8: Run tests to verify they pass**

Run: `npx jest api-client.test.js auth-store.test.js`
Expected: PASS

- [ ] **Step 9: Run the full suite to confirm no other test depends on the old `services/api.js` internals**

Run: `npm test`
Expected: all suites PASS (this file is imported by every other service — `services/teams.js`, `services/groups.js`, etc. — none of them call `request` directly or rely on its internals, only on the exported `get`/`post`/`put`/`patch`/`delete`, so this should be a no-op for them).

- [ ] **Step 10: Commit**

```bash
git add store/auth-store.js services/api.js __tests__/auth-store.test.js __tests__/api-client.test.js
git commit -m "feat(auth): reactive 401 refresh interceptor with concurrent-request dedup"
```

---

### Task 5: Dedicated trainer-role service endpoints

**Files:**
- Modify: `services/roles.js`
- Modify: `services/__mocks__/roles-mock.js`
- Create: `__tests__/roles-mock.test.js`

**Interfaces:**
- Consumes: nothing new.
- Produces: `activateTrainerRole(userId, {password, bankAlias})` → `POST /users/{id}/trainer-role`, resolves the `UserRoleResponse`. `deactivateTrainerRole(userId)` → `DELETE /users/{id}/trainer-role`, resolves `{message}` or throws with `error.status === 409` when the user leads active teams. Task 6 imports both (renamed on import, same pattern as the rest of the codebase — e.g. `activateTrainerRole as activateTrainerRoleService`).

- [ ] **Step 1: Write the failing tests**

Create `__tests__/roles-mock.test.js`:

```js
import {
  mockActivateTrainerRole, mockDeactivateTrainerRole, __resetMockRoles,
} from '../services/__mocks__/roles-mock.js';

beforeEach(() => {
  __resetMockRoles();
});

describe('mockActivateTrainerRole', () => {
  test('activates the role when a password is provided', async () => {
    const res = await mockActivateTrainerRole(1, { password: 'secret123', bankAlias: 'mi.alias' });
    expect(res).toEqual(expect.objectContaining({ user_id: 1, role_id: 2, status: 'active' }));
  });

  test('rejects when no password is provided', async () => {
    await expect(mockActivateTrainerRole(1, { password: '', bankAlias: 'mi.alias' }))
      .rejects.toMatchObject({ status: 400 });
  });
});

describe('mockDeactivateTrainerRole', () => {
  test('deactivates a previously activated role', async () => {
    await mockActivateTrainerRole(1, { password: 'secret123', bankAlias: 'mi.alias' });
    const res = await mockDeactivateTrainerRole(1);
    expect(res).toEqual(expect.objectContaining({ message: expect.any(String) }));
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest roles-mock.test.js`
Expected: FAIL — `mockActivateTrainerRole`/`mockDeactivateTrainerRole` are not exported yet.

- [ ] **Step 3: Add the 2 mock functions to `services/__mocks__/roles-mock.js`**

Append to the file (before `__resetMockRoles`):

```js
// POST /users/{id}/trainer-role — a diferencia de mockAssignRole (genérico,
// sin password), este simula la validación de contraseña que el endpoint
// real exige.
export async function mockActivateTrainerRole(userId, { password, bankAlias }) {
  if (!password) {
    const error = new Error('La contraseña es requerida.');
    error.status = 400;
    throw error;
  }
  if (!mockAssignedRoles.includes('entrenador')) {
    mockAssignedRoles.push('entrenador');
  }
  return {
    id: 1, user_id: userId, role_id: 2, tier_id: 1, status: 'active', assignment_date: new Date().toISOString(),
  };
}

// DELETE /users/{id}/trainer-role — el mock no simula el bloqueo por
// "lidera equipos activos" (409): no hay estado de equipos en este mock,
// se agrega si algún test lo llega a necesitar.
export async function mockDeactivateTrainerRole(_userId) {
  mockAssignedRoles = mockAssignedRoles.filter((name) => name !== 'entrenador');
  return { message: 'Rol entrenador desactivado.' };
}
```

- [ ] **Step 4: Add the 2 functions to `services/roles.js`**

Update the import line and append at the end of the file:

```js
import api from './api.js';
import { USE_MOCKS } from '../config/env.js';
import {
  mockGetRoles, mockAssignRole, mockRemoveRole, mockGetPermissions,
  mockActivateTrainerRole, mockDeactivateTrainerRole,
} from './__mocks__/roles-mock.js';

// ...(getRoles/getRoleIdByName/assignRole/removeRole/getPermissions unchanged)...

// POST /api/v1/users/{id}/trainer-role — userrole.ActivateEntrenadorRequest
// {password, bank_alias}. Endpoint dedicado para el rol entrenador
// específicamente (valida contraseña, persiste el alias en 1 sola
// llamada) — reemplaza el flujo genérico (assignRole + updateUser) que
// usaba antes. 'corredor' sigue usando el flujo genérico sin cambios.
export async function activateTrainerRole(userId, { password, bankAlias }) {
  if (USE_MOCKS) return await mockActivateTrainerRole(userId, { password, bankAlias });
  return await api.post(`/users/${userId}/trainer-role`, { password, bank_alias: bankAlias });
}

// DELETE /api/v1/users/{id}/trainer-role — a diferencia del DELETE
// genérico de roles, este bloquea con 409 si el usuario lidera equipos
// activos (regla de negocio nueva del lado del backend).
export async function deactivateTrainerRole(userId) {
  if (USE_MOCKS) return await mockDeactivateTrainerRole(userId);
  return await api.delete(`/users/${userId}/trainer-role`);
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx jest roles-mock.test.js`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add services/roles.js services/__mocks__/roles-mock.js __tests__/roles-mock.test.js
git commit -m "feat(roles): add dedicated trainer-role activation/deactivation endpoints"
```

---

### Task 6: Rewire trainer-role activation/deactivation in the store

**Files:**
- Modify: `store/auth-store.js` (import line, `activateTrainerRole`, `deactivateTrainerRole`)
- Test: `__tests__/auth-store.test.js`

**Interfaces:**
- Consumes: `activateTrainerRole(userId, {password, bankAlias})` / `deactivateTrainerRole(userId)` from Task 5's `services/roles.js`.
- Produces: `useAuthStore.getState().activateTrainerRole(bankAlias, password)` — signature gains a required second `password` argument (was `activateTrainerRole(bankAlias)`). Task 7's UI passes both. `deactivateTrainerRole()` keeps its existing no-arg signature.

- [ ] **Step 1: Write the failing tests**

In `__tests__/auth-store.test.js`, update the `services/roles.js` mock factory:

```js
jest.mock('../services/roles.js', () => ({
  assignRole: jest.fn(),
  getPermissions: jest.fn(),
  getRoles: jest.fn(),
  getRoleIdByName: jest.fn(),
  activateTrainerRole: jest.fn(),
  deactivateTrainerRole: jest.fn(),
}));
```

Update the import line below it:

```js
import {
  assignRole, getPermissions, activateTrainerRole as activateTrainerRoleService,
  deactivateTrainerRole as deactivateTrainerRoleService,
} from '../services/roles.js';
```

Replace the existing `'activateTrainerRole assigns the role and updates the bank alias'` test with:

```js
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
```

Delete the old `'activateTrainerRole assigns the role and updates the bank alias'` test (it asserted the 2-step `assignRole`+`updateUser` flow this task replaces).

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx jest auth-store.test.js -t "TrainerRole"`
Expected: FAIL — `activateTrainerRole` still takes 1 arg and calls `assignRole`/`updateUser`; `deactivateTrainerRole` still calls the generic `removeRole`.

- [ ] **Step 3: Rewrite `activateTrainerRole`/`deactivateTrainerRole` in `store/auth-store.js`**

```js
  // Activa el rol entrenador — 1 sola llamada al endpoint dedicado (valida
  // contraseña, persiste el alias). La respuesta (UserRoleResponse) no
  // trae el perfil actualizado, así que se encadena refreshUser() para
  // traer el bank_alias real guardado por el backend.
  activateTrainerRole: async (bankAlias, password) => {
    const { user } = get();
    if (!user?.userId) return { success: false, error: 'No hay sesión activa.' };
    try {
      await activateTrainerRoleService(user.userId, { password, bankAlias });
      await get().refreshUser();
      await get().fetchPermissions();
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  },

  // Da de baja el rol entrenador vía el endpoint dedicado — a diferencia
  // del DELETE genérico de roles, este bloquea con 409 si el usuario
  // lidera equipos activos. El caller muestra ese mensaje tal cual (ver
  // profile-screen.jsx), sin caso especial acá. bank_alias NO se toca a
  // propósito — se mantiene guardado por si el usuario reactiva el perfil
  // más adelante (ver activate-trainer-screen.jsx, que lo pre-completa en
  // ese caso).
  deactivateTrainerRole: async () => {
    const { user, activeRole } = get();
    if (!user?.userId) return { success: false, error: 'No hay sesión activa.' };
    try {
      await deactivateTrainerRoleService(user.userId);
      if (activeRole === 'trainer') {
        const { token, refreshToken, expiresAt, roles } = get();
        set({ activeRole: 'runner' });
        await persist({ user, token, refreshToken, expiresAt, activeRole: 'runner', roles });
      }
      await get().fetchPermissions();
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  },
```

Update the top import line for `services/roles.js` (removes the now-unused `removeRole` import — `assignRole` stays, it's still used by `register()`'s corredor auto-assign):

```js
import { assignRole as assignRoleService, activateTrainerRole as activateTrainerRoleService, deactivateTrainerRole as deactivateTrainerRoleService, getPermissions as getPermissionsService } from '../services/roles.js';
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx jest auth-store.test.js`
Expected: PASS

- [ ] **Step 5: Run lint to confirm the removed `removeRole` import doesn't leave a dangling reference**

Run: `npm run lint`
Expected: 0 errors (the pre-existing `app-web-shell.jsx:400` warning is unrelated and stays).

- [ ] **Step 6: Commit**

```bash
git add store/auth-store.js __tests__/auth-store.test.js
git commit -m "feat(auth): migrate trainer-role activate/deactivate to the dedicated endpoints"
```

---

### Task 7: Password confirmation modal for trainer-role activation

**Files:**
- Create: `components/profile/activate-trainer-password-modal.jsx`
- Modify: `components/profile/activate-trainer-screen.jsx`

**Interfaces:**
- Consumes: `useAuthStore.getState().activateTrainerRole(bankAlias, password)` from Task 6.
- Produces: nothing consumed by later tasks (this is the last task in the plan).

No automated test for this task (component render tests are out of scope per project convention) — manual verification steps are listed after Step 2.

- [ ] **Step 1: Create `components/profile/activate-trainer-password-modal.jsx`**

```jsx
import { useState } from 'react';
import { ActivityIndicator, Modal, Pressable, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useThemeColors } from '../../theme/colors.js';
import { InputField } from '../forms/fields.jsx';

// Paso intermedio entre "completé el alias" y "mandar la activación" —
// el backend ahora exige confirmar la contraseña actual
// (userrole.ActivateEntrenadorRequest.password, obligatorio) antes de
// activar el rol entrenador. Mismo patrón visual que
// deactivate-trainer-modal.jsx (modal propio con su loading interno).
export function ActivateTrainerPasswordModal({ visible, onCancel, onConfirm }) {
  const colors = useThemeColors();
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleConfirm = async () => {
    if (loading || !password) return;
    setLoading(true);
    await onConfirm(password);
    setLoading(false);
  };

  const handleCancel = () => {
    if (loading) return;
    setPassword('');
    onCancel();
  };

  return (
    <Modal nativeID="activate-trainer-password-modal" testID="activate-trainer-password-modal" animationType="fade" onRequestClose={handleCancel} transparent visible={visible}>
      <View nativeID="activate-trainer-password-modal-backdrop" testID="activate-trainer-password-modal-backdrop" className="flex-1 items-center justify-center bg-black/50 px-4">
        <View nativeID="activate-trainer-password-modal-card" testID="activate-trainer-password-modal-card" className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-xl dark:border-slate-700 dark:bg-surface">
          <View nativeID="activate-trainer-password-modal-header" testID="activate-trainer-password-modal-header" className="mb-3 flex-row items-center gap-2">
            <MaterialCommunityIcons color={colors.primary} name="lock-outline" size={20} />
            <Text nativeID="activate-trainer-password-modal-title" testID="activate-trainer-password-modal-title" className="text-lg font-bold text-slate-900 dark:text-white">
              Confirmá tu contraseña
            </Text>
          </View>

          <Text nativeID="activate-trainer-password-modal-description" testID="activate-trainer-password-modal-description" className="mb-4 text-sm leading-5 text-slate-600 dark:text-slate-300">
            Por seguridad, confirmá tu contraseña actual para activar el perfil de entrenador.
          </Text>

          <InputField
            autoComplete="current-password"
            dense
            label="Contraseña"
            onChange={setPassword}
            onSubmitEditing={handleConfirm}
            onToggleSecure={() => setShowPassword((v) => !v)}
            placeholder="Tu contraseña"
            returnKeyType="done"
            secureTextEntry={!showPassword}
            showSecure={showPassword}
            textContentType="password"
            value={password}
          />

          <View nativeID="activate-trainer-password-modal-actions" testID="activate-trainer-password-modal-actions" className="mt-2 flex-row gap-3">
            <Pressable
              nativeID="activate-trainer-password-modal-cancel-button"
              testID="activate-trainer-password-modal-cancel-button"
              className="h-11 flex-1 items-center justify-center rounded-full border border-slate-200 hover:bg-slate-100 active:opacity-70 dark:border-slate-700 dark:hover:bg-slate-800"
              disabled={loading}
              onPress={handleCancel}
            >
              <Text nativeID="activate-trainer-password-modal-cancel-label" testID="activate-trainer-password-modal-cancel-label" className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                Cancelar
              </Text>
            </Pressable>
            <Pressable
              nativeID="activate-trainer-password-modal-confirm-button"
              testID="activate-trainer-password-modal-confirm-button"
              className="h-11 flex-1 items-center justify-center rounded-full bg-primary hover:opacity-90 active:opacity-80 disabled:opacity-60"
              disabled={loading || !password}
              onPress={handleConfirm}
            >
              {loading ? (
                <ActivityIndicator color={colors.onPrimary} size="small" />
              ) : (
                <Text nativeID="activate-trainer-password-modal-confirm-label" testID="activate-trainer-password-modal-confirm-label" className="text-sm font-semibold uppercase tracking-wide text-[#111518]">
                  Confirmar
                </Text>
              )}
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}
```

- [ ] **Step 2: Wire the modal into `components/profile/activate-trainer-screen.jsx`**

Add the import:

```js
import { ActivateTrainerPasswordModal } from './activate-trainer-password-modal.jsx';
```

Replace the `handleSubmit` function and add the new confirm handler + modal state:

```js
  const [passwordModalVisible, setPasswordModalVisible] = useState(false);

  const handleSubmit = () => {
    setTouched(true);
    if (!canSubmit) return;
    setPasswordModalVisible(true);
  };

  const handleConfirmActivate = async (password) => {
    const result = await useAuthStore.getState().activateTrainerRole(trainerAlias, password);
    setPasswordModalVisible(false);
    if (result.success) {
      Toast.show({ type: 'success', text1: '¡Perfil de entrenador activado!', text2: 'Ya podés alternar entre corredor y entrenador.' });
      router.replace('/profile');
    } else {
      Toast.show({ type: 'error', text1: 'Error', text2: result.error || 'No se pudo activar el perfil de entrenador.' });
    }
  };
```

(This drops the local `loading` state from `handleSubmit`'s old flow — the modal now owns its own `loading` while the request is in flight, same as `DeactivateTrainerModal`. Remove the now-unused `loading`/`setLoading` state and the `ActivityIndicator` branch on the screen's own submit button — the button just opens the modal now, it doesn't show a spinner itself.)

Replace the submit `Pressable` (drop the `loading`-conditional `ActivityIndicator` branch, since the screen itself no longer tracks a loading state):

```jsx
        <Pressable
          nativeID="activate-trainer-screen-submit-button"
          testID="activate-trainer-screen-submit-button"
          className={`mt-4 h-12 flex-row items-center justify-center gap-2 rounded-full ${canSubmit ? 'bg-amber-500 hover:opacity-90' : 'bg-slate-100 dark:bg-slate-800'} active:opacity-80`}
          onPress={handleSubmit}
        >
          <MaterialCommunityIcons color={canSubmit ? '#ffffff' : colors.onSurfaceVariant} name="whistle" size={18} />
          <Text nativeID="activate-trainer-screen-submit-label" testID="activate-trainer-screen-submit-label" className={`text-sm font-semibold uppercase tracking-wide ${canSubmit ? 'text-white' : 'text-slate-400 dark:text-slate-500'}`}>
            Activar
          </Text>
        </Pressable>
      </View>

      <ActivateTrainerPasswordModal
        onCancel={() => setPasswordModalVisible(false)}
        onConfirm={handleConfirmActivate}
        visible={passwordModalVisible}
      />
    </KeyboardAwareScrollView>
```

(The closing `</View>` above is the existing `activate-trainer-screen-container` wrapper — the modal renders as a sibling right before the `KeyboardAwareScrollView` closes, same placement pattern `DeactivateTrainerModal` uses in `profile-screen.jsx`.)

- [ ] **Step 3: Run the full test suite and lint**

Run: `npm test && npm run lint`
Expected: all suites PASS, 0 lint errors (this task has no new tests of its own — component render tests are out of scope per project convention — this step just confirms nothing else broke).

- [ ] **Step 4: Commit**

```bash
git add components/profile/activate-trainer-password-modal.jsx components/profile/activate-trainer-screen.jsx
git commit -m "feat(profile): add password confirmation modal to trainer-role activation"
```

- [ ] **Step 5: Manual verification (developer, in preview)**

Not automated — component render tests are out of scope. Check in the web preview:
1. `/profile/activate-trainer` with no previous alias — alias field required, "Activar" opens the password modal, cancelling closes it without submitting.
2. Same screen with a previously-saved alias (deactivate and reactivate a test account, or check a fixture with `bank_alias` set) — field is prefilled, still editable, still required.
3. Wrong password in the modal — error toast shows, modal stays open, alias field keeps its value.
4. Correct password — success toast, redirects to `/profile`, role badge/switch reflects the new trainer role.
5. Deactivate trainer role while leading an active team (if reachable in the current test data) — confirm the 409 message from the backend shows in the existing error toast, unchanged UI otherwise.
6. Dark mode + narrow web viewport — modal readable, buttons not cramped.

---

## Final Verification

- [ ] Run `npm test` — all suites pass.
- [ ] Run `npm run lint` — 0 errors (pre-existing `app-web-shell.jsx:400` warning untouched).
- [ ] Whole-branch review (per [[sdd-final-review-timing]] convention: one review, sonnet by default, right before push — not one per task beyond the per-task reviews already run during SDD execution).
