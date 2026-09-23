# Aggregated Calendar View (Piece 2) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a read-only, cross-group calendar view (one screen per role — corredor sees `member-calendar`, entrenador sees `administered-calendar`) reachable from a new header nav item, with a day-detail modal that supports multiple assignments on the same date.

**Architecture:** Two new TanStack Query read hooks wrap the two new backend endpoints (`GET /users/{id}/member-calendar`, `GET /users/{id}/administered-calendar`) plus the already-documented `GET /users/{id}/calendar-summary`. A shared month-view component renders day cells with stacked dots (one per assignment) and, for the entrenador only, a collision badge. A shared day-detail modal lists all assignments for a tapped date, with a role-specific `variant` prop controlling whether a "go to this group" button appears. Two thin screen components wire the hooks to the shared components; two new nav routes (filtered by `role`, same pattern as `myPlansRoute`/`trainingPlansRoute`) expose them. All writes continue to happen exclusively through the existing per-group screens — this view never mutates.

**Tech Stack:** React Native + Expo Router, NativeWind, TanStack Query, `react-native-calendars`, Jest.

**Spec:** `docs/superpowers/specs/2026-09-22-aggregated-calendar-view-design.md`

## Global Constraints

- Every visual element (`View`/`Text`/`Pressable`/etc., including `Animated.*`) needs both `nativeID` and `testID`, kebab-case, unique in its context — enforced by ESLint rule `local/require-native-id`.
- Every `Modal` with a backdrop must close on backdrop click (backdrop `Pressable` with `onPress` = the same close handler as `onRequestClose`) — enforced by `local/require-modal-backdrop-close`.
- No component render tests (project convention) — Jest only for pure logic (normalizers, mocks, utils).
- Responsive web is mandatory from day one — no desktop-only screens. Reuse the `isWeb` + `max-w-3xl` centering pattern already used in `group-calendar-screen.jsx` (no dedicated narrow variant needed, per the design doc — the content is already fluid).
- `npm test` and `npm run lint` must be green before each commit.

---

### Task 1: `toAggregatedCalendarDayModel` normalizer

**Files:**
- Modify: `services/normalizers.js` (add after `toGroupCalendarDayModel`, which ends around line 591)
- Test: `__tests__/normalizers.test.js`

**Interfaces:**
- Consumes: `toGroupCalendarDayModel(dto)` (already exported, same file) — returns `{id, groupId, date, kind, otherName, sessionInstance, cancelledReason, isPresencial, presencialTimeFrom, presencialTimeTo, presencialLocation, sourcePlanId}`.
- Produces: `toAggregatedCalendarDayModel(dto)` — everything `toGroupCalendarDayModel` produces, plus `groupName: string`, `teamId: string`, `teamName: string`, `presencialCollision: {type: 'same_team'|'cross_team', conflicts: Array} | null`. Tasks 2 and 3 import and use this.

- [ ] **Step 1: Write the failing tests**

Add to `__tests__/normalizers.test.js` (find the `describe` block for `toGroupCalendarDayModel` and add a sibling block right after it):

```js
describe('toAggregatedCalendarDayModel', () => {
  test('suma group_name/team_id/team_name y mapea presencial_collision', () => {
    const dto = {
      id: 5, group_id: 7, date: '2026-10-05', kind: 'training', other_name: null,
      session_instance: null, cancelled_reason: null, is_presencial: true,
      presencial_time_from: '08:00', presencial_time_to: '09:30',
      presencial_location: { lat: -34.6, lng: -58.4, label: 'Plaza' },
      source_plan_id: null,
      group_name: 'Elite AM', team_id: 3, team_name: 'Runners Norte',
      presencial_collision: {
        type: 'same_team',
        conflicts: [{ group_id: 9, group_name: 'Elite PM', team_id: 3, team_name: 'Runners Norte', date: '2026-10-05', presencial_time_from: '08:30', presencial_time_to: '10:00' }],
      },
    };
    const model = toAggregatedCalendarDayModel(dto);
    expect(model.groupId).toBe('7');
    expect(model.groupName).toBe('Elite AM');
    expect(model.teamId).toBe('3');
    expect(model.teamName).toBe('Runners Norte');
    expect(model.presencialCollision).toEqual({
      type: 'same_team',
      conflicts: [{ group_id: 9, group_name: 'Elite PM', team_id: 3, team_name: 'Runners Norte', date: '2026-10-05', presencial_time_from: '08:30', presencial_time_to: '10:00' }],
    });
  });

  test('presencialCollision es null si el día no colisiona', () => {
    const dto = {
      id: 5, group_id: 7, date: '2026-10-05', kind: 'rest', other_name: null,
      session_instance: null, cancelled_reason: null, is_presencial: false,
      presencial_time_from: null, presencial_time_to: null, presencial_location: null,
      source_plan_id: null, group_name: 'Elite AM', team_id: 3, team_name: 'Runners Norte',
    };
    const model = toAggregatedCalendarDayModel(dto);
    expect(model.presencialCollision).toBeNull();
  });
});
```

Also add `toAggregatedCalendarDayModel` to the top-of-file import list in `__tests__/normalizers.test.js` (find the existing `import { ..., toGroupCalendarDayModel, ... } from '../services/normalizers.js';` line and add the new name to it).

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx jest normalizers.test.js -t "toAggregatedCalendarDayModel"`
Expected: FAIL — `toAggregatedCalendarDayModel is not a function` (or import undefined).

- [ ] **Step 3: Implement the normalizer**

In `services/normalizers.js`, immediately after the closing `}` of `toGroupCalendarDayModel` (around line 591), add:

```js
// Día de la vista agregada (member-calendar/administered-calendar, Gap
// 11) — todo lo de toGroupCalendarDayModel más group/team resueltos
// server-side y, solo en administered-calendar, presencial_collision.
export function toAggregatedCalendarDayModel(dto) {
  const base = toGroupCalendarDayModel(dto);
  if (!base) return null;
  return {
    ...base,
    groupName: dto.group_name,
    teamId: String(dto.team_id),
    teamName: dto.team_name,
    presencialCollision: dto.presencial_collision
      ? { type: dto.presencial_collision.type, conflicts: dto.presencial_collision.conflicts }
      : null,
  };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx jest normalizers.test.js`
Expected: PASS, all tests in the file green (not just the new ones — confirms nothing else broke).

- [ ] **Step 5: Commit**

```bash
git add services/normalizers.js __tests__/normalizers.test.js
git commit -m "feat(calendar): add toAggregatedCalendarDayModel normalizer"
```

---

### Task 2: Services + mocks for the 3 aggregate read endpoints

**Files:**
- Modify: `services/calendar.js`
- Modify: `services/__mocks__/calendar-mock.js`
- Test: `__tests__/calendar-mock.test.js`

**Interfaces:**
- Consumes: `mockGetGroupCalendar(groupId, from, to)` (existing, same file, returns array of snake_case day objects), `__getAllMockTeams()` (from `services/__mocks__/teams-mock.js`, returns `[{id, owner_id, name, ...}]`), `mockListGroups(teamId)` and `mockGetGroupUsers(groupId)` (from `services/__mocks__/groups-mock.js`, return `[{id, team_id, name, ...}]` and `[{group_id, user_id, ...}]` respectively).
- Produces: `getMemberCalendar(userId, from, to)`, `getAdministeredCalendar(userId, from, to)`, `getCalendarSummary(userId)` in `services/calendar.js` — each resolves to an array of plain objects (snake_case, matching the real backend response) for the non-mock branch, or the equivalent mock array for `USE_MOCKS`. Task 3's hooks consume these three functions.

- [ ] **Step 1: Write the failing tests**

Add to `__tests__/calendar-mock.test.js`, after the existing `describe('mockShiftCalendar', ...)` block (append at the end of the file):

```js
describe('mockGetAdministeredCalendar', () => {
  test('trae los días de todos los grupos que administra el owner_id, taggeados con group/team', async () => {
    // owner_id 1 administra los teams 1 y 4 (services/__mocks__/teams-mock.js).
    // El team 1 tiene un único grupo default ("General").
    const groups = await mockListGroups(1);
    const generalGroupId = groups[0].id;
    await mockUpsertCalendarDay(generalGroupId, '2026-10-05', { kind: 'rest' });

    const result = await mockGetAdministeredCalendar(1, '2026-10-01', '2026-10-31');
    expect(result).toHaveLength(1);
    expect(result[0].group_name).toBe('General');
    expect(result[0].team_id).toBe(1);
    expect(result[0].team_name).toBe('Corredores del Sur');
    expect(result[0].presencial_collision).toBeUndefined();
  });

  test('no trae días de un equipo que no administra', async () => {
    // owner_id 99 administra los teams 2 y 3, no el 1 — el día cargado acá
    // no debe aparecer en la respuesta de 99, aunque exista.
    const groups = await mockListGroups(1);
    await mockUpsertCalendarDay(groups[0].id, '2026-10-05', { kind: 'rest' });
    const result = await mockGetAdministeredCalendar(99, '2026-10-01', '2026-10-31');
    expect(result.find((d) => d.date === '2026-10-05' && d.team_id === 1)).toBeUndefined();
  });
});

describe('mockGetMemberCalendar', () => {
  test('trae los días de los grupos de los que el usuario es miembro', async () => {
    // "Runners Mendoza" (team 4) siembra FICTITIOUS_RUNNER_IDS como
    // miembros de su grupo "General" (services/__mocks__/teams-mock.js).
    const groups = await mockListGroups(4);
    const generalGroup = groups.find((g) => g.name === 'General');
    const members = await mockGetGroupUsers(generalGroup.id);
    const memberUserId = members[0].user_id;
    await mockUpsertCalendarDay(generalGroup.id, '2026-10-05', { kind: 'rest' });

    const result = await mockGetMemberCalendar(memberUserId, '2026-10-01', '2026-10-31');
    expect(result.some((d) => d.date === '2026-10-05' && d.group_name === 'General' && d.team_name === 'Runners Mendoza')).toBe(true);
  });

  test('usuario sin membresías no trae nada', async () => {
    const result = await mockGetMemberCalendar(999999, '2026-10-01', '2026-10-31');
    expect(result).toEqual([]);
  });
});

describe('mockGetCalendarSummary', () => {
  test('lista los grupos de los que el usuario es miembro', async () => {
    const groups = await mockListGroups(4);
    const generalGroup = groups.find((g) => g.name === 'General');
    const members = await mockGetGroupUsers(generalGroup.id);
    const memberUserId = members[0].user_id;

    const result = await mockGetCalendarSummary(memberUserId);
    expect(result).toEqual(expect.arrayContaining([{ group_id: generalGroup.id, group_name: 'General' }]));
  });
});
```

Add the new mock imports to the top of `__tests__/calendar-mock.test.js`:

```js
import {
  mockGetGroupCalendar, mockUpsertCalendarDay, mockDeleteCalendarDay, mockStampPlan,
  mockBulkAssignDays, mockBulkClearDays, mockShiftCalendar,
  mockGetAdministeredCalendar, mockGetMemberCalendar, mockGetCalendarSummary,
  __resetMockCalendar,
} from '../services/__mocks__/calendar-mock.js';
import { mockListGroups, mockGetGroupUsers } from '../services/__mocks__/groups-mock.js';
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx jest calendar-mock.test.js -t "mockGetAdministeredCalendar"`
Expected: FAIL — `mockGetAdministeredCalendar is not a function`.

- [ ] **Step 3: Implement the mocks**

In `services/__mocks__/calendar-mock.js`, add these imports near the top (alongside the existing `mockGetSession`/`mockGetTrainingPlan` imports):

```js
import { __getAllMockTeams } from './teams-mock.js';
import { mockListGroups, mockGetGroupUsers } from './groups-mock.js';
```

Add these functions at the end of the file, before `__resetMockCalendar`:

```js
async function groupsAdministeredBy(userId) {
  const teams = __getAllMockTeams().filter((t) => String(t.owner_id) === String(userId));
  const result = [];
  for (const team of teams) {
    const groups = await mockListGroups(team.id);
    for (const group of groups) result.push({ group, team });
  }
  return result;
}

async function groupsWhereMember(userId) {
  const teams = __getAllMockTeams();
  const result = [];
  for (const team of teams) {
    const groups = await mockListGroups(team.id);
    for (const group of groups) {
      const members = await mockGetGroupUsers(group.id);
      if (members.some((m) => String(m.user_id) === String(userId))) result.push({ group, team });
    }
  }
  return result;
}

// administered-calendar (Gap 11) — no simula presencial_collision (mismo
// criterio que same_team_warnings en los mocks de escritura: requeriría
// modelar el algoritmo de colisión acá, sin valor real para un mock local).
export async function mockGetAdministeredCalendar(userId, from, to) {
  const administered = await groupsAdministeredBy(userId);
  const results = [];
  for (const { group, team } of administered) {
    const days = await mockGetGroupCalendar(group.id, from, to);
    for (const day of days) results.push({ ...day, group_name: group.name, team_id: team.id, team_name: team.name });
  }
  return results;
}

export async function mockGetMemberCalendar(userId, from, to) {
  const memberships = await groupsWhereMember(userId);
  const results = [];
  for (const { group, team } of memberships) {
    const days = await mockGetGroupCalendar(group.id, from, to);
    for (const day of days) results.push({ ...day, group_name: group.name, team_id: team.id, team_name: team.name });
  }
  return results;
}

export async function mockGetCalendarSummary(userId) {
  const memberships = await groupsWhereMember(userId);
  return memberships.map(({ group }) => ({ group_id: group.id, group_name: group.name }));
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx jest calendar-mock.test.js`
Expected: PASS, whole file green.

- [ ] **Step 5: Add the real service functions**

In `services/calendar.js`, add the three mock imports to the existing import block from `./__mocks__/calendar-mock.js`:

```js
import {
  mockGetGroupCalendar,
  mockUpsertCalendarDay,
  mockDeleteCalendarDay,
  mockStampPlan,
  mockBulkAssignDays,
  mockBulkClearDays,
  mockShiftCalendar,
  mockGetAdministeredCalendar,
  mockGetMemberCalendar,
  mockGetCalendarSummary,
} from './__mocks__/calendar-mock.js';
```

Add these functions at the end of the file:

```js
// GET /api/v1/users/{id}/member-calendar?from=&to= (Gap 11) — días de
// TODOS los grupos de los que el usuario es miembro, taggeados con
// group_name/team_id/team_name server-side.
export async function getMemberCalendar(userId, from, to) {
  if (USE_MOCKS) return await mockGetMemberCalendar(userId, from, to);
  const params = new URLSearchParams({ from, to });
  return await api.get(`/users/${userId}/member-calendar?${params.toString()}`);
}

// GET /api/v1/users/{id}/administered-calendar?from=&to= (Gap 11) — días
// de TODOS los grupos que el usuario administra, con presencial_collision
// en los días presenciales que colisionan (ver Gap 9/11).
export async function getAdministeredCalendar(userId, from, to) {
  if (USE_MOCKS) return await mockGetAdministeredCalendar(userId, from, to);
  const params = new URLSearchParams({ from, to });
  return await api.get(`/users/${userId}/administered-calendar?${params.toString()}`);
}

// GET /api/v1/users/{id}/calendar-summary — {group_id, group_name} de
// cada grupo del que el usuario es miembro, sin rango de fechas. Se usa
// para poblar el filtro por grupo de la vista agregada del corredor.
export async function getCalendarSummary(userId) {
  if (USE_MOCKS) return await mockGetCalendarSummary(userId);
  return await api.get(`/users/${userId}/calendar-summary`);
}
```

- [ ] **Step 6: Run the full suite and lint**

Run: `npm test && npm run lint`
Expected: both green.

- [ ] **Step 7: Commit**

```bash
git add services/calendar.js services/__mocks__/calendar-mock.js __tests__/calendar-mock.test.js
git commit -m "feat(calendar): add member/administered-calendar and calendar-summary services"
```

---

### Task 3: `hooks/use-aggregated-calendar.js`

**Files:**
- Create: `hooks/use-aggregated-calendar.js`

**Interfaces:**
- Consumes: `getMemberCalendar`, `getAdministeredCalendar`, `getCalendarSummary` (Task 2, `services/calendar.js`), `toAggregatedCalendarDayModel` (Task 1, `services/normalizers.js`).
- Produces: `useMemberCalendar(userId, from, to)` → `{days: AggregatedCalendarDayModel[], loading: boolean, isFetching: boolean}`; `useAdministeredCalendar(userId, from, to)` → same shape; `useCalendarSummary(userId)` → `{groups: {id: string, name: string}[], loading: boolean}`. Tasks 7 and 8 (the two screens) consume these three hooks. No mutations — this file is read-only, all writes stay in `hooks/use-group-calendar.js`.

- [ ] **Step 1: Implement the hook file**

No test for this file — it's a thin TanStack Query wrapper (same convention already applied to `useGroupCalendar` in `hooks/use-group-calendar.js`, which has no dedicated test either; the logic worth testing already lives in the normalizer and the mocks, both covered in Tasks 1-2).

Create `hooks/use-aggregated-calendar.js`:

```js
import { useQuery } from '@tanstack/react-query';
import { getMemberCalendar, getAdministeredCalendar, getCalendarSummary } from '../services/calendar.js';
import { toAggregatedCalendarDayModel } from '../services/normalizers.js';

// Vista agregada de calendario (Gap 11, pieza 2) — solo lectura. Cualquier
// escritura sigue pasando por hooks/use-group-calendar.js vía la pantalla
// de un grupo puntual (group-calendar-day-screen.jsx).

export function useMemberCalendar(userId, from, to) {
  const query = useQuery({
    queryKey: ['member-calendar', userId, from, to],
    queryFn: () => getMemberCalendar(userId, from, to).then((dtos) => dtos.map(toAggregatedCalendarDayModel)),
    enabled: Boolean(userId && from && to),
  });
  return { days: query.data ?? [], loading: query.isLoading, isFetching: query.isFetching };
}

export function useAdministeredCalendar(userId, from, to) {
  const query = useQuery({
    queryKey: ['administered-calendar', userId, from, to],
    queryFn: () => getAdministeredCalendar(userId, from, to).then((dtos) => dtos.map(toAggregatedCalendarDayModel)),
    enabled: Boolean(userId && from && to),
  });
  return { days: query.data ?? [], loading: query.isLoading, isFetching: query.isFetching };
}

export function useCalendarSummary(userId) {
  const query = useQuery({
    queryKey: ['calendar-summary', userId],
    queryFn: () => getCalendarSummary(userId),
    enabled: Boolean(userId),
  });
  const groups = (query.data ?? []).map((g) => ({ id: String(g.group_id), name: g.group_name }));
  return { groups, loading: query.isLoading };
}
```

- [ ] **Step 2: Run the full suite and lint**

Run: `npm test && npm run lint`
Expected: both green (no new tests, confirms nothing broke).

- [ ] **Step 3: Commit**

```bash
git add hooks/use-aggregated-calendar.js
git commit -m "feat(calendar): add useMemberCalendar/useAdministeredCalendar/useCalendarSummary hooks"
```

---

### Task 4: Extract shared calendar utils (`KIND_DOT_COLORS`, `monthRange`)

**Files:**
- Create: `utils/calendar-kind-colors.js`
- Create: `utils/calendar-month-range.js`
- Modify: `components/team/group-calendar-screen.jsx`

**Interfaces:**
- Produces: `KIND_DOT_COLORS` (object, `{rest, other, training, cancelled}` → hex color strings) from `utils/calendar-kind-colors.js`; `monthRange(year, month)` → `{from: string, to: string}` (both `YYYY-MM-DD`) and `pad2(n)` → 2-digit zero-padded string, both from `utils/calendar-month-range.js`. Tasks 5, 7, 8 import `monthRange`/`KIND_DOT_COLORS`. `group-calendar-screen.jsx` switches from its own local copies to these imports (no behavior change) — it also uses `pad2` directly (not just via `monthRange`) for its `currentMonthISO` line, so `pad2` must be exported, not kept private.

- [ ] **Step 1: Create the two util files**

Create `utils/calendar-kind-colors.js`:

```js
// Color por kind de día de calendario — compartido entre la pantalla de
// un grupo puntual (group-calendar-screen.jsx) y la vista agregada
// (components/calendar/aggregated-month-view.jsx).
export const KIND_DOT_COLORS = { rest: '#94a3b8', other: '#f59e0b', training: '#22c55e', cancelled: '#ef4444' };
```

Create `utils/calendar-month-range.js`:

```js
// Exportado (no privado) — group-calendar-screen.jsx lo usa directo para
// su currentMonthISO, no solo a través de monthRange.
export function pad2(n) {
  return String(n).padStart(2, '0');
}

// Rango YYYY-MM-DD del mes visible en un calendario — compartido entre
// group-calendar-screen.jsx y las pantallas de vista agregada
// (my-calendar-screen.jsx, administered-calendar-screen.jsx).
export function monthRange(year, month) {
  const from = `${year}-${pad2(month)}-01`;
  const lastDay = new Date(year, month, 0).getDate();
  const to = `${year}-${pad2(month)}-${pad2(lastDay)}`;
  return { from, to };
}
```

- [ ] **Step 2: Update `group-calendar-screen.jsx` to import instead of declaring locally**

In `components/team/group-calendar-screen.jsx`, replace this block (currently lines 24-35):

```js
const KIND_DOT_COLORS = { rest: '#94a3b8', other: '#f59e0b', training: '#22c55e', cancelled: '#ef4444' };

function pad2(n) {
  return String(n).padStart(2, '0');
}

function monthRange(year, month) {
  const from = `${year}-${pad2(month)}-01`;
  const lastDay = new Date(year, month, 0).getDate();
  const to = `${year}-${pad2(month)}-${pad2(lastDay)}`;
  return { from, to };
}
```

with:

```js
```

(delete the block entirely — nothing replaces it in place, the two names come from imports now).

Add these two imports to the top import block (alongside the existing `import { isCalendarDayClosed } from '../../utils/calendar-day-closed.js';` line):

```js
import { KIND_DOT_COLORS } from '../../utils/calendar-kind-colors.js';
import { monthRange, pad2 } from '../../utils/calendar-month-range.js';
```

- [ ] **Step 3: Run the full suite and lint**

Run: `npm test && npm run lint`
Expected: both green — `group-calendar-screen.jsx` has no dedicated test (project convention, no component render tests), so this step confirms no other file broke and lint catches any lingering unused-import issue.

- [ ] **Step 4: Commit**

```bash
git add utils/calendar-kind-colors.js utils/calendar-month-range.js components/team/group-calendar-screen.jsx
git commit -m "refactor(calendar): extract KIND_DOT_COLORS and monthRange to shared utils"
```

---

### Task 5: `components/calendar/aggregated-month-view.jsx`

**Files:**
- Create: `components/calendar/aggregated-month-view.jsx`

**Interfaces:**
- Consumes: `KIND_DOT_COLORS` (Task 4), `isCalendarDayClosed` (existing, `utils/calendar-day-closed.js`), `useThemeColors`/`useThemeMode` (existing, `theme/colors.js`/`providers/theme-provider.jsx`).
- Produces: `AggregatedMonthView({ currentMonthISO, daysByDate, onMonthChange, onDayPress, showCollisions })` — a React component. `daysByDate` is `Record<string, AggregatedCalendarDayModel[]>` (date string → array of assignments for that date, already grouped by the caller). `onMonthChange(year, month)` fires on calendar month navigation. `onDayPress(dateString)` fires on tapping a day cell. `showCollisions: boolean` toggles the collision badge. Tasks 7 and 8 (the two screens) mount this component.

- [ ] **Step 1: Implement the component**

No test — this is a visual component (project convention: no component render tests). Its only non-trivial logic (picking the "most relevant" assignment for the closed-badge check, and the cross_team-wins-over-same_team collision classification) is simple enough to review by reading, consistent with how `CalendarDayCell` in `group-calendar-screen.jsx` has no dedicated test either.

Create `components/calendar/aggregated-month-view.jsx`:

```jsx
import { Pressable, Text, View } from 'react-native';
import { Calendar } from 'react-native-calendars';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import '../../config/calendarLocale.js';
import { useThemeColors } from '../../theme/colors.js';
import { useThemeMode } from '../../providers/theme-provider.jsx';
import { KIND_DOT_COLORS } from '../../utils/calendar-kind-colors.js';
import { isCalendarDayClosed } from '../../utils/calendar-day-closed.js';

const MAX_DOTS = 4;

function collisionSeverity(assignments) {
  if (assignments.some((a) => a.presencialCollision?.type === 'cross_team')) return 'cross_team';
  if (assignments.some((a) => a.presencialCollision)) return 'same_team';
  return null;
}

function AggregatedDayCell({ date, state, assignments, onPress, showCollisions }) {
  const isOtherMonth = state === 'disabled';
  const hasAssignments = assignments.length > 0;
  // Misma noción de "día cerrado" que group-calendar-screen.jsx, evaluada
  // contra la asignación más relevante del día (la primera presencial, si
  // hay alguna, si no la primera del array) — un día con varias
  // asignaciones puede tener una presencial y otra no.
  const relevant = assignments.find((a) => a.isPresencial) ?? assignments[0] ?? null;
  const closed = relevant ? isCalendarDayClosed(date.dateString, relevant) : false;
  const severity = showCollisions ? collisionSeverity(assignments) : null;
  const visibleDots = assignments.slice(0, MAX_DOTS);
  const overflowCount = assignments.length - MAX_DOTS;

  return (
    <Pressable
      className="h-14 w-full items-center justify-start gap-1 rounded-md pt-1"
      nativeID={`aggregated-calendar-day-${date.dateString}`}
      onPress={() => onPress(date.dateString)}
      style={{ opacity: closed ? 0.7 : 1 }}
      testID={`aggregated-calendar-day-${date.dateString}`}
    >
      <Text
        className={`text-sm ${isOtherMonth ? 'text-slate-300 dark:text-slate-600' : state === 'today' ? 'font-bold text-primary' : 'text-slate-700 dark:text-slate-200'}`}
        nativeID={`aggregated-calendar-day-${date.dateString}-label`}
        testID={`aggregated-calendar-day-${date.dateString}-label`}
      >
        {date.day}
      </Text>
      {hasAssignments && (
        <View
          className="flex-row items-center gap-0.5"
          nativeID={`aggregated-calendar-day-${date.dateString}-dots`}
          testID={`aggregated-calendar-day-${date.dateString}-dots`}
        >
          {visibleDots.map((assignment, i) => (
            <View
              key={assignment.id}
              nativeID={`aggregated-calendar-day-${date.dateString}-dot-${i}`}
              style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: KIND_DOT_COLORS[assignment.kind] }}
              testID={`aggregated-calendar-day-${date.dateString}-dot-${i}`}
            />
          ))}
          {overflowCount > 0 && (
            <Text
              className="text-[9px] font-semibold text-slate-500 dark:text-slate-400"
              nativeID={`aggregated-calendar-day-${date.dateString}-overflow`}
              testID={`aggregated-calendar-day-${date.dateString}-overflow`}
            >
              +{overflowCount}
            </Text>
          )}
        </View>
      )}
      {severity && (
        <View
          className="absolute right-1 top-1"
          nativeID={`aggregated-calendar-day-${date.dateString}-collision-badge`}
          testID={`aggregated-calendar-day-${date.dateString}-collision-badge`}
        >
          <MaterialCommunityIcons
            color={severity === 'cross_team' ? '#ef4444' : '#d97706'}
            name="alert-decagram"
            size={10}
          />
        </View>
      )}
    </Pressable>
  );
}

export function AggregatedMonthView({ currentMonthISO, daysByDate, onMonthChange, onDayPress, showCollisions }) {
  const colors = useThemeColors();
  const { colorScheme } = useThemeMode();

  return (
    <View
      className="rounded-2xl border border-slate-200 bg-white p-2 dark:border-slate-700 dark:bg-surface"
      nativeID="aggregated-month-view"
      testID="aggregated-month-view"
    >
      <Calendar
        current={currentMonthISO}
        key={colorScheme}
        dayComponent={({ date, state }) => (
          <AggregatedDayCell
            assignments={daysByDate[date.dateString] ?? []}
            date={date}
            onPress={onDayPress}
            showCollisions={showCollisions}
            state={state}
          />
        )}
        firstDay={1}
        onMonthChange={(month) => onMonthChange(month.year, month.month)}
        theme={{
          backgroundColor: 'transparent',
          calendarBackground: 'transparent',
          textSectionTitleColor: colors.onSurfaceVariant,
          monthTextColor: colors.onSurface,
          arrowColor: colors.primary,
          todayTextColor: colors.primary,
          textDisabledColor: colors.onSurfaceVariant,
          textMonthFontFamily: 'Orbitron_700Bold',
        }}
      />
    </View>
  );
}
```

Note: `group-calendar-screen.jsx`'s `CalendarDayCell` uses `measureInWindow` to position the `AnimatedDropdown` day-menu. This component has no popover to position — it always opens a full `Modal` (Task 6) — so a plain `Pressable` with `onPress` is enough, no `containerRef`/`measureInWindow` needed here.

- [ ] **Step 2: Run lint**

Run: `npm run lint`
Expected: green — this step exists specifically to catch missing `nativeID`/`testID` (the custom `local/require-native-id` rule) and unused imports before moving on.

- [ ] **Step 3: Commit**

```bash
git add components/calendar/aggregated-month-view.jsx
git commit -m "feat(calendar): add AggregatedMonthView with stacked dots and collision badge"
```

---

### Task 6: `components/calendar/day-detail-modal.jsx`

**Files:**
- Create: `components/calendar/day-detail-modal.jsx`

**Interfaces:**
- Consumes: `AggregatedCalendarDayModel` shape from Task 1 (`id, groupId, groupName, teamId, teamName, date, kind, otherName, sessionInstance, isPresencial, presencialTimeFrom, presencialTimeTo, presencialLocation, presencialCollision`).
- Produces: `DayDetailModal({ visible, onClose, date, assignments, variant })` — `variant` is `'member' | 'administered'`. Tasks 7 and 8 mount this, passing the assignments for the tapped date (already filtered by the screen).

- [ ] **Step 1: Implement the component**

No test — visual component, same convention as Task 5.

Create `components/calendar/day-detail-modal.jsx`:

```jsx
import { Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useThemeColors } from '../../theme/colors.js';

function kindLabel(assignment) {
  if (assignment.kind === 'rest') return 'Descanso';
  if (assignment.kind === 'other') return assignment.otherName || 'Otra actividad';
  if (assignment.kind === 'cancelled') return 'Sesión cancelada';
  return 'Entrenamiento';
}

function AssignmentRow({ assignment, variant }) {
  const colors = useThemeColors();
  const router = useRouter();
  const idPrefix = `day-detail-assignment-${assignment.id}`;

  const handleGoToGroup = () => {
    router.push(`/teams/${assignment.teamId}/groups/${assignment.groupId}/calendar/${assignment.date}`);
  };

  return (
    <View className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 dark:border-slate-700 dark:bg-slate-900" nativeID={idPrefix} testID={idPrefix}>
      <Text className="text-xs font-semibold text-slate-500 dark:text-slate-400" nativeID={`${idPrefix}-group`} testID={`${idPrefix}-group`}>
        {assignment.groupName} · {assignment.teamName}
      </Text>
      <Text className="mt-0.5 text-sm font-semibold text-slate-900 dark:text-white" nativeID={`${idPrefix}-kind`} testID={`${idPrefix}-kind`}>
        {kindLabel(assignment)}
      </Text>
      {assignment.isPresencial && (
        <View className="mt-1 flex-row items-center gap-1.5" nativeID={`${idPrefix}-presencial`} testID={`${idPrefix}-presencial`}>
          <MaterialCommunityIcons color={colors.onSurfaceVariant} name="map-marker-outline" size={14} />
          <Text className="text-xs text-slate-500 dark:text-slate-400" nativeID={`${idPrefix}-presencial-label`} testID={`${idPrefix}-presencial-label`}>
            {assignment.presencialTimeFrom}–{assignment.presencialTimeTo}
            {assignment.presencialLocation?.label ? ` · ${assignment.presencialLocation.label}` : ''}
          </Text>
        </View>
      )}
      {assignment.sessionInstance && (
        <Text className="mt-1 text-xs text-slate-600 dark:text-slate-300" nativeID={`${idPrefix}-session-name`} testID={`${idPrefix}-session-name`}>
          {assignment.sessionInstance.name}
          {assignment.sessionInstance.exercises.length > 0
            ? ` · ${assignment.sessionInstance.exercises.length} ejercicio${assignment.sessionInstance.exercises.length === 1 ? '' : 's'}`
            : ''}
        </Text>
      )}
      {variant === 'administered' && assignment.presencialCollision && (
        <View
          className={`mt-2 rounded-lg px-2 py-1.5 ${assignment.presencialCollision.type === 'cross_team' ? 'bg-red-50 dark:bg-red-900/20' : 'bg-amber-50 dark:bg-amber-900/20'}`}
          nativeID={`${idPrefix}-collision`}
          testID={`${idPrefix}-collision`}
        >
          <Text
            className={`text-[11px] font-semibold ${assignment.presencialCollision.type === 'cross_team' ? 'text-red-700 dark:text-red-400' : 'text-amber-700 dark:text-amber-400'}`}
            nativeID={`${idPrefix}-collision-label`}
            testID={`${idPrefix}-collision-label`}
          >
            Colisiona con {assignment.presencialCollision.conflicts.map((c) => `${c.group_name} (${c.team_name})`).join(', ')}
          </Text>
        </View>
      )}
      {variant === 'administered' && (
        <Pressable
          className="mt-2 h-9 flex-row items-center justify-center gap-1.5 rounded-full border border-slate-200 hover:bg-slate-100 active:opacity-70 dark:border-slate-700 dark:hover:bg-slate-800"
          nativeID={`${idPrefix}-go-to-group-button`}
          onPress={handleGoToGroup}
          testID={`${idPrefix}-go-to-group-button`}
        >
          <Text className="text-xs font-semibold text-slate-700 dark:text-slate-200" nativeID={`${idPrefix}-go-to-group-button-label`} testID={`${idPrefix}-go-to-group-button-label`}>
            Ir a este grupo
          </Text>
          <MaterialCommunityIcons color={colors.onSurfaceVariant} name="arrow-right" size={14} />
        </Pressable>
      )}
    </View>
  );
}

export function DayDetailModal({ visible, onClose, date, assignments, variant }) {
  return (
    <Modal animationType="fade" nativeID="day-detail-modal" onRequestClose={onClose} testID="day-detail-modal" transparent visible={visible}>
      <Pressable className="flex-1 items-center justify-center bg-black/50 px-4" nativeID="day-detail-modal-backdrop" onPress={onClose} testID="day-detail-modal-backdrop">
        <Pressable
          className="max-h-[80%] w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-4 shadow-xl dark:border-slate-700 dark:bg-surface"
          nativeID="day-detail-modal-card"
          onPress={() => {}}
          testID="day-detail-modal-card"
        >
          <Text className="mb-3 text-lg font-bold text-slate-900 dark:text-white" nativeID="day-detail-modal-title" testID="day-detail-modal-title">
            {date}
          </Text>
          <ScrollView nativeID="day-detail-modal-scroll" testID="day-detail-modal-scroll">
            <View className="gap-2" nativeID="day-detail-modal-list" testID="day-detail-modal-list">
              {assignments.map((assignment) => (
                <AssignmentRow assignment={assignment} key={assignment.id} variant={variant} />
              ))}
              {assignments.length === 0 && (
                <Text className="text-center text-sm text-slate-500 dark:text-slate-400" nativeID="day-detail-modal-empty" testID="day-detail-modal-empty">
                  Sin asignaciones este día.
                </Text>
              )}
            </View>
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
```

- [ ] **Step 2: Run lint**

Run: `npm run lint`
Expected: green — confirms `nativeID`/`testID` coverage and the backdrop-close rule (`local/require-modal-backdrop-close`) both pass.

- [ ] **Step 3: Commit**

```bash
git add components/calendar/day-detail-modal.jsx
git commit -m "feat(calendar): add DayDetailModal with member/administered variants"
```

---

### Task 7: `my-calendar-screen.jsx` (corredor) + route wiring

**Files:**
- Create: `components/calendar/my-calendar-screen.jsx`
- Create: `app/(tabs)/calendar.jsx`
- Modify: `routes/catalog.js`

**Interfaces:**
- Consumes: `useMemberCalendar`, `useCalendarSummary` (Task 3), `AggregatedMonthView` (Task 5), `DayDetailModal` (Task 6), `monthRange` (Task 4), `RequireAuth` (existing, `components/guards/require-auth.jsx`).
- Produces: `MyCalendarScreen` component, mounted at `/calendar`; `myCalendarRoute` nav entry.

- [ ] **Step 1: Add the nav route entry**

In `routes/catalog.js`, add after `trainingPlansRoute` and before the `navigationRoutes` array:

```js
export const myCalendarRoute = {
  name: 'calendar',
  label: 'Mi calendario',
  href: '/calendar',
  icon: 'calendar-month-outline',
  role: 'runner',
};
```

Update the `navigationRoutes` array (currently `export const navigationRoutes = [homeRoute, teamsRoute, notificationsRoute, myPlansRoute, trainingPlansRoute];`) to:

```js
export const navigationRoutes = [homeRoute, teamsRoute, notificationsRoute, myPlansRoute, trainingPlansRoute, myCalendarRoute];
```

(Task 8 will append `administeredCalendarRoute` to this same array — expect a small merge conflict of one line if executed out of order; append after `myCalendarRoute` when doing Task 8.)

- [ ] **Step 2: Implement the screen**

No test — visual screen, same convention as the rest of this plan.

Create `components/calendar/my-calendar-screen.jsx`:

```jsx
import { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useThemeColors } from '../../theme/colors.js';
import { isWeb } from '../../utils/platform.js';
import { useAuthStore } from '../../store/auth-store.js';
import { useMemberCalendar, useCalendarSummary } from '../../hooks/use-aggregated-calendar.js';
import { monthRange, pad2 } from '../../utils/calendar-month-range.js';
import { AggregatedMonthView } from './aggregated-month-view.jsx';
import { DayDetailModal } from './day-detail-modal.jsx';
import { RequireAuth } from '../guards/require-auth.jsx';

function MyCalendarScreenContent() {
  const router = useRouter();
  const colors = useThemeColors();
  const userId = useAuthStore((s) => s.userId);

  const today = new Date();
  const [visibleYear, setVisibleYear] = useState(today.getFullYear());
  const [visibleMonth, setVisibleMonth] = useState(today.getMonth() + 1);
  const [filterGroupId, setFilterGroupId] = useState(null);
  const [openDate, setOpenDate] = useState(null);

  const { from, to } = useMemo(() => monthRange(visibleYear, visibleMonth), [visibleYear, visibleMonth]);
  const { days, loading, isFetching } = useMemberCalendar(userId, from, to);
  const { groups } = useCalendarSummary(userId);
  const currentMonthISO = `${visibleYear}-${pad2(visibleMonth)}-01`;

  const filteredDays = useMemo(
    () => (filterGroupId ? days.filter((d) => d.groupId === filterGroupId) : days),
    [days, filterGroupId],
  );

  const daysByDate = useMemo(() => {
    const map = {};
    for (const day of filteredDays) {
      map[day.date] = [...(map[day.date] ?? []), day];
    }
    return map;
  }, [filteredDays]);

  const openAssignments = openDate ? daysByDate[openDate] ?? [] : [];

  return (
    <View className="flex-1 bg-paper dark:bg-ink" nativeID="my-calendar-screen-root" testID="my-calendar-screen-root">
      <View className={`w-full flex-1 self-center px-4 py-8 ${isWeb ? 'max-w-3xl' : ''}`} nativeID="my-calendar-screen-container" testID="my-calendar-screen-container">
        <View className="mb-6 flex-row items-center gap-2" nativeID="my-calendar-screen-header" testID="my-calendar-screen-header">
          <Pressable
            className="flex-row items-center gap-1.5 py-1 pr-1 hover:opacity-70 active:opacity-70"
            nativeID="my-calendar-screen-back-button"
            onPress={() => router.back()}
            testID="my-calendar-screen-back-button"
          >
            <MaterialCommunityIcons color={colors.onSurfaceVariant} name="arrow-left" size={18} />
          </Pressable>
          <Text className="text-xl text-slate-900 dark:text-white" nativeID="my-calendar-screen-title" style={{ fontFamily: 'Orbitron_700Bold' }} testID="my-calendar-screen-title">
            Mi calendario
          </Text>
          {(loading || isFetching) && (
            <ActivityIndicator color={colors.primary} nativeID="my-calendar-screen-fetching" size="small" testID="my-calendar-screen-fetching" />
          )}
        </View>

        {groups.length > 0 && (
          <ScrollView horizontal className="mb-4" nativeID="my-calendar-screen-filter-scroll" showsHorizontalScrollIndicator={false} testID="my-calendar-screen-filter-scroll">
            <View className="flex-row gap-2" nativeID="my-calendar-screen-filter-chips" testID="my-calendar-screen-filter-chips">
              <Pressable
                className={`h-8 items-center justify-center rounded-full px-3 ${filterGroupId === null ? 'bg-primary' : 'bg-slate-100 dark:bg-slate-800'}`}
                nativeID="my-calendar-screen-filter-all"
                onPress={() => setFilterGroupId(null)}
                testID="my-calendar-screen-filter-all"
              >
                <Text className={`text-xs font-semibold ${filterGroupId === null ? 'text-[#111518]' : 'text-slate-600 dark:text-slate-300'}`} nativeID="my-calendar-screen-filter-all-label" testID="my-calendar-screen-filter-all-label">
                  Todos
                </Text>
              </Pressable>
              {groups.map((group) => (
                <Pressable
                  className={`h-8 items-center justify-center rounded-full px-3 ${filterGroupId === group.id ? 'bg-primary' : 'bg-slate-100 dark:bg-slate-800'}`}
                  key={group.id}
                  nativeID={`my-calendar-screen-filter-${group.id}`}
                  onPress={() => setFilterGroupId(group.id)}
                  testID={`my-calendar-screen-filter-${group.id}`}
                >
                  <Text
                    className={`text-xs font-semibold ${filterGroupId === group.id ? 'text-[#111518]' : 'text-slate-600 dark:text-slate-300'}`}
                    nativeID={`my-calendar-screen-filter-${group.id}-label`}
                    testID={`my-calendar-screen-filter-${group.id}-label`}
                  >
                    {group.name}
                  </Text>
                </Pressable>
              ))}
            </View>
          </ScrollView>
        )}

        <AggregatedMonthView
          currentMonthISO={currentMonthISO}
          daysByDate={daysByDate}
          onDayPress={setOpenDate}
          onMonthChange={(year, month) => { setVisibleYear(year); setVisibleMonth(month); }}
          showCollisions={false}
        />
      </View>

      <DayDetailModal assignments={openAssignments} date={openDate ?? ''} onClose={() => setOpenDate(null)} variant="member" visible={Boolean(openDate)} />
    </View>
  );
}

export function MyCalendarScreen() {
  return (
    <RequireAuth>
      <MyCalendarScreenContent />
    </RequireAuth>
  );
}
```

- [ ] **Step 3: Wire the route**

Create `app/(tabs)/calendar.jsx`:

```jsx
import { MyCalendarScreen } from '../../components/calendar/my-calendar-screen.jsx';

export default function CalendarIndex() {
  return <MyCalendarScreen />;
}
```

- [ ] **Step 4: Run the full suite and lint**

Run: `npm test && npm run lint`
Expected: both green.

- [ ] **Step 5: Commit**

```bash
git add routes/catalog.js components/calendar/my-calendar-screen.jsx "app/(tabs)/calendar.jsx"
git commit -m "feat(calendar): add MyCalendarScreen (corredor aggregated view)"
```

---

### Task 8: `administered-calendar-screen.jsx` (entrenador) + route wiring

**Files:**
- Create: `components/calendar/administered-calendar-screen.jsx`
- Create: `app/(tabs)/administered-calendar.jsx`
- Modify: `routes/catalog.js`

**Interfaces:**
- Consumes: `useAdministeredCalendar` (Task 3), `AggregatedMonthView` (Task 5), `DayDetailModal` (Task 6), `monthRange` (Task 4).
- Produces: `AdministeredCalendarScreen` component, mounted at `/administered-calendar`; `administeredCalendarRoute` nav entry.

- [ ] **Step 1: Add the nav route entry**

In `routes/catalog.js`, add after `myCalendarRoute` (added in Task 7):

```js
export const administeredCalendarRoute = {
  name: 'administered-calendar',
  label: 'Calendario',
  href: '/administered-calendar',
  icon: 'calendar-month-outline',
  role: 'trainer',
};
```

Update `navigationRoutes` (currently ending in `..., myCalendarRoute];` after Task 7) to:

```js
export const navigationRoutes = [homeRoute, teamsRoute, notificationsRoute, myPlansRoute, trainingPlansRoute, myCalendarRoute, administeredCalendarRoute];
```

- [ ] **Step 2: Implement the screen**

No test — visual screen, same convention as the rest of this plan.

Create `components/calendar/administered-calendar-screen.jsx`:

```jsx
import { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useThemeColors } from '../../theme/colors.js';
import { isWeb } from '../../utils/platform.js';
import { useAuthStore } from '../../store/auth-store.js';
import { useAdministeredCalendar } from '../../hooks/use-aggregated-calendar.js';
import { monthRange, pad2 } from '../../utils/calendar-month-range.js';
import { AggregatedMonthView } from './aggregated-month-view.jsx';
import { DayDetailModal } from './day-detail-modal.jsx';
import { RequireAuth } from '../guards/require-auth.jsx';

function AdministeredCalendarScreenContent() {
  const router = useRouter();
  const colors = useThemeColors();
  const userId = useAuthStore((s) => s.userId);

  const today = new Date();
  const [visibleYear, setVisibleYear] = useState(today.getFullYear());
  const [visibleMonth, setVisibleMonth] = useState(today.getMonth() + 1);
  const [openDate, setOpenDate] = useState(null);

  const { from, to } = useMemo(() => monthRange(visibleYear, visibleMonth), [visibleYear, visibleMonth]);
  const { days, loading, isFetching } = useAdministeredCalendar(userId, from, to);
  const currentMonthISO = `${visibleYear}-${pad2(visibleMonth)}-01`;

  const daysByDate = useMemo(() => {
    const map = {};
    for (const day of days) {
      map[day.date] = [...(map[day.date] ?? []), day];
    }
    return map;
  }, [days]);

  const openAssignments = openDate ? daysByDate[openDate] ?? [] : [];

  return (
    <View className="flex-1 bg-paper dark:bg-ink" nativeID="administered-calendar-screen-root" testID="administered-calendar-screen-root">
      <View className={`w-full flex-1 self-center px-4 py-8 ${isWeb ? 'max-w-3xl' : ''}`} nativeID="administered-calendar-screen-container" testID="administered-calendar-screen-container">
        <View className="mb-6 flex-row items-center gap-2" nativeID="administered-calendar-screen-header" testID="administered-calendar-screen-header">
          <Pressable
            className="flex-row items-center gap-1.5 py-1 pr-1 hover:opacity-70 active:opacity-70"
            nativeID="administered-calendar-screen-back-button"
            onPress={() => router.back()}
            testID="administered-calendar-screen-back-button"
          >
            <MaterialCommunityIcons color={colors.onSurfaceVariant} name="arrow-left" size={18} />
          </Pressable>
          <Text className="text-xl text-slate-900 dark:text-white" nativeID="administered-calendar-screen-title" style={{ fontFamily: 'Orbitron_700Bold' }} testID="administered-calendar-screen-title">
            Calendario
          </Text>
          {(loading || isFetching) && (
            <ActivityIndicator color={colors.primary} nativeID="administered-calendar-screen-fetching" size="small" testID="administered-calendar-screen-fetching" />
          )}
        </View>

        <AggregatedMonthView
          currentMonthISO={currentMonthISO}
          daysByDate={daysByDate}
          onDayPress={setOpenDate}
          onMonthChange={(year, month) => { setVisibleYear(year); setVisibleMonth(month); }}
          showCollisions
        />
      </View>

      <DayDetailModal assignments={openAssignments} date={openDate ?? ''} onClose={() => setOpenDate(null)} variant="administered" visible={Boolean(openDate)} />
    </View>
  );
}

export function AdministeredCalendarScreen() {
  return (
    <RequireAuth>
      <AdministeredCalendarScreenContent />
    </RequireAuth>
  );
}
```

- [ ] **Step 3: Wire the route**

Create `app/(tabs)/administered-calendar.jsx`:

```jsx
import { AdministeredCalendarScreen } from '../../components/calendar/administered-calendar-screen.jsx';

export default function AdministeredCalendarIndex() {
  return <AdministeredCalendarScreen />;
}
```

- [ ] **Step 4: Run the full suite and lint**

Run: `npm test && npm run lint`
Expected: both green.

- [ ] **Step 5: Commit**

```bash
git add routes/catalog.js components/calendar/administered-calendar-screen.jsx "app/(tabs)/administered-calendar.jsx"
git commit -m "feat(calendar): add AdministeredCalendarScreen (entrenador aggregated view)"
```

---

### Task 9: `canManage` guard in `group-calendar-screen.jsx`

**Files:**
- Modify: `components/team/group-calendar-screen.jsx`

**Interfaces:**
- Consumes: `usePermissions(userId)` (existing, `hooks/use-user.js`, returns `{roles: [{name: string, ...}], loading: boolean}`), `useAuthStore` (existing, `activeRole` field).
- Produces: `CalendarDayCell` gains a `canManage: boolean` prop — when `false`, tapping a day does nothing (no menu opens). No other file depends on this change; it closes an access-control gap surfaced while designing Task 6's "go to this group" link.

- [ ] **Step 1: Add the permission check to `GroupCalendarScreenContent`**

In `components/team/group-calendar-screen.jsx`, add to the top import block:

```js
import { usePermissions } from '../../hooks/use-user.js';
```

Inside `GroupCalendarScreenContent` (right after the existing `const userId = useAuthStore((s) => s.userId);` line), add:

```js
  const activeRole = useAuthStore((s) => s.activeRole);
  const { roles } = usePermissions(userId);
  // Mismo criterio que canManageTeam en team-detail-screen.jsx — no hay
  // modelo de dueño de equipo a nivel de UI todavía, cualquier usuario
  // viendo la app como entrenador activo puede administrar. No se
  // restringe más (a "administra ESTE grupo puntual") porque eso
  // requeriría resolver team.ownerId contra este grupo, dato no
  // disponible hoy sin una consulta extra — replica el criterio ya
  // vigente en el resto de la app en vez de inventar uno más estricto.
  const hasTrainerRole = roles.some((r) => r.name === 'entrenador');
  const canManage = hasTrainerRole && activeRole === 'trainer';
```

- [ ] **Step 2: Gate `CalendarDayCell`'s menu-opening behavior**

In the same file, `CalendarDayCell`'s signature currently reads:

```js
function CalendarDayCell({ date, state, marking, containerRef, onOpenMenu, isMenuOpen, selectionActive, selectionClosedClass, selected, onToggleSelect }) {
```

Add `canManage` to the destructured props:

```js
function CalendarDayCell({ date, state, marking, containerRef, onOpenMenu, isMenuOpen, selectionActive, selectionClosedClass, selected, onToggleSelect, canManage }) {
```

Its `handlePress` currently reads:

```js
  const handlePress = () => {
    if (selectionActive) {
      if (!canSelect) return;
      onToggleSelect(date.dateString);
      return;
    }
    if (!containerRef.current || !cellRef.current) return;
    containerRef.current.measureInWindow((containerX, containerY) => {
      cellRef.current?.measureInWindow((x, y, width, height) => {
        onOpenMenu(date.dateString, { x: x - containerX, y: y - containerY, width, height });
      });
    });
  };
```

Add the guard as the first line of the function body:

```js
  const handlePress = () => {
    if (!canManage) return;
    if (selectionActive) {
      if (!canSelect) return;
      onToggleSelect(date.dateString);
      return;
    }
    if (!containerRef.current || !cellRef.current) return;
    containerRef.current.measureInWindow((containerX, containerY) => {
      cellRef.current?.measureInWindow((x, y, width, height) => {
        onOpenMenu(date.dateString, { x: x - containerX, y: y - containerY, width, height });
      });
    });
  };
```

- [ ] **Step 3: Pass `canManage` down from the `dayComponent` render**

Find the `dayComponent` prop of `<Calendar>` (renders `<CalendarDayCell ... />` with props `containerRef`, `date`, `isMenuOpen`, `marking`, `onOpenMenu`, `onToggleSelect`, `selected`, `selectionActive`, `selectionClosedClass`, `state`). Add `canManage={canManage}` to that list of props (alphabetical order, so between `bulk...` — there is none — place it right after `canManage` would sort: before `containerRef`):

```jsx
              <CalendarDayCell
                canManage={canManage}
                containerRef={screenRootRef}
                date={date}
                isMenuOpen={openDayMenu?.date === date.dateString}
                marking={markingsByDate[date.dateString]}
                onOpenMenu={handleOpenDayMenu}
                onToggleSelect={handleToggleDaySelection}
                selected={selectedDates.has(date.dateString)}
                selectionActive={selectionActive}
                selectionClosedClass={selectionClosedClass}
                state={state}
              />
```

- [ ] **Step 4: Run the full suite and lint**

Run: `npm test && npm run lint`
Expected: both green.

- [ ] **Step 5: Commit**

```bash
git add components/team/group-calendar-screen.jsx
git commit -m "fix(calendar): guard group-calendar-screen day menu behind canManage"
```

---

### Task 10: Final verification and manual test script

**Files:** none (verification only)

- [ ] **Step 1: Run the full suite one more time**

Run: `npm test && npm run lint`
Expected: both green, confirming the whole piece is internally consistent after all 9 tasks.

- [ ] **Step 2: Output the manual test script**

This piece is UI-heavy (new screens, new nav items, a new modal) with no component render tests (project convention) — manual verification is required before considering it done. Output this script verbatim for the user to run (do not attempt browser/preview verification of this piece unless the user asks):

```
1. Nav: como corredor, confirmar que el ítem "Mi calendario" aparece en el header/drawer; como entrenador, confirmar "Calendario" en su lugar (nunca los dos a la vez para el mismo rol activo).
2. Mi calendario (corredor): unirse a al menos un grupo (o usar un usuario mock ya miembro de uno), pedirle al entrenador que le cargue un par de días en ese grupo, confirmar que aparecen en "Mi calendario" con el dot correcto por kind.
3. Filtro por grupo: con membresía en 2+ grupos, tocar cada chip y confirmar que el mes solo muestra los días de ese grupo; "Todos" vuelve a mostrar todo.
4. Un mismo día con asignaciones de 2 grupos distintos: confirmar que la celda muestra 2 dots, y que el modal de detalle lista ambas asignaciones con su grupo/equipo correcto.
5. Calendario (entrenador): confirmar que muestra los días de TODOS los grupos que administra (probar con 2+ equipos si es posible), sin filtro.
6. Colisión presencial: forzar una colisión same_team (cargar 2 días presenciales superpuestos en 2 grupos del mismo equipo) y confirmar el badge ámbar en la celda y el detalle de colisión en el modal. Si se puede probar cross_team (2 equipos distintos), confirmar el badge rojo.
7. "Ir a este grupo" (solo entrenador): tocar el botón en una asignación del modal, confirmar que navega a la pantalla del grupo puntual en la fecha correcta.
8. Guard de permiso: cambiar a rol corredor (o un usuario sin rol entrenador) y navegar por URL directa a /teams/{teamId}/groups/{groupId}/calendar — confirmar que tocar un día NO abre el menú de asignar/editar/etc. (antes de este cambio, sí lo hacía).
9. Modo oscuro/claro: alternar tema en ambas pantallas nuevas, confirmar que el header del mes (bug de colorScheme ya resuelto esta sesión) y los badges se ven bien en ambos.
10. Responsive: probar ambas pantallas en un viewport angosto (mobile) y uno ancho (desktop) — deben seguir siendo usables en los dos, sin desbordes.
```
