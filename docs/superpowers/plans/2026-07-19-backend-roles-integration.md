# Backend Roles Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the 100%-local-only role system (corredor/entrenador) with the real backend API the team just shipped (roles, tiers, permissions, and a `bank_alias` field on the User entity), so trainer activation actually persists server-side.

**Architecture:** New `services/roles.js` wraps the three new endpoints (`GET /roles`, `POST /users/{id}/roles`, `GET /auth/permissions`). `store/auth-store.js`'s `trainerActivated`/`trainerAlias` local booleans are replaced by a `roles` array fetched from the backend; `activeRole` (which one is currently displayed) stays local-only since the backend has no such concept. `bank_alias` rides the existing `toUserModel`/`toUpdatePayload`/`updateUser()` pipeline as just another profile field, eliminating the separate `updateTrainerData` action.

**Tech Stack:** React Native + react-native-web, Zustand, Jest (store tests only — no component-render tests, matching existing project convention).

## Global Constraints

- Spec: `docs/superpowers/specs/2026-07-19-backend-roles-integration-design.md`.
- Only assign the **base** tier (omit `tier_id` in the assign-role request) — premium tier selection is out of scope.
- Do not hardcode `role_id` numbers anywhere outside `services/roles.js` — resolve by name (`'corredor'`/`'entrenador'`) through the cached `GET /roles` lookup.
- Do not write speculative code for both outcomes of the corredor-auto-assignment question (Task 8) or the PUT full-replace-vs-partial question (flagged inline in Task 4) — verify empirically first, then write only the branch that's actually needed.
- Tests must stay green: `npm test` → 32/32 baseline before this work; update `__tests__/auth-store.test.js` in Task 7 so the count reflects the new role-related cases.

---

### Task 1: `bank_alias` in the normalizer pipeline

**Files:**
- Modify: `services/normalizers.js`

**Interfaces:**
- Produces: `toUserModel(dto)` now includes `bankAlias` in its returned object. `toUpdatePayload(form)` now includes `bank_alias` in its returned object. Used by Task 4 (`activateTrainerRole`) and Task 5 (screens).

- [ ] **Step 1: Add `bankAlias` to `toUserModel`**

Current:
```js
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
```

Replace with:
```js
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
    bankAlias: dto.bank_alias,
  };
}
```

- [ ] **Step 2: Add `bank_alias` to `toUpdatePayload`**

Current:
```js
export function toUpdatePayload(form) {
  return {
    name: form.firstName,
    surname: form.lastName,
    email: form.email,
    dni: form.dni,
    birth_date: toBackendDate(form.birthDate),
    city: form.city ?? '',
    country: form.country ?? '',
    number: form.number ?? '',
    phone: form.phone ?? '',
    phone_contact: form.phoneContact ?? '',
    province: form.province ?? '',
    street: form.street ?? '',
  };
}
```

Replace with:
```js
export function toUpdatePayload(form) {
  return {
    name: form.firstName,
    surname: form.lastName,
    email: form.email,
    dni: form.dni,
    birth_date: toBackendDate(form.birthDate),
    city: form.city ?? '',
    country: form.country ?? '',
    number: form.number ?? '',
    phone: form.phone ?? '',
    phone_contact: form.phoneContact ?? '',
    province: form.province ?? '',
    street: form.street ?? '',
    bank_alias: form.bankAlias ?? '',
  };
}
```

- [ ] **Step 3: Add a reverse-mapping helper for re-sending the full profile**

At the bottom of `services/normalizers.js`, add:

```js
// Reconstruye la forma de "form" (camelCase, claves de toUpdatePayload) a
// partir del user model actual — usado cuando hay que reenviar el perfil
// completo junto con un solo campo nuevo (ver activateTrainerRole).
export function toEditableFormFromUser(user) {
  return {
    firstName: user.name,
    lastName: user.surname,
    email: user.email,
    dni: user.dni,
    birthDate: user.birthDate,
    city: user.city,
    country: user.country,
    number: user.number,
    phone: user.phone,
    phoneContact: user.phoneContact,
    province: user.province,
    street: user.street,
    bankAlias: user.bankAlias,
  };
}
```

- [ ] **Step 4: Run the test suite**

Run: `npm test`
Expected: PASS, 32/32 (no existing test covers these functions directly by name, but confirms nothing else broke).

- [ ] **Step 5: Commit**

```bash
git add services/normalizers.js
git commit -m "feat(roles): add bank_alias to user normalizer pipeline"
```

---

### Task 2: `services/roles.js` + mock

**Files:**
- Create: `services/roles.js`
- Create: `services/__mocks__/roles-mock.js`

**Interfaces:**
- Consumes: `services/api.js` (existing `get`/`post` wrapper), `config/env.js`'s `USE_MOCKS`.
- Produces: `getRoles()`, `getRoleIdByName(name)`, `assignRole(userId, roleName)`, `getPermissions(userId)`. Used by Task 4.

- [ ] **Step 1: Create the mock file**

```js
// services/__mocks__/roles-mock.js
const ROLES_CATALOG = [
  { id: 1, name: 'corredor', description: 'Rol de corredor' },
  { id: 2, name: 'entrenador', description: 'Rol de entrenador' },
];

// Estado in-memory para simular asignación durante una sesión mock —
// a diferencia de los demás mocks del proyecto (que son puros), este
// necesita estado para que el flujo de activación se pueda probar
// de punta a punta con EXPO_PUBLIC_USE_MOCKS=true.
let mockAssignedRoles = ['corredor'];

export async function mockGetRoles() {
  return ROLES_CATALOG;
}

export async function mockAssignRole(_userId, roleId) {
  const role = ROLES_CATALOG.find((r) => r.id === roleId);
  if (role && !mockAssignedRoles.includes(role.name)) {
    mockAssignedRoles.push(role.name);
  }
  return { id: roleId, assigned: true };
}

export async function mockGetPermissions(userId) {
  return {
    user_id: userId,
    roles: mockAssignedRoles.map((name) => ({
      id: ROLES_CATALOG.find((r) => r.name === name).id,
      name,
      tier: 'base',
      permissions: name === 'entrenador' ? ['crear_equipos'] : [],
    })),
  };
}

export function __resetMockRoles() {
  mockAssignedRoles = ['corredor'];
}
```

- [ ] **Step 2: Create `services/roles.js`**

```js
import api from './api.js';
import { USE_MOCKS } from '../config/env.js';
import { mockGetRoles, mockAssignRole, mockGetPermissions } from './__mocks__/roles-mock.js';

// Catálogo estático del backend — se cachea en memoria de módulo (no en
// el store de Zustand, que es para estado de sesión) y se pide una sola
// vez, no en cada asignación de rol.
let rolesCache = null;

// GET /api/v1/roles (público)
export async function getRoles() {
  if (rolesCache) return rolesCache;
  rolesCache = USE_MOCKS ? await mockGetRoles() : await api.get('/roles');
  return rolesCache;
}

// Resuelve el role_id por nombre — evita hardcodear IDs numéricos en el
// resto del código.
export async function getRoleIdByName(name) {
  const roles = await getRoles();
  const role = roles.find((r) => r.name === name);
  if (!role) throw new Error(`Rol "${name}" no encontrado en el catálogo.`);
  return role.id;
}

// POST /api/v1/users/{id}/roles — tier_id se omite a propósito: el
// backend usa el tier "base" del rol por default. 409 = ya asignado, se
// trata como éxito (no-op), no como error.
export async function assignRole(userId, roleName) {
  const roleId = await getRoleIdByName(roleName);
  if (USE_MOCKS) return await mockAssignRole(userId, roleId);
  try {
    return await api.post(`/users/${userId}/roles`, { role_id: roleId });
  } catch (error) {
    if (error.status === 409) return { alreadyAssigned: true };
    throw error;
  }
}

// GET /api/v1/auth/permissions?user_id= — única fuente de verdad de qué
// roles tiene un usuario (no existe en /auth/user ni en UserResponse).
export async function getPermissions(userId) {
  if (USE_MOCKS) return await mockGetPermissions(userId);
  return await api.get(`/auth/permissions?user_id=${encodeURIComponent(userId)}`);
}
```

- [ ] **Step 3: Run the test suite**

Run: `npm test`
Expected: PASS, 32/32 (new files not imported anywhere yet).

- [ ] **Step 4: Commit**

```bash
git add services/roles.js services/__mocks__/roles-mock.js
git commit -m "feat(roles): add roles service (catalog, assign, permissions)"
```

---

### Task 3: `bank_alias` in auth mocks

**Files:**
- Modify: `services/__mocks__/auth-mock.js`

**Interfaces:**
- Consumes: nothing new.
- Produces: `mockLogin`/`mockGetUser` returned objects now include `bank_alias`, matching the real `UserResponse` shape.

- [ ] **Step 1: Add `bank_alias` to `mockLogin`'s user object**

Current:
```js
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
```

Replace the `user` object with (adds `bank_alias: null`):
```js
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
      bank_alias: null,
    },
    authorization: {
      access_token: 'mock-access-token',
      refresh_token: 'mock-refresh-token',
      expires_in: 3600,
    },
  };
}
```

- [ ] **Step 2: Add `bank_alias` to `mockGetUser`'s returned object**

Current:
```js
export async function mockGetUser({ id, email }) {
  return {
    user_id: id ?? 1,
    name: 'Demo',
    surname: 'User',
    email: email ?? 'demo@paceron.com',
    dni: '12345678',
    birth_date: '01/01/1990',
    status: 'active',
    country: 'ARG',
    province: 'BA',
    city: 'La Plata',
    street: 'Av. Siempre Viva',
    number: '742',
    phone: '+54 11 1234 5678',
    phone_contact: '+54 11 8765 4321',
  };
}
```

Add `bank_alias: null,` after `status: 'active',`.

- [ ] **Step 3: Run the test suite**

Run: `npm test`
Expected: PASS, 32/32.

- [ ] **Step 4: Commit**

```bash
git add services/__mocks__/auth-mock.js
git commit -m "feat(roles): add bank_alias to auth mocks"
```

---

### Task 4: `store/auth-store.js` redesign

**Files:**
- Modify: `store/auth-store.js`
- Test: `__tests__/auth-store.test.js` (updated in Task 7, after this task's shape is final)

**Interfaces:**
- Consumes: `getRoleIdByName`/`assignRole`/`getPermissions` from `services/roles.js` (Task 2), `bankAlias`/`toEditableFormFromUser` from `services/normalizers.js` (Task 1).
- Produces: store state `roles` (`[{id,name,tier,permissions}]`, default `[]`), `rolesLoaded` (boolean, default `false`). Actions `fetchPermissions()`, `activateTrainerRole(bankAlias)` (replaces `activateTrainerProfile`), `switchRole()` (now gated on `roles`). Removes `trainerActivated`, `trainerAlias`, `updateTrainerData`, `activateTrainerProfile`. Used by Task 5 (screens) and Task 6 (shell components) via a derived `hasTrainerRole` selector: `useAuthStore((s) => s.roles.some((r) => r.name === 'entrenador'))`.

- [ ] **Step 1: Update imports and initial state**

Current imports/initial state block:
```js
import { create } from 'zustand';
import { login as loginService, register as registerService, getUser as getUserService } from '../services/auth.js';
import { updateUser as updateUserService, changeStatus as changeStatusService } from '../services/user.js';
import { toUserModel } from '../services/normalizers.js';
import { getItem, setItem, removeItem } from '../services/storage.js';

const STORAGE_KEY = 'paceron.auth';
```

Replace with:
```js
import { create } from 'zustand';
import { login as loginService, register as registerService, getUser as getUserService } from '../services/auth.js';
import { updateUser as updateUserService, changeStatus as changeStatusService } from '../services/user.js';
import { assignRole as assignRoleService, getPermissions as getPermissionsService } from '../services/roles.js';
import { toUserModel, toUpdatePayload, toEditableFormFromUser } from '../services/normalizers.js';
import { getItem, setItem, removeItem } from '../services/storage.js';

const STORAGE_KEY = 'paceron.auth';
```

- [ ] **Step 2: Replace the local role state fields**

Current:
```js
  activeRole: 'runner',
  trainerActivated: false,
  // Datos de entrenador, local-only (el backend todavía no los tiene).
  trainerAlias: '',
```

Replace with:
```js
  activeRole: 'runner',
  // Roles reales del usuario, desde /auth/permissions. activeRole (cuál
  // se muestra ahora) sigue local-only — el backend no tiene ese concepto,
  // solo trackea qué roles tiene asignados (un conjunto, no una selección).
  roles: [],
  rolesLoaded: false,
```

- [ ] **Step 3: Update `hydrate` for migration-safe roles + post-hydrate refetch**

Current:
```js
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
          activeRole: data.activeRole ?? 'runner',
          trainerActivated: data.trainerActivated ?? false,
          trainerAlias: data.trainerAlias ?? '',
        });
      }
    } catch {
      // sesión corrupta — se ignora y se arranca sin sesión
    }
    set({ hydrated: true });
  },
```

Replace with:
```js
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
          activeRole: data.activeRole ?? 'runner',
          // Sesiones viejas (pre-roles-de-backend) no tienen esta clave —
          // se normaliza a [] en vez de romper. rolesLoaded queda false
          // hasta que el fetchPermissions() de abajo resuelva.
          roles: Array.isArray(data.roles) ? data.roles : [],
        });
      }
    } catch {
      // sesión corrupta — se ignora y se arranca sin sesión
    }
    set({ hydrated: true });
    const { user, token } = get();
    if (user?.userId && token) await get().fetchPermissions();
  },
```

- [ ] **Step 4: Update `login` to fetch permissions after setting the session**

Current:
```js
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
        const { activeRole, trainerActivated, trainerAlias } = get();
        await persist({ ...session, activeRole, trainerActivated, trainerAlias });
        return { success: true };
      }
      return { success: false, error: 'Credenciales incorrectas.' };
    } catch (error) {
      return { success: false, error: error.message };
    }
  },
```

Replace with:
```js
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

- [ ] **Step 5: Update `refreshUser` and `updateUser` to carry `roles` instead of the old fields**

In `refreshUser`, replace:
```js
    const { user, token, refreshToken, expiresAt, activeRole, trainerActivated, trainerAlias } = get();
```
with:
```js
    const { user, token, refreshToken, expiresAt, activeRole, roles } = get();
```
and further down in the same function, replace:
```js
        await persist({ user: fresh, token, refreshToken, expiresAt, activeRole, trainerActivated, trainerAlias });
```
with:
```js
        await persist({ user: fresh, token, refreshToken, expiresAt, activeRole, roles });
```

In `updateUser`, replace:
```js
        const { token, refreshToken, expiresAt, activeRole, trainerActivated, trainerAlias } = get();
        set({ user: updated });
        await persist({ user: updated, token, refreshToken, expiresAt, activeRole, trainerActivated, trainerAlias });
```
with:
```js
        const { token, refreshToken, expiresAt, activeRole, roles } = get();
        set({ user: updated });
        await persist({ user: updated, token, refreshToken, expiresAt, activeRole, roles });
```

- [ ] **Step 6: Replace `activateTrainerProfile` with `activateTrainerRole`, add `fetchPermissions`**

Current:
```js
  // Local-only por ahora: el backend no tiene roles todavía. Estructurado
  // para que reemplazar esto por datos reales del backend no cambie la
  // interfaz que consumen los componentes.
  activateTrainerProfile: async (trainerAlias) => {
    set({ trainerActivated: true, trainerAlias });
    const { user, token, refreshToken, expiresAt, activeRole } = get();
    await persist({ user, token, refreshToken, expiresAt, activeRole, trainerActivated: true, trainerAlias });
  },

  switchRole: async () => {
    const { trainerActivated, activeRole, user, token, refreshToken, expiresAt, trainerAlias } = get();
    if (!trainerActivated) return;
    const nextRole = activeRole === 'runner' ? 'trainer' : 'runner';
    set({ activeRole: nextRole, roleSwitchAnimating: { role: nextRole } });
    await persist({ user, token, refreshToken, expiresAt, activeRole: nextRole, trainerActivated, trainerAlias });
  },

  clearRoleSwitchAnimation: () => set({ roleSwitchAnimating: null }),

  // Local-only, igual que activateTrainerProfile: el backend todavía no
  // tiene estos campos, no se manda nada por red.
  updateTrainerData: async ({ trainerAlias }) => {
    set({ trainerAlias });
    const { user, token, refreshToken, expiresAt, activeRole, trainerActivated } = get();
    await persist({ user, token, refreshToken, expiresAt, activeRole, trainerActivated, trainerAlias });
  },
```

Replace with:
```js
  // Pide a /auth/permissions los roles reales del usuario. Se llama tras
  // login/hydrate/activar rol — nunca se confía solo en la copia
  // persistida (existe solo para evitar un parpadeo mientras esto corre).
  fetchPermissions: async () => {
    const { user } = get();
    if (!user?.userId) return;
    try {
      const data = await getPermissionsService(user.userId);
      const roles = data?.roles ?? [];
      set({ roles, rolesLoaded: true });
      const { token, refreshToken, expiresAt, activeRole } = get();
      await persist({ user, token, refreshToken, expiresAt, activeRole, roles });
    } catch {
      // best-effort — se mantiene roles anterior si falla
    }
  },

  // Asigna el rol entrenador (tier base) y guarda el alias reenviando el
  // perfil completo actual + el alias nuevo (ver nota de riesgo en la
  // spec sobre semántica de PUT completo vs. parcial).
  activateTrainerRole: async (bankAlias) => {
    const { user } = get();
    if (!user?.userId) return { success: false, error: 'No hay sesión activa.' };
    try {
      await assignRoleService(user.userId, 'entrenador');
      const payload = toUpdatePayload({ ...toEditableFormFromUser(user), bankAlias });
      const updateResult = await get().updateUser(user.userId, payload);
      if (!updateResult.success) return updateResult;
      await get().fetchPermissions();
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  },

  switchRole: async () => {
    const { activeRole, roles, user, token, refreshToken, expiresAt } = get();
    if (!roles.some((r) => r.name === 'entrenador')) return;
    const nextRole = activeRole === 'runner' ? 'trainer' : 'runner';
    set({ activeRole: nextRole, roleSwitchAnimating: { role: nextRole } });
    await persist({ user, token, refreshToken, expiresAt, activeRole: nextRole, roles });
  },

  clearRoleSwitchAnimation: () => set({ roleSwitchAnimating: null }),
```

- [ ] **Step 7: Update `logout` to reset the new fields**

Current:
```js
  logout: async () => {
    set({
      user: null,
      token: null,
      refreshToken: null,
      expiresAt: null,
      activeRole: 'runner',
      trainerActivated: false,
      trainerAlias: '',
    });
    await removeItem(STORAGE_KEY);
  },
```

Replace with:
```js
  logout: async () => {
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

- [ ] **Step 8: Run the test suite (expect failures — fixed in Task 7)**

Run: `npm test`
Expected: FAIL — `__tests__/auth-store.test.js` still references `trainerActivated`/`activateTrainerProfile`, which no longer exist. This is expected; Task 7 fixes it. Do not skip ahead — commit this task first since it's a complete, coherent unit on its own.

- [ ] **Step 9: Commit**

```bash
git add store/auth-store.js
git commit -m "feat(roles): replace local-only role state with backend-fetched roles"
```

---

### Task 5: Screens

**Files:**
- Modify: `components/profile/activate-trainer-screen.jsx`
- Modify: `components/profile/edit-profile-screen.jsx`
- Modify: `components/profile/profile-screen.jsx`

**Interfaces:**
- Consumes: `activateTrainerRole` (Task 4) and a derived `hasTrainerRole` selector reading `roles` from the store.

- [ ] **Step 1: `activate-trainer-screen.jsx` — call `activateTrainerRole`, add error handling**

Find the `handleSubmit` function's body (currently calls `activateTrainerProfile` and always navigates on success, since the old action couldn't fail):

```js
  const handleSubmit = async () => {
    if (loading) return;
    setTouched(true);
    if (!canSubmit) return;

    setLoading(true);
    await useAuthStore.getState().activateTrainerProfile(trainerAlias);
    setLoading(false);
    router.replace('/profile');
  };
```

Replace with:
```js
  const handleSubmit = async () => {
    if (loading) return;
    setTouched(true);
    if (!canSubmit) return;

    setLoading(true);
    const result = await useAuthStore.getState().activateTrainerRole(trainerAlias);
    setLoading(false);
    if (result.success) {
      router.replace('/profile');
    } else {
      Toast.show({ type: 'error', text1: 'Error', text2: result.error || 'No se pudo activar el perfil de entrenador.' });
    }
  };
```

Add the Toast import at the top of the file if not already present:
```js
import Toast from 'react-native-toast-message';
```

- [ ] **Step 2: `edit-profile-screen.jsx` — read `hasTrainerRole` and `user.bankAlias`, fold into single submit**

Find:
```js
  const trainerActivated = useAuthStore((s) => s.trainerActivated);
  const storedTrainerAlias = useAuthStore((s) => s.trainerAlias);
```

Replace with:
```js
  const hasTrainerRole = useAuthStore((s) => s.roles.some((r) => r.name === 'entrenador'));
```

Find:
```js
  const [trainerAlias, setTrainerAlias] = useState(storedTrainerAlias ?? '');
```

Replace with:
```js
  const [trainerAlias, setTrainerAlias] = useState(user.bankAlias ?? '');
```

Find every remaining reference to `trainerActivated` in this file (the validation gating, the touch/submit logic, and the conditional `SectionCard` render) and rename to `hasTrainerRole` — same boolean semantics, no logic change.

Find the `handleSubmit` body where the payload is built and the separate trainer-data call happens:
```js
      const payload = toUpdatePayload({
        firstName,
        lastName,
        dni,
        birthDate,
        email,
        phone,
        phoneContact,
        country: address.country,
        province: address.province,
        city: address.city,
        street: address.street,
        number: address.number,
      });
      const result = await useAuthStore.getState().updateUser(
        user.userId,
        payload,
        emailChanged ? currentPassword : undefined,
      );
      if (trainerActivated) {
        await useAuthStore.getState().updateTrainerData({ trainerAlias });
      }
```

Replace with:
```js
      const payload = toUpdatePayload({
        firstName,
        lastName,
        dni,
        birthDate,
        email,
        phone,
        phoneContact,
        country: address.country,
        province: address.province,
        city: address.city,
        street: address.street,
        number: address.number,
        bankAlias: trainerAlias,
      });
      const result = await useAuthStore.getState().updateUser(
        user.userId,
        payload,
        emailChanged ? currentPassword : undefined,
      );
```

- [ ] **Step 3: `profile-screen.jsx` — read `hasTrainerRole` and `user.bankAlias`**

Find:
```js
  const trainerActivated = useAuthStore((s) => s.trainerActivated);
  const trainerAlias = useAuthStore((s) => s.trainerAlias);
```

Replace with:
```js
  const hasTrainerRole = useAuthStore((s) => s.roles.some((r) => r.name === 'entrenador'));
```

Find every remaining `trainerActivated` reference (the `RolesSection`/`TrainerDataSection` conditional renders and their props) and rename to `hasTrainerRole`. Find every `trainerAlias` reference passed as a prop and replace with `user.bankAlias`.

- [ ] **Step 4: Run the test suite**

Run: `npm test`
Expected: Still FAIL (same reason as Task 4 Step 8) — fixed in Task 7.

- [ ] **Step 5: Commit**

```bash
git add components/profile/activate-trainer-screen.jsx components/profile/edit-profile-screen.jsx components/profile/profile-screen.jsx
git commit -m "feat(roles): wire screens to backend-fetched roles and bank_alias"
```

---

### Task 6: Shell components (mechanical rename)

**Files:**
- Modify: `components/shell/role-management-section.jsx`
- Modify: `components/shell/role-switch-overlay.jsx`
- Modify: `components/shell/app-web-shell.jsx`
- Modify: `components/shell/app-mobile-shell.jsx`

**Interfaces:**
- Consumes: same `hasTrainerRole` selector pattern from Task 5.

- [ ] **Step 1: `role-management-section.jsx`**

This component currently does `const trainerActivated = useAuthStore((s) => s.trainerActivated);` and uses it as a plain boolean gate (`if (!trainerActivated) { ... }`, `getRoleAction(trainerActivated, activeRole)`). Replace the read with:
```js
  const hasTrainerRole = useAuthStore((s) => s.roles.some((r) => r.name === 'entrenador'));
```
and rename every use of `trainerActivated` in the rest of the file to `hasTrainerRole`. No other logic changes — `getRoleAction` and `handlePress` keep the exact same shape, just the variable name.

- [ ] **Step 2: `role-switch-overlay.jsx`, `app-web-shell.jsx`, `app-mobile-shell.jsx`**

Grep each file for `trainerActivated` and apply the same rename (read via the `hasTrainerRole` selector instead of the old store field). None of these three files use the value for anything beyond a boolean gate on rendering — confirm this while editing (if any of them turns out to inspect more than a boolean, stop and flag it rather than guessing).

Run: `grep -rn "trainerActivated" components/` after this step
Expected: no matches anywhere in the codebase.

- [ ] **Step 3: Run the test suite**

Run: `npm test`
Expected: Still FAIL (Task 7 fixes it) — but confirm no NEW failures beyond the store test file.

- [ ] **Step 4: Commit**

```bash
git add components/shell/role-management-section.jsx components/shell/role-switch-overlay.jsx components/shell/app-web-shell.jsx components/shell/app-mobile-shell.jsx
git commit -m "feat(roles): rename trainerActivated to hasTrainerRole in shell components"
```

---

### Task 7: Update `__tests__/auth-store.test.js`

**Files:**
- Modify: `__tests__/auth-store.test.js`

**Interfaces:**
- Consumes: `services/roles.js` (Task 2) needs mocking here the same way `services/auth.js` already is.

- [ ] **Step 1: Read the current test file to find the existing role-related tests to replace**

Run: `grep -n "trainerActivated\|activateTrainerProfile\|describe\|jest.mock" __tests__/auth-store.test.js`
Expected: shows the existing `jest.mock('../services/auth.js', ...)` block and the `describe('role management ...')` block (from the earlier role-management-ui feature) that needs replacing.

- [ ] **Step 2: Add a mock for `services/roles.js` alongside the existing mocks**

Near the top of the file, alongside the existing `jest.mock('../services/auth.js', ...)`/`jest.mock('../services/storage.js', ...)` calls, add:

```js
jest.mock('../services/roles.js', () => ({
  assignRole: jest.fn(),
  getPermissions: jest.fn(),
  getRoles: jest.fn(),
  getRoleIdByName: jest.fn(),
}));
```

Import the mocked functions the same way the file already imports the mocked `services/auth.js` functions, e.g.:
```js
import { assignRole, getPermissions } from '../services/roles.js';
```

- [ ] **Step 3: Replace the old role-management describe block**

Find and remove the existing `describe('role management (local-only)', ...)` block (it tests `activateTrainerProfile`/`switchRole` against the old boolean shape). Replace with:

```js
describe('role management (backend-backed)', () => {
  beforeEach(() => {
    assignRole.mockReset();
    getPermissions.mockReset();
  });

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
    getPermissions.mockResolvedValue({
      user_id: 1,
      roles: [{ id: 2, name: 'entrenador', tier: 'base', permissions: [] }],
    });
    // updateUser depende de services/user.js, ya mockeado en este archivo
    // — confirmar el mock existente de updateUserService antes de este test.
    const result = await useAuthStore.getState().activateTrainerRole('mi.alias');
    expect(result.success).toBe(true);
    expect(assignRole).toHaveBeenCalledWith(1, 'entrenador');
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

  test('logout resets roles state', async () => {
    useAuthStore.setState({ user: { userId: 1 }, token: 'tok', roles: [{ id: 2, name: 'entrenador' }], rolesLoaded: true });
    await useAuthStore.getState().logout();
    const s = useAuthStore.getState();
    expect(s.roles).toEqual([]);
    expect(s.rolesLoaded).toBe(false);
  });
});

describe('hydrate migration', () => {
  test('old persisted session without a roles key normalizes to empty array', async () => {
    const oldSessionShape = JSON.stringify({
      user: { userId: 1 },
      token: 'tok',
      activeRole: 'runner',
      trainerActivated: true, // clave vieja — ya no existe en el store
    });
    // usa el mock existente de storage.getItem en este archivo para
    // devolver oldSessionShape, luego llama hydrate() y confirma:
    // expect(useAuthStore.getState().roles).toEqual([]);
    // (fetchPermissions se dispara después, pero no está mockeado a
    // fallar en este caso — el getPermissions mock ya resetea a []).
  });
});
```

(The `hydrate migration` test's exact storage-mock wiring depends on how `services/storage.js` is already mocked earlier in this file — match that existing pattern rather than introducing a new one.)

- [ ] **Step 4: Update the file's top-level `beforeEach` reset block**

Find the existing top-level reset (the one that does `useAuthStore.setState({ user: null, token: null, ... })` before each test) and replace any `activeRole: 'runner', trainerActivated: false` with `activeRole: 'runner', roles: [], rolesLoaded: false`.

- [ ] **Step 5: Run the test suite**

Run: `npm test`
Expected: PASS, full suite green (32 baseline − old role tests + new role tests — the exact final count depends on how many test cases end up in the new describe blocks above; confirm it's green, not a specific number).

- [ ] **Step 6: Commit**

```bash
git add __tests__/auth-store.test.js
git commit -m "test(roles): update auth-store tests for backend-fetched roles"
```

---

### Task 8: Corredor auto-assignment verification (manual, one-time)

**Files:**
- Possibly modify: `store/auth-store.js` (only if verification shows it's needed)

**Interfaces:**
- Consumes: `assignRoleService` from `services/roles.js` (already imported per Task 4).

- [ ] **Step 1: Register a real test user against the live backend**

With `EXPO_PUBLIC_API_URL` unset (defaults to the Render production URL) and `EXPO_PUBLIC_USE_MOCKS` unset/false, register a throwaway test account through the app's real register flow (a disposable email you control).

- [ ] **Step 2: Check whether corredor was auto-assigned**

After registration succeeds (the app auto-logs in per the existing `register()` → `login()` chain), check the new user's roles — either via a temporary `console.log(useAuthStore.getState().roles)` after the post-login `fetchPermissions()` resolves, or directly via `curl "https://paceron-backend.onrender.com/api/v1/auth/permissions?user_id=<new_id>"`.

- [ ] **Step 3a: If corredor is already present — do nothing**

No code change. Add a one-line comment in `store/auth-store.js` near the `register` action:
```js
// Verificado 2026-07-19: el backend asigna "corredor" automáticamente al
// registrarse — no hace falta fallback acá.
```

- [ ] **Step 3b: If corredor is NOT present — add the fallback**

In `store/auth-store.js`, find the `register` action:
```js
  register: async (payload) => {
    try {
      await registerService(payload);
      return await get().login(payload.email, payload.password);
    } catch (error) {
      return { success: false, error: error.message };
    }
  },
```

Replace with:
```js
  register: async (payload) => {
    try {
      await registerService(payload);
      const result = await get().login(payload.email, payload.password);
      if (result.success) {
        // Verificado 2026-07-19: el backend NO asigna "corredor"
        // automáticamente — fallback best-effort, logueado si falla.
        const { user } = get();
        await assignRoleService(user.userId, 'corredor').catch((e) => console.warn('corredor auto-assign failed', e));
        await get().fetchPermissions();
      }
      return result;
    } catch (error) {
      return { success: false, error: error.message };
    }
  },
```

- [ ] **Step 4: Run the test suite**

Run: `npm test`
Expected: PASS (only relevant if Step 3b's code was added — re-run to confirm no regression in the `register` flow's existing tests, if any).

- [ ] **Step 5: Commit**

```bash
git add store/auth-store.js
git commit -m "fix(roles): verify and handle corredor auto-assignment on register"
```

(Commit even if Step 3a's no-op comment is the only change — it documents the verification outcome for future readers.)

---

## Manual verification (after all tasks)

- [ ] **Risk #1 — PUT semantics.** Before trusting `activateTrainerRole` in production use: with a disposable/test account against the real backend, `PUT /users/{id}` with a deliberately partial body (e.g. only `{ bank_alias: "test" }`) and confirm the other profile fields (name, email, etc.) survive unchanged. If they get nulled out, `activateTrainerRole`'s full-profile-resend approach (already built into Task 4) is the correct one and this confirms why; if they survive, the resend is harmless but unnecessary — no code change needed either way, just document the finding.
- [ ] `EXPO_PUBLIC_USE_MOCKS=true` full flow: activate trainer → alias saved → "Roles" card shows both badges with entrenador highlighted → switch role from profile/dropdown/sidebar → edit alias later from `/profile/edit` → still correct.
- [ ] Real backend flow (`EXPO_PUBLIC_API_URL` unset): register or log in with a real test account, activate trainer, confirm `GET /auth/permissions?user_id=` reflects the new role, confirm `bank_alias` round-trips through a subsequent profile edit.
- [ ] `npm test` → full suite green after all 8 tasks.

## Notes / follow-ups (out of scope)

- Premium tier selection/upsell UI (mentioned by the user as a possible future banner outside the profile section) — not designed or built here.
- No "deactivate trainer profile" UI — the backend has no unassign endpoint to support it.
- If `/auth/permissions` later requires auth the app doesn't currently send correctly, nothing here would need to change — the `Authorization` header is already automatic via `services/api.js`.
