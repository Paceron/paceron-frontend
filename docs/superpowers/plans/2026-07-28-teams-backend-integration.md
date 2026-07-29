# Equipos: rutas en inglés + backend real + selects consistentes (Etapa 1 de 3) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Conectar las pantallas de equipos (`components/team/*`) al backend real, renombrar las rutas `equipos/` (español) a `teams/` (inglés), y corregir el picker de "Nivel del equipo" para que use `<select>` nativo en web en vez del modal de mobile.

**Architecture:** `store/team-store.js` deja de tener datos hardcodeados (`MOCK_TEAMS`) y pasa a llamar a una nueva capa `services/teams.js` (mismo patrón `USE_MOCKS` que `services/roles.js`), con mapeo camelCase↔snake_case en `services/normalizers.js`. Grupos, roster de miembros e invitaciones siguen siendo sintéticos del lado del cliente (el backend no los soporta todavía — ver `docs/BACKEND_API_GAPS.md`, nuevo en este plan) y se "decoran" sobre la respuesta real del equipo.

**Tech Stack:** Expo Router (file-based), Zustand (sin TanStack Query en esta etapa — decisión explícita, ver `docs/superpowers/specs/2026-07-28-teams-backend-integration-design.md`), NativeWind, Jest.

## Global Constraints

- Todo componente visual (`View`/`Text`/`Pressable`/etc., incl. `Animated.*`) lleva `nativeID` y `testID` únicos kebab-case (regla `local/require-native-id`, sin excepciones).
- `npm test` y `npm run lint` en verde en todo momento — sin excepciones.
- No hay tests de render de componentes (convención del proyecto) — pantallas/UI se verifican con lint + preview manual/agente, no con Jest.
- Idioma del código/comentarios: español (ya establecido en el repo). Nombres de rutas, ramas y funciones exportadas: inglés donde ya es la convención (ver rename de rutas).
- No introducir TanStack Query en esta etapa — `store/team-store.js` sigue el patrón Zustand + `services/*.js` async, igual que `store/auth-store.js`.
- Loading state siempre local a la pantalla (`useState`), nunca en el store.
- Commits chicos, uno por tarea, Conventional Commits (`feat`/`fix`/`refactor`/`docs`), subject en inglés.

---

### Task 1: Rename de rutas `equipos/` → `teams/`

**Files:**
- Rename: `app/(tabs)/equipos/crear.jsx` → `app/(tabs)/teams/create.jsx`
- Rename: `app/(tabs)/equipos/[teamId]/index.jsx` → `app/(tabs)/teams/[teamId]/index.jsx`
- Rename: `app/(tabs)/equipos/[teamId]/editar.jsx` → `app/(tabs)/teams/[teamId]/edit.jsx`
- Rename: `app/(tabs)/equipos/[teamId]/invitar.jsx` → `app/(tabs)/teams/[teamId]/invite.jsx`
- Rename: `app/(tabs)/equipos/[teamId]/grupos/[groupId]/editar.jsx` → `app/(tabs)/teams/[teamId]/groups/[groupId]/edit.jsx`
- Modify: `routes/catalog.js`
- Modify: `components/shell/app-web-shell.jsx` (2 call sites)
- Modify: `components/shell/app-web-shell-narrow.jsx` (2 call sites)
- Modify: `components/shell/app-mobile-shell.jsx` (2 call sites)
- Modify: `components/team/team-detail-screen.jsx` (3 call sites)
- Test: `__tests__/routes.catalog.test.js`

**Interfaces:**
- Produces: rutas navegables en `/teams`, `/teams/create`, `/teams/{id}`, `/teams/{id}/edit`, `/teams/{id}/invite`, `/teams/{id}/groups/{groupId}/edit`. `routes/catalog.js` exporta `teamsRoute` con `name: 'teams'`, `href: '/teams'`.

- [ ] **Step 1: Mover los 5 archivos de ruta con `git mv`, preservando el árbol de directorios necesario**

Run:
```bash
mkdir -p "app/(tabs)/teams/[teamId]/groups/[groupId]"
git mv "app/(tabs)/equipos/crear.jsx" "app/(tabs)/teams/create.jsx"
git mv "app/(tabs)/equipos/[teamId]/index.jsx" "app/(tabs)/teams/[teamId]/index.jsx"
git mv "app/(tabs)/equipos/[teamId]/editar.jsx" "app/(tabs)/teams/[teamId]/edit.jsx"
git mv "app/(tabs)/equipos/[teamId]/invitar.jsx" "app/(tabs)/teams/[teamId]/invite.jsx"
git mv "app/(tabs)/equipos/[teamId]/grupos/[groupId]/editar.jsx" "app/(tabs)/teams/[teamId]/groups/[groupId]/edit.jsx"
rmdir "app/(tabs)/equipos/[teamId]/grupos/[groupId]" "app/(tabs)/equipos/[teamId]/grupos" "app/(tabs)/equipos/[teamId]" "app/(tabs)/equipos"
```
Expected: los 5 archivos aparecen bajo `app/(tabs)/teams/...`, los directorios viejos `app/(tabs)/equipos/...` ya no existen.

- [ ] **Step 2: Renombrar la función exportada de cada archivo movido (mismo patrón que `app/(tabs)/profile/activate-trainer.jsx` → `ProfileActivateTrainer`)**

`app/(tabs)/teams/create.jsx` — reemplazar:
```jsx
export default function CrearEquipo() {
```
por:
```jsx
export default function TeamsCreate() {
```

`app/(tabs)/teams/[teamId]/index.jsx` — reemplazar:
```jsx
export default function EquipoDetalle() {
```
por:
```jsx
export default function TeamDetail() {
```

`app/(tabs)/teams/[teamId]/edit.jsx` — reemplazar:
```jsx
export default function EditarEquipo() {
```
por:
```jsx
export default function TeamEdit() {
```

`app/(tabs)/teams/[teamId]/invite.jsx` — reemplazar:
```jsx
export default function InvitarCorredores() {
```
por:
```jsx
export default function TeamInvite() {
```

`app/(tabs)/teams/[teamId]/groups/[groupId]/edit.jsx` — reemplazar:
```jsx
export default function EditarGrupo() {
```
por:
```jsx
export default function TeamGroupEdit() {
```

Los imports relativos NO cambian (misma profundidad de directorios en todos los casos).

- [ ] **Step 3: Actualizar `routes/catalog.js`**

Modify `routes/catalog.js`, reemplazar:
```js
// href no se usa para navegar directo: al presionar este item se abre un
// submenu (equipos + Crear equipo) en vez de ir a una pantalla propia.
export const teamsRoute = {
  name: 'equipos',
  label: 'Equipos',
  href: '/equipos',
  icon: 'account-group',
};
```
por:
```js
// href no se usa para navegar directo: al presionar este item se abre un
// submenu (equipos + Crear equipo) en vez de ir a una pantalla propia.
export const teamsRoute = {
  name: 'teams',
  label: 'Equipos',
  href: '/teams',
  icon: 'account-group',
};
```
`label` (texto visible) no cambia — es un rename de clave de ruta, no una traducción de interfaz.

- [ ] **Step 4: Actualizar los 3 shells — comparación `route.name === 'equipos'` y los 2 `router.push` de cada uno**

Modify `components/shell/app-web-shell.jsx`, reemplazar:
```jsx
              if (route.name === 'equipos') {
```
por:
```jsx
              if (route.name === 'teams') {
```

Y reemplazar:
```jsx
  const handleSelectTeam = (team) => {
    selectTeam(team.id);
    onClose();
    router.push(`/equipos/${team.id}`);
  };

  const handleCreateTeam = () => {
    onClose();
    router.push('/equipos/crear');
  };
```
por:
```jsx
  const handleSelectTeam = (team) => {
    selectTeam(team.id);
    onClose();
    router.push(`/teams/${team.id}`);
  };

  const handleCreateTeam = () => {
    onClose();
    router.push('/teams/create');
  };
```

Modify `components/shell/app-web-shell-narrow.jsx`, reemplazar:
```jsx
                  if (route.name === 'equipos') {
```
por:
```jsx
                  if (route.name === 'teams') {
```

Y reemplazar:
```jsx
  const handleSelectTeam = (team) => {
    selectTeam(team.id);
    onClose();
    router.push(`/equipos/${team.id}`);
  };

  const handleCreateTeam = () => {
    onClose();
    router.push('/equipos/crear');
  };
```
por:
```jsx
  const handleSelectTeam = (team) => {
    selectTeam(team.id);
    onClose();
    router.push(`/teams/${team.id}`);
  };

  const handleCreateTeam = () => {
    onClose();
    router.push('/teams/create');
  };
```

Modify `components/shell/app-mobile-shell.jsx`, reemplazar:
```jsx
                    if (route.name === 'equipos') {
```
por:
```jsx
                    if (route.name === 'teams') {
```

Y reemplazar:
```jsx
  const handleSelectTeam = (team) => {
    selectTeam(team.id);
    onClose();
    router.push(`/equipos/${team.id}`);
  };

  const handleCreateTeam = () => {
    onClose();
    router.push('/equipos/crear');
  };
```
por:
```jsx
  const handleSelectTeam = (team) => {
    selectTeam(team.id);
    onClose();
    router.push(`/teams/${team.id}`);
  };

  const handleCreateTeam = () => {
    onClose();
    router.push('/teams/create');
  };
```

- [ ] **Step 5: Actualizar los 3 `router.push` de `team-detail-screen.jsx`**

Modify `components/team/team-detail-screen.jsx`, reemplazar:
```jsx
          onPress={() => router.push(`/equipos/${team.id}/invitar`)}
```
por:
```jsx
          onPress={() => router.push(`/teams/${team.id}/invite`)}
```

Reemplazar:
```jsx
            onEdit={() => router.push(`/equipos/${team.id}/grupos/${group.id}/editar`)}
```
por:
```jsx
            onEdit={() => router.push(`/teams/${team.id}/groups/${group.id}/edit`)}
```

Reemplazar:
```jsx
              onPress={() => router.push(`/equipos/${team.id}/editar`)}
```
por:
```jsx
              onPress={() => router.push(`/teams/${team.id}/edit`)}
```

- [ ] **Step 6: Re-grepear por si quedó algún `/equipos` sin actualizar**

Run: `grep -rn "equipos" app/ components/ store/ routes/`
Expected: sin resultados (o solo comentarios/strings que mencionen "Equipos" como palabra visible, no como ruta).

- [ ] **Step 7: Sumar una aserción de regresión en el test de catálogo**

Modify `__tests__/routes.catalog.test.js`, reemplazar:
```js
import { homeRoute, navigationRoutes, getRoutesByRole } from '../routes/catalog.js';
```
por:
```js
import { homeRoute, navigationRoutes, getRoutesByRole, teamsRoute } from '../routes/catalog.js';
```

Y agregar, al final del archivo:
```js

describe('teamsRoute', () => {
  test('uses the English route key and href', () => {
    expect(teamsRoute.name).toBe('teams');
    expect(teamsRoute.href).toBe('/teams');
  });
});
```

- [ ] **Step 8: Correr tests y lint**

Run: `npm test -- routes.catalog.test.js`
Expected: PASS.

Run: `npm run lint`
Expected: sin errores.

- [ ] **Step 9: Commit**

```bash
git add app/(tabs)/teams routes/catalog.js components/shell/app-web-shell.jsx components/shell/app-web-shell-narrow.jsx components/shell/app-mobile-shell.jsx components/team/team-detail-screen.jsx __tests__/routes.catalog.test.js
git commit -m "feat(teams): rename equipos/ routes to English"
```

---

### Task 2: `services/normalizers.js` — mapeo de equipos

**Files:**
- Modify: `services/normalizers.js`
- Test: `__tests__/normalizers.test.js`

**Interfaces:**
- Produces: `toTeamModel(dto)`, `toCreateTeamPayload(form)`, `toUpdateTeamPayload(form)`, `toAddressPayload(form)` — consumidas por Task 3/4.
- `toTeamModel(dto)` devuelve `id` como **string** (`String(dto.id)`) aunque el backend lo mande como número — evita que comparaciones como `team.id === teamId` (route param, siempre string) fallen por mismatch de tipo.

- [ ] **Step 1: Escribir los tests (fallan porque las funciones no existen todavía)**

Modify `__tests__/normalizers.test.js`, reemplazar la primera línea:
```js
import { toUserModel, toRegisterPayload } from '../services/normalizers.js';
```
por:
```js
import { toUserModel, toRegisterPayload, toTeamModel, toCreateTeamPayload, toUpdateTeamPayload, toAddressPayload } from '../services/normalizers.js';
```

Agregar al final del archivo:
```js

describe('toTeamModel', () => {
  test('maps snake_case fields to camelCase and coerces id to string', () => {
    const dto = {
      id: 1, name: 'Corredores del Sur', description: 'desc', level: 'amateur',
      max_members: 20, owner_id: 7, requirements: 'req', status: 'activo',
      country: 'ARG', province: 'BA', city: 'La Plata', street: null, number: null,
      created_at: '2026-01-01T00:00:00.000Z', updated_at: '2026-01-02T00:00:00.000Z',
    };
    expect(toTeamModel(dto)).toEqual({
      id: '1', name: 'Corredores del Sur', description: 'desc', level: 'amateur',
      maxMembers: 20, ownerId: 7, requirements: 'req', status: 'activo',
      country: 'ARG', province: 'BA', city: 'La Plata', street: null, number: null,
      createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-02T00:00:00.000Z',
    });
  });

  test('returns null for falsy dto', () => {
    expect(toTeamModel(null)).toBeNull();
    expect(toTeamModel(undefined)).toBeNull();
  });
});

describe('toCreateTeamPayload', () => {
  test('maps required fields to snake_case', () => {
    const out = toCreateTeamPayload({ name: 'Corredores del Sur', maxMembers: 20, ownerId: 7 });
    expect(out).toEqual({ name: 'Corredores del Sur', max_members: 20, owner_id: 7 });
  });

  test('includes only non-empty optional fields', () => {
    const out = toCreateTeamPayload({
      name: 'Corredores del Sur', maxMembers: 20, ownerId: 7,
      description: 'desc', level: '', requirements: '  ',
    });
    expect(out.description).toBe('desc');
    expect(out).not.toHaveProperty('level');
    expect(out).not.toHaveProperty('requirements');
  });
});

describe('toUpdateTeamPayload', () => {
  test('includes only non-empty fields known to the backend', () => {
    const out = toUpdateTeamPayload({ name: 'Nuevo nombre', description: 'Nueva descripción', maxMembers: 15 });
    expect(out).toEqual({ name: 'Nuevo nombre', description: 'Nueva descripción', max_members: 15 });
  });

  test('drops fields the backend does not support (showGroupsToRunners, photoUri)', () => {
    const out = toUpdateTeamPayload({ name: 'X', showGroupsToRunners: true, photoUri: 'file://foo.jpg' });
    expect(out).toEqual({ name: 'X' });
  });
});

describe('toAddressPayload', () => {
  test('includes only non-empty location fields', () => {
    const out = toAddressPayload({ country: 'ARG', province: 'MZ', city: 'Mendoza Capital' });
    expect(out).toEqual({ country: 'ARG', province: 'MZ', city: 'Mendoza Capital' });
  });

  test('omits empty fields', () => {
    const out = toAddressPayload({ country: 'ARG', province: '', city: '  ' });
    expect(out).toEqual({ country: 'ARG' });
  });
});
```

- [ ] **Step 2: Correr los tests nuevos para verificar que fallan**

Run: `npm test -- normalizers.test.js`
Expected: FAIL — `toTeamModel is not a function` (y las demás).

- [ ] **Step 3: Implementar las funciones en `services/normalizers.js`**

Modify `services/normalizers.js`, agregar al final del archivo:
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
    createdAt: dto.created_at,
    updatedAt: dto.updated_at,
  };
}

export function toCreateTeamPayload(form) {
  const payload = {
    name: form.name,
    max_members: form.maxMembers,
    owner_id: form.ownerId,
  };

  const optional = {
    description: form.description,
    level: form.level,
    requirements: form.requirements,
  };

  for (const [key, value] of Object.entries(optional)) {
    if (value && String(value).trim()) payload[key] = value;
  }

  return payload;
}

// UpdateTeamRequest del backend no tiene campos de dirección (ver
// toAddressPayload, es un endpoint aparte) ni show_groups_to_runners/foto
// (sin campo en el backend todavía, ver docs/BACKEND_API_GAPS.md) — el
// whitelist de `optional` los descarta automáticamente si vienen en `form`.
export function toUpdateTeamPayload(form) {
  const payload = {};
  const optional = {
    name: form.name,
    description: form.description,
    level: form.level,
    max_members: form.maxMembers,
    requirements: form.requirements,
  };

  for (const [key, value] of Object.entries(optional)) {
    if (value !== undefined && value !== null && String(value).trim()) payload[key] = value;
  }

  return payload;
}

export function toAddressPayload(form) {
  const payload = {};
  const optional = { country: form.country, province: form.province, city: form.city };

  for (const [key, value] of Object.entries(optional)) {
    if (value && String(value).trim()) payload[key] = value;
  }

  return payload;
}
```

- [ ] **Step 4: Correr los tests para verificar que pasan**

Run: `npm test -- normalizers.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add services/normalizers.js __tests__/normalizers.test.js
git commit -m "feat(teams): add team payload/model normalizers"
```

---

### Task 3: `services/teams.js` + mock

**Files:**
- Create: `services/teams.js`
- Create: `services/__mocks__/teams-mock.js`
- Test: `__tests__/teams-mock.test.js`

**Interfaces:**
- Consumes: `api` de `services/api.js` (`get`/`post`/`put`/`delete`), `USE_MOCKS` de `config/env.js`.
- Produces: `createTeam(payload)`, `getTeam(teamId)`, `listTeams()`, `updateTeam(teamId, updates)`, `updateTeamAddress(teamId, address)`, `deleteTeam(teamId, userId)`, `getTeamUsers(teamId)`, `addTeamUser(teamId, userId, roleInTeam)`, `removeTeamUser(teamId, userId)` — consumidas por Task 4 (`store/team-store.js`). Todas devuelven la respuesta cruda del backend (snake_case) o del mock (misma shape).

- [ ] **Step 1: Crear el mock stateful `services/__mocks__/teams-mock.js`**

Create `services/__mocks__/teams-mock.js`:
```js
// Estado in-memory con la MISMA shape snake_case que el backend real (para
// que toTeamModel() funcione igual en ambas ramas) — mismo patrón stateful
// que roles-mock.js, necesario para probar crear→listar→editar de punta a
// punta con EXPO_PUBLIC_USE_MOCKS=true. owner_id: 1 en el primer equipo
// coincide con el user_id que devuelve auth-mock.js#mockLogin, para que el
// filtro de "mis equipos" (store/team-store.js#selectAdministeredTeams)
// tenga algo que mostrar contra el usuario demo.
function buildSeedTeams() {
  const now = new Date().toISOString();
  return [
    {
      id: 1, name: 'Corredores del Sur', description: 'Equipo de running enfocado en fondo y medio fondo, entrenamos 3 veces por semana.',
      level: 'amateur', max_members: 20, owner_id: 1, requirements: 'Compromiso de asistencia y ritmo base de 6 min/km.',
      status: 'activo', country: 'ARG', province: 'BA', city: 'La Plata', street: null, number: null,
      created_at: now, updated_at: now,
    },
    {
      id: 2, name: 'Running Cordoba Norte', description: 'Grupo competitivo orientado a carreras de calle de 10K y 21K.',
      level: 'semi-profesional', max_members: 20, owner_id: 99, requirements: 'Experiencia previa en carreras de calle.',
      status: 'activo', country: 'ARG', province: 'CD', city: 'Córdoba Capital', street: null, number: null,
      created_at: now, updated_at: now,
    },
    {
      id: 3, name: 'Maraton Runners', description: 'Preparación específica para maratón y ultramaratón.',
      level: 'profesional', max_members: 20, owner_id: 99, requirements: 'Base aeróbica mínima de 60km semanales.',
      status: 'activo', country: 'ARG', province: 'SF', city: 'Rosario', street: null, number: null,
      created_at: now, updated_at: now,
    },
  ];
}

let mockTeams = buildSeedTeams();
let mockTeamUsers = {};
let nextId = 4;

function findTeamOrThrow(teamId) {
  const team = mockTeams.find((t) => String(t.id) === String(teamId));
  if (!team) {
    const error = new Error('Equipo no encontrado.');
    error.status = 404;
    throw error;
  }
  return team;
}

export async function mockCreateTeam(payload) {
  const now = new Date().toISOString();
  const team = {
    id: nextId++,
    name: payload.name,
    description: payload.description ?? null,
    level: payload.level ?? null,
    max_members: payload.max_members,
    owner_id: payload.owner_id,
    requirements: payload.requirements ?? null,
    status: 'activo',
    country: null,
    province: null,
    city: null,
    street: null,
    number: null,
    created_at: now,
    updated_at: now,
  };
  mockTeams.push(team);
  return team;
}

export async function mockGetTeam(teamId) {
  return findTeamOrThrow(teamId);
}

// Devuelve una copia superficial del array — mockCreateTeam hace push()
// sobre mockTeams directamente, y un test que guarda `before = await
// mockListTeams()` antes de crear necesita que `before` no sea la MISMA
// referencia que después crece (si no, before.length también cambia).
export async function mockListTeams() {
  return [...mockTeams];
}

export async function mockUpdateTeam(teamId, updates) {
  const team = findTeamOrThrow(teamId);
  Object.assign(team, updates, { updated_at: new Date().toISOString() });
  return team;
}

export async function mockUpdateTeamAddress(teamId, address) {
  const team = findTeamOrThrow(teamId);
  Object.assign(team, address, { updated_at: new Date().toISOString() });
  return team;
}

export async function mockDeleteTeam(teamId, _userId) {
  mockTeams = mockTeams.filter((t) => String(t.id) !== String(teamId));
  return null;
}

export async function mockGetTeamUsers(teamId) {
  return mockTeamUsers[teamId] ?? [];
}

export async function mockAddTeamUser(teamId, userId, roleInTeam) {
  const entry = {
    id: Date.now(),
    user_id: userId,
    team_id: Number(teamId),
    role_in_team: roleInTeam,
    status: 'active',
    assignment_date: new Date().toISOString(),
  };
  mockTeamUsers[teamId] = [...(mockTeamUsers[teamId] ?? []), entry];
  return entry;
}

export async function mockRemoveTeamUser(teamId, userId) {
  mockTeamUsers[teamId] = (mockTeamUsers[teamId] ?? []).filter((u) => u.user_id !== userId);
  return null;
}

export function __resetMockTeams() {
  mockTeams = buildSeedTeams();
  mockTeamUsers = {};
  nextId = 4;
}
```

- [ ] **Step 2: Crear `services/teams.js`**

Create `services/teams.js`:
```js
import api from './api.js';
import { USE_MOCKS } from '../config/env.js';
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
} from './__mocks__/teams-mock.js';

// POST /api/v1/teams — team.CreateTeamRequest.
export async function createTeam(payload) {
  if (USE_MOCKS) return await mockCreateTeam(payload);
  return await api.post('/teams', payload);
}

// GET /api/v1/teams/{id}.
export async function getTeam(teamId) {
  if (USE_MOCKS) return await mockGetTeam(teamId);
  return await api.get(`/teams/${teamId}`);
}

// GET /api/v1/teams — devuelve TODO el sistema, sin filtro por usuario (ver
// docs/BACKEND_API_GAPS.md gap 1). El filtro "mis equipos" vive en
// store/team-store.js#selectAdministeredTeams, no acá.
export async function listTeams() {
  if (USE_MOCKS) return await mockListTeams();
  return await api.get('/teams');
}

// PUT /api/v1/teams/{id} — team.UpdateTeamRequest (parcial).
export async function updateTeam(teamId, updates) {
  if (USE_MOCKS) return await mockUpdateTeam(teamId, updates);
  return await api.put(`/teams/${teamId}`, updates);
}

// PUT /api/v1/teams/{id}/address — team.UpdateTeamAddressRequest. Endpoint
// separado del PUT general (decisión ya tomada del lado de backend).
export async function updateTeamAddress(teamId, address) {
  if (USE_MOCKS) return await mockUpdateTeamAddress(teamId, address);
  return await api.put(`/teams/${teamId}/address`, address);
}

// DELETE /api/v1/teams/{id}?user_id=.
export async function deleteTeam(teamId, userId) {
  if (USE_MOCKS) return await mockDeleteTeam(teamId, userId);
  return await api.delete(`/teams/${teamId}?user_id=${encodeURIComponent(userId)}`);
}

// GET /api/v1/teams/{id}/users. Sin consumidor en la UI de esta etapa
// (el roster sigue siendo sintético, ver store/team-store.js) — se agrega
// igual como espejo 1:1 barato del contrato ya documentado.
export async function getTeamUsers(teamId) {
  if (USE_MOCKS) return await mockGetTeamUsers(teamId);
  return await api.get(`/teams/${teamId}/users`);
}

// POST /api/v1/teams/{id}/users — teamuser.AddTeamUserRequest.
export async function addTeamUser(teamId, userId, roleInTeam) {
  if (USE_MOCKS) return await mockAddTeamUser(teamId, userId, roleInTeam);
  return await api.post(`/teams/${teamId}/users`, { user_id: userId, role_in_team: roleInTeam });
}

// DELETE /api/v1/teams/{id}/users/{user_id}.
export async function removeTeamUser(teamId, userId) {
  if (USE_MOCKS) return await mockRemoveTeamUser(teamId, userId);
  return await api.delete(`/teams/${teamId}/users/${userId}`);
}
```

- [ ] **Step 3: Test liviano del mock (mismo estilo que `__tests__/auth-mock.test.js`)**

Create `__tests__/teams-mock.test.js`:
```js
import { mockCreateTeam, mockGetTeam, mockListTeams, mockUpdateTeam, mockUpdateTeamAddress, __resetMockTeams } from '../services/__mocks__/teams-mock.js';

beforeEach(() => {
  __resetMockTeams();
});

describe('teams mock adapter', () => {
  test('mockListTeams returns the seeded teams with the backend response shape', async () => {
    const teams = await mockListTeams();
    expect(teams.length).toBeGreaterThan(0);
    teams.forEach((team) => {
      expect(team).toEqual(expect.objectContaining({
        id: expect.any(Number), name: expect.any(String), owner_id: expect.any(Number), status: 'activo',
      }));
    });
  });

  test('mockCreateTeam appends a new team with an incrementing id', async () => {
    const before = await mockListTeams();
    const created = await mockCreateTeam({ name: 'Nuevo equipo', max_members: 10, owner_id: 1 });
    const after = await mockListTeams();
    expect(after.length).toBe(before.length + 1);
    expect(created.name).toBe('Nuevo equipo');
    expect(created.status).toBe('activo');
  });

  test('mockGetTeam returns a single team and throws a 404-like error for an unknown id', async () => {
    const team = await mockGetTeam(1);
    expect(team.id).toBe(1);
    await expect(mockGetTeam(9999)).rejects.toThrow('Equipo no encontrado.');
  });

  test('mockUpdateTeam merges the given fields', async () => {
    const updated = await mockUpdateTeam(1, { name: 'Nombre nuevo' });
    expect(updated.name).toBe('Nombre nuevo');
    expect((await mockGetTeam(1)).name).toBe('Nombre nuevo');
  });

  test('mockUpdateTeamAddress merges only the address fields', async () => {
    const updated = await mockUpdateTeamAddress(1, { country: 'ARG', province: 'MZ', city: 'Mendoza Capital' });
    expect(updated.country).toBe('ARG');
    expect(updated.province).toBe('MZ');
    expect(updated.city).toBe('Mendoza Capital');
  });
});
```

- [ ] **Step 4: Correr los tests**

Run: `npm test -- teams-mock.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add services/teams.js services/__mocks__/teams-mock.js __tests__/teams-mock.test.js
git commit -m "feat(teams): add teams service layer and mock adapter"
```

---

### Task 4: `store/team-store.js` — reescritura contra backend real

**Files:**
- Modify: `store/team-store.js`
- Test: `__tests__/team-store.test.js` (reescritura completa)

**Interfaces:**
- Consumes: `createTeam`, `getTeam`, `listTeams`, `updateTeam`, `updateTeamAddress` de `services/teams.js` (Task 3); `toTeamModel`, `toCreateTeamPayload`, `toUpdateTeamPayload`, `toAddressPayload` de `services/normalizers.js` (Task 2).
- Produces: `useTeamStore` con estado `{ teams, selectedTeamId }` y acciones `selectTeam(teamId)`, `fetchTeams()` → `{success, error?}`, `fetchTeam(teamId)` → `{success, error?}`, `createTeam(payload)` → `{success, team?, addressWarning?, error?}`, `updateTeam(teamId, updates)` → mismo shape, `updateGroup(teamId, groupId, updates)`, `addInvitedEmails(teamId, invites)` (sync, sin cambios de contrato). Exporta también `selectAdministeredTeams(teams, userId)` (función pura, no hook) — consumida por Task 9.

- [ ] **Step 1: Reescribir `store/team-store.js`**

Modify `store/team-store.js` — reemplazar el archivo completo por:
```js
import { create } from 'zustand';
import {
  createTeam as createTeamService,
  getTeam as getTeamService,
  listTeams as listTeamsService,
  updateTeam as updateTeamService,
  updateTeamAddress as updateTeamAddressService,
} from '../services/teams.js';
import { toTeamModel, toCreateTeamPayload, toUpdateTeamPayload, toAddressPayload } from '../services/normalizers.js';

// Tope de integrantes por tier del entrenador. 'base' es el plan free.
// 'pro'/'premium' hoy no los asigna ningun mock todavia (roles-mock.js
// siempre devuelve 'base'), pero el tope ya queda resuelto para cuando el
// sistema de tiers crezca mas alla de solo base/premium.
export const TEAM_MEMBER_LIMITS = {
  base: 10,
  pro: 50,
  premium: 300,
};

export function getTeamMemberLimit(tier) {
  return TEAM_MEMBER_LIMITS[tier] ?? TEAM_MEMBER_LIMITS.base;
}

// Nombre visible del grupo default de cada equipo. No hay integrante sin
// grupo: todo el que se suma sin elegir uno cae aca. A nivel de datos es
// un grupo mas (con isDefault: true para poder distinguirlo si hiciera
// falta proteger/ocultarlo en una UI de gestion de grupos a futuro), pero
// nunca se le muestra al usuario como "default" — su nombre visible ya es
// literalmente "Sin grupo".
export const DEFAULT_GROUP_NAME = 'Sin grupo';

// Sin dominio de suscripciones/cobros todavia (ver FUNCTIONAL_PROPOSE.md,
// "Sistema de suscripciones y cobros" sigue siendo un modulo reservado) —
// mismos tres estados que ya prevé esa seccion funcional.
export const SUBSCRIPTION_STATUSES = ['activo', 'vencido', 'en_prueba'];

// Sin dominio de planes de entrenamiento todavia (ver FUNCTIONAL_PROPOSE.md,
// "Planificacion de entrenamientos" sigue siendo un modulo reservado, no
// implementado) — catalogo mock compartido por el wizard de creacion y la
// pantalla de detalle (pestaña Grupos), hasta que exista ese servicio real.
export const TRAINING_PLAN_OPTIONS = [
  { id: 'plan-5k', name: 'Plan 5K' },
  { id: 'plan-10k', name: 'Plan 10K' },
  { id: 'plan-21k', name: 'Plan 21K (medio maratón)' },
  { id: 'plan-42k', name: 'Plan 42K (maratón)' },
];

const RUNNER_FIRST_NAMES = ['Lucía', 'Martín', 'Sofía', 'Nicolás', 'Valentina', 'Tomás', 'Camila', 'Agustín', 'Julieta', 'Franco'];
const RUNNER_LAST_NAMES = ['Fernández', 'Gómez', 'Rodríguez', 'López', 'Díaz', 'Martínez', 'Pérez', 'Sánchez', 'Romero', 'Torres'];
const MOCK_ROSTER_SIZE = 6;
const ACCENTS = { á: 'a', é: 'e', í: 'i', ó: 'o', ú: 'u' };
const DAY_MS = 24 * 60 * 60 * 1000;

// Reemplazo manual de tildes (en vez de String.prototype.normalize) para no
// depender de soporte Unicode completo del motor JS en todas las
// plataformas — la lista de nombres/apellidos de arriba es fija y chica.
function slugifyForEmail(value) {
  return value
    .toLowerCase()
    .split('')
    .map((ch) => ACCENTS[ch] ?? ch)
    .join('')
    .replace(/[^a-z]+/g, '');
}

// Sin backend de miembros de equipo conectado todavia (existe
// services/teams.js#getTeamUsers, pero nada lo llama — ver
// docs/BACKEND_API_GAPS.md) — genera un roster de ejemplo determinista
// (mismo teamId + grupos siempre dan el mismo resultado) repartido entre
// los grupos existentes, para que la pantalla de detalle de equipo tenga
// datos con los que probarse de entrada, incluso contra un equipo real del
// backend. joinedAt se escalona por integrante (30 dias de diferencia
// entre uno y el siguiente) para que la antiguedad ("hace X meses en el
// equipo") no sea igual para todos.
function generateMockMembers(teamId, groups) {
  return Array.from({ length: MOCK_ROSTER_SIZE }, (_, i) => {
    const firstName = RUNNER_FIRST_NAMES[i % RUNNER_FIRST_NAMES.length];
    const lastName = RUNNER_LAST_NAMES[(i * 3) % RUNNER_LAST_NAMES.length];
    return {
      id: `${teamId}-runner-${i}`,
      name: `${firstName} ${lastName}`,
      email: `${slugifyForEmail(firstName)}.${slugifyForEmail(lastName)}@mail.com`,
      subscriptionStatus: SUBSCRIPTION_STATUSES[i % SUBSCRIPTION_STATUSES.length],
      groupId: groups[i % groups.length].id,
      joinedAt: new Date(Date.now() - (i + 1) * 30 * DAY_MS).toISOString(),
    };
  });
}

function buildDefaultGroup(teamId) {
  return { id: `${teamId}-group-default`, name: DEFAULT_GROUP_NAME, description: null, trainingPlanId: null, isDefault: true };
}

// Sin un directorio real de usuarios registrados todavia (no hay backend de
// invitaciones, ver docs/BACKEND_API_GAPS.md) — mock determinista derivado
// del email mismo (mismo email siempre resuelve igual) para poder mostrar
// "usuario registrado" vs. "sin registrar" en la pantalla de invitaciones
// sin inventar una lista global de usuarios aparte.
function isRegisteredMockEmail(email) {
  let sum = 0;
  for (let i = 0; i < email.length; i += 1) sum += email.charCodeAt(i);
  return sum % 2 === 0;
}

// Arma una invitacion completa a partir de { email, groupId } (lo que sale
// de EmailListField): resuelve el grupo default si no se eligio ninguno, y
// completa invitedAt/registered — el momento real en que se armo la
// invitacion, no un mock, mas el estado de registrado (mock, ver arriba).
function buildInvitedEmail(invite, defaultGroupId) {
  return {
    email: invite.email,
    groupId: invite.groupId || defaultGroupId,
    invitedAt: new Date().toISOString(),
    registered: isRegisteredMockEmail(invite.email),
  };
}

// Completa un equipo real (ya normalizado por toTeamModel — camelCase, id
// como string) con los datos que el backend todavia no soporta: grupos,
// roster e invitaciones, mas showGroupsToRunners/foto (ver
// docs/BACKEND_API_GAPS.md). `extra.groups`/`extra.invitedEmails` solo
// existen recien creado el equipo (vienen del wizard) — un equipo traido
// por fetchTeams/fetchTeam no tiene ese contexto, asi que arranca solo con
// el grupo default.
function decorateTeam(team, extra = {}) {
  const defaultGroup = buildDefaultGroup(team.id);
  const groups = [...(extra.groups ?? []), defaultGroup];
  const invitedEmails = (extra.invitedEmails ?? []).map((invite) => buildInvitedEmail(invite, defaultGroup.id));

  return {
    ...team,
    status: team.status ?? 'activo',
    photoUri: extra.photoUri ?? null,
    showGroupsToRunners: false,
    groups,
    members: generateMockMembers(team.id, groups),
    invitedEmails,
  };
}

// Equipos que el usuario administra (owner_id === userId) — el backend no
// tiene todavia un endpoint "mis equipos" (docs/BACKEND_API_GAPS.md), asi
// que se resuelve del lado del cliente filtrando GET /teams completo. No
// incluye equipos donde el usuario participa como corredor (ese caso no se
// puede resolver de ningun modo hoy, ver el mismo gap).
export function selectAdministeredTeams(teams, userId) {
  if (!userId) return [];
  return teams.filter((team) => team.ownerId === userId);
}

export const useTeamStore = create((set, get) => ({
  teams: [],
  selectedTeamId: null,

  selectTeam: (teamId) => set({ selectedTeamId: teamId }),

  // Trae todos los equipos del sistema (GET /teams, sin filtro — el filtro
  // de "mis equipos" vive en selectAdministeredTeams). Un equipo ya
  // presente en el store (ej. recien creado en esta sesion) conserva sus
  // campos local-only (grupos, roster, invitaciones, showGroupsToRunners,
  // foto) en vez de perderlos — solo un equipo nuevo para el store arranca
  // decorado desde cero.
  fetchTeams: async () => {
    try {
      const dtos = await listTeamsService();
      set((state) => ({
        teams: dtos.map((dto) => {
          const model = toTeamModel(dto);
          const existing = state.teams.find((t) => t.id === model.id);
          return existing ? { ...existing, ...model } : decorateTeam(model);
        }),
      }));
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  },

  // Trae un equipo puntual (GET /teams/{id}) — para cuando se entra por
  // deep-link a un equipo que todavia no esta en `teams` (ej. recargar la
  // pagina de detalle/edicion directo por URL).
  fetchTeam: async (teamId) => {
    try {
      const dto = await getTeamService(teamId);
      const model = toTeamModel(dto);
      set((state) => {
        const existing = state.teams.find((t) => t.id === teamId);
        const team = existing ? { ...existing, ...model } : decorateTeam(model);
        const alreadyListed = state.teams.some((t) => t.id === teamId);
        return {
          teams: alreadyListed ? state.teams.map((t) => (t.id === teamId ? team : t)) : [...state.teams, team],
        };
      });
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  },

  // Crea el equipo contra el backend real (POST /teams) y lo selecciona.
  // Si el payload trae algun campo de ubicacion, encadena inmediatamente
  // PUT /teams/{id}/address — si esa segunda llamada falla, el resultado
  // sigue siendo exito (el equipo ya existe) con `addressWarning: true`
  // para que la pantalla muestre un aviso secundario en vez de un error
  // duro. Grupos/invitaciones armados en el wizard (payload.groups/
  // invitedEmails) y la foto (payload.photoUri) no tienen campo en el
  // backend todavia (ver docs/BACKEND_API_GAPS.md) — se guardan solo del
  // lado del cliente via decorateTeam, se pierden al recargar.
  createTeam: async (payload) => {
    try {
      const created = await createTeamService(toCreateTeamPayload(payload));
      let team = decorateTeam(toTeamModel(created), {
        groups: payload.groups,
        invitedEmails: payload.invitedEmails,
        photoUri: payload.photoUri,
      });
      set((state) => ({ teams: [...state.teams, team], selectedTeamId: team.id }));

      const hasAddress = Boolean(payload.country || payload.province || payload.city);
      if (!hasAddress) return { success: true, team };

      try {
        await updateTeamAddressService(team.id, toAddressPayload(payload));
        team = { ...team, country: payload.country || null, province: payload.province || null, city: payload.city || null };
        set((state) => ({ teams: state.teams.map((t) => (t.id === team.id ? team : t)) }));
        return { success: true, team };
      } catch {
        return { success: true, team, addressWarning: true };
      }
    } catch (error) {
      return { success: false, error: error.message };
    }
  },

  // Edita los "datos generales" de un equipo ya existente (PUT
  // /teams/{id}, parcial) — grupos, miembros, invitaciones y status no se
  // tocan desde acá. `updates` puede traer country/province/city
  // (secuenciados aparte, ver abajo) y showGroupsToRunners/photoUri
  // (interactivos del lado del cliente, sin campo en el backend — ver
  // docs/BACKEND_API_GAPS.md): se conservan en el equipo resultante vía
  // `clientOnlyAndGeneralUpdates`, pero toUpdateTeamPayload los descarta
  // antes de mandarlos al PUT general. country/province/city se excluyen
  // de ese merge inicial a propósito — si el PUT de dirección de abajo
  // falla, no queremos mostrar como "guardado" un valor que en realidad no
  // se persistió.
  updateTeam: async (teamId, updates) => {
    const team = get().teams.find((t) => t.id === teamId);
    if (!team) return { success: false, error: 'Equipo no encontrado.' };

    const { country: _country, province: _province, city: _city, ...clientOnlyAndGeneralUpdates } = updates;

    try {
      const updated = await updateTeamService(teamId, toUpdateTeamPayload(updates));
      const generalModel = toTeamModel(updated);
      let merged = {
        ...team,
        ...clientOnlyAndGeneralUpdates,
        name: generalModel.name,
        description: generalModel.description,
        level: generalModel.level,
        maxMembers: generalModel.maxMembers,
        requirements: generalModel.requirements,
        status: generalModel.status,
        updatedAt: generalModel.updatedAt,
      };
      set((state) => ({ teams: state.teams.map((t) => (t.id === teamId ? merged : t)) }));

      const hasAddress = Boolean(updates.country || updates.province || updates.city);
      if (!hasAddress) return { success: true, team: merged };

      try {
        await updateTeamAddressService(teamId, toAddressPayload(updates));
        merged = { ...merged, country: updates.country || null, province: updates.province || null, city: updates.city || null };
        set((state) => ({ teams: state.teams.map((t) => (t.id === teamId ? merged : t)) }));
        return { success: true, team: merged };
      } catch {
        return { success: true, team: merged, addressWarning: true };
      }
    } catch (error) {
      return { success: false, error: error.message };
    }
  },

  // Edita nombre/plan de un grupo puntual dentro de un equipo. Local-only
  // (Etapa 2/3, ver docs/BACKEND_API_GAPS.md) — no toca membresía.
  updateGroup: (teamId, groupId, updates) => {
    set((state) => ({
      teams: state.teams.map((team) => {
        if (team.id !== teamId) return team;
        return { ...team, groups: team.groups.map((group) => (group.id === groupId ? { ...group, ...updates } : group)) };
      }),
    }));
  },

  // Suma invitaciones nuevas a un equipo ya existente. Local-only (Etapa 3,
  // ver docs/BACKEND_API_GAPS.md) — ignora emails ya invitados, sin
  // distinguir mayúsculas/minúsculas.
  addInvitedEmails: (teamId, invites) => {
    set((state) => ({
      teams: state.teams.map((team) => {
        if (team.id !== teamId) return team;
        const defaultGroup = team.groups.find((g) => g.isDefault);
        const existingEmails = new Set(team.invitedEmails.map((inv) => inv.email.toLowerCase()));
        const newOnes = invites
          .filter((invite) => !existingEmails.has(invite.email.toLowerCase()))
          .map((invite) => buildInvitedEmail(invite, defaultGroup?.id ?? ''));
        return { ...team, invitedEmails: [...team.invitedEmails, ...newOnes] };
      }),
    }));
  },
}));
```

- [ ] **Step 2: Reescribir `__tests__/team-store.test.js` (mockeando `services/teams.js` directo, mismo patrón que `__tests__/auth-store.test.js`)**

Modify `__tests__/team-store.test.js` — reemplazar el archivo completo por:
```js
import { useTeamStore, getTeamMemberLimit, TEAM_MEMBER_LIMITS, DEFAULT_GROUP_NAME, selectAdministeredTeams } from '../store/team-store.js';

jest.mock('../services/teams.js', () => ({
  createTeam: jest.fn(),
  getTeam: jest.fn(),
  listTeams: jest.fn(),
  updateTeam: jest.fn(),
  updateTeamAddress: jest.fn(),
}));

import {
  createTeam as createTeamService,
  getTeam as getTeamService,
  listTeams as listTeamsService,
  updateTeam as updateTeamService,
  updateTeamAddress as updateTeamAddressService,
} from '../services/teams.js';

const TEAM_DTO = {
  id: 1, name: 'Fondistas del Oeste', description: 'Grupo de entrenamiento', level: 'amateur',
  max_members: 10, owner_id: 7, requirements: 'Nivel intermedio', status: 'activo',
  country: null, province: null, city: null, street: null, number: null,
  created_at: '2026-01-01T00:00:00.000Z', updated_at: '2026-01-01T00:00:00.000Z',
};

beforeEach(() => {
  jest.clearAllMocks();
  useTeamStore.setState({ teams: [], selectedTeamId: null });
});

describe('getTeamMemberLimit', () => {
  test('resolves the limit for each known tier', () => {
    expect(getTeamMemberLimit('base')).toBe(TEAM_MEMBER_LIMITS.base);
    expect(getTeamMemberLimit('pro')).toBe(TEAM_MEMBER_LIMITS.pro);
    expect(getTeamMemberLimit('premium')).toBe(TEAM_MEMBER_LIMITS.premium);
  });

  test('falls back to base for an unknown or missing tier', () => {
    expect(getTeamMemberLimit('unknown')).toBe(TEAM_MEMBER_LIMITS.base);
    expect(getTeamMemberLimit(undefined)).toBe(TEAM_MEMBER_LIMITS.base);
  });
});

describe('team store', () => {
  test('createTeam calls the service, decorates the response, appends and selects it', async () => {
    createTeamService.mockResolvedValue(TEAM_DTO);
    const result = await useTeamStore.getState().createTeam({
      name: 'Fondistas del Oeste', maxMembers: 10, description: 'Grupo de entrenamiento',
      requirements: 'Nivel intermedio', level: 'amateur', ownerId: 7,
      groups: [{ id: 'group-draft-1', name: 'Avanzados', trainingPlanId: 'plan-21k' }],
      invitedEmails: [{ email: 'a@b.com', groupId: 'group-draft-1' }],
    });

    expect(createTeamService).toHaveBeenCalledWith(expect.objectContaining({ name: 'Fondistas del Oeste', max_members: 10, owner_id: 7 }));
    expect(result.success).toBe(true);
    expect(result.team.id).toBe('1');
    const s = useTeamStore.getState();
    expect(s.teams).toContainEqual(result.team);
    expect(s.selectedTeamId).toBe('1');
    expect(result.team.invitedEmails).toEqual([{
      email: 'a@b.com', groupId: 'group-draft-1', invitedAt: expect.any(String), registered: expect.any(Boolean),
    }]);
  });

  test('createTeam always adds a default "Sin grupo" group besides the drafted ones', async () => {
    createTeamService.mockResolvedValue(TEAM_DTO);
    const result = await useTeamStore.getState().createTeam({
      name: 'Con grupos', maxMembers: 10, ownerId: 7,
      groups: [{ id: 'group-draft-1', name: 'Avanzados', trainingPlanId: null }],
    });
    const defaultGroup = result.team.groups.find((g) => g.isDefault);
    expect(result.team.groups).toHaveLength(2);
    expect(defaultGroup.name).toBe(DEFAULT_GROUP_NAME);
    expect(result.team.groups.some((g) => g.name === 'Avanzados')).toBe(true);
  });

  test('createTeam resolves invites without a chosen group to the default group', async () => {
    createTeamService.mockResolvedValue(TEAM_DTO);
    const result = await useTeamStore.getState().createTeam({
      name: 'Sin grupos propios', maxMembers: 10, ownerId: 7,
      invitedEmails: [{ email: 'sin-grupo@b.com', groupId: '' }],
    });
    const defaultGroup = result.team.groups.find((g) => g.isDefault);
    expect(result.team.invitedEmails).toEqual([{
      email: 'sin-grupo@b.com', groupId: defaultGroup.id, invitedAt: expect.any(String), registered: expect.any(Boolean),
    }]);
  });

  test('createTeam defaults photoUri to null and invitedEmails to an empty array', async () => {
    createTeamService.mockResolvedValue(TEAM_DTO);
    const result = await useTeamStore.getState().createTeam({ name: 'Sin datos opcionales', maxMembers: 10, ownerId: 7 });
    expect(result.team.photoUri).toBeNull();
    expect(result.team.invitedEmails).toEqual([]);
    expect(result.team.groups).toHaveLength(1);
    expect(result.team.groups[0].isDefault).toBe(true);
  });

  test('createTeam defaults showGroupsToRunners to false — not exposed in the creation wizard', async () => {
    createTeamService.mockResolvedValue(TEAM_DTO);
    const result = await useTeamStore.getState().createTeam({ name: 'Sin config de privacidad', maxMembers: 10, ownerId: 7 });
    expect(result.team.showGroupsToRunners).toBe(false);
  });

  test('createTeam chains updateTeamAddress when the payload has location fields, and merges the address into the team', async () => {
    createTeamService.mockResolvedValue(TEAM_DTO);
    updateTeamAddressService.mockResolvedValue({});
    const result = await useTeamStore.getState().createTeam({
      name: 'Con ubicación', maxMembers: 10, ownerId: 7, country: 'ARG', province: 'MZ', city: 'Mendoza Capital',
    });
    expect(updateTeamAddressService).toHaveBeenCalledWith('1', { country: 'ARG', province: 'MZ', city: 'Mendoza Capital' });
    expect(result.success).toBe(true);
    expect(result.addressWarning).toBeUndefined();
    expect(result.team.country).toBe('ARG');
    expect(result.team.province).toBe('MZ');
    expect(result.team.city).toBe('Mendoza Capital');
  });

  test('createTeam does not call updateTeamAddress when no location field was filled', async () => {
    createTeamService.mockResolvedValue(TEAM_DTO);
    const result = await useTeamStore.getState().createTeam({ name: 'Sin ubicación', maxMembers: 10, ownerId: 7 });
    expect(updateTeamAddressService).not.toHaveBeenCalled();
    expect(result.team.country).toBeNull();
  });

  test('createTeam succeeds with a soft addressWarning when the address call fails — the team already exists', async () => {
    createTeamService.mockResolvedValue(TEAM_DTO);
    updateTeamAddressService.mockRejectedValue(new Error('falló'));
    const result = await useTeamStore.getState().createTeam({
      name: 'Con dirección fallida', maxMembers: 10, ownerId: 7, country: 'ARG', province: 'MZ', city: 'Mendoza Capital',
    });
    expect(result.success).toBe(true);
    expect(result.addressWarning).toBe(true);
    expect(useTeamStore.getState().teams).toContainEqual(result.team);
  });

  test('createTeam returns a failure result when the service call rejects', async () => {
    createTeamService.mockRejectedValue(new Error('Equipo inválido.'));
    const result = await useTeamStore.getState().createTeam({ name: 'X', maxMembers: 10, ownerId: 7 });
    expect(result).toEqual({ success: false, error: 'Equipo inválido.' });
    expect(useTeamStore.getState().teams).toEqual([]);
  });

  test('createTeam defaults to status activo and generates a mock roster referencing real groups', async () => {
    createTeamService.mockResolvedValue(TEAM_DTO);
    const result = await useTeamStore.getState().createTeam({ name: 'Con roster', maxMembers: 10, ownerId: 7 });
    expect(result.team.status).toBe('activo');
    expect(result.team.members.length).toBeGreaterThan(0);
    const groupIds = result.team.groups.map((g) => g.id);
    result.team.members.forEach((member) => {
      expect(groupIds).toContain(member.groupId);
      expect(member.name).toEqual(expect.any(String));
      expect(member.email).toMatch(/^[a-z]+\.[a-z]+@mail\.com$/);
      expect(member.subscriptionStatus).toEqual(expect.any(String));
      expect(new Date(member.joinedAt).toString()).not.toBe('Invalid Date');
      expect(new Date(member.joinedAt).getTime()).toBeLessThan(Date.now());
    });
  });

  test('fetchTeams lists teams from the service and decorates each one', async () => {
    listTeamsService.mockResolvedValue([TEAM_DTO, { ...TEAM_DTO, id: 2, name: 'Otro equipo', owner_id: 9 }]);
    const result = await useTeamStore.getState().fetchTeams();
    expect(result).toEqual({ success: true });
    const s = useTeamStore.getState();
    expect(s.teams).toHaveLength(2);
    expect(s.teams[0].groups.some((g) => g.isDefault)).toBe(true);
    expect(s.teams[0].members.length).toBeGreaterThan(0);
  });

  test('fetchTeams preserves local-only fields (groups) for a team already known in this session', async () => {
    createTeamService.mockResolvedValue(TEAM_DTO);
    const created = await useTeamStore.getState().createTeam({
      name: 'Con grupo propio', maxMembers: 10, ownerId: 7,
      groups: [{ id: 'group-draft-1', name: 'Avanzados', trainingPlanId: null }],
    });
    listTeamsService.mockResolvedValue([TEAM_DTO]);
    await useTeamStore.getState().fetchTeams();
    const refetched = useTeamStore.getState().teams.find((t) => t.id === created.team.id);
    expect(refetched.groups.some((g) => g.name === 'Avanzados')).toBe(true);
  });

  test('fetchTeams returns a failure result when the service call rejects', async () => {
    listTeamsService.mockRejectedValue(new Error('Sin conexión.'));
    const result = await useTeamStore.getState().fetchTeams();
    expect(result).toEqual({ success: false, error: 'Sin conexión.' });
  });

  test('fetchTeam adds a team not yet in the store (deep-link) and decorates it', async () => {
    getTeamService.mockResolvedValue(TEAM_DTO);
    const result = await useTeamStore.getState().fetchTeam('1');
    expect(result).toEqual({ success: true });
    const team = useTeamStore.getState().teams.find((t) => t.id === '1');
    expect(team.groups.some((g) => g.isDefault)).toBe(true);
    expect(team.members.length).toBeGreaterThan(0);
  });

  test('fetchTeam returns a failure result when the service call rejects', async () => {
    getTeamService.mockRejectedValue(new Error('Equipo no encontrado.'));
    const result = await useTeamStore.getState().fetchTeam('999');
    expect(result).toEqual({ success: false, error: 'Equipo no encontrado.' });
  });

  test('updateTeam merges the updated fields, calls the service and keeps local-only fields', async () => {
    createTeamService.mockResolvedValue(TEAM_DTO);
    const created = await useTeamStore.getState().createTeam({ name: 'Original', maxMembers: 10, ownerId: 7 });
    updateTeamService.mockResolvedValue({ ...TEAM_DTO, name: 'Nuevo nombre', description: 'Nueva descripción' });

    const result = await useTeamStore.getState().updateTeam(created.team.id, {
      name: 'Nuevo nombre', description: 'Nueva descripción', showGroupsToRunners: true,
    });

    expect(updateTeamService).toHaveBeenCalledWith(created.team.id, expect.objectContaining({ name: 'Nuevo nombre', description: 'Nueva descripción' }));
    expect(result.success).toBe(true);
    expect(result.team.name).toBe('Nuevo nombre');
    expect(result.team.showGroupsToRunners).toBe(true);
    expect(result.team.groups).toEqual(created.team.groups);
  });

  test('updateTeam chains updateTeamAddress and does not persist address fields locally when it fails', async () => {
    createTeamService.mockResolvedValue(TEAM_DTO);
    const created = await useTeamStore.getState().createTeam({ name: 'Original', maxMembers: 10, ownerId: 7 });
    updateTeamService.mockResolvedValue(TEAM_DTO);
    updateTeamAddressService.mockRejectedValue(new Error('falló'));

    const result = await useTeamStore.getState().updateTeam(created.team.id, {
      name: 'Original', country: 'ARG', province: 'MZ', city: 'Mendoza Capital',
    });
    expect(result.success).toBe(true);
    expect(result.addressWarning).toBe(true);
    expect(result.team.country).toBeNull();
  });

  test('updateTeam returns a failure result for an unknown team', async () => {
    const result = await useTeamStore.getState().updateTeam('does-not-exist', { name: 'X' });
    expect(result).toEqual({ success: false, error: 'Equipo no encontrado.' });
    expect(updateTeamService).not.toHaveBeenCalled();
  });

  test('updateGroup merges only the given fields into the matching group of the matching team', async () => {
    createTeamService.mockResolvedValue(TEAM_DTO);
    const created = await useTeamStore.getState().createTeam({
      name: 'Con grupo', maxMembers: 10, ownerId: 7,
      groups: [{ id: 'group-draft-1', name: 'Avanzados', trainingPlanId: null }],
    });
    const targetGroup = created.team.groups.find((g) => g.id === 'group-draft-1');

    useTeamStore.getState().updateGroup(created.team.id, targetGroup.id, { name: 'Grupo renombrado', trainingPlanId: 'plan-5k' });

    const updatedTeam = useTeamStore.getState().teams.find((t) => t.id === created.team.id);
    const updatedGroup = updatedTeam.groups.find((g) => g.id === targetGroup.id);
    expect(updatedGroup.name).toBe('Grupo renombrado');
    expect(updatedGroup.trainingPlanId).toBe('plan-5k');
  });

  test('addInvitedEmails appends new invites and ignores emails already invited', async () => {
    createTeamService.mockResolvedValue(TEAM_DTO);
    const created = await useTeamStore.getState().createTeam({
      name: 'Con invitación', maxMembers: 10, ownerId: 7,
      invitedEmails: [{ email: 'ya.invitada@example.com', groupId: '' }],
    });

    useTeamStore.getState().addInvitedEmails(created.team.id, [
      { email: 'corredora.nueva@example.com', groupId: '' },
      { email: 'YA.INVITADA@example.com', groupId: '' },
    ]);

    const updated = useTeamStore.getState().teams.find((t) => t.id === created.team.id);
    expect(updated.invitedEmails).toHaveLength(2);
    expect(updated.invitedEmails.some((inv) => inv.email === 'corredora.nueva@example.com')).toBe(true);
  });
});

describe('selectAdministeredTeams', () => {
  test('filters teams by ownerId and returns an empty array without a userId', () => {
    const teams = [{ id: '1', ownerId: 7 }, { id: '2', ownerId: 9 }];
    expect(selectAdministeredTeams(teams, 7)).toEqual([{ id: '1', ownerId: 7 }]);
    expect(selectAdministeredTeams(teams, null)).toEqual([]);
  });
});
```

- [ ] **Step 3: Correr los tests**

Run: `npm test -- team-store.test.js`
Expected: PASS.

- [ ] **Step 4: Lint**

Run: `npm run lint`
Expected: sin errores.

- [ ] **Step 5: Commit**

```bash
git add store/team-store.js __tests__/team-store.test.js
git commit -m "feat(teams): wire team store to the real backend"
```

---

### Task 5: Fix del picker "Nivel del equipo" en web

**Files:**
- Modify: `components/team/team-general-info-fields.jsx`

**Interfaces:**
- Ninguna nueva — cambio puramente de presentación, mismos props que ya usa `PickerField`.

- [ ] **Step 1: Aplicar el ternario `isWeb ? <SelectField> : <PickerField>`**

Modify `components/team/team-general-info-fields.jsx`, reemplazar:
```jsx
      <Row>
        <Col>
          <PickerField dense error={form.errors.level} label="Nivel del equipo" onChange={form.setLevel} options={LEVEL_OPTIONS} placeholder="Elegir nivel" value={form.level} />
        </Col>
        <Col>
          <InputField dense error={form.errors.maxMembers} hint={`Tu plan permite hasta ${maxAllowed}.`} keyboardType="number-pad" label="Máx. de integrantes" onChange={form.setMaxMembers} placeholder={String(maxAllowed)} value={form.maxMembers} />
        </Col>
      </Row>
```
por:
```jsx
      <Row>
        <Col>
          {isWeb ? (
            <SelectField dense error={form.errors.level} label="Nivel del equipo" onChange={form.setLevel} options={LEVEL_OPTIONS} placeholder="Elegir nivel" value={form.level} />
          ) : (
            <PickerField dense error={form.errors.level} label="Nivel del equipo" onChange={form.setLevel} options={LEVEL_OPTIONS} placeholder="Elegir nivel" value={form.level} />
          )}
        </Col>
        <Col>
          <InputField dense error={form.errors.maxMembers} hint={`Tu plan permite hasta ${maxAllowed}.`} keyboardType="number-pad" label="Máx. de integrantes" onChange={form.setMaxMembers} placeholder={String(maxAllowed)} value={form.maxMembers} />
        </Col>
      </Row>
```
`isWeb` y `SelectField` ya están importados en el archivo (línea 4-5).

- [ ] **Step 2: Lint**

Run: `npm run lint`
Expected: sin errores.

- [ ] **Step 3: Verificación manual (preview)**

Levantar el dev server web, ir a Crear equipo (o Editar equipo), confirmar que "Nivel del equipo" renderiza como `<select>` nativo en desktop (mismo look que País/Provincia/Localidad) y sigue siendo el picker modal en mobile — no requiere test automatizado (convención del proyecto: sin tests de render).

- [ ] **Step 4: Commit**

```bash
git add components/team/team-general-info-fields.jsx
git commit -m "fix(teams): use native select for team level on web"
```

---

### Task 6: `create-team-screen.jsx` — submit real, async, con loading

**Files:**
- Modify: `components/team/create-team-screen.jsx`

**Interfaces:**
- Consumes: `useTeamStore((s) => s.createTeam)` → `{success, team?, addressWarning?, error?}` (Task 4).

- [ ] **Step 1: Importar `ActivityIndicator` y agregar `loading`/`disabled` a `StepNav`**

Modify `components/team/create-team-screen.jsx`, reemplazar:
```jsx
import { Pressable, ScrollView, Text, View } from 'react-native';
```
por:
```jsx
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
```

Reemplazar:
```jsx
// Botones de navegación entre pasos — Atrás (secundario) y la acción
// principal del paso (Siguiente/Crear), compartidos por los 3 pasos.
function StepNav({ onBack, onNext, nextLabel, nextIcon = 'arrow-right' }) {
  const colors = useThemeColors();

  return (
    <View className="mt-2 flex-row gap-3" nativeID="create-team-step-nav" testID="create-team-step-nav">
      {onBack && (
        <Pressable
          className="h-12 flex-1 flex-row items-center justify-center gap-2 rounded-full border border-slate-200 hover:bg-slate-100 active:opacity-80 dark:border-slate-700 dark:hover:bg-slate-800"
          nativeID="create-team-step-back-button"
          onPress={onBack}
          testID="create-team-step-back-button"
        >
          <MaterialCommunityIcons color={colors.onSurfaceVariant} name="arrow-left" size={18} />
          <Text className="text-sm font-semibold uppercase tracking-wide text-slate-700 dark:text-slate-200" nativeID="create-team-step-back-button-label" testID="create-team-step-back-button-label">
            Atrás
          </Text>
        </Pressable>
      )}
      <Pressable
        className="h-12 flex-1 flex-row items-center justify-center gap-2 rounded-full bg-primary hover:opacity-90 active:opacity-80"
        nativeID="create-team-step-next-button"
        onPress={onNext}
        testID="create-team-step-next-button"
      >
        <Text className="text-sm font-semibold uppercase tracking-wide text-[#111518]" nativeID="create-team-step-next-button-label" testID="create-team-step-next-button-label">
          {nextLabel}
        </Text>
        <MaterialCommunityIcons color={colors.onPrimary} name={nextIcon} size={18} />
      </Pressable>
    </View>
  );
}
```
por:
```jsx
// Botones de navegación entre pasos — Atrás (secundario) y la acción
// principal del paso (Siguiente/Crear), compartidos por los 3 pasos.
// `loading`/`disabled` solo tienen efecto real en el paso 3 (Crear, que
// pega contra el backend) — los pasos 1/2 son navegación sync.
function StepNav({ onBack, onNext, nextLabel, nextIcon = 'arrow-right', loading = false, disabled = false }) {
  const colors = useThemeColors();

  return (
    <View className="mt-2 flex-row gap-3" nativeID="create-team-step-nav" testID="create-team-step-nav">
      {onBack && (
        <Pressable
          className="h-12 flex-1 flex-row items-center justify-center gap-2 rounded-full border border-slate-200 hover:bg-slate-100 active:opacity-80 dark:border-slate-700 dark:hover:bg-slate-800"
          disabled={loading}
          nativeID="create-team-step-back-button"
          onPress={onBack}
          testID="create-team-step-back-button"
        >
          <MaterialCommunityIcons color={colors.onSurfaceVariant} name="arrow-left" size={18} />
          <Text className="text-sm font-semibold uppercase tracking-wide text-slate-700 dark:text-slate-200" nativeID="create-team-step-back-button-label" testID="create-team-step-back-button-label">
            Atrás
          </Text>
        </Pressable>
      )}
      <Pressable
        className={`h-12 flex-1 flex-row items-center justify-center gap-2 rounded-full bg-primary hover:opacity-90 active:opacity-80 ${disabled || loading ? 'opacity-60' : ''}`}
        disabled={disabled || loading}
        nativeID="create-team-step-next-button"
        onPress={onNext}
        testID="create-team-step-next-button"
      >
        {loading ? (
          <ActivityIndicator color={colors.onPrimary} />
        ) : (
          <>
            <Text className="text-sm font-semibold uppercase tracking-wide text-[#111518]" nativeID="create-team-step-next-button-label" testID="create-team-step-next-button-label">
              {nextLabel}
            </Text>
            <MaterialCommunityIcons color={colors.onPrimary} name={nextIcon} size={18} />
          </>
        )}
      </Pressable>
    </View>
  );
}
```

- [ ] **Step 2: `handleSubmit` async con guard de reentrada, `ownerId`, y distinción de toasts**

Reemplazar:
```jsx
  const handleSubmit = () => {
    createTeam({
      ...generalForm.getValues(),
      groups,
      invitedEmails,
    });

    Toast.show({
      type: 'success',
      text1: 'Equipo creado',
      text2: invitedEmails.length > 0
        ? 'Las invitaciones se van a enviar cuando el backend de equipos esté disponible.'
        : 'Ya lo vas a encontrar en el menú de Equipos.',
    });

    router.back();
  };
```
por:
```jsx
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (submitting) return;
    setSubmitting(true);
    const result = await createTeam({
      ...generalForm.getValues(),
      ownerId: user.userId,
      groups,
      invitedEmails,
    });
    setSubmitting(false);

    if (!result.success) {
      Toast.show({ type: 'error', text1: 'No pudimos crear el equipo', text2: result.error });
      return;
    }

    Toast.show({
      type: 'success',
      text1: 'Equipo creado',
      text2: result.addressWarning
        ? 'La dirección no se pudo guardar — podés agregarla después desde Editar equipo.'
        : invitedEmails.length > 0
          ? 'Las invitaciones se van a enviar cuando el backend de equipos esté disponible.'
          : 'Ya lo vas a encontrar en el menú de Equipos.',
    });

    router.back();
  };
```
Nota: `const [step, setStep] = useState(1);` ya existe más arriba en el componente — `submitting` se agrega como un segundo `useState`, no reemplaza a `step`.

- [ ] **Step 3: Pasar `loading`/`disabled` al `StepNav` del paso 3**

Reemplazar:
```jsx
            <StepNav nextIcon="check" nextLabel="Crear" onBack={() => setStep(2)} onNext={handleSubmit} />
```
por:
```jsx
            <StepNav disabled={submitting} loading={submitting} nextIcon="check" nextLabel="Crear" onBack={() => setStep(2)} onNext={handleSubmit} />
```

- [ ] **Step 4: Lint**

Run: `npm run lint`
Expected: sin errores.

- [ ] **Step 5: Verificación manual (preview, mock end-to-end)**

Con `EXPO_PUBLIC_USE_MOCKS=true` y el dev server reiniciado: crear un equipo completo (3 pasos, con ubicación) → confirmar toast de éxito → confirmar que vuelve a la pantalla anterior. Forzar un error (ej. desconectar `EXPO_PUBLIC_API_URL` sin mocks) y confirmar que el formulario NO se pierde (sin `router.back()` en el camino de error).

- [ ] **Step 6: Commit**

```bash
git add components/team/create-team-screen.jsx
git commit -m "feat(teams): wire create-team-screen to the real backend"
```

---

### Task 7: `edit-team-screen.jsx` — fetch-on-mount, submit real, aviso de no-persistencia

**Files:**
- Modify: `components/team/edit-team-screen.jsx`

**Interfaces:**
- Consumes: `useTeamStore((s) => s.updateTeam)`, `useTeamStore((s) => s.fetchTeam)` (Task 4).
- Produces: separa `EditTeamScreen` (maneja loading/not-found) de un nuevo componente interno `EditTeamForm` (solo se monta con un `team` ya garantizado) — evita el bug de que `useTeamGeneralInfoForm` capture un `initial` vacío si el equipo llega recién después de un `fetchTeam` async.

- [ ] **Step 1: Reescribir el archivo completo**

Modify `components/team/edit-team-screen.jsx` — reemplazar el archivo completo por:
```jsx
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import Toast from 'react-native-toast-message';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useThemeColors } from '../../theme/colors.js';
import { isWeb } from '../../utils/platform.js';
import { useAuthStore } from '../../store/auth-store.js';
import { useTeamStore, getTeamMemberLimit } from '../../store/team-store.js';
import { SectionCard } from '../forms/section-card.jsx';
import { useTeamGeneralInfoForm } from '../../hooks/use-team-general-info-form.js';
import { TeamGeneralInfoFields } from './team-general-info-fields.jsx';

// Edita solo los datos generales del equipo (mismos campos que el paso 1
// del wizard de creación, vía el hook y los campos compartidos). Grupos se
// editan aparte (pestaña Grupos → editar-group-screen.jsx); invitaciones no
// se re-editan post-creación, todavía no hay un flujo para eso.
//
// Separado en dos componentes: este (EditTeamScreen) resuelve
// loading/not-found — el equipo puede no estar todavía en el store si se
// entra por deep-link (fetchTeam es async) — y EditTeamForm, que recién se
// monta con un `team` ya garantizado. Si useTeamGeneralInfoForm se llamara
// acá arriba con un `team` inicialmente undefined, el formulario quedaría
// vacío para siempre una vez que el fetch resuelve (useState solo toma el
// valor inicial una vez).
export function EditTeamScreen({ teamId }) {
  const router = useRouter();
  const colors = useThemeColors();
  const team = useTeamStore((s) => s.teams.find((t) => t.id === teamId));
  const fetchTeam = useTeamStore((s) => s.fetchTeam);
  const [loading, setLoading] = useState(!team);

  useEffect(() => {
    if (team) {
      setLoading(false);
      return undefined;
    }
    let cancelled = false;
    setLoading(true);
    fetchTeam(teamId).finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teamId]);

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center bg-paper dark:bg-ink" nativeID="edit-team-loading" testID="edit-team-loading">
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  if (!team) {
    return (
      <View className="flex-1 items-center justify-center bg-paper px-6 dark:bg-ink" nativeID="edit-team-not-found" testID="edit-team-not-found">
        <Text className="mb-4 text-center text-sm text-slate-500 dark:text-slate-400" nativeID="edit-team-not-found-label" testID="edit-team-not-found-label">
          No encontramos este equipo.
        </Text>
        <Pressable
          className="h-11 flex-row items-center gap-2 rounded-full bg-primary px-6 active:opacity-80"
          nativeID="edit-team-not-found-back-button"
          onPress={() => router.back()}
          testID="edit-team-not-found-back-button"
        >
          <Text className="text-sm font-semibold uppercase tracking-wide text-[#111518]" nativeID="edit-team-not-found-back-button-label" testID="edit-team-not-found-back-button-label">
            Volver
          </Text>
        </Pressable>
      </View>
    );
  }

  return <EditTeamForm team={team} teamId={teamId} />;
}

function EditTeamForm({ team, teamId }) {
  const router = useRouter();
  const colors = useThemeColors();
  const roles = useAuthStore((s) => s.roles);
  const updateTeam = useTeamStore((s) => s.updateTeam);

  const trainerTier = roles.find((r) => r.name === 'entrenador')?.tier;
  const maxAllowed = getTeamMemberLimit(trainerTier);

  const generalForm = useTeamGeneralInfoForm({ initial: team, maxAllowed });
  const [showGroupsToRunners, setShowGroupsToRunners] = useState(team.showGroupsToRunners ?? false);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (submitting) return;
    if (!generalForm.validate()) return;
    setSubmitting(true);
    const result = await updateTeam(teamId, { ...generalForm.getValues(), showGroupsToRunners });
    setSubmitting(false);

    if (!result.success) {
      Toast.show({ type: 'error', text1: 'No pudimos guardar los cambios', text2: result.error });
      return;
    }

    Toast.show({
      type: 'success',
      text1: 'Equipo actualizado',
      text2: result.addressWarning ? 'La dirección no se pudo guardar — probá de nuevo más tarde.' : undefined,
    });
    router.back();
  };

  return (
    <ScrollView
      className="flex-1 bg-paper dark:bg-ink"
      contentContainerClassName="px-4 py-8"
      nativeID="edit-team-screen-scroll"
      showsVerticalScrollIndicator={false}
      testID="edit-team-screen-scroll"
    >
      <View className={`w-full self-center ${isWeb ? 'max-w-3xl' : ''}`} nativeID="edit-team-screen-container" testID="edit-team-screen-container">
        <View className="mb-8 flex-row items-center gap-2" nativeID="edit-team-screen-header" testID="edit-team-screen-header">
          <Pressable
            className="flex-row items-center gap-1.5 py-1 pr-1 hover:opacity-70 active:opacity-70"
            nativeID="edit-team-screen-back-button"
            onPress={() => router.back()}
            testID="edit-team-screen-back-button"
          >
            <MaterialCommunityIcons color={colors.onSurfaceVariant} name="arrow-left" size={18} />
          </Pressable>
          <Text className="text-xl text-slate-900 dark:text-white" nativeID="edit-team-screen-title" style={{ fontFamily: 'Orbitron_700Bold' }} testID="edit-team-screen-title">
            Editar equipo
          </Text>
        </View>

        <SectionCard icon="account-group" title="Datos del equipo">
          <TeamGeneralInfoFields form={generalForm} idPrefix="edit-team" maxAllowed={maxAllowed} />
        </SectionCard>

        <SectionCard icon="shield-account-outline" title="Privacidad">
          <Pressable
            accessibilityLabel="Mostrar los grupos a los corredores"
            accessibilityRole="checkbox"
            accessibilityState={{ checked: showGroupsToRunners }}
            className="flex-row items-start gap-3 py-1"
            nativeID="edit-team-show-groups-checkbox"
            onPress={() => setShowGroupsToRunners((v) => !v)}
            testID="edit-team-show-groups-checkbox"
          >
            <View
              className={`mt-0.5 h-5 w-5 items-center justify-center rounded border ${
                showGroupsToRunners ? 'border-primary bg-primary' : 'border-slate-300 dark:border-slate-600'
              }`}
              nativeID="edit-team-show-groups-checkbox-box"
              testID="edit-team-show-groups-checkbox-box"
            >
              {showGroupsToRunners && <MaterialCommunityIcons color={colors.onPrimary} name="check-bold" size={14} />}
            </View>
            <View className="flex-1" nativeID="edit-team-show-groups-checkbox-text" testID="edit-team-show-groups-checkbox-text">
              <Text className="text-sm font-medium text-slate-900 dark:text-white" nativeID="edit-team-show-groups-checkbox-label" testID="edit-team-show-groups-checkbox-label">
                Mostrar los grupos a los corredores
              </Text>
              <Text className="text-xs text-slate-500 dark:text-slate-400" nativeID="edit-team-show-groups-checkbox-hint" testID="edit-team-show-groups-checkbox-hint">
                Van a poder ver a qué grupo pertenece cada compañero de equipo. La sección Grupos sigue siendo solo para vos.
              </Text>
            </View>
          </Pressable>

          <Text className="mt-2 text-xs text-slate-400 dark:text-slate-500" nativeID="edit-team-show-groups-persistence-hint" testID="edit-team-show-groups-persistence-hint">
            Por ahora esta preferencia no se guarda entre sesiones — el backend todavía no tiene este campo.
          </Text>

          <Pressable
            className={`mt-5 h-12 flex-row items-center justify-center gap-2 rounded-full bg-primary hover:opacity-90 active:opacity-80 ${submitting ? 'opacity-60' : ''}`}
            disabled={submitting}
            nativeID="edit-team-save-button"
            onPress={handleSubmit}
            testID="edit-team-save-button"
          >
            {submitting ? (
              <ActivityIndicator color={colors.onPrimary} />
            ) : (
              <>
                <MaterialCommunityIcons color={colors.onPrimary} name="check" size={18} />
                <Text className="text-sm font-semibold uppercase tracking-wide text-[#111518]" nativeID="edit-team-save-button-label" testID="edit-team-save-button-label">
                  Guardar cambios
                </Text>
              </>
            )}
          </Pressable>
        </SectionCard>
      </View>
    </ScrollView>
  );
}
```

- [ ] **Step 2: Lint**

Run: `npm run lint`
Expected: sin errores.

- [ ] **Step 3: Verificación manual (preview)**

Con mocks activos: entrar a Editar equipo desde el detalle (equipo ya en el store, sin spinner de loading), y también por URL directa `/teams/1/edit` recargando la página (dispara `fetchTeam`, se ve el spinner brevemente). Editar nombre + ubicación, guardar, confirmar toast y que los cambios persisten al volver a entrar. Confirmar que el texto de aviso aparece bajo el toggle de privacidad.

- [ ] **Step 4: Commit**

```bash
git add components/team/edit-team-screen.jsx
git commit -m "feat(teams): wire edit-team-screen to the real backend"
```

---

### Task 8: `team-detail-screen.jsx` — fetch-on-mount para deep-links

**Files:**
- Modify: `components/team/team-detail-screen.jsx`

**Interfaces:**
- Consumes: `useTeamStore((s) => s.fetchTeam)` (Task 4).

- [ ] **Step 1: Agregar el fetch-on-mount antes del `if (!team)` existente**

Modify `components/team/team-detail-screen.jsx`, reemplazar:
```jsx
export function TeamDetailScreen({ teamId }) {
  const router = useRouter();
  const colors = useThemeColors();
  const team = useTeamStore((s) => s.teams.find((t) => t.id === teamId));
  const activeRole = useAuthStore((s) => s.activeRole);
```
por:
```jsx
export function TeamDetailScreen({ teamId }) {
  const router = useRouter();
  const colors = useThemeColors();
  const team = useTeamStore((s) => s.teams.find((t) => t.id === teamId));
  const fetchTeam = useTeamStore((s) => s.fetchTeam);
  const activeRole = useAuthStore((s) => s.activeRole);
```

Y reemplazar:
```jsx
  const [activeTab, setActiveTab] = useState('general');
  const [search, setSearch] = useState('');
  const [groupFilter, setGroupFilter] = useState('');
```
por:
```jsx
  const [activeTab, setActiveTab] = useState('general');
  const [search, setSearch] = useState('');
  const [groupFilter, setGroupFilter] = useState('');
  const [loadingTeam, setLoadingTeam] = useState(!team);

  // Entrar por deep-link (ej. recargar /teams/{id} directo) puede caer acá
  // antes de que el equipo esté en el store — fetchTeam lo trae puntual.
  useEffect(() => {
    if (team) {
      setLoadingTeam(false);
      return undefined;
    }
    let cancelled = false;
    setLoadingTeam(true);
    fetchTeam(teamId).finally(() => { if (!cancelled) setLoadingTeam(false); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teamId]);
```

- [ ] **Step 2: Importar `useEffect`**

Modify `components/team/team-detail-screen.jsx`, reemplazar:
```jsx
import { useMemo, useState } from 'react';
```
por:
```jsx
import { useEffect, useMemo, useState } from 'react';
```

- [ ] **Step 3: Mostrar un loading antes del `if (!team)` existente**

Modify `components/team/team-detail-screen.jsx`, reemplazar:
```jsx
  if (!team) {
    return (
      <View className="flex-1 items-center justify-center bg-paper px-6 dark:bg-ink" nativeID="team-detail-not-found" testID="team-detail-not-found">
```
por:
```jsx
  if (loadingTeam) {
    return (
      <View className="flex-1 items-center justify-center bg-paper dark:bg-ink" nativeID="team-detail-loading" testID="team-detail-loading">
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  if (!team) {
    return (
      <View className="flex-1 items-center justify-center bg-paper px-6 dark:bg-ink" nativeID="team-detail-not-found" testID="team-detail-not-found">
```

- [ ] **Step 4: Importar `ActivityIndicator`**

Modify `components/team/team-detail-screen.jsx`, reemplazar:
```jsx
import { Image, Pressable, ScrollView, Text, View } from 'react-native';
```
por:
```jsx
import { ActivityIndicator, Image, Pressable, ScrollView, Text, View } from 'react-native';
```

- [ ] **Step 5: Lint**

Run: `npm run lint`
Expected: sin errores.

- [ ] **Step 6: Verificación manual (preview)**

Recargar directo en `/teams/1` (con mocks activos) y confirmar que aparece el spinner brevemente y después el detalle del equipo, sin pantalla en blanco ni error.

- [ ] **Step 7: Commit**

```bash
git add components/team/team-detail-screen.jsx
git commit -m "feat(teams): fetch team on mount for deep-links in team-detail-screen"
```

---

### Task 9: Shells — menú de equipos filtrado a "los que administro"

**Files:**
- Modify: `components/shell/app-web-shell.jsx`
- Modify: `components/shell/app-web-shell-narrow.jsx`
- Modify: `components/shell/app-mobile-shell.jsx`

**Interfaces:**
- Consumes: `selectAdministeredTeams(teams, userId)` y `useTeamStore((s) => s.fetchTeams)` (Task 4).

- [ ] **Step 1: `app-web-shell.jsx` — importar `selectAdministeredTeams`, filtrar y disparar `fetchTeams`**

Modify `components/shell/app-web-shell.jsx`, reemplazar:
```jsx
import { useTeamStore } from '../../store/team-store.js';
```
por:
```jsx
import { useTeamStore, selectAdministeredTeams } from '../../store/team-store.js';
```

Reemplazar:
```jsx
function TeamsMenu({ onClose }) {
  const router = useRouter();
  const colors = useThemeColors();
  const teams = useTeamStore((s) => s.teams);
  const selectedTeamId = useTeamStore((s) => s.selectedTeamId);
  const selectTeam = useTeamStore((s) => s.selectTeam);
```
por:
```jsx
function TeamsMenu({ onClose }) {
  const router = useRouter();
  const colors = useThemeColors();
  const user = useAuthStore((s) => s.user);
  const teams = useTeamStore((s) => s.teams);
  const fetchTeams = useTeamStore((s) => s.fetchTeams);
  const administeredTeams = selectAdministeredTeams(teams, user?.userId);
  const selectedTeamId = useTeamStore((s) => s.selectedTeamId);
  const selectTeam = useTeamStore((s) => s.selectTeam);

  useEffect(() => {
    fetchTeams();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
```

Reemplazar:
```jsx
        {teams.length === 0 && (
          <Text className="px-4 py-3.5 text-sm text-slate-500 dark:text-slate-400" nativeID="web-shell-teams-menu-empty" testID="web-shell-teams-menu-empty">Todavía no tenés equipos.</Text>
        )}

        {teams.map((team) => {
```
por:
```jsx
        {administeredTeams.length === 0 && (
          <Text className="px-4 py-3.5 text-sm text-slate-500 dark:text-slate-400" nativeID="web-shell-teams-menu-empty" testID="web-shell-teams-menu-empty">Todavía no tenés equipos.</Text>
        )}

        {administeredTeams.map((team) => {
```
`useEffect`, `useAuthStore` ya están importados en el archivo.

- [ ] **Step 2: `app-web-shell-narrow.jsx` — mismo patrón**

Modify `components/shell/app-web-shell-narrow.jsx`, reemplazar:
```jsx
import { useTeamStore } from '../../store/team-store.js';
```
por:
```jsx
import { useTeamStore, selectAdministeredTeams } from '../../store/team-store.js';
```

Reemplazar:
```jsx
  const teams = useTeamStore((s) => s.teams);
  const selectedTeamId = useTeamStore((s) => s.selectedTeamId);
  const selectTeam = useTeamStore((s) => s.selectTeam);
  const [teamsExpanded, setTeamsExpanded] = useState(false);
```
por:
```jsx
  const teams = useTeamStore((s) => s.teams);
  const fetchTeams = useTeamStore((s) => s.fetchTeams);
  const administeredTeams = selectAdministeredTeams(teams, user?.userId);
  const selectedTeamId = useTeamStore((s) => s.selectedTeamId);
  const selectTeam = useTeamStore((s) => s.selectTeam);
  const [teamsExpanded, setTeamsExpanded] = useState(false);

  useEffect(() => {
    fetchTeams();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
```

Reemplazar:
```jsx
                        onToggle={() => setTeamsExpanded((v) => !v)}
                        selectedTeamId={selectedTeamId}
                        teams={teams}
                      />
```
por:
```jsx
                        onToggle={() => setTeamsExpanded((v) => !v)}
                        selectedTeamId={selectedTeamId}
                        teams={administeredTeams}
                      />
```

- [ ] **Step 3: `app-mobile-shell.jsx` — mismo patrón**

Modify `components/shell/app-mobile-shell.jsx`, reemplazar:
```jsx
import { useTeamStore } from '../../store/team-store.js';
```
por:
```jsx
import { useTeamStore, selectAdministeredTeams } from '../../store/team-store.js';
```

Reemplazar:
```jsx
  const teams = useTeamStore((s) => s.teams);
  const selectedTeamId = useTeamStore((s) => s.selectedTeamId);
  const selectTeam = useTeamStore((s) => s.selectTeam);
  const [teamsExpanded, setTeamsExpanded] = useState(false);
```
por:
```jsx
  const teams = useTeamStore((s) => s.teams);
  const fetchTeams = useTeamStore((s) => s.fetchTeams);
  const administeredTeams = selectAdministeredTeams(teams, user?.userId);
  const selectedTeamId = useTeamStore((s) => s.selectedTeamId);
  const selectTeam = useTeamStore((s) => s.selectTeam);
  const [teamsExpanded, setTeamsExpanded] = useState(false);

  useEffect(() => {
    fetchTeams();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
```

Reemplazar:
```jsx
                        onToggle={() => setTeamsExpanded((v) => !v)}
                        selectedTeamId={selectedTeamId}
                        teams={teams}
                      />
```
por:
```jsx
                        onToggle={() => setTeamsExpanded((v) => !v)}
                        selectedTeamId={selectedTeamId}
                        teams={administeredTeams}
                      />
```

- [ ] **Step 4: Lint**

Run: `npm run lint`
Expected: sin errores.

- [ ] **Step 5: Verificación manual (preview)**

Con mocks activos, loguear como el usuario demo (`user_id: 1`, dueño de "Corredores del Sur" en el seed del mock) y confirmar que el menú de Equipos (header web ancho, drawer web angosto, drawer mobile) muestra solo ese equipo — no "Running Cordoba Norte" ni "Maraton Runners" (`owner_id: 99` en el seed).

- [ ] **Step 6: Commit**

```bash
git add components/shell/app-web-shell.jsx components/shell/app-web-shell-narrow.jsx components/shell/app-mobile-shell.jsx
git commit -m "feat(teams): filter shell teams menu to administered teams"
```

---

### Task 10: `docs/BACKEND_API_GAPS.md` + referencia en `CLAUDE.md`

**Files:**
- Create: `docs/BACKEND_API_GAPS.md`
- Modify: `CLAUDE.md`

**Interfaces:** ninguna — documentación pura.

- [ ] **Step 1: Crear `docs/BACKEND_API_GAPS.md`**

Create `docs/BACKEND_API_GAPS.md`:
```markdown
# Huecos de backend detectados integrando equipos/grupos/invitaciones

Doc de seguimiento interno — un gap por sección, se actualiza a medida que el backend los va cerrando. Versión más narrativa (pensada para pasarle al equipo de backend como insumo de sus propias specs) compartida por fuera del repo el 2026-07-28.

## 1. Sin endpoint "mis equipos" (administrados o donde participo)

- **Qué hace falta:** `GET /users/{id}/teams` (o `?owner_id=`/`?member_id=` en el `GET /teams` existente).
- **Por qué:** `GET /teams` devuelve todo el sistema sin filtro — no hay forma de pedir "los equipos que administro" ni "los equipos donde soy corredor".
- **A qué bloquea:** el menú de equipos del shell (hoy resuelto client-side filtrando por `owner_id`, no escala) y cualquier pantalla futura de "equipos donde participo como corredor" (no resoluble de ningún modo hoy).
- **Workaround actual:** `store/team-store.js#selectAdministeredTeams` filtra `GET /teams` completo por `owner_id === userId`, client-side.
- **Estado:** abierto.

## 2. Sin campo `show_groups_to_runners` en el equipo

- **Qué hace falta:** campo booleano en `team.CreateTeamRequest`/`UpdateTeamRequest`/`TeamResponse`.
- **Por qué:** el entrenador puede decidir si los corredores ven a qué grupo pertenece cada compañero (toggle en Editar equipo).
- **A qué bloquea:** la preferencia no persiste entre sesiones.
- **Workaround actual:** queda interactivo del lado del cliente (`store/team-store.js`, `decorateTeam`), se pierde al recargar. Aviso visible bajo el toggle en `edit-team-screen.jsx`.
- **Estado:** abierto.

## 3. Sin campo de foto de equipo ni mecanismo de upload

- **Qué hace falta:** campo `photo_url` (o similar) en el equipo + algún mecanismo de storage (no hay upload de archivos en ningún recurso del sistema todavía).
- **Por qué:** el wizard de creación/edición ya tiene un selector de foto.
- **A qué bloquea:** la foto elegida no persiste entre sesiones.
- **Workaround actual:** queda interactiva del lado del cliente (`photoUri`), se pierde al recargar. Sin aviso visible (dato menos sensible que el toggle de privacidad).
- **Estado:** abierto — probablemente necesita una decisión de infraestructura (dónde se guardan los archivos) antes que un endpoint puntual de equipos.

## 4. Sin campo de plan de entrenamiento en el grupo

- **Qué hace falta:** campo `training_plan_id` (o similar) en `group.CreateGroupRequest`/`UpdateGroupRequest`/`GroupResponse`.
- **Por qué:** cada grupo puede tener un plan de entrenamiento asociado (hoy un catálogo fijo hardcodeado de 4 planes en el frontend, sin respaldo real).
- **A qué bloquea:** Etapa 2 (Grupos) de este roadmap — no arrancó todavía.
- **Workaround actual:** `TRAINING_PLAN_OPTIONS` en `store/team-store.js`, catálogo fijo sin persistencia real.
- **Estado:** abierto.

## 5. Sin endpoint para listar invitaciones pendientes de un equipo

- **Qué hace falta:** `GET /teams/{id}/invitations` (o similar) con email/fecha/grupo/estado.
- **Por qué:** existe `POST /teams/{id}/invite` (enviar), pero ningún GET de lo ya enviado — la respuesta del POST tampoco devuelve un id de la invitación creada.
- **A qué bloquea:** Etapa 3 (Invitaciones) — la sección "Solicitudes pendientes" queda mockeada indefinidamente sin esto.
- **Workaround actual:** ninguno todavía (Etapa 3 no arrancó).
- **Estado:** abierto.

## 6. Sin mecanismo de aceptar/rechazar invitación

- **Qué hace falta:** la invitación como entidad persistida con id/estado + endpoints de aceptar/rechazar que, al aceptar, den de alta en `team-users`.
- **Por qué:** hoy el flujo es solo "se manda un email y nada más" — no hay forma de que el invitado la vea en la app y decida.
- **A qué bloquea:** Etapa 3 completa — es la pieza central de "sumarse por invitación".
- **Workaround actual:** ninguno todavía (Etapa 3 no arrancó). Es el gap más grande de los 6, probablemente amerita una spec de diseño conjunta con backend antes de implementarse.
- **Estado:** abierto — el más prioritario junto con el gap 1 y 5.
```

- [ ] **Step 2: Agregar la línea de referencia en `CLAUDE.md`**

Modify `CLAUDE.md`, reemplazar la última línea de la sección `## Backend`:
```markdown
- Recuperación de contraseña (`forgot-password`/`reset-password`, código OTP de 6 dígitos, vence a los 10 minutos) también pega contra el backend real desde `feature/password-recovery` — ver `services/password.js`, pantallas en `components/auth/forgot-password-screen.jsx`/`reset-password-screen.jsx`.
```
por:
```markdown
- Recuperación de contraseña (`forgot-password`/`reset-password`, código OTP de 6 dígitos, vence a los 10 minutos) también pega contra el backend real desde `feature/password-recovery` — ver `services/password.js`, pantallas en `components/auth/forgot-password-screen.jsx`/`reset-password-screen.jsx`.
- Equipos (`services/teams.js`) pega contra el backend real desde `feature/teams-backend-integration` (Etapa 1 de 3 — ver `docs/superpowers/specs/2026-07-28-teams-backend-integration-design.md`). Grupos e invitaciones siguen local-only (Etapa 2/3). Huecos de funcionalidad detectados integrando el frontend contra el backend real (endpoints/campos que la interfaz ya necesita y el backend todavía no tiene) están documentados y trackeados en `docs/BACKEND_API_GAPS.md`.
```

- [ ] **Step 3: Commit**

```bash
git add docs/BACKEND_API_GAPS.md CLAUDE.md
git commit -m "docs(teams): track backend API gaps found integrating teams"
```

---

## Self-Review

**Spec coverage:**
- Rename de rutas → Task 1. ✅
- Capa de servicio + mock + normalizers → Tasks 2, 3. ✅
- Store real (createTeam/updateTeam async, fetchTeams/fetchTeam, secuenciación de dirección, addressWarning) → Task 4. ✅
- Fix de select de nivel → Task 5. ✅
- Pantallas (create/edit/detail) con async/loading/fetch-on-mount/avisos → Tasks 6, 7, 8. ✅
- Menú de equipos filtrado a administrados → Task 9. ✅
- `docs/BACKEND_API_GAPS.md` + referencia en `CLAUDE.md` → Task 10. ✅
- `updateGroup`/`addInvitedEmails` quedan local-only → confirmado sin cambios en Task 4. ✅
- Campos sin backend (`showGroupsToRunners`, foto) funcionan pero no persisten, con aviso solo para el toggle → Task 4 (`decorateTeam`) + Task 7 (texto visible). ✅

**Placeholder scan:** sin "TBD"/"TODO"/código a medio escribir — cada step tiene código completo o comando exacto.

**Type/signature consistency:** `createTeam`/`updateTeam` del store devuelven siempre `{success, team?, addressWarning?, error?}` en las 3 pantallas que los consumen (Tasks 6, 7). `selectAdministeredTeams(teams, userId)` mismo nombre/firma en Task 4 (definición) y Task 9 (consumo, 3 archivos). `toTeamModel`/`toCreateTeamPayload`/`toUpdateTeamPayload`/`toAddressPayload` mismos nombres entre Task 2 (definición) y Task 4 (consumo en el store).

---

## Después de esta etapa

Con Equipos cerrado y mergeado, Etapa 2 (Grupos) y Etapa 3 (Invitaciones) se planifican por separado, cada una en su propia rama — Etapa 3 depende de que se cierren los gaps 5 y 6 del lado del backend antes de poder dar funcionalidad real al "sumarse por invitación".
