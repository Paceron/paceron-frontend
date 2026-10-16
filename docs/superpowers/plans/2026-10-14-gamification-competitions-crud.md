# Gamificación — Spec 4a: Competencias (CRUD/moderación) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship CRUD, aprobación, cancelación, cierre y listado de competencias — sin progreso en
vivo ni integración con session-runtime (eso es Spec 4b).

**Architecture:** Una query por filtro de listado (TanStack), 5 mutaciones independientes que
todas invalidan la misma queryKey al resolver. El mock es mutable en memoria (mismo patrón que
`services/__mocks__/team-subscriptions-mock.js`) para poder probar el ciclo completo
crear→aprobar/rechazar→cancelar→cerrar sin backend real.

**Tech Stack:** React Native + Expo, NativeWind, TanStack Query, react-native-toast-message,
expo-haptics, MaterialCommunityIcons.

**Spec:** `docs/superpowers/specs/2026-10-14-gamification-competitions-crud-design.md`

## Global Constraints

- Backend real (Gap 33, `docs/BACKEND_API_GAPS.md`, "Actualización 2026-10-14 (2)"):
  `POST /teams/{id}/competitions` (sin `created_by_user_id`/`created_by_role` en el body — el
  backend los deriva del token, mismo criterio que Gap 27), `PATCH /competitions/{id}/approve`,
  `PATCH /competitions/{id}/reject {reason?}`, **`DELETE /competitions/{id}/cancel`** (no PATCH),
  `PATCH /competitions/{id}/close`, `GET /teams/{id}/competitions?status=&group_id=`.
- Cancelar: solo el corredor proponente, solo `pending_approval`. Cerrar: solo entrenador/owner,
  solo `active` con `end_at` ya pasado. Ninguna acción de cancelación existe para `active`.
- `winner_user_ids` es un ARRAY (empate exacto = todos ganan), nunca singular.
- IDs en bodies de request: `Number(id)` siempre (roster trae `userId` como string — ver CLAUDE.md
  "IDs numéricos en bodies de request").
- `GET /teams/{id}/competitions` trae `has_unseen` para ese equipo — shape exacto de la envoltura
  (`{data:[...], has_unseen}` asumido) **no confirmado por backend todavía** (pregunta abierta,
  Gap 33 punto 21) — parsear defensivo.
- Cada visual nuevo lleva `nativeID`/`testID` kebab-case.
- No tests de render de componentes — solo utils/mock puros.
- Ejecución: inline en esta sesión, sin subagentes ni preview — última tarea entrega script de
  prueba manual.

---

### Task 1: Data layer (service, mock mutable, normalizers)

**Files:**
- Create: `services/competitions.js`
- Create: `services/__mocks__/competitions-mock.js`
- Modify: `services/normalizers.js` (append `toCompetitionModel`/`toCreateCompetitionPayload`)
- Test: `__tests__/competitions-mock.test.js`

**Interfaces:**
- Produces: `listCompetitions(teamId, {status, groupId})`, `createCompetition(teamId, payload,
  {isTrainerCreator})`, `approveCompetition(id)`, `rejectCompetition(id, reason)`,
  `cancelCompetition(id)`, `closeCompetition(id)` (todas async). `toCompetitionModel(dto)` →
  `{id, name, teamId, groupId, type, metric, startAt, endAt, route, acceptanceRadiusMeters,
  participantUserIds: [string], createdByUserId, createdByRole, status, approvedByUserId,
  rejectionReason, winnerUserIds: [string], finishedAt}`. `toCreateCompetitionPayload(form)` →
  `{name, type, metric, start_at, end_at, participant_user_ids: [number], group_id?}`.

- [ ] **Step 1: Write the mutable mock**

```js
// services/__mocks__/competitions-mock.js
// Fixture CRUD mutable para EXPO_PUBLIC_USE_MOCKS=true (Gap 33) -- mismo
// patrón que services/__mocks__/team-subscriptions-mock.js: estado en
// memoria + __resetMockCompetitions() para tests. 3 competencias seed con
// 3 estados distintos (active/pending_approval/finished) para poder ver
// toda la matriz de acciones sin tener que crear nada a mano primero.
const SEED = [
  { id: 1, name: 'Desafío de octubre', team_id: 1, group_id: null, type: 'metric', metric: 'distance', start_at: '2026-10-01', end_at: '2026-10-07', route: null, acceptance_radius_meters: null, participant_user_ids: [2, 3], created_by_user_id: 1, created_by_role: 'trainer', status: 'active', approved_by_user_id: null, rejection_reason: null, winner_user_ids: [], finished_at: null },
  { id: 2, name: 'Propuesta de Martín', team_id: 1, group_id: null, type: 'metric', metric: 'sessions_count', start_at: '2026-10-15', end_at: '2026-10-22', route: null, acceptance_radius_meters: null, participant_user_ids: [2, 4], created_by_user_id: 2, created_by_role: 'runner', status: 'pending_approval', approved_by_user_id: null, rejection_reason: null, winner_user_ids: [], finished_at: null },
  { id: 3, name: 'Reto de septiembre', team_id: 1, group_id: null, type: 'metric', metric: 'duration', start_at: '2026-09-01', end_at: '2026-09-30', route: null, acceptance_radius_meters: null, participant_user_ids: [1, 2, 3], created_by_user_id: 1, created_by_role: 'trainer', status: 'finished', approved_by_user_id: null, rejection_reason: null, winner_user_ids: [2], finished_at: '2026-10-01' },
];

let mockCompetitions = [];
let nextId = 4;

function resetSeed() {
  mockCompetitions = SEED.map((c) => ({ ...c }));
  nextId = SEED.length + 1;
}
resetSeed();

export async function mockListCompetitions(teamId, { status, groupId } = {}) {
  let rows = mockCompetitions.filter((c) => c.team_id === Number(teamId));
  if (status) rows = rows.filter((c) => c.status === status);
  if (groupId) rows = rows.filter((c) => c.group_id === Number(groupId));
  return { data: rows, has_unseen: rows.some((c) => c.status === 'pending_approval') };
}

export async function mockCreateCompetition(teamId, payload, { isTrainerCreator = true } = {}) {
  const competition = {
    id: nextId++,
    name: payload.name,
    team_id: Number(teamId),
    group_id: payload.group_id ?? null,
    type: payload.type,
    metric: payload.metric ?? null,
    start_at: payload.start_at,
    end_at: payload.end_at ?? null,
    route: null,
    acceptance_radius_meters: null,
    participant_user_ids: payload.participant_user_ids ?? [],
    created_by_user_id: 1,
    created_by_role: isTrainerCreator ? 'trainer' : 'runner',
    status: isTrainerCreator ? 'active' : 'pending_approval',
    approved_by_user_id: null,
    rejection_reason: null,
    winner_user_ids: [],
    finished_at: null,
  };
  mockCompetitions.push(competition);
  return competition;
}

export async function mockApproveCompetition(id) {
  const competition = mockCompetitions.find((c) => c.id === Number(id));
  if (!competition) throw new Error('Competencia no encontrada');
  competition.status = 'active';
  return competition;
}

export async function mockRejectCompetition(id, reason) {
  const competition = mockCompetitions.find((c) => c.id === Number(id));
  if (!competition) throw new Error('Competencia no encontrada');
  competition.status = 'rejected';
  competition.rejection_reason = reason ?? null;
  return competition;
}

export async function mockCancelCompetition(id) {
  mockCompetitions = mockCompetitions.filter((c) => c.id !== Number(id));
  return { success: true };
}

export async function mockCloseCompetition(id) {
  const competition = mockCompetitions.find((c) => c.id === Number(id));
  if (!competition) throw new Error('Competencia no encontrada');
  competition.status = 'finished';
  competition.finished_at = new Date().toISOString();
  competition.winner_user_ids = competition.participant_user_ids.length ? [competition.participant_user_ids[0]] : [];
  return competition;
}

export function __resetMockCompetitions() {
  resetSeed();
}
```

- [ ] **Step 2: Write the failing test**

```js
// __tests__/competitions-mock.test.js
import {
  mockListCompetitions,
  mockCreateCompetition,
  mockApproveCompetition,
  mockRejectCompetition,
  mockCancelCompetition,
  mockCloseCompetition,
  __resetMockCompetitions,
} from '../services/__mocks__/competitions-mock.js';

describe('competitions-mock', () => {
  beforeEach(() => {
    __resetMockCompetitions();
  });

  test('el seed trae 3 competencias del equipo 1, con 3 estados distintos', async () => {
    const { data } = await mockListCompetitions(1);
    expect(data).toHaveLength(3);
    const statuses = data.map((c) => c.status);
    expect(statuses).toContain('active');
    expect(statuses).toContain('pending_approval');
    expect(statuses).toContain('finished');
  });

  test('filtro por status funciona', async () => {
    const { data } = await mockListCompetitions(1, { status: 'active' });
    expect(data).toHaveLength(1);
    expect(data[0].status).toBe('active');
  });

  test('crear como entrenador -> queda active de una', async () => {
    const competition = await mockCreateCompetition(1, { name: 'Nueva', type: 'metric', metric: 'distance', start_at: '2026-11-01', end_at: '2026-11-07', participant_user_ids: [2, 3] }, { isTrainerCreator: true });
    expect(competition.status).toBe('active');
    const { data } = await mockListCompetitions(1);
    expect(data).toHaveLength(4);
  });

  test('crear como corredor -> queda pending_approval', async () => {
    const competition = await mockCreateCompetition(1, { name: 'Propuesta', type: 'metric', metric: 'distance', start_at: '2026-11-01', end_at: '2026-11-07', participant_user_ids: [2, 3] }, { isTrainerCreator: false });
    expect(competition.status).toBe('pending_approval');
  });

  test('aprobar una pending_approval -> queda active', async () => {
    await mockApproveCompetition(2);
    const { data } = await mockListCompetitions(1, { status: 'active' });
    expect(data.map((c) => c.id)).toContain(2);
  });

  test('rechazar con motivo -> queda rejected con el motivo guardado', async () => {
    const competition = await mockRejectCompetition(2, 'Se superpone con otra competencia');
    expect(competition.status).toBe('rejected');
    expect(competition.rejection_reason).toBe('Se superpone con otra competencia');
  });

  test('cancelar -> la fila desaparece por completo (borrado físico real)', async () => {
    await mockCancelCompetition(2);
    const { data } = await mockListCompetitions(1);
    expect(data.map((c) => c.id)).not.toContain(2);
    expect(data).toHaveLength(2);
  });

  test('cerrar una active -> queda finished con al menos un ganador si había participantes', async () => {
    const competition = await mockCloseCompetition(1);
    expect(competition.status).toBe('finished');
    expect(competition.winner_user_ids.length).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx jest competitions-mock --verbose`
Expected: FAIL with "Cannot find module '../services/__mocks__/competitions-mock.js'"

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest competitions-mock --verbose`
Expected: PASS (8/8)

- [ ] **Step 5: Write the service**

```js
// services/competitions.js
import api from './api.js';
import { USE_MOCKS } from '../config/env.js';
import {
  mockListCompetitions,
  mockCreateCompetition,
  mockApproveCompetition,
  mockRejectCompetition,
  mockCancelCompetition,
  mockCloseCompetition,
} from './__mocks__/competitions-mock.js';

// GET /api/v1/teams/{id}/competitions -- Gap 33.
export async function listCompetitions(teamId, { status, groupId } = {}) {
  if (USE_MOCKS) return await mockListCompetitions(teamId, { status, groupId });
  const params = new URLSearchParams();
  if (status) params.set('status', status);
  if (groupId) params.set('group_id', groupId);
  const query = params.toString();
  return await api.get(`/teams/${teamId}/competitions${query ? `?${query}` : ''}`);
}

// POST /api/v1/teams/{id}/competitions -- sin created_by_user_id/created_by_role
// en el body, el backend los deriva del token (mismo criterio que Gap 27).
// `isTrainerCreator` SOLO lo usa el mock (no hay token real que simular en
// modo mock) -- la llamada real lo ignora por completo.
export async function createCompetition(teamId, payload, { isTrainerCreator } = {}) {
  if (USE_MOCKS) return await mockCreateCompetition(teamId, payload, { isTrainerCreator });
  return await api.post(`/teams/${teamId}/competitions`, payload);
}

export async function approveCompetition(id) {
  if (USE_MOCKS) return await mockApproveCompetition(id);
  return await api.patch(`/competitions/${id}/approve`, {});
}

export async function rejectCompetition(id, reason) {
  if (USE_MOCKS) return await mockRejectCompetition(id, reason);
  return await api.patch(`/competitions/${id}/reject`, reason ? { reason } : {});
}

// DELETE, no PATCH -- confirmado contra la implementación real (Gap 33,
// corrección 2026-10-14): borrado físico, solo pending_approval.
export async function cancelCompetition(id) {
  if (USE_MOCKS) return await mockCancelCompetition(id);
  return await api.delete(`/competitions/${id}/cancel`);
}

export async function closeCompetition(id) {
  if (USE_MOCKS) return await mockCloseCompetition(id);
  return await api.patch(`/competitions/${id}/close`, {});
}
```

- [ ] **Step 6: Append the normalizers**

Add to the end of `services/normalizers.js`:

```js
// Competencias (Gap 33). `winnerUserIds`/`participantUserIds` siempre
// arrays de strings (mismo criterio que el resto del repo para ids) --
// `winner_user_ids` es plural de verdad (empate exacto = todos ganan, no
// hay desempate adicional).
export function toCompetitionModel(dto) {
  if (!dto) return null;
  return {
    id: String(dto.id),
    name: dto.name,
    teamId: String(dto.team_id),
    groupId: dto.group_id != null ? String(dto.group_id) : null,
    type: dto.type,
    metric: dto.metric ?? null,
    startAt: dto.start_at,
    endAt: dto.end_at ?? null,
    route: dto.route ?? null,
    acceptanceRadiusMeters: dto.acceptance_radius_meters ?? null,
    participantUserIds: (dto.participant_user_ids ?? []).map((id) => String(id)),
    createdByUserId: String(dto.created_by_user_id),
    createdByRole: dto.created_by_role,
    status: dto.status,
    approvedByUserId: dto.approved_by_user_id != null ? String(dto.approved_by_user_id) : null,
    rejectionReason: dto.rejection_reason ?? null,
    winnerUserIds: (dto.winner_user_ids ?? []).map((id) => String(id)),
    finishedAt: dto.finished_at ?? null,
  };
}

// Payload de creación (Gap 33) -- SIN created_by_user_id/created_by_role,
// el backend los deriva del token. IDs de participantes a Number (el
// roster los trae como string -- ver CLAUDE.md "IDs numéricos en bodies
// de request").
export function toCreateCompetitionPayload(form) {
  const payload = {
    name: form.name,
    type: form.type,
    metric: form.metric,
    start_at: form.startAt,
    end_at: form.endAt,
    participant_user_ids: (form.participantUserIds ?? []).map((id) => Number(id)),
  };
  if (form.groupId) payload.group_id = Number(form.groupId);
  return payload;
}
```

- [ ] **Step 7: Run the full suite to confirm no regressions**

Run: `npm test`
Expected: all tests pass.

- [ ] **Step 8: Commit**

```bash
git add services/competitions.js services/__mocks__/competitions-mock.js services/normalizers.js __tests__/competitions-mock.test.js
git commit -m "feat(competitions): data layer — service, mutable mock and normalizers (Gap 33)"
```

---

### Task 2: Extract shared metric options

**Files:**
- Create: `utils/gamification-metric-options.js`
- Modify: `components/team/leaderboard-tab.jsx` (remove local `METRIC_OPTIONS`, import shared one)

**Interfaces:**
- Produces: `METRIC_OPTIONS` (array `{id, name}`, the same 6 metrics already used by the
  leaderboard). Used by Task 5 (`create-competition-modal.jsx`) and now also by
  `leaderboard-tab.jsx`.

- [ ] **Step 1: Write the shared constant**

```js
// utils/gamification-metric-options.js
// Las 6 métricas de gamificación (Gap 32/33) -- compartidas entre el
// selector del leaderboard (components/team/leaderboard-tab.jsx) y el de
// creación de competencia (components/team/create-competition-modal.jsx).
// Antes vivía duplicada solo en el leaderboard.
export const METRIC_OPTIONS = [
  { id: 'distance', name: 'Distancia' },
  { id: 'duration', name: 'Tiempo de entrenamiento' },
  { id: 'pace', name: 'Mejor ritmo' },
  { id: 'peak_speed', name: 'Velocidad pico' },
  { id: 'sessions_count', name: 'Entrenamientos realizados' },
  { id: 'attendance_count', name: 'Asistencias' },
];
```

- [ ] **Step 2: Update `leaderboard-tab.jsx` to import it**

```diff
 import { Row, Col, DateField } from '../forms/fields.jsx';
 import { ResponsiveSelectField } from '../forms/responsive-select-field.jsx';
 import { AvatarPicker } from '../shared/avatar-picker.jsx';
 import { useTeamLeaderboard } from '../../hooks/use-team-leaderboard.js';
 import { formatMetricValue } from '../../utils/leaderboard-metric-format.js';
 import { rankMeta } from '../../utils/leaderboard-rank-meta.js';
 import { toISODate } from '../../utils/date-field-format.js';
 import { getUserInitials } from '../../utils/user-initials.js';
-
-const METRIC_OPTIONS = [
-  { id: 'distance', name: 'Distancia' },
-  { id: 'duration', name: 'Tiempo de entrenamiento' },
-  { id: 'pace', name: 'Mejor ritmo' },
-  { id: 'peak_speed', name: 'Velocidad pico' },
-  { id: 'sessions_count', name: 'Entrenamientos realizados' },
-  { id: 'attendance_count', name: 'Asistencias' },
-];
+import { METRIC_OPTIONS } from '../../utils/gamification-metric-options.js';
```

- [ ] **Step 3: Run the full suite + lint**

Run: `npm test && npm run lint`
Expected: all green — the leaderboard tests (Task 2/3 of Spec 3) don't touch `METRIC_OPTIONS`
directly, so this refactor shouldn't break anything.

- [ ] **Step 4: Commit**

```bash
git add utils/gamification-metric-options.js components/team/leaderboard-tab.jsx
git commit -m "refactor(leaderboard): extract shared METRIC_OPTIONS for reuse in competitions"
```

---

### Task 3: `use-competitions` hooks

**Files:**
- Create: `hooks/use-competitions.js`

**Interfaces:**
- Consumes: `services/competitions.js` (Task 1), `toCompetitionModel`/`toCreateCompetitionPayload`
  (Task 1).
- Produces: `useCompetitions(teamId, {status, groupId})` → `{competitions, hasUnseen, loading,
  error}`. `useCompetitionMutations(teamId)` → `{createCompetition, approveCompetition,
  rejectCompetition, cancelCompetition, closeCompetition, isCreating, isApproving, isRejecting,
  isCancelling, isClosing}` (cada acción es `async (...) => {success, error?}`, mismo patrón que
  `hooks/use-teams.js`). Used by Task 7 (`competitions-tab.jsx`).

- [ ] **Step 1: Write the hooks (no dedicated test — thin wiring, same convention as the repo's other query/mutation hooks)**

```js
// hooks/use-competitions.js
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '../store/auth-store.js';
import {
  listCompetitions,
  createCompetition as createCompetitionService,
  approveCompetition as approveCompetitionService,
  rejectCompetition as rejectCompetitionService,
  cancelCompetition as cancelCompetitionService,
  closeCompetition as closeCompetitionService,
} from '../services/competitions.js';
import { toCompetitionModel, toCreateCompetitionPayload } from '../services/normalizers.js';

// Listado de competencias de un equipo (Gap 33) -- `hasUnseen` alimenta el
// punto rojo de la pestaña (ver hooks/use-gamification-badge.js, que NO
// suma este término al OR global a propósito -- ver la spec, sección
// "Alcance del punto rojo").
export function useCompetitions(teamId, { status, groupId } = {}) {
  const query = useQuery({
    queryKey: ['competitions', teamId, status, groupId],
    queryFn: () => listCompetitions(teamId, { status, groupId }).then((response) => ({
      competitions: (response.data ?? response).map(toCompetitionModel),
      hasUnseen: Boolean(response.has_unseen),
    })),
    enabled: Boolean(teamId),
  });

  return {
    competitions: query.data?.competitions ?? [],
    hasUnseen: query.data?.hasUnseen ?? false,
    loading: query.isLoading,
    error: query.error ?? null,
  };
}

// Las 5 mutaciones del dominio -- todas invalidan la misma queryKey al
// resolver (sin filtros: invalida cualquier variante status/groupId
// cacheada para este equipo, comportamiento default de TanStack Query).
export function useCompetitionMutations(teamId) {
  const queryClient = useQueryClient();
  const activeRole = useAuthStore((s) => s.activeRole);
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['competitions', teamId] });

  const createMutation = useMutation({
    mutationFn: (form) => createCompetitionService(teamId, toCreateCompetitionPayload(form), { isTrainerCreator: activeRole === 'trainer' }),
    onSuccess: invalidate,
  });
  const approveMutation = useMutation({ mutationFn: approveCompetitionService, onSuccess: invalidate });
  const rejectMutation = useMutation({ mutationFn: ({ id, reason }) => rejectCompetitionService(id, reason), onSuccess: invalidate });
  const cancelMutation = useMutation({ mutationFn: cancelCompetitionService, onSuccess: invalidate });
  const closeMutation = useMutation({ mutationFn: closeCompetitionService, onSuccess: invalidate });

  const wrap = (mutateAsync) => async (...args) => {
    try {
      await mutateAsync(...args);
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  };

  return {
    createCompetition: wrap(createMutation.mutateAsync),
    approveCompetition: wrap(approveMutation.mutateAsync),
    rejectCompetition: (id, reason) => wrap(rejectMutation.mutateAsync)({ id, reason }),
    cancelCompetition: wrap(cancelMutation.mutateAsync),
    closeCompetition: wrap(closeMutation.mutateAsync),
    isCreating: createMutation.isPending,
    isApproving: approveMutation.isPending,
    isRejecting: rejectMutation.isPending,
    isCancelling: cancelMutation.isPending,
    isClosing: closeMutation.isPending,
  };
}
```

- [ ] **Step 2: Run the full suite + lint**

Run: `npm test && npm run lint`
Expected: all green.

- [ ] **Step 3: Commit**

```bash
git add hooks/use-competitions.js
git commit -m "feat(competitions): use-competitions query + mutations hooks"
```

---

### Task 4: `TabBar` — optional per-tab badge

**Files:**
- Modify: `components/shared/tab-bar.jsx`

**Interfaces:**
- Produces: `<TabBar ... badges={{[tabId]: boolean}} />` (new optional prop, defaults to `{}` —
  the 3 existing consumers are unaffected). Used by Task 8 (`team-detail-screen.jsx`).

- [ ] **Step 1: Add the prop and the dot**

```diff
-export function TabBar({ active, onChange, tabs, scope = 'tab-bar' }) {
+export function TabBar({ active, onChange, tabs, scope = 'tab-bar', badges = {} }) {
   const colors = useThemeColors();
   const refs = useRef({});
```

```diff
-            <MaterialCommunityIcons name={tab.icon} size={16} color={isActive ? colors.primary : colors.onSurfaceVariant} />
+            <View className="relative" nativeID={`${scope}-${tab.id}-icon-wrapper`} testID={`${scope}-${tab.id}-icon-wrapper`}>
+              <MaterialCommunityIcons name={tab.icon} size={16} color={isActive ? colors.primary : colors.onSurfaceVariant} />
+              {badges[tab.id] && (
+                <View className="absolute -right-1 -top-1 h-2 w-2 rounded-full bg-red-500" nativeID={`${scope}-${tab.id}-badge`} testID={`${scope}-${tab.id}-badge`} />
+              )}
+            </View>
```

(`View` is already imported in this file — it's used elsewhere in the same component.)

- [ ] **Step 2: Run the full suite + lint**

Run: `npm test && npm run lint`
Expected: all green. Pay attention to `nativeID`/`testID` balance — the new wrapper `View` and
badge `View` both need theirs.

- [ ] **Step 3: Commit**

```bash
git add components/shared/tab-bar.jsx
git commit -m "feat(tab-bar): optional per-tab unseen badge dot"
```

---

### Task 5: `CreateCompetitionModal`

**Files:**
- Create: `components/team/create-competition-modal.jsx`

**Interfaces:**
- Consumes: `METRIC_OPTIONS` (Task 2), `toISODate` (`utils/date-field-format.js`, existing),
  `useFormDirty`/`useUnsavedChangesGuard`/`DiscardChangesModal` (existing, same pattern as
  `create-group-modal.jsx`).
- Produces: `<CreateCompetitionModal visible onClose onSubmit members groups />` — `onSubmit`
  receives the form object and must return `{success, error?}` (same contract as
  `CreateGroupModal`). `members`/`groups` come from the caller (Task 7), already loaded by
  `team-detail-screen.jsx`.

- [ ] **Step 1: Write the component**

```jsx
// components/team/create-competition-modal.jsx
import { useRef, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useThemeColors } from '../../theme/colors.js';
import { isWeb } from '../../utils/platform.js';
import { InputField, Row, Col, DateField } from '../forms/fields.jsx';
import { ResponsiveSelectField } from '../forms/responsive-select-field.jsx';
import { METRIC_OPTIONS } from '../../utils/gamification-metric-options.js';
import { toISODate } from '../../utils/date-field-format.js';
import { useFormDirty } from '../../hooks/use-form-dirty.js';
import { useUnsavedChangesGuard } from '../../hooks/use-unsaved-changes-guard.js';
import { DiscardChangesModal } from '../shared/discard-changes-modal.jsx';

// Alta de competencia (Gap 33, tipo 'metric' únicamente -- 'route' es
// Spec 4b). El checklist de participantes ya viene filtrado (sin el
// entrenador) por el caller -- el backend lo rechaza igual si llegara,
// pero no se lo ofrece desde el vamos.
export function CreateCompetitionModal({ visible, onClose, onSubmit, members, groups }) {
  const colors = useThemeColors();

  const [name, setName] = useState('');
  const [metric, setMetric] = useState('distance');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [groupFilter, setGroupFilter] = useState('');
  const [selectedIds, setSelectedIds] = useState([]);
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const resetKey = String(visible);
  const prevResetKeyRef = useRef(null);
  const isResetting = visible && resetKey !== prevResetKeyRef.current;

  if (isResetting) {
    prevResetKeyRef.current = resetKey;
    setName('');
    setMetric('distance');
    setStartDate('');
    setEndDate('');
    setGroupFilter('');
    setSelectedIds([]);
    setError(null);
  } else if (!visible) {
    prevResetKeyRef.current = null;
  }

  const dirtyValues = isResetting ? { name: '', selectedIds: [] } : { name, selectedIds };
  const formDirty = useFormDirty(dirtyValues, 'new');
  const isDirty = visible && formDirty;
  const { confirmVisible, guardedClose, confirmDiscard, cancelDiscard } = useUnsavedChangesGuard(isDirty);

  const handleClose = () => {
    if (submitting) return;
    guardedClose(onClose);
  };

  const visibleMembers = groupFilter ? members.filter((m) => m.groupId === groupFilter) : members;

  const toggleMember = (userId) => {
    setSelectedIds((prev) => (prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]));
  };

  const handleSubmit = async () => {
    if (submitting) return;
    const trimmedName = name.trim();
    if (!trimmedName) {
      setError('Ingresá un nombre para la competencia.');
      return;
    }
    if (!startDate || !endDate) {
      setError('Elegí la fecha de inicio y de fin.');
      return;
    }
    const startIso = toISODate(startDate);
    const endIso = toISODate(endDate);
    if (!(endIso > startIso)) {
      setError('La fecha de fin tiene que ser posterior a la de inicio.');
      return;
    }
    if (selectedIds.length < 2) {
      setError('Elegí al menos 2 participantes.');
      return;
    }

    setSubmitting(true);
    const result = await onSubmit({
      name: trimmedName,
      type: 'metric',
      metric,
      startAt: startIso,
      endAt: endIso,
      participantUserIds: selectedIds,
      groupId: groupFilter || null,
    });
    setSubmitting(false);

    if (!result.success) {
      setError(result.error);
      return;
    }
    onClose();
  };

  return (
    <>
      <Modal animationType="fade" nativeID="create-competition-modal" onRequestClose={handleClose} testID="create-competition-modal" transparent visible={visible}>
        <Pressable className="flex-1 items-center justify-center bg-black/50 px-4" nativeID="create-competition-modal-backdrop" onPress={handleClose} testID="create-competition-modal-backdrop">
          <Pressable className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-xl dark:border-slate-700 dark:bg-surface" nativeID="create-competition-modal-card" onPress={() => {}} testID="create-competition-modal-card">
            <View className="mb-4 flex-row items-center gap-2" nativeID="create-competition-modal-header" testID="create-competition-modal-header">
              <MaterialCommunityIcons color={colors.primary} name="sword-cross" size={20} />
              <Text className="text-lg font-bold text-slate-900 dark:text-white" nativeID="create-competition-modal-title" testID="create-competition-modal-title">
                Nueva competencia
              </Text>
            </View>

            <ScrollView className="max-h-[70vh]" nativeID="create-competition-modal-scroll" testID="create-competition-modal-scroll">
              <View className="gap-3" nativeID="create-competition-modal-fields" testID="create-competition-modal-fields">
                <InputField className="mb-0" dense error={error} label="Nombre" onChange={(text) => { setName(text); if (error) setError(null); }} placeholder="Ej. Desafío de octubre" value={name} />

                <ResponsiveSelectField dense label="Métrica" onChange={setMetric} options={METRIC_OPTIONS} value={metric} />

                <Row>
                  <Col>
                    <DateField label="Desde" onChange={setStartDate} value={startDate} />
                  </Col>
                  <Col>
                    <DateField label="Hasta" onChange={setEndDate} value={endDate} />
                  </Col>
                </Row>

                {groups.length > 0 && (
                  <ResponsiveSelectField
                    dense
                    label="Acotar a un grupo (opcional)"
                    onChange={setGroupFilter}
                    options={groups}
                    placeholder="Todos los grupos"
                    value={groupFilter}
                  />
                )}

                <Text className="text-xs font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500" nativeID="create-competition-modal-participants-label" testID="create-competition-modal-participants-label">
                  Participantes ({selectedIds.length})
                </Text>
                <View className="gap-1" nativeID="create-competition-modal-participants-list" testID="create-competition-modal-participants-list">
                  {visibleMembers.map((member) => {
                    const checked = selectedIds.includes(member.userId);
                    return (
                      <Pressable
                        className="flex-row items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-slate-100 active:opacity-70 dark:hover:bg-slate-800"
                        key={member.userId}
                        nativeID={`create-competition-modal-member-${member.userId}`}
                        onPress={() => toggleMember(member.userId)}
                        testID={`create-competition-modal-member-${member.userId}`}
                      >
                        <MaterialCommunityIcons color={checked ? colors.primary : colors.onSurfaceVariant} name={checked ? 'checkbox-marked' : 'checkbox-blank-outline'} size={18} />
                        <Text className="text-sm text-slate-700 dark:text-slate-200" nativeID={`create-competition-modal-member-${member.userId}-name`} testID={`create-competition-modal-member-${member.userId}-name`}>
                          {member.name}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            </ScrollView>

            <View className="mt-3 flex-row gap-3" nativeID="create-competition-modal-actions" testID="create-competition-modal-actions">
              <Pressable
                className="h-11 flex-1 items-center justify-center rounded-full border border-slate-200 hover:bg-slate-100 active:opacity-70 dark:border-slate-700 dark:hover:bg-slate-800"
                disabled={submitting}
                nativeID="create-competition-modal-cancel-button"
                onPress={handleClose}
                testID="create-competition-modal-cancel-button"
              >
                <Text className="text-sm font-semibold text-slate-700 dark:text-slate-200" nativeID="create-competition-modal-cancel-label" testID="create-competition-modal-cancel-label">Cancelar</Text>
              </Pressable>
              <Pressable
                className="h-11 flex-1 flex-row items-center justify-center gap-1.5 rounded-full bg-primary hover:opacity-90 active:opacity-80"
                disabled={submitting}
                nativeID="create-competition-modal-confirm-button"
                onPress={handleSubmit}
                testID="create-competition-modal-confirm-button"
              >
                {submitting ? <ActivityIndicator color={colors.onPrimary} size="small" /> : (
                  <Text className="text-sm font-semibold uppercase tracking-wide text-[#111518]" nativeID="create-competition-modal-confirm-label" testID="create-competition-modal-confirm-label">
                    Crear
                  </Text>
                )}
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
      <DiscardChangesModal onCancel={cancelDiscard} onConfirm={confirmDiscard} visible={confirmVisible} />
    </>
  );
}
```

- [ ] **Step 2: Run the full suite + lint**

Run: `npm test && npm run lint`
Expected: all green.

- [ ] **Step 3: Commit**

```bash
git add components/team/create-competition-modal.jsx
git commit -m "feat(competitions): CreateCompetitionModal"
```

---

### Task 6: `RejectCompetitionModal`

**Files:**
- Create: `components/team/reject-competition-modal.jsx`

**Interfaces:**
- Produces: `<RejectCompetitionModal visible onClose onConfirm />` — `onConfirm(reason)` where
  `reason` is a trimmed string or `null` if left empty.

- [ ] **Step 1: Write the component**

```jsx
// components/team/reject-competition-modal.jsx
import { useEffect, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, Text, View } from 'react-native';
import { useThemeColors } from '../../theme/colors.js';
import { InputField } from '../forms/fields.jsx';

// Rechazo de una propuesta de competencia (Gap 33) -- motivo opcional,
// sin guard de cambios sin guardar (es un solo campo de texto corto, no
// amerita el mecanismo completo de useFormDirty/useUnsavedChangesGuard).
export function RejectCompetitionModal({ visible, onClose, onConfirm }) {
  const colors = useThemeColors();
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (visible) setReason('');
  }, [visible]);

  const handleConfirm = async () => {
    if (submitting) return;
    setSubmitting(true);
    await onConfirm(reason.trim() || null);
    setSubmitting(false);
  };

  return (
    <Modal animationType="fade" nativeID="reject-competition-modal" onRequestClose={onClose} testID="reject-competition-modal" transparent visible={visible}>
      <Pressable className="flex-1 items-center justify-center bg-black/50 px-4" nativeID="reject-competition-modal-backdrop" onPress={onClose} testID="reject-competition-modal-backdrop">
        <Pressable className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-xl dark:border-slate-700 dark:bg-surface" nativeID="reject-competition-modal-card" onPress={() => {}} testID="reject-competition-modal-card">
          <Text className="mb-3 text-lg font-bold text-slate-900 dark:text-white" nativeID="reject-competition-modal-title" testID="reject-competition-modal-title">
            Rechazar propuesta
          </Text>
          <InputField className="mb-0" dense hideErrorRow label="Motivo (opcional)" multiline numberOfLines={3} onChange={setReason} placeholder="Ej. Se superpone con otra competencia." value={reason} />
          <View className="mt-4 flex-row gap-3" nativeID="reject-competition-modal-actions" testID="reject-competition-modal-actions">
            <Pressable
              className="h-11 flex-1 items-center justify-center rounded-full border border-slate-200 hover:bg-slate-100 active:opacity-70 dark:border-slate-700 dark:hover:bg-slate-800"
              disabled={submitting}
              nativeID="reject-competition-modal-cancel-button"
              onPress={onClose}
              testID="reject-competition-modal-cancel-button"
            >
              <Text className="text-sm font-semibold text-slate-700 dark:text-slate-200" nativeID="reject-competition-modal-cancel-label" testID="reject-competition-modal-cancel-label">Volver</Text>
            </Pressable>
            <Pressable
              className="h-11 flex-1 flex-row items-center justify-center gap-1.5 rounded-full bg-red-600 active:opacity-80"
              disabled={submitting}
              nativeID="reject-competition-modal-confirm-button"
              onPress={handleConfirm}
              testID="reject-competition-modal-confirm-button"
            >
              {submitting ? <ActivityIndicator color="#fff" size="small" /> : (
                <Text className="text-sm font-semibold uppercase tracking-wide text-white" nativeID="reject-competition-modal-confirm-label" testID="reject-competition-modal-confirm-label">
                  Rechazar
                </Text>
              )}
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
```

- [ ] **Step 2: Run the full suite + lint**

Run: `npm test && npm run lint`
Expected: all green.

- [ ] **Step 3: Commit**

```bash
git add components/team/reject-competition-modal.jsx
git commit -m "feat(competitions): RejectCompetitionModal"
```

---

### Task 7: `CompetitionsTab`

**Files:**
- Create: `components/team/competitions-tab.jsx`

**Interfaces:**
- Consumes: `useCompetitions`/`useCompetitionMutations` (Task 3), `CreateCompetitionModal`
  (Task 5), `RejectCompetitionModal` (Task 6), `useGamificationBadge()` (existing, for
  `ackSection('competitions', teamId)`), `formatMetricValue`? — **no**, this tab does not show
  progress values (out of scope for 4a, see spec) — only `METRIC_OPTIONS` to resolve a metric id
  to its label for display.
- Produces: `<CompetitionsTab teamId members groups isTrainerView currentUserId />`. Used by
  Task 8 (`team-detail-screen.jsx`).

- [ ] **Step 1: Write the component**

```jsx
// components/team/competitions-tab.jsx
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import Toast from 'react-native-toast-message';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useThemeColors } from '../../theme/colors.js';
import { useCompetitions, useCompetitionMutations } from '../../hooks/use-competitions.js';
import { useGamificationBadge } from '../../hooks/use-gamification-badge.js';
import { METRIC_OPTIONS } from '../../utils/gamification-metric-options.js';
import { CreateCompetitionModal } from './create-competition-modal.jsx';
import { RejectCompetitionModal } from './reject-competition-modal.jsx';
import { notifySuccess, notifyError } from '../../utils/haptics.js';

const STATUS_META = {
  pending_approval: { label: 'Pendiente de aprobación', bg: 'bg-amber-100 dark:bg-amber-900/30', text: 'text-amber-700 dark:text-amber-400' },
  active: { label: 'Activa', bg: 'bg-primary-tint dark:bg-primary/15', text: 'text-on-primary-tint dark:text-primary' },
  finished: { label: 'Finalizada', bg: 'bg-sky-100 dark:bg-sky-900/30', text: 'text-sky-700 dark:text-sky-400' },
  rejected: { label: 'Rechazada', bg: 'bg-slate-200 dark:bg-slate-800', text: 'text-slate-600 dark:text-slate-300' },
};

function metricLabel(metric) {
  return METRIC_OPTIONS.find((m) => m.id === metric)?.name ?? metric;
}

function memberName(members, userId) {
  return members.find((m) => m.userId === userId)?.name ?? 'Corredor';
}

function CompetitionRow({ competition, members, isTrainerView, currentUserId, onApprove, onReject, onCancel, onClose, busy }) {
  const colors = useThemeColors();
  const [expanded, setExpanded] = useState(false);
  const statusMeta = STATUS_META[competition.status] ?? STATUS_META.rejected;
  const idPrefix = `competitions-tab-row-${competition.id}`;

  const isOwnPendingProposal = competition.status === 'pending_approval' && competition.createdByRole === 'runner' && competition.createdByUserId === currentUserId;
  const canClose = isTrainerView && competition.status === 'active' && competition.endAt && competition.endAt < new Date().toISOString().slice(0, 10);

  return (
    <View className="rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-surface" nativeID={idPrefix} testID={idPrefix}>
      <Pressable className="flex-row items-center gap-2" nativeID={`${idPrefix}-header`} onPress={() => setExpanded((v) => !v)} testID={`${idPrefix}-header`}>
        <MaterialCommunityIcons color={colors.onSurfaceVariant} name={expanded ? 'chevron-down' : 'chevron-right'} size={18} />
        <Text className="flex-1 text-sm font-semibold text-slate-900 dark:text-white" nativeID={`${idPrefix}-name`} numberOfLines={1} testID={`${idPrefix}-name`}>
          {competition.name}
        </Text>
        <View className={`rounded-full px-2 py-0.5 ${statusMeta.bg}`} nativeID={`${idPrefix}-status`} testID={`${idPrefix}-status`}>
          <Text className={`text-xs font-semibold ${statusMeta.text}`} nativeID={`${idPrefix}-status-label`} testID={`${idPrefix}-status-label`}>
            {statusMeta.label}
          </Text>
        </View>
      </Pressable>

      <Text className="mt-1 text-xs text-slate-500 dark:text-slate-400" nativeID={`${idPrefix}-meta`} testID={`${idPrefix}-meta`}>
        {metricLabel(competition.metric)} · {competition.startAt} → {competition.endAt}
      </Text>

      {expanded && (
        <View className="mt-3 gap-1" nativeID={`${idPrefix}-participants`} testID={`${idPrefix}-participants`}>
          {competition.participantUserIds.map((userId) => {
            const isWinner = competition.winnerUserIds.includes(userId);
            return (
              <View className="flex-row items-center gap-1.5" key={userId} nativeID={`${idPrefix}-participant-${userId}`} testID={`${idPrefix}-participant-${userId}`}>
                {isWinner && <MaterialCommunityIcons color="#eab308" name="trophy" size={14} />}
                <Text className="text-sm text-slate-700 dark:text-slate-200" nativeID={`${idPrefix}-participant-${userId}-name`} testID={`${idPrefix}-participant-${userId}-name`}>
                  {memberName(members, userId)}
                </Text>
              </View>
            );
          })}
          {competition.status === 'finished' && competition.winnerUserIds.length === 0 && (
            <Text className="text-xs text-slate-400 dark:text-slate-500" nativeID={`${idPrefix}-no-winner`} testID={`${idPrefix}-no-winner`}>
              Sin ganador — nadie completó un intento.
            </Text>
          )}
        </View>
      )}

      <View className="mt-3 flex-row gap-2" nativeID={`${idPrefix}-actions`} testID={`${idPrefix}-actions`}>
        {isTrainerView && competition.status === 'pending_approval' && (
          <>
            <Pressable className="h-9 flex-1 items-center justify-center rounded-full bg-primary active:opacity-80 disabled:opacity-60" disabled={busy} nativeID={`${idPrefix}-approve-button`} onPress={() => onApprove(competition.id)} testID={`${idPrefix}-approve-button`}>
              <Text className="text-xs font-semibold uppercase tracking-wide text-[#111518]" nativeID={`${idPrefix}-approve-label`} testID={`${idPrefix}-approve-label`}>Aprobar</Text>
            </Pressable>
            <Pressable className="h-9 flex-1 items-center justify-center rounded-full border border-slate-200 active:opacity-80 disabled:opacity-60 dark:border-slate-700" disabled={busy} nativeID={`${idPrefix}-reject-button`} onPress={() => onReject(competition.id)} testID={`${idPrefix}-reject-button`}>
              <Text className="text-xs font-semibold uppercase tracking-wide text-slate-700 dark:text-slate-200" nativeID={`${idPrefix}-reject-label`} testID={`${idPrefix}-reject-label`}>Rechazar</Text>
            </Pressable>
          </>
        )}
        {isOwnPendingProposal && (
          <Pressable className="h-9 flex-1 items-center justify-center rounded-full border border-red-200 active:opacity-80 disabled:opacity-60 dark:border-red-900/40" disabled={busy} nativeID={`${idPrefix}-cancel-button`} onPress={() => onCancel(competition.id)} testID={`${idPrefix}-cancel-button`}>
            <Text className="text-xs font-semibold uppercase tracking-wide text-red-600 dark:text-red-400" nativeID={`${idPrefix}-cancel-label`} testID={`${idPrefix}-cancel-label`}>Cancelar</Text>
          </Pressable>
        )}
        {canClose && (
          <Pressable className="h-9 flex-1 items-center justify-center rounded-full border border-amber-300 active:opacity-80 disabled:opacity-60 dark:border-amber-700" disabled={busy} nativeID={`${idPrefix}-close-button`} onPress={() => onClose(competition.id)} testID={`${idPrefix}-close-button`}>
            <Text className="text-xs font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-400" nativeID={`${idPrefix}-close-label`} testID={`${idPrefix}-close-label`}>Cerrar</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

export function CompetitionsTab({ teamId, members, groups, isTrainerView, currentUserId }) {
  const colors = useThemeColors();
  const { competitions, loading, error } = useCompetitions(teamId);
  const mutations = useCompetitionMutations(teamId);
  const { ackSection } = useGamificationBadge();
  const [createVisible, setCreateVisible] = useState(false);
  const [rejectTargetId, setRejectTargetId] = useState(null);

  useEffect(() => {
    ackSection('competitions', teamId);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- solo al montar, mismo criterio que achievements-screen.jsx (Spec 1)
  }, []);

  const handleApprove = async (id) => {
    const result = await mutations.approveCompetition(id);
    if (result.success) { notifySuccess(); Toast.show({ type: 'success', text1: 'Competencia aprobada' }); }
    else { notifyError(); Toast.show({ type: 'error', text1: 'No pudimos aprobar la competencia', text2: result.error }); }
  };

  const handleRejectConfirm = async (reason) => {
    const result = await mutations.rejectCompetition(rejectTargetId, reason);
    setRejectTargetId(null);
    if (result.success) { notifySuccess(); Toast.show({ type: 'success', text1: 'Competencia rechazada' }); }
    else { notifyError(); Toast.show({ type: 'error', text1: 'No pudimos rechazar la competencia', text2: result.error }); }
  };

  const handleCancel = async (id) => {
    const result = await mutations.cancelCompetition(id);
    if (result.success) { notifySuccess(); Toast.show({ type: 'success', text1: 'Propuesta cancelada' }); }
    else { notifyError(); Toast.show({ type: 'error', text1: 'No pudimos cancelar la propuesta', text2: result.error }); }
  };

  const handleClose = async (id) => {
    const result = await mutations.closeCompetition(id);
    if (result.success) { notifySuccess(); Toast.show({ type: 'success', text1: 'Competencia cerrada' }); }
    else { notifyError(); Toast.show({ type: 'error', text1: 'No pudimos cerrar la competencia', text2: result.error }); }
  };

  const busy = mutations.isApproving || mutations.isRejecting || mutations.isCancelling || mutations.isClosing;

  return (
    <View nativeID="competitions-tab-root" testID="competitions-tab-root">
      <Pressable className="mb-4 h-10 flex-row items-center justify-center gap-1.5 self-start rounded-full bg-primary px-4 active:opacity-80" nativeID="competitions-tab-create-button" onPress={() => setCreateVisible(true)} testID="competitions-tab-create-button">
        <MaterialCommunityIcons color={colors.onPrimary} name="plus" size={16} />
        <Text className="text-xs font-semibold uppercase tracking-wide text-[#111518]" nativeID="competitions-tab-create-label" testID="competitions-tab-create-label">Nueva competencia</Text>
      </Pressable>

      {loading && (
        <View className="items-center py-6" nativeID="competitions-tab-loading" testID="competitions-tab-loading">
          <ActivityIndicator color={colors.primary} />
        </View>
      )}

      {!loading && error && (
        <Text className="text-sm text-slate-400 dark:text-slate-500" nativeID="competitions-tab-error" testID="competitions-tab-error">
          No pudimos cargar las competencias.
        </Text>
      )}

      {!loading && !error && competitions.length === 0 && (
        <Text className="text-sm text-slate-400 dark:text-slate-500" nativeID="competitions-tab-empty" testID="competitions-tab-empty">
          Todavía no hay competencias en este equipo.
        </Text>
      )}

      {!loading && !error && competitions.length > 0 && (
        <View className="gap-3" nativeID="competitions-tab-list" testID="competitions-tab-list">
          {competitions.map((competition) => (
            <CompetitionRow
              busy={busy}
              competition={competition}
              currentUserId={currentUserId}
              isTrainerView={isTrainerView}
              key={competition.id}
              members={members}
              onApprove={handleApprove}
              onCancel={handleCancel}
              onClose={handleClose}
              onReject={setRejectTargetId}
            />
          ))}
        </View>
      )}

      <CreateCompetitionModal
        groups={groups}
        members={members}
        onClose={() => setCreateVisible(false)}
        onSubmit={mutations.createCompetition}
        visible={createVisible}
      />
      <RejectCompetitionModal
        onClose={() => setRejectTargetId(null)}
        onConfirm={handleRejectConfirm}
        visible={rejectTargetId != null}
      />
    </View>
  );
}
```

- [ ] **Step 2: Run the full suite + lint**

Run: `npm test && npm run lint`
Expected: all green. Pay attention to `nativeID`/`testID` balance in this file — it has the most
tags of any file in this plan.

- [ ] **Step 3: Commit**

```bash
git add components/team/competitions-tab.jsx
git commit -m "feat(competitions): CompetitionsTab — list, expand, moderation actions"
```

---

### Task 8: Wire into `team-detail-screen.jsx`

**Files:**
- Modify: `components/team/team-detail-screen.jsx`

**Interfaces:**
- Consumes: `<CompetitionsTab teamId members groups isTrainerView currentUserId />` (Task 7),
  `useCompetitions()` (Task 3, used here only to read `hasUnseen` for the tab badge).

- [ ] **Step 1: Add the imports**

```diff
 import { LeaderboardTab } from './leaderboard-tab.jsx';
+import { CompetitionsTab } from './competitions-tab.jsx';
+import { useCompetitions } from '../../hooks/use-competitions.js';
```

- [ ] **Step 2: Add the tab definition**

```diff
   { id: 'leaderboard', label: 'Leaderboard', icon: 'podium-gold' },
+  { id: 'competencias', label: 'Competencias', icon: 'sword-cross' },
   { id: 'solicitudes', label: 'Solicitudes', icon: 'account-question-outline' },
 ];
```

No change needed to `visibleTabs` (same reasoning as `leaderboard`: neither `grupos` nor
`solicitudes`, passes the filter unconditionally).

- [ ] **Step 3: Read the badge flag and pass it to `TabBar`**

Find where `leaderboardContent` is defined and add right after it:

```diff
   const leaderboardContent = <LeaderboardTab teamId={team.id} />;
+  const { hasUnseen: competitionsHasUnseen } = useCompetitions(team?.id);
+  const competitionsContent = (
+    <CompetitionsTab currentUserId={user?.userId} groups={groupOptions} isTrainerView={isTrainerView} members={members} teamId={team.id} />
+  );
```

(`groupOptions`/`members`/`isTrainerView`/`user` already exist in this file — `groupOptions` is
the same `{id, name}` array already built for the group filter picker in the Corredores tab;
`members` is the roster array from `useTeamRoster`.)

Find the `<TabBar ... tabs={visibleTabs} />` line and add the `badges` prop:

```diff
-        <TabBar active={activeTab} onChange={setActiveTab} scope="team-detail-tab-bar" tabs={visibleTabs} />
+        <TabBar active={activeTab} badges={{ competencias: competitionsHasUnseen }} onChange={setActiveTab} scope="team-detail-tab-bar" tabs={visibleTabs} />
```

- [ ] **Step 4: Render it**

```diff
         {activeTab === 'leaderboard' && leaderboardContent}
+        {activeTab === 'competencias' && competitionsContent}
         {activeTab === 'solicitudes' && solicitudesContent}
```

- [ ] **Step 5: Invalidate on pull-to-refresh**

```diff
     queryClient.invalidateQueries({ queryKey: ['leaderboard', teamId] }),
+    queryClient.invalidateQueries({ queryKey: ['competitions', teamId] }),
   ]));
```

- [ ] **Step 6: Run the full suite + lint**

Run: `npm test && npm run lint`
Expected: all green.

- [ ] **Step 7: Commit**

```bash
git add components/team/team-detail-screen.jsx
git commit -m "feat(competitions): wire Competencias tab + badge into team-detail-screen"
```

---

### Task 9: Final verification + manual test script

**Files:** none (verification only).

- [ ] **Step 1: Run the full test suite**

Run: `npm test`
Expected: all tests pass, including every new test file from Task 1.

- [ ] **Step 2: Run lint**

Run: `npm run lint`
Expected: 0 errors.

- [ ] **Step 3: Grep-check `nativeID`/`testID` balance on every new/modified file**

```bash
for f in services/competitions.js services/__mocks__/competitions-mock.js utils/gamification-metric-options.js hooks/use-competitions.js components/shared/tab-bar.jsx components/team/create-competition-modal.jsx components/team/reject-competition-modal.jsx components/team/competitions-tab.jsx components/team/team-detail-screen.jsx components/team/leaderboard-tab.jsx; do
  n=$(grep -o 'nativeID=' "$f" | wc -l); t=$(grep -o 'testID=' "$f" | wc -l)
  result="OK"; [ "$n" != "$t" ] && result="MISMATCH"
  echo "$f: nativeID=$n testID=$t $result"
done
```

Expected: `nativeID` count equals `testID` count on every line.

- [ ] **Step 4: Output the manual test script (paste verbatim in the final chat reply — do not skip)**

```
Manual test script — Gamificación Spec 4a (Competencias CRUD/moderación)

Setup: EXPO_PUBLIC_USE_MOCKS=true, reiniciar el dev server tras cualquier cambio de env.

1. Entrar al detalle de un equipo — confirmar pestaña nueva "Competencias" entre "Leaderboard" y
   "Solicitudes", con un punto rojo (el mock trae una propuesta pending_approval).
2. Abrir la pestaña — confirmar 3 filas (mock seed): "Desafío de octubre" (Activa), "Propuesta de
   Martín" (Pendiente de aprobación, ámbar), "Reto de septiembre" (Finalizada, azul).
3. Tap en cualquier fila — confirmar que se expande mostrando la lista de participantes por
   nombre (resueltos contra el roster real del equipo). En "Reto de septiembre", confirmar que el
   participante ganador tiene un ícono de trofeo.
4. Como entrenador: en "Propuesta de Martín", confirmar botones Aprobar/Rechazar. Aprobar →
   confirmar que pasa a "Activa" y desaparece el punto rojo de la pestaña. Recargar el mock
   (reiniciar la app) y esta vez tocar Rechazar → confirmar que abre el modal de motivo, escribir
   algo, Rechazar → confirmar que la fila pasa a "Rechazada".
5. En "Desafío de octubre" (Activa): confirmar que NO hay ningún botón de cancelar — solo debería
   aparecer un botón "Cerrar" si `end_at` ya pasó (el mock la tiene con fecha pasada, octubre
   2026 ya corrió) — confirmar que aparece y que al tocarlo pasa a "Finalizada".
6. Crear una competencia nueva: tocar "Nueva competencia", completar nombre/métrica/fechas,
   marcar al menos 2 participantes del checklist, confirmar que el entrenador NO aparece como
   opción en la lista. Guardar sin marcar 2 participantes → confirmar mensaje de error antes de
   mandar nada. Guardar bien → confirmar que aparece en la lista como "Activa" (entrenador) o
   "Pendiente de aprobación" si se prueba con un corredor (cambiar de rol).
7. Como corredor, en una competencia `pending_approval` que él mismo propuso: confirmar que ve un
   botón "Cancelar" (y no lo ven los demás roles) — tocarlo y confirmar que la fila desaparece
   directamente de la lista (no queda en ningún estado "cancelada").
8. Confirmar responsive: angostar el viewport web progresivamente — la lista y el modal de
   creación no deben romperse en ningún punto intermedio.
```

- [ ] **Step 5: Confirm clean working tree**

```bash
git status --porcelain
```

Expected: clean.
