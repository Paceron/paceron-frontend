# Foto de perfil e ícono de equipo Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Subir/reemplazar/borrar la foto de perfil de usuario y el ícono de equipo contra el backend real (`PUT`/`DELETE /users/:id/photo`, `PUT`/`DELETE /teams/:id/icon`), reemplazando el picker local-only que hoy existe en el wizard de equipos (nunca sube nada) por un flujo real desde perfil propio y detalle de equipo (dueño).

**Architecture:** Primera subida `multipart/form-data` de todo el repo — `services/api.js` gana un helper `putForm` que omite el `Content-Type` forzado cuando el body es `FormData` (fetch arma el boundary solo). Un utilitario `utils/build-photo-form-data.js` arma ese `FormData` con split real por plataforma (nativo acepta `{uri,name,type}` directo, web necesita convertir a `Blob` primero). Servicios nuevos en `services/user.js`/`services/teams.js` (+mocks que "hacen como que subieron", devolviendo el mismo URI local), acciones nuevas en `store/auth-store.js`/`store/team-store.js`, un componente compartido `components/shared/avatar-picker.jsx`, y dos puntos de entrada: `profile-screen.jsx` (propio) y `team-detail-screen.jsx` (entrenador dueño). Se elimina el picker local-only existente en el wizard de equipos.

**Tech Stack:** Expo/React Native + React Native Web, `expo-image-picker` (ya instalado), Zustand, Jest.

**Spec:** `docs/superpowers/specs/2026-09-03-profile-team-photo-upload-design.md`

## Global Constraints

- Contrato confirmado contra el swagger real de `develop` del backend (PR #40 ya mergeada): `PUT`/`DELETE /api/v1/users/:id/photo` (self only), `PUT`/`DELETE /api/v1/teams/:id/icon` (entrenador dueño). Body del PUT: `multipart/form-data`, campo `photo`. Respuesta del PUT: `{photo_url}`/`{icon_url}` (string). DELETE devuelve 204. `GET /auth/user` trae `photo_url`, `GET /teams/:id` trae `icon_url` — ambos nullable/string.
- Errores del backend: 400 con `{code, message, status_code}` (`code` puede ser `PHOTO_TOO_LARGE`/`PHOTO_INVALID_TYPE`), 403 si no es el dueño. El frontend no distingue por `code` — siempre muestra `error.message` vía Toast, mismo patrón que el resto del repo.
- Cache-busting resuelto del lado backend (`?v=<timestamp>` en la URL) — el frontend renderiza `photo_url`/`icon_url` tal cual, sin inventar su propio cache-busting.
- Validación client-side solo lo barato: si `expo-image-picker` devuelve `fileSize` (bytes) y supera 5MB (`5 * 1024 * 1024`), se rechaza antes de subir. Sin ese dato, se deja pasar. Sin duplicar validación de tipo — `mediaTypes: ['images']` del picker ya restringe a nivel de SO.
- **Sin picker durante creación** — ni de usuario (nunca existió) ni de equipo (se elimina el que hay). Los dos únicos puntos de entrada son `profile-screen.jsx` (propio, siempre editable) y `team-detail-screen.jsx` (solo si `canDeleteTeam`, ya existente en ese archivo).
- Subida **al toque**, apenas se elige la foto — no se bundlea con ningún otro submit de formulario.
- Borrar **sin modal de confirmación** — el ícono de basurero chico ya es un tap deliberado.
- UI optimista: al elegir, se muestra el URI local al instante con spinner encima; éxito reemplaza por la URL real, error revierte al valor anterior + Toast.
- Todo componente visual (`View`/`Text`/`Pressable`/etc., incluidas variantes `Animated.*`) lleva `nativeID` y `testID` únicos — regla `local/require-native-id`, sin excepción salvo spread de props.
- Sin tests de render de componentes — convención del proyecto. Cobertura vía tests de servicio, mock, normalizers y el utilitario `build-photo-form-data.js`.
- `npm test` y `npm run lint` en verde antes de cerrar cada tarea.

---

### Task 1: Soporte multipart en `services/api.js` + `utils/build-photo-form-data.js`

**Files:**
- Modify: `services/api.js`
- Create: `utils/build-photo-form-data.js`
- Test: `__tests__/build-photo-form-data.test.js`

**Interfaces:**
- Produces: `api.putForm(path, formData)` desde `services/api.js` (PUT con `body: formData`, sin `Content-Type` forzado). `buildPhotoFormData(uri, { mimeType, fieldName })` desde `utils/build-photo-form-data.js` → `Promise<FormData>`, campo default `'photo'`.

- [ ] **Step 1: Escribir el test de `buildPhotoFormData` (rama nativa)**

```js
// __tests__/build-photo-form-data.test.js
jest.mock('../utils/platform.js', () => ({ isWeb: false }));

import { buildPhotoFormData } from '../utils/build-photo-form-data.js';

describe('buildPhotoFormData — nativo', () => {
  test('arma un FormData con el objeto {uri, name, type} tal cual, campo "photo" por default', async () => {
    const formData = await buildPhotoFormData('file:///tmp/foto.jpg', { mimeType: 'image/png' });
    const entry = formData.get('photo');
    expect(entry).toEqual({ uri: 'file:///tmp/foto.jpg', name: 'photo.jpg', type: 'image/png' });
  });

  test('usa image/jpeg por default si no se pasa mimeType', async () => {
    const formData = await buildPhotoFormData('file:///tmp/foto.jpg');
    expect(formData.get('photo').type).toBe('image/jpeg');
  });

  test('respeta un fieldName custom', async () => {
    const formData = await buildPhotoFormData('file:///tmp/foto.jpg', { fieldName: 'icon' });
    expect(formData.get('icon')).toBeTruthy();
    expect(formData.get('photo')).toBeNull();
  });
});
```

- [ ] **Step 2: Correr el test, confirmar que falla**

Run: `npx jest __tests__/build-photo-form-data.test.js`
Expected: FAIL — `buildPhotoFormData is not a function` (el archivo no existe todavía).

- [ ] **Step 3: Crear `utils/build-photo-form-data.js` (rama nativa primero)**

```js
// utils/build-photo-form-data.js
import { isWeb } from './platform.js';

// Arma el FormData para subir una foto — split real por plataforma, no
// cosmético. Nativo: el polyfill de fetch/FormData de React Native acepta
// el objeto {uri, name, type} directo. Web (react-native-web en un
// browser real): un browser no acepta ese shape en FormData.append — hace
// falta el Blob real primero (fetch(uri).then(r => r.blob())). Ver
// docs/superpowers/specs/2026-09-03-profile-team-photo-upload-design.md.
export async function buildPhotoFormData(uri, { mimeType = 'image/jpeg', fieldName = 'photo' } = {}) {
  const formData = new FormData();
  if (isWeb) {
    const blob = await fetch(uri).then((r) => r.blob());
    formData.append(fieldName, blob, 'photo.jpg');
  } else {
    formData.append(fieldName, { uri, name: 'photo.jpg', type: mimeType });
  }
  return formData;
}
```

- [ ] **Step 4: Correr el test nativo, confirmar que pasa**

Run: `npx jest __tests__/build-photo-form-data.test.js`
Expected: PASS (3/3 — la rama nativa está mockeada como `isWeb: false`).

- [ ] **Step 5: Sumar el test de la rama web**

Agregar al mismo archivo, con su propio mock de plataforma (hace falta un `describe` separado porque `jest.mock` de un módulo aplica a todo el archivo — usar `jest.resetModules()` + `require` dinámico para poder mockear `isWeb: true` en un segundo bloque):

```js
describe('buildPhotoFormData — web', () => {
  const mockBlob = { size: 123, type: 'image/jpeg' };

  beforeEach(() => {
    jest.resetModules();
    jest.doMock('../utils/platform.js', () => ({ isWeb: true }));
    global.fetch = jest.fn().mockResolvedValue({ blob: () => Promise.resolve(mockBlob) });
  });

  afterEach(() => {
    delete global.fetch;
  });

  test('convierte el URI a Blob real antes de appendear', async () => {
    const { buildPhotoFormData: buildPhotoFormDataWeb } = require('../utils/build-photo-form-data.js');
    const formData = await buildPhotoFormDataWeb('blob:http://localhost/abc123');
    expect(global.fetch).toHaveBeenCalledWith('blob:http://localhost/abc123');
    expect(formData.get('photo')).toBe(mockBlob);
  });
});
```

- [ ] **Step 6: Correr todos los tests del archivo, confirmar que pasan**

Run: `npx jest __tests__/build-photo-form-data.test.js`
Expected: PASS (4/4).

- [ ] **Step 7: Agregar `api.putForm` a `services/api.js`**

Modificar `request()` (services/api.js:17-31) para no forzar `Content-Type` cuando el body es `FormData`:

```js
async function request(path, { _isRetry, skipAuthRefresh, ...fetchOptions } = {}) {
  const { token } = useAuthStore.getState();
  const isFormData = typeof FormData !== 'undefined' && fetchOptions.body instanceof FormData;
  const headers = {
    ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
    ...(fetchOptions.headers || {}),
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(buildUrl(path), {
    ...fetchOptions,
    headers,
  });
```

(El resto de la función, desde el manejo de 401 en adelante, queda exactamente igual — no se toca.)

Agregar `putForm` al export default (services/api.js:74-80), junto a los verbos existentes:

```js
export default {
  get: async (path) => await request(path, { method: 'GET' }),
  post: async (path, body, options) => await request(path, { method: 'POST', body: JSON.stringify(body), ...options }),
  put: async (path, body, headers) => await request(path, { method: 'PUT', body: JSON.stringify(body), headers }),
  putForm: async (path, formData) => await request(path, { method: 'PUT', body: formData }),
  patch: async (path, body, options) => await request(path, { method: 'PATCH', body: JSON.stringify(body), ...options }),
  delete: async (path) => await request(path, { method: 'DELETE' }),
};
```

- [ ] **Step 8: Lint + suite completa**

Run: `npx eslint services/api.js utils/build-photo-form-data.js __tests__/build-photo-form-data.test.js && npm test`
Expected: lint sin errores, suite completa en verde (los tests existentes de `services/api.js` — si los hay — no deben romperse, ya que la rama JSON no cambió de comportamiento).

- [ ] **Step 9: Commit**

```bash
git add services/api.js utils/build-photo-form-data.js __tests__/build-photo-form-data.test.js
git commit -m "feat(api): add multipart upload support (putForm + buildPhotoFormData)"
```

---

### Task 2: Servicios de upload/delete + normalizers (`user.js`/`teams.js`)

**Files:**
- Modify: `services/user.js`
- Modify: `services/teams.js`
- Modify: `services/__mocks__/user-mock.js`
- Modify: `services/__mocks__/teams-mock.js`
- Modify: `services/normalizers.js`
- Test: `__tests__/user-mock.test.js` (extiende, ya existe)
- Test: `__tests__/teams-mock.test.js` (extiende, ya existe)
- Test: `__tests__/normalizers.test.js` (extiende, ya existe)

**Interfaces:**
- Consumes: `buildPhotoFormData(uri, opts)` y `api.putForm(path, formData)` de Task 1.
- Produces: `uploadUserPhoto(userId, uri, mimeType)` / `deleteUserPhoto(userId)` desde `services/user.js`. `uploadTeamIcon(teamId, uri, mimeType)` / `deleteTeamIcon(teamId)` desde `services/teams.js`. `toUserModel(dto).photoUrl`, `toTeamModel(dto).iconUrl` (string o `null`).

- [ ] **Step 1: Agregar `photoUrl`/`iconUrl` a los normalizers**

En `services/normalizers.js`, `toUserModel` (líneas 9-28) suma una línea:

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
    photoUrl: dto.photo_url ?? null,
  };
}
```

`toTeamModel` (líneas 77-97) suma una línea:

```js
export function toTeamModel(dto) {
  if (!dto) return null;
  return {
    id: String(dto.id),
    name: dto.name,
    description: dto.description,
    level: dto.level,
    maxMembers: dto.max_members,
    ownerId: dto.owner_id,
    requirements: dto.requirements,
    status: dto.status,
    country: dto.country,
    province: dto.province,
    city: dto.city,
    street: dto.street,
    number: dto.number,
    showGroupsToRunners: dto.show_groups_to_runners ?? false,
    createdAt: dto.created_at,
    updatedAt: dto.updated_at,
    iconUrl: dto.icon_url ?? null,
  };
}
```

- [ ] **Step 2: Extender el test de normalizers**

Agregar a `__tests__/normalizers.test.js`, dentro del `describe('toUserModel', ...)` existente:

```js
test('mapea photo_url, null si no viene', () => {
  expect(toUserModel({ user_id: 1, photo_url: 'https://x.com/p.jpg?v=123' }).photoUrl).toBe('https://x.com/p.jpg?v=123');
  expect(toUserModel({ user_id: 1 }).photoUrl).toBeNull();
});
```

Y dentro del `describe('toTeamModel', ...)` existente:

```js
test('mapea icon_url, null si no viene', () => {
  expect(toTeamModel({ id: 1, icon_url: 'https://x.com/i.jpg?v=123' }).iconUrl).toBe('https://x.com/i.jpg?v=123');
  expect(toTeamModel({ id: 1 }).iconUrl).toBeNull();
});
```

- [ ] **Step 3: Correr los tests de normalizers, confirmar que pasan**

Run: `npx jest __tests__/normalizers.test.js`
Expected: PASS.

- [ ] **Step 4: Mock de foto de usuario en `services/__mocks__/user-mock.js`**

Agregar al final del archivo (después de `mockChangePassword`), con estado in-memory propio (mismo patrón que `mockBankAlias`):

```js
// Estado in-memory para simular que la foto "quedó subida" entre
// uploadUserPhoto y cualquier getUser() posterior durante una sesión mock
// — mismo patrón que mockBankAlias arriba. El mock devuelve el mismo URI
// local recibido como si fuera la URL ya subida (no hay bucket real
// detrás en modo mock).
let mockPhotoUrl = null;

export async function mockUploadUserPhoto(id, uri) {
  mockPhotoUrl = uri;
  return { photo_url: uri };
}

export async function mockDeleteUserPhoto(_id) {
  mockPhotoUrl = null;
  return null;
}

export function getMockPhotoUrl() {
  return mockPhotoUrl;
}
```

- [ ] **Step 5: Agregar `uploadUserPhoto`/`deleteUserPhoto` a `services/user.js`**

```js
import { buildPhotoFormData } from '../utils/build-photo-form-data.js';
import { mockUpdateUser, mockChangeStatus, mockSearchUsers, mockBatchLookupUsers, mockChangePassword, mockUploadUserPhoto, mockDeleteUserPhoto } from './__mocks__/user-mock.js';
```

(reemplaza el import existente de `__mocks__/user-mock.js` en la línea 3, sumando los dos nombres nuevos y el import de `buildPhotoFormData`)

Agregar al final del archivo:

```js
// PUT /api/v1/users/{id}/photo — multipart/form-data, campo "photo". Self
// only (valida el backend). Máx 5MB, JPEG/PNG/WEBP (contenido real, no
// extensión) — 400 PHOTO_TOO_LARGE/PHOTO_INVALID_TYPE si no cumple.
export async function uploadUserPhoto(id, uri, mimeType) {
  if (USE_MOCKS) return await mockUploadUserPhoto(id, uri);
  const formData = await buildPhotoFormData(uri, { mimeType });
  return await api.putForm(`/users/${id}/photo`, formData);
}

// DELETE /api/v1/users/{id}/photo — self only, idempotente (204).
export async function deleteUserPhoto(id) {
  if (USE_MOCKS) return await mockDeleteUserPhoto(id);
  return await api.delete(`/users/${id}/photo`);
}
```

- [ ] **Step 6: Extender el test de `user-mock.test.js`**

Agregar (el archivo ya existe, revisar el `describe` existente para mantener el estilo):

```js
import { mockUploadUserPhoto, mockDeleteUserPhoto, getMockPhotoUrl } from '../services/__mocks__/user-mock.js';

describe('mockUploadUserPhoto / mockDeleteUserPhoto', () => {
  test('upload devuelve el mismo URI recibido como photo_url', async () => {
    const result = await mockUploadUserPhoto(1, 'file:///tmp/foto.jpg');
    expect(result).toEqual({ photo_url: 'file:///tmp/foto.jpg' });
    expect(getMockPhotoUrl()).toBe('file:///tmp/foto.jpg');
  });

  test('delete limpia el estado in-memory', async () => {
    await mockUploadUserPhoto(1, 'file:///tmp/foto.jpg');
    await mockDeleteUserPhoto(1);
    expect(getMockPhotoUrl()).toBeNull();
  });
});
```

- [ ] **Step 7: Mock de ícono de equipo en `services/__mocks__/teams-mock.js`**

Agregar al final del archivo (después de `__resetMockTeams`), reusando `findTeamOrThrow` que ya existe en el archivo:

```js
// Mismo criterio que mockUploadUserPhoto (user-mock.js) — el mock "hace
// como que subió", devolviendo el URI local recibido como si fuera la
// URL ya subida. A diferencia de la foto de usuario (un solo estado
// global), el ícono se guarda directo en el objeto del equipo dentro de
// mockTeams (ya es stateful in-memory, mismo patrón que mockUpdateTeam).
export async function mockUploadTeamIcon(teamId, uri) {
  const team = findTeamOrThrow(teamId);
  team.icon_url = uri;
  return { icon_url: uri };
}

export async function mockDeleteTeamIcon(teamId) {
  const team = findTeamOrThrow(teamId);
  team.icon_url = null;
  return null;
}
```

- [ ] **Step 8: Agregar `uploadTeamIcon`/`deleteTeamIcon` a `services/teams.js`**

Actualizar el import de mocks (línea 3-13) sumando los dos nombres nuevos, y agregar el import de `buildPhotoFormData`:

```js
import { buildPhotoFormData } from '../utils/build-photo-form-data.js';
import {
  mockCreateTeam,
  mockGetTeam,
  mockListTeams,
  mockUpdateTeam,
  mockUpdateTeamAddress,
  mockDeleteTeam,
  mockGetTeamUsers,
  mockAddTeamUser,
  mockRemoveTeamUser,
  mockUploadTeamIcon,
  mockDeleteTeamIcon,
} from './__mocks__/teams-mock.js';
```

Agregar al final del archivo:

```js
// PUT /api/v1/teams/{id}/icon — multipart/form-data, campo "photo". Solo
// el entrenador dueño (valida el backend). Máx 5MB, JPEG/PNG/WEBP.
export async function uploadTeamIcon(teamId, uri, mimeType) {
  if (USE_MOCKS) return await mockUploadTeamIcon(teamId, uri);
  const formData = await buildPhotoFormData(uri, { mimeType });
  return await api.putForm(`/teams/${teamId}/icon`, formData);
}

// DELETE /api/v1/teams/{id}/icon — solo el entrenador dueño, idempotente (204).
export async function deleteTeamIcon(teamId) {
  if (USE_MOCKS) return await mockDeleteTeamIcon(teamId);
  return await api.delete(`/teams/${teamId}/icon`);
}
```

- [ ] **Step 9: Extender el test de `teams-mock.test.js`**

```js
import { mockUploadTeamIcon, mockDeleteTeamIcon, mockGetTeam } from '../services/__mocks__/teams-mock.js';

describe('mockUploadTeamIcon / mockDeleteTeamIcon', () => {
  test('upload devuelve el URI recibido y lo persiste en el equipo', async () => {
    const result = await mockUploadTeamIcon(1, 'file:///tmp/icono.jpg');
    expect(result).toEqual({ icon_url: 'file:///tmp/icono.jpg' });
    const team = await mockGetTeam(1);
    expect(team.icon_url).toBe('file:///tmp/icono.jpg');
  });

  test('delete limpia icon_url del equipo', async () => {
    await mockUploadTeamIcon(1, 'file:///tmp/icono.jpg');
    await mockDeleteTeamIcon(1);
    const team = await mockGetTeam(1);
    expect(team.icon_url).toBeNull();
  });

  test('upload a un equipo inexistente tira error 404-like', async () => {
    await expect(mockUploadTeamIcon(9999, 'file:///tmp/icono.jpg')).rejects.toMatchObject({ status: 404 });
  });
});
```

- [ ] **Step 10: Correr toda la suite, confirmar que pasa**

Run: `npm test`
Expected: todos los suites en verde, incluidos los 3 archivos extendidos en este task.

- [ ] **Step 11: Lint**

Run: `npx eslint services/user.js services/teams.js services/__mocks__/user-mock.js services/__mocks__/teams-mock.js services/normalizers.js __tests__/user-mock.test.js __tests__/teams-mock.test.js __tests__/normalizers.test.js`
Expected: sin errores.

- [ ] **Step 12: Commit**

```bash
git add services/user.js services/teams.js services/__mocks__/user-mock.js services/__mocks__/teams-mock.js services/normalizers.js __tests__/user-mock.test.js __tests__/teams-mock.test.js __tests__/normalizers.test.js
git commit -m "feat(profile,teams): add photo/icon upload services, mocks and normalizers"
```

---

### Task 3: Acciones en los stores + componente `AvatarPicker`

**Files:**
- Modify: `store/auth-store.js`
- Modify: `store/team-store.js`
- Create: `components/shared/avatar-picker.jsx`

**Interfaces:**
- Consumes: `uploadUserPhoto`/`deleteUserPhoto` de Task 2 (`services/user.js`), `uploadTeamIcon`/`deleteTeamIcon` de Task 2 (`services/teams.js`), `toUserModel`/`toTeamModel` (ya traen `photoUrl`/`iconUrl` desde Task 2).
- Produces: `useAuthStore().uploadPhoto(uri, mimeType)` / `.deletePhoto()` → `Promise<{success, error?}>`. `useTeamStore().uploadTeamIcon(teamId, uri, mimeType)` / `.deleteTeamIcon(teamId)` → `Promise<{success, error?}>`. `AvatarPicker({ uri, onPick, onRemove, loading, size, fallbackIcon, idPrefix, accessibilityLabel })` desde `components/shared/avatar-picker.jsx` — sin `onPick`, el picker queda de solo lectura (sin lápiz, sin basurero, no tocable).

- [ ] **Step 1: Agregar `uploadPhoto`/`deletePhoto` a `store/auth-store.js`**

Modificar el import de servicios (línea 3):

```js
import { updateUser as updateUserService, changeStatus as changeStatusService, uploadUserPhoto as uploadUserPhotoService, deleteUserPhoto as deleteUserPhotoService } from '../services/user.js';
```

Agregar la acción después de `updateUser` (después de la línea 129, antes de `deactivateAccount`):

```js
  // Sube (o reemplaza) la foto de perfil — endpoint separado del PUT
  // general de /users/{id}, mismo criterio que la plomería de pagos: se
  // llama al servicio, se actualiza user.photoUrl en el store, se
  // persiste. mimeType opcional (services/user.js#uploadUserPhoto ya
  // tiene un default).
  uploadPhoto: async (uri, mimeType) => {
    const { user } = get();
    if (!user?.userId) return { success: false, error: 'No hay sesión activa.' };
    try {
      const { photo_url: photoUrl } = await uploadUserPhotoService(user.userId, uri, mimeType);
      const updated = { ...user, photoUrl };
      const { token, refreshToken, expiresAt, activeRole, roles } = get();
      set({ user: updated });
      await persist({ user: updated, token, refreshToken, expiresAt, activeRole, roles });
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  },

  deletePhoto: async () => {
    const { user } = get();
    if (!user?.userId) return { success: false, error: 'No hay sesión activa.' };
    try {
      await deleteUserPhotoService(user.userId);
      const updated = { ...user, photoUrl: null };
      const { token, refreshToken, expiresAt, activeRole, roles } = get();
      set({ user: updated });
      await persist({ user: updated, token, refreshToken, expiresAt, activeRole, roles });
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  },
```

- [ ] **Step 2: Agregar `uploadTeamIcon`/`deleteTeamIcon` a `store/team-store.js`**

Modificar el import de servicios (líneas 2-9):

```js
import {
  createTeam as createTeamService,
  getTeam as getTeamService,
  listTeams as listTeamsService,
  updateTeam as updateTeamService,
  updateTeamAddress as updateTeamAddressService,
  deleteTeam as deleteTeamService,
  uploadTeamIcon as uploadTeamIconService,
  deleteTeamIcon as deleteTeamIconService,
} from '../services/teams.js';
```

Agregar las acciones después de `updateTeam` (después de la línea 289, antes de `deleteTeam`):

```js
  // Sube (o reemplaza) el ícono del equipo — endpoint separado del PUT
  // general, mismo criterio que updateTeam: llama al servicio, mergea el
  // resultado en el equipo correspondiente del array `teams`.
  uploadTeamIcon: async (teamId, uri, mimeType) => {
    try {
      const { icon_url: iconUrl } = await uploadTeamIconService(teamId, uri, mimeType);
      set((state) => ({ teams: state.teams.map((t) => (t.id === teamId ? { ...t, iconUrl } : t)) }));
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  },

  deleteTeamIcon: async (teamId) => {
    try {
      await deleteTeamIconService(teamId);
      set((state) => ({ teams: state.teams.map((t) => (t.id === teamId ? { ...t, iconUrl: null } : t)) }));
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  },
```

- [ ] **Step 3: Crear `components/shared/avatar-picker.jsx`**

```jsx
// components/shared/avatar-picker.jsx
import { useEffect, useState } from 'react';
import { ActivityIndicator, Image, Pressable, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useThemeColors } from '../../theme/colors.js';

// Avatar circular con foto real (si hay `uri`) o ícono default —
// compartido entre foto de perfil (fallbackIcon="account") e ícono de
// equipo (fallbackIcon="account-group"). Sin `onPick`, queda de solo
// lectura: sin lápiz, sin basurero, no tocable — mismo componente sirve
// para "mi perfil" (siempre editable) y "detalle de equipo" (editable
// solo para el dueño). `onError` de la imagen cubre el 404 conocido del
// bucket de Supabase (ver docs/superpowers/specs/2026-09-03-profile-team-photo-upload-design.md)
// cayendo al ícono default en vez de mostrar un ícono roto.
export function AvatarPicker({ uri, onPick, onRemove, loading = false, size = 64, fallbackIcon, idPrefix, accessibilityLabel }) {
  const colors = useThemeColors();
  const [imageFailed, setImageFailed] = useState(false);

  useEffect(() => {
    setImageFailed(false);
  }, [uri]);

  const editable = Boolean(onPick);
  const showImage = Boolean(uri) && !imageFailed;

  return (
    <View className="relative" nativeID={`${idPrefix}-wrapper`} testID={`${idPrefix}-wrapper`}>
      <Pressable
        accessibilityLabel={accessibilityLabel}
        className="items-center justify-center overflow-hidden rounded-full bg-slate-100 hover:opacity-80 active:opacity-70 dark:bg-slate-800"
        disabled={loading || !editable}
        nativeID={`${idPrefix}-button`}
        onPress={onPick}
        style={{ height: size, width: size }}
        testID={`${idPrefix}-button`}
      >
        {showImage ? (
          <Image
            accessibilityLabel={accessibilityLabel}
            className="rounded-full"
            nativeID={`${idPrefix}-image`}
            onError={() => setImageFailed(true)}
            source={{ uri }}
            style={{ height: size, width: size }}
            testID={`${idPrefix}-image`}
          />
        ) : (
          <MaterialCommunityIcons color={colors.onSurfaceVariant} name={fallbackIcon} size={size * 0.5} />
        )}
        {loading && (
          <View className="absolute inset-0 items-center justify-center bg-black/40" nativeID={`${idPrefix}-loading`} testID={`${idPrefix}-loading`}>
            <ActivityIndicator color="#fff" size="small" />
          </View>
        )}
      </Pressable>

      {editable && !loading && (
        <View
          className="absolute -bottom-0.5 -right-0.5 h-5 w-5 items-center justify-center rounded-full border-2 border-white bg-primary dark:border-surface"
          nativeID={`${idPrefix}-edit-badge`}
          pointerEvents="none"
          testID={`${idPrefix}-edit-badge`}
        >
          <MaterialCommunityIcons color={colors.onPrimary} name="pencil" size={11} />
        </View>
      )}

      {showImage && !loading && onRemove && (
        <Pressable
          accessibilityLabel="Quitar foto"
          className="absolute -top-0.5 -right-0.5 h-5 w-5 items-center justify-center rounded-full border-2 border-white bg-red-500 dark:border-surface"
          nativeID={`${idPrefix}-remove-button`}
          onPress={onRemove}
          testID={`${idPrefix}-remove-button`}
        >
          <MaterialCommunityIcons color="#fff" name="trash-can-outline" size={11} />
        </Pressable>
      )}
    </View>
  );
}
```

- [ ] **Step 4: Lint**

Run: `npx eslint store/auth-store.js store/team-store.js components/shared/avatar-picker.jsx`
Expected: sin errores (`local/require-native-id` en verde — `Image`/`ActivityIndicator` no están en la lista que la regla exige, todo lo demás sí tiene `nativeID`/`testID`).

- [ ] **Step 5: `npm test` — confirmar que el resto de la suite sigue verde**

Run: `npm test`
Expected: sin regresiones (este task no agrega tests nuevos — stores y componentes no se testean por render/acción en este repo — pero no debe romper nada existente).

- [ ] **Step 6: Commit**

```bash
git add store/auth-store.js store/team-store.js components/shared/avatar-picker.jsx
git commit -m "feat(profile,teams): add upload/delete store actions and AvatarPicker component"
```

---

### Task 4: Wiring en pantallas + eliminar el picker local-only viejo

**Files:**
- Modify: `components/profile/profile-screen.jsx`
- Modify: `components/team/team-detail-screen.jsx`
- Modify: `components/team/team-general-info-fields.jsx`
- Modify: `hooks/use-team-general-info-form.js`
- Modify: `store/team-store.js:240-256` (comment cleanup — el `photoUri` que documentaba ya no existe)

**Interfaces:**
- Consumes: `AvatarPicker` de Task 3. `useAuthStore().user.photoUrl`/`.uploadPhoto`/`.deletePhoto` de Task 3. `useTeamStore().uploadTeamIcon`/`.deleteTeamIcon` de Task 3. `team.iconUrl` (ya viene de `toTeamModel`, Task 2).

- [ ] **Step 1: Eliminar el picker local-only de `team-general-info-fields.jsx`**

Reemplazar el `identity-row` completo (líneas 25-61) — queda solo el campo nombre, sin fila ni wrapper de foto:

```jsx
      <InputField dense error={form.errors.name} label="Nombre del equipo" onChange={form.setName} placeholder="Ej. Corredores del Sur" value={form.name} />
```

`View`, `Pressable`, `Image`, `MaterialCommunityIcons` y `useThemeColors`/`colors` (línea 21: `const colors = useThemeColors();`) se usaban **únicamente** dentro del bloque que se acaba de sacar — confirmado, no aparecen en ningún otro lugar del archivo. Quitar las 3 líneas de import de arriba del todo (líneas 1-3) y la línea `const colors = useThemeColors();`:

```jsx
import { isWeb } from '../../utils/platform.js';
import { InputField, PickerField, Row, Col, SelectField } from '../forms/fields.jsx';
import { ResponsiveSelectField } from '../forms/responsive-select-field.jsx';

const LEVEL_OPTIONS = [
  { id: 'amateur', name: 'Amateur' },
  { id: 'semi-profesional', name: 'Semi-profesional' },
  { id: 'profesional', name: 'Profesional' },
];

// Campos de "datos generales" de un equipo — compartidos por
// CreateTeamScreen (paso 1 del wizard) y EditTeamScreen (pantalla única).
// `form` viene de hooks/use-team-general-info-form.js. `idPrefix` distingue
// los nativeID/testID de los wrappers propios de este bloque entre
// pantallas (nunca están montadas a la vez, pero mantiene los ids legibles
// para debug). Ya no incluye foto — se sube desde el detalle de equipo ya
// creado (ver components/team/team-detail-screen.jsx), no en este wizard.
export function TeamGeneralInfoFields({ form, maxAllowed, idPrefix }) {
  return (
```

- [ ] **Step 2: Eliminar `photoUri`/`handlePickPhoto` de `hooks/use-team-general-info-form.js`**

Quitar el import de `expo-image-picker` y de `Toast` si quedan sin otro uso en el archivo (revisar — hoy solo los usa `handlePickPhoto`). Quitar la línea `const [photoUri, setPhotoUri] = useState(initial?.photoUri ?? null);` y toda la función `handlePickPhoto` (líneas 32-45). Quitar `photoUri` del objeto que devuelve `getValues()` (línea 72) y quitar `photoUri`/`handlePickPhoto` del objeto de retorno del hook (líneas 95-96).

- [ ] **Step 3: Limpiar el comentario desactualizado en `store/team-store.js`**

El comentario que precede a `updateTeam` (líneas 240-251) menciona `photoUri` como campo "interactivo del lado del cliente" — ya no existe ningún flujo que lo produzca tras los Steps 1-2. Reemplazar ese comentario:

```js
  // PUT general de datos de equipo (/teams/{id}, parcial) — grupos,
  // miembros, invitaciones, status e icon_url no se tocan desde acá (el
  // ícono tiene su propio endpoint, ver uploadTeamIcon/deleteTeamIcon más
  // abajo). `updates` puede traer country/province/city, secuenciados
  // aparte contra /teams/{id}/address — ver el bloque de abajo.
  // showGroupsToRunners sí tiene campo real en el backend desde
  // 2026-07-29 — se manda en el payload y el valor final sale de la
  // respuesta (generalModel), no del echo local. country/province/city se
  // excluyen del merge inicial a propósito — si el PUT de dirección de
  // abajo falla, no queremos mostrar como "guardado" un valor que en
  // realidad no se persistió.
```

No se toca el cuerpo de la función `updateTeam` — el spread de `clientOnlyAndGeneralUpdates` sigue igual, simplemente ya nunca va a traer `photoUri` porque ningún caller lo produce más.

- [ ] **Step 4: Wirear `AvatarPicker` en `profile-screen.jsx`**

Agregar el import:

```js
import { AvatarPicker } from '../shared/avatar-picker.jsx';
```

`HeaderPanel` (línea 77) gana 3 props nuevas: `photoUploading`, `onPickPhoto`, `onRemovePhoto`. Reemplazar el `<View>` del avatar en la rama desktop (líneas 89-91):

```jsx
          <AvatarPicker
            accessibilityLabel="Foto de perfil"
            fallbackIcon="account"
            idPrefix="profile-screen-avatar"
            loading={photoUploading}
            onPick={onPickPhoto}
            onRemove={onRemovePhoto}
            size={64}
            uri={user.photoUrl}
          />
```

Y en la rama mobile (líneas 111-113), mismo componente con `size={80}`:

```jsx
      <AvatarPicker
        accessibilityLabel="Foto de perfil"
        fallbackIcon="account"
        idPrefix="profile-screen-avatar"
        loading={photoUploading}
        onPick={onPickPhoto}
        onRemove={onRemovePhoto}
        size={80}
        uri={user.photoUrl}
      />
```

En `ProfileScreen` (la función que renderiza `HeaderPanel`, alrededor de la línea 178+), agregar:

`Toast` y `useState` ya están importados en este archivo — no duplicar. Agregar solo:

```js
import * as ImagePicker from 'expo-image-picker';
```

```js
  const uploadPhoto = useAuthStore((s) => s.uploadPhoto);
  const deletePhoto = useAuthStore((s) => s.deletePhoto);
  const [photoUploading, setPhotoUploading] = useState(false);

  const handlePickPhoto = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Toast.show({ type: 'error', text1: 'Permiso necesario', text2: 'Habilitá el acceso a tus fotos para elegir una imagen.' });
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (result.canceled) return;
    const asset = result.assets[0];
    if (asset.fileSize && asset.fileSize > 5 * 1024 * 1024) {
      Toast.show({ type: 'error', text1: 'La imagen es muy grande', text2: 'El máximo es 5MB.' });
      return;
    }
    setPhotoUploading(true);
    const uploadResult = await uploadPhoto(asset.uri, asset.mimeType);
    setPhotoUploading(false);
    if (!uploadResult.success) {
      Toast.show({ type: 'error', text1: 'No pudimos subir la foto', text2: uploadResult.error });
    }
  };

  const handleRemovePhoto = async () => {
    setPhotoUploading(true);
    const result = await deletePhoto();
    setPhotoUploading(false);
    if (!result.success) {
      Toast.show({ type: 'error', text1: 'No pudimos borrar la foto', text2: result.error });
    }
  };
```

Y pasar `photoUploading={photoUploading} onPickPhoto={handlePickPhoto} onRemovePhoto={handleRemovePhoto}` en los dos lugares donde se renderiza `<HeaderPanel ... />`.

- [ ] **Step 5: Wirear `AvatarPicker` en `team-detail-screen.jsx`**

Agregar el import:

```js
import { AvatarPicker } from '../shared/avatar-picker.jsx';
```

Reemplazar el bloque del ícono (líneas 1026-1032):

```jsx
          <AvatarPicker
            accessibilityLabel={`Ícono de ${team.name}`}
            fallbackIcon="account-group"
            idPrefix="team-detail-photo"
            loading={iconUploading}
            onPick={canDeleteTeam ? handlePickIcon : undefined}
            onRemove={canDeleteTeam ? handleRemoveIcon : undefined}
            size={64}
            uri={team.iconUrl}
          />
```

`Toast` y `useState` ya están importados en este archivo — no duplicar. `useTeamStore` también ya está importado (revisar el import existente y sumar `uploadTeamIcon`/`deleteTeamIcon` a la lista de selectors que ya se usan de ese store, no un import nuevo). Agregar solo:

```js
import * as ImagePicker from 'expo-image-picker';
```

Dentro del componente, cerca de donde ya se definen `canManageTeam`/`canDeleteTeam` (línea ~558):

```js
  const uploadTeamIcon = useTeamStore((s) => s.uploadTeamIcon);
  const deleteTeamIcon = useTeamStore((s) => s.deleteTeamIcon);
  const [iconUploading, setIconUploading] = useState(false);

  const handlePickIcon = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Toast.show({ type: 'error', text1: 'Permiso necesario', text2: 'Habilitá el acceso a tus fotos para elegir una imagen.' });
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (result.canceled) return;
    const asset = result.assets[0];
    if (asset.fileSize && asset.fileSize > 5 * 1024 * 1024) {
      Toast.show({ type: 'error', text1: 'La imagen es muy grande', text2: 'El máximo es 5MB.' });
      return;
    }
    setIconUploading(true);
    const uploadResult = await uploadTeamIcon(team.id, asset.uri, asset.mimeType);
    setIconUploading(false);
    if (!uploadResult.success) {
      Toast.show({ type: 'error', text1: 'No pudimos subir el ícono', text2: uploadResult.error });
    }
  };

  const handleRemoveIcon = async () => {
    setIconUploading(true);
    const result = await deleteTeamIcon(team.id);
    setIconUploading(false);
    if (!result.success) {
      Toast.show({ type: 'error', text1: 'No pudimos borrar el ícono', text2: result.error });
    }
  };
```

(`team`/`canDeleteTeam` ya existen en el scope de este componente — no se re-declaran.)

- [ ] **Step 6: Lint**

Run: `npx eslint components/profile/profile-screen.jsx components/team/team-detail-screen.jsx components/team/team-general-info-fields.jsx hooks/use-team-general-info-form.js store/team-store.js`
Expected: sin errores. Prestar atención a imports que hayan quedado sin uso tras el Step 1-2 (ESLint los marca).

- [ ] **Step 7: `npm test`**

Run: `npm test`
Expected: suite completa en verde — ningún test existente depende de `photoUri`/`handlePickPhoto` (si alguno lo hiciera, ajustarlo para reflejar que ya no existen).

- [ ] **Step 8: Verificación manual en preview web**

Con `EXPO_PUBLIC_USE_MOCKS=true`: loguearse, ir a `/profile` → tocar el avatar → elegir una imagen (en web, `expo-image-picker` abre el selector de archivos del browser) → se ve al instante con spinner, después queda fijo (mock "subió") → recargar la página → sigue ahí (persiste vía `paceron.auth`). Tocar el basurero → vuelve al ícono default. Repetir en el detalle de un equipo propio (`canDeleteTeam`) — mismo comportamiento. Loguearse como alguien que NO administra ese equipo → el ícono se ve sin lápiz ni basurero, no reacciona al tap.

- [ ] **Step 9: Commit**

```bash
git add components/profile/profile-screen.jsx components/team/team-detail-screen.jsx components/team/team-general-info-fields.jsx hooks/use-team-general-info-form.js store/team-store.js
git commit -m "feat(profile,teams): wire AvatarPicker into profile and team detail, remove old local-only picker"
```
