# Auth-store: split sesión/perfil (TanStack Query) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Separar `store/auth-store.js` en sesión (Zustand: token/refreshToken/expiresAt/activeRole/userId) y perfil (TanStack Query, `hooks/use-user.js`: user/roles/mutations), tercer sub-proyecto de la migración de estado de servidor iniciada con equipos (PR #123).

**Architecture:** Un hook nuevo (`hooks/use-user.js`) reemplaza `user`/`roles`/las 6 mutations de perfil. Un módulo chico nuevo (`lib/query-client.js`) exporta el `queryClient` como singleton — única excepción al patrón "el caller decide" del resto de esta migración, necesaria porque el logout forzado por 401 (`services/api.js`) corre fuera de cualquier componente. `auth-store.js` termina reducido a sesión pura + un campo nuevo (`userId`, para que los hooks de Query sepan a quién pedirle sin depender de su propio cache).

**Tech Stack:** TanStack Query (`@tanstack/react-query`, ya instalado), Zustand (ya instalado).

**Spec:** `docs/superpowers/specs/2026-09-09-auth-store-tanstack-query-migration-design.md`

## Global Constraints

- Mutations nunca tiran (`throw`) — siempre devuelven `{success, error?}`, mismo contrato que `hooks/use-teams.js`.
- Hooks de lectura devuelven `{data, loading}` (no el objeto crudo de `useQuery`).
- `activeRole` NO migra — queda en Zustand, sin tocar en ningún task de este plan salvo la corrección reactiva (Task 9).
- Solo sesión persiste en storage (`paceron.auth`) — perfil se re-pide del backend en cada arranque, nunca se escribe a storage.
- `queryClient` global es la única excepción documentada al patrón "el caller decide" — no agregar más imports directos de `queryClient` en stores sin discutirlo primero.

---

### Task 1: `lib/query-client.js` + rewire `providers/app-providers.jsx`

**Files:**
- Create: `lib/query-client.js`
- Modify: `providers/app-providers.jsx`

**Interfaces:**
- Produces: `queryClient` (instancia única de `QueryClient`, exportada desde `lib/query-client.js`) — usada por Task 2 (`auth-store.js`) y Task 9 (`logout()`).

- [ ] **Step 1: Crear `lib/query-client.js`**

```js
import { QueryClient } from '@tanstack/react-query';

// Instancia única, importable fuera de React — la única excepción al
// patrón "quien tiene el queryClient decide" del resto de esta migración
// (ver docs/superpowers/specs/2026-09-09-auth-store-tanstack-query-migration-design.md).
// Necesaria porque store/auth-store.js#logout() y services/api.js (logout
// forzado por 401 vencido) corren fuera de cualquier componente — no hay
// useQueryClient() disponible ahí.
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60,
      retry: 1,
    },
  },
});
```

- [ ] **Step 2: Rewire `providers/app-providers.jsx`**

Archivo completo hoy:

```jsx
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { ThemeProvider } from './theme-provider.jsx';
import { useAuthStore } from '../store/auth-store.js';

const createQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 1000 * 60,
        retry: 1,
      },
    },
  });

export function AppProviders({ children }) {
  const [queryClient] = useState(createQueryClient);
  const hydrate = useAuthStore((state) => state.hydrate);
  useEffect(() => {
    hydrate();
  }, [hydrate]);

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        {children}
      </ThemeProvider>
    </QueryClientProvider>
  );
}
```

Reemplazar por:

```jsx
import { QueryClientProvider } from '@tanstack/react-query';
import { useEffect } from 'react';
import { ThemeProvider } from './theme-provider.jsx';
import { useAuthStore } from '../store/auth-store.js';
import { queryClient } from '../lib/query-client.js';

export function AppProviders({ children }) {
  const hydrate = useAuthStore((state) => state.hydrate);
  useEffect(() => {
    hydrate();
  }, [hydrate]);

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        {children}
      </ThemeProvider>
    </QueryClientProvider>
  );
}
```

(Solo mueve la instancia a un módulo — mismo comportamiento hoy, sin cambio visible. `useRoleReconciliation()` y el efecto de `seedDefaultTheme` se agregan acá recién en Task 9, cuando existen.)

- [ ] **Step 3: Verificar que no rompió nada**

Run: `npm run lint && npm test`
Expected: ambos en verde — cambio puramente mecánico, sin consumidores nuevos todavía.

- [ ] **Step 4: Commit**

```bash
git add lib/query-client.js providers/app-providers.jsx
git commit -m "feat(auth): add shared queryClient singleton"
```

---

### Task 2: `store/auth-store.js` — agregar `userId`, sembrar cache en login/register

**Files:**
- Modify: `store/auth-store.js`

**Interfaces:**
- Consumes: `queryClient` (Task 1).
- Produces: `userId` (campo nuevo de sesión, Zustand) — usado por Tasks 3-9 para `useUser(userId)`/`usePermissions(userId)`.

Este task es **aditivo** — no borra nada todavía (`user`/`roles`/las 6 acciones de perfil siguen funcionando igual que hoy). Solo agrega `userId` y hace que `login`/`register` siembren el cache de Query, para que los hooks de Task 3 tengan algo real que leer desde el día uno.

- [ ] **Step 1: Agregar `userId` al estado y a `hydrate()`**

Reemplazar:
```js
export const useAuthStore = create((set, get) => ({
  user: null,
  token: null,
  refreshToken: null,
  expiresAt: null,
  hydrated: false,
  activeRole: 'runner',
```
por:
```js
export const useAuthStore = create((set, get) => ({
  user: null,
  token: null,
  refreshToken: null,
  expiresAt: null,
  hydrated: false,
  activeRole: 'runner',
  // Id liviano de sesión — hooks/use-user.js lo necesita para
  // useUser(userId)/usePermissions(userId) sin depender del propio
  // cache de Query para saber a quién pedirle (ver spec, sección
  // "Sesión: por qué necesita userId").
  userId: null,
```

Reemplazar (dentro de `hydrate()`):
```js
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
```
por:
```js
        set({
          user: data.user ?? null,
          token: data.token ?? null,
          refreshToken: data.refreshToken ?? null,
          expiresAt: data.expiresAt ?? null,
          activeRole: data.activeRole ?? 'runner',
          userId: data.userId ?? data.user?.userId ?? null,
          // Sesiones viejas (pre-roles-de-backend) no tienen esta clave —
          // se normaliza a [] en vez de romper. rolesLoaded queda false
          // hasta que el fetchPermissions() de abajo resuelva.
          roles: Array.isArray(data.roles) ? data.roles : [],
        });
```
(`data.userId ?? data.user?.userId` — sesiones persistidas antes de este cambio no tienen `userId` propio todavía, pero sí tienen `user.userId` — fallback para no perder la sesión de nadie en el próximo `hydrate()`.)

- [ ] **Step 2: `login()` setea `userId` y siembra el cache de Query**

Reemplazar:
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
        seedDefaultTheme(user.defaultTheme);
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
por:
```js
  login: async (email, password) => {
    try {
      const result = await loginService(email, password);
      const token = result?.access_token;
      const user = toUserModel(result?.user);
      if (token && user) {
        const expiresAt = result.expires_in ? Date.now() + result.expires_in * 1000 : null;
        const session = { user, token, refreshToken: result.refresh_token ?? null, expiresAt, userId: user.userId };
        set(session);
        seedDefaultTheme(user.defaultTheme);
        // Siembra el cache de perfil con el user que ya vino en la
        // respuesta del login — evita un round-trip extra a getUser
        // apenas loguea (hooks/use-user.js#useUser lee de acá).
        queryClient.setQueryData(['user', user.userId], user);
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

- [ ] **Step 3: Importar `queryClient`**

Reemplazar:
```js
import { getItem, setItem, removeItem } from '../services/storage.js';
import { seedDefaultTheme } from '../providers/theme-provider.jsx';
```
por:
```js
import { getItem, setItem, removeItem } from '../services/storage.js';
import { seedDefaultTheme } from '../providers/theme-provider.jsx';
import { queryClient } from '../lib/query-client.js';
```

- [ ] **Step 4: Verificar que no rompió nada**

Run: `npm run lint && npm test`
Expected: ambos en verde — `fetchPermissions()`/`user`/`roles` siguen existiendo tal cual, solo se agregó `userId` al lado.

- [ ] **Step 5: Commit**

```bash
git add store/auth-store.js
git commit -m "feat(auth): add userId to session, seed profile cache on login"
```

---

### Task 3: `hooks/use-user.js` — lectura y mutations de perfil

**Files:**
- Create: `hooks/use-user.js`

**Interfaces:**
- Consumes: `userId` (Task 2, Zustand session).
- Produces: `useUser(userId)` → `{user, loading}`. `usePermissions(userId)` → `{roles, loading}`. `useUserMutations()` → `{updateUser, isUpdating, uploadPhoto, isUploadingPhoto, deletePhoto, isDeletingPhoto, deactivateAccount, isDeactivating, activateTrainerRole, isActivatingTrainer, deactivateTrainerRole, isDeactivatingTrainer}`.

- [ ] **Step 1: Escribir `hooks/use-user.js`**

```js
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getUser as getUserService } from '../services/auth.js';
import { updateUser as updateUserService, changeStatus as changeStatusService, uploadUserPhoto as uploadUserPhotoService, deleteUserPhoto as deleteUserPhotoService } from '../services/user.js';
import { activateTrainerRole as activateTrainerRoleService, deactivateTrainerRole as deactivateTrainerRoleService, getPermissions as getPermissionsService } from '../services/roles.js';
import { toUserModel } from '../services/normalizers.js';
import { useAuthStore } from '../store/auth-store.js';

// Estado de servidor del perfil de usuario — TanStack Query, no Zustand
// (ver CLAUDE.md). Sesión (token/refreshToken/activeRole/userId) sigue en
// store/auth-store.js — services/api.js la lee sincrónica fuera de React
// en cada request, no encaja con el modelo de hooks de Query.

export function useUser(userId) {
  const query = useQuery({
    queryKey: ['user', userId],
    queryFn: () => getUserService({ id: userId }).then((dto) => toUserModel(dto)),
    enabled: Boolean(userId),
  });
  return { user: query.data ?? null, loading: query.isLoading };
}

export function usePermissions(userId) {
  const query = useQuery({
    queryKey: ['permissions', userId],
    queryFn: () => getPermissionsService(userId).then((data) => data?.roles ?? []),
    enabled: Boolean(userId),
  });
  return { roles: query.data ?? [], loading: query.isLoading };
}

export function useUserMutations() {
  const queryClient = useQueryClient();
  const userId = useAuthStore((s) => s.userId);

  const invalidateUser = () => queryClient.invalidateQueries({ queryKey: ['user', userId] });
  const invalidatePermissions = () => queryClient.invalidateQueries({ queryKey: ['permissions', userId] });

  const updateUserMutation = useMutation({
    mutationFn: async ({ id, payload, currentPassword }) => {
      try {
        const updated = toUserModel(await updateUserService(id, payload, currentPassword));
        return { success: true, user: updated };
      } catch (error) {
        return { success: false, error: error.message };
      }
    },
    onSuccess: (result) => { if (result.success) invalidateUser(); },
  });

  const uploadPhotoMutation = useMutation({
    mutationFn: async ({ uri, mimeType }) => {
      if (!userId) return { success: false, error: 'No hay sesión activa.' };
      try {
        const { photo_url: photoUrl } = await uploadUserPhotoService(userId, uri, mimeType);
        return { success: true, photoUrl };
      } catch (error) {
        return { success: false, error: error.message };
      }
    },
    onSuccess: (result) => { if (result.success) invalidateUser(); },
  });

  const deletePhotoMutation = useMutation({
    mutationFn: async () => {
      if (!userId) return { success: false, error: 'No hay sesión activa.' };
      try {
        await deleteUserPhotoService(userId);
        return { success: true };
      } catch (error) {
        return { success: false, error: error.message };
      }
    },
    onSuccess: (result) => { if (result.success) invalidateUser(); },
  });

  // Baja lógica: a diferencia del resto, en éxito cierra sesión
  // (auth-store.js#logout, que limpia todo el cache de perfil) en vez de
  // invalidar puntualmente — no tiene sentido seguir mostrando un perfil
  // que ya no existe.
  const deactivateAccountMutation = useMutation({
    mutationFn: async () => {
      if (!userId) return { success: false, error: 'No hay sesión activa.' };
      try {
        await changeStatusService(userId, 'inactive');
        return { success: true };
      } catch (error) {
        return { success: false, error: error.message };
      }
    },
    onSuccess: async (result) => { if (result.success) await useAuthStore.getState().logout(); },
  });

  const activateTrainerRoleMutation = useMutation({
    mutationFn: async ({ bankAlias, password }) => {
      if (!userId) return { success: false, error: 'No hay sesión activa.' };
      try {
        await activateTrainerRoleService(userId, { password, bankAlias });
        return { success: true };
      } catch (error) {
        return { success: false, error: error.message };
      }
    },
    onSuccess: (result) => { if (result.success) { invalidateUser(); invalidatePermissions(); } },
  });

  const deactivateTrainerRoleMutation = useMutation({
    mutationFn: async () => {
      if (!userId) return { success: false, error: 'No hay sesión activa.' };
      try {
        await deactivateTrainerRoleService(userId);
        return { success: true };
      } catch (error) {
        return { success: false, error: error.message };
      }
    },
    onSuccess: (result) => { if (result.success) { invalidateUser(); invalidatePermissions(); } },
  });

  return {
    updateUser: updateUserMutation.mutateAsync,
    isUpdating: updateUserMutation.isPending,
    uploadPhoto: uploadPhotoMutation.mutateAsync,
    isUploadingPhoto: uploadPhotoMutation.isPending,
    deletePhoto: deletePhotoMutation.mutateAsync,
    isDeletingPhoto: deletePhotoMutation.isPending,
    deactivateAccount: deactivateAccountMutation.mutateAsync,
    isDeactivating: deactivateAccountMutation.isPending,
    activateTrainerRole: activateTrainerRoleMutation.mutateAsync,
    isActivatingTrainer: activateTrainerRoleMutation.isPending,
    deactivateTrainerRole: deactivateTrainerRoleMutation.mutateAsync,
    isDeactivatingTrainer: deactivateTrainerRoleMutation.isPending,
  };
}
```

- [ ] **Step 2: Verificar que no rompió nada**

Run: `npm run lint && npm test`
Expected: ambos en verde — archivo nuevo, sin consumidores todavía.

- [ ] **Step 3: Commit**

```bash
git add hooks/use-user.js
git commit -m "feat(auth): add use-user.js TanStack Query hooks"
```

---

### Task 4: Migrar los 3 shells

**Files:**
- Modify: `components/shell/app-web-shell.jsx`
- Modify: `components/shell/app-web-shell-narrow.jsx`
- Modify: `components/shell/app-mobile-shell.jsx`

**Interfaces:**
- Consumes: `useUser(userId)`, `usePermissions(userId)` (Task 3).

- [ ] **Step 1: `app-web-shell.jsx` — importar hooks**

Reemplazar:
```js
import { useAuthStore } from '../../store/auth-store.js';
import { useMyInvitations } from '../../hooks/use-invitations.js';
```
por:
```js
import { useAuthStore } from '../../store/auth-store.js';
import { useUser, usePermissions } from '../../hooks/use-user.js';
import { useMyInvitations } from '../../hooks/use-invitations.js';
```

- [ ] **Step 2: `app-web-shell.jsx` — `DropdownMenu` (hasTrainerRole)**

Reemplazar:
```js
function DropdownMenu({ onClose }) {
  const router = useRouter();
  const colors = useThemeColors();
  const hasTrainerRole = useAuthStore((s) => s.roles.some((r) => r.name === 'entrenador'));
```
por:
```js
function DropdownMenu({ onClose }) {
  const router = useRouter();
  const colors = useThemeColors();
  const userId = useAuthStore((s) => s.userId);
  const { roles } = usePermissions(userId);
  const hasTrainerRole = roles.some((r) => r.name === 'entrenador');
```

- [ ] **Step 3: `app-web-shell.jsx` — `AppWebShell` (user/activeRole)**

Reemplazar:
```js
export function AppWebShell({ children, pathname }) {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
```
por:
```js
export function AppWebShell({ children, pathname }) {
  const router = useRouter();
  const userId = useAuthStore((s) => s.userId);
  const { user } = useUser(userId);
```

- [ ] **Step 4: `app-web-shell-narrow.jsx` — importar hooks**

Reemplazar:
```js
import { useAuthStore } from '../../store/auth-store.js';
```
por:
```js
import { useAuthStore } from '../../store/auth-store.js';
import { useUser, usePermissions } from '../../hooks/use-user.js';
```

- [ ] **Step 5: `app-web-shell-narrow.jsx` — `NavigationDrawerNarrow`**

Reemplazar:
```js
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const [loggingOut, setLoggingOut] = useState(false);
  const activeRole = useAuthStore((s) => s.activeRole);
  const hasTrainerRole = useAuthStore((s) => s.roles.some((r) => r.name === 'entrenador'));
```
por:
```js
  const userId = useAuthStore((s) => s.userId);
  const { user } = useUser(userId);
  const logout = useAuthStore((s) => s.logout);
  const [loggingOut, setLoggingOut] = useState(false);
  const activeRole = useAuthStore((s) => s.activeRole);
  const { roles } = usePermissions(userId);
  const hasTrainerRole = roles.some((r) => r.name === 'entrenador');
```

- [ ] **Step 6: `app-mobile-shell.jsx` — mismo cambio que el narrow**

Reemplazar:
```js
import { useAuthStore } from '../../store/auth-store.js';
```
por:
```js
import { useAuthStore } from '../../store/auth-store.js';
import { useUser, usePermissions } from '../../hooks/use-user.js';
```

Reemplazar:
```js
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const [loggingOut, setLoggingOut] = useState(false);
  const activeRole = useAuthStore((s) => s.activeRole);
  const hasTrainerRole = useAuthStore((s) => s.roles.some((r) => r.name === 'entrenador'));
```
por:
```js
  const userId = useAuthStore((s) => s.userId);
  const { user } = useUser(userId);
  const logout = useAuthStore((s) => s.logout);
  const [loggingOut, setLoggingOut] = useState(false);
  const activeRole = useAuthStore((s) => s.activeRole);
  const { roles } = usePermissions(userId);
  const hasTrainerRole = roles.some((r) => r.name === 'entrenador');
```

- [ ] **Step 7: Verificar en preview**

Levantar `expo-web`, loguear, confirmar que el header/drawer sigue mostrando avatar/nombre/iniciales, el badge de "Volverse Entrenador"/toggle de rol sigue apareciendo según corresponda, y "Cerrar sesión" sigue funcionando.

- [ ] **Step 8: Correr suite y commitear**

Run: `npm run lint && npm test`

```bash
git add components/shell/app-web-shell.jsx components/shell/app-web-shell-narrow.jsx components/shell/app-mobile-shell.jsx
git commit -m "feat(auth): migrate 3 shells to use-user.js"
```

---

### Task 5: Migrar pantallas de perfil/settings (mutations)

**Files:**
- Modify: `components/profile/profile-screen.jsx:208-214` (aprox.)
- Modify: `components/profile/edit-profile-screen.jsx:80,94,182` (aprox.)
- Modify: `components/profile/activate-trainer-screen.jsx:18,38` (aprox.)
- Modify: `components/profile/tier-upgrade-screen.jsx:135-138` (aprox.)
- Modify: `components/settings/settings-screen.jsx:48-49` (aprox.)

**Interfaces:**
- Consumes: `useUser(userId)`, `usePermissions(userId)`, `useUserMutations()` (Task 3).

- [ ] **Step 1: `profile-screen.jsx`**

Reemplazar el import de `useAuthStore` (agregar el de hooks nuevo si no está):
```js
import { useAuthStore } from '../../store/auth-store.js';
```
por:
```js
import { useAuthStore } from '../../store/auth-store.js';
import { useUser, usePermissions, useUserMutations } from '../../hooks/use-user.js';
```

Reemplazar:
```js
  const user = useAuthStore((s) => s.user);
  const refreshUser = useAuthStore((s) => s.refreshUser);
  const deactivateAccount = useAuthStore((s) => s.deactivateAccount);
  const deactivateTrainerRole = useAuthStore((s) => s.deactivateTrainerRole);
  const uploadPhoto = useAuthStore((s) => s.uploadPhoto);
  const deletePhoto = useAuthStore((s) => s.deletePhoto);
  const roles = useAuthStore((s) => s.roles);
```
por:
```js
  const userId = useAuthStore((s) => s.userId);
  const queryClient = useQueryClient();
  const { user } = useUser(userId);
  const refreshUser = () => queryClient.invalidateQueries({ queryKey: ['user', userId] });
  const { deactivateAccount, deactivateTrainerRole, uploadPhoto, deletePhoto } = useUserMutations();
  const { roles } = usePermissions(userId);
```

Agregar el import de `useQueryClient` (si el archivo no lo tiene ya):
```js
import { useQueryClient } from '@tanstack/react-query';
```

- [ ] **Step 2: `edit-profile-screen.jsx`**

Reemplazar el import:
```js
import { useAuthStore } from '../../store/auth-store.js';
```
por:
```js
import { useAuthStore } from '../../store/auth-store.js';
import { useUser, usePermissions, useUserMutations } from '../../hooks/use-user.js';
```

Reemplazar:
```js
  const user = useAuthStore((s) => s.user);
```
por:
```js
  const userId = useAuthStore((s) => s.userId);
  const { user } = useUser(userId);
```

Reemplazar:
```js
  const hasTrainerRole = useAuthStore((s) => s.roles.some((r) => r.name === 'entrenador'));
```
por:
```js
  const { roles } = usePermissions(userId);
  const hasTrainerRole = roles.some((r) => r.name === 'entrenador');
```

Reemplazar:
```js
      const result = await useAuthStore.getState().updateUser(
```
por (agregar `const { updateUser } = useUserMutations();` cerca de las otras variables del componente, antes de este call site):
```js
      const result = await updateUser(
```
(el resto de los argumentos del call no cambia — sigue siendo `id, payload, currentPassword` en ese orden, ya que `useUserMutations().updateUser` los recibe agrupados en un objeto: revisar el call site completo y envolver los 3 argumentos existentes en `{ id: ..., payload: ..., currentPassword: ... }`).

- [ ] **Step 3: `activate-trainer-screen.jsx`**

Reemplazar el import:
```js
import { useAuthStore } from '../../store/auth-store.js';
```
por:
```js
import { useAuthStore } from '../../store/auth-store.js';
import { useUser, useUserMutations } from '../../hooks/use-user.js';
```

Reemplazar:
```js
  const user = useAuthStore((s) => s.user);
```
por:
```js
  const userId = useAuthStore((s) => s.userId);
  const { user } = useUser(userId);
  const { activateTrainerRole } = useUserMutations();
```

Reemplazar:
```js
    const result = await useAuthStore.getState().activateTrainerRole(trainerAlias, password);
```
por:
```js
    const result = await activateTrainerRole({ bankAlias: trainerAlias, password });
```

- [ ] **Step 4: `tier-upgrade-screen.jsx`**

Reemplazar el import:
```js
import { useAuthStore } from '../../store/auth-store.js';
```
por:
```js
import { useAuthStore } from '../../store/auth-store.js';
import { useUser, usePermissions } from '../../hooks/use-user.js';
import { useQueryClient } from '@tanstack/react-query';
```

Reemplazar:
```js
  const activeRole = useAuthStore((s) => s.activeRole);
  const roles = useAuthStore((s) => s.roles);
  const user = useAuthStore((s) => s.user);
  const fetchPermissions = useAuthStore((s) => s.fetchPermissions);
```
por:
```js
  const activeRole = useAuthStore((s) => s.activeRole);
  const userId = useAuthStore((s) => s.userId);
  const { roles } = usePermissions(userId);
  const { user } = useUser(userId);
  const queryClient = useQueryClient();
  const fetchPermissions = () => queryClient.invalidateQueries({ queryKey: ['permissions', userId] });
```

(Si el archivo ya importaba `useQueryClient` de otro hook usado antes en esta migración, no duplicar el import — agregarlo a la línea existente.)

- [ ] **Step 5: `settings-screen.jsx`**

Reemplazar el import:
```js
import { useAuthStore } from '../../store/auth-store.js';
```
por:
```js
import { useAuthStore } from '../../store/auth-store.js';
import { useUser, useUserMutations } from '../../hooks/use-user.js';
```

Reemplazar:
```js
  const user = useAuthStore((s) => s.user);
  const updateUser = useAuthStore((s) => s.updateUser);
```
por:
```js
  const userId = useAuthStore((s) => s.userId);
  const { user } = useUser(userId);
  const { updateUser } = useUserMutations();
```

Revisar el/los call site(s) de `updateUser(...)` en este archivo y envolver los argumentos posicionales en `{ id, payload, currentPassword }` (mismo criterio que Step 2).

- [ ] **Step 6: Verificar en preview**

Editar el perfil (nombre/email), subir/borrar foto, activar/desactivar rol entrenador, desde `/profile` y `/settings` — confirmar toasts de éxito/error y que los datos se reflejan sin recargar.

- [ ] **Step 7: Correr suite y commitear**

Run: `npm run lint && npm test`

```bash
git add components/profile/profile-screen.jsx components/profile/edit-profile-screen.jsx components/profile/activate-trainer-screen.jsx components/profile/tier-upgrade-screen.jsx components/settings/settings-screen.jsx
git commit -m "feat(auth): migrate profile/settings screens to use-user.js"
```

---

### Task 6: Migrar `require-auth.jsx`, `authenticated-home-screen.jsx`, `role-switch-toggle.jsx`

**Files:**
- Modify: `components/guards/require-auth.jsx`
- Modify: `components/home/authenticated-home-screen.jsx`
- Modify: `components/profile/role-switch-toggle.jsx`

**Interfaces:**
- Consumes: `useUser(userId)`, `usePermissions(userId)` (Task 3).

- [ ] **Step 1: `require-auth.jsx` — usar `userId` de sesión, NO `user` de Query**

**Importante:** este guard decide si hay sesión activa — debe leer de Zustand (sesión), no de Query (perfil). Si leyera `useUser().user`, redirigiría de más mientras el perfil todavía está cargando (loading ≠ sin sesión).

Reemplazar el archivo completo:
```jsx
import { Redirect } from 'expo-router';
import { useAuthStore } from '../../store/auth-store.js';

// Mismo patrón que components/guards/platform-gate.jsx#MobileOnlyRoute.
// Redirige a la landing si la sesión se cierra estando en una pantalla que
// la requiere (ej. logout mientras se está creando un equipo) — sin esto,
// la pantalla se queda montada mostrando datos de una sesión que ya no
// existe.
export function RequireAuth({ children, redirectHref = '/' }) {
  const user = useAuthStore((s) => s.user);
  if (!user) {
    return <Redirect href={redirectHref} />;
  }

  return <>{children}</>;
}
```
por:
```jsx
import { Redirect } from 'expo-router';
import { useAuthStore } from '../../store/auth-store.js';

// Mismo patrón que components/guards/platform-gate.jsx#MobileOnlyRoute.
// Redirige a la landing si la sesión se cierra estando en una pantalla que
// la requiere (ej. logout mientras se está creando un equipo) — sin esto,
// la pantalla se queda montada mostrando datos de una sesión que ya no
// existe. Lee userId de la sesión (Zustand), no el perfil de Query — el
// perfil puede estar en loading sin que eso signifique "sin sesión".
export function RequireAuth({ children, redirectHref = '/' }) {
  const userId = useAuthStore((s) => s.userId);
  if (!userId) {
    return <Redirect href={redirectHref} />;
  }

  return <>{children}</>;
}
```

- [ ] **Step 2: `authenticated-home-screen.jsx`**

Reemplazar:
```js
import { useAuthStore } from '../../store/auth-store.js';
```
por:
```js
import { useAuthStore } from '../../store/auth-store.js';
import { useUser } from '../../hooks/use-user.js';
```

Reemplazar:
```js
  const user = useAuthStore((s) => s.user);
```
por:
```js
  const userId = useAuthStore((s) => s.userId);
  const { user } = useUser(userId);
```

- [ ] **Step 3: `role-switch-toggle.jsx`**

Reemplazar:
```js
import { useAuthStore } from '../../store/auth-store.js';
```
por:
```js
import { useAuthStore } from '../../store/auth-store.js';
import { usePermissions } from '../../hooks/use-user.js';
```

Reemplazar:
```js
  const activeRole = useAuthStore((s) => s.activeRole);
  const roles = useAuthStore((s) => s.roles);
  const switchRole = useAuthStore((s) => s.switchRole);
```
por:
```js
  const activeRole = useAuthStore((s) => s.activeRole);
  const userId = useAuthStore((s) => s.userId);
  const { roles } = usePermissions(userId);
  const switchRole = useAuthStore((s) => s.switchRole);
```

- [ ] **Step 4: Verificar en preview**

Cerrar sesión desde cualquier pantalla protegida y confirmar el redirect a `/`. Loguear y confirmar el saludo en Home. Si hay rol entrenador asignado, confirmar que el toggle Corredor/Entrenador sigue mostrando el segmento correcto.

- [ ] **Step 5: Correr suite y commitear**

Run: `npm run lint && npm test`

```bash
git add components/guards/require-auth.jsx components/home/authenticated-home-screen.jsx components/profile/role-switch-toggle.jsx
git commit -m "feat(auth): migrate require-auth guard and role-switch-toggle to use-user.js"
```

---

### Task 7: Migrar pantallas de equipos (lecturas mecánicas)

**Files:**
- Modify: `components/team/create-team-screen.jsx:75-76`
- Modify: `components/team/edit-team-screen.jsx:73`
- Modify: `components/team/edit-group-screen.jsx:32`
- Modify: `components/team/invite-team-members-screen.jsx:53`
- Modify: `components/team/team-detail-screen.jsx:515,520-521`
- Modify: `components/team/team-search-screen.jsx:97`
- Modify: `components/team/teams-list-screen.jsx:43-45`

**Interfaces:**
- Consumes: `useUser(userId)`, `usePermissions(userId)` (Task 3).

Todos los cambios de este task son mecánicos — ningún archivo usa `user` más allá de `user.userId`/`user.email` para alimentar otro hook, ni `roles` más allá de `.some((r) => r.name === 'entrenador')`.

- [ ] **Step 1: `create-team-screen.jsx`**

Agregar el import (al lado del de `useAuthStore`):
```js
import { useUser, usePermissions } from '../../hooks/use-user.js';
```

Reemplazar:
```js
  const user = useAuthStore((s) => s.user);
  const roles = useAuthStore((s) => s.roles);
```
por:
```js
  const userId = useAuthStore((s) => s.userId);
  const { user } = useUser(userId);
  const { roles } = usePermissions(userId);
```

- [ ] **Step 2: `edit-team-screen.jsx`**

Agregar el import:
```js
import { usePermissions } from '../../hooks/use-user.js';
```

Reemplazar:
```js
  const roles = useAuthStore((s) => s.roles);
```
por:
```js
  const userId = useAuthStore((s) => s.userId);
  const { roles } = usePermissions(userId);
```
(Si `userId` ya está declarado más arriba en el mismo componente por otro motivo, no duplicar la línea.)

- [ ] **Step 3: `edit-group-screen.jsx`**

Agregar el import:
```js
import { useUser } from '../../hooks/use-user.js';
```

Reemplazar:
```js
  const user = useAuthStore((s) => s.user);
```
por:
```js
  const userId = useAuthStore((s) => s.userId);
  const { user } = useUser(userId);
```

- [ ] **Step 4: `invite-team-members-screen.jsx`**

Mismo cambio que Step 3 (agregar import, reemplazar `const user = useAuthStore((s) => s.user);` por las dos líneas de `userId`+`useUser`).

- [ ] **Step 5: `team-detail-screen.jsx`**

Agregar el import:
```js
import { useUser, usePermissions } from '../../hooks/use-user.js';
```

Reemplazar:
```js
  const user = useAuthStore((s) => s.user);
```
por:
```js
  const userId = useAuthStore((s) => s.userId);
  const { user } = useUser(userId);
```

Reemplazar:
```js
  const activeRole = useAuthStore((s) => s.activeRole);
  const hasTrainerRole = useAuthStore((s) => s.roles.some((r) => r.name === 'entrenador'));
```
por:
```js
  const activeRole = useAuthStore((s) => s.activeRole);
  const { roles } = usePermissions(userId);
  const hasTrainerRole = roles.some((r) => r.name === 'entrenador');
```

- [ ] **Step 6: `team-search-screen.jsx`**

Mismo cambio que Step 3/4.

- [ ] **Step 7: `teams-list-screen.jsx`**

Agregar el import:
```js
import { useUser, usePermissions } from '../../hooks/use-user.js';
```

Reemplazar:
```js
  const user = useAuthStore((s) => s.user);
  const hasTrainerRole = useAuthStore((s) => s.roles.some((r) => r.name === 'entrenador'));
  const activeRole = useAuthStore((s) => s.activeRole);
```
por:
```js
  const userId = useAuthStore((s) => s.userId);
  const { user } = useUser(userId);
  const { roles } = usePermissions(userId);
  const hasTrainerRole = roles.some((r) => r.name === 'entrenador');
  const activeRole = useAuthStore((s) => s.activeRole);
```

- [ ] **Step 8: Verificar en preview**

Recorrer `/teams`, crear equipo, editar equipo, ver detalle, invitar corredor — confirmar que nada cambió visualmente y no hay errores en consola.

- [ ] **Step 9: Correr suite y commitear**

Run: `npm run lint && npm test`

```bash
git add components/team/create-team-screen.jsx components/team/edit-team-screen.jsx components/team/edit-group-screen.jsx components/team/invite-team-members-screen.jsx components/team/team-detail-screen.jsx components/team/team-search-screen.jsx components/team/teams-list-screen.jsx
git commit -m "feat(auth): migrate team screens to use-user.js"
```

---

### Task 8: Migrar pantallas de planes/notificaciones/push (lote grande, mecánico)

**Files:**
- Modify: `components/plans/assign-training-plan-screen.jsx:32`
- Modify: `components/plans/create-exercise-modal.jsx:130`
- Modify: `components/plans/create-session-modal.jsx:162`
- Modify: `components/plans/create-training-plan-screen.jsx:21`
- Modify: `components/plans/exercises-catalog-tab.jsx:63`
- Modify: `components/plans/my-plans-screen.jsx:120`
- Modify: `components/plans/sessions-catalog-tab.jsx:62`
- Modify: `components/plans/training-plan-detail-screen.jsx:129`
- Modify: `components/plans/training-plan-form-fields.jsx:261`
- Modify: `components/plans/training-plans-screen.jsx:69,123`
- Modify: `components/notifications/notifications-screen.jsx:163,211`
- Modify: `hooks/use-push-notifications.js:42`
- Modify: `app/(tabs)/index.jsx:6`
- Modify: `app/(tabs)/index.web.jsx:8`

**Interfaces:**
- Consumes: `useUser(userId)` (Task 3).

Los 14 archivos de este task solo leen `user.userId`/`user.email` (para alimentar otros hooks) — ningún cambio de lógica, mismo patrón repetido:

```js
// Antes:
const user = useAuthStore((s) => s.user);
// Después:
const userId = useAuthStore((s) => s.userId);
const { user } = useUser(userId);
```

- [ ] **Step 1: Aplicar el patrón de arriba a los 14 archivos**

En cada uno: agregar `import { useUser } from '../../hooks/use-user.js';` (ajustar la profundidad relativa `../../` según la carpeta — `hooks/use-push-notifications.js` usa `'./use-user.js'`, `app/(tabs)/index.jsx`/`index.web.jsx` usan `'../../hooks/use-user.js'`) al lado del import de `useAuthStore`, y reemplazar la línea `const user = useAuthStore((s) => s.user);` por las dos líneas de arriba.

`notifications-screen.jsx` tiene DOS ocurrencias (línea 163, dentro de `TrainerPendingRequestsSection`, y línea 211, dentro de `NotificationsScreenContent`) — aplicar el cambio en ambos lugares, cada uno con su propia declaración de `userId`/`useUser` (son funciones de componente distintas).

- [ ] **Step 2: Verificar en preview**

Recorrer planes de entrenamiento (crear plan, catálogo de ejercicios/sesiones, asignar plan), `/notifications`, y confirmar que la Home (`/`) sigue mostrando el saludo/estado correcto. Sin errores en consola.

- [ ] **Step 3: Correr suite y commitear**

Run: `npm run lint && npm test`

```bash
git add components/plans/assign-training-plan-screen.jsx components/plans/create-exercise-modal.jsx components/plans/create-session-modal.jsx components/plans/create-training-plan-screen.jsx components/plans/exercises-catalog-tab.jsx components/plans/my-plans-screen.jsx components/plans/sessions-catalog-tab.jsx components/plans/training-plan-detail-screen.jsx components/plans/training-plan-form-fields.jsx components/plans/training-plans-screen.jsx components/notifications/notifications-screen.jsx hooks/use-push-notifications.js "app/(tabs)/index.jsx" "app/(tabs)/index.web.jsx"
git commit -m "feat(auth): migrate plans/notifications/push-notifications screens to use-user.js"
```

---

### Task 9: Limpieza final — `auth-store.js` a sesión pura, efecto reactivo, versión

**Files:**
- Modify: `store/auth-store.js` (reescritura completa)
- Modify: `hooks/use-user.js` (agregar `useRoleReconciliation`)
- Modify: `providers/app-providers.jsx` (montar `useRoleReconciliation` + mover `seedDefaultTheme`)
- Modify: `__tests__/auth-store.test.js` (recortar a solo sesión)
- Modify: `package.json` (versión)
- Modify: `CLAUDE.md`

**Interfaces:**
- No produce ni consume nada nuevo — limpieza sobre lo migrado en Tasks 1-8.

- [ ] **Step 1: Confirmar que no queda ningún consumidor de los campos/acciones que se van a borrar**

Run:
```bash
grep -rn "useAuthStore((s) => s\.\(user\b\|roles\b\|rolesLoaded\|updateUser\|uploadPhoto\|deletePhoto\|deactivateAccount\|fetchPermissions\|refreshUser\|activateTrainerRole\|deactivateTrainerRole\)" components/ app/ hooks/
grep -rn "useAuthStore\.getState()\.\(updateUser\|uploadPhoto\|deletePhoto\|deactivateAccount\|fetchPermissions\|refreshUser\|activateTrainerRole\|deactivateTrainerRole\)" components/ app/ hooks/
```
Expected: sin resultados. Si aparece algo, es un consumidor que las Tasks 4-8 no cubrieron — corregirlo antes de tocar el store.

- [ ] **Step 2: Agregar `useRoleReconciliation` a `hooks/use-user.js`**

Agregar al final del archivo (después de `useUserMutations`):
```js
// Corrección reactiva: si activeRole quedó en 'trainer' pero los roles
// reales (recién resueltos) no incluyen 'entrenador' (sesión vieja
// persistida, o el rol se revocó desde otra sesión), fuerza activeRole a
// 'runner'. Reemplaza la corrección que antes vivía inline al final de
// auth-store.js#fetchPermissions (ahora eliminada de ahí, ver Step 4).
// Se monta una sola vez en providers/app-providers.jsx (Step 5).
export function useRoleReconciliation() {
  const userId = useAuthStore((s) => s.userId);
  const activeRole = useAuthStore((s) => s.activeRole);
  const resetActiveRoleIfInvalid = useAuthStore((s) => s.resetActiveRoleIfInvalid);
  const { roles, loading } = usePermissions(userId);

  useEffect(() => {
    if (loading) return;
    const hasTrainerRole = roles.some((r) => r.name === 'entrenador');
    if (activeRole === 'trainer' && !hasTrainerRole) resetActiveRoleIfInvalid();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roles, loading]);
}
```

Agregar `useEffect` al import de React:
```js
import { useEffect } from 'react';
```
(agregar arriba del todo del archivo, junto a los demás imports).

- [ ] **Step 3: Verificar `useRoleReconciliation` en aislado**

Run: `npm run lint && npm test`
Expected: ambos en verde — función nueva, todavía sin montar en ningún lado.

- [ ] **Step 4: Reescribir `store/auth-store.js` completo**

Reemplazar el archivo entero por:

```js
import { create } from 'zustand';
import { login as loginService, register as registerService, logout as logoutService, refresh as refreshService } from '../services/auth.js';
import { assignRole as assignRoleService } from '../services/roles.js';
import { toUserModel } from '../services/normalizers.js';
import { getItem, setItem, removeItem } from '../services/storage.js';
import { seedDefaultTheme } from '../providers/theme-provider.jsx';
import { queryClient } from '../lib/query-client.js';

const STORAGE_KEY = 'paceron.auth';

// Solo sesión persiste — el perfil (user/roles) se re-pide del backend en
// cada arranque vía hooks/use-user.js, nunca se escribe acá (ver
// docs/superpowers/specs/2026-09-09-auth-store-tanstack-query-migration-design.md,
// sección Persistencia).
async function persist(session) {
  try {
    await setItem(STORAGE_KEY, JSON.stringify(session));
  } catch {
    // persistencia best-effort — no romper el login si storage falla
  }
}

export const useAuthStore = create((set, get) => ({
  token: null,
  refreshToken: null,
  expiresAt: null,
  hydrated: false,
  activeRole: 'runner',
  // Id liviano de sesión — hooks/use-user.js lo usa para
  // useUser(userId)/usePermissions(userId) sin depender del propio cache
  // de Query para saber a quién pedirle.
  userId: null,
  // Dato puro de UI (no persiste, no dispara nada por sí solo): { role }
  // cuando switchRole() acaba de cambiar el rol activo, null en reposo. El
  // componente que lo consume decide qué hacer (animar, navegar según la
  // ruta actual).
  roleSwitchAnimating: null,

  hydrate: async () => {
    try {
      const raw = await getItem(STORAGE_KEY);
      if (raw) {
        const data = JSON.parse(raw);
        set({
          token: data.token ?? null,
          refreshToken: data.refreshToken ?? null,
          expiresAt: data.expiresAt ?? null,
          activeRole: data.activeRole ?? 'runner',
          userId: data.userId ?? null,
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
      const token = result?.access_token;
      const user = toUserModel(result?.user);
      if (token && user) {
        const expiresAt = result.expires_in ? Date.now() + result.expires_in * 1000 : null;
        const { activeRole } = get();
        const session = { token, refreshToken: result.refresh_token ?? null, expiresAt, userId: user.userId, activeRole };
        set(session);
        seedDefaultTheme(user.defaultTheme);
        // Siembra el cache de perfil con el user que ya vino en la
        // respuesta del login — evita un round-trip extra a getUser
        // apenas loguea (hooks/use-user.js#useUser lee de acá).
        queryClient.setQueryData(['user', user.userId], user);
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
      const result = await get().login(payload.email, payload.password);
      if (result.success) {
        // Verificado 2026-07-19 contra el backend real: NO asigna
        // "corredor" automáticamente al registrarse (permissions devolvía
        // roles: [] para un usuario recién creado) — fallback best-effort,
        // logueado si falla en vez de tragarse el error en silencio.
        const { userId } = get();
        await assignRoleService(userId, 'corredor').catch((e) => console.warn('corredor auto-assign failed', e));
        queryClient.invalidateQueries({ queryKey: ['permissions', userId] });
      }
      return result;
    } catch (error) {
      return { success: false, error: error.message };
    }
  },

  switchRole: async () => {
    // roles ya no vive acá — el gate de "¿tiene rol entrenador?" que
    // antes se resolvía inline con get().roles ahora lo hace el caller
    // (role-switch-toggle.jsx, que ya usa usePermissions() y no llama a
    // switchRole() si no corresponde mostrar el toggle).
    const { activeRole, token, refreshToken, expiresAt, userId } = get();
    const nextRole = activeRole === 'runner' ? 'trainer' : 'runner';
    set({ activeRole: nextRole, roleSwitchAnimating: { from: activeRole, to: nextRole } });
    await persist({ token, refreshToken, expiresAt, userId, activeRole: nextRole });
  },

  clearRoleSwitchAnimation: () => set({ roleSwitchAnimating: null }),

  // Corrección reactiva disparada por hooks/use-user.js#useRoleReconciliation
  // cuando activeRole quedó en 'trainer' pero los roles reales no incluyen
  // 'entrenador' — reemplaza la corrección que antes vivía inline en
  // fetchPermissions().
  resetActiveRoleIfInvalid: () => {
    const { token, refreshToken, expiresAt, userId } = get();
    set({ activeRole: 'runner' });
    persist({ token, refreshToken, expiresAt, userId, activeRole: 'runner' });
  },

  logout: async () => {
    const { refreshToken } = get();
    try {
      if (refreshToken) await logoutService(refreshToken);
    } catch {
      // best-effort — igual que persist(), el logout local sigue aunque
      // esto falle (sin red, refresh token ya vencido, etc.)
    }
    set({
      token: null,
      refreshToken: null,
      expiresAt: null,
      activeRole: 'runner',
      userId: null,
    });
    await removeItem(STORAGE_KEY);
    // Limpia perfil/permisos (y cualquier otro dominio en cache) — evita
    // que el próximo login muestre por un instante datos del usuario
    // anterior. Consolida acá el caso manual (botón "Cerrar sesión", 3
    // shells) y el caso automático (401 con refresh vencido,
    // services/api.js) en un solo lugar.
    queryClient.clear();
  },

  // Rota el refresh token (POST /auth/refresh) y persiste el par nuevo.
  // Usado por services/api.js cuando una request pega 401 — ver ahí el
  // interceptor que llama a esto antes de reintentar.
  refreshSession: async () => {
    const { refreshToken, activeRole, userId } = get();
    if (!refreshToken) throw new Error('No hay refresh token disponible.');
    const result = await refreshService(refreshToken);
    const expiresAt = result.expires_in ? Date.now() + result.expires_in * 1000 : null;
    set({ token: result.access_token, refreshToken: result.refresh_token, expiresAt });
    await persist({ token: result.access_token, refreshToken: result.refresh_token, expiresAt, activeRole, userId });
    return result.access_token;
  },
}));
```

- [ ] **Step 5: Wire `useRoleReconciliation` + mover `seedDefaultTheme` en `providers/app-providers.jsx`**

Reemplazar (archivo resultante de Task 1):
```jsx
import { QueryClientProvider } from '@tanstack/react-query';
import { useEffect } from 'react';
import { ThemeProvider } from './theme-provider.jsx';
import { useAuthStore } from '../store/auth-store.js';
import { queryClient } from '../lib/query-client.js';

export function AppProviders({ children }) {
  const hydrate = useAuthStore((state) => state.hydrate);
  useEffect(() => {
    hydrate();
  }, [hydrate]);

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        {children}
      </ThemeProvider>
    </QueryClientProvider>
  );
}
```
por:
```jsx
import { QueryClientProvider } from '@tanstack/react-query';
import { useEffect } from 'react';
import { ThemeProvider } from './theme-provider.jsx';
import { useAuthStore } from '../store/auth-store.js';
import { queryClient } from '../lib/query-client.js';
import { useUser, useRoleReconciliation } from '../hooks/use-user.js';

function AuthEffects() {
  const hydrate = useAuthStore((state) => state.hydrate);
  const userId = useAuthStore((state) => state.userId);
  const { user } = useUser(userId);

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  // seedDefaultTheme necesita el perfil completo (user.defaultTheme) —
  // antes vivía dentro de auth-store.js#hydrate, que ya no tiene acceso a
  // user (perfil, ahora en Query). Corre un frame más tarde que antes
  // (espera a que useUser resuelva), sin impacto visible.
  useEffect(() => {
    if (user?.defaultTheme) seedDefaultTheme(user.defaultTheme);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.defaultTheme]);

  useRoleReconciliation();

  return null;
}

export function AppProviders({ children }) {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <AuthEffects />
        {children}
      </ThemeProvider>
    </QueryClientProvider>
  );
}
```

Agregar el import de `seedDefaultTheme` (ya no lo usa `auth-store.js` para este caso, pero `app-providers.jsx` sí):
```jsx
import { seedDefaultTheme } from './theme-provider.jsx';
```
(nota: `auth-store.js` SIGUE importando `seedDefaultTheme` para el caso de `login()`, que lo llama con el `user` que ya tiene disponible en la respuesta — no se duplica lógica, son dos call sites distintos para el mismo helper: uno en el momento de loguear, otro al hidratar una sesión ya existente).

- [ ] **Step 6: Recortar `__tests__/auth-store.test.js`**

Leer el archivo completo primero (`__tests__/auth-store.test.js`) para ver su estructura actual. Eliminar todos los `describe`/`test` que ejercitan acciones que ya no existen en el store (`updateUser`, `uploadPhoto`, `deletePhoto`, `deactivateAccount`, `fetchPermissions`, `refreshUser`, `activateTrainerRole`, `deactivateTrainerRole`, y cualquier aserción sobre `user`/`roles`/`rolesLoaded` en el estado). Conservar (adaptando las aserciones a la nueva forma de `persist()`, que ya no incluye `user`/`roles`) los tests de: `login` (éxito, credenciales inválidas, error de red), `register`, `logout` (incluye ahora verificar que se llama `queryClient.clear()` — mockear `lib/query-client.js` con `jest.mock('../lib/query-client.js', () => ({ queryClient: { clear: jest.fn(), setQueryData: jest.fn(), invalidateQueries: jest.fn() } }));` al principio del archivo), `refreshSession`, `switchRole`, `hydrate`, `resetActiveRoleIfInvalid`.

- [ ] **Step 7: Actualizar `CLAUDE.md` — sección Stack**

Localizar el párrafo "Estado de aplicación vs. estado de servidor" y agregar `hooks/use-user.js` a la lista de dominios migrados: "...y equipos/grupos/invitaciones (`hooks/use-teams.js`/`hooks/use-groups.js`/`hooks/use-invitations.js`), y perfil de usuario (`hooks/use-user.js`, desde <FECHA>, rama `feature/auth-store-query-migration-spec` — sesión (token/refreshToken/activeRole/userId) queda en `store/auth-store.js`, `services/api.js` la lee sincrónica fuera de React en cada request)." Mencionar que `training-plan-store.js`/`session-store.js`/`exercise-store.js` quedan como próximo sub-proyecto, en el orden acordado (ejercicios y sesiones primero, planes de entrenamiento último).

- [ ] **Step 8: Bump de versión**

Run: `cat package.json | grep '"version"'` para ver la versión actual, bumpear el minor (`0.X.0` → `0.(X+1).0`) — migración de arquitectura con alcance real (auth-store, ~35 archivos), mismo criterio que la migración de equipos.

- [ ] **Step 9: Verificar en preview — ciclo completo**

Cerrar sesión y volver a loguear — confirmar que no hay flash de datos del usuario anterior. Si hay una cuenta con rol entrenador revocado desde el backoffice/mock, confirmar que el toggle de rol se corrige solo a "Corredor" sin acción manual (o, si no hay forma fácil de simular esa revocación en el mock, verificar leyendo el código que `useRoleReconciliation` está montado y corre en cada cambio de `roles`).

- [ ] **Step 10: Suite completa final**

Run: `npm run lint && npm test`
Expected: ambos en verde.

- [ ] **Step 11: Commit**

```bash
git add store/auth-store.js hooks/use-user.js providers/app-providers.jsx __tests__/auth-store.test.js CLAUDE.md package.json
git commit -m "$(cat <<'EOF'
refactor(auth): shrink auth-store.js to session-only state

Perfil de usuario (user/roles) migra a TanStack Query
(hooks/use-user.js) — auth-store.js queda solo con sesión
(token/refreshToken/expiresAt/activeRole/userId). queryClient pasa a
vivir en lib/query-client.js como singleton (única excepción al patrón
"el caller decide" del resto de esta migración) — necesario porque
logout() ahora limpia el cache de perfil él mismo, incluido el caso de
logout forzado por 401 desde services/api.js, que corre fuera de
cualquier componente.
EOF
)"
```

---

## Self-Review

**Spec coverage:** Sección "Sesión: por qué necesita userId" → Task 2. "Persistencia" → Tasks 2 y 9 (persist() session-only). "Hooks" → Task 3. "queryClient global" → Tasks 1 y 9 (logout consolidado). "Efecto reactivo activeRole↔roles" → Task 9 (`useRoleReconciliation`/`resetActiveRoleIfInvalid`). "Impacto en consumidores" → Tasks 4-8 (cubre los 28 archivos de `user`, 11 de `roles`, 5 de mutations, 3 de `logout`, 2 de `hydrate`/`hydrated` — `hydrate`/`hydrated` no necesitan task propio, sin cambio de firma). "Testing" → Task 9 Step 6.

**Refinamiento sobre la spec:** la spec dice que `login`/`register` "reciben el queryClient como parámetro desde el caller" — este plan simplifica eso: dado que Task 1 ya crea un `queryClient` global (necesario igual para el caso 401), `login`/`register` lo importan directo del mismo módulo en vez de recibirlo como argumento — mismo resultado funcional (cache sembrado), pero sin tener que tocar `login-screen.jsx`/`register-screen.jsx` (que siguen llamando `login(email, password)`/`register(payload)` exactamente igual que hoy). Coherente con que `logout()` ya usa el mismo import directo.

**Placeholder scan:** sin "TBD"/"TODO". Task 9 Step 6 (recorte de tests) no incluye el código final del test file completo (a diferencia del resto del plan) porque depende de leer la estructura actual del archivo al momento de ejecutar — se documenta explícitamente qué conservar/eliminar y el mock nuevo necesario, no es una instrucción vaga tipo "actualizar los tests".

**Type consistency:** `useUser(userId)`/`usePermissions(userId)` (Task 3) se llaman con la misma firma en Tasks 4-9. `useUserMutations()` expone los 6 nombres (`updateUser`/`uploadPhoto`/`deletePhoto`/`deactivateAccount`/`activateTrainerRole`/`deactivateTrainerRole`) usados consistentemente en Task 5. `resetActiveRoleIfInvalid` se define en Task 9 Step 4 y se consume en el mismo Step 4 (dentro del propio archivo) — Step 2 ya lo referencia correctamente por nombre en `useRoleReconciliation`.
