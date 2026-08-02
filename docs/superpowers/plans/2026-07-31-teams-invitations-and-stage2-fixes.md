# Equipos: invitaciones reales (Etapa 3) + fixes de QA de Etapa 2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Conectar invitaciones de equipo contra el backend real (lado dueño de equipo) y resolver 5 bugs/mejoras de UX reportados tras el QA manual de Etapa 2.

**Architecture:** Mismo patrón `services/` + normalizers + acciones async en `store/team-store.js` ya usado en Etapas 1/2. Los fixes de QA son cambios acotados y en su mayoría independientes entre sí y de la parte de invitaciones.

**Tech Stack:** Zustand, Expo Router, NativeWind, Jest.

## Global Constraints

- La selección de grupo al invitar se SACA por completo (wizard y pantalla dedicada) — `POST /teams/{id}/invite` solo acepta `email`, `GET /teams/{id}/invitations` no devuelve `group_id` (ver `docs/BACKEND_API_GAPS.md` gap 9). No reintroducir ningún picker de grupo en el flujo de invitar.
- La pantalla de "invitaciones recibidas" (lado invitado) NO se implementa en este plan — gap 8 de `docs/BACKEND_API_GAPS.md`, sin endpoint.
- **Sin verificación en browser por parte de los subagentes** (decisión del usuario, 2026-07-31) — cada tarea termina en código + tests unitarios (donde el repo los tiene) + `npm run lint`, nada de `preview_*`. Al final del plan completo se entrega al usuario un script de prueba manual escrito.
- Modelos: usar el nivel más barato que alcance para cada rol (implementer Y reviewer) — haiku para tareas mecánicas con código completo en el brief, sonnet para las que integran varios archivos o requieren juicio, el modelo más capaz solo para el review final de rama completa.
- Todo elemento visual nuevo lleva `nativeID`/`testID` únicos (regla de `eslint.config.js#require-native-id`, sin excepción).
- `npm test` y `npm run lint` en verde después de cada tarea.

---

### Task 1: Normalizer de invitación

**Files:**
- Modify: `services/normalizers.js`
- Test: `__tests__/normalizers.test.js`

**Interfaces:**
- Produces: `toInvitationModel(dto)` → `{id: string, teamId: string, email: string, inviteeId: number|null, inviteeName: string|null, status: string, expiresAt: string, createdAt: string}` (o `null` si `dto` es falsy).

- [ ] **Step 1: Escribir los tests que fallan**

Agregar el import de `toInvitationModel` al principio de `__tests__/normalizers.test.js` (sumar al import existente de `services/normalizers.js`), y al final del archivo:

```js
describe('toInvitationModel', () => {
  test('maps snake_case fields to camelCase and coerces ids to string', () => {
    const dto = {
      id: 10, team_id: 1, invitee_email: 'a@b.com', invitee_id: 5, invitee_name: 'Pepe Lota',
      status: 'pending', expires_at: '2026-08-01T00:00:00.000Z', created_at: '2026-07-31T00:00:00.000Z',
    };
    expect(toInvitationModel(dto)).toEqual({
      id: '10', teamId: '1', email: 'a@b.com', inviteeId: 5, inviteeName: 'Pepe Lota',
      status: 'pending', expiresAt: '2026-08-01T00:00:00.000Z', createdAt: '2026-07-31T00:00:00.000Z',
    });
  });

  test('returns null for falsy dto', () => {
    expect(toInvitationModel(null)).toBeNull();
    expect(toInvitationModel(undefined)).toBeNull();
  });
});
```

- [ ] **Step 2: Correr los tests y confirmar que fallan**

Run: `npx jest normalizers.test.js`
Expected: FAIL — `toInvitationModel is not a function`.

- [ ] **Step 3: Implementar en `services/normalizers.js`**

Agregar al final del archivo:

```js
export function toInvitationModel(dto) {
  if (!dto) return null;
  return {
    id: String(dto.id),
    teamId: String(dto.team_id),
    email: dto.invitee_email,
    inviteeId: dto.invitee_id,
    inviteeName: dto.invitee_name,
    status: dto.status,
    expiresAt: dto.expires_at,
    createdAt: dto.created_at,
  };
}
```

- [ ] **Step 4: Correr los tests y confirmar que pasan**

Run: `npx jest normalizers.test.js`
Expected: PASS, todos los tests del archivo.

- [ ] **Step 5: Commit**

```bash
git add services/normalizers.js __tests__/normalizers.test.js
git commit -m "feat(teams): add invitation normalizer"
```

---

### Task 2: `services/invitations.js` + mock

**Files:**
- Create: `services/invitations.js`
- Create: `services/__mocks__/invitations-mock.js`
- Test: `__tests__/invitations-mock.test.js`

**Interfaces:**
- Produces: `inviteToTeam(teamId, email)`, `listTeamInvitations(teamId)`, `acceptInvitation(invitationId, userId)`, `rejectInvitation(invitationId, userId)` — todas `async`, devuelven el DTO (o array de DTOs) crudo del backend/mock. Mock exporta además `__resetMockInvitations()`.

- [ ] **Step 1: Escribir el test que falla**

Crear `__tests__/invitations-mock.test.js`:

```js
import {
  mockInviteToTeam, mockListTeamInvitations, mockAcceptInvitation, mockRejectInvitation, __resetMockInvitations,
} from '../services/__mocks__/invitations-mock.js';

beforeEach(() => {
  __resetMockInvitations();
});

describe('invitations-mock', () => {
  test('mockInviteToTeam creates a pending invitation scoped to the team', async () => {
    const result = await mockInviteToTeam('7', 'a@b.com');
    expect(result).toEqual({ message: 'Invitación enviada.' });
    const invitations = await mockListTeamInvitations('7');
    expect(invitations).toHaveLength(1);
    expect(invitations[0]).toMatchObject({ team_id: 7, invitee_email: 'a@b.com', status: 'pending' });
  });

  test('mockListTeamInvitations only returns pending invitations for the requested team', async () => {
    await mockInviteToTeam('7', 'a@b.com');
    await mockInviteToTeam('8', 'b@b.com');
    const invitations = await mockListTeamInvitations('7');
    expect(invitations).toHaveLength(1);
    expect(invitations[0].team_id).toBe(7);
  });

  test('mockAcceptInvitation marks the invitation accepted, removing it from the pending list', async () => {
    await mockInviteToTeam('7', 'a@b.com');
    const [invitation] = await mockListTeamInvitations('7');
    const result = await mockAcceptInvitation(invitation.id, 42);
    expect(result).toEqual({ message: 'Invitación aceptada.' });
    expect(await mockListTeamInvitations('7')).toEqual([]);
  });

  test('mockRejectInvitation marks the invitation rejected, removing it from the pending list', async () => {
    await mockInviteToTeam('7', 'a@b.com');
    const [invitation] = await mockListTeamInvitations('7');
    const result = await mockRejectInvitation(invitation.id, 42);
    expect(result).toEqual({ message: 'Invitación rechazada.' });
    expect(await mockListTeamInvitations('7')).toEqual([]);
  });

  test('mockAcceptInvitation throws for an unknown id', async () => {
    await expect(mockAcceptInvitation(999999, 1)).rejects.toThrow();
  });
});
```

- [ ] **Step 2: Correr el test y confirmar que falla**

Run: `npx jest invitations-mock.test.js`
Expected: FAIL — no puede resolver `../services/__mocks__/invitations-mock.js`.

- [ ] **Step 3: Crear `services/__mocks__/invitations-mock.js`**

```js
// Estado in-memory con la MISMA shape snake_case que el backend real (para
// que toInvitationModel() funcione igual en ambas ramas) — mismo patrón
// stateful que groups-mock.js. expires_at se calcula a 7 días desde el
// envío (el backend no documenta el plazo exacto en el swagger, 7 días es
// un valor razonable solo para que el mock tenga algo consistente).
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

export async function mockInviteToTeam(teamId, email) {
  const now = new Date().toISOString();
  const expires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
  const invitation = {
    id: nextInvitationId++, team_id: Number(teamId), invitee_email: email, invitee_id: null,
    invitee_name: null, status: 'pending', expires_at: expires, created_at: now,
  };
  mockInvitations.push(invitation);
  return { message: 'Invitación enviada.' };
}

export async function mockListTeamInvitations(teamId) {
  return mockInvitations.filter((i) => String(i.team_id) === String(teamId) && i.status === 'pending');
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

- [ ] **Step 4: Crear `services/invitations.js`**

```js
import api from './api.js';
import { USE_MOCKS } from '../config/env.js';
import {
  mockInviteToTeam,
  mockListTeamInvitations,
  mockAcceptInvitation,
  mockRejectInvitation,
} from './__mocks__/invitations-mock.js';

// POST /api/v1/teams/{id}/invite — invitation.InviteRunnerRequest, solo
// acepta email (ver docs/BACKEND_API_GAPS.md gap 9 — no acepta grupo).
export async function inviteToTeam(teamId, email) {
  if (USE_MOCKS) return await mockInviteToTeam(teamId, email);
  return await api.post(`/teams/${teamId}/invite`, { email });
}

// GET /api/v1/teams/{id}/invitations — invitaciones pendientes del equipo.
export async function listTeamInvitations(teamId) {
  if (USE_MOCKS) return await mockListTeamInvitations(teamId);
  return await api.get(`/teams/${teamId}/invitations`);
}

// POST /api/v1/invitations/{id}/accept — invitation.RespondInvitationRequest.
// Sin consumidor en la UI de esta etapa (ver docs/BACKEND_API_GAPS.md gap 8
// — sin forma de listar las invitaciones de un invitado) — se agrega igual
// como espejo 1:1 barato del contrato ya documentado.
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

- [ ] **Step 5: Correr los tests y confirmar que pasan**

Run: `npx jest invitations-mock.test.js`
Expected: PASS, todos los tests.

- [ ] **Step 6: Correr lint**

Run: `npm run lint`
Expected: sin errores.

- [ ] **Step 7: Commit**

```bash
git add services/invitations.js services/__mocks__/invitations-mock.js __tests__/invitations-mock.test.js
git commit -m "feat(teams): add invitations service layer with mock"
```

---

### Task 3: `store/team-store.js` — sacar el sistema de invitaciones sintético, agregar `fetchInvitations`/`sendInvite`

**Files:**
- Modify: `store/team-store.js`
- Test: `__tests__/team-store.test.js`

**Interfaces:**
- Consumes: `listTeamInvitations`/`inviteToTeam` de `services/invitations.js` (Task 2), `toInvitationModel` de `services/normalizers.js` (Task 1).
- Produces: `fetchInvitations(teamId)` → `Promise<{success, error?}>`, deja `team.invitations` (array normalizado) actualizado. `sendInvite(teamId, email)` → `Promise<{success, error?}>`, en éxito re-fetchea `team.invitations`.

**Nota para el implementador:** esta tarea también SIMPLIFICA `createTeam` — hoy tiene lógica de remapeo de `payload.invitedEmails` (ids de grupo draft → reales) que deja de existir porque invitar ya no pasa por `createTeam` (ver Task 6). Sacar esa lógica entera, no solo agregar las funciones nuevas.

- [ ] **Step 1: Actualizar los tests existentes que fallan / escribir los nuevos**

En `__tests__/team-store.test.js`, agregar `inviteToTeam`/`listTeamInvitations` al mock de servicios (nuevo bloque, junto a los de `services/teams.js`/`services/groups.js` ya existentes):

```js
jest.mock('../services/invitations.js', () => ({
  inviteToTeam: jest.fn(),
  listTeamInvitations: jest.fn(),
}));

import { inviteToTeam as inviteToTeamService, listTeamInvitations as listTeamInvitationsService } from '../services/invitations.js';
```

Localizar y **borrar** estos tests existentes (ya no aplican, la funcionalidad que cubrían se elimina en este paso):
- `'createTeam calls the service, decorates the response, appends and selects it'` (usa `payload.groups`/`payload.invitedEmails` para armar invitaciones — reemplazar por la versión de abajo, sin `invitedEmails`)
- `'createTeam creates the extra draft groups against the backend and remaps invite groupIds by name'` — la parte de remapeo de invitedEmails ya no aplica; el resto (creación de grupos extra) se conserva, ver versión de abajo
- `'createTeam falls back invites without a chosen group to the real default group'`

Reemplazar el primero por (mismo nombre de test, sin `invitedEmails`):

```js
  test('createTeam calls the service, decorates the response, appends and selects it', async () => {
    createTeamService.mockResolvedValue(TEAM_DTO);
    listGroupsService.mockResolvedValue([DEFAULT_GROUP_DTO]);
    const result = await useTeamStore.getState().createTeam({
      name: 'Fondistas del Oeste', maxMembers: 10, description: 'Grupo de entrenamiento',
      requirements: 'Nivel intermedio', level: 'amateur', ownerId: 7,
    });

    expect(createTeamService).toHaveBeenCalledWith(expect.objectContaining({ name: 'Fondistas del Oeste', max_members: 10, owner_id: 7 }));
    expect(result.success).toBe(true);
    expect(result.team.id).toBe('1');
    const s = useTeamStore.getState();
    expect(s.teams).toContainEqual(result.team);
    expect(s.selectedTeamId).toBe('1');
  });
```

Reemplazar `'createTeam creates the extra draft groups against the backend and remaps invite groupIds by name'` por (mismo escenario de creación de grupo extra, sin la parte de invitaciones):

```js
  test('createTeam creates the extra draft groups against the backend', async () => {
    createTeamService.mockResolvedValue(TEAM_DTO);
    const AVANZADOS_DTO = { id: 101, team_id: 1, name: 'Avanzados', description: null, is_main: false, created_at: '2026-01-01T00:00:00.000Z', updated_at: '2026-01-01T00:00:00.000Z' };
    createGroupService.mockResolvedValue(AVANZADOS_DTO);
    listGroupsService.mockResolvedValue([DEFAULT_GROUP_DTO, AVANZADOS_DTO]);

    const result = await useTeamStore.getState().createTeam({
      name: 'Con grupo extra', maxMembers: 10, ownerId: 7,
      groups: [{ id: 'group-draft-1', name: 'Avanzados', description: null, trainingPlanId: 'plan-10k' }],
    });

    expect(createGroupService).toHaveBeenCalledWith({ team_id: 1, name: 'Avanzados' });
    expect(result.team.groups).toHaveLength(2);
    const avanzados = result.team.groups.find((g) => g.name === 'Avanzados');
    expect(avanzados.trainingPlanId).toBe('plan-10k');
  });
```

Borrar `'createTeam falls back invites without a chosen group to the real default group'` sin reemplazo (ya no hay concepto de "grupo elegido al invitar").

Agregar `describe` nuevo al final del archivo:

```js
describe('fetchInvitations / sendInvite', () => {
  const INVITATION_DTO = { id: 1, team_id: 1, invitee_email: 'a@b.com', invitee_id: null, invitee_name: null, status: 'pending', expires_at: '2026-08-07T00:00:00.000Z', created_at: '2026-07-31T00:00:00.000Z' };

  beforeEach(() => {
    useTeamStore.setState({ teams: [{ id: '1', name: 'X', groups: [], members: [], invitations: [] }] });
  });

  test('fetchInvitations lists invitations for the team and normalizes them', async () => {
    listTeamInvitationsService.mockResolvedValue([INVITATION_DTO]);
    const result = await useTeamStore.getState().fetchInvitations('1');
    expect(result).toEqual({ success: true });
    const team = useTeamStore.getState().teams.find((t) => t.id === '1');
    expect(team.invitations).toEqual([{
      id: '1', teamId: '1', email: 'a@b.com', inviteeId: null, inviteeName: null,
      status: 'pending', expiresAt: '2026-08-07T00:00:00.000Z', createdAt: '2026-07-31T00:00:00.000Z',
    }]);
  });

  test('fetchInvitations returns a failure result when the service call rejects', async () => {
    listTeamInvitationsService.mockRejectedValue(new Error('Sin conexión.'));
    const result = await useTeamStore.getState().fetchInvitations('1');
    expect(result).toEqual({ success: false, error: 'Sin conexión.' });
  });

  test('sendInvite invites and refetches the pending list', async () => {
    inviteToTeamService.mockResolvedValue({ message: 'Invitación enviada.' });
    listTeamInvitationsService.mockResolvedValue([INVITATION_DTO]);
    const result = await useTeamStore.getState().sendInvite('1', 'a@b.com');
    expect(inviteToTeamService).toHaveBeenCalledWith('1', 'a@b.com');
    expect(result).toEqual({ success: true });
    const team = useTeamStore.getState().teams.find((t) => t.id === '1');
    expect(team.invitations).toHaveLength(1);
  });

  test('sendInvite returns a failure result when the service call rejects', async () => {
    inviteToTeamService.mockRejectedValue(new Error('Email inválido.'));
    const result = await useTeamStore.getState().sendInvite('1', 'no-es-un-email');
    expect(result).toEqual({ success: false, error: 'Email inválido.' });
  });
});
```

- [ ] **Step 2: Correr los tests y confirmar que fallan**

Run: `npx jest team-store.test.js`
Expected: FAIL — `fetchInvitations`/`sendInvite` no existen, y los tests de `createTeam` que ya no deberían pasar `invitedEmails` van a fallar contra la implementación actual.

- [ ] **Step 3: Implementar en `store/team-store.js`**

Actualizar los imports del principio del archivo:

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
import { listGroups as listGroupsService, createGroup as createGroupService, updateGroup as updateGroupService, deleteGroup as deleteGroupService } from '../services/groups.js';
import { inviteToTeam as inviteToTeamService, listTeamInvitations as listTeamInvitationsService } from '../services/invitations.js';
import { toTeamModel, toCreateTeamPayload, toUpdateTeamPayload, toAddressPayload, toGroupModel, toCreateGroupPayload, toUpdateGroupPayload, toInvitationModel } from '../services/normalizers.js';
```

Borrar las funciones `isRegisteredMockEmail` y `buildInvitedEmail` enteras (ya no las usa nadie).

Reemplazar `decorateTeam`:

```js
function decorateTeam(team, extra = {}) {
  return {
    ...team,
    status: team.status ?? 'activo',
    photoUri: extra.photoUri ?? null,
    showGroupsToRunners: team.showGroupsToRunners ?? false,
    groups: extra.groups ?? [],
    members: extra.members ?? [],
    invitations: extra.invitations ?? [],
  };
}
```

Reemplazar `createTeam` completo:

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
      for (const draft of draftGroups) {
        try {
          await createGroupService(toCreateGroupPayload(teamId, draft));
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

      const members = generateMockMembers(teamId, groups);
      team = { ...team, groups, members };
      set((state) => ({ teams: state.teams.map((t) => (t.id === teamId ? team : t)) }));

      return { success: true, team, ...(addressWarning ? { addressWarning } : {}), ...(groupsWarning ? { groupsWarning } : {}) };
    } catch (error) {
      return { success: false, error: error.message };
    }
  },
```

Borrar la acción `addInvitedEmails` entera (al final del store).

Agregar estas dos acciones nuevas, después de `deleteGroupReal` (donde estaba `addInvitedEmails`):

```js
  // Trae las invitaciones pendientes reales de un equipo (GET
  // /teams/{id}/invitations) — mismo patrón que fetchGroups.
  fetchInvitations: async (teamId) => {
    try {
      const dtos = await listTeamInvitationsService(teamId);
      const invitations = dtos.map((dto) => toInvitationModel(dto));
      set((state) => ({
        teams: state.teams.map((t) => (t.id === teamId ? { ...t, invitations } : t)),
      }));
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  },

  // Manda una invitación real (POST /teams/{id}/invite, solo email — ver
  // docs/BACKEND_API_GAPS.md gap 9) y re-trae el listado para reflejarla.
  // La respuesta del POST no trae el id de la invitación creada, no hay
  // nada que insertar localmente sin el refetch.
  sendInvite: async (teamId, email) => {
    try {
      await inviteToTeamService(teamId, email);
      await get().fetchInvitations(teamId);
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
Expected: PASS / sin errores (`__tests__/teams-mock.test.js`/`groups-mock.test.js` no deberían verse afectados).

- [ ] **Step 6: Commit**

```bash
git add store/team-store.js __tests__/team-store.test.js
git commit -m "feat(teams): fetch real invitations, drop synthetic invite system"
```

---

### Task 4: `RequireAuth` guard + wire en pantallas existentes

**Files:**
- Create: `components/guards/require-auth.jsx`
- Modify: `components/team/edit-team-screen.jsx`
- Modify: `components/team/team-detail-screen.jsx`
- Modify: `components/team/edit-group-screen.jsx`

**Interfaces:**
- Produces: `RequireAuth({ children, redirectHref = '/' })` — si `useAuthStore(s => s.user)` es falsy, `<Redirect href={redirectHref} />`; si no, `<>{children}</>`.

**Nota:** `create-team-screen.jsx` e `invite-team-members-screen.jsx` (Tasks 5 y 6 de este plan, más adelante) importan y usan este componente — se crea acá primero para que esas tareas lo encuentren ya disponible.

- [ ] **Step 1: Crear `components/guards/require-auth.jsx`**

```js
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

- [ ] **Step 2: Envolver `edit-team-screen.jsx`**

Agregar el import:

```js
import { RequireAuth } from '../guards/require-auth.jsx';
```

Localizar `export function EditTeamScreen(` — renombrar a `EditTeamScreenContent` (mismo cuerpo) y agregar al final del archivo:

```js
export function EditTeamScreen(props) {
  return (
    <RequireAuth>
      <EditTeamScreenContent {...props} />
    </RequireAuth>
  );
}
```

(usar el nombre real del prop que recibe hoy `EditTeamScreen` — leer el archivo actual antes de aplicar este paso para confirmar la firma exacta, ej. `{ teamId }`, y ajustar `props`/`{...props}` en consecuencia si conviene desestructurar en vez de spread).

- [ ] **Step 3: Envolver `team-detail-screen.jsx`**

Mismo patrón: agregar el import de `RequireAuth`, renombrar `export function TeamDetailScreen({ teamId })` a `TeamDetailScreenContent({ teamId })`, agregar al final:

```js
export function TeamDetailScreen({ teamId }) {
  return (
    <RequireAuth>
      <TeamDetailScreenContent teamId={teamId} />
    </RequireAuth>
  );
}
```

- [ ] **Step 4: Envolver `edit-group-screen.jsx`**

Mismo patrón: agregar el import de `RequireAuth`, renombrar `export function EditGroupScreen({ teamId, groupId })` a `EditGroupScreenContent({ teamId, groupId })`, agregar al final:

```js
export function EditGroupScreen({ teamId, groupId }) {
  return (
    <RequireAuth>
      <EditGroupScreenContent teamId={teamId} groupId={groupId} />
    </RequireAuth>
  );
}
```

- [ ] **Step 5: Correr toda la suite y lint**

Run: `npm test && npm run lint`
Expected: PASS / sin errores.

- [ ] **Step 6: Commit**

```bash
git add components/guards/require-auth.jsx components/team/edit-team-screen.jsx components/team/team-detail-screen.jsx components/team/edit-group-screen.jsx
git commit -m "feat(teams): redirect to landing if session ends on a protected team screen"
```

---

### Task 5: `invite-team-members-screen.jsx` — invitaciones reales, sin selector de grupo

**Files:**
- Modify: `components/team/invite-team-members-screen.jsx`
- Modify: `components/forms/fields.jsx`

**Interfaces:**
- Consumes: `fetchInvitations(teamId)`, `sendInvite(teamId, email)` de la Task 3.

**Nota:** esta pantalla ya no necesita `fetchGroups`/`team.groups` — el picker de grupo se saca por completo (gap 9). Se elimina esa lógica de la pantalla, no solo se agrega la nueva.

- [ ] **Step 1: Simplificar `EmailListField` en `components/forms/fields.jsx`**

Localizar `EmailListField` (junto con las constantes `NO_GROUP_ID`/`NO_GROUP_LABEL` justo arriba) y reemplazar el bloque completo — desde `const NO_GROUP_ID = '';` hasta el cierre de la función `EmailListField` — por:

```js
// Junta una lista de emails validos, uno por uno (ej. invitar gente a un
// equipo antes de que exista, o desde la pantalla de invitar de un equipo
// ya existente) — value es [{ email }]. El envio real de las invitaciones
// es tarea de quien use este campo (services/invitations.js) — este campo
// solo junta y valida el listado. Sin selector de grupo: el backend no
// acepta asignar grupo al invitar (ver docs/BACKEND_API_GAPS.md gap 9).
export function EmailListField({ label, value = [], onChange, placeholder = 'nombre@email.com' }) {
  const colors = useThemeColors();
  const slug = slugify(label);
  const [draft, setDraft] = useState('');
  const [draftError, setDraftError] = useState(null);

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
    onChange([...value, { email }]);
    setDraft('');
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
                  {invite.email}
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

Confirmar que `InlinePicker` (más arriba en el mismo archivo) queda intacto — sin más consumidores después de este cambio, pero es un componente compartido, no se toca ni se borra en esta tarea.

- [ ] **Step 2: Reescribir `components/team/invite-team-members-screen.jsx`**

Reemplazar el archivo completo:

```jsx
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import Toast from 'react-native-toast-message';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useThemeColors } from '../../theme/colors.js';
import { isWeb } from '../../utils/platform.js';
import { useTeamStore } from '../../store/team-store.js';
import { formatRelativeTime } from '../../utils/relative-time.js';
import { SectionCard } from '../forms/section-card.jsx';
import { EmailListField } from '../forms/fields.jsx';
import { RequireAuth } from '../guards/require-auth.jsx';

function PendingInviteRow({ invite }) {
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
        Invitado {formatRelativeTime(invite.createdAt).toLowerCase()}
      </Text>
    </View>
  );
}

// Pantalla de gestión de invitaciones de un equipo ya existente (no
// confundir con el paso 3 del wizard de creación, que es un formulario más
// básico). Junta el listado real de invitaciones pendientes
// (GET /teams/{id}/invitations) y el formulario para invitar gente nueva
// (POST /teams/{id}/invite, solo email — el backend no acepta asignar
// grupo al invitar, ver docs/BACKEND_API_GAPS.md gap 9).
function InviteTeamMembersScreenContent({ teamId }) {
  const router = useRouter();
  const colors = useThemeColors();
  const team = useTeamStore((s) => s.teams.find((t) => t.id === teamId));
  const fetchTeam = useTeamStore((s) => s.fetchTeam);
  const fetchInvitations = useTeamStore((s) => s.fetchInvitations);
  const sendInvite = useTeamStore((s) => s.sendInvite);

  const [draftInvites, setDraftInvites] = useState([]);
  const [sending, setSending] = useState(false);
  const [loadingTeam, setLoadingTeam] = useState(!team);
  const [loadingInvitations, setLoadingInvitations] = useState(true);

  // Entrar por deep-link (ej. recargar /teams/{id}/invite directo) puede
  // caer acá antes de que el equipo esté en el store — fetchTeam lo trae
  // puntual.
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

  useEffect(() => {
    let cancelled = false;
    setLoadingInvitations(true);
    fetchInvitations(teamId).finally(() => { if (!cancelled) setLoadingInvitations(false); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teamId]);

  if (loadingTeam || loadingInvitations) {
    return (
      <View className="flex-1 items-center justify-center bg-paper dark:bg-ink" nativeID="invite-team-loading" testID="invite-team-loading">
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  if (!team) {
    return (
      <View className="flex-1 items-center justify-center bg-paper px-6 dark:bg-ink" nativeID="invite-team-not-found" testID="invite-team-not-found">
        <Text className="mb-4 text-center text-sm text-slate-500 dark:text-slate-400" nativeID="invite-team-not-found-label" testID="invite-team-not-found-label">
          No encontramos este equipo.
        </Text>
        <Pressable
          className="h-11 flex-row items-center gap-2 rounded-full bg-primary px-6 active:opacity-80"
          nativeID="invite-team-not-found-back-button"
          onPress={() => router.back()}
          testID="invite-team-not-found-back-button"
        >
          <Text className="text-sm font-semibold uppercase tracking-wide text-[#111518]" nativeID="invite-team-not-found-back-button-label" testID="invite-team-not-found-back-button-label">
            Volver
          </Text>
        </Pressable>
      </View>
    );
  }

  const handleSendInvites = async () => {
    if (draftInvites.length === 0 || sending) return;
    setSending(true);
    let failed = 0;
    for (const invite of draftInvites) {
      const result = await sendInvite(teamId, invite.email);
      if (!result.success) failed += 1;
    }
    setSending(false);
    setDraftInvites([]);
    if (failed > 0) {
      Toast.show({ type: 'error', text1: 'Algunas invitaciones no se pudieron enviar', text2: `${failed} de ${draftInvites.length} fallaron.` });
      return;
    }
    Toast.show({ type: 'success', text1: 'Invitaciones enviadas' });
  };

  return (
    <ScrollView
      className="flex-1 bg-paper dark:bg-ink"
      contentContainerClassName="px-4 py-8"
      nativeID="invite-team-screen-scroll"
      showsVerticalScrollIndicator={false}
      testID="invite-team-screen-scroll"
    >
      <View className={`w-full self-center ${isWeb ? 'max-w-3xl' : ''}`} nativeID="invite-team-screen-container" testID="invite-team-screen-container">
        <View className="mb-8 flex-row items-center gap-2" nativeID="invite-team-screen-header" testID="invite-team-screen-header">
          <Pressable
            className="flex-row items-center gap-1.5 py-1 pr-1 hover:opacity-70 active:opacity-70"
            nativeID="invite-team-screen-back-button"
            onPress={() => router.back()}
            testID="invite-team-screen-back-button"
          >
            <MaterialCommunityIcons color={colors.onSurfaceVariant} name="arrow-left" size={18} />
          </Pressable>
          <Text className="text-xl text-slate-900 dark:text-white" nativeID="invite-team-screen-title" style={{ fontFamily: 'Orbitron_700Bold' }} testID="invite-team-screen-title">
            Invitar corredores
          </Text>
        </View>

        <SectionCard icon="email-check-outline" title="Solicitudes pendientes">
          {team.invitations.length === 0 ? (
            <Text className="py-2 text-sm text-slate-500 dark:text-slate-400" nativeID="invite-pending-empty" testID="invite-pending-empty">
              Todavía no invitaste a nadie a este equipo.
            </Text>
          ) : (
            <View className="gap-2" nativeID="invite-pending-list" testID="invite-pending-list">
              {team.invitations.map((invite) => (
                <PendingInviteRow invite={invite} key={invite.id} />
              ))}
            </View>
          )}
        </SectionCard>

        <SectionCard icon="account-plus-outline" title="Invitar más corredores">
          <EmailListField label="Email del corredor" onChange={setDraftInvites} value={draftInvites} />

          <Pressable
            className="mt-2 h-12 flex-row items-center justify-center gap-2 rounded-full bg-primary hover:opacity-90 active:opacity-80 disabled:opacity-60"
            disabled={sending}
            nativeID="invite-team-send-button"
            onPress={handleSendInvites}
            testID="invite-team-send-button"
          >
            {sending ? (
              <ActivityIndicator color={colors.onPrimary} size="small" />
            ) : (
              <>
                <MaterialCommunityIcons color={colors.onPrimary} name="send-outline" size={18} />
                <Text className="text-sm font-semibold uppercase tracking-wide text-[#111518]" nativeID="invite-team-send-button-label" testID="invite-team-send-button-label">
                  Enviar invitaciones
                </Text>
              </>
            )}
          </Pressable>
        </SectionCard>
      </View>
    </ScrollView>
  );
}

export function InviteTeamMembersScreen({ teamId }) {
  return (
    <RequireAuth>
      <InviteTeamMembersScreenContent teamId={teamId} />
    </RequireAuth>
  );
}
```

(`RequireAuth` ya existe desde la Task 4 de este plan — el import de acá arriba resuelve sin problema).

- [ ] **Step 3: Correr lint**

Run: `npm run lint`
Expected: sin errores.

- [ ] **Step 4: Commit**

```bash
git add components/forms/fields.jsx components/team/invite-team-members-screen.jsx
git commit -m "feat(teams): invite screen sends real invitations, drop group picker"
```

---

### Task 6: `create-team-screen.jsx` — invitar sin grupo, después de crear el equipo

**Files:**
- Modify: `components/team/create-team-screen.jsx`

**Interfaces:**
- Consumes: `sendInvite(teamId, email)` de la Task 3.

- [ ] **Step 1: Actualizar imports**

Reemplazar la línea de import de `useTeamStore`:

```js
import { useTeamStore, getTeamMemberLimit, TRAINING_PLAN_OPTIONS } from '../../store/team-store.js';
```

por:

```js
import { useTeamStore, getTeamMemberLimit, TRAINING_PLAN_OPTIONS } from '../../store/team-store.js';
import { RequireAuth } from '../guards/require-auth.jsx';
```

(la primera línea ya existe tal cual, se agrega la segunda debajo).

- [ ] **Step 2: Actualizar `handleSubmit` para invitar después de crear**

Localizar `const createTeam = useTeamStore((s) => s.createTeam);` y agregar debajo:

```js
  const sendInvite = useTeamStore((s) => s.sendInvite);
```

Reemplazar `handleSubmit`:

```js
  const handleSubmit = async () => {
    if (submitting) return;
    setSubmitting(true);
    const result = await createTeam({
      ...generalForm.getValues(),
      ownerId: user.userId,
      groups,
    });

    if (!result.success) {
      setSubmitting(false);
      Toast.show({ type: 'error', text1: 'No pudimos crear el equipo', text2: result.error });
      return;
    }

    let inviteFailures = 0;
    for (const invite of invitedEmails) {
      const inviteResult = await sendInvite(result.team.id, invite.email);
      if (!inviteResult.success) inviteFailures += 1;
    }
    setSubmitting(false);

    Toast.show({
      type: 'success',
      text1: 'Equipo creado',
      text2: result.addressWarning
        ? 'La dirección no se pudo guardar — podés agregarla después desde Editar equipo.'
        : inviteFailures > 0
          ? `${inviteFailures} de ${invitedEmails.length} invitaciones no se pudieron enviar — podés reintentar desde la pantalla de invitar.`
          : undefined,
    });

    router.replace(`/teams/${result.team.id}`);
  };
```

- [ ] **Step 3: Simplificar el paso 3 (invitar) y su `EmailListField`**

Localizar el estado `const [invitedEmails, setInvitedEmails] = useState([]);` — sin cambios (sigue siendo `[{email}]`, ya no `[{email, groupId}]`, porque `EmailListField` ya no produce `groupId` desde la Task 5).

Localizar `handleRemoveGroup` — **borrar entera** (ya no hay `groupId` en las invitaciones, no hay nada que remapear al sacar un grupo del wizard). Sacar también su uso en el `onRemove` de `GroupListEditor` más abajo — buscar `<GroupListEditor groups={groups} onChange={setGroups} onRemove={handleRemoveGroup} planOptions={TRAINING_PLAN_OPTIONS} />` y dejarlo sin `onRemove`:

```jsx
            <GroupListEditor groups={groups} onChange={setGroups} planOptions={TRAINING_PLAN_OPTIONS} />
```

Localizar el paso 3 (`{step === 3 && (...)`) y quitar el prop `groups` de `EmailListField`:

```jsx
        {step === 3 && (
          <SectionCard icon="email-outline" title="Invitar corredores">
            <EmailListField label="Invitar corredores por email" onChange={setInvitedEmails} value={invitedEmails} />

            <StepNav disabled={submitting} loading={submitting} nextIcon="check" nextLabel="Crear" onBack={() => setStep(2)} onNext={handleSubmit} />
          </SectionCard>
        )}
```

- [ ] **Step 4: Envolver el export en `RequireAuth`**

Localizar `export function CreateTeamScreen() {` — renombrar a `CreateTeamScreenContent` y agregar un wrapper nuevo al final del archivo:

```js
function CreateTeamScreenContent() {
  // ... cuerpo de la función sin cambios, es el mismo que tenía CreateTeamScreen ...
}

export function CreateTeamScreen() {
  return (
    <RequireAuth>
      <CreateTeamScreenContent />
    </RequireAuth>
  );
}
```

- [ ] **Step 5: Correr lint**

Run: `npm run lint`
Expected: sin errores.

- [ ] **Step 6: Commit**

```bash
git add components/team/create-team-screen.jsx
git commit -m "feat(teams): send real invites after team creation, drop group picker from wizard"
```

---

### Task 7: `ResponsiveSelectField` + migrar los 3 ternarios existentes

**Files:**
- Create: `components/forms/responsive-select-field.jsx`
- Modify: `components/team/team-general-info-fields.jsx`
- Modify: `components/team/group-list-editor.jsx`
- Modify: `components/team/edit-group-screen.jsx`

**Interfaces:**
- Produces: `ResponsiveSelectField(props)` — mismos props que `SelectField`/`PickerField` (`label, options, value, onChange, placeholder, disabled, error, dense`), resuelve solo `isWeb ? <SelectField> : <PickerField>`.

- [ ] **Step 1: Crear `components/forms/responsive-select-field.jsx`**

```js
import { isWeb } from '../../utils/platform.js';
import { SelectField, PickerField } from './fields.jsx';

// SelectField (web, <select> nativo) y PickerField (mobile, modal) tienen
// exactamente la misma firma de props — este wrapper resuelve cuál usar
// según la plataforma, para no repetir el ternario en cada pantalla que
// necesita un select. Ver docs/superpowers/specs/2026-07-31-teams-invitations-and-stage2-fixes-design.md.
export function ResponsiveSelectField(props) {
  return isWeb ? <SelectField {...props} /> : <PickerField {...props} />;
}
```

- [ ] **Step 2: Migrar `components/team/team-general-info-fields.jsx`**

Reemplazar el import:

```js
import { InputField, PickerField, Row, Col, SelectField } from '../forms/fields.jsx';
```

por:

```js
import { InputField, Row, Col } from '../forms/fields.jsx';
import { ResponsiveSelectField } from '../forms/responsive-select-field.jsx';
```

Reemplazar el bloque del ternario de nivel:

```jsx
          {isWeb ? (
            <SelectField dense error={form.errors.level} label="Nivel del equipo" onChange={form.setLevel} options={LEVEL_OPTIONS} placeholder="Elegir nivel" value={form.level} />
          ) : (
            <PickerField dense error={form.errors.level} label="Nivel del equipo" onChange={form.setLevel} options={LEVEL_OPTIONS} placeholder="Elegir nivel" value={form.level} />
          )}
```

por:

```jsx
          <ResponsiveSelectField dense error={form.errors.level} label="Nivel del equipo" onChange={form.setLevel} options={LEVEL_OPTIONS} placeholder="Elegir nivel" value={form.level} />
```

(dejar el import de `isWeb` si el archivo lo sigue usando en otro lado — confirmar antes de sacarlo).

- [ ] **Step 3: Migrar `components/team/group-list-editor.jsx`**

Reemplazar el import:

```js
import { InputField, PickerField, SelectField } from '../forms/fields.jsx';
```

por:

```js
import { InputField } from '../forms/fields.jsx';
import { ResponsiveSelectField } from '../forms/responsive-select-field.jsx';
```

Reemplazar el bloque del ternario de plan de entrenamiento:

```jsx
      {isWeb ? (
        <SelectField
          dense
          label="Plan de entrenamiento"
          onChange={setDraftPlan}
          options={planOptions}
          placeholder="Sin plan asignado"
          value={draftPlan}
        />
      ) : (
        <PickerField
          dense
          label="Plan de entrenamiento"
          onChange={setDraftPlan}
          options={planOptions}
          placeholder="Sin plan asignado"
          value={draftPlan}
        />
      )}
```

por:

```jsx
      <ResponsiveSelectField
        dense
        label="Plan de entrenamiento"
        onChange={setDraftPlan}
        options={planOptions}
        placeholder="Sin plan asignado"
        value={draftPlan}
      />
```

(sacar el import de `isWeb` de este archivo si no queda ningún otro uso).

- [ ] **Step 4: Migrar `components/team/edit-group-screen.jsx`**

Reemplazar el import:

```js
import { InputField, PickerField, SelectField } from '../forms/fields.jsx';
```

por:

```js
import { InputField } from '../forms/fields.jsx';
import { ResponsiveSelectField } from '../forms/responsive-select-field.jsx';
```

Reemplazar el bloque del ternario de plan de entrenamiento:

```jsx
          {isWeb ? (
            <SelectField dense label="Plan de entrenamiento" onChange={setTrainingPlanId} options={TRAINING_PLAN_OPTIONS} placeholder="Sin plan asignado" value={trainingPlanId} />
          ) : (
            <PickerField dense label="Plan de entrenamiento" onChange={setTrainingPlanId} options={TRAINING_PLAN_OPTIONS} placeholder="Sin plan asignado" value={trainingPlanId} />
          )}
```

por:

```jsx
          <ResponsiveSelectField dense label="Plan de entrenamiento" onChange={setTrainingPlanId} options={TRAINING_PLAN_OPTIONS} placeholder="Sin plan asignado" value={trainingPlanId} />
```

(el archivo usa `isWeb` en otro lado — el contenedor `max-w-3xl` — dejar ese import).

- [ ] **Step 5: Correr toda la suite y lint**

Run: `npm test && npm run lint`
Expected: PASS / sin errores.

- [ ] **Step 6: Commit**

```bash
git add components/forms/responsive-select-field.jsx components/team/team-general-info-fields.jsx components/team/group-list-editor.jsx components/team/edit-group-screen.jsx
git commit -m "refactor(forms): extract ResponsiveSelectField, replace 3 duplicated isWeb ternaries"
```

---

### Task 8: Pantalla `/teams` (listado de equipos administrados)

**Files:**
- Create: `app/(tabs)/teams/index.jsx`
- Create: `components/team/teams-list-screen.jsx`

**Interfaces:**
- Consumes: `RequireAuth` de la Task 4, `selectAdministeredTeams`/`fetchTeams` de `store/team-store.js` (ya existen).

- [ ] **Step 1: Crear `components/team/teams-list-screen.jsx`**

```jsx
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useThemeColors } from '../../theme/colors.js';
import { isWeb } from '../../utils/platform.js';
import { useAuthStore } from '../../store/auth-store.js';
import { useTeamStore, selectAdministeredTeams } from '../../store/team-store.js';
import { SectionCard } from '../forms/section-card.jsx';
import { RequireAuth } from '../guards/require-auth.jsx';

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

function TeamsListScreenContent() {
  const router = useRouter();
  const colors = useThemeColors();
  const user = useAuthStore((s) => s.user);
  const hasTrainerRole = useAuthStore((s) => s.roles.some((r) => r.name === 'entrenador'));
  const activeRole = useAuthStore((s) => s.activeRole);
  const canCreateTeam = hasTrainerRole && activeRole === 'trainer';
  const teams = useTeamStore((s) => s.teams);
  const fetchTeams = useTeamStore((s) => s.fetchTeams);
  const administeredTeams = selectAdministeredTeams(teams, user?.userId);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetchTeams().finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <ScrollView
      className="flex-1 bg-paper dark:bg-ink"
      contentContainerClassName="px-4 py-8"
      nativeID="teams-list-screen-scroll"
      showsVerticalScrollIndicator={false}
      testID="teams-list-screen-scroll"
    >
      <View className={`w-full self-center ${isWeb ? 'max-w-3xl' : ''}`} nativeID="teams-list-screen-container" testID="teams-list-screen-container">
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

        <SectionCard icon="account-group" title="Equipos que administrás">
          {loading ? (
            <View className="items-center py-6" nativeID="teams-list-loading" testID="teams-list-loading">
              <ActivityIndicator color={colors.primary} />
            </View>
          ) : administeredTeams.length === 0 ? (
            <Text className="py-2 text-sm text-slate-500 dark:text-slate-400" nativeID="teams-list-empty" testID="teams-list-empty">
              Todavía no administrás ningún equipo.
            </Text>
          ) : (
            <View className="gap-2" nativeID="teams-list-list" testID="teams-list-list">
              {administeredTeams.map((team) => (
                <TeamRow key={team.id} onPress={() => router.push(`/teams/${team.id}`)} team={team} />
              ))}
            </View>
          )}

          {canCreateTeam && (
            <Pressable
              className="mt-4 h-11 flex-row items-center justify-center gap-2 self-start rounded-full bg-primary px-6 hover:opacity-90 active:opacity-80"
              nativeID="teams-list-create-button"
              onPress={() => router.push('/teams/create')}
              testID="teams-list-create-button"
            >
              <MaterialCommunityIcons color={colors.onPrimary} name="plus" size={18} />
              <Text className="text-sm font-semibold uppercase tracking-wide text-[#111518]" nativeID="teams-list-create-button-label" testID="teams-list-create-button-label">
                Crear equipo
              </Text>
            </Pressable>
          )}
        </SectionCard>
      </View>
    </ScrollView>
  );
}

export function TeamsListScreen() {
  return (
    <RequireAuth>
      <TeamsListScreenContent />
    </RequireAuth>
  );
}
```

- [ ] **Step 2: Crear la ruta `app/(tabs)/teams/index.jsx`**

Confirmar primero el patrón de nombre de función exportada en un route file ya existente en este mismo directorio (ej. `app/(tabs)/teams/create.jsx` exporta `TeamsCreate`) y seguirlo:

```jsx
import { TeamsListScreen } from '../../../components/team/teams-list-screen.jsx';

export default function TeamsIndex() {
  return <TeamsListScreen />;
}
```

- [ ] **Step 3: Correr lint**

Run: `npm run lint`
Expected: sin errores.

- [ ] **Step 4: Commit**

```bash
git add components/team/teams-list-screen.jsx "app/(tabs)/teams/index.jsx"
git commit -m "feat(teams): add /teams list screen"
```

---

### Task 9: Shell — separar navegar de expandir en "Equipos"

**Files:**
- Modify: `components/shell/app-web-shell.jsx`
- Modify: `components/shell/teams-accordion.jsx`
- Modify: `components/shell/app-web-shell-narrow.jsx`
- Modify: `components/shell/app-mobile-shell.jsx`

**Interfaces:**
- Consumes: nada de tareas anteriores (independiente del resto del plan).

- [ ] **Step 1: `app-web-shell.jsx` — separar el `Pressable` de `TeamsTab` en dos**

Reemplazar la función `TeamsTab` completa:

```jsx
// Tab con dos acciones distintas: el label navega a /teams (listado
// completo), la flechita abre/cierra el submenu rápido (comportamiento que
// ya tenía todo el tab antes de este cambio). measureInWindow sigue
// midiendo el contenedor entero para que el submenu quede anclado debajo
// de todo el tab, no solo de la flechita.
function TeamsTab({ route, isOpen, colors, onOpen }) {
  const router = useRouter();
  const ref = useRef(null);

  const handleChevronPress = () => {
    ref.current?.measureInWindow((x, y, width, height) => {
      onOpen({ x, y, width, height });
    });
  };

  return (
    <View
      className={`flex-row items-center rounded-lg transition-colors duration-150 ${isOpen ? 'bg-slate-100 dark:bg-slate-800' : ''}`}
      nativeID={`web-shell-nav-tab-${route.name}`}
      ref={ref}
      testID={`web-shell-nav-tab-${route.name}`}
    >
      <Pressable
        className="flex-row items-center gap-1.5 rounded-lg py-1.5 pl-3 pr-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 active:bg-slate-100 dark:active:bg-slate-800"
        nativeID={`web-shell-nav-tab-${route.name}-link`}
        onPress={() => router.push('/teams')}
        testID={`web-shell-nav-tab-${route.name}-link`}
      >
        <MaterialCommunityIcons name={route.icon} size={16} color={colors.onSurfaceVariant} />
        <Text
          className="text-sm font-medium text-slate-700 dark:text-slate-200 whitespace-nowrap"
          nativeID={`web-shell-nav-tab-label-${route.name}`}
          testID={`web-shell-nav-tab-label-${route.name}`}
        >
          {route.label}
        </Text>
      </Pressable>
      <Pressable
        accessibilityLabel="Ver mis equipos"
        className="rounded-lg py-1.5 pl-1 pr-2.5 hover:bg-slate-100 dark:hover:bg-slate-800 active:bg-slate-100 dark:active:bg-slate-800"
        nativeID={`web-shell-nav-tab-${route.name}-chevron`}
        onPress={handleChevronPress}
        testID={`web-shell-nav-tab-${route.name}-chevron`}
      >
        <MaterialCommunityIcons
          name={isOpen ? 'chevron-up' : 'chevron-down'}
          size={14}
          color={colors.onSurfaceVariant}
        />
      </Pressable>
    </View>
  );
}
```

- [ ] **Step 2: `teams-accordion.jsx` — sumar fila "Ver todos los equipos"**

Agregar `onViewAll` a la firma de `TeamsAccordion`:

```js
export function TeamsAccordion({ expanded, onToggle, teams, selectedTeamId, onSelectTeam, onCreateTeam, onViewAll, colors, icon, label }) {
```

Agregar una fila nueva dentro de `teams-accordion-content`, justo antes del bloque `{onCreateTeam && (...)}`:

```jsx
            <Pressable
              className="flex-row items-center gap-2 rounded-lg px-2 py-2 hover:bg-slate-100 active:opacity-80 dark:hover:bg-slate-800"
              nativeID="teams-accordion-view-all"
              onPress={onViewAll}
              testID="teams-accordion-view-all"
            >
              <MaterialCommunityIcons color={colors.onSurfaceVariant} name="arrow-right" size={16} />
              <Text className="text-sm font-medium text-slate-600 dark:text-slate-300" nativeID="teams-accordion-view-all-label" testID="teams-accordion-view-all-label">
                Ver todos los equipos
              </Text>
            </Pressable>

            {onCreateTeam && (
```

- [ ] **Step 3: `app-web-shell-narrow.jsx` — pasar `onViewAll`**

Agregar junto a `handleCreateTeam`:

```js
  const handleViewAllTeams = () => {
    onClose();
    router.push('/teams');
  };
```

Agregar el prop a la invocación de `<TeamsAccordion`:

```jsx
                      <TeamsAccordion
                        key={route.name}
                        colors={colors}
                        expanded={teamsExpanded}
                        icon={route.icon}
                        label={route.label}
                        onCreateTeam={canCreateTeam ? handleCreateTeam : undefined}
                        onSelectTeam={handleSelectTeam}
                        onToggle={() => setTeamsExpanded((v) => !v)}
                        onViewAll={handleViewAllTeams}
                        selectedTeamId={selectedTeamId}
                        teams={administeredTeams}
                      />
```

- [ ] **Step 4: `app-mobile-shell.jsx` — mismo cambio**

Mismo patrón exacto que el Step 3: agregar `handleViewAllTeams` junto a `handleCreateTeam`, agregar `onViewAll={handleViewAllTeams}` a la invocación de `<TeamsAccordion`.

- [ ] **Step 5: Correr lint**

Run: `npm run lint`
Expected: sin errores.

- [ ] **Step 6: Commit**

```bash
git add components/shell/app-web-shell.jsx components/shell/teams-accordion.jsx components/shell/app-web-shell-narrow.jsx components/shell/app-mobile-shell.jsx
git commit -m "feat(shell): separate navigating to /teams from toggling the quick-access menu"
```

---

### Task 10: Menú de equipos (shell ancho) — sacar el parpadeo vacío

**Files:**
- Modify: `components/shell/app-web-shell.jsx`

**Interfaces:**
- Consumes: nada de tareas anteriores (independiente del resto del plan).

- [ ] **Step 1: Mover el fetch de equipos de `TeamsMenu` a `AppWebShell`**

En la función `TeamsMenu`, borrar este bloque (el fetch ya no vive acá):

```js
  useEffect(() => {
    fetchTeams();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
```

Cambiar la firma de `TeamsMenu` para recibir el loading state en vez de fetchear él mismo:

```js
function TeamsMenu({ onClose, loading }) {
```

(sacar también `const fetchTeams = useTeamStore((s) => s.fetchTeams);` de `TeamsMenu`, ya no lo usa).

Reemplazar el bloque de "vacío" dentro de `TeamsMenu` (`{administeredTeams.length === 0 && (...)}`) por:

```jsx
        {loading ? (
          <View className="items-center px-4 py-5" nativeID="web-shell-teams-menu-loading" testID="web-shell-teams-menu-loading">
            <ActivityIndicator color={colors.primary} size="small" />
          </View>
        ) : administeredTeams.length === 0 && (
          <Text className="px-4 py-3.5 text-sm text-slate-500 dark:text-slate-400" nativeID="web-shell-teams-menu-empty" testID="web-shell-teams-menu-empty">Todavía no tenés equipos.</Text>
        )}
```

Agregar `ActivityIndicator` al import de `react-native` al principio del archivo (junto a `Image, Pressable, ScrollView, Text, View`).

- [ ] **Step 2: Fetchear en `AppWebShell` (nivel del shell, no del submenu)**

Dentro de `AppWebShell`, junto a los otros `useEffect`/`useState` ya existentes (después de `const [teamsAnchor, setTeamsAnchor] = useState(...)`), agregar:

```js
  const fetchTeams = useTeamStore((s) => s.fetchTeams);
  const [teamsLoading, setTeamsLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setTeamsLoading(false);
      return undefined;
    }
    let cancelled = false;
    fetchTeams().finally(() => { if (!cancelled) setTeamsLoading(false); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.userId]);
```

(agregar el import de `useTeamStore` al principio del archivo si no está ya — confirmar, este archivo ya importa `useTeamStore`/`selectAdministeredTeams` de `store/team-store.js` para otros usos, solo reutilizar el import existente).

Pasar `teamsLoading` a `TeamsMenu` en el JSX:

```jsx
            <TeamsMenu loading={teamsLoading} onClose={handleCloseTeamsMenu} />
```

- [ ] **Step 2: Correr lint**

Run: `npm run lint`
Expected: sin errores.

- [ ] **Step 3: Commit**

```bash
git add components/shell/app-web-shell.jsx
git commit -m "fix(shell): fetch teams at shell mount instead of on menu open, add loading state"
```

---

## Después de este plan

Con esto, la Etapa 3 (Invitaciones) queda funcionalmente cerrada del lado del dueño de equipo — la vista del invitado (gap 8) y la asignación de grupo al invitar (gap 9) dependen de que backend sume soporte. Los 6 ítems de QA quedan resueltos salvo la confirmación en vivo del punto "crear grupo desde la vista del equipo" (ya implementado en Etapa 2, Task 8 — no es parte de este plan, solo pendiente de que el usuario lo confirme durante la prueba manual final).

Al terminar todas las tareas, entregar al usuario un script de prueba manual escrito (no verificación por subagentes, ver Global Constraints) cubriendo: invitar corredor real (mock y backend real), editar/borrar grupo desde el detalle del equipo, logout desde una pantalla de equipos, navegar a `/teams` desde el botón vs. desde la flechita, y confirmar que el menú de equipos no parpadea vacío.
