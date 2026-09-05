# Team Search + Join Requests Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a corredor search public teams and request to join them; let the entrenador owner accept/reject those requests; replace the "Invitaciones" nav entry with a "Notificaciones" screen that surfaces both received invitations and join-request activity.

**Architecture:** New `services/join-requests.js` (+ mock) mirrors the existing `services/invitations.js` shape 1:1 against the real, now-confirmed backend contract. All new server state (search results, join requests) goes through TanStack Query hooks (`hooks/use-team-search.js`, `hooks/use-join-requests.js`), never Zustand — per `CLAUDE.md`'s existing convention. Three existing screens gain new sections (`edit-team-screen.jsx`, `teams-list-screen.jsx`, `team-detail-screen.jsx`); two screens are new (`team-search-screen.jsx`, `notifications-screen.jsx`, the latter replacing `received-invitations-screen.jsx` outright); the 3 shell components lose their hardcoded "Invitaciones" entry in favor of a "Notificaciones" one with a role-aware badge count.

**Tech Stack:** Expo/React Native + React Native Web, NativeWind, Zustand (unchanged domains only), `@tanstack/react-query` (all new state), Expo Router.

**Spec:** `docs/superpowers/specs/2026-09-03-team-search-join-requests-design.md`

## Global Constraints

- Every `View`/`Text`/`Pressable`/`ScrollView`/`TextInput` (and `Animated.*` variants) needs unique `nativeID` + `testID` (`local/require-native-id` ESLint rule, no exceptions except spread props).
- No render tests for screens/components/hooks — repo convention (CLAUDE.md "Testing"). Verification is manual preview (`EXPO_PUBLIC_USE_MOCKS=true`) + `npm test`/`npm run lint` green.
- New server-state work uses TanStack Query, never Zustand (CLAUDE.md "Estado de aplicación vs. de servidor").
- Metro platform-split imports (`.web.jsx`/`.jsx`) always written **without** an extension when relying on per-platform resolution (none of this plan's new files need a platform split — noted only because existing neighboring files like `checkout-flow` do; don't introduce one here).
- Real backend contract (confirmed 2026-09-05 against `https://paceron-backend-as9c.onrender.com/swagger/doc.json`, mergeado a `develop`) — exact field names below are taken directly from the live swagger schema, not guessed:
  - `TeamSearchResult`: `{ id, name, level, max_members, member_count, owner_name, is_public, country, province, city, icon_url }` (no `description`, no `visible` — a result is visible by definition).
  - `JoinRequestResponse`: `{ id, team_id, team_name, runner_id, runner_name, status, created_at }` (no email field).
  - `GET /teams/search` params: `name, level, country, province, city, page` (all optional query strings except `page`, integer, 1-indexed). Response: `{ teams: TeamSearchResult[], has_more: boolean }`, fixed page size 20.
  - `POST /teams/{id}/join-requests` — no body, 201 returns a `JoinRequestResponse`.
  - `DELETE /join-requests/{id}` — no body, no response body documented (204-style).
  - `GET /join-requests/mine` — array of `JoinRequestResponse`.
  - `GET /teams/{id}/join-requests` — array of `JoinRequestResponse` (pending only, per backend).
  - `GET /join-requests/pending-count` — `{ count: integer }`.
  - `POST /join-requests/{id}/accept` and `/reject` — no body.
  - `PUT /teams/{id}` (existing endpoint) gains 2 optional booleans: `visible` ("si aparece en resultados de búsqueda") and `is_public` ("si acepta solicitudes de ingreso") — confirmed in `UpdateTeamRequest` schema.
  - Error codes (`code` field alongside the 4xx): `TEAM_NOT_FOUND`, `TEAM_NOT_PUBLIC`, `TEAM_FULL`, `ALREADY_MEMBER`, `JOIN_REQUEST_ALREADY_PENDING`, `JOIN_REQUEST_NOT_FOUND`, `FORBIDDEN`, `JOIN_REQUEST_NOT_PENDING`.

---

### Task 1: Normalizers — team visible/isPublic + join-request models

**Files:**
- Modify: `services/normalizers.js` (see exact insertion points below)

**Interfaces:**
- Produces: `toTeamModel(dto)` gains `visible`/`isPublic` fields; `toUpdateTeamPayload(form)` accepts `form.visible`/`form.isPublic`; new `toTeamSearchResultModel(dto)`; new `toJoinRequestModel(dto)`. All 4 are consumed by later tasks (2, 3, 4, 6, 8, 9, 10, 11) — get these exactly right.

- [ ] **Step 1: Add `visible`/`isPublic` to `toTeamModel`**

Find this in `services/normalizers.js` (the existing `toTeamModel` function):

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

Replace with (adds 2 lines, `visible`/`isPublic`, both defaulting to `true` — matches the backend's confirmed default for all teams including pre-existing ones):

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
    visible: dto.visible ?? true,
    isPublic: dto.is_public ?? true,
    createdAt: dto.created_at,
    updatedAt: dto.updated_at,
    iconUrl: dto.icon_url ?? null,
  };
}
```

- [ ] **Step 2: Add `visible`/`isPublic` to `toUpdateTeamPayload`**

Find this in `services/normalizers.js`:

```js
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

  if (form.showGroupsToRunners !== undefined) payload.show_groups_to_runners = form.showGroupsToRunners;
```

Replace the last line (`if (form.showGroupsToRunners...`) with (booleans need the same `!== undefined` guard as `showGroupsToRunners` — a truthy check would silently drop an explicit `false`):

```js
  if (form.showGroupsToRunners !== undefined) payload.show_groups_to_runners = form.showGroupsToRunners;
  if (form.visible !== undefined) payload.visible = form.visible;
  if (form.isPublic !== undefined) payload.is_public = form.isPublic;
```

(Leave the rest of the function, including the closing `return payload; }`, untouched.)

- [ ] **Step 3: Add `toTeamSearchResultModel` and `toJoinRequestModel`**

Add these two new functions anywhere after `toTeamModel` in `services/normalizers.js` (e.g. right after the `toAddressPayload` function):

```js
// Resultado de GET /teams/search — forma DISTINTA a toTeamModel: el
// backend devuelve un objeto más chico y ya desnormalizado
// (TeamSearchResult en el swagger real, confirmado 2026-09-05), sin
// description/requirements/status/showGroupsToRunners/visible (un
// resultado de búsqueda es visible por definición, no hace falta
// devolverlo) y con 2 campos que sí son propios de este endpoint:
// member_count (cupo actual) y owner_name (ya resuelto server-side, sin
// fan-out extra del lado front).
export function toTeamSearchResultModel(dto) {
  if (!dto) return null;
  return {
    id: String(dto.id),
    name: dto.name,
    level: dto.level ?? null,
    maxMembers: dto.max_members,
    memberCount: dto.member_count ?? 0,
    ownerName: dto.owner_name ?? null,
    isPublic: Boolean(dto.is_public),
    country: dto.country ?? null,
    province: dto.province ?? null,
    city: dto.city ?? null,
    iconUrl: dto.icon_url ?? null,
  };
}

// JoinRequestResponse (swagger real) — sin email del corredor, a
// diferencia de InvitationResponse. Usado tanto para "mis solicitudes
// enviadas" (corredor) como "solicitudes de un equipo" (entrenador) —
// misma forma en los dos casos, el caller decide qué mostrar.
export function toJoinRequestModel(dto) {
  if (!dto) return null;
  return {
    id: String(dto.id),
    teamId: String(dto.team_id),
    teamName: dto.team_name ?? null,
    runnerId: dto.runner_id,
    runnerName: dto.runner_name ?? null,
    status: dto.status,
    createdAt: dto.created_at,
  };
}
```

- [ ] **Step 4: Run tests and lint**

Run: `npm test` and `npm run lint`
Expected: both green — this task only adds fields/functions, doesn't change existing call sites' behavior (all new fields are additive with safe defaults).

- [ ] **Step 5: Commit**

```bash
git add services/normalizers.js
git commit -m "feat(teams): add visible/isPublic and join-request normalizers"
```

---

### Task 2: `services/join-requests.js` + mock (+ teams-mock.js search helper)

**Files:**
- Create: `services/join-requests.js`
- Create: `services/__mocks__/join-requests-mock.js`
- Modify: `services/__mocks__/teams-mock.js` (add one new exported helper)

**Interfaces:**
- Consumes: `toTeamSearchResultModel`, `toJoinRequestModel` (Task 1) — actually, normalization happens in the HOOKS (Task 3/4), not in this service layer, matching the existing pattern where `services/*.js` always returns raw DTOs and callers normalize (see `services/invitations.js`, `services/teams.js` — neither imports normalizers).
- Produces: `searchTeams(filters, page)`, `createJoinRequest(teamId)`, `cancelJoinRequest(requestId)`, `listMyJoinRequests()`, `listTeamJoinRequests(teamId)`, `getPendingRequestsCount()`, `respondJoinRequest(requestId, accept)` — all return raw DTOs/arrays, consumed by Tasks 3 and 4.

- [ ] **Step 1: Add a raw-list getter to `teams-mock.js`**

In `services/__mocks__/teams-mock.js`, find:

```js
export function __getMockTeamOwnerId(teamId) {
  return mockTeams.find((t) => String(t.id) === String(teamId))?.owner_id ?? null;
}
```

Add immediately after it:

```js

// Getter de solo lectura sobre el array completo — usado por
// join-requests-mock.js para simular GET /teams/search sin duplicar el
// seed de equipos. Devuelve una copia (no la referencia) para que un
// caller no pueda mutar mockTeams por accidente vía este atajo.
export function __getAllMockTeams() {
  return [...mockTeams];
}
```

Also, every seed team in `buildSeedTeams()` needs `visible`/`is_public` fields (default `true`, matching the real backend's default for all teams) so the search mock has something consistent to filter on. Find the 4 team objects inside `buildSeedTeams()` (each currently ends its first line with `status: 'activo', country: ...`) — add `visible: true, is_public: true,` to each of the 4 objects, right after `status: 'activo',`. For example, team `id: 1` currently reads:

```js
    {
      id: 1, name: 'Corredores del Sur', description: 'Equipo de running enfocado en fondo y medio fondo, entrenamos 3 veces por semana.',
      level: 'amateur', max_members: 20, owner_id: 1, requirements: 'Compromiso de asistencia y ritmo base de 6 min/km.',
      status: 'activo', country: 'ARG', province: 'BA', city: 'La Plata', street: null, number: null,
      created_at: now, updated_at: now,
    },
```

becomes:

```js
    {
      id: 1, name: 'Corredores del Sur', description: 'Equipo de running enfocado en fondo y medio fondo, entrenamos 3 veces por semana.',
      level: 'amateur', max_members: 20, owner_id: 1, requirements: 'Compromiso de asistencia y ritmo base de 6 min/km.',
      status: 'activo', visible: true, is_public: true, country: 'ARG', province: 'BA', city: 'La Plata', street: null, number: null,
      created_at: now, updated_at: now,
    },
```

Apply the identical `visible: true, is_public: true,` insertion (right after `status: 'activo',`) to the other 3 team objects (ids 2, 3, 4) too.

- [ ] **Step 2: Create `services/__mocks__/join-requests-mock.js`**

```js
// Estado in-memory con la MISMA shape snake_case que el backend real
// (JoinRequestResponse, confirmado 2026-09-05 contra el swagger real) —
// mismo patrón stateful que invitations-mock.js. mockSearchTeams filtra
// sobre __getAllMockTeams() (teams-mock.js) en vez de tener su propio
// seed — un solo lugar de verdad para los equipos de prueba.
import { __getAllMockTeams, __getMockTeamOwnerId, __getMockTeamName } from './teams-mock.js';

const PAGE_SIZE = 20;

let mockJoinRequests = [];
let nextJoinRequestId = 1;

function findJoinRequestOrThrow(requestId) {
  const request = mockJoinRequests.find((r) => String(r.id) === String(requestId));
  if (!request) {
    const error = new Error('Solicitud no encontrada.');
    error.status = 404;
    throw error;
  }
  return request;
}

// GET /api/v1/teams/search — filtra por visible:true siempre (un equipo
// oculto nunca aparece, sin importar el resto de filtros), más los
// filtros opcionales recibidos. Paginación real: PAGE_SIZE fijo, page
// 1-indexado, has_more = todavía queda al menos 1 resultado después del
// corte actual.
export async function mockSearchTeams(filters, page) {
  const allTeams = __getAllMockTeams().filter((t) => t.visible !== false);
  const filtered = allTeams.filter((t) => {
    if (filters.name && !t.name.toLowerCase().includes(filters.name.toLowerCase())) return false;
    if (filters.level && t.level !== filters.level) return false;
    if (filters.country && t.country !== filters.country) return false;
    if (filters.province && t.province !== filters.province) return false;
    if (filters.city && t.city !== filters.city) return false;
    return true;
  });

  const pageNumber = page ?? 1;
  const start = (pageNumber - 1) * PAGE_SIZE;
  const pageItems = filtered.slice(start, start + PAGE_SIZE);
  const hasMore = start + PAGE_SIZE < filtered.length;

  const teams = pageItems.map((t) => ({
    id: t.id,
    name: t.name,
    level: t.level,
    max_members: t.max_members,
    member_count: 0,
    owner_name: 'Entrenador Demo',
    is_public: t.is_public !== false,
    country: t.country,
    province: t.province,
    city: t.city,
    icon_url: t.icon_url ?? null,
  }));

  return { teams, has_more: hasMore };
}

// POST /api/v1/teams/{id}/join-requests
export async function mockCreateJoinRequest(teamId) {
  if (mockJoinRequests.some((r) => String(r.team_id) === String(teamId) && r.status === 'pending')) {
    const error = new Error('Ya tenés una solicitud pendiente para este equipo.');
    error.status = 409;
    error.code = 'JOIN_REQUEST_ALREADY_PENDING';
    throw error;
  }
  const request = {
    id: nextJoinRequestId++,
    team_id: Number(teamId),
    team_name: __getMockTeamName(teamId),
    runner_id: 1,
    runner_name: 'Demo User',
    status: 'pending',
    created_at: new Date().toISOString(),
  };
  mockJoinRequests.push(request);
  return request;
}

// DELETE /api/v1/join-requests/{id}
export async function mockCancelJoinRequest(requestId) {
  const request = findJoinRequestOrThrow(requestId);
  mockJoinRequests = mockJoinRequests.filter((r) => r.id !== request.id);
  return null;
}

// GET /api/v1/join-requests/mine
export async function mockListMyJoinRequests() {
  return mockJoinRequests.filter((r) => r.runner_id === 1);
}

// GET /api/v1/teams/{id}/join-requests — solo pending, como el backend real.
export async function mockListTeamJoinRequests(teamId) {
  return mockJoinRequests.filter((r) => String(r.team_id) === String(teamId) && r.status === 'pending');
}

// GET /api/v1/join-requests/pending-count — agregado de todos los
// equipos del entrenador demo (owner_id: 1 en el seed de teams-mock.js).
export async function mockGetPendingRequestsCount() {
  const myTeamIds = __getAllMockTeams().filter((t) => __getMockTeamOwnerId(t.id) === 1).map((t) => t.id);
  const count = mockJoinRequests.filter((r) => myTeamIds.includes(Number(r.team_id)) && r.status === 'pending').length;
  return { count };
}

// POST /api/v1/join-requests/{id}/accept | /reject
export async function mockRespondJoinRequest(requestId, accept) {
  const request = findJoinRequestOrThrow(requestId);
  request.status = accept ? 'accepted' : 'rejected';
  return null;
}

export function __resetMockJoinRequests() {
  mockJoinRequests = [];
  nextJoinRequestId = 1;
}
```

Note: `member_count` in `mockSearchTeams`'s mapped result is hardcoded to `0` — the mock's `__getAllMockTeams()` doesn't expose per-team roster counts, and computing them accurately would mean threading `mockTeamUsers` through a new cross-mock getter for a cosmetic-only number in mock mode. Acceptable simplification (the real backend always returns the true count); don't add that plumbing unless a specific test needs it.

- [ ] **Step 3: Create `services/join-requests.js`**

```js
import api from './api.js';
import { USE_MOCKS } from '../config/env.js';
import {
  mockSearchTeams,
  mockCreateJoinRequest,
  mockCancelJoinRequest,
  mockListMyJoinRequests,
  mockListTeamJoinRequests,
  mockGetPendingRequestsCount,
  mockRespondJoinRequest,
} from './__mocks__/join-requests-mock.js';

// GET /api/v1/teams/search?name=&level=&country=&province=&city=&page=
// — todos los filtros opcionales, page 1-indexado (default 1 si no se
// pasa). Respuesta real: { teams: TeamSearchResult[], has_more: bool },
// page size fijo en 20 del lado del backend, sin total.
export async function searchTeams(filters = {}, page = 1) {
  if (USE_MOCKS) return await mockSearchTeams(filters, page);
  const params = new URLSearchParams();
  if (filters.name) params.set('name', filters.name);
  if (filters.level) params.set('level', filters.level);
  if (filters.country) params.set('country', filters.country);
  if (filters.province) params.set('province', filters.province);
  if (filters.city) params.set('city', filters.city);
  params.set('page', String(page));
  return await api.get(`/teams/search?${params.toString()}`);
}

// POST /api/v1/teams/{id}/join-requests — sin body, crea solicitud pending.
export async function createJoinRequest(teamId) {
  if (USE_MOCKS) return await mockCreateJoinRequest(teamId);
  return await api.post(`/teams/${teamId}/join-requests`, {});
}

// DELETE /api/v1/join-requests/{id} — cancela mientras siga pending.
export async function cancelJoinRequest(requestId) {
  if (USE_MOCKS) return await mockCancelJoinRequest(requestId);
  return await api.delete(`/join-requests/${requestId}`);
}

// GET /api/v1/join-requests/mine — todas las del corredor actual, cualquier estado.
export async function listMyJoinRequests() {
  if (USE_MOCKS) return await mockListMyJoinRequests();
  return await api.get('/join-requests/mine');
}

// GET /api/v1/teams/{id}/join-requests — pending del equipo (lado entrenador dueño).
export async function listTeamJoinRequests(teamId) {
  if (USE_MOCKS) return await mockListTeamJoinRequests(teamId);
  return await api.get(`/teams/${teamId}/join-requests`);
}

// GET /api/v1/join-requests/pending-count — agregado de todos los
// equipos del entrenador, para el badge.
export async function getPendingRequestsCount() {
  if (USE_MOCKS) return await mockGetPendingRequestsCount();
  return await api.get('/join-requests/pending-count');
}

// POST /api/v1/join-requests/{id}/accept | /reject — sin body.
export async function respondJoinRequest(requestId, accept) {
  const path = accept ? 'accept' : 'reject';
  if (USE_MOCKS) return await mockRespondJoinRequest(requestId, accept);
  return await api.post(`/join-requests/${requestId}/${path}`, {});
}
```

- [ ] **Step 4: Run tests and lint**

Run: `npm test` and `npm run lint`
Expected: both green.

- [ ] **Step 5: Commit**

```bash
git add services/join-requests.js services/__mocks__/join-requests-mock.js services/__mocks__/teams-mock.js
git commit -m "feat(teams): add join-requests service + mock, search helper on teams-mock"
```

---

### Task 3: `hooks/use-team-search.js`

**Files:**
- Create: `hooks/use-team-search.js`

**Interfaces:**
- Consumes: `searchTeams` (Task 2), `toTeamSearchResultModel` (Task 1).
- Produces: `useTeamSearch()` returning `{ results, hasMore, loading, error, search(filters), loadMore() }` — consumed by Task 8 (`team-search-screen.jsx`).

- [ ] **Step 1: Create the hook**

```js
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { searchTeams } from '../services/join-requests.js';
import { toTeamSearchResultModel } from '../services/normalizers.js';

// Búsqueda paginada de equipos — primer caso de paginación del repo (ver
// docs/superpowers/specs/2026-09-03-team-search-join-requests-design.md,
// "Estado del servidor"). Sin useInfiniteQuery: "Cargar más" es una
// acción explícita del usuario que solo avanza en una dirección, así que
// alcanza con una queryKey por (filters, page) y concatenar resultados a
// mano en este hook — mismo criterio ya escrito en la spec.
export function useTeamSearch() {
  const [filters, setFilters] = useState(null);
  const [page, setPage] = useState(1);
  const [accumulated, setAccumulated] = useState({ pageKey: null, items: [] });

  const query = useQuery({
    queryKey: ['team-search', filters, page],
    queryFn: () => searchTeams(filters, page),
    enabled: Boolean(filters),
  });

  // Cuando llega una página nueva, se acumula (page > 1) o reemplaza
  // (page === 1, nueva búsqueda) — hecho acá en vez de en un useEffect
  // para no depender de un efecto separado corriendo después del render
  // que ya mostró los datos viejos.
  const dtos = query.data?.teams ?? [];
  const currentPageKey = `${JSON.stringify(filters)}:${page}`;
  if (query.isSuccess && accumulated.pageKey !== currentPageKey) {
    const mapped = dtos.map(toTeamSearchResultModel);
    setAccumulated({
      pageKey: currentPageKey,
      items: page === 1 ? mapped : [...(accumulated.items ?? []), ...mapped],
    });
  }

  const search = (newFilters) => {
    setFilters(newFilters);
    setPage(1);
    setAccumulated({ pageKey: null, items: [] });
  };

  const loadMore = () => setPage((p) => p + 1);

  return {
    results: accumulated.items ?? [],
    hasMore: query.data?.has_more ?? false,
    loading: query.isLoading,
    error: query.error,
    search,
    loadMore,
  };
}
```

Note: `setAccumulated` above is called during render (not inside an event handler or effect) to synchronously fold in the new page as soon as `query.data` changes — this is React's documented "adjusting state during render" pattern (comparing a derived key against state and calling the setter conditionally, same render). It's intentional, not a bug — do not move it into a `useEffect`, which would show a stale/empty list for one extra render on every page load.

- [ ] **Step 2: Run tests and lint**

Run: `npm test` and `npm run lint`
Expected: both green (no existing test touches this new file).

- [ ] **Step 3: Commit**

```bash
git add hooks/use-team-search.js
git commit -m "feat(teams): add useTeamSearch hook with client-side pagination"
```

---

### Task 4: `hooks/use-join-requests.js`

**Files:**
- Create: `hooks/use-join-requests.js`

**Interfaces:**
- Consumes: all 6 functions from `services/join-requests.js` (Task 2), `toJoinRequestModel` (Task 1).
- Produces: `useMyJoinRequests()`, `useTeamJoinRequests(teamId)`, `usePendingRequestsCount(enabled)`, `useTeamsJoinRequestsMap(teamIds)`, `useJoinRequestMutations()` — consumed by Tasks 6 (notifications), 7 (shells badge), 9 (teams-list dot), 11 (team-requests-tab).

- [ ] **Step 1: Create the hook file**

```js
import { useQueries, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  listMyJoinRequests,
  listTeamJoinRequests,
  getPendingRequestsCount,
  createJoinRequest,
  cancelJoinRequest,
  respondJoinRequest,
} from '../services/join-requests.js';
import { toJoinRequestModel } from '../services/normalizers.js';

// Estado de servidor del dominio de solicitudes de ingreso — TanStack
// Query, no Zustand (ver CLAUDE.md), mismo criterio que
// hooks/use-team-roster.js y hooks/use-tier-subscription.js.

// Solicitudes propias del corredor actual (cualquier estado).
export function useMyJoinRequests(enabled = true) {
  const query = useQuery({
    queryKey: ['join-requests-mine'],
    queryFn: () => listMyJoinRequests().then((dtos) => dtos.map(toJoinRequestModel)),
    enabled,
  });
  return { requests: query.data ?? [], loading: query.isLoading, error: query.error };
}

// Solicitudes pending de UN equipo puntual — usado tanto por la tab
// "Solicitudes" del entrenador dueño (team-requests-tab.jsx) como,
// indirectamente, por useTeamsJoinRequestsMap más abajo (misma queryKey,
// mismo cache).
export function useTeamJoinRequests(teamId) {
  const query = useQuery({
    queryKey: ['join-requests-team', teamId],
    queryFn: () => listTeamJoinRequests(teamId).then((dtos) => dtos.map(toJoinRequestModel)),
    enabled: Boolean(teamId),
  });
  return { requests: query.data ?? [], loading: query.isLoading, error: query.error };
}

// Conteo agregado (todos los equipos del entrenador) — para el badge de
// la campana/drawer. `enabled` lo controla el caller: solo tiene sentido
// pedirlo cuando activeRole === 'trainer'.
export function usePendingRequestsCount(enabled = true) {
  const query = useQuery({
    queryKey: ['join-requests-pending-count'],
    queryFn: () => getPendingRequestsCount().then((dto) => dto.count),
    enabled,
  });
  return query.data ?? 0;
}

// Mapa teamId → solicitudes pending, para el "dot de novedad" en
// teams-list-screen.jsx (un dot por equipo administrado con solicitudes
// sin resolver) — N requests (uno por equipo administrado), mismo
// patrón ya usado en hooks/use-team-roster.js para group-users. Comparte
// queryKey con useTeamJoinRequests, así que abrir la tab Solicitudes de
// un equipo después de ver su dot no vuelve a pedir el mismo dato.
export function useTeamsJoinRequestsMap(teamIds = []) {
  const queries = useQueries({
    queries: teamIds.map((teamId) => ({
      queryKey: ['join-requests-team', teamId],
      queryFn: () => listTeamJoinRequests(teamId).then((dtos) => dtos.map(toJoinRequestModel)),
      enabled: Boolean(teamId),
    })),
  });
  const byTeamId = new Map();
  queries.forEach((q, index) => byTeamId.set(teamIds[index], q.data ?? []));
  const loading = queries.some((q) => q.isLoading);
  return { byTeamId, loading };
}

// Las 4 mutaciones del dominio — todas invalidan el mismo set de queries
// (propias, del equipo, el conteo agregado, y la búsqueda — crear/cancelar
// una solicitud cambia el estado "Solicitud enviada" que ve el botón de
// búsqueda para ese equipo).
export function useJoinRequestMutations() {
  const queryClient = useQueryClient();

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: ['join-requests-mine'] });
    queryClient.invalidateQueries({ queryKey: ['join-requests-team'] });
    queryClient.invalidateQueries({ queryKey: ['join-requests-pending-count'] });
    queryClient.invalidateQueries({ queryKey: ['team-search'] });
  };

  const create = useMutation({ mutationFn: (teamId) => createJoinRequest(teamId), onSuccess: invalidateAll });
  const cancel = useMutation({ mutationFn: (requestId) => cancelJoinRequest(requestId), onSuccess: invalidateAll });
  const accept = useMutation({ mutationFn: (requestId) => respondJoinRequest(requestId, true), onSuccess: invalidateAll });
  const reject = useMutation({ mutationFn: (requestId) => respondJoinRequest(requestId, false), onSuccess: invalidateAll });

  return {
    createJoinRequest: create.mutateAsync,
    isCreating: create.isPending,
    cancelJoinRequest: cancel.mutateAsync,
    isCancelling: cancel.isPending,
    acceptJoinRequest: accept.mutateAsync,
    isAccepting: accept.isPending,
    rejectJoinRequest: reject.mutateAsync,
    isRejecting: reject.isPending,
  };
}
```

- [ ] **Step 2: Run tests and lint**

Run: `npm test` and `npm run lint`
Expected: both green.

- [ ] **Step 3: Commit**

```bash
git add hooks/use-join-requests.js
git commit -m "feat(teams): add useJoinRequests query/mutation hooks"
```

---

### Task 5: `routes/catalog.js` — replace `invitationsRoute` with `notificationsRoute`

**Files:**
- Modify: `routes/catalog.js` (full file, small)

**Interfaces:**
- Produces: `notificationsRoute` object `{ name: 'notifications', label: 'Notificaciones', href: '/notifications', icon: 'bell-outline' }`, exported in `navigationRoutes`. Consumed by Task 7 (shells).

- [ ] **Step 1: Replace the route definition**

Find:

```js
export const invitationsRoute = {
  name: 'invitations',
  label: 'Invitaciones',
  href: '/invitations',
  icon: 'email-outline',
};
```

Replace with:

```js
export const notificationsRoute = {
  name: 'notifications',
  label: 'Notificaciones',
  href: '/notifications',
  icon: 'bell-outline',
};
```

- [ ] **Step 2: Update the array reference**

Find:

```js
export const navigationRoutes = [homeRoute, teamsRoute, invitationsRoute, myPlansRoute, trainingPlansRoute];
```

Replace with:

```js
export const navigationRoutes = [homeRoute, teamsRoute, notificationsRoute, myPlansRoute, trainingPlansRoute];
```

(`getRoutesByRole` below it is unchanged — it only filters by `route.role`, doesn't reference route names.)

- [ ] **Step 3: Run tests and lint**

Run: `npm test` and `npm run lint`
Expected: lint passes on this file alone; the 3 shells will fail to reference the old route until Task 7 lands — that's expected and fixed in the very next task. If `npm test` has any test importing `invitationsRoute` by name, update it to `notificationsRoute` here (check with `grep -rn "invitationsRoute" __tests__/` first — if nothing matches, no test changes needed).

- [ ] **Step 4: Commit**

```bash
git add routes/catalog.js
git commit -m "feat(teams): replace invitationsRoute with notificationsRoute in catalog"
```

---

### Task 6: `notifications-screen.jsx` (replaces `received-invitations-screen.jsx`)

**Files:**
- Create: `components/notifications/notifications-screen.jsx`
- Create: `app/(tabs)/notifications.jsx`
- Delete: `components/invitations/received-invitations-screen.jsx`
- Delete: `app/(tabs)/invitations/index.jsx`

**Interfaces:**
- Consumes: `useTeamStore` (`myInvitations`, `fetchMyInvitations`, `acceptMyInvitation`, `rejectMyInvitation` — unchanged, from the old screen), `useMyJoinRequests`, `useJoinRequestMutations` (Task 4), `usePendingRequestsCount`/`useTeamsJoinRequestsMap` NOT needed here (entrenador section below uses a different data need — see Step 1's `TrainerPendingRequestsSection`).
- Produces: `NotificationsScreen()` default export used by the route file. No other task consumes this directly (it's a leaf screen), but Task 7 links to `/notifications`.

- [ ] **Step 1: Create `components/notifications/notifications-screen.jsx`**

This absorbs the ENTIRE content of the old `received-invitations-screen.jsx` (the `ReceivedInvitationRow` component and its accept/reject logic, byte-for-byte, just renamed/relocated) plus 2 new sections gated by `activeRole`.

```jsx
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import Toast from 'react-native-toast-message';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useThemeColors } from '../../theme/colors.js';
import { isWeb } from '../../utils/platform.js';
import { useAuthStore } from '../../store/auth-store.js';
import { useTeamStore, selectAdministeredTeams } from '../../store/team-store.js';
import { useMyJoinRequests, useJoinRequestMutations, useTeamsJoinRequestsMap } from '../../hooks/use-join-requests.js';
import { formatRelativeTime } from '../../utils/relative-time.js';
import { SectionCard } from '../forms/section-card.jsx';
import { RequireAuth } from '../guards/require-auth.jsx';

// Sin nombre de grupo: InvitationResponse trae group_id pero no
// group_name — mismo criterio ya documentado en el
// received-invitations-screen.jsx original (ver docs/BACKEND_API_GAPS.md
// gap 9). Este componente es ese mismo row, relocado acá sin cambios.
function ReceivedInvitationRow({ invite, onAccept, onReject, responding }) {
  const colors = useThemeColors();
  const slug = invite.id;

  return (
    <View
      className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-700 dark:bg-slate-900"
      nativeID={`received-invitation-${slug}`}
      testID={`received-invitation-${slug}`}
    >
      <Text className="text-sm font-semibold text-slate-900 dark:text-white" nativeID={`received-invitation-${slug}-team`} testID={`received-invitation-${slug}-team`}>
        {invite.teamName ?? 'Equipo'}
      </Text>
      <Text className="mb-2 text-xs text-slate-500 dark:text-slate-400" nativeID={`received-invitation-${slug}-meta`} testID={`received-invitation-${slug}-meta`}>
        {invite.inviterName ? `Invitado por ${invite.inviterName} · ` : 'Invitado '}
        {formatRelativeTime(invite.createdAt).toLowerCase()}
      </Text>
      <View className="flex-row gap-2" nativeID={`received-invitation-${slug}-actions`} testID={`received-invitation-${slug}-actions`}>
        <Pressable
          className="h-9 flex-1 flex-row items-center justify-center gap-1.5 rounded-full bg-primary hover:opacity-90 active:opacity-80 disabled:opacity-60"
          disabled={responding}
          nativeID={`received-invitation-${slug}-accept-button`}
          onPress={onAccept}
          testID={`received-invitation-${slug}-accept-button`}
        >
          <MaterialCommunityIcons color={colors.onPrimary} name="check" size={16} />
          <Text className="text-xs font-semibold uppercase tracking-wide text-[#111518]" nativeID={`received-invitation-${slug}-accept-button-label`} testID={`received-invitation-${slug}-accept-button-label`}>
            Aceptar
          </Text>
        </Pressable>
        <Pressable
          className="h-9 flex-1 flex-row items-center justify-center gap-1.5 rounded-full border border-slate-200 hover:bg-slate-100 active:opacity-80 disabled:opacity-60 dark:border-slate-700 dark:hover:bg-slate-800"
          disabled={responding}
          nativeID={`received-invitation-${slug}-reject-button`}
          onPress={onReject}
          testID={`received-invitation-${slug}-reject-button`}
        >
          <MaterialCommunityIcons color={colors.onSurfaceVariant} name="close" size={16} />
          <Text className="text-xs font-semibold uppercase tracking-wide text-slate-700 dark:text-slate-200" nativeID={`received-invitation-${slug}-reject-button-label`} testID={`received-invitation-${slug}-reject-button-label`}>
            Rechazar
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

// Fila de "mis solicitudes enviadas" (corredor) — sin accept/reject (eso
// lo resuelve el entrenador), solo estado + cancelar si sigue pending.
function SentJoinRequestRow({ request, onCancel, cancelling }) {
  const colors = useThemeColors();
  const STATUS_LABEL = { pending: 'Pendiente', accepted: 'Aceptada', rejected: 'Rechazada' };

  return (
    <View
      className="flex-row items-center justify-between gap-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-700 dark:bg-slate-900"
      nativeID={`sent-join-request-${request.id}`}
      testID={`sent-join-request-${request.id}`}
    >
      <View className="flex-1" nativeID={`sent-join-request-${request.id}-info`} testID={`sent-join-request-${request.id}-info`}>
        <Text className="text-sm font-semibold text-slate-900 dark:text-white" nativeID={`sent-join-request-${request.id}-team`} testID={`sent-join-request-${request.id}-team`}>
          {request.teamName ?? 'Equipo'}
        </Text>
        <Text className="text-xs text-slate-500 dark:text-slate-400" nativeID={`sent-join-request-${request.id}-status`} testID={`sent-join-request-${request.id}-status`}>
          {STATUS_LABEL[request.status] ?? request.status} · {formatRelativeTime(request.createdAt).toLowerCase()}
        </Text>
      </View>
      {request.status === 'pending' && (
        <Pressable
          className="h-9 flex-row items-center justify-center rounded-full border border-slate-200 px-3 hover:bg-slate-100 active:opacity-80 disabled:opacity-60 dark:border-slate-700 dark:hover:bg-slate-800"
          disabled={cancelling}
          nativeID={`sent-join-request-${request.id}-cancel-button`}
          onPress={onCancel}
          testID={`sent-join-request-${request.id}-cancel-button`}
        >
          {cancelling ? <ActivityIndicator color={colors.onSurfaceVariant} size="small" /> : (
            <Text className="text-xs font-semibold text-slate-700 dark:text-slate-200" nativeID={`sent-join-request-${request.id}-cancel-label`} testID={`sent-join-request-${request.id}-cancel-label`}>
              Cancelar
            </Text>
          )}
        </Pressable>
      )}
    </View>
  );
}

// Sección "Mis solicitudes enviadas" — solo corredor.
function MyJoinRequestsSection() {
  const { requests, loading } = useMyJoinRequests();
  const { cancelJoinRequest, isCancelling } = useJoinRequestMutations();
  const [cancellingId, setCancellingId] = useState(null);

  const handleCancel = async (requestId) => {
    setCancellingId(requestId);
    try {
      await cancelJoinRequest(requestId);
      Toast.show({ type: 'success', text1: 'Solicitud cancelada' });
    } catch (error) {
      Toast.show({ type: 'error', text1: 'No pudimos cancelar la solicitud', text2: error.message });
    }
    setCancellingId(null);
  };

  return (
    <SectionCard icon="account-clock-outline" title="Mis solicitudes enviadas">
      {loading ? (
        <View className="items-center py-6" nativeID="my-join-requests-loading" testID="my-join-requests-loading">
          <ActivityIndicator />
        </View>
      ) : requests.length === 0 ? (
        <Text className="py-2 text-sm text-slate-500 dark:text-slate-400" nativeID="my-join-requests-empty" testID="my-join-requests-empty">
          No enviaste solicitudes para unirte a ningún equipo.
        </Text>
      ) : (
        <View className="gap-2" nativeID="my-join-requests-list" testID="my-join-requests-list">
          {requests.map((request) => (
            <SentJoinRequestRow
              cancelling={isCancelling && cancellingId === request.id}
              key={request.id}
              onCancel={() => handleCancel(request.id)}
              request={request}
            />
          ))}
        </View>
      )}
    </SectionCard>
  );
}

// Sección "Solicitudes pendientes" (agregado de equipos administrados) —
// solo entrenador. Cada ítem linkea a la tab Solicitudes del equipo
// correspondiente (?tab=solicitudes, ver Task 11).
function TrainerPendingRequestsSection() {
  const router = useRouter();
  const colors = useThemeColors();
  const user = useAuthStore((s) => s.user);
  const teams = useTeamStore((s) => s.teams);
  const administeredTeamIds = selectAdministeredTeams(teams, user?.userId).map((t) => t.id);
  const { byTeamId, loading } = useTeamsJoinRequestsMap(administeredTeamIds);

  const allPending = administeredTeamIds.flatMap((teamId) => byTeamId.get(teamId) ?? []);

  return (
    <SectionCard icon="account-question-outline" title="Solicitudes pendientes">
      {loading ? (
        <View className="items-center py-6" nativeID="trainer-pending-requests-loading" testID="trainer-pending-requests-loading">
          <ActivityIndicator />
        </View>
      ) : allPending.length === 0 ? (
        <Text className="py-2 text-sm text-slate-500 dark:text-slate-400" nativeID="trainer-pending-requests-empty" testID="trainer-pending-requests-empty">
          No tenés solicitudes de ingreso pendientes.
        </Text>
      ) : (
        <View className="gap-2" nativeID="trainer-pending-requests-list" testID="trainer-pending-requests-list">
          {allPending.map((request) => (
            <Pressable
              className="flex-row items-center justify-between gap-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 hover:bg-slate-100 active:opacity-80 dark:border-slate-700 dark:bg-slate-900 dark:hover:bg-slate-800"
              key={request.id}
              nativeID={`trainer-pending-request-${request.id}`}
              onPress={() => router.push(`/teams/${request.teamId}?tab=solicitudes`)}
              testID={`trainer-pending-request-${request.id}`}
            >
              <View className="flex-1" nativeID={`trainer-pending-request-${request.id}-info`} testID={`trainer-pending-request-${request.id}-info`}>
                <Text className="text-sm font-semibold text-slate-900 dark:text-white" nativeID={`trainer-pending-request-${request.id}-runner`} testID={`trainer-pending-request-${request.id}-runner`}>
                  {request.runnerName ?? 'Corredor'}
                </Text>
                <Text className="text-xs text-slate-500 dark:text-slate-400" nativeID={`trainer-pending-request-${request.id}-team`} testID={`trainer-pending-request-${request.id}-team`}>
                  Quiere unirse a {request.teamName ?? 'tu equipo'}
                </Text>
              </View>
              <MaterialCommunityIcons color={colors.onSurfaceVariant} name="chevron-right" size={18} />
            </Pressable>
          ))}
        </View>
      )}
    </SectionCard>
  );
}

function NotificationsScreenContent() {
  const router = useRouter();
  const colors = useThemeColors();
  const user = useAuthStore((s) => s.user);
  const activeRole = useAuthStore((s) => s.activeRole);
  const myInvitations = useTeamStore((s) => s.myInvitations);
  const fetchMyInvitations = useTeamStore((s) => s.fetchMyInvitations);
  const acceptMyInvitation = useTeamStore((s) => s.acceptMyInvitation);
  const rejectMyInvitation = useTeamStore((s) => s.rejectMyInvitation);

  const [loadingInvitations, setLoadingInvitations] = useState(true);
  const [respondingId, setRespondingId] = useState(null);

  useEffect(() => {
    if (!user?.userId) return undefined;
    let cancelled = false;
    setLoadingInvitations(true);
    fetchMyInvitations(user.userId, user.email).finally(() => { if (!cancelled) setLoadingInvitations(false); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.userId, user?.email]);

  const handleAccept = async (invitationId) => {
    setRespondingId(invitationId);
    const result = await acceptMyInvitation(invitationId, user.userId);
    setRespondingId(null);
    if (!result.success) {
      Toast.show({ type: 'error', text1: 'No pudimos aceptar la invitación', text2: result.error });
      return;
    }
    Toast.show({ type: 'success', text1: 'Te uniste al equipo' });
  };

  const handleReject = async (invitationId) => {
    setRespondingId(invitationId);
    const result = await rejectMyInvitation(invitationId, user.userId);
    setRespondingId(null);
    if (!result.success) {
      Toast.show({ type: 'error', text1: 'No pudimos rechazar la invitación', text2: result.error });
      return;
    }
    Toast.show({ type: 'success', text1: 'Invitación rechazada' });
  };

  return (
    <ScrollView
      className="flex-1 bg-paper dark:bg-ink"
      contentContainerClassName="px-4 py-8"
      nativeID="notifications-screen-scroll"
      showsVerticalScrollIndicator={false}
      testID="notifications-screen-scroll"
    >
      <View className={`w-full self-center ${isWeb ? 'max-w-3xl' : ''}`} nativeID="notifications-screen-container" testID="notifications-screen-container">
        <View className="mb-8 flex-row items-center gap-2" nativeID="notifications-screen-header" testID="notifications-screen-header">
          <Pressable
            className="flex-row items-center gap-1.5 py-1 pr-1 hover:opacity-70 active:opacity-70"
            nativeID="notifications-screen-back-button"
            onPress={() => router.back()}
            testID="notifications-screen-back-button"
          >
            <MaterialCommunityIcons color={colors.onSurfaceVariant} name="arrow-left" size={18} />
          </Pressable>
          <Text className="text-xl text-slate-900 dark:text-white" nativeID="notifications-screen-title" style={{ fontFamily: 'Orbitron_700Bold' }} testID="notifications-screen-title">
            Notificaciones
          </Text>
        </View>

        <SectionCard icon="email-outline" title="Invitaciones recibidas">
          {loadingInvitations ? (
            <View className="items-center py-6" nativeID="received-invitations-loading" testID="received-invitations-loading">
              <ActivityIndicator color={colors.primary} />
            </View>
          ) : myInvitations.length === 0 ? (
            <Text className="py-2 text-sm text-slate-500 dark:text-slate-400" nativeID="received-invitations-empty" testID="received-invitations-empty">
              No tenés invitaciones pendientes.
            </Text>
          ) : (
            <View className="gap-2" nativeID="received-invitations-list" testID="received-invitations-list">
              {myInvitations.map((invite) => (
                <ReceivedInvitationRow
                  invite={invite}
                  key={invite.id}
                  onAccept={() => handleAccept(invite.id)}
                  onReject={() => handleReject(invite.id)}
                  responding={respondingId === invite.id}
                />
              ))}
            </View>
          )}
        </SectionCard>

        {activeRole === 'runner' && <MyJoinRequestsSection />}
        {activeRole === 'trainer' && <TrainerPendingRequestsSection />}
      </View>
    </ScrollView>
  );
}

export function NotificationsScreen() {
  return (
    <RequireAuth>
      <NotificationsScreenContent />
    </RequireAuth>
  );
}
```

- [ ] **Step 2: Create the route file `app/(tabs)/notifications.jsx`**

```jsx
import { NotificationsScreen } from '../../components/notifications/notifications-screen.jsx';

export default function Notifications() {
  return <NotificationsScreen />;
}
```

- [ ] **Step 3: Delete the old screen and route**

```bash
git rm components/invitations/received-invitations-screen.jsx
git rm -r "app/(tabs)/invitations"
```

(If `components/invitations/` is now empty after this removal, leave the empty directory — git doesn't track empty directories, so this is a no-op either way. Do not delete any other file under `components/invitations/` — check `ls components/invitations/` first; if other files exist there, only remove `received-invitations-screen.jsx`.)

- [ ] **Step 4: Run tests and lint**

Run: `npm test` and `npm run lint`
Expected: both green. If any test file imports `ReceivedInvitationsScreen` or references the deleted route, update/remove that test — check with `grep -rln "received-invitations-screen\|ReceivedInvitationsScreen" __tests__/` first.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(teams): replace received-invitations screen with notifications screen"
```

---

### Task 7: Shell updates — 3 files, same-shape edit (batch)

**Files:**
- Modify: `components/shell/app-web-shell.jsx`
- Modify: `components/shell/app-web-shell-narrow.jsx`
- Modify: `components/shell/app-mobile-shell.jsx`

**Interfaces:**
- Consumes: `notificationsRoute` (Task 5, via `getRoutesByRole`), `usePendingRequestsCount` (Task 4).
- Produces: nothing new consumed by later tasks — this is a leaf UI change.

This is one dispatch covering all 3 files — they need the identical conceptual change (rename `'invitations'` → `'notifications'` in the badge condition, and source the badge count from the role-appropriate query instead of always `myInvitations.length`), even though the exact surrounding code differs slightly (`app-web-shell.jsx` uses a TopBar-icon badge, the other two use a drawer-row badge).

- [ ] **Step 1: `app-web-shell.jsx` — badge source and route name**

Find (inside the `AppWebShell` component body, alongside the existing `fetchMyInvitations` wiring):

```jsx
const myInvitationsCount = useTeamStore((s) => s.myInvitations.length);
```

Replace with (add the new import at the top of the file first — `import { usePendingRequestsCount } from '../../hooks/use-join-requests.js';` alongside the existing imports — then add this line right after the existing `myInvitationsCount` line, don't remove `myInvitationsCount`, both are still needed):

```jsx
const myInvitationsCount = useTeamStore((s) => s.myInvitations.length);
const pendingRequestsCount = usePendingRequestsCount(activeRole === 'trainer');
const notificationsBadgeCount = activeRole === 'trainer' ? pendingRequestsCount : myInvitationsCount;
```

Then find the badge condition inside `TopBar`:

```jsx
{route.name === 'invitations' && myInvitationsCount > 0 && (
  <View className="absolute -right-1 -top-1 h-2 w-2 rounded-full bg-red-500" nativeID="web-shell-nav-tab-invitations-badge" testID="web-shell-nav-tab-invitations-badge" />
)}
```

Replace with:

```jsx
{route.name === 'notifications' && notificationsBadgeCount > 0 && (
  <View className="absolute -right-1 -top-1 h-2 w-2 rounded-full bg-red-500" nativeID="web-shell-nav-tab-notifications-badge" testID="web-shell-nav-tab-notifications-badge" />
)}
```

`TopBar`'s prop signature needs `notificationsBadgeCount` threaded through in place of `myInvitationsCount` — find:

```jsx
function TopBar({ isGuest, userName, userPhotoUrl, userInitials, activeRole, dropdownOpen, routesTab, activeTab, teamsMenuOpen, myInvitationsCount, onTabPress, onUserPress, onTeamsPress }) {
```

Replace with:

```jsx
function TopBar({ isGuest, userName, userPhotoUrl, userInitials, activeRole, dropdownOpen, routesTab, activeTab, teamsMenuOpen, notificationsBadgeCount, onTabPress, onUserPress, onTeamsPress }) {
```

And find wherever `<TopBar ... myInvitationsCount={myInvitationsCount} ... />` is called (the JSX invocation inside `AppWebShell`'s return) and change that one prop to `notificationsBadgeCount={notificationsBadgeCount}`.

- [ ] **Step 2: `app-web-shell-narrow.jsx` — badge source and row condition**

Add the import: `import { usePendingRequestsCount } from '../../hooks/use-join-requests.js';`

Find:

```jsx
const fetchMyInvitations = useTeamStore((s) => s.fetchMyInvitations); const myInvitationsCount = useTeamStore((s) => s.myInvitations.length);
```

Replace with:

```jsx
const fetchMyInvitations = useTeamStore((s) => s.fetchMyInvitations); const myInvitationsCount = useTeamStore((s) => s.myInvitations.length);
const pendingRequestsCount = usePendingRequestsCount(activeRole === 'trainer');
const notificationsBadgeCount = activeRole === 'trainer' ? pendingRequestsCount : myInvitationsCount;
```

(`activeRole` must already be in scope in this component — confirm it's already destructured from `useAuthStore` nearby; if not already present, add `const activeRole = useAuthStore((s) => s.activeRole);` alongside the other `useAuthStore` selectors in this file.)

Find:

```jsx
{route.name === 'invitations' && myInvitationsCount > 0 && (
  <View className="absolute -right-1 -top-1 h-2 w-2 rounded-full bg-red-500" nativeID="web-narrow-drawer-route-invitations-badge" testID="web-narrow-drawer-route-invitations-badge" />
)}
```

Replace with:

```jsx
{route.name === 'notifications' && notificationsBadgeCount > 0 && (
  <View className="absolute -right-1 -top-1 h-2 w-2 rounded-full bg-red-500" nativeID="web-narrow-drawer-route-notifications-badge" testID="web-narrow-drawer-route-notifications-badge" />
)}
```

- [ ] **Step 3: `app-mobile-shell.jsx` — identical to Step 2, different nativeID prefix**

Same import addition, same `pendingRequestsCount`/`notificationsBadgeCount` derivation (confirm `activeRole` is in scope, same as Step 2).

Find:

```jsx
{route.name === 'invitations' && myInvitationsCount > 0 && (
  <View className="absolute -right-1 -top-1 h-2 w-2 rounded-full bg-red-500" nativeID="mobile-drawer-route-invitations-badge" testID="mobile-drawer-route-invitations-badge" />
)}
```

Replace with:

```jsx
{route.name === 'notifications' && notificationsBadgeCount > 0 && (
  <View className="absolute -right-1 -top-1 h-2 w-2 rounded-full bg-red-500" nativeID="mobile-drawer-route-notifications-badge" testID="mobile-drawer-route-notifications-badge" />
)}
```

- [ ] **Step 4: Run tests and lint**

Run: `npm test` and `npm run lint`
Expected: both green.

- [ ] **Step 5: Commit**

```bash
git add components/shell/app-web-shell.jsx components/shell/app-web-shell-narrow.jsx components/shell/app-mobile-shell.jsx
git commit -m "feat(teams): shells show notifications badge (role-aware count)"
```

---

### Task 8: `team-search-screen.jsx` + route

**Files:**
- Create: `components/team/team-search-screen.jsx`
- Create: `app/(tabs)/teams/search.jsx`
- Modify: `components/team/team-general-info-fields.jsx` (export `LEVEL_OPTIONS`)

**Interfaces:**
- Consumes: `useTeamSearch` (Task 3), `useMyJoinRequests`/`useJoinRequestMutations` (Task 4), `useAddressCascade` (existing, `hooks/use-address-cascade.js`), `LEVEL_OPTIONS` (this task exports it), `AvatarPicker` (existing, read-only usage — omit `onPick`/`onRemove`).
- Produces: `TeamSearchScreen()` used by the route file. Nothing else consumes this directly.

- [ ] **Step 1: Export `LEVEL_OPTIONS` from `team-general-info-fields.jsx`**

Find:

```jsx
const LEVEL_OPTIONS = [
  { id: 'amateur', name: 'Amateur' },
  { id: 'semi-profesional', name: 'Semi-profesional' },
  { id: 'profesional', name: 'Profesional' },
];
```

Replace with:

```jsx
export const LEVEL_OPTIONS = [
  { id: 'amateur', name: 'Amateur' },
  { id: 'semi-profesional', name: 'Semi-profesional' },
  { id: 'profesional', name: 'Profesional' },
];
```

- [ ] **Step 2: Create `components/team/team-search-screen.jsx`**

```jsx
import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import Toast from 'react-native-toast-message';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useThemeColors } from '../../theme/colors.js';
import { isWeb } from '../../utils/platform.js';
import { useAddressCascade } from '../../hooks/use-address-cascade.js';
import { useTeamSearch } from '../../hooks/use-team-search.js';
import { useMyJoinRequests, useJoinRequestMutations } from '../../hooks/use-join-requests.js';
import { getCountryName, getProvinceName } from '../../data/locations.js';
import { SectionCard } from '../forms/section-card.jsx';
import { InputField, PickerField, SelectField, Row, Col } from '../forms/fields.jsx';
import { LEVEL_OPTIONS } from './team-general-info-fields.jsx';
import { AvatarPicker } from '../shared/avatar-picker.jsx';
import { RequireAuth } from '../guards/require-auth.jsx';

function buttonState(team, myPendingTeamIds) {
  if (myPendingTeamIds.has(team.id)) return { disabled: true, label: 'Solicitud enviada' };
  if (!team.isPublic) return { disabled: true, label: 'No acepta solicitudes' };
  if (team.memberCount >= team.maxMembers) return { disabled: true, label: 'Equipo completo' };
  return { disabled: false, label: 'Solicitar unirse' };
}

function TeamSearchResultCard({ team, onRequest, requesting }) {
  const colors = useThemeColors();
  const idPrefix = `team-search-result-${team.id}`;
  const locationLine = [team.city, team.province ? getProvinceName(team.country, team.province) : null, team.country ? getCountryName(team.country) : null].filter(Boolean).join(', ');

  return (
    <View className="flex-row items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3.5 dark:border-slate-700 dark:bg-slate-900" nativeID={idPrefix} testID={idPrefix}>
      <AvatarPicker fallbackIcon="account-group" idPrefix={`${idPrefix}-avatar`} size={44} uri={team.iconUrl} />
      <View className="flex-1" nativeID={`${idPrefix}-info`} testID={`${idPrefix}-info`}>
        <Text className="text-sm font-semibold text-slate-900 dark:text-white" nativeID={`${idPrefix}-name`} testID={`${idPrefix}-name`}>
          {team.name}
        </Text>
        <Text className="text-xs text-slate-500 dark:text-slate-400" nativeID={`${idPrefix}-meta`} testID={`${idPrefix}-meta`}>
          {LEVEL_OPTIONS.find((l) => l.id === team.level)?.name ?? team.level ?? '—'} · {locationLine || '—'} · {team.memberCount}/{team.maxMembers}
        </Text>
        {team.ownerName && (
          <Text className="text-xs text-slate-500 dark:text-slate-400" nativeID={`${idPrefix}-owner`} testID={`${idPrefix}-owner`}>
            Entrenador: {team.ownerName}
          </Text>
        )}
      </View>
      {(() => {
        const state = buttonState(team, onRequest.myPendingTeamIds);
        return (
          <Pressable
            className={`h-10 flex-row items-center justify-center rounded-full px-4 ${state.disabled ? 'bg-slate-200 dark:bg-slate-700' : 'bg-primary hover:opacity-90 active:opacity-80'}`}
            disabled={state.disabled || requesting}
            nativeID={`${idPrefix}-request-button`}
            onPress={() => onRequest.handle(team.id)}
            testID={`${idPrefix}-request-button`}
          >
            {requesting ? <ActivityIndicator color={colors.onPrimary} size="small" /> : (
              <Text className={`text-xs font-semibold uppercase tracking-wide ${state.disabled ? 'text-slate-500 dark:text-slate-400' : 'text-[#111518]'}`} nativeID={`${idPrefix}-request-button-label`} testID={`${idPrefix}-request-button-label`}>
                {state.label}
              </Text>
            )}
          </Pressable>
        );
      })()}
    </View>
  );
}

function TeamSearchScreenContent() {
  const router = useRouter();
  const colors = useThemeColors();
  const address = useAddressCascade();
  const [name, setName] = useState('');
  const [level, setLevel] = useState('');
  const { results, hasMore, loading, search, loadMore } = useTeamSearch();
  const { requests: myRequests } = useMyJoinRequests();
  const { createJoinRequest, isCreating } = useJoinRequestMutations();
  const [requestingTeamId, setRequestingTeamId] = useState(null);
  const [searched, setSearched] = useState(false);

  const myPendingTeamIds = new Set(myRequests.filter((r) => r.status === 'pending').map((r) => r.teamId));

  const handleSearch = () => {
    setSearched(true);
    search({ name: name.trim() || undefined, level: level || undefined, country: address.country || undefined, province: address.province || undefined, city: address.city || undefined });
  };

  const handleRequest = async (teamId) => {
    setRequestingTeamId(teamId);
    try {
      await createJoinRequest(teamId);
      Toast.show({ type: 'success', text1: 'Solicitud enviada' });
    } catch (error) {
      Toast.show({ type: 'error', text1: 'No pudimos enviar la solicitud', text2: error.message });
    }
    setRequestingTeamId(null);
  };

  return (
    <ScrollView className="flex-1 bg-paper dark:bg-ink" contentContainerClassName="px-4 py-8" nativeID="team-search-screen-scroll" showsVerticalScrollIndicator={false} testID="team-search-screen-scroll">
      <View className={`w-full self-center ${isWeb ? 'max-w-3xl' : ''}`} nativeID="team-search-screen-container" testID="team-search-screen-container">
        <View className="mb-8 flex-row items-center gap-2" nativeID="team-search-screen-header" testID="team-search-screen-header">
          <Pressable className="flex-row items-center gap-1.5 py-1 pr-1 hover:opacity-70 active:opacity-70" nativeID="team-search-screen-back-button" onPress={() => router.back()} testID="team-search-screen-back-button">
            <MaterialCommunityIcons color={colors.onSurfaceVariant} name="arrow-left" size={18} />
          </Pressable>
          <Text className="text-xl text-slate-900 dark:text-white" nativeID="team-search-screen-title" style={{ fontFamily: 'Orbitron_700Bold' }} testID="team-search-screen-title">
            Buscar equipos
          </Text>
        </View>

        <SectionCard icon="magnify" title="Filtros">
          <InputField dense label="Nombre" onChange={setName} placeholder="Buscar por nombre" value={name} />
          <Row>
            <Col>
              <PickerField dense label="Nivel" onChange={setLevel} options={LEVEL_OPTIONS} placeholder="Cualquiera" value={level} />
            </Col>
            <Col>
              {isWeb ? (
                <SelectField dense label="País" onChange={address.handleCountryChange} options={address.countryOptions} placeholder="Cualquiera" value={address.country} />
              ) : (
                <PickerField dense label="País" onChange={address.handleCountryChange} options={address.countryOptions} placeholder="Cualquiera" value={address.country} />
              )}
            </Col>
          </Row>
          <Row>
            <Col>
              {isWeb ? (
                <SelectField dense disabled={!address.country} label="Provincia" onChange={address.handleProvinceChange} options={address.provinceOptions} placeholder={address.country ? 'Cualquiera' : 'Elegí un país'} value={address.province} />
              ) : (
                <PickerField dense disabled={!address.country} label="Provincia" onChange={address.handleProvinceChange} options={address.provinceOptions} placeholder={address.country ? 'Cualquiera' : 'Elegí un país'} value={address.province} />
              )}
            </Col>
            <Col>
              {isWeb ? (
                <SelectField dense disabled={!address.province} label="Localidad" onChange={address.handleCityChange} options={address.cityOptions} placeholder={address.province ? 'Cualquiera' : 'Elegí una provincia'} value={address.city} />
              ) : (
                <PickerField dense disabled={!address.province} label="Localidad" onChange={address.handleCityChange} options={address.cityOptions} placeholder={address.province ? 'Cualquiera' : 'Elegí una provincia'} value={address.city} />
              )}
            </Col>
          </Row>
          <Pressable
            className="mt-2 h-11 flex-row items-center justify-center gap-2 self-start rounded-full bg-primary px-6 hover:opacity-90 active:opacity-80"
            nativeID="team-search-submit-button"
            onPress={handleSearch}
            testID="team-search-submit-button"
          >
            <MaterialCommunityIcons color={colors.onPrimary} name="magnify" size={18} />
            <Text className="text-sm font-semibold uppercase tracking-wide text-[#111518]" nativeID="team-search-submit-button-label" testID="team-search-submit-button-label">
              Buscar
            </Text>
          </Pressable>
        </SectionCard>

        {searched && (
          <SectionCard icon="account-group" title="Resultados">
            {loading && results.length === 0 ? (
              <View className="items-center py-6" nativeID="team-search-loading" testID="team-search-loading">
                <ActivityIndicator color={colors.primary} />
              </View>
            ) : results.length === 0 ? (
              <Text className="py-2 text-sm text-slate-500 dark:text-slate-400" nativeID="team-search-empty" testID="team-search-empty">
                No encontramos equipos con esos filtros.
              </Text>
            ) : (
              <>
                <View className="gap-2" nativeID="team-search-results-list" testID="team-search-results-list">
                  {results.map((team) => (
                    <TeamSearchResultCard
                      key={team.id}
                      onRequest={{ handle: handleRequest, myPendingTeamIds }}
                      requesting={isCreating && requestingTeamId === team.id}
                      team={team}
                    />
                  ))}
                </View>
                {hasMore && (
                  <Pressable
                    className="mt-4 h-10 flex-row items-center justify-center gap-2 self-center rounded-full border border-slate-200 px-6 hover:bg-slate-100 active:opacity-80 dark:border-slate-700 dark:hover:bg-slate-800"
                    disabled={loading}
                    nativeID="team-search-load-more-button"
                    onPress={loadMore}
                    testID="team-search-load-more-button"
                  >
                    {loading ? <ActivityIndicator color={colors.onSurfaceVariant} size="small" /> : (
                      <Text className="text-sm font-semibold text-slate-700 dark:text-slate-200" nativeID="team-search-load-more-button-label" testID="team-search-load-more-button-label">
                        Cargar más
                      </Text>
                    )}
                  </Pressable>
                )}
              </>
            )}
          </SectionCard>
        )}
      </View>
    </ScrollView>
  );
}

export function TeamSearchScreen() {
  return (
    <RequireAuth>
      <TeamSearchScreenContent />
    </RequireAuth>
  );
}
```

- [ ] **Step 3: Create the route file `app/(tabs)/teams/search.jsx`**

```jsx
import { TeamSearchScreen } from '../../../components/team/team-search-screen.jsx';

export default function TeamsSearch() {
  return <TeamSearchScreen />;
}
```

- [ ] **Step 4: Run tests and lint**

Run: `npm test` and `npm run lint`
Expected: both green.

- [ ] **Step 5: Commit**

```bash
git add components/team/team-search-screen.jsx components/team/team-general-info-fields.jsx "app/(tabs)/teams/search.jsx"
git commit -m "feat(teams): add team search screen with paginated results"
```

---

### Task 9: `teams-list-screen.jsx` — search button + pending-request dot

**Files:**
- Modify: `components/team/teams-list-screen.jsx` (full file is short — see current content in Task context; edits below are targeted)

**Interfaces:**
- Consumes: `useTeamsJoinRequestsMap` (Task 4).

- [ ] **Step 1: Add the search button (corredor only) to the header**

Find:

```jsx
        <View className="mb-8 flex-row items-center gap-2" nativeID="teams-list-screen-header" testID="teams-list-screen-header">
          <Pressable
            className="flex-row items-center gap-1.5 py-1 pr-1 hover:opacity-70 active:opacity-70"
            nativeID="teams-list-screen-back-button"
            onPress={() => router.back()}
            testID="teams-list-screen-back-button"
          >
            <MaterialCommunityIcons color={colors.onSurfaceVariant} name="arrow-left" size={18} />
          </Pressable>
          <Text className="text-xl text-slate-900 dark:text-white" nativeID="teams-list-screen-title" style={{ fontFamily: 'Orbitron_700Bold' }} testID="teams-list-screen-title">
            Mis equipos
          </Text>
        </View>
```

Replace with (adds a flex-1 spacer + search button, visible only for corredor — `!canCreateTeam` since `canCreateTeam` is already `hasTrainerRole && activeRole === 'trainer'`, and search only makes sense for `activeRole === 'runner'`, not for a trainer viewing as trainer; use `activeRole === 'runner'` directly for clarity, matching the spec's exact wording):

```jsx
        <View className="mb-8 flex-row items-center gap-2" nativeID="teams-list-screen-header" testID="teams-list-screen-header">
          <Pressable
            className="flex-row items-center gap-1.5 py-1 pr-1 hover:opacity-70 active:opacity-70"
            nativeID="teams-list-screen-back-button"
            onPress={() => router.back()}
            testID="teams-list-screen-back-button"
          >
            <MaterialCommunityIcons color={colors.onSurfaceVariant} name="arrow-left" size={18} />
          </Pressable>
          <Text className="flex-1 text-xl text-slate-900 dark:text-white" nativeID="teams-list-screen-title" style={{ fontFamily: 'Orbitron_700Bold' }} testID="teams-list-screen-title">
            Mis equipos
          </Text>
          {activeRole === 'runner' && (
            <Pressable
              accessibilityLabel="Buscar equipos"
              className="rounded-full p-2 hover:bg-slate-100 active:opacity-70 dark:hover:bg-slate-800"
              nativeID="teams-list-search-button"
              onPress={() => router.push('/teams/search')}
              testID="teams-list-search-button"
            >
              <MaterialCommunityIcons color={colors.onSurfaceVariant} name="magnify" size={22} />
            </Pressable>
          )}
        </View>
```

- [ ] **Step 2: Wire the pending-request dot onto administered team rows**

Add the import at the top of the file: `import { useTeamsJoinRequestsMap } from '../../hooks/use-join-requests.js';`

Find `TeamRow`'s current definition:

```jsx
function TeamRow({ team, onPress }) {
  const colors = useThemeColors();
  return (
    <Pressable
      className="flex-row items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3.5 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:hover:bg-slate-800"
      nativeID={`teams-list-team-${team.id}`}
      onPress={onPress}
      testID={`teams-list-team-${team.id}`}
    >
      <View className="h-9 w-9 items-center justify-center rounded-full bg-primary-tint dark:bg-primary/15" nativeID={`teams-list-team-${team.id}-icon`} testID={`teams-list-team-${team.id}-icon`}>
        <MaterialCommunityIcons color={colors.primary} name="account-group" size={18} />
      </View>
      <Text className="flex-1 text-sm font-semibold text-slate-900 dark:text-white" nativeID={`teams-list-team-${team.id}-name`} testID={`teams-list-team-${team.id}-name`}>
        {team.name}
      </Text>
      <MaterialCommunityIcons color={colors.onSurfaceVariant} name="chevron-right" size={18} />
    </Pressable>
  );
}
```

Replace with (new `hasPendingRequests` prop, dot on the icon wrapper — same visual pattern as the shells' badge, `absolute -right-1 -top-1 h-2 w-2 rounded-full bg-red-500`, requires the icon `View` to become `relative`):

```jsx
function TeamRow({ team, onPress, hasPendingRequests }) {
  const colors = useThemeColors();
  return (
    <Pressable
      className="flex-row items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3.5 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:hover:bg-slate-800"
      nativeID={`teams-list-team-${team.id}`}
      onPress={onPress}
      testID={`teams-list-team-${team.id}`}
    >
      <View className="relative h-9 w-9 items-center justify-center rounded-full bg-primary-tint dark:bg-primary/15" nativeID={`teams-list-team-${team.id}-icon`} testID={`teams-list-team-${team.id}-icon`}>
        <MaterialCommunityIcons color={colors.primary} name="account-group" size={18} />
        {hasPendingRequests && (
          <View className="absolute -right-1 -top-1 h-2 w-2 rounded-full bg-red-500" nativeID={`teams-list-team-${team.id}-pending-dot`} testID={`teams-list-team-${team.id}-pending-dot`} />
        )}
      </View>
      <Text className="flex-1 text-sm font-semibold text-slate-900 dark:text-white" nativeID={`teams-list-team-${team.id}-name`} testID={`teams-list-team-${team.id}-name`}>
        {team.name}
      </Text>
      <MaterialCommunityIcons color={colors.onSurfaceVariant} name="chevron-right" size={18} />
    </Pressable>
  );
}
```

Now wire the data into the list render. Find, inside `TeamsListScreenContent`:

```jsx
  const myTeams = activeRole === 'trainer' ? administeredTeams : myMemberTeams;
  const [loading, setLoading] = useState(true);
```

Replace with:

```jsx
  const myTeams = activeRole === 'trainer' ? administeredTeams : myMemberTeams;
  const { byTeamId: pendingRequestsByTeamId } = useTeamsJoinRequestsMap(activeRole === 'trainer' ? administeredTeams.map((t) => t.id) : []);
  const [loading, setLoading] = useState(true);
```

Then find the `.map` that renders `TeamRow`:

```jsx
              {myTeams.map((team) => (
                <TeamRow key={team.id} onPress={() => router.push(`/teams/${team.id}`)} team={team} />
              ))}
```

Replace with:

```jsx
              {myTeams.map((team) => (
                <TeamRow
                  hasPendingRequests={(pendingRequestsByTeamId.get(team.id) ?? []).length > 0}
                  key={team.id}
                  onPress={() => router.push(`/teams/${team.id}`)}
                  team={team}
                />
              ))}
```

- [ ] **Step 3: Run tests and lint**

Run: `npm test` and `npm run lint`
Expected: both green.

- [ ] **Step 4: Commit**

```bash
git add components/team/teams-list-screen.jsx
git commit -m "feat(teams): add search entry point and pending-request dot to teams list"
```

---

### Task 10: `edit-team-screen.jsx` — visible/isPublic checkboxes

**Files:**
- Modify: `components/team/edit-team-screen.jsx`

**Interfaces:**
- Consumes: `toTeamModel`'s new `visible`/`isPublic` fields (Task 1, already flowing through `team` prop since `team` comes from `useTeamStore`, normalized via `toTeamModel`).

- [ ] **Step 1: Add local state for the 2 new booleans**

Find:

```jsx
  const generalForm = useTeamGeneralInfoForm({ initial: team, maxAllowed });
  const [showGroupsToRunners, setShowGroupsToRunners] = useState(team.showGroupsToRunners ?? false);
  const [submitting, setSubmitting] = useState(false);
```

Replace with:

```jsx
  const generalForm = useTeamGeneralInfoForm({ initial: team, maxAllowed });
  const [showGroupsToRunners, setShowGroupsToRunners] = useState(team.showGroupsToRunners ?? false);
  const [visible, setVisible] = useState(team.visible ?? true);
  const [isPublic, setIsPublic] = useState(team.isPublic ?? true);
  const [submitting, setSubmitting] = useState(false);
```

- [ ] **Step 2: Include the new fields in the submit payload**

Find:

```jsx
    const result = await updateTeam(teamId, { ...generalForm.getValues(), showGroupsToRunners });
```

Replace with:

```jsx
    const result = await updateTeam(teamId, { ...generalForm.getValues(), showGroupsToRunners, visible, isPublic });
```

- [ ] **Step 3: Add the 2 checkboxes to the "Privacidad" `SectionCard`**

Find (the closing of the existing `showGroupsToRunners` checkbox `Pressable`, right before the save button):

```jsx
            <View className="flex-1" nativeID="edit-team-show-groups-checkbox-text" testID="edit-team-show-groups-checkbox-text">
              <Text className="text-sm font-medium text-slate-900 dark:text-white" nativeID="edit-team-show-groups-checkbox-label" testID="edit-team-show-groups-checkbox-label">
                Mostrar los grupos a los corredores
              </Text>
              <Text className="text-xs text-slate-500 dark:text-slate-400" nativeID="edit-team-show-groups-checkbox-hint" testID="edit-team-show-groups-checkbox-hint">
                Van a poder ver a qué grupo pertenece cada compañero de equipo. La sección Grupos sigue siendo solo para vos.
              </Text>
            </View>
          </Pressable>

          <Pressable
            className={`mt-5 h-12 flex-row items-center justify-center gap-2 rounded-full bg-primary hover:opacity-90 active:opacity-80 ${submitting ? 'opacity-60' : ''}`}
```

Replace with (adds 2 new checkboxes, same exact pattern, between the existing one and the save button — note `mt-5` moves from the save-button `Pressable` down to a `mt-4` on the FIRST new checkbox instead, so the vertical rhythm stays consistent; the save button's own `mt-5` becomes just its normal spacing after the last checkbox):

```jsx
            <View className="flex-1" nativeID="edit-team-show-groups-checkbox-text" testID="edit-team-show-groups-checkbox-text">
              <Text className="text-sm font-medium text-slate-900 dark:text-white" nativeID="edit-team-show-groups-checkbox-label" testID="edit-team-show-groups-checkbox-label">
                Mostrar los grupos a los corredores
              </Text>
              <Text className="text-xs text-slate-500 dark:text-slate-400" nativeID="edit-team-show-groups-checkbox-hint" testID="edit-team-show-groups-checkbox-hint">
                Van a poder ver a qué grupo pertenece cada compañero de equipo. La sección Grupos sigue siendo solo para vos.
              </Text>
            </View>
          </Pressable>

          <Pressable
            accessibilityLabel="Visible en búsqueda"
            accessibilityRole="checkbox"
            accessibilityState={{ checked: visible }}
            className="mt-4 flex-row items-start gap-3 py-1"
            nativeID="edit-team-visible-checkbox"
            onPress={() => setVisible((v) => !v)}
            testID="edit-team-visible-checkbox"
          >
            <View
              className={`mt-0.5 h-5 w-5 items-center justify-center rounded border ${visible ? 'border-primary bg-primary' : 'border-slate-300 dark:border-slate-600'}`}
              nativeID="edit-team-visible-checkbox-box"
              testID="edit-team-visible-checkbox-box"
            >
              {visible && <MaterialCommunityIcons color={colors.onPrimary} name="check-bold" size={14} />}
            </View>
            <View className="flex-1" nativeID="edit-team-visible-checkbox-text" testID="edit-team-visible-checkbox-text">
              <Text className="text-sm font-medium text-slate-900 dark:text-white" nativeID="edit-team-visible-checkbox-label" testID="edit-team-visible-checkbox-label">
                Visible en búsqueda
              </Text>
              <Text className="text-xs text-slate-500 dark:text-slate-400" nativeID="edit-team-visible-checkbox-hint" testID="edit-team-visible-checkbox-hint">
                Aparece en los resultados cuando un corredor busca equipos para unirse.
              </Text>
            </View>
          </Pressable>

          <Pressable
            accessibilityLabel="Acepta solicitudes de ingreso"
            accessibilityRole="checkbox"
            accessibilityState={{ checked: isPublic }}
            className="mt-4 flex-row items-start gap-3 py-1"
            nativeID="edit-team-is-public-checkbox"
            onPress={() => setIsPublic((v) => !v)}
            testID="edit-team-is-public-checkbox"
          >
            <View
              className={`mt-0.5 h-5 w-5 items-center justify-center rounded border ${isPublic ? 'border-primary bg-primary' : 'border-slate-300 dark:border-slate-600'}`}
              nativeID="edit-team-is-public-checkbox-box"
              testID="edit-team-is-public-checkbox-box"
            >
              {isPublic && <MaterialCommunityIcons color={colors.onPrimary} name="check-bold" size={14} />}
            </View>
            <View className="flex-1" nativeID="edit-team-is-public-checkbox-text" testID="edit-team-is-public-checkbox-text">
              <Text className="text-sm font-medium text-slate-900 dark:text-white" nativeID="edit-team-is-public-checkbox-label" testID="edit-team-is-public-checkbox-label">
                Acepta solicitudes de ingreso
              </Text>
              <Text className="text-xs text-slate-500 dark:text-slate-400" nativeID="edit-team-is-public-checkbox-hint" testID="edit-team-is-public-checkbox-hint">
                Si está apagado, el equipo puede seguir siendo visible en la búsqueda pero nadie va a poder pedir unirse — solo por invitación.
              </Text>
            </View>
          </Pressable>

          <Pressable
            className={`mt-5 h-12 flex-row items-center justify-center gap-2 rounded-full bg-primary hover:opacity-90 active:opacity-80 ${submitting ? 'opacity-60' : ''}`}
```

- [ ] **Step 4: Run tests and lint**

Run: `npm test` and `npm run lint`
Expected: both green.

- [ ] **Step 5: Commit**

```bash
git add components/team/edit-team-screen.jsx
git commit -m "feat(teams): add visible/isPublic checkboxes to edit-team screen"
```

---

### Task 11: `team-requests-tab.jsx` + `team-detail-screen.jsx` — 4th tab "Solicitudes"

**Files:**
- Create: `components/team/team-requests-tab.jsx`
- Modify: `components/team/team-detail-screen.jsx`

**Interfaces:**
- Consumes: `useTeamJoinRequests`, `useJoinRequestMutations` (Task 4).
- Produces: `TeamRequestsTab({ teamId })`, consumed only by `team-detail-screen.jsx` in this same task.

- [ ] **Step 1: Create `components/team/team-requests-tab.jsx`**

```jsx
import { useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import Toast from 'react-native-toast-message';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useThemeColors } from '../../theme/colors.js';
import { formatRelativeTime } from '../../utils/relative-time.js';
import { SectionCard } from '../forms/section-card.jsx';
import { useTeamJoinRequests, useJoinRequestMutations } from '../../hooks/use-join-requests.js';

// Tab "Solicitudes" del entrenador dueño — aceptar/rechazar, tap directo
// sin modal de confirmación (mismo patrón que
// received-invitations-screen.jsx/notifications-screen.jsx).
function JoinRequestRow({ request, onAccept, onReject, responding }) {
  const colors = useThemeColors();

  return (
    <View
      className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-700 dark:bg-slate-900"
      nativeID={`team-request-${request.id}`}
      testID={`team-request-${request.id}`}
    >
      <Text className="text-sm font-semibold text-slate-900 dark:text-white" nativeID={`team-request-${request.id}-runner`} testID={`team-request-${request.id}-runner`}>
        {request.runnerName ?? 'Corredor'}
      </Text>
      <Text className="mb-2 text-xs text-slate-500 dark:text-slate-400" nativeID={`team-request-${request.id}-meta`} testID={`team-request-${request.id}-meta`}>
        Pidió unirse {formatRelativeTime(request.createdAt).toLowerCase()}
      </Text>
      <View className="flex-row gap-2" nativeID={`team-request-${request.id}-actions`} testID={`team-request-${request.id}-actions`}>
        <Pressable
          className="h-9 flex-1 flex-row items-center justify-center gap-1.5 rounded-full bg-primary hover:opacity-90 active:opacity-80 disabled:opacity-60"
          disabled={responding}
          nativeID={`team-request-${request.id}-accept-button`}
          onPress={onAccept}
          testID={`team-request-${request.id}-accept-button`}
        >
          <MaterialCommunityIcons color={colors.onPrimary} name="check" size={16} />
          <Text className="text-xs font-semibold uppercase tracking-wide text-[#111518]" nativeID={`team-request-${request.id}-accept-button-label`} testID={`team-request-${request.id}-accept-button-label`}>
            Aceptar
          </Text>
        </Pressable>
        <Pressable
          className="h-9 flex-1 flex-row items-center justify-center gap-1.5 rounded-full border border-slate-200 hover:bg-slate-100 active:opacity-80 disabled:opacity-60 dark:border-slate-700 dark:hover:bg-slate-800"
          disabled={responding}
          nativeID={`team-request-${request.id}-reject-button`}
          onPress={onReject}
          testID={`team-request-${request.id}-reject-button`}
        >
          <MaterialCommunityIcons color={colors.onSurfaceVariant} name="close" size={16} />
          <Text className="text-xs font-semibold uppercase tracking-wide text-slate-700 dark:text-slate-200" nativeID={`team-request-${request.id}-reject-button-label`} testID={`team-request-${request.id}-reject-button-label`}>
            Rechazar
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

export function TeamRequestsTab({ teamId }) {
  const colors = useThemeColors();
  const { requests, loading } = useTeamJoinRequests(teamId);
  const { acceptJoinRequest, rejectJoinRequest, isAccepting, isRejecting } = useJoinRequestMutations();
  const [respondingId, setRespondingId] = useState(null);

  const handleAccept = async (requestId) => {
    setRespondingId(requestId);
    try {
      await acceptJoinRequest(requestId);
      Toast.show({ type: 'success', text1: 'Corredor aceptado' });
    } catch (error) {
      Toast.show({ type: 'error', text1: 'No pudimos aceptar la solicitud', text2: error.message });
    }
    setRespondingId(null);
  };

  const handleReject = async (requestId) => {
    setRespondingId(requestId);
    try {
      await rejectJoinRequest(requestId);
      Toast.show({ type: 'success', text1: 'Solicitud rechazada' });
    } catch (error) {
      Toast.show({ type: 'error', text1: 'No pudimos rechazar la solicitud', text2: error.message });
    }
    setRespondingId(null);
  };

  return (
    <SectionCard icon="account-question-outline" title="Solicitudes">
      {loading ? (
        <View className="items-center py-6" nativeID="team-requests-tab-loading" testID="team-requests-tab-loading">
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : requests.length === 0 ? (
        <Text className="py-2 text-sm text-slate-500 dark:text-slate-400" nativeID="team-requests-tab-empty" testID="team-requests-tab-empty">
          No hay solicitudes de ingreso pendientes.
        </Text>
      ) : (
        <View className="gap-2" nativeID="team-requests-tab-list" testID="team-requests-tab-list">
          {requests.map((request) => (
            <JoinRequestRow
              key={request.id}
              onAccept={() => handleAccept(request.id)}
              onReject={() => handleReject(request.id)}
              request={request}
              responding={(isAccepting || isRejecting) && respondingId === request.id}
            />
          ))}
        </View>
      )}
    </SectionCard>
  );
}
```

- [ ] **Step 2: Wire the tab into `team-detail-screen.jsx` — imports and query-param initial tab**

Add the import: `import { TeamRequestsTab } from './team-requests-tab.jsx';`

Find:

```jsx
import { useRouter } from 'expo-router';
```

Replace with:

```jsx
import { useRouter, useLocalSearchParams } from 'expo-router';
```

- [ ] **Step 3: Add the 4th tab to `TABS` and to the mobile/web render branches**

Find:

```jsx
const TABS = [
  { id: 'general', label: 'Información general y estadísticas', icon: 'information-outline' },
  { id: 'corredores', label: 'Corredores', icon: 'account-multiple' },
  { id: 'grupos', label: 'Grupos', icon: 'account-group' },
];
```

Replace with:

```jsx
const TABS = [
  { id: 'general', label: 'Información general y estadísticas', icon: 'information-outline' },
  { id: 'corredores', label: 'Corredores', icon: 'account-multiple' },
  { id: 'grupos', label: 'Grupos', icon: 'account-group' },
  { id: 'solicitudes', label: 'Solicitudes', icon: 'account-question-outline' },
];
```

Find, inside `TeamDetailScreenContent`:

```jsx
  const [activeTab, setActiveTab] = useState('general');
```

Replace with (reads the `?tab=` query param set by `notifications-screen.jsx`'s deep link — falls back to `'general'` if absent or not a real tab id):

```jsx
  const params = useLocalSearchParams();
  const [activeTab, setActiveTab] = useState(TABS.some((t) => t.id === params.tab) ? params.tab : 'general');
```

Find:

```jsx
  const visibleTabs = isTrainerView ? TABS : TABS.filter((tab) => tab.id !== 'grupos');
```

Replace with (both `grupos` and `solicitudes` are gated — `grupos` unchanged, `solicitudes` only for the actual owner, using the already-existing `canDeleteTeam` flag):

```jsx
  const visibleTabs = TABS.filter((tab) => (tab.id !== 'grupos' || isTrainerView) && (tab.id !== 'solicitudes' || canDeleteTeam));
```

- [ ] **Step 4: Add the tab's content and render it in both web (tabbed) and mobile (stacked) branches**

Find:

```jsx
  const visibleTabs = TABS.filter((tab) => (tab.id !== 'grupos' || isTrainerView) && (tab.id !== 'solicitudes' || canDeleteTeam));

  return (
```

Replace with (adds `solicitudesContent` right before the `return`):

```jsx
  const visibleTabs = TABS.filter((tab) => (tab.id !== 'grupos' || isTrainerView) && (tab.id !== 'solicitudes' || canDeleteTeam));
  const solicitudesContent = canDeleteTeam && <TeamRequestsTab teamId={team.id} />;

  return (
```

Find:

```jsx
        {isWeb ? (
          <>
            <TabBar active={activeTab} onChange={setActiveTab} scope="team-detail-tab-bar" tabs={visibleTabs} />
            {activeTab === 'general' && generalContent}
            {activeTab === 'corredores' && corredoresContent}
            {activeTab === 'grupos' && gruposContent}
          </>
        ) : (
          <>
            {generalContent}
            {corredoresContent}
            {gruposContent}
          </>
        )}
```

Replace with:

```jsx
        {isWeb ? (
          <>
            <TabBar active={activeTab} onChange={setActiveTab} scope="team-detail-tab-bar" tabs={visibleTabs} />
            {activeTab === 'general' && generalContent}
            {activeTab === 'corredores' && corredoresContent}
            {activeTab === 'grupos' && gruposContent}
            {activeTab === 'solicitudes' && solicitudesContent}
          </>
        ) : (
          <>
            {generalContent}
            {corredoresContent}
            {gruposContent}
            {solicitudesContent}
          </>
        )}
```

- [ ] **Step 5: Run tests and lint**

Run: `npm test` and `npm run lint`
Expected: both green.

- [ ] **Step 6: Commit**

```bash
git add components/team/team-requests-tab.jsx components/team/team-detail-screen.jsx
git commit -m "feat(teams): add Solicitudes tab to team-detail-screen for owners"
```

---

### Task 12: Version bump, lint/test verification, manual preview check

**Files:**
- Modify: `package.json` (version line)
- Modify: `package-lock.json` (both root version occurrences)

**Interfaces:**
- Consumes: nothing from earlier tasks.
- Produces: nothing — final task.

- [ ] **Step 1: Check the current version and bump it**

Run: `grep -m1 '"version"' package.json` to see the current version (this branch started from whatever `develop` had at branch-creation time — do not assume `0.9.1`, the payments/checkout branches before this one may have already bumped it further).

Bump the **minor** version (this is a substantial feature: 2 new screens, 2 new services, 2 new hooks, 3 shell edits, real backend integration — same scale as the settings module or payments Fase1, both of which took minor bumps per this repo's versioning convention). If current is `X.Y.Z`, set it to `X.(Y+1).0` in both `package.json` (the `"version"` line) and **both** occurrences in `package-lock.json` (the root package's name+version block appears twice near the top of the file — edit both, never run `npm install`, which would rewrite the whole lockfile).

- [ ] **Step 2: Run the full test suite**

Run: `npm test`
Expected: all tests pass (this repo has no component-render tests, per CLAUDE.md convention — this is a regression check on unrelated services/store/normalizer logic).

- [ ] **Step 3: Run lint**

Run: `npm run lint`
Expected: no errors (pre-existing `react-hooks/exhaustive-deps` warnings elsewhere are non-blocking, per CLAUDE.md).

- [ ] **Step 4: Manual preview verification (web, with mocks)**

Start the web dev server with `EXPO_PUBLIC_USE_MOCKS=true` (the `.claude/launch.json` "expo-web" configuration already sets this). Log in with any email/password (mock auth accepts anything). Confirm, in order:

1. `/teams` shows a search icon in the header (corredor role) — click it, land on `/teams/search`.
2. Search with no filters, click "Buscar" — see the 4 seeded mock teams (all `visible: true` after Task 2's mock edit). Click "Solicitar unirse" on one — button becomes "Solicitud enviada" after a refetch (may need to re-run the search to see the updated button state, since results aren't automatically re-fetched on mutation success beyond cache invalidation — confirm this refresh happens; if it doesn't, that's a real gap to flag, not something to silently accept).
3. Switch role to entrenador (if the demo user has both roles) — `/notifications` (via the bell/drawer entry, no longer "Invitaciones") shows a "Solicitudes pendientes" section if any mock team owned by user id 1 has a pending request.
4. Open `/teams/{id}` for a team you administer, confirm a 4th tab "Solicitudes" appears (web: as a tab; mobile-width preview: stacked below Grupos), showing the same pending request with Aceptar/Rechazar buttons.
5. Accept it — confirm it disappears from both the tab and (after navigating back) the teams-list dot.
6. Open `/teams/{id}/edit`, confirm the 2 new checkboxes ("Visible en búsqueda", "Acepta solicitudes de ingreso") appear under "Privacidad", toggle one, save, confirm no error Toast.

If any step surfaces a real bug (not a cosmetic nit), fix it before proceeding to Step 5 — this plan's tasks were written against inferred UI wiring in a codebase with no render tests, so this manual pass is the only correctness gate before merge.

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: bump version for team search + join requests feature"
```
