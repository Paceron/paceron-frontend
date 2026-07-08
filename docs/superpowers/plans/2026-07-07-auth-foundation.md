# Auth Foundation + Contract-First API Layer — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make login/register/session work against the real Paceron backend contract, with a mock mode to build UI without a backend.

**Architecture:** Services own endpoints and normalize DTOs (snake_case → camelCase). A `USE_MOCKS` env flag intercepts at the service layer so store/UI are identical in mock and real modes. Zustand store holds session and persists it cross-platform (expo-secure-store on native, localStorage on web). Screens consume the store.

**Tech Stack:** Expo Router, React Native + react-native-web, NativeWind, Zustand, Jest + jest-expo, expo-secure-store.

## Global Constraints

- Branch: `feature/authFoundation` (already created from `develop`).
- API base: `https://paceron-backend.onrender.com/api/v1`, overridable by `EXPO_PUBLIC_API_URL`.
- Login response shape: `{ user, authorization: { access_token, refresh_token, expires_in } }`.
- Register response: no token; `409` on duplicate email.
- `birth_date` format sent/received: `DD/MM/YYYY` (e.g. `01/01/1988`).
- Backend responses are sparse: absent fields are omitted, not null.
- Register field mapping: `firstName→name`, `lastName→surname`, `phoneContact→phone_contact`.
- Refresh token: stored but NOT auto-refreshed this pass; `401` → logout.
- Files use `.jsx`/`.js`, existing quote/style conventions. No debug logs.

---

### Task 1: Config flag + install expo-secure-store

**Files:**
- Modify: `config/env.js`
- Modify: `package.json` (via `expo install`)

**Interfaces:**
- Produces: `API_BASE_URL` (string), `USE_MOCKS` (boolean) from `config/env.js`.

- [ ] **Step 1: Install the dependency**

Run: `npx expo install expo-secure-store`
Expected: adds `expo-secure-store` to `package.json` dependencies, no errors.

- [ ] **Step 2: Rewrite `config/env.js`**

```js
const REMOTE_URL = 'https://paceron-backend.onrender.com/api/v1';

export const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || REMOTE_URL;
export const USE_MOCKS = process.env.EXPO_PUBLIC_USE_MOCKS === 'true';
```

- [ ] **Step 3: Verify the test suite still runs**

Run: `npm test`
Expected: existing tests still pass (auth-store test will be rewritten in Task 6).

- [ ] **Step 4: Commit**

```bash
git add config/env.js package.json package-lock.json
git commit -m "feat: fix API base to /api/v1 and add USE_MOCKS flag"
```

---

### Task 2: Cross-platform storage adapter

**Files:**
- Create: `services/storage.js` (native default)
- Create: `services/storage.web.jsx` (web variant)

**Interfaces:**
- Produces: async `getItem(key)`, `setItem(key, value)`, `removeItem(key)`.
  `getItem` resolves to `string | null`. Metro resolves `.web.jsx` for web, `.js` for native.

- [ ] **Step 1: Create native adapter `services/storage.js`**

```js
import * as SecureStore from 'expo-secure-store';

export async function getItem(key) {
  return await SecureStore.getItemAsync(key);
}

export async function setItem(key, value) {
  await SecureStore.setItemAsync(key, value);
}

export async function removeItem(key) {
  await SecureStore.deleteItemAsync(key);
}
```

- [ ] **Step 2: Create web adapter `services/storage.web.jsx`**

```js
export async function getItem(key) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

export async function setItem(key, value) {
  try {
    localStorage.setItem(key, value);
  } catch {
    // storage unavailable (private mode) — ignore
  }
}

export async function removeItem(key) {
  try {
    localStorage.removeItem(key);
  } catch {
    // ignore
  }
}
```

- [ ] **Step 3: Commit**

```bash
git add services/storage.js services/storage.web.jsx
git commit -m "feat: add cross-platform storage adapter"
```

---

### Task 3: DTO normalizers

**Files:**
- Create: `services/normalizers.js`
- Test: `__tests__/normalizers.test.js`

**Interfaces:**
- Produces:
  - `toUserModel(dto)` → camelCase user model, or `null` if `dto` falsy. Fields: `userId, name, surname, email, dni, birthDate, status, city, country, phone, phoneContact, province, street, number`. Absent DTO fields become `undefined`.
  - `toRegisterPayload(form)` → backend payload with keys `name, surname, email, password, dni, birth_date` plus any non-empty optional address/phone fields (`city, country, phone, phone_contact, province, street, number`). `birth_date` output is `DD/MM/YYYY`.

- [ ] **Step 1: Write the failing test `__tests__/normalizers.test.js`**

```js
import { toUserModel, toRegisterPayload } from '../services/normalizers.js';

describe('toUserModel', () => {
  test('maps snake_case fields to camelCase', () => {
    const dto = {
      user_id: 3, name: 'pepe', surname: 'lota', email: 'pepa@lota.com',
      dni: '33703637', birth_date: '01/01/1988', status: 'active', phone_contact: '111',
    };
    expect(toUserModel(dto)).toEqual(
      expect.objectContaining({
        userId: 3, name: 'pepe', surname: 'lota', email: 'pepa@lota.com',
        dni: '33703637', birthDate: '01/01/1988', status: 'active', phoneContact: '111',
      }),
    );
  });

  test('returns null for falsy dto', () => {
    expect(toUserModel(null)).toBeNull();
    expect(toUserModel(undefined)).toBeNull();
  });

  test('tolerates absent fields (sparse response)', () => {
    const dto = { user_id: 3, name: 'pepe', email: 'a@b.com' };
    const model = toUserModel(dto);
    expect(model.userId).toBe(3);
    expect(model.city).toBeUndefined();
    expect(model.street).toBeUndefined();
  });
});

describe('toRegisterPayload', () => {
  const base = {
    firstName: 'pepe', lastName: 'lota', email: 'a@b.com',
    password: 'secret123', dni: '33703637',
  };

  test('maps required fields to snake_case', () => {
    const out = toRegisterPayload({ ...base, birthDate: '01/01/1988' });
    expect(out).toEqual({
      name: 'pepe', surname: 'lota', email: 'a@b.com',
      password: 'secret123', dni: '33703637', birth_date: '01/01/1988',
    });
  });

  test('converts ISO birthDate (web input) to DD/MM/YYYY', () => {
    const out = toRegisterPayload({ ...base, birthDate: '1988-01-01' });
    expect(out.birth_date).toBe('01/01/1988');
  });

  test('includes only non-empty optional fields', () => {
    const out = toRegisterPayload({
      ...base, birthDate: '01/01/1988',
      country: 'AR', province: '', city: '  ', phoneContact: '111',
    });
    expect(out.country).toBe('AR');
    expect(out.phone_contact).toBe('111');
    expect(out).not.toHaveProperty('province');
    expect(out).not.toHaveProperty('city');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- normalizers`
Expected: FAIL — cannot find module `../services/normalizers.js`.

- [ ] **Step 3: Create `services/normalizers.js`**

```js
// Convierte YYYY-MM-DD (input date web) a DD/MM/YYYY. Deja DD/MM/AAAA como esta.
function toBackendDate(value) {
  if (!value) return value;
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (iso) return `${iso[3]}/${iso[2]}/${iso[1]}`;
  return value;
}

export function toUserModel(dto) {
  if (!dto) return null;
  return {
    userId: dto.user_id,
    name: dto.name,
    surname: dto.surname,
    email: dto.email,
    dni: dto.dni,
    birthDate: dto.birth_date,
    status: dto.status,
    city: dto.city,
    country: dto.country,
    phone: dto.phone,
    phoneContact: dto.phone_contact,
    province: dto.province,
    street: dto.street,
    number: dto.number,
  };
}

export function toRegisterPayload(form) {
  const payload = {
    name: form.firstName,
    surname: form.lastName,
    email: form.email,
    password: form.password,
    dni: form.dni,
    birth_date: toBackendDate(form.birthDate),
  };

  const optional = {
    city: form.city,
    country: form.country,
    phone: form.phone,
    phone_contact: form.phoneContact,
    province: form.province,
    street: form.street,
    number: form.number,
  };

  for (const [key, value] of Object.entries(optional)) {
    if (value && String(value).trim()) payload[key] = value;
  }

  return payload;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- normalizers`
Expected: PASS (all cases).

- [ ] **Step 5: Commit**

```bash
git add services/normalizers.js __tests__/normalizers.test.js
git commit -m "feat: add DTO normalizers with tests"
```

---

### Task 4: API client error parsing

**Files:**
- Modify: `services/api.js` (the `request` function, error branch)
- Test: `__tests__/api-client.test.js`

**Interfaces:**
- Produces: on non-ok response, throws `Error` whose `.message` is the backend `apierror.APIError.message` when present (else `Request failed with status <n>`), and carries `.status = <httpStatus>`.

- [ ] **Step 1: Write the failing test `__tests__/api-client.test.js`**

```js
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- api-client`
Expected: FAIL — current code throws `Error("Request failed with status 409")` without `.status` and without backend message.

- [ ] **Step 3: Update the error branch in `services/api.js`**

Replace the existing block:

```js
  if (!response.ok) {
    throw new Error(`Request failed with status ${response.status}`);
  }
```

with:

```js
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- api-client`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add services/api.js __tests__/api-client.test.js
git commit -m "feat: surface backend error message and status in api client"
```

---

### Task 5: Auth service + mock adapter

**Files:**
- Modify: `services/auth.js` (full rewrite)
- Create: `services/__mocks__/auth-mock.js`
- Test: `__tests__/auth-mock.test.js`

**Interfaces:**
- Consumes: `api` (`services/api.js`), `USE_MOCKS` (`config/env.js`).
- Produces:
  - `login(email, password)` → resolves login response `{ user, authorization }`.
  - `register(payload)` → resolves register response (user object, no token).
  - `mockLogin(email, password)`, `mockRegister(payload)` in `services/__mocks__/auth-mock.js`, returning the same shapes.

- [ ] **Step 1: Write the failing test `__tests__/auth-mock.test.js`**

```js
import { mockLogin, mockRegister } from '../services/__mocks__/auth-mock.js';

describe('auth mock adapter', () => {
  test('mockLogin returns login response shape', async () => {
    const res = await mockLogin('a@b.com', 'pw');
    expect(res.user).toEqual(expect.objectContaining({ email: 'a@b.com', status: 'active' }));
    expect(res.authorization.access_token).toEqual(expect.any(String));
    expect(res.authorization.expires_in).toEqual(expect.any(Number));
  });

  test('mockRegister echoes payload without a token', async () => {
    const res = await mockRegister({ name: 'pepe', surname: 'lota', email: 'a@b.com', dni: '1', birth_date: '01/01/1988' });
    expect(res).toEqual(expect.objectContaining({ name: 'pepe', email: 'a@b.com', status: 'active' }));
    expect(res).not.toHaveProperty('authorization');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- auth-mock`
Expected: FAIL — cannot find module `../services/__mocks__/auth-mock.js`.

- [ ] **Step 3: Create `services/__mocks__/auth-mock.js`**

```js
// Datos fake con la MISMA shape que el backend real, para desarrollar sin backend.
export async function mockLogin(email, _password) {
  return {
    user: {
      user_id: 1,
      name: 'Demo',
      surname: 'User',
      email,
      dni: '12345678',
      birth_date: '01/01/1990',
      status: 'active',
    },
    authorization: {
      access_token: 'mock-access-token',
      refresh_token: 'mock-refresh-token',
      expires_in: 3600,
    },
  };
}

export async function mockRegister(payload) {
  return {
    user_id: 2,
    name: payload.name,
    surname: payload.surname,
    email: payload.email,
    dni: payload.dni,
    birth_date: payload.birth_date,
    status: 'active',
  };
}
```

- [ ] **Step 4: Rewrite `services/auth.js`**

```js
import api from './api.js';
import { USE_MOCKS } from '../config/env.js';
import { mockLogin, mockRegister } from './__mocks__/auth-mock.js';

// POST /api/v1/auth/login → { user, authorization }
export async function login(email, password) {
  if (USE_MOCKS) return await mockLogin(email, password);
  return await api.post('/auth/login', { email, password });
}

// POST /api/v1/auth/register → RegisterResponse (sin token). 409 si email duplicado.
export async function register(payload) {
  if (USE_MOCKS) return await mockRegister(payload);
  return await api.post('/auth/register', payload);
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npm test -- auth-mock`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add services/auth.js services/__mocks__/auth-mock.js __tests__/auth-mock.test.js
git commit -m "feat: rewrite auth service to real contract with mock adapter"
```

---

### Task 6: Auth store rewrite

**Files:**
- Modify: `store/auth-store.js` (full rewrite)
- Test: `__tests__/auth-store.test.js` (rewrite)

**Interfaces:**
- Consumes: `login`/`register` (`services/auth.js`), `toUserModel` (`services/normalizers.js`), `getItem`/`setItem`/`removeItem` (`services/storage.js`).
- Produces store `useAuthStore` with state `{ user, token, refreshToken, expiresAt, hydrated }` and actions:
  - `hydrate()` → loads persisted session, sets `hydrated: true`.
  - `login(email, password)` → `{ success: true }` or `{ success: false, error }`. Reads `authorization.access_token`, normalizes user, persists.
  - `register(payload)` → registers then auto-logins with `payload.email` + `payload.password`. Returns login result.
  - `logout()` → clears state + storage.
- Note: `clearUser` is removed (was unused outside tests).

- [ ] **Step 1: Rewrite the test `__tests__/auth-store.test.js`**

```js
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
  useAuthStore.setState({ user: null, token: null, refreshToken: null, expiresAt: null, hydrated: false });
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- auth-store`
Expected: FAIL — store has no `hydrate`, `login` reads `result.token` not `authorization.access_token`, `register` takes different args.

- [ ] **Step 3: Rewrite `store/auth-store.js`**

```js
import { create } from 'zustand';
import { login as loginService, register as registerService } from '../services/auth.js';
import { toUserModel } from '../services/normalizers.js';
import { getItem, setItem, removeItem } from '../services/storage.js';

const STORAGE_KEY = 'paceron.auth';

async function persist(session) {
  try {
    await setItem(STORAGE_KEY, JSON.stringify(session));
  } catch {
    // persistencia best-effort — no romper el login si storage falla
  }
}

export const useAuthStore = create((set, get) => ({
  user: null,
  token: null,
  refreshToken: null,
  expiresAt: null,
  hydrated: false,

  hydrate: async () => {
    try {
      const raw = await getItem(STORAGE_KEY);
      if (raw) {
        const data = JSON.parse(raw);
        set({
          user: data.user ?? null,
          token: data.token ?? null,
          refreshToken: data.refreshToken ?? null,
          expiresAt: data.expiresAt ?? null,
        });
      }
    } catch {
      // sesión corrupta — se ignora y se arranca sin sesión
    }
    set({ hydrated: true });
  },

  login: async (email, password) => {
    try {
      const result = await loginService(email, password);
      const token = result?.authorization?.access_token;
      const user = toUserModel(result?.user);
      if (token && user) {
        const auth = result.authorization;
        const expiresAt = auth.expires_in ? Date.now() + auth.expires_in * 1000 : null;
        const session = { user, token, refreshToken: auth.refresh_token ?? null, expiresAt };
        set(session);
        await persist(session);
        return { success: true };
      }
      return { success: false, error: 'Credenciales incorrectas.' };
    } catch (error) {
      return { success: false, error: error.message };
    }
  },

  register: async (payload) => {
    try {
      await registerService(payload);
      return await get().login(payload.email, payload.password);
    } catch (error) {
      return { success: false, error: error.message };
    }
  },

  logout: async () => {
    set({ user: null, token: null, refreshToken: null, expiresAt: null });
    await removeItem(STORAGE_KEY);
  },
}));
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- auth-store`
Expected: PASS (all cases).

- [ ] **Step 5: Commit**

```bash
git add store/auth-store.js __tests__/auth-store.test.js
git commit -m "feat: rewrite auth store for real contract, persistence, auto-login"
```

---

### Task 7: Rehydrate session on launch

**Files:**
- Modify: `providers/app-providers.jsx`

**Interfaces:**
- Consumes: `useAuthStore` (`store/auth-store.js`).
- Behavior: calls `hydrate()` once on mount. Does NOT block rendering (public landing must show immediately; no route guards exist yet).

- [ ] **Step 1: Update `providers/app-providers.jsx`**

Add imports at the top (alongside existing imports):

```js
import { useEffect, useState } from 'react';
import { useAuthStore } from '../store/auth-store.js';
```

Inside `AppProviders`, before the `return`, add:

```js
  const hydrate = useAuthStore((state) => state.hydrate);
  useEffect(() => {
    hydrate();
  }, [hydrate]);
```

(Keep the existing `const [queryClient] = useState(createQueryClient);` line; merge the `useState` import with the new `useEffect` import.)

- [ ] **Step 2: Verify tests still pass**

Run: `npm test`
Expected: full suite PASS.

- [ ] **Step 3: Commit**

```bash
git add providers/app-providers.jsx
git commit -m "feat: rehydrate auth session on app launch"
```

---

### Task 8: Fix register screen to real contract

**Files:**
- Modify: `components/auth/register-screen.jsx`

**Interfaces:**
- Consumes: `toRegisterPayload` (`services/normalizers.js`), `useAuthStore.register` (`store/auth-store.js`).
- Removes: import + use of `checkEmailExists` (dead endpoint), the `validatingEmail` state and pre-check block.

- [ ] **Step 1: Replace the auth import**

Remove:

```js
import { checkEmailExists } from '../../services/auth.js';
```

Add (near the other service/store imports):

```js
import { toRegisterPayload } from '../../services/normalizers.js';
```

- [ ] **Step 2: Remove the `validatingEmail` state**

Delete this line:

```js
  const [validatingEmail, setValidatingEmail] = useState(false);
```

- [ ] **Step 3: Rewrite `handleSubmit`**

Replace the whole `handleSubmit` function body from the `setValidatingEmail(true)` block onward. The new function:

```js
  const handleSubmit = async () => {
    if (loading) return;
    touch('firstName');
    touch('lastName');
    touch('dni');
    touch('birthDate');
    touch('email');
    touch('password');
    touch('confirm');

    const personalOk =
      firstName.trim().length > 0 &&
      lastName.trim().length > 0 &&
      !validateDNI(dni) &&
      !validateDate(birthDate) &&
      validateEmailFormat(email) &&
      !isDisposableEmail(email);

    if (!personalOk || !passwordValid || !passwordsMatch) return;

    setLoading(true);
    try {
      const { register } = useAuthStore.getState();
      const result = await register(
        toRegisterPayload({
          firstName,
          lastName,
          dni,
          birthDate,
          email,
          phone,
          phoneContact,
          country,
          province,
          city,
          street,
          number,
          password,
        }),
      );
      if (result.success) {
        router.replace('/');
      } else {
        Toast.show({ type: 'error', text1: 'Error', text2: result.error || 'Error al crear la cuenta.' });
      }
    } catch {
      Toast.show({ type: 'error', text1: 'Error de conexión', text2: 'Intentá de nuevo más tarde.' });
    } finally {
      setLoading(false);
    }
  };
```

- [ ] **Step 4: Remove `validatingEmail` from the submit button**

In the submit `Pressable`, replace:

```js
                disabled={loading || validatingEmail}
```
with:
```js
                disabled={loading}
```

and replace:

```js
                {loading || validatingEmail ? (
```
with:
```js
                {loading ? (
```

- [ ] **Step 5: Verify no dangling references**

Run: `grep -n "validatingEmail\|checkEmailExists" components/auth/register-screen.jsx`
Expected: no output.

- [ ] **Step 6: Run the full test suite**

Run: `npm test`
Expected: full suite PASS.

- [ ] **Step 7: Commit**

```bash
git add components/auth/register-screen.jsx
git commit -m "feat: wire register screen to real backend contract"
```

---

## Manual verification (after all tasks)

Run against mock mode (no backend needed):

- [ ] `EXPO_PUBLIC_USE_MOCKS=true npm run web` → open `/register`, complete the form, submit → lands on `/`, session persists across reload (localStorage `paceron.auth`).
- [ ] `/login` with any email/password → lands on `/`, reload keeps session.
- [ ] Remove `EXPO_PUBLIC_USE_MOCKS` → real backend: `/login` with the seeded user (`pepa@lota.com`) should hit `https://paceron-backend.onrender.com/api/v1/auth/login`. Confirm the birth_date round-trips as `DD/MM/YYYY`.

## Notes / follow-ups (out of scope)

- `components/auth/login-screen.jsx` already surfaces `result.error` via toast; with Task 4 that error is now the backend message. No code change needed.
- `components/auth/forgot-password-form.jsx` stays a stub (no backend endpoint).
- Next branches: landing vs authenticated home + platform unification; profile view/edit (`getUser`, `PUT /users/{id}`); baja (`PATCH /users/{id}/status`); trainer activation (needs backend support first).
