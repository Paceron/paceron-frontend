# Invitaciones: grupo al invitar + pantalla de invitaciones recibidas Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cerrar los gaps 8 y 9 de `docs/BACKEND_API_GAPS.md` (ya resueltos en backend, confirmado en swagger 2026-07-31): reintroducir la selección de grupo al invitar, y agregar la pantalla de "invitaciones recibidas" del lado del invitado.

**Architecture:** Continúa exactamente sobre la rama `feature/teams-invitations-and-qa-fixes` (no mergeada, no pusheada) y el mismo patrón de capas ya establecido (`services/` + normalizers + acciones async en `store/team-store.js`). Gran parte de este trabajo es reintroducir código que existía antes de que la Etapa 3 lo sacara (por no tener backend), ahora con soporte real.

**Tech Stack:** Zustand, Expo Router, NativeWind, Jest.

## Global Constraints

- La pantalla de invitaciones recibidas **no muestra nombre de grupo** — `InvitationResponse` trae `group_id` pero no `group_name`, y el invitado no puede resolverlo (`GET /groups` valida membresía, que todavía no tiene). Solo equipo (`team_name`) + fecha + acciones. Decisión confirmada con el usuario 2026-07-31.
- **Sin verificación en browser por parte de los subagentes** (misma convención que el resto de esta rama) — cada tarea termina en código + tests unitarios (donde el repo los tiene) + `npm run lint`.
- Modelos: el nivel más barato que alcance por rol.
- Todo elemento visual nuevo lleva `nativeID`/`testID` únicos.
- `npm test` y `npm run lint` en verde después de cada tarea.

---

### Task 1: Normalizers — `toInvitationModel` extendido, `toInvitePayload`

**Files:**
- Modify: `services/normalizers.js`
- Test: `__tests__/normalizers.test.js`

**Interfaces:**
- Produces: `toInvitationModel(dto)` gana `groupId: string|null` (de `dto.group_id`) y `teamName: string|null` (de `dto.team_name`). Nuevo `toInvitePayload(email, groupId)` → `{email, group_id?}` (omite `group_id` si `groupId` es falsy).

- [ ] **Step 1: Actualizar/agregar tests**

En `__tests__/normalizers.test.js`, reemplazar el test `'maps snake_case fields to camelCase and coerces ids to string'` de `describe('toInvitationModel', ...)`:

```js
  test('maps snake_case fields to camelCase and coerces ids to string', () => {
    const dto = {
      id: 10, team_id: 1, invitee_email: 'a@b.com', invitee_id: 5, invitee_name: 'Pepe Lota',
      group_id: 3, team_name: 'Corredores del Sur',
      status: 'pending', expires_at: '2026-08-01T00:00:00.000Z', created_at: '2026-07-31T00:00:00.000Z',
    };
    expect(toInvitationModel(dto)).toEqual({
      id: '10', teamId: '1', email: 'a@b.com', inviteeId: 5, inviteeName: 'Pepe Lota',
      groupId: '3', teamName: 'Corredores del Sur',
      status: 'pending', expiresAt: '2026-08-01T00:00:00.000Z', createdAt: '2026-07-31T00:00:00.000Z',
    });
  });

  test('defaults groupId/teamName to null when the backend omits them', () => {
    const dto = { id: 10, team_id: 1, invitee_email: 'a@b.com', status: 'pending' };
    const model = toInvitationModel(dto);
    expect(model.groupId).toBeNull();
    expect(model.teamName).toBeNull();
  });
```

Agregar `describe` nuevo al final del archivo:

```js
describe('toInvitePayload', () => {
  test('includes group_id when groupId is provided', () => {
    expect(toInvitePayload('a@b.com', '3')).toEqual({ email: 'a@b.com', group_id: 3 });
  });

  test('omits group_id when groupId is falsy', () => {
    expect(toInvitePayload('a@b.com', '')).toEqual({ email: 'a@b.com' });
    expect(toInvitePayload('a@b.com', null)).toEqual({ email: 'a@b.com' });
    expect(toInvitePayload('a@b.com', undefined)).toEqual({ email: 'a@b.com' });
  });
});
```

Actualizar el import del principio del archivo agregando `toInvitePayload`.

- [ ] **Step 2: Correr los tests y confirmar que fallan**

Run: `npx jest normalizers.test.js`
Expected: FAIL — el test de `toInvitationModel` actualizado no matchea el output actual (sin `groupId`/`teamName`), y `toInvitePayload` no existe.

- [ ] **Step 3: Implementar en `services/normalizers.js`**

Reemplazar `toInvitationModel`:

```js
export function toInvitationModel(dto) {
  if (!dto) return null;
  return {
    id: String(dto.id),
    teamId: String(dto.team_id),
    email: dto.invitee_email,
    inviteeId: dto.invitee_id,
    inviteeName: dto.invitee_name,
    groupId: dto.group_id != null ? String(dto.group_id) : null,
    teamName: dto.team_name ?? null,
    status: dto.status,
    expiresAt: dto.expires_at,
    createdAt: dto.created_at,
  };
}
```

Agregar al final del archivo:

```js
export function toInvitePayload(email, groupId) {
  const payload = { email };
  if (groupId) payload.group_id = Number(groupId);
  return payload;
}
```

- [ ] **Step 4: Correr los tests y confirmar que pasan**

Run: `npx jest normalizers.test.js`
Expected: PASS, todos los tests del archivo.

- [ ] **Step 5: Commit**

```bash
git add services/normalizers.js __tests__/normalizers.test.js
git commit -m "feat(teams): extend invitation normalizer with groupId/teamName, add toInvitePayload"
```

---

### Task 2: `services/invitations.js` + mock — `group_id` al invitar, listar/consultar mis invitaciones

**Files:**
- Modify: `services/invitations.js`
- Modify: `services/__mocks__/invitations-mock.js`
- Modify: `services/__mocks__/teams-mock.js`
- Test: `__tests__/invitations-mock.test.js`

**Interfaces:**
- Consumes: `toInvitePayload` de la Task 1.
- Produces: `inviteToTeam(teamId, payload)` (payload ya armado por el caller vía `toInvitePayload`, cambia de firma — antes era `inviteToTeam(teamId, email)`). Nuevo `listMyInvitations(userId, email)` — `email` es un parámetro **solo para el mock** (el mock no tiene un directorio real de usuarios para resolver `user_id → email`, así que necesita que el caller se lo pase; el backend real lo ignora, solo usa `user_id` como query param). Nuevo `getInvitation(invitationId, userId)`.

**Nota importante para el implementador:** el mock necesita saber el `name` del equipo (`team_name`) al crear una invitación — `services/__mocks__/teams-mock.js` gana una función exportada nueva `__getMockTeamName(teamId)` que `invitations-mock.js` importa, mismo patrón de acoplamiento entre mocks ya usado para `__seedDefaultGroup` (`teams-mock.js` → `groups-mock.js`), ahora en la dirección `invitations-mock.js` → `teams-mock.js`.

- [ ] **Step 1: Actualizar/agregar tests en `__tests__/invitations-mock.test.js`**

Reemplazar el archivo completo:

```js
import {
  mockInviteToTeam, mockListTeamInvitations, mockListMyInvitations, mockGetInvitation,
  mockAcceptInvitation, mockRejectInvitation, __resetMockInvitations,
} from '../services/__mocks__/invitations-mock.js';
import { __resetMockTeams } from '../services/__mocks__/teams-mock.js';

beforeEach(() => {
  __resetMockInvitations();
  __resetMockTeams();
});

describe('invitations-mock', () => {
  test('mockInviteToTeam creates a pending invitation scoped to the team, with team_name resolved', async () => {
    const result = await mockInviteToTeam('1', { email: 'a@b.com' });
    expect(result).toEqual({ message: 'Invitación enviada.' });
    const invitations = await mockListTeamInvitations('1');
    expect(invitations).toHaveLength(1);
    expect(invitations[0]).toMatchObject({ team_id: 1, invitee_email: 'a@b.com', status: 'pending', group_id: null, team_name: 'Corredores del Sur' });
  });

  test('mockInviteToTeam stores group_id when provided', async () => {
    await mockInviteToTeam('1', { email: 'a@b.com', group_id: 3 });
    const [invitation] = await mockListTeamInvitations('1');
    expect(invitation.group_id).toBe(3);
  });

  test('mockListTeamInvitations only returns pending invitations for the requested team', async () => {
    await mockInviteToTeam('1', { email: 'a@b.com' });
    await mockInviteToTeam('2', { email: 'b@b.com' });
    const invitations = await mockListTeamInvitations('1');
    expect(invitations).toHaveLength(1);
    expect(invitations[0].team_id).toBe(1);
  });

  test('mockListMyInvitations matches by invitee email, only pending', async () => {
    await mockInviteToTeam('1', { email: 'demo@paceron.com' });
    await mockInviteToTeam('2', { email: 'otro@b.com' });
    const mine = await mockListMyInvitations(1, 'demo@paceron.com');
    expect(mine).toHaveLength(1);
    expect(mine[0].invitee_email).toBe('demo@paceron.com');
  });

  test('mockGetInvitation returns the invitation by id, throws for an unknown id', async () => {
    await mockInviteToTeam('1', { email: 'a@b.com' });
    const [invitation] = await mockListTeamInvitations('1');
    expect(await mockGetInvitation(invitation.id, 1)).toEqual(invitation);
    await expect(mockGetInvitation(999999, 1)).rejects.toThrow();
  });

  test('mockAcceptInvitation marks the invitation accepted, removing it from the pending list', async () => {
    await mockInviteToTeam('1', { email: 'a@b.com' });
    const [invitation] = await mockListTeamInvitations('1');
    const result = await mockAcceptInvitation(invitation.id, 42);
    expect(result).toEqual({ message: 'Invitación aceptada.' });
    expect(await mockListTeamInvitations('1')).toEqual([]);
  });

  test('mockRejectInvitation marks the invitation rejected, removing it from the pending list', async () => {
    await mockInviteToTeam('1', { email: 'a@b.com' });
    const [invitation] = await mockListTeamInvitations('1');
    const result = await mockRejectInvitation(invitation.id, 42);
    expect(result).toEqual({ message: 'Invitación rechazada.' });
    expect(await mockListTeamInvitations('1')).toEqual([]);
  });

  test('mockAcceptInvitation throws for an unknown id', async () => {
    await expect(mockAcceptInvitation(999999, 1)).rejects.toThrow();
  });
});
```

(usa el equipo semilla `id: 1, name: 'Corredores del Sur'` ya sembrado por `teams-mock.js#buildSeedTeams` — confirmar ese nombre exacto leyendo el archivo actual antes de asumirlo; si difiere, ajustar el test al nombre real).

- [ ] **Step 2: Correr los tests y confirmar que fallan**

Run: `npx jest invitations-mock.test.js`
Expected: FAIL — `mockInviteToTeam` todavía espera `(teamId, email)`, `mockListMyInvitations`/`mockGetInvitation` no existen, `__getMockTeamName` no existe.

- [ ] **Step 3: Sumar `__getMockTeamName` a `services/__mocks__/teams-mock.js`**

Agregar al final del archivo:

```js
export function __getMockTeamName(teamId) {
  return mockTeams.find((t) => String(t.id) === String(teamId))?.name ?? null;
}
```

- [ ] **Step 4: Reescribir `services/__mocks__/invitations-mock.js`**

```js
// Estado in-memory con la MISMA shape snake_case que el backend real (para
// que toInvitationModel() funcione igual en ambas ramas) — mismo patrón
// stateful que groups-mock.js. expires_at se calcula a 7 días desde el
// envío (el backend no documenta el plazo exacto en el swagger, 7 días es
// un valor razonable solo para que el mock tenga algo consistente).
//
// mockListMyInvitations matchea por email en vez de invitee_id porque este
// mock no tiene un directorio real de usuarios que resuelva user_id→email
// al momento de invitar (a diferencia del backend real) — el caller (ver
// store/team-store.js#fetchMyInvitations) le pasa el email del usuario
// actual, que el backend real ignora (solo usa user_id como query param).
import { __getMockTeamName } from './teams-mock.js';

let mockInvitations = [];
let nextInvitationId = 1;

function findInvitationOrThrow(invitationId) {
  const invitation = mockInvitations.find((i) => String(i.id) === String(invitationId));
  if (!invitation) {
    const error = new Error('Invitación no encontrada.');
    error.status = 404;
    throw error;
  }
  return invitation;
}

export async function mockInviteToTeam(teamId, payload) {
  const now = new Date().toISOString();
  const expires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
  const invitation = {
    id: nextInvitationId++, team_id: Number(teamId), invitee_email: payload.email, invitee_id: null,
    invitee_name: null, group_id: payload.group_id ?? null, team_name: __getMockTeamName(teamId),
    status: 'pending', expires_at: expires, created_at: now,
  };
  mockInvitations.push(invitation);
  return { message: 'Invitación enviada.' };
}

export async function mockListTeamInvitations(teamId) {
  return mockInvitations.filter((i) => String(i.team_id) === String(teamId) && i.status === 'pending');
}

export async function mockListMyInvitations(_userId, email) {
  return mockInvitations.filter((i) => i.status === 'pending' && i.invitee_email?.toLowerCase() === (email ?? '').toLowerCase());
}

export async function mockGetInvitation(invitationId, _userId) {
  return findInvitationOrThrow(invitationId);
}

export async function mockAcceptInvitation(invitationId, userId) {
  const invitation = findInvitationOrThrow(invitationId);
  invitation.status = 'accepted';
  invitation.invitee_id = userId;
  return { message: 'Invitación aceptada.' };
}

export async function mockRejectInvitation(invitationId, userId) {
  const invitation = findInvitationOrThrow(invitationId);
  invitation.status = 'rejected';
  invitation.invitee_id = userId;
  return { message: 'Invitación rechazada.' };
}

export function __resetMockInvitations() {
  mockInvitations = [];
  nextInvitationId = 1;
}
```

- [ ] **Step 5: Actualizar `services/invitations.js`**

Reemplazar el archivo completo:

```js
import api from './api.js';
import { USE_MOCKS } from '../config/env.js';
import {
  mockInviteToTeam,
  mockListTeamInvitations,
  mockListMyInvitations,
  mockGetInvitation,
  mockAcceptInvitation,
  mockRejectInvitation,
} from './__mocks__/invitations-mock.js';

// POST /api/v1/teams/{id}/invite — invitation.InviteRunnerRequest (email +
// group_id opcional, ver services/normalizers.js#toInvitePayload — quien
// llama a esta función ya arma el payload con esa función).
export async function inviteToTeam(teamId, payload) {
  if (USE_MOCKS) return await mockInviteToTeam(teamId, payload);
  return await api.post(`/teams/${teamId}/invite`, payload);
}

// GET /api/v1/teams/{id}/invitations — invitaciones pendientes del equipo (lado dueño).
export async function listTeamInvitations(teamId) {
  if (USE_MOCKS) return await mockListTeamInvitations(teamId);
  return await api.get(`/teams/${teamId}/invitations`);
}

// GET /api/v1/invitations?user_id= — invitaciones pendientes del usuario
// actual (lado invitado). `email` es solo para el mock (ver
// services/__mocks__/invitations-mock.js) — el backend real solo usa `user_id`.
export async function listMyInvitations(userId, email) {
  if (USE_MOCKS) return await mockListMyInvitations(userId, email);
  return await api.get(`/invitations?user_id=${encodeURIComponent(userId)}`);
}

// GET /api/v1/invitations/{id}?user_id=. Sin consumidor en la UI todavía
// (el listado ya trae el detalle completo por item) — se agrega igual
// como espejo 1:1 barato del contrato ya documentado.
export async function getInvitation(invitationId, userId) {
  if (USE_MOCKS) return await mockGetInvitation(invitationId, userId);
  return await api.get(`/invitations/${invitationId}?user_id=${encodeURIComponent(userId)}`);
}

// POST /api/v1/invitations/{id}/accept — invitation.RespondInvitationRequest.
export async function acceptInvitation(invitationId, userId) {
  if (USE_MOCKS) return await mockAcceptInvitation(invitationId, userId);
  return await api.post(`/invitations/${invitationId}/accept`, { user_id: userId });
}

// POST /api/v1/invitations/{id}/reject.
export async function rejectInvitation(invitationId, userId) {
  if (USE_MOCKS) return await mockRejectInvitation(invitationId, userId);
  return await api.post(`/invitations/${invitationId}/reject`, { user_id: userId });
}
```

- [ ] **Step 6: Correr los tests y confirmar que pasan**

Run: `npx jest invitations-mock.test.js teams-mock.test.js normalizers.test.js`
Expected: PASS — todos, incluidos los preexistentes de `teams-mock.test.js` (el agregado de `__getMockTeamName` es aditivo, no debería romper nada).

- [ ] **Step 7: Correr toda la suite y lint**

Run: `npm test && npm run lint`
Expected: PASS / sin errores. (`store/team-store.js` todavía llama a `inviteToTeamService(teamId, email)` con la firma vieja — eso se rompe recién visible en la Task 3, no es problema de esta tarea, `npm test` de team-store.test.js puede fallar acá si corre contra la firma nueva sin que la Task 3 haya actualizado el store — si eso pasa, es esperado, continuar).

- [ ] **Step 8: Commit**

```bash
git add services/invitations.js services/__mocks__/invitations-mock.js services/__mocks__/teams-mock.js __tests__/invitations-mock.test.js
git commit -m "feat(teams): invite accepts group_id, add listMyInvitations/getInvitation"
```

---

### Task 3: `store/team-store.js` — `sendInvite` con grupo, `myInvitations`, aceptar/rechazar

**Files:**
- Modify: `store/team-store.js`
- Test: `__tests__/team-store.test.js`

**Interfaces:**
- Consumes: `inviteToTeam(teamId, payload)`/`listMyInvitations(userId, email)`/`acceptInvitation`/`rejectInvitation` de la Task 2, `toInvitePayload`/`toInvitationModel` de la Task 1.
- Produces: `sendInvite(teamId, email, groupId)` (gana el tercer parámetro). `fetchMyInvitations(userId, email)` → `Promise<{success, error?}>`, deja `myInvitations` (nuevo slice top-level del store, no por equipo) actualizado. `acceptMyInvitation(invitationId, userId)`/`rejectMyInvitation(invitationId, userId)` → `Promise<{success, error?}>`, sacan la invitación de `myInvitations` en éxito.

- [ ] **Step 1: Actualizar/agregar tests en `__tests__/team-store.test.js`**

Actualizar el mock de `services/invitations.js` del test (agregar las 2 funciones nuevas y ajustar `inviteToTeam` para reflejar la firma con payload):

```js
jest.mock('../services/invitations.js', () => ({
  inviteToTeam: jest.fn(),
  listTeamInvitations: jest.fn(),
  listMyInvitations: jest.fn(),
  acceptInvitation: jest.fn(),
  rejectInvitation: jest.fn(),
}));

import {
  inviteToTeam as inviteToTeamService, listTeamInvitations as listTeamInvitationsService,
  listMyInvitations as listMyInvitationsService, acceptInvitation as acceptInvitationService,
  rejectInvitation as rejectInvitationService,
} from '../services/invitations.js';
```

Localizar el test `'sendInvite invites and refetches the pending list'` (del `describe('fetchInvitations / sendInvite', ...)`) y reemplazarlo:

```js
  test('sendInvite invites with the group payload and refetches the pending list', async () => {
    inviteToTeamService.mockResolvedValue({ message: 'Invitación enviada.' });
    listTeamInvitationsService.mockResolvedValue([INVITATION_DTO]);
    const result = await useTeamStore.getState().sendInvite('1', 'a@b.com', '3');
    expect(inviteToTeamService).toHaveBeenCalledWith('1', { email: 'a@b.com', group_id: 3 });
    expect(result).toEqual({ success: true });
    const team = useTeamStore.getState().teams.find((t) => t.id === '1');
    expect(team.invitations).toHaveLength(1);
  });

  test('sendInvite omits group_id when no group is chosen', async () => {
    inviteToTeamService.mockResolvedValue({ message: 'Invitación enviada.' });
    listTeamInvitationsService.mockResolvedValue([]);
    await useTeamStore.getState().sendInvite('1', 'a@b.com', '');
    expect(inviteToTeamService).toHaveBeenCalledWith('1', { email: 'a@b.com' });
  });
```

Agregar `describe` nuevo al final del archivo:

```js
describe('fetchMyInvitations / acceptMyInvitation / rejectMyInvitation', () => {
  const MY_INVITATION_DTO = {
    id: 5, team_id: 1, invitee_email: 'demo@paceron.com', invitee_id: null, invitee_name: null,
    group_id: null, team_name: 'Corredores del Sur', status: 'pending',
    expires_at: '2026-08-07T00:00:00.000Z', created_at: '2026-07-31T00:00:00.000Z',
  };

  beforeEach(() => {
    useTeamStore.setState({ myInvitations: [] });
  });

  test('fetchMyInvitations lists and normalizes the current user\'s pending invitations', async () => {
    listMyInvitationsService.mockResolvedValue([MY_INVITATION_DTO]);
    const result = await useTeamStore.getState().fetchMyInvitations(1, 'demo@paceron.com');
    expect(listMyInvitationsService).toHaveBeenCalledWith(1, 'demo@paceron.com');
    expect(result).toEqual({ success: true });
    expect(useTeamStore.getState().myInvitations).toEqual([{
      id: '5', teamId: '1', email: 'demo@paceron.com', inviteeId: null, inviteeName: null,
      groupId: null, teamName: 'Corredores del Sur', status: 'pending',
      expiresAt: '2026-08-07T00:00:00.000Z', createdAt: '2026-07-31T00:00:00.000Z',
    }]);
  });

  test('fetchMyInvitations returns a failure result when the service call rejects', async () => {
    listMyInvitationsService.mockRejectedValue(new Error('Sin conexión.'));
    const result = await useTeamStore.getState().fetchMyInvitations(1, 'demo@paceron.com');
    expect(result).toEqual({ success: false, error: 'Sin conexión.' });
  });

  test('acceptMyInvitation removes the invitation from myInvitations on success', async () => {
    useTeamStore.setState({ myInvitations: [{ id: '5', teamId: '1' }] });
    acceptInvitationService.mockResolvedValue({ message: 'Invitación aceptada.' });
    const result = await useTeamStore.getState().acceptMyInvitation('5', 1);
    expect(acceptInvitationService).toHaveBeenCalledWith('5', 1);
    expect(result).toEqual({ success: true });
    expect(useTeamStore.getState().myInvitations).toEqual([]);
  });

  test('acceptMyInvitation returns a failure result and keeps the invitation when the service call rejects', async () => {
    useTeamStore.setState({ myInvitations: [{ id: '5', teamId: '1' }] });
    acceptInvitationService.mockRejectedValue(new Error('Invitación vencida.'));
    const result = await useTeamStore.getState().acceptMyInvitation('5', 1);
    expect(result).toEqual({ success: false, error: 'Invitación vencida.' });
    expect(useTeamStore.getState().myInvitations).toHaveLength(1);
  });

  test('rejectMyInvitation removes the invitation from myInvitations on success', async () => {
    useTeamStore.setState({ myInvitations: [{ id: '5', teamId: '1' }] });
    rejectInvitationService.mockResolvedValue({ message: 'Invitación rechazada.' });
    const result = await useTeamStore.getState().rejectMyInvitation('5', 1);
    expect(rejectInvitationService).toHaveBeenCalledWith('5', 1);
    expect(result).toEqual({ success: true });
    expect(useTeamStore.getState().myInvitations).toEqual([]);
  });
});
```

- [ ] **Step 2: Correr los tests y confirmar que fallan**

Run: `npx jest team-store.test.js`
Expected: FAIL — `sendInvite` todavía llama al servicio con `(teamId, email)` en vez de `(teamId, payload)`, `fetchMyInvitations`/`acceptMyInvitation`/`rejectMyInvitation` no existen, `myInvitations` no existe en el estado inicial.

- [ ] **Step 3: Implementar en `store/team-store.js`**

Actualizar los imports del principio del archivo:

```js
import { inviteToTeam as inviteToTeamService, listTeamInvitations as listTeamInvitationsService, listMyInvitations as listMyInvitationsService, acceptInvitation as acceptInvitationService, rejectInvitation as rejectInvitationService } from '../services/invitations.js';
import { toTeamModel, toCreateTeamPayload, toUpdateTeamPayload, toAddressPayload, toGroupModel, toCreateGroupPayload, toUpdateGroupPayload, toInvitationModel, toInvitePayload } from '../services/normalizers.js';
```

Agregar `myInvitations: [],` al estado inicial del store (junto a `teams: [],` / `selectedTeamId: null,`):

```js
export const useTeamStore = create((set, get) => ({
  teams: [],
  selectedTeamId: null,
  myInvitations: [],
```

Reemplazar `sendInvite`:

```js
  // Manda una invitación real (POST /teams/{id}/invite, con group_id
  // opcional — ver docs/BACKEND_API_GAPS.md gap 9, resuelto 2026-07-31) y
  // re-trae el listado para reflejarla. La respuesta del POST no trae el
  // id de la invitación creada, no hay nada que insertar localmente sin
  // el refetch.
  sendInvite: async (teamId, email, groupId) => {
    try {
      await inviteToTeamService(teamId, toInvitePayload(email, groupId));
      await get().fetchInvitations(teamId);
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  },
```

Agregar estas tres acciones nuevas, después de `sendInvite`:

```js
  // Trae las invitaciones pendientes del usuario actual (GET
  // /invitations?user_id=, gap 8 resuelto 2026-07-31). `email` solo lo usa
  // el mock (ver services/invitations.js) — el backend real ignora ese
  // parámetro, solo filtra por user_id.
  fetchMyInvitations: async (userId, email) => {
    try {
      const dtos = await listMyInvitationsService(userId, email);
      set({ myInvitations: dtos.map((dto) => toInvitationModel(dto)) });
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  },

  // Acepta una invitación recibida (POST /invitations/{id}/accept) y la
  // saca de myInvitations en éxito.
  acceptMyInvitation: async (invitationId, userId) => {
    try {
      await acceptInvitationService(invitationId, userId);
      set((state) => ({ myInvitations: state.myInvitations.filter((i) => i.id !== invitationId) }));
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  },

  // Rechaza una invitación recibida (POST /invitations/{id}/reject) y la
  // saca de myInvitations en éxito.
  rejectMyInvitation: async (invitationId, userId) => {
    try {
      await rejectInvitationService(invitationId, userId);
      set((state) => ({ myInvitations: state.myInvitations.filter((i) => i.id !== invitationId) }));
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  },
```

- [ ] **Step 4: Correr los tests y confirmar que pasan**

Run: `npx jest team-store.test.js`
Expected: PASS — toda la suite del archivo.

- [ ] **Step 5: Correr toda la suite y lint**

Run: `npm test && npm run lint`
Expected: PASS / sin errores.

- [ ] **Step 6: Commit**

```bash
git add store/team-store.js __tests__/team-store.test.js
git commit -m "feat(teams): sendInvite accepts a group, add fetchMyInvitations/accept/reject"
```

---

### Task 4: `InlinePicker` — rama web propia

**Files:**
- Modify: `components/forms/fields.jsx`

**Interfaces:**
- Consumes: nada de tareas anteriores (componente compartido, independiente).

**Contexto:** este componente quedó sin consumidores en la etapa anterior (se sacó el único uso al eliminar el picker de grupo al invitar) y por eso no se le agregó rama web en su momento. Ahora que la Task 5 le devuelve un consumidor real, corresponde agregarla — mismo patrón que `DateField` ya usa en este archivo (rama `if (isWeb) { return <select> compacto }`, el resto (modal) queda para mobile).

- [ ] **Step 1: Modificar `InlinePicker`**

Localizar `export function InlinePicker({ scope, value, onChange, options, placeholder = 'Elegir', widthClass = 'max-w-[128px]' }) {` y agregar, justo después de la línea `const selected = items.find((item) => item.id === value);` (antes del `return (`):

```js
  if (isWeb) {
    return (
      <select
        className={`h-12 ${widthClass} rounded-xl border border-slate-200 bg-slate-50 px-3 text-xs text-slate-900 outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-white`}
        onChange={(e) => onChange(e.target.value)}
        value={value}
      >
        <option value="">{placeholder}</option>
        {items.map((item) => (
          <option key={item.id} value={item.id}>{item.name}</option>
        ))}
      </select>
    );
  }
```

Confirmar que `isWeb` ya está importado al principio del archivo (`import { isWeb } from '../../utils/platform.js';` — ya lo usa `DateField` en el mismo archivo, debería estar).

- [ ] **Step 2: Correr toda la suite y lint**

Run: `npm test && npm run lint`
Expected: PASS / sin errores (este archivo no tiene tests unitarios propios — es un componente visual, el repo no testea render de componentes).

- [ ] **Step 3: Commit**

```bash
git add components/forms/fields.jsx
git commit -m "feat(forms): add web branch to InlinePicker"
```

---

### Task 5: `EmailListField` — reintroducir selección de grupo

**Files:**
- Modify: `components/forms/fields.jsx`

**Interfaces:**
- Consumes: `InlinePicker` (con rama web, Task 4).
- Produces: `EmailListField({label, value, onChange, placeholder, groups})` — `value` vuelve a ser `[{email, groupId}]`. `groups` es opcional (si no se pasa o viene vacío, no se muestra el picker — mismo comportamiento que antes de la Etapa 3).

- [ ] **Step 1: Reemplazar `EmailListField`**

Localizar el bloque completo desde el comentario `// Junta una lista de emails validos...` hasta el cierre de la función `EmailListField` y reemplazarlo por:

```js
const NO_GROUP_ID = '';
const NO_GROUP_LABEL = 'Sin grupo';

// Junta una lista de emails validos, uno por uno (ej. invitar gente a un
// equipo antes de que exista, o desde la pantalla de invitar de un equipo
// ya existente), cada uno con el grupo al que se invita — value es
// [{ email, groupId }]. Sin grupo elegido, groupId queda '' — el backend
// asigna el grupo principal del equipo por default (ver
// docs/BACKEND_API_GAPS.md gap 9, resuelto 2026-07-31). `groups` es
// opcional: sin ese prop (o vacío) no se muestra el picker de grupo, para
// los casos donde no aplica.
export function EmailListField({ label, value = [], onChange, placeholder = 'nombre@email.com', groups = [] }) {
  const colors = useThemeColors();
  const slug = slugify(label);
  const [draft, setDraft] = useState('');
  const [draftGroupId, setDraftGroupId] = useState(NO_GROUP_ID);
  const [draftError, setDraftError] = useState(null);

  const groupOptions = [{ id: NO_GROUP_ID, name: NO_GROUP_LABEL }, ...groups];

  const handleAdd = () => {
    const email = draft.trim();
    if (!email) return;
    if (!validateEmailFormat(email)) {
      setDraftError('Email inválido');
      return;
    }
    if (value.some((e) => e.email.toLowerCase() === email.toLowerCase())) {
      setDraftError('Ya agregaste ese email');
      return;
    }
    onChange([...value, { email, groupId: draftGroupId }]);
    setDraft('');
    setDraftGroupId(NO_GROUP_ID);
    setDraftError(null);
  };

  const handleRemove = (email) => {
    onChange(value.filter((e) => e.email !== email));
  };

  return (
    <View className="mb-5" nativeID={`email-list-field-${slug}`} testID={`email-list-field-${slug}`}>
      <Text className={FIELD_LABEL} nativeID={`email-list-field-${slug}-label`} testID={`email-list-field-${slug}-label`}>{label}</Text>

      <View className="flex-row items-center gap-2" nativeID={`email-list-field-${slug}-row`} testID={`email-list-field-${slug}-row`}>
        <View
          className={`h-12 flex-1 flex-row items-center rounded-xl border ${
            draftError ? 'border-red-400 bg-red-50 dark:border-red-800 dark:bg-slate-900' : 'border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-900'
          }`}
          nativeID={`email-list-field-${slug}-input-wrapper`}
          testID={`email-list-field-${slug}-input-wrapper`}
        >
          <TextInput
            autoCapitalize="none"
            className={INPUT_CLASS}
            keyboardType="email-address"
            onChangeText={(text) => { setDraft(text); if (draftError) setDraftError(null); }}
            onSubmitEditing={handleAdd}
            placeholder={placeholder}
            placeholderTextColor={colors.onSurfaceVariant}
            returnKeyType="done"
            value={draft}
            nativeID={`email-list-field-${slug}-input`}
            testID={`email-list-field-${slug}-input`}
          />
        </View>

        {groups.length > 0 && (
          <InlinePicker
            onChange={setDraftGroupId}
            options={groupOptions}
            placeholder={NO_GROUP_LABEL}
            scope={`${slug}-invite-group`}
            value={draftGroupId}
            widthClass="max-w-[112px]"
          />
        )}

        <Pressable
          className="h-12 w-12 items-center justify-center rounded-xl bg-primary hover:opacity-90 active:opacity-80"
          accessibilityLabel="Agregar email"
          nativeID={`email-list-field-${slug}-add-button`}
          onPress={handleAdd}
          testID={`email-list-field-${slug}-add-button`}
        >
          <MaterialCommunityIcons color={colors.onPrimary} name="plus" size={20} />
        </Pressable>
      </View>

      <View className="h-5" nativeID={`email-list-field-${slug}-error-row`} testID={`email-list-field-${slug}-error-row`}>
        {draftError && <Text className="text-xs text-red-500 dark:text-red-400" nativeID={`email-list-field-${slug}-error`} testID={`email-list-field-${slug}-error`}>{draftError}</Text>}
      </View>

      {value.length > 0 && (
        <View className="flex-row flex-wrap gap-2" nativeID={`email-list-field-${slug}-chips`} testID={`email-list-field-${slug}-chips`}>
          {value.map((invite) => {
            const chipSlug = slugify(invite.email);
            const groupName = groupOptions.find((g) => g.id === invite.groupId)?.name ?? NO_GROUP_LABEL;
            return (
              <View
                key={invite.email}
                className="flex-row items-center gap-1.5 rounded-full bg-primary-tint-subtle px-3 py-1.5 dark:bg-primary/10"
                nativeID={`email-list-field-${slug}-chip-${chipSlug}`}
                testID={`email-list-field-${slug}-chip-${chipSlug}`}
              >
                <Text
                  className="text-xs font-medium text-on-primary-tint dark:text-primary"
                  nativeID={`email-list-field-${slug}-chip-${chipSlug}-label`}
                  testID={`email-list-field-${slug}-chip-${chipSlug}-label`}
                >
                  {groups.length > 0 ? `${invite.email} · ${groupName}` : invite.email}
                </Text>
                <Pressable
                  accessibilityLabel={`Quitar ${invite.email}`}
                  onPress={() => handleRemove(invite.email)}
                  nativeID={`email-list-field-${slug}-chip-${chipSlug}-remove-button`}
                  testID={`email-list-field-${slug}-chip-${chipSlug}-remove-button`}
                >
                  <MaterialCommunityIcons color={colors.onSurfaceVariant} name="close" size={14} />
                </Pressable>
              </View>
            );
          })}
        </View>
      )}
    </View>
  );
}
```

- [ ] **Step 2: Correr toda la suite y lint**

Run: `npm test && npm run lint`
Expected: PASS / sin errores.

- [ ] **Step 3: Commit**

```bash
git add components/forms/fields.jsx
git commit -m "feat(forms): EmailListField supports group selection again (backend accepts group_id now)"
```

---

### Task 6: `invite-team-members-screen.jsx` — grupo al invitar y en la lista de pendientes

**Files:**
- Modify: `components/team/invite-team-members-screen.jsx`

**Interfaces:**
- Consumes: `EmailListField` con `groups` (Task 5), `sendInvite(teamId, email, groupId)` (Task 3), `fetchGroups` (ya existe en el store desde Etapa 2).

- [ ] **Step 1: Reintroducir `fetchGroups`**

`fetchGroups(teamId, userId)` (ya existe en el store desde Etapa 2) reenvía `userId` al query real `GET /groups?team_id&user_id` — necesita el id real del usuario actual, no un placeholder. Agregar el import de `useAuthStore` (junto a los imports existentes):

```js
import { useAuthStore } from '../../store/auth-store.js';
```

Agregar los selectores/estado nuevos, junto a los ya existentes (`team`, `fetchTeam`, `fetchInvitations`, `sendInvite`):

```js
  const user = useAuthStore((s) => s.user);
  const fetchGroups = useTeamStore((s) => s.fetchGroups);
```

Agregar el estado y el efecto de fetch, junto al `useEffect` de `fetchInvitations` ya existente:

```js
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

Actualizar el guard de loading:

```js
  if (loadingTeam || loadingInvitations || loadingGroups) {
```

- [ ] **Step 2: Pasar `groups` a `EmailListField` y `groupId` a `sendInvite`**

Reemplazar:

```jsx
          <EmailListField label="Email del corredor" onChange={setDraftInvites} value={draftInvites} />
```

por:

```jsx
          <EmailListField groups={team.groups} label="Email del corredor" onChange={setDraftInvites} value={draftInvites} />
```

Reemplazar el loop de `handleSendInvites`:

```js
    for (const invite of draftInvites) {
      const result = await sendInvite(teamId, invite.email);
      if (!result.success) failed += 1;
    }
```

por:

```js
    for (const invite of draftInvites) {
      const result = await sendInvite(teamId, invite.email, invite.groupId);
      if (!result.success) failed += 1;
    }
```

- [ ] **Step 3: Mostrar el grupo en `PendingInviteRow`**

Reemplazar la función `PendingInviteRow` completa:

```jsx
function PendingInviteRow({ groupName, invite }) {
  const slug = invite.email.replace(/[^a-z0-9]+/gi, '-');

  return (
    <View
      className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-700 dark:bg-slate-900"
      nativeID={`invite-pending-${slug}`}
      testID={`invite-pending-${slug}`}
    >
      <Text className="text-sm font-semibold text-slate-900 dark:text-white" nativeID={`invite-pending-${slug}-email`} numberOfLines={1} testID={`invite-pending-${slug}-email`}>
        {invite.email}
      </Text>
      <Text className="text-xs text-slate-500 dark:text-slate-400" nativeID={`invite-pending-${slug}-meta`} testID={`invite-pending-${slug}-meta`}>
        {groupName ? `${groupName} · ` : ''}Invitado {formatRelativeTime(invite.createdAt).toLowerCase()}
      </Text>
    </View>
  );
}
```

Reemplazar el call site:

```jsx
              {team.invitations.map((invite) => (
                <PendingInviteRow invite={invite} key={invite.id} />
              ))}
```

por:

```jsx
              {team.invitations.map((invite) => (
                <PendingInviteRow groupName={team.groups.find((g) => g.id === invite.groupId)?.name} invite={invite} key={invite.id} />
              ))}
```

- [ ] **Step 4: Correr toda la suite y lint**

Run: `npm test && npm run lint`
Expected: PASS / sin errores.

- [ ] **Step 5: Commit**

```bash
git add components/team/invite-team-members-screen.jsx
git commit -m "feat(teams): invite screen supports choosing a group again"
```

---

### Task 7: `create-team-screen.jsx` — grupo al invitar en el wizard, remapeo por nombre

**Files:**
- Modify: `components/team/create-team-screen.jsx`

**Interfaces:**
- Consumes: `EmailListField` con `groups` (Task 5), `sendInvite(teamId, email, groupId)` (Task 3).

- [ ] **Step 1: Restaurar `handleRemoveGroup` y pasar `onRemove` a `GroupListEditor`**

Agregar, después de `const [invitedEmails, setInvitedEmails] = useState([]);`:

```js
  // Si se saca un grupo que ya tenia invitaciones asignadas, esas
  // invitaciones vuelven a "Sin grupo" en vez de quedar apuntando a un
  // grupo que ya no existe.
  const handleRemoveGroup = (groupId) => {
    setInvitedEmails((prev) => prev.map((invite) => (invite.groupId === groupId ? { ...invite, groupId: '' } : invite)));
  };
```

Reemplazar:

```jsx
            <GroupListEditor groups={groups} onChange={setGroups} planOptions={TRAINING_PLAN_OPTIONS} />
```

por:

```jsx
            <GroupListEditor groups={groups} onChange={setGroups} onRemove={handleRemoveGroup} planOptions={TRAINING_PLAN_OPTIONS} />
```

- [ ] **Step 2: Pasar `groups` a `EmailListField`**

Reemplazar:

```jsx
            <EmailListField label="Invitar corredores por email" onChange={setInvitedEmails} value={invitedEmails} />
```

por:

```jsx
            <EmailListField groups={groups} label="Invitar corredores por email" onChange={setInvitedEmails} value={invitedEmails} />
```

- [ ] **Step 3: Remapear `groupId` de draft a real antes de invitar**

Reemplazar el bloque de invitaciones dentro de `handleSubmit`:

```js
    let inviteFailures = 0;
    for (const invite of invitedEmails) {
      const inviteResult = await sendInvite(result.team.id, invite.email);
      if (!inviteResult.success) inviteFailures += 1;
    }
    setSubmitting(false);
```

por:

```js
    const draftGroupNameById = new Map(groups.map((g) => [g.id, g.name]));
    let inviteFailures = 0;
    for (const invite of invitedEmails) {
      const draftName = draftGroupNameById.get(invite.groupId);
      const realGroup = draftName ? result.team.groups.find((g) => g.name === draftName) : null;
      const inviteResult = await sendInvite(result.team.id, invite.email, realGroup?.id);
      if (!inviteResult.success) inviteFailures += 1;
    }
    setSubmitting(false);
```

- [ ] **Step 4: Correr toda la suite y lint**

Run: `npm test && npm run lint`
Expected: PASS / sin errores.

- [ ] **Step 5: Commit**

```bash
git add components/team/create-team-screen.jsx
git commit -m "feat(teams): create-team wizard remaps draft group ids to real ones when inviting"
```

---

### Task 8: Pantalla de invitaciones recibidas + nav entry

**Files:**
- Create: `components/invitations/received-invitations-screen.jsx`
- Create: `app/(tabs)/invitations/index.jsx`
- Modify: `routes/catalog.js`
- Test: `__tests__/routes.catalog.test.js`

**Interfaces:**
- Consumes: `fetchMyInvitations(userId, email)`, `acceptMyInvitation(invitationId, userId)`, `rejectMyInvitation(invitationId, userId)` de la Task 3. `RequireAuth` (ya existe).

- [ ] **Step 1: Agregar la ruta al catálogo**

En `routes/catalog.js`, agregar después de `teamsRoute`:

```js
export const invitationsRoute = {
  name: 'invitations',
  label: 'Invitaciones',
  href: '/invitations',
  icon: 'email-outline',
};
```

Actualizar `navigationRoutes`:

```js
export const navigationRoutes = [homeRoute, teamsRoute, invitationsRoute];
```

- [ ] **Step 2: Test del catálogo**

Agregar a `__tests__/routes.catalog.test.js`:

```js
describe('invitationsRoute', () => {
  test('uses the English route key and href', () => {
    expect(invitationsRoute.name).toBe('invitations');
    expect(invitationsRoute.href).toBe('/invitations');
  });
});
```

Actualizar el import del principio del archivo agregando `invitationsRoute`.

- [ ] **Step 3: Crear `components/invitations/received-invitations-screen.jsx`**

```jsx
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import Toast from 'react-native-toast-message';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useThemeColors } from '../../theme/colors.js';
import { isWeb } from '../../utils/platform.js';
import { useAuthStore } from '../../store/auth-store.js';
import { useTeamStore } from '../../store/team-store.js';
import { formatRelativeTime } from '../../utils/relative-time.js';
import { SectionCard } from '../forms/section-card.jsx';
import { RequireAuth } from '../guards/require-auth.jsx';

// Sin nombre de grupo: InvitationResponse trae group_id pero no
// group_name, y el invitado no puede resolverlo contra GET /groups (esa
// ruta valida membresía, que todavía no tiene). Ver
// docs/BACKEND_API_GAPS.md gap 9 y la decisión del usuario (2026-07-31):
// se muestra solo equipo + fecha, sin inventar un nombre de grupo.
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
        Invitado {formatRelativeTime(invite.createdAt).toLowerCase()}
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

function ReceivedInvitationsScreenContent() {
  const router = useRouter();
  const colors = useThemeColors();
  const user = useAuthStore((s) => s.user);
  const myInvitations = useTeamStore((s) => s.myInvitations);
  const fetchMyInvitations = useTeamStore((s) => s.fetchMyInvitations);
  const acceptMyInvitation = useTeamStore((s) => s.acceptMyInvitation);
  const rejectMyInvitation = useTeamStore((s) => s.rejectMyInvitation);

  const [loading, setLoading] = useState(true);
  const [respondingId, setRespondingId] = useState(null);

  useEffect(() => {
    if (!user?.userId) return undefined;
    let cancelled = false;
    setLoading(true);
    fetchMyInvitations(user.userId, user.email).finally(() => { if (!cancelled) setLoading(false); });
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
      nativeID="received-invitations-screen-scroll"
      showsVerticalScrollIndicator={false}
      testID="received-invitations-screen-scroll"
    >
      <View className={`w-full self-center ${isWeb ? 'max-w-3xl' : ''}`} nativeID="received-invitations-screen-container" testID="received-invitations-screen-container">
        <View className="mb-8 flex-row items-center gap-2" nativeID="received-invitations-screen-header" testID="received-invitations-screen-header">
          <Pressable
            className="flex-row items-center gap-1.5 py-1 pr-1 hover:opacity-70 active:opacity-70"
            nativeID="received-invitations-screen-back-button"
            onPress={() => router.back()}
            testID="received-invitations-screen-back-button"
          >
            <MaterialCommunityIcons color={colors.onSurfaceVariant} name="arrow-left" size={18} />
          </Pressable>
          <Text className="text-xl text-slate-900 dark:text-white" nativeID="received-invitations-screen-title" style={{ fontFamily: 'Orbitron_700Bold' }} testID="received-invitations-screen-title">
            Invitaciones recibidas
          </Text>
        </View>

        <SectionCard icon="email-outline" title="Solicitudes pendientes">
          {loading ? (
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
      </View>
    </ScrollView>
  );
}

export function ReceivedInvitationsScreen() {
  return (
    <RequireAuth>
      <ReceivedInvitationsScreenContent />
    </RequireAuth>
  );
}
```

- [ ] **Step 4: Crear la ruta `app/(tabs)/invitations/index.jsx`**

```jsx
import { ReceivedInvitationsScreen } from '../../../components/invitations/received-invitations-screen.jsx';

export default function InvitationsIndex() {
  return <ReceivedInvitationsScreen />;
}
```

- [ ] **Step 5: Correr toda la suite y lint**

Run: `npm test && npm run lint`
Expected: PASS / sin errores.

- [ ] **Step 6: Commit**

```bash
git add routes/catalog.js __tests__/routes.catalog.test.js components/invitations/received-invitations-screen.jsx "app/(tabs)/invitations/index.jsx"
git commit -m "feat(invitations): add received-invitations screen and nav entry"
```

---

## Después de este plan

Con esto, gaps 8 y 9 quedan resueltos de punta a punta (backend + frontend). Actualizar `docs/BACKEND_API_GAPS.md` marcando ambos como RESUELTO (tarea de documentación, no ameritó su propia tarea en este plan — hacerlo directo antes del push final). Etapa 3 (Invitaciones) queda completamente cerrada, sin gaps de backend pendientes conocidos para equipos/grupos/invitaciones salvo 3 (foto) y 4 (plan de entrenamiento en grupo), ambos de baja prioridad ya documentados.
