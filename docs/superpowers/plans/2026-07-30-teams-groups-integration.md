# Equipos: integración real de grupos (Etapa 2) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Conectar grupos de equipo contra el backend real (`/groups`), reemplazando el grupo "Sin grupo" sintético por un grupo principal real creado vía `create_default_group: true`.

**Architecture:** Mismo patrón ya usado para equipos en Etapa 1 — capa de servicio (`services/groups.js`, rama `USE_MOCKS`), normalizers camelCase↔snake_case, acciones async en `store/team-store.js` que devuelven `{success, ...}`. Los grupos dejan de decorarse sincrónicamente al cargar un equipo — pasan a fetchearse aparte (`fetchGroups`), así que toda pantalla que lee `team.groups` necesita dispararlo en un `useEffect` propio, sin importar si el equipo ya estaba en el store.

**Tech Stack:** Igual que el resto del repo — Zustand, Expo Router, NativeWind, Jest.

## Global Constraints

- Planes de entrenamiento (`trainingPlanId`) NO se tocan — sigue siendo un catálogo mock (`TRAINING_PLAN_OPTIONS`), se descarta del payload al backend, cero UI nueva para asignarlo fuera del wizard.
- Membresía real de grupo (agregar/sacar corredor de un grupo específico) NO se implementa — el roster sigue siendo sintético (`generateMockMembers`).
- `npm test` y `npm run lint` en verde después de cada tarea.
- Todo elemento visual nuevo (`View`/`Pressable`/`Text`/etc.) lleva `nativeID`/`testID` únicos, kebab-case, con scope propio (regla de `eslint.config.js#require-native-id`, sin excepción).
- Formularios nuevos con 2+ campos relacionados usan `Row`/`Col` de `components/forms/fields.jsx` si tienen sentido en fila en web — el form de "agregar grupo" de este plan es corto (nombre + descripción apilados, no en fila, sigue el patrón ya usado en `GroupListEditor`), no aplica.

---

### Task 1: Normalizers de grupo + `create_default_group` en el payload de equipo

**Files:**
- Modify: `services/normalizers.js`
- Test: `__tests__/normalizers.test.js`

**Interfaces:**
- Produces: `toGroupModel(dto)` → `{id: string, teamId: string, name, description, isDefault: boolean, trainingPlanId: null, createdAt, updatedAt}`. `toCreateGroupPayload(teamId, form)` → `{team_id: number, name, description?}`. `toUpdateGroupPayload(form)` → `{name?, description?}`.

- [ ] **Step 1: Escribir los tests que fallan**

Agregar a `__tests__/normalizers.test.js`, después del bloque `describe('toAddressPayload', ...)` (al final del archivo):

```js
describe('toGroupModel', () => {
  test('maps snake_case fields to camelCase, coerces ids to string, is_main to isDefault', () => {
    const dto = {
      id: 5, team_id: 1, name: 'General', description: null, is_main: true,
      created_at: '2026-01-01T00:00:00.000Z', updated_at: '2026-01-01T00:00:00.000Z',
    };
    expect(toGroupModel(dto)).toEqual({
      id: '5', teamId: '1', name: 'General', description: null, isDefault: true, trainingPlanId: null,
      createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z',
    });
  });

  test('defaults isDefault to false when is_main is omitted', () => {
    const dto = { id: 6, team_id: 1, name: 'Avanzados' };
    expect(toGroupModel(dto).isDefault).toBe(false);
  });

  test('returns null for falsy dto', () => {
    expect(toGroupModel(null)).toBeNull();
    expect(toGroupModel(undefined)).toBeNull();
  });
});

describe('toCreateGroupPayload', () => {
  test('maps team_id and name, includes description only if present', () => {
    expect(toCreateGroupPayload('3', { name: 'Avanzados' })).toEqual({ team_id: 3, name: 'Avanzados' });
    expect(toCreateGroupPayload('3', { name: 'Avanzados', description: 'Ritmo alto' }))
      .toEqual({ team_id: 3, name: 'Avanzados', description: 'Ritmo alto' });
  });

  test('omits description when blank', () => {
    expect(toCreateGroupPayload('3', { name: 'Avanzados', description: '  ' })).toEqual({ team_id: 3, name: 'Avanzados' });
  });
});

describe('toUpdateGroupPayload', () => {
  test('includes only provided fields', () => {
    expect(toUpdateGroupPayload({ name: 'Nuevo nombre' })).toEqual({ name: 'Nuevo nombre' });
    expect(toUpdateGroupPayload({ name: 'Nuevo nombre', description: 'Nueva desc' }))
      .toEqual({ name: 'Nuevo nombre', description: 'Nueva desc' });
  });

  test('allows clearing description to null', () => {
    expect(toUpdateGroupPayload({ name: 'X', description: null })).toEqual({ name: 'X', description: null });
  });

  test('omits name when blank', () => {
    expect(toUpdateGroupPayload({ name: '  ', description: 'Y' })).toEqual({ description: 'Y' });
  });
});
```

Actualizar el import del principio del archivo:

```js
import {
  toUserModel, toRegisterPayload, toTeamModel, toCreateTeamPayload, toUpdateTeamPayload, toAddressPayload,
  toGroupModel, toCreateGroupPayload, toUpdateGroupPayload,
} from '../services/normalizers.js';
```

- [ ] **Step 2: Correr los tests y confirmar que fallan**

Run: `npx jest normalizers.test.js`
Expected: FAIL — `toGroupModel is not a function` (y las otras dos).

- [ ] **Step 3: Implementar en `services/normalizers.js`**

Agregar `create_default_group: true` al objeto `payload` fijo de `toCreateTeamPayload` (el que ya tiene `name`/`max_members`/`owner_id`):

```js
export function toCreateTeamPayload(form) {
  const payload = {
    name: form.name,
    max_members: form.maxMembers,
    owner_id: form.ownerId,
    create_default_group: true,
  };
```

Agregar al final del archivo, después de `toAddressPayload`:

```js
export function toGroupModel(dto) {
  if (!dto) return null;
  return {
    id: String(dto.id),
    teamId: String(dto.team_id),
    name: dto.name,
    description: dto.description,
    isDefault: dto.is_main ?? false,
    trainingPlanId: null,
    createdAt: dto.created_at,
    updatedAt: dto.updated_at,
  };
}

export function toCreateGroupPayload(teamId, form) {
  const payload = { team_id: Number(teamId), name: form.name };
  if (form.description && String(form.description).trim()) payload.description = form.description.trim();
  return payload;
}

export function toUpdateGroupPayload(form) {
  const payload = {};
  if (form.name && String(form.name).trim()) payload.name = form.name.trim();
  if (form.description !== undefined) payload.description = form.description ? String(form.description).trim() : null;
  return payload;
}
```

- [ ] **Step 4: Correr los tests y confirmar que pasan**

Run: `npx jest normalizers.test.js`
Expected: PASS, todos los tests del archivo.

- [ ] **Step 5: Commit**

```bash
git add services/normalizers.js __tests__/normalizers.test.js
git commit -m "feat(teams): add group normalizers and create_default_group payload flag"
```

---

### Task 2: `services/groups.js` + mock de grupos

**Files:**
- Create: `services/groups.js`
- Create: `services/__mocks__/groups-mock.js`
- Modify: `services/__mocks__/teams-mock.js`
- Test: `__tests__/groups-mock.test.js`

**Interfaces:**
- Consumes: nada de tareas anteriores (usa `api.js`/`config/env.js`, mismo patrón que `services/teams.js`).
- Produces: `listGroups(teamId, userId)`, `getGroup(groupId)`, `createGroup(payload)`, `updateGroup(groupId, updates)`, `deleteGroup(groupId)`, `getGroupUsers(groupId)` — todas `async`, devuelven el DTO (o array de DTOs) crudo del backend/mock, mismo contrato que las de `services/teams.js`. Mock exporta además `__seedDefaultGroup(teamId)` y `__resetMockGroups()`.

- [ ] **Step 1: Escribir el test que falla**

Crear `__tests__/groups-mock.test.js`:

```js
import {
  mockListGroups, mockGetGroup, mockCreateGroup, mockUpdateGroup, mockDeleteGroup, mockGetGroupUsers,
  __seedDefaultGroup, __resetMockGroups,
} from '../services/__mocks__/groups-mock.js';

beforeEach(() => {
  __resetMockGroups();
});

describe('groups-mock', () => {
  test('__seedDefaultGroup creates a group with is_main true for the given team', async () => {
    const seeded = __seedDefaultGroup('7');
    expect(seeded.is_main).toBe(true);
    expect(seeded.team_id).toBe(7);
    const groups = await mockListGroups('7', 1);
    expect(groups).toEqual([seeded]);
  });

  test('mockCreateGroup adds a non-main group scoped to the team', async () => {
    __seedDefaultGroup('7');
    const created = await mockCreateGroup({ team_id: 7, name: 'Avanzados', description: 'Ritmo alto' });
    expect(created.is_main).toBe(false);
    expect(created.name).toBe('Avanzados');
    const groups = await mockListGroups('7', 1);
    expect(groups).toHaveLength(2);
  });

  test('mockListGroups only returns groups for the requested team', async () => {
    __seedDefaultGroup('7');
    __seedDefaultGroup('8');
    const groups = await mockListGroups('7', 1);
    expect(groups.every((g) => g.team_id === 7)).toBe(true);
  });

  test('mockGetGroup returns the group by id, throws for an unknown id', async () => {
    const seeded = __seedDefaultGroup('7');
    expect(await mockGetGroup(seeded.id)).toEqual(seeded);
    await expect(mockGetGroup(999999)).rejects.toThrow();
  });

  test('mockUpdateGroup merges fields and updates updated_at', async () => {
    const seeded = __seedDefaultGroup('7');
    const updated = await mockUpdateGroup(seeded.id, { name: 'Nuevo nombre' });
    expect(updated.name).toBe('Nuevo nombre');
  });

  test('mockDeleteGroup removes the group from subsequent listings', async () => {
    const seeded = __seedDefaultGroup('7');
    await mockDeleteGroup(seeded.id);
    expect(await mockListGroups('7', 1)).toEqual([]);
  });

  test('mockGetGroupUsers returns an empty array when nobody was added', async () => {
    const seeded = __seedDefaultGroup('7');
    expect(await mockGetGroupUsers(seeded.id)).toEqual([]);
  });
});
```

- [ ] **Step 2: Correr el test y confirmar que falla**

Run: `npx jest groups-mock.test.js`
Expected: FAIL — no puede resolver `../services/__mocks__/groups-mock.js`.

- [ ] **Step 3: Crear `services/__mocks__/groups-mock.js`**

```js
// Estado in-memory con la MISMA shape snake_case que el backend real (para
// que toGroupModel() funcione igual en ambas ramas) — mismo patrón que
// teams-mock.js. __seedDefaultGroup existe para que teams-mock.js pueda
// simular el efecto de create_default_group: true en POST /teams (el
// backend crea el grupo principal como side-effect de crear el equipo,
// este mock hace lo mismo).
let mockGroups = [];
let nextGroupId = 1;

function findGroupOrThrow(groupId) {
  const group = mockGroups.find((g) => String(g.id) === String(groupId));
  if (!group) {
    const error = new Error('Grupo no encontrado.');
    error.status = 404;
    throw error;
  }
  return group;
}

export function __seedDefaultGroup(teamId) {
  const now = new Date().toISOString();
  const group = {
    id: nextGroupId++, team_id: Number(teamId), name: 'General', description: null, is_main: true,
    created_at: now, updated_at: now,
  };
  mockGroups.push(group);
  return group;
}

export async function mockListGroups(teamId, _userId) {
  return mockGroups.filter((g) => String(g.team_id) === String(teamId));
}

export async function mockGetGroup(groupId) {
  return findGroupOrThrow(groupId);
}

export async function mockCreateGroup(payload) {
  const now = new Date().toISOString();
  const group = {
    id: nextGroupId++, team_id: payload.team_id, name: payload.name, description: payload.description ?? null,
    is_main: false, created_at: now, updated_at: now,
  };
  mockGroups.push(group);
  return group;
}

export async function mockUpdateGroup(groupId, updates) {
  const group = findGroupOrThrow(groupId);
  Object.assign(group, updates, { updated_at: new Date().toISOString() });
  return group;
}

export async function mockDeleteGroup(groupId) {
  mockGroups = mockGroups.filter((g) => String(g.id) !== String(groupId));
  return null;
}

export async function mockGetGroupUsers(_groupId) {
  return [];
}

export function __resetMockGroups() {
  mockGroups = [];
  nextGroupId = 1;
}
```

- [ ] **Step 4: Crear `services/groups.js`**

```js
import api from './api.js';
import { USE_MOCKS } from '../config/env.js';
import {
  mockListGroups,
  mockGetGroup,
  mockCreateGroup,
  mockUpdateGroup,
  mockDeleteGroup,
  mockGetGroupUsers,
} from './__mocks__/groups-mock.js';

// GET /api/v1/groups?team_id=&user_id= — requiere user_id para validar membresía.
export async function listGroups(teamId, userId) {
  if (USE_MOCKS) return await mockListGroups(teamId, userId);
  return await api.get(`/groups?team_id=${encodeURIComponent(teamId)}&user_id=${encodeURIComponent(userId)}`);
}

// GET /api/v1/groups/{id}.
export async function getGroup(groupId) {
  if (USE_MOCKS) return await mockGetGroup(groupId);
  return await api.get(`/groups/${groupId}`);
}

// POST /api/v1/groups — group.CreateGroupRequest.
export async function createGroup(payload) {
  if (USE_MOCKS) return await mockCreateGroup(payload);
  return await api.post('/groups', payload);
}

// PUT /api/v1/groups/{id} — group.UpdateGroupRequest (parcial).
export async function updateGroup(groupId, updates) {
  if (USE_MOCKS) return await mockUpdateGroup(groupId, updates);
  return await api.put(`/groups/${groupId}`, updates);
}

// DELETE /api/v1/groups/{id}.
export async function deleteGroup(groupId) {
  if (USE_MOCKS) return await mockDeleteGroup(groupId);
  return await api.delete(`/groups/${groupId}`);
}

// GET /api/v1/groups/{id}/users. Sin consumidor en la UI de esta etapa (el
// roster sigue siendo sintético, ver store/team-store.js) — se agrega igual
// como espejo 1:1 barato del contrato ya documentado.
export async function getGroupUsers(groupId) {
  if (USE_MOCKS) return await mockGetGroupUsers(groupId);
  return await api.get(`/groups/${groupId}/users`);
}
```

- [ ] **Step 5: Modificar `services/__mocks__/teams-mock.js` para sembrar el grupo principal**

Agregar el import al principio del archivo:

```js
import { __seedDefaultGroup, __resetMockGroups } from './groups-mock.js';
```

Modificar `buildSeedTeams` para que cada equipo semilla tenga su grupo principal (agregar al final de la función, antes del `return`):

```js
function buildSeedTeams() {
  const now = new Date().toISOString();
  const teams = [
    // ... los 3 objetos de equipo existentes, sin cambios ...
  ];
  teams.forEach((t) => __seedDefaultGroup(t.id));
  return teams;
}
```

Modificar `mockCreateTeam` para sembrar el grupo principal cuando el payload lo pide (agregar antes del `return team;`):

```js
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
  if (payload.create_default_group) __seedDefaultGroup(team.id);
  return team;
}
```

Modificar `__resetMockTeams` para resetear también los grupos antes de reconstruir la semilla:

```js
export function __resetMockTeams() {
  __resetMockGroups();
  mockTeams = buildSeedTeams();
  mockTeamUsers = {};
  nextId = 4;
}
```

Y la inicialización del módulo (`let mockTeams = buildSeedTeams();`) queda igual — sigue funcionando porque `groups-mock.js` ya inicializó su propio estado (`mockGroups = []`) antes de que se evalúe este import, por orden de evaluación de módulos ES.

- [ ] **Step 6: Correr los tests y confirmar que pasan**

Run: `npx jest groups-mock.test.js teams-mock.test.js`
Expected: PASS — todos los tests, incluidos los preexistentes de `teams-mock.test.js` (no deberían romperse, el cambio es aditivo).

- [ ] **Step 7: Commit**

```bash
git add services/groups.js services/__mocks__/groups-mock.js services/__mocks__/teams-mock.js __tests__/groups-mock.test.js
git commit -m "feat(teams): add groups service layer with mock, seed default group on team creation"
```

---

### Task 3: `store/team-store.js` — sacar el grupo default sintético, agregar `fetchGroups`

**Files:**
- Modify: `store/team-store.js`
- Test: `__tests__/team-store.test.js`

**Interfaces:**
- Consumes: `listGroups` de `services/groups.js` (Task 2), `toGroupModel` de `services/normalizers.js` (Task 1).
- Produces: `fetchGroups(teamId, userId)` → `Promise<{success: boolean, error?: string}>`, deja `team.groups`/`team.members` actualizados en el store.

- [ ] **Step 1: Escribir los tests que fallan**

Actualizar el mock de servicios al principio de `__tests__/team-store.test.js` — agregar `listGroups` al mock de `services/groups.js` (nuevo bloque, junto al de `services/teams.js` ya existente):

```js
jest.mock('../services/groups.js', () => ({
  listGroups: jest.fn(),
}));

import { listGroups as listGroupsService } from '../services/groups.js';
```

Agregar, en cualquier punto del archivo dentro de un `describe` nuevo (ej. después del `describe('selectAdministeredTeams', ...)` al final):

```js
describe('fetchGroups', () => {
  const GROUP_DTO = { id: 1, team_id: 1, name: 'General', description: null, is_main: true, created_at: '2026-01-01T00:00:00.000Z', updated_at: '2026-01-01T00:00:00.000Z' };

  test('fetches groups for a team, decorates the team with them, and regenerates the roster', async () => {
    useTeamStore.setState({ teams: [{ id: '1', name: 'X', groups: [], members: [] }] });
    listGroupsService.mockResolvedValue([GROUP_DTO]);
    const result = await useTeamStore.getState().fetchGroups('1', 7);
    expect(result).toEqual({ success: true });
    const team = useTeamStore.getState().teams.find((t) => t.id === '1');
    expect(team.groups).toEqual([{ id: '1', teamId: '1', name: 'General', description: null, isDefault: true, trainingPlanId: null, createdAt: GROUP_DTO.created_at, updatedAt: GROUP_DTO.updated_at }]);
    expect(team.members.length).toBeGreaterThan(0);
    expect(team.members.every((m) => m.groupId === '1')).toBe(true);
  });

  test('preserves a locally chosen trainingPlanId for a group already known in this session', async () => {
    useTeamStore.setState({ teams: [{ id: '1', name: 'X', groups: [{ id: '1', teamId: '1', name: 'General', isDefault: true, trainingPlanId: 'plan-5k' }], members: [] }] });
    listGroupsService.mockResolvedValue([GROUP_DTO]);
    await useTeamStore.getState().fetchGroups('1', 7);
    const team = useTeamStore.getState().teams.find((t) => t.id === '1');
    expect(team.groups[0].trainingPlanId).toBe('plan-5k');
  });

  test('returns an empty roster when the team has no groups yet', async () => {
    useTeamStore.setState({ teams: [{ id: '1', name: 'X', groups: [], members: [] }] });
    listGroupsService.mockResolvedValue([]);
    await useTeamStore.getState().fetchGroups('1', 7);
    const team = useTeamStore.getState().teams.find((t) => t.id === '1');
    expect(team.groups).toEqual([]);
    expect(team.members).toEqual([]);
  });

  test('returns a failure result when the service call rejects', async () => {
    listGroupsService.mockRejectedValue(new Error('Sin conexión.'));
    const result = await useTeamStore.getState().fetchGroups('1', 7);
    expect(result).toEqual({ success: false, error: 'Sin conexión.' });
  });
});
```

- [ ] **Step 2: Correr los tests y confirmar que fallan**

Run: `npx jest team-store.test.js -t fetchGroups`
Expected: FAIL — `fetchGroups is not a function`.

- [ ] **Step 3: Implementar en `store/team-store.js`**

Sacar `buildDefaultGroup` y la constante `DEFAULT_GROUP_NAME` (borrar ambos bloques, líneas ~26-32 y ~92-94 del archivo actual).

Cambiar el import del principio del archivo para sumar `listGroups`/`toGroupModel`:

```js
import { create } from 'zustand';
import {
  createTeam as createTeamService,
  getTeam as getTeamService,
  listTeams as listTeamsService,
  updateTeam as updateTeamService,
  updateTeamAddress as updateTeamAddressService,
  deleteTeam as deleteTeamService,
} from '../services/teams.js';
import { listGroups as listGroupsService } from '../services/groups.js';
import { toTeamModel, toCreateTeamPayload, toUpdateTeamPayload, toAddressPayload, toGroupModel } from '../services/normalizers.js';
```

Agregar guarda de array vacío al principio de `generateMockMembers` (evita dividir por longitud 0 antes de que `fetchGroups` haya corrido):

```js
function generateMockMembers(teamId, groups) {
  if (groups.length === 0) return [];
  return Array.from({ length: MOCK_ROSTER_SIZE }, (_, i) => {
```

Simplificar `decorateTeam` — ya no arma `groups`/`members`, arrancan vacíos (los llena `fetchGroups` o el flujo de `createTeam` de la Task 4):

```js
function decorateTeam(team, extra = {}) {
  return {
    ...team,
    status: team.status ?? 'activo',
    photoUri: extra.photoUri ?? null,
    showGroupsToRunners: team.showGroupsToRunners ?? false,
    groups: extra.groups ?? [],
    members: extra.members ?? [],
    invitedEmails: (extra.invitedEmails ?? []).map((invite) => buildInvitedEmail(invite, extra.defaultGroupId ?? '')),
  };
}
```

(el manejo de `invitedEmails`/grupo default para invitaciones sin grupo elegido se termina de resolver en la Task 4, donde `createTeam` ya conoce el id real del grupo principal antes de llamar a `decorateTeam` — acá solo se prepara la firma con `extra.defaultGroupId`).

Agregar la acción `fetchGroups` dentro de `create((set, get) => ({ ... }))`, después de `fetchTeam`:

```js
  // Trae los grupos reales de un equipo (GET /groups) y regenera el
  // roster mock a partir de ellos — separado de fetchTeam/fetchTeams
  // porque un equipo puede estar en `teams` sin sus grupos todavía
  // cargados (ya no vienen sincrónicos, ver decorateTeam). Preserva
  // trainingPlanId elegido localmente para un grupo que ya estaba en
  // memoria (catálogo mock, sin campo en el backend — ver
  // docs/BACKEND_API_GAPS.md gap 4).
  fetchGroups: async (teamId, userId) => {
    try {
      const dtos = await listGroupsService(teamId, userId);
      const existingTeam = get().teams.find((t) => t.id === teamId);
      const groups = dtos.map((dto) => {
        const model = toGroupModel(dto);
        const existingGroup = existingTeam?.groups.find((g) => g.id === model.id);
        return existingGroup ? { ...model, trainingPlanId: existingGroup.trainingPlanId } : model;
      });
      const members = generateMockMembers(teamId, groups);
      set((state) => ({
        teams: state.teams.map((t) => (t.id === teamId ? { ...t, groups, members } : t)),
      }));
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  },
```

- [ ] **Step 4: Correr los tests y confirmar que pasan**

Run: `npx jest team-store.test.js`
Expected: puede haber fallos en tests preexistentes de `createTeam`/`fetchTeams`/`fetchTeam` que asumían `team.groups`/`team.members` poblados sincrónicamente — **no los arregles en este paso**, la Task 4 los reescribe. Confirmar únicamente que los 4 tests de `fetchGroups` de este paso pasan: `npx jest team-store.test.js -t fetchGroups` → PASS.

- [ ] **Step 5: Commit**

```bash
git add store/team-store.js __tests__/team-store.test.js
git commit -m "feat(teams): fetch real groups instead of a synthetic default group"
```

---

### Task 4: `store/team-store.js` — `createTeam` crea grupos reales

**Files:**
- Modify: `store/team-store.js`
- Test: `__tests__/team-store.test.js`

**Interfaces:**
- Consumes: `createGroup`/`listGroups` de `services/groups.js`, `toCreateGroupPayload`/`toGroupModel` de `services/normalizers.js`, `fetchGroups`/`decorateTeam` de la Task 3.
- Produces: `createTeam(payload)` sigue devolviendo `{success, team?, addressWarning?, groupsWarning?, error?}` — `team.groups`/`team.members` quedan poblados con datos reales antes de devolver el resultado.

**Nota para el implementador:** este paso reescribe tests existentes de `createTeam` que en el código actual asumen un grupo default sintético instantáneo (`createTeam defaults showGroupsToRunners to false`, `createTeam defaults photoUri...`, `createTeam defaults to status activo and generates a mock roster...`, `fetchTeams preserves local-only fields (groups) for a team already known in this session`) — localizalos por nombre en `__tests__/team-store.test.js` y reemplazalos por los de abajo (no los dejes duplicados).

- [ ] **Step 1: Escribir/reescribir los tests**

Sumar al mock de `services/groups.js` del test (Task 3 ya agregó `listGroups`; agregar `createGroup`):

```js
jest.mock('../services/groups.js', () => ({
  listGroups: jest.fn(),
  createGroup: jest.fn(),
}));

import { listGroups as listGroupsService, createGroup as createGroupService } from '../services/groups.js';
```

Reemplazar el test `'createTeam defaults showGroupsToRunners to false — not exposed in the creation wizard'` (deja el nombre, pero el flujo ahora necesita mockear `listGroupsService` para el `GET /groups` final que hace `createTeam`):

```js
  const DEFAULT_GROUP_DTO = { id: 100, team_id: 1, name: 'General', description: null, is_main: true, created_at: '2026-01-01T00:00:00.000Z', updated_at: '2026-01-01T00:00:00.000Z' };

  test('createTeam defaults showGroupsToRunners to false — not exposed in the creation wizard', async () => {
    createTeamService.mockResolvedValue(TEAM_DTO);
    listGroupsService.mockResolvedValue([DEFAULT_GROUP_DTO]);
    const result = await useTeamStore.getState().createTeam({ name: 'Sin config de privacidad', maxMembers: 10, ownerId: 7 });
    expect(result.team.showGroupsToRunners).toBe(false);
  });
```

Reemplazar `'createTeam defaults photoUri to null and invitedEmails to an empty array'`:

```js
  test('createTeam defaults photoUri to null and invitedEmails to an empty array', async () => {
    createTeamService.mockResolvedValue(TEAM_DTO);
    listGroupsService.mockResolvedValue([DEFAULT_GROUP_DTO]);
    const result = await useTeamStore.getState().createTeam({ name: 'Sin datos opcionales', maxMembers: 10, ownerId: 7 });
    expect(result.team.photoUri).toBeNull();
    expect(result.team.invitedEmails).toEqual([]);
    expect(result.team.groups).toHaveLength(1);
    expect(result.team.groups[0].isDefault).toBe(true);
  });
```

Reemplazar `'createTeam defaults to status activo and generates a mock roster referencing real groups'`:

```js
  test('createTeam defaults to status activo and generates a mock roster referencing real groups', async () => {
    createTeamService.mockResolvedValue(TEAM_DTO);
    listGroupsService.mockResolvedValue([DEFAULT_GROUP_DTO]);
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
```

Agregar tests nuevos para creación de grupos extra + remapeo (después del test anterior):

```js
  test('createTeam creates the extra draft groups against the backend and remaps invitedEmails by name', async () => {
    createTeamService.mockResolvedValue(TEAM_DTO);
    const AVANZADOS_DTO = { id: 101, team_id: 1, name: 'Avanzados', description: null, is_main: false, created_at: '2026-01-01T00:00:00.000Z', updated_at: '2026-01-01T00:00:00.000Z' };
    createGroupService.mockResolvedValue(AVANZADOS_DTO);
    listGroupsService.mockResolvedValue([DEFAULT_GROUP_DTO, AVANZADOS_DTO]);

    const result = await useTeamStore.getState().createTeam({
      name: 'Con grupo extra', maxMembers: 10, ownerId: 7,
      groups: [{ id: 'group-draft-1', name: 'Avanzados', description: null, trainingPlanId: 'plan-10k' }],
      invitedEmails: [{ email: 'a@b.com', groupId: 'group-draft-1' }],
    });

    expect(createGroupService).toHaveBeenCalledWith({ team_id: 1, name: 'Avanzados' });
    expect(result.team.groups).toHaveLength(2);
    const avanzados = result.team.groups.find((g) => g.name === 'Avanzados');
    expect(avanzados.trainingPlanId).toBe('plan-10k');
    expect(result.team.invitedEmails[0].groupId).toBe(avanzados.id);
  });

  test('createTeam falls back invites without a chosen group to the real default group', async () => {
    createTeamService.mockResolvedValue(TEAM_DTO);
    listGroupsService.mockResolvedValue([DEFAULT_GROUP_DTO]);
    const result = await useTeamStore.getState().createTeam({
      name: 'Sin grupo elegido', maxMembers: 10, ownerId: 7,
      invitedEmails: [{ email: 'sin-grupo@b.com', groupId: '' }],
    });
    const defaultGroup = result.team.groups.find((g) => g.isDefault);
    expect(result.team.invitedEmails).toEqual([{
      email: 'sin-grupo@b.com', groupId: defaultGroup.id, invitedAt: expect.any(String), registered: expect.any(Boolean),
    }]);
  });

  test('createTeam succeeds with groupsWarning when an extra group fails to create', async () => {
    createTeamService.mockResolvedValue(TEAM_DTO);
    createGroupService.mockRejectedValue(new Error('falló'));
    listGroupsService.mockResolvedValue([DEFAULT_GROUP_DTO]);
    const result = await useTeamStore.getState().createTeam({
      name: 'Con grupo que falla', maxMembers: 10, ownerId: 7,
      groups: [{ id: 'group-draft-1', name: 'Avanzados', description: null, trainingPlanId: null }],
    });
    expect(result.success).toBe(true);
    expect(result.groupsWarning).toBe(true);
  });
```

Borrar (ya no aplica, `fetchTeams` ya no decora grupos por sí solo — el equivalente ahora es un test de `fetchGroups`, cubierto en la Task 3) el test `'fetchTeams preserves local-only fields (groups) for a team already known in this session'`.

- [ ] **Step 2: Correr los tests y confirmar que fallan**

Run: `npx jest team-store.test.js -t createTeam`
Expected: FAIL — `result.team.groups` vacío o `createGroupService`/`listGroupsService` no invocados como se espera (la implementación de `createTeam` todavía es la de la Task 3, sin el tramo de grupos).

- [ ] **Step 3: Implementar en `store/team-store.js`**

Reemplazar la función `createTeam` completa (dentro del store) por:

```js
  createTeam: async (payload) => {
    try {
      const created = await createTeamService(toCreateTeamPayload(payload));
      const teamId = String(created.id);
      let team = decorateTeam(toTeamModel(created), { photoUri: payload.photoUri });
      set((state) => ({ teams: [...state.teams, team], selectedTeamId: team.id }));

      const hasAddress = Boolean(payload.country || payload.province || payload.city);
      let addressWarning;
      if (hasAddress) {
        try {
          await updateTeamAddressService(teamId, toAddressPayload(payload));
          team = { ...team, country: payload.country || null, province: payload.province || null, city: payload.city || null };
          set((state) => ({ teams: state.teams.map((t) => (t.id === teamId ? team : t)) }));
        } catch {
          addressWarning = true;
        }
      }

      const draftGroups = payload.groups ?? [];
      let groupsWarning;
      const createdGroupNames = new Set();
      for (const draft of draftGroups) {
        try {
          await createGroupService(toCreateGroupPayload(teamId, draft));
          createdGroupNames.add(draft.name);
        } catch {
          groupsWarning = true;
        }
      }

      const groupDtos = await listGroupsService(teamId, get().teams.find((t) => t.id === teamId)?.ownerId ?? payload.ownerId);
      const groups = groupDtos.map((dto) => {
        const model = toGroupModel(dto);
        const draft = draftGroups.find((d) => d.name === model.name);
        return draft ? { ...model, trainingPlanId: draft.trainingPlanId ?? null } : model;
      });
      const defaultGroup = groups.find((g) => g.isDefault);

      const nameByDraftId = new Map(draftGroups.map((d) => [d.id, d.name]));
      const invitedEmails = (payload.invitedEmails ?? []).map((invite) => {
        const draftName = nameByDraftId.get(invite.groupId);
        const resolvedGroup = draftName ? groups.find((g) => g.name === draftName) : null;
        return { ...invite, groupId: resolvedGroup?.id ?? defaultGroup?.id ?? '' };
      });

      const members = generateMockMembers(teamId, groups);
      team = {
        ...team,
        groups,
        members,
        invitedEmails: invitedEmails.map((invite) => buildInvitedEmail(invite, defaultGroup?.id ?? '')),
      };
      set((state) => ({ teams: state.teams.map((t) => (t.id === teamId ? team : t)) }));

      return { success: true, team, ...(addressWarning ? { addressWarning } : {}), ...(groupsWarning ? { groupsWarning } : {}) };
    } catch (error) {
      return { success: false, error: error.message };
    }
  },
```

- [ ] **Step 4: Correr los tests y confirmar que pasan**

Run: `npx jest team-store.test.js`
Expected: PASS — toda la suite del archivo (incluye los tests de `updateTeam`/`deleteTeam`/`fetchTeams`/`fetchTeam`/`fetchGroups` sin cambios de comportamiento).

- [ ] **Step 5: Commit**

```bash
git add store/team-store.js __tests__/team-store.test.js
git commit -m "feat(teams): create real groups (extra + default) when creating a team"
```

---

### Task 5: `store/team-store.js` — CRUD de grupos para un equipo ya existente

**Files:**
- Modify: `store/team-store.js`
- Test: `__tests__/team-store.test.js`

**Interfaces:**
- Consumes: `createGroup`/`updateGroup`/`deleteGroup` de `services/groups.js`, `toCreateGroupPayload`/`toUpdateGroupPayload`/`toGroupModel` de `services/normalizers.js`.
- Produces: `createGroupInTeam(teamId, form)`, `updateGroupReal(teamId, groupId, form)`, `deleteGroupReal(teamId, groupId)` — todas `async`, devuelven `{success, group?/error?}` (`deleteGroupReal` devuelve solo `{success, error?}`).

- [ ] **Step 1: Escribir los tests que fallan**

Sumar al mock de `services/groups.js` del test:

```js
jest.mock('../services/groups.js', () => ({
  listGroups: jest.fn(),
  createGroup: jest.fn(),
  updateGroup: jest.fn(),
  deleteGroup: jest.fn(),
}));

import {
  listGroups as listGroupsService, createGroup as createGroupService,
  updateGroup as updateGroupService, deleteGroup as deleteGroupService,
} from '../services/groups.js';
```

Agregar `describe` nuevo:

```js
describe('createGroupInTeam / updateGroupReal / deleteGroupReal', () => {
  beforeEach(() => {
    useTeamStore.setState({
      teams: [{ id: '1', name: 'X', groups: [{ id: '1', teamId: '1', name: 'General', isDefault: true, trainingPlanId: null }], members: [] }],
    });
  });

  test('createGroupInTeam posts the group and appends it to team.groups', async () => {
    createGroupService.mockResolvedValue({ id: 2, team_id: 1, name: 'Avanzados', description: null, is_main: false, created_at: 'x', updated_at: 'x' });
    const result = await useTeamStore.getState().createGroupInTeam('1', { name: 'Avanzados' });
    expect(createGroupService).toHaveBeenCalledWith({ team_id: 1, name: 'Avanzados' });
    expect(result.success).toBe(true);
    expect(result.group.name).toBe('Avanzados');
    const team = useTeamStore.getState().teams.find((t) => t.id === '1');
    expect(team.groups).toHaveLength(2);
  });

  test('createGroupInTeam returns a failure result when the service call rejects', async () => {
    createGroupService.mockRejectedValue(new Error('falló'));
    const result = await useTeamStore.getState().createGroupInTeam('1', { name: 'Avanzados' });
    expect(result).toEqual({ success: false, error: 'falló' });
  });

  test('updateGroupReal updates the group in place, keeps trainingPlanId untouched', async () => {
    updateGroupService.mockResolvedValue({ id: 1, team_id: 1, name: 'Nuevo nombre', description: null, is_main: true, created_at: 'x', updated_at: 'y' });
    const result = await useTeamStore.getState().updateGroupReal('1', '1', { name: 'Nuevo nombre' });
    expect(result.success).toBe(true);
    expect(result.group.name).toBe('Nuevo nombre');
    const team = useTeamStore.getState().teams.find((t) => t.id === '1');
    expect(team.groups[0].name).toBe('Nuevo nombre');
    expect(team.groups[0].trainingPlanId).toBeNull();
  });

  test('deleteGroupReal removes the group from team.groups', async () => {
    useTeamStore.setState({
      teams: [{ id: '1', name: 'X', groups: [
        { id: '1', teamId: '1', name: 'General', isDefault: true },
        { id: '2', teamId: '1', name: 'Avanzados', isDefault: false },
      ], members: [] }],
    });
    deleteGroupService.mockResolvedValue(null);
    const result = await useTeamStore.getState().deleteGroupReal('1', '2');
    expect(result).toEqual({ success: true });
    const team = useTeamStore.getState().teams.find((t) => t.id === '1');
    expect(team.groups.map((g) => g.id)).toEqual(['1']);
  });

  test('deleteGroupReal returns a failure result when the service call rejects', async () => {
    deleteGroupService.mockRejectedValue(new Error('El grupo tiene corredores asignados.'));
    const result = await useTeamStore.getState().deleteGroupReal('1', '2');
    expect(result).toEqual({ success: false, error: 'El grupo tiene corredores asignados.' });
  });
});
```

- [ ] **Step 2: Correr los tests y confirmar que fallan**

Run: `npx jest team-store.test.js -t "createGroupInTeam"`
Expected: FAIL — las tres funciones no existen todavía.

- [ ] **Step 3: Implementar en `store/team-store.js`**

Sumar `createGroup`/`updateGroup`/`deleteGroup` al import de `services/groups.js` (con alias para no chocar con nombres del store):

```js
import { listGroups as listGroupsService, createGroup as createGroupService, updateGroup as updateGroupService, deleteGroup as deleteGroupService } from '../services/groups.js';
import { toTeamModel, toCreateTeamPayload, toUpdateTeamPayload, toAddressPayload, toGroupModel, toCreateGroupPayload, toUpdateGroupPayload } from '../services/normalizers.js';
```

Reemplazar la acción `updateGroup` existente (síncrona, al final del store) por estas tres:

```js
  // Crea un grupo nuevo en un equipo ya existente (POST /groups) — a
  // diferencia de los grupos armados en el wizard de creación, este no
  // pasa por un estado "draft", pega directo al backend.
  createGroupInTeam: async (teamId, form) => {
    try {
      const created = await createGroupService(toCreateGroupPayload(teamId, form));
      const group = toGroupModel(created);
      set((state) => ({
        teams: state.teams.map((t) => (t.id === teamId ? { ...t, groups: [...t.groups, group] } : t)),
      }));
      return { success: true, group };
    } catch (error) {
      return { success: false, error: error.message };
    }
  },

  // Edita nombre/descripción de un grupo real (PUT /groups/{id}).
  // trainingPlanId sigue siendo local-only (sin campo en el backend, ver
  // docs/BACKEND_API_GAPS.md gap 4) — se conserva del grupo ya en memoria,
  // no lo toca esta acción.
  updateGroupReal: async (teamId, groupId, form) => {
    try {
      const updated = await updateGroupService(groupId, toUpdateGroupPayload(form));
      const model = toGroupModel(updated);
      set((state) => ({
        teams: state.teams.map((t) => {
          if (t.id !== teamId) return t;
          return {
            ...t,
            groups: t.groups.map((g) => (g.id === groupId ? { ...model, trainingPlanId: g.trainingPlanId } : g)),
          };
        }),
      }));
      const team = get().teams.find((t) => t.id === teamId);
      return { success: true, group: team.groups.find((g) => g.id === groupId) };
    } catch (error) {
      return { success: false, error: error.message };
    }
  },

  // Borra un grupo real (DELETE /groups/{id}) — la UI no ofrece esta
  // acción para el grupo principal (isDefault), no hace falta chequearlo
  // acá de nuevo.
  deleteGroupReal: async (teamId, groupId) => {
    try {
      await deleteGroupService(groupId);
      set((state) => ({
        teams: state.teams.map((t) => (t.id === teamId ? { ...t, groups: t.groups.filter((g) => g.id !== groupId) } : t)),
      }));
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  },
```

- [ ] **Step 4: Correr los tests y confirmar que pasan**

Run: `npx jest team-store.test.js`
Expected: PASS — toda la suite.

- [ ] **Step 5: Correr lint**

Run: `npm run lint`
Expected: sin errores.

- [ ] **Step 6: Commit**

```bash
git add store/team-store.js __tests__/team-store.test.js
git commit -m "feat(teams): real create/update/delete for groups within an existing team"
```

---

### Task 6: `edit-group-screen.jsx` — edición real + fetch de grupos

**Files:**
- Modify: `components/team/edit-group-screen.jsx`

**Interfaces:**
- Consumes: `updateGroupReal(teamId, groupId, form)` y `fetchGroups(teamId, userId)` de la Task 3/5.

- [ ] **Step 1: Modificar imports y estado**

Reemplazar los imports del principio del archivo:

```js
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import Toast from 'react-native-toast-message';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useThemeColors } from '../../theme/colors.js';
import { isWeb } from '../../utils/platform.js';
import { useAuthStore } from '../../store/auth-store.js';
import { useTeamStore, TRAINING_PLAN_OPTIONS } from '../../store/team-store.js';
import { SectionCard } from '../forms/section-card.jsx';
import { InputField, PickerField, SelectField } from '../forms/fields.jsx';
```

Reemplazar el cuerpo de `EditGroupScreen` desde la declaración hasta el `if (loadingTeam) {` (inclusive el bloque de `useEffect` de fetch de equipo) por:

```js
export function EditGroupScreen({ teamId, groupId }) {
  const router = useRouter();
  const colors = useThemeColors();
  const user = useAuthStore((s) => s.user);
  const team = useTeamStore((s) => s.teams.find((t) => t.id === teamId));
  const updateGroupReal = useTeamStore((s) => s.updateGroupReal);
  const fetchTeam = useTeamStore((s) => s.fetchTeam);
  const fetchGroups = useTeamStore((s) => s.fetchGroups);
  const group = team?.groups.find((g) => g.id === groupId);

  const [name, setName] = useState(group?.name ?? '');
  const [description, setDescription] = useState(group?.description ?? '');
  const [trainingPlanId, setTrainingPlanId] = useState(group?.trainingPlanId ?? '');
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [loadingTeam, setLoadingTeam] = useState(!team);
  const [loadingGroups, setLoadingGroups] = useState(true);

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

  // Los grupos ya no vienen decorados sincrónicamente con el equipo (ver
  // store/team-store.js#fetchGroups) — este efecto corre siempre, aunque
  // el equipo ya esté en el store, porque team.groups puede seguir vacío.
  useEffect(() => {
    if (!user?.userId) return undefined;
    let cancelled = false;
    setLoadingGroups(true);
    fetchGroups(teamId, user.userId).finally(() => { if (!cancelled) setLoadingGroups(false); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teamId, user?.userId]);

  useEffect(() => {
    if (group) {
      setName(group.name);
      setDescription(group.description ?? '');
      setTrainingPlanId(group.trainingPlanId ?? '');
    }
  }, [group]);

  if (loadingTeam || loadingGroups) {
    return (
      <View className="flex-1 items-center justify-center bg-paper dark:bg-ink" nativeID="edit-group-loading" testID="edit-group-loading">
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }
```

(el `useEffect` nuevo que sincroniza `name`/`description`/`trainingPlanId` cuando `group` llega después del render inicial es necesario porque antes `group` ya estaba disponible en el primer render — ahora puede llegar async vía `fetchGroups`, y sin este efecto el formulario quedaría con los valores vacíos del `useState` inicial).

- [ ] **Step 2: Modificar `handleSubmit`**

Reemplazar:

```js
  const handleSubmit = () => {
    const trimmed = name.trim();
    if (!trimmed) {
      setError('Ingresá un nombre para el grupo.');
      return;
    }
    const duplicate = team.groups.some((g) => g.id !== groupId && g.name.toLowerCase() === trimmed.toLowerCase());
    if (duplicate) {
      setError('Ya existe un grupo con ese nombre.');
      return;
    }
    updateGroup(teamId, groupId, { name: trimmed, description: description.trim() || null, trainingPlanId: trainingPlanId || null });
    Toast.show({ type: 'success', text1: 'Grupo actualizado' });
    router.back();
  };
```

por:

```js
  const handleSubmit = async () => {
    const trimmed = name.trim();
    if (!trimmed) {
      setError('Ingresá un nombre para el grupo.');
      return;
    }
    const duplicate = team.groups.some((g) => g.id !== groupId && g.name.toLowerCase() === trimmed.toLowerCase());
    if (duplicate) {
      setError('Ya existe un grupo con ese nombre.');
      return;
    }
    if (submitting) return;
    setSubmitting(true);
    const result = await updateGroupReal(teamId, groupId, { name: trimmed, description: description.trim() || null });
    setSubmitting(false);
    if (!result.success) {
      Toast.show({ type: 'error', text1: 'No pudimos actualizar el grupo', text2: result.error });
      return;
    }
    Toast.show({ type: 'success', text1: 'Grupo actualizado' });
    router.back();
  };
```

(`trainingPlanId` se sigue mostrando/editando en el select del formulario, pero como no hay ningún dispatch que lo persista a ningún lado — ni al backend ni al store real, ver Global Constraints — queda como estado local del formulario sin efecto de guardado; esto ya era así antes en la práctica, dado que Etapa 2 no suma persistencia para ese campo).

Actualizar el botón de guardar para reflejar `submitting` (reemplazar el `<Pressable ... onPress={handleSubmit} ...>` de guardar):

```jsx
          <Pressable
            className="mt-2 h-12 flex-row items-center justify-center gap-2 rounded-full bg-primary hover:opacity-90 active:opacity-80 disabled:opacity-60"
            disabled={submitting}
            nativeID="edit-group-save-button"
            onPress={handleSubmit}
            testID="edit-group-save-button"
          >
            {submitting ? (
              <ActivityIndicator color={colors.onPrimary} size="small" />
            ) : (
              <>
                <MaterialCommunityIcons color={colors.onPrimary} name="check" size={18} />
                <Text className="text-sm font-semibold uppercase tracking-wide text-[#111518]" nativeID="edit-group-save-button-label" testID="edit-group-save-button-label">
                  Guardar cambios
                </Text>
              </>
            )}
          </Pressable>
```

- [ ] **Step 3: Verificar manualmente**

Con mocks (`EXPO_PUBLIC_USE_MOCKS=true`): entrar a `/teams/{id}/groups/{groupId}/edit` de un grupo no-principal, cambiar el nombre, guardar, confirmar toast de éxito y que el nombre nuevo se ve al volver al detalle del equipo.

- [ ] **Step 4: Correr lint**

Run: `npm run lint`
Expected: sin errores.

- [ ] **Step 5: Commit**

```bash
git add components/team/edit-group-screen.jsx
git commit -m "feat(teams): edit-group screen updates the real group via PUT /groups/{id}"
```

---

### Task 7: `invite-team-members-screen.jsx` — fetch de grupos

**Files:**
- Modify: `components/team/invite-team-members-screen.jsx`

**Interfaces:**
- Consumes: `fetchGroups(teamId, userId)` de la Task 3.

- [ ] **Step 1: Ubicar el `useEffect` de fetch de equipo existente**

Buscar en `components/team/invite-team-members-screen.jsx` el `useEffect` que llama `fetchTeam(teamId)` (agregado en Etapa 1, mismo patrón que en `edit-group-screen.jsx`/`team-detail-screen.jsx`) y el `useState` de `loadingTeam` asociado.

- [ ] **Step 2: Agregar el import de `useAuthStore` y el fetch de grupos**

Agregar el import (si no está ya):

```js
import { useAuthStore } from '../../store/auth-store.js';
```

Dentro del componente, junto a los selectores existentes de `useTeamStore`, agregar:

```js
  const user = useAuthStore((s) => s.user);
  const fetchGroups = useTeamStore((s) => s.fetchGroups);
  const [loadingGroups, setLoadingGroups] = useState(true);

  useEffect(() => {
    if (!user?.userId) return undefined;
    let cancelled = false;
    setLoadingGroups(true);
    fetchGroups(teamId, user.userId).finally(() => { if (!cancelled) setLoadingGroups(false); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teamId, user?.userId]);
```

Sumar `loadingGroups` a la condición existente que muestra el `ActivityIndicator` de carga (buscar el `if (loadingTeam) { ... }` o equivalente y cambiarlo a `if (loadingTeam || loadingGroups) { ... }`).

- [ ] **Step 2: Verificar manualmente**

Con mocks: entrar a `/teams/{id}/invite`, confirmar que el selector de grupo del formulario de invitación (`EmailListField`) muestra los grupos reales del equipo (el principal + cualquier extra creado).

- [ ] **Step 3: Correr lint**

Run: `npm run lint`
Expected: sin errores.

- [ ] **Step 4: Commit**

```bash
git add components/team/invite-team-members-screen.jsx
git commit -m "feat(teams): invite screen fetches real groups for the group picker"
```

---

### Task 8: `team-detail-screen.jsx` — fetch de grupos, agregar y borrar grupo

**Files:**
- Modify: `components/team/team-detail-screen.jsx`

**Interfaces:**
- Consumes: `fetchGroups`, `createGroupInTeam`, `deleteGroupReal` de las Tasks 3/5.

- [ ] **Step 1: Agregar fetch de grupos**

Junto al `useEffect` existente de `fetchTeam` (líneas ~553-564 del archivo actual), agregar:

```js
  const fetchGroups = useTeamStore((s) => s.fetchGroups);
  const createGroupInTeam = useTeamStore((s) => s.createGroupInTeam);
  const deleteGroupReal = useTeamStore((s) => s.deleteGroupReal);
  const [loadingGroups, setLoadingGroups] = useState(true);

  useEffect(() => {
    if (!user?.userId) return undefined;
    let cancelled = false;
    setLoadingGroups(true);
    fetchGroups(teamId, user.userId).finally(() => { if (!cancelled) setLoadingGroups(false); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teamId, user?.userId]);
```

Actualizar la condición de loading (`if (loadingTeam) {` → `if (loadingTeam || loadingGroups) {`).

- [ ] **Step 2: Agregar estado y handlers del form de "agregar grupo"**

Junto a `const [deleteModalVisible, setDeleteModalVisible] = useState(false);`, agregar:

```js
  const [addGroupVisible, setAddGroupVisible] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [newGroupDescription, setNewGroupDescription] = useState('');
  const [newGroupError, setNewGroupError] = useState(null);
  const [addingGroup, setAddingGroup] = useState(false);
  const [deletingGroupId, setDeletingGroupId] = useState(null);

  const handleAddGroup = async () => {
    const trimmed = newGroupName.trim();
    if (!trimmed) {
      setNewGroupError('Ingresá un nombre para el grupo.');
      return;
    }
    if (team.groups.some((g) => g.name.toLowerCase() === trimmed.toLowerCase())) {
      setNewGroupError('Ya existe un grupo con ese nombre.');
      return;
    }
    setAddingGroup(true);
    const result = await createGroupInTeam(team.id, { name: trimmed, description: newGroupDescription.trim() || null });
    setAddingGroup(false);
    if (!result.success) {
      Toast.show({ type: 'error', text1: 'No pudimos crear el grupo', text2: result.error });
      return;
    }
    setNewGroupName('');
    setNewGroupDescription('');
    setNewGroupError(null);
    setAddGroupVisible(false);
    Toast.show({ type: 'success', text1: 'Grupo creado' });
  };

  const handleDeleteGroup = async (group) => {
    setDeletingGroupId(group.id);
    const result = await deleteGroupReal(team.id, group.id);
    setDeletingGroupId(null);
    if (!result.success) {
      Toast.show({ type: 'error', text1: 'No pudimos eliminar el grupo', text2: result.error });
      return;
    }
    Toast.show({ type: 'success', text1: 'Grupo eliminado' });
  };
```

- [ ] **Step 3: Sumar botón de borrar a `GroupRow`**

Modificar la firma de `GroupRow` (agregar `onDelete`/`deleting`):

```js
function GroupRow({ group, members, planName, colors, onEdit, canEdit, onDelete, deleting }) {
```

Reemplazar el bloque `const editButton = ...` por:

```js
  const editButton = canEdit && (
    <View className="flex-row items-center gap-1" nativeID={`team-detail-group-${group.id}-actions`} testID={`team-detail-group-${group.id}-actions`}>
      <Pressable
        accessibilityLabel={`Editar grupo ${group.name}`}
        className="rounded-full p-1.5 hover:bg-slate-200 dark:hover:bg-slate-800"
        nativeID={`team-detail-group-${group.id}-edit-button`}
        onPress={onEdit}
        testID={`team-detail-group-${group.id}-edit-button`}
      >
        <MaterialCommunityIcons color={colors.onSurfaceVariant} name="pencil-outline" size={18} />
      </Pressable>
      <Pressable
        accessibilityLabel={`Eliminar grupo ${group.name}`}
        className="rounded-full p-1.5 hover:bg-slate-200 dark:hover:bg-slate-800"
        disabled={deleting}
        nativeID={`team-detail-group-${group.id}-delete-button`}
        onPress={onDelete}
        testID={`team-detail-group-${group.id}-delete-button`}
      >
        {deleting ? <ActivityIndicator color={colors.onSurfaceVariant} size="small" /> : <MaterialCommunityIcons color={colors.onSurfaceVariant} name="trash-can-outline" size={18} />}
      </Pressable>
    </View>
  );
```

- [ ] **Step 4: Actualizar el render de la sección Grupos**

Reemplazar el bloque `gruposContent` completo:

```jsx
  const gruposContent = isTrainerView && (
    <SectionCard
      headerRight={canManageTeam && (
        <Pressable
          accessibilityLabel="Agregar grupo"
          className="rounded-full p-1.5 hover:bg-slate-200 dark:hover:bg-slate-800"
          nativeID="team-detail-add-group-button"
          onPress={() => setAddGroupVisible((v) => !v)}
          testID="team-detail-add-group-button"
        >
          <MaterialCommunityIcons color={colors.onSurfaceVariant} name="plus" size={20} />
        </Pressable>
      )}
      icon="account-group"
      title="Grupos"
    >
      {addGroupVisible && (
        <View className="mb-4 gap-2 rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-900" nativeID="team-detail-add-group-form" testID="team-detail-add-group-form">
          <InputField
            dense
            error={newGroupError}
            label="Nombre del grupo"
            onChange={(text) => { setNewGroupName(text); if (newGroupError) setNewGroupError(null); }}
            placeholder="Ej. Grupo avanzado"
            value={newGroupName}
          />
          <InputField dense label="Descripción del grupo" multiline numberOfLines={2} onChange={setNewGroupDescription} placeholder="Ej. Corredores con mayor volumen y ritmo." value={newGroupDescription} />
          <Pressable
            className="h-10 flex-row items-center justify-center gap-2 self-start rounded-full bg-primary px-5 hover:opacity-90 active:opacity-80 disabled:opacity-60"
            disabled={addingGroup}
            nativeID="team-detail-add-group-submit"
            onPress={handleAddGroup}
            testID="team-detail-add-group-submit"
          >
            {addingGroup ? <ActivityIndicator color={colors.onPrimary} size="small" /> : (
              <Text className="text-sm font-semibold uppercase tracking-wide text-[#111518]" nativeID="team-detail-add-group-submit-label" testID="team-detail-add-group-submit-label">
                Crear grupo
              </Text>
            )}
          </Pressable>
        </View>
      )}
      <View className="gap-2" nativeID="team-detail-groups-list" testID="team-detail-groups-list">
        {team.groups.map((group) => (
          <GroupRow
            canEdit={canManageTeam && !group.isDefault}
            colors={colors}
            deleting={deletingGroupId === group.id}
            group={group}
            key={group.id}
            members={team.members.filter((m) => m.groupId === group.id)}
            onDelete={() => handleDeleteGroup(group)}
            onEdit={() => router.push(`/teams/${team.id}/groups/${group.id}/edit`)}
            planName={TRAINING_PLAN_OPTIONS.find((p) => p.id === group.trainingPlanId)?.name}
          />
        ))}
      </View>
    </SectionCard>
  );
```

- [ ] **Step 5: Verificar manualmente**

Con mocks: abrir el detalle de un equipo, pestaña Grupos → agregar un grupo nuevo → aparece en la lista → borrarlo → desaparece. Confirmar que el grupo principal no muestra ni lápiz ni tacho.

- [ ] **Step 6: Correr toda la suite y lint**

Run: `npm test && npm run lint`
Expected: PASS / sin errores.

- [ ] **Step 7: Commit**

```bash
git add components/team/team-detail-screen.jsx
git commit -m "feat(teams): add/delete real groups from the team detail screen"
```

---

## Después de este plan

Con Grupos cerrado, Etapa 3 (Invitaciones: listar pendientes vía `GET /teams/{id}/invitations`, aceptar/rechazar vía `POST /invitations/{id}/accept`/`reject`) se planifica aparte, en su propia rama — ya no está bloqueada por el backend (gaps 5/6 resueltos, ver `docs/BACKEND_API_GAPS.md`).
