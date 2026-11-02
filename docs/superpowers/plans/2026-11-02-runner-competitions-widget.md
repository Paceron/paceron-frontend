# Runner Competitions Widget Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show up to 3 active competitions the runner participates in (across all their
teams) as a new home widget, add a cross-team "Competencias" tab to the gamification
hub for the full list, fix a confirmed calendar day-boundary bug, and document a
backend policy gap.

**Architecture:** A shared cross-team fan-out hook (`useMyCompetitions`) built on
`useQueries` feeds two independent, differently-sorted/filtered consumers (a 3-item
home widget, a full read-only tab). The calendar fix and the backend gap doc are
independent side-items bundled into the same branch, touching unrelated files.

**Tech Stack:** React Native + NativeWind, TanStack Query (`useQueries`), Expo Router.

**Spec:** `docs/superpowers/specs/2026-11-02-runner-competitions-widget-design.md`

## Global Constraints

- No backend endpoint changes for the widget/tab — confirmed reuses existing
  `GET /teams/{id}/competitions` per team (spec section A).
- No new npm dependencies.
- No component-render tests (repo convention) — only pure utils get Jest tests.
- `npm test`/`npm run lint` green after every task.
- Any ID compared against `participantUserIds` (array of strings) must be
  `String(...)`-coerced first — this repo has a documented bug class
  (CLAUDE.md "Quirks conocidos") from comparing a raw number userId against a
  string-array field.
- Responsive rule: `isWeb && !useIsNarrowWeb()` decides row-vs-stack, never a fixed
  `Platform.OS === 'web'` check alone (CLAUDE.md "Responsive web").

---

### Task 1: `isToday` as a pure, timezone-safe function

**Files:**
- Create: `utils/calendar-today.js`
- Test: `__tests__/calendar-today.test.js`

**Interfaces:**
- Produces: `computeTodayIso(now = new Date())` → `'YYYY-MM-DD'` string, built from
  local getters only. `isTodayDateString(dateString, now = new Date())` → boolean,
  `dateString === computeTodayIso(now)`.

- [ ] **Step 1: Write the failing test**

```js
const { computeTodayIso, isTodayDateString } = require('../utils/calendar-today.js');

describe('computeTodayIso', () => {
  test('pads single-digit month and day', () => {
    const now = new Date(2026, 0, 5, 10, 0, 0); // Jan 5, 2026, local
    expect(computeTodayIso(now)).toBe('2026-01-05');
  });

  test('does not use UTC getters -- late evening stays the same local day', () => {
    // 23:30 local time, Nov 2 -- a UTC-based implementation parsing a
    // date-only string would roll this to Nov 3 in any negative-offset
    // timezone. This constructs the Date from local components directly
    // (no string parsing involved), so it must stay Nov 2 regardless of
    // the machine's timezone.
    const now = new Date(2026, 10, 2, 23, 30, 0);
    expect(computeTodayIso(now)).toBe('2026-11-02');
  });
});

describe('isTodayDateString', () => {
  test('true when the date string matches today, regardless of hour', () => {
    const now = new Date(2026, 10, 2, 23, 45, 0);
    expect(isTodayDateString('2026-11-02', now)).toBe(true);
  });

  test('false for tomorrow, even at 23:45 today', () => {
    const now = new Date(2026, 10, 2, 23, 45, 0);
    expect(isTodayDateString('2026-11-03', now)).toBe(false);
  });

  test('false for yesterday', () => {
    const now = new Date(2026, 10, 2, 0, 5, 0);
    expect(isTodayDateString('2026-11-01', now)).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest calendar-today -v`
Expected: FAIL with "Cannot find module '../utils/calendar-today.js'"

- [ ] **Step 3: Write minimal implementation**

```js
// Mismo criterio que utils/session-start-window.js: constructor local
// (y, m, d) + getters locales, nunca `toISOString()`/parsing de string --
// ese camino interpreta un string fecha-sola como medianoche UTC, que en
// cualquier huso negativo (ej. GMT-3) corre la celda "hoy" un día en las
// últimas horas del día local. Ver docs/superpowers/specs/2026-11-02-
// runner-competitions-widget-design.md sección C para el root cause
// completo (confirmado contra react-native-calendars/src/dateutils.js).

function pad2(n) {
  return String(n).padStart(2, '0');
}

export function computeTodayIso(now = new Date()) {
  return `${now.getFullYear()}-${pad2(now.getMonth() + 1)}-${pad2(now.getDate())}`;
}

export function isTodayDateString(dateString, now = new Date()) {
  return dateString === computeTodayIso(now);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest calendar-today -v`
Expected: PASS (5 tests)

- [ ] **Step 5: Commit**

```bash
git add utils/calendar-today.js __tests__/calendar-today.test.js
git commit -m "feat(calendar): add timezone-safe isToday helper"
```

---

### Task 2: Apply the fix to both calendar screens

**Files:**
- Modify: `components/calendar/aggregated-month-view.jsx`
- Modify: `components/team/group-calendar-screen.jsx`

**Interfaces:**
- Consumes: `isTodayDateString(dateString, now)` from Task 1
  (`utils/calendar-today.js`).

Both files have the identical shape today: a `CalendarDayCell({ date, state, ... })`
component that reads `state === 'today'` (library-computed, buggy near midnight in
GMT-3) in two places (border color, text color), and a parent that renders
`<Calendar dayComponent={({ date, state }) => <CalendarDayCell date={date} state={state} .../>} />`.

- [ ] **Step 1: Add the import and compute `todayIso` once per render, in `aggregated-month-view.jsx`**

Find the top of the file (near the other imports) and add:

```js
import { computeTodayIso } from '../../utils/calendar-today.js';
```

Find the component that renders `<Calendar ... dayComponent={...} />` (the outer
component in this file, not `CalendarDayCell`). Add this line inside its body, before
the `return`:

```js
const todayIso = computeTodayIso();
```

- [ ] **Step 2: Stop trusting `state` for 'today', pass `isToday` explicitly**

In the same file, find the `dayComponent` prop:

```jsx
dayComponent={({ date, state }) => (
  <AggregatedDayCell ... state={state} .../>
)}
```

Change the cell's own state check instead of the prop plumbing: this library's `date`
object carries `date.dateString` (a plain `'YYYY-MM-DD'` string, unaffected by the UTC
bug -- it's just the label the library assigns to the cell, not the Date object it
later compares). Replace `state` usage inside `AggregatedDayCell` with a locally
computed `isToday`:

Find `function AggregatedDayCell({ date, state, assignments, onPress, showCollisions })`
and its `borderClass`/text-color logic (`state === 'today'` appears twice: once for
`borderClass`, once for the `Text` className). Add a new prop `isToday` to the
function signature, and replace both `state === 'today'` checks with `isToday`:

```js
function AggregatedDayCell({ date, state, isToday, assignments, onPress, showCollisions }) {
  const isOtherMonth = state === 'disabled';
  const borderClass = isOtherMonth
    ? 'border-2 border-transparent'
    : isToday
      ? 'transition-all hover:animate-pulse border-2 hover:border-4 hover:bg-opacity-60 border-dashed border-primary bg-green-100 dark:bg-green-800 dark:hover:bg-opacity-60'
      : 'transition-all hover:animate-pulse border-2 hover:border-4 hover:bg-opacity-60 border-slate-200 bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:hover:bg-opacity-60';
  // ... (rest of the component body unchanged)
```

```js
        className={`text-sm ${isOtherMonth ? 'text-slate-300 dark:text-slate-600' : isToday ? 'font-bold text-primary' : 'text-slate-700 dark:text-slate-200'}`}
```

(`state === 'disabled'` for `isOtherMonth` stays exactly as-is -- that check is about
the visible month grid boundary, not wall-clock time, and has no bug.)

Then update the `dayComponent` call site to pass the new prop:

```jsx
dayComponent={({ date, state }) => (
  <AggregatedDayCell
    assignments={...}
    date={date}
    isToday={date.dateString === todayIso}
    onPress={...}
    showCollisions={...}
    state={state}
  />
)}
```

(keep every other existing prop on `AggregatedDayCell` exactly as it is today -- only
`isToday` is new.)

- [ ] **Step 3: Repeat steps 1-2 in `group-calendar-screen.jsx`**

Same shape, same fix. This file already imports `pad2` from
`utils/calendar-month-range.js` (unrelated helper, don't touch that import) -- add the
`computeTodayIso` import alongside it:

```js
import { computeTodayIso } from '../../utils/calendar-today.js';
```

Add `const todayIso = computeTodayIso();` once in the screen component's body (the one
that renders `<Calendar dayComponent={...} />`), same as Task 2 Step 1.

`CalendarDayCell` in this file has the same two `state === 'today'` occurrences
(border logic has 2 more branches here for `selected`/`isMenuOpen`, which are
unaffected and stay as-is -- only the `state === 'today'` branch and the title-text
check change to `isToday`):

```js
function CalendarDayCell({ date, state, isToday, marking, containerRef, onOpenMenu, isMenuOpen, selectionActive, selectionClosedClass, selected, onToggleSelect, canManage }) {
  const isOtherMonth = state === 'disabled';
  const borderClass = isOtherMonth
    ? 'border-2 border-transparent'
    : selected
      ? 'transition-all border-4 border-primary'
      : isMenuOpen
        ? 'transition-all border-4 border-blue-200 bg-blue-100 dark:border-blue-600 dark:bg-blue-500'
        : isToday
          ? 'transition-all border-2 hover:animate-pulse hover:border-4 hover:bg-opacity-60 border-dashed border-primary bg-green-100 dark:bg-green-700 dark:hover:bg-opacity-60'
          : 'transition-all border-2 hover:animate-pulse hover:border-4 hover:bg-opacity-60 border-slate-200 bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:hover:bg-opacity-60';
```

```js
        className={`text-sm ${isOtherMonth ? 'text-slate-300 dark:text-slate-600' : isToday ? 'font-bold text-primary' : 'text-slate-700 dark:text-slate-200'}`}
```

Update its `dayComponent` call site the same way as Task 2 Step 2, adding
`isToday={date.dateString === todayIso}` alongside the existing props.

- [ ] **Step 4: Run lint and the full test suite**

Run: `npm run lint && npm test`
Expected: 0 new errors, 0 new warnings, all suites still passing (152+ suites).

- [ ] **Step 5: Manual verification note**

This can't be verified by changing the system clock in the web preview reliably
(timezone of the dev machine running the preview may differ from GMT-3). Verify by
temporarily calling `computeTodayIso` with a hardcoded late-evening `Date` in a
throwaway `console.log` inside the screen component, confirming the cell it marks
matches the real current day label, then remove the throwaway log before committing.

- [ ] **Step 6: Commit**

```bash
git add components/calendar/aggregated-month-view.jsx components/team/group-calendar-screen.jsx
git commit -m "fix(calendar): stop trusting library's today-state near midnight in GMT-3"
```

---

### Task 3: Pure sort/select helpers for competition lists

**Files:**
- Create: `utils/competition-sort.js`
- Test: `__tests__/competition-sort.test.js`

**Interfaces:**
- Consumes: competition objects shaped like `services/normalizers.js#toCompetitionModel`
  output -- specifically `{ type: 'metric'|'route', status: string, startAt: string,
  endAt: string|null }` (ISO datetime strings).
- Produces:
  - `sortCompetitionsForPreview(competitions)` → new sorted array. `metric` entries
    first (by `endAt` ascending), `route` entries after (by `startAt` descending).
  - `sortCompetitionsForList(competitions)` → new sorted array, grouped by status
    priority (`active` → `pending_approval` → everything else), same date criterion as
    `sortCompetitionsForPreview` within each group.

- [ ] **Step 1: Write the failing test**

```js
const { sortCompetitionsForPreview, sortCompetitionsForList } = require('../utils/competition-sort.js');

function comp(overrides) {
  return { id: '1', type: 'metric', status: 'active', startAt: '2026-01-01T00:00:00Z', endAt: null, ...overrides };
}

describe('sortCompetitionsForPreview', () => {
  test('metric competitions sorted by soonest endAt first', () => {
    const a = comp({ id: 'a', endAt: '2026-11-10T00:00:00Z' });
    const b = comp({ id: 'b', endAt: '2026-11-05T00:00:00Z' });
    const result = sortCompetitionsForPreview([a, b]);
    expect(result.map((c) => c.id)).toEqual(['b', 'a']);
  });

  test('route competitions (no endAt) come after metric, sorted by most recent startAt', () => {
    const metricOne = comp({ id: 'metric', endAt: '2026-11-10T00:00:00Z' });
    const routeOld = comp({ id: 'route-old', type: 'route', endAt: null, startAt: '2026-01-01T00:00:00Z' });
    const routeNew = comp({ id: 'route-new', type: 'route', endAt: null, startAt: '2026-10-01T00:00:00Z' });
    const result = sortCompetitionsForPreview([routeOld, metricOne, routeNew]);
    expect(result.map((c) => c.id)).toEqual(['metric', 'route-new', 'route-old']);
  });

  test('does not mutate the input array', () => {
    const list = [comp({ id: 'a', endAt: '2026-11-10T00:00:00Z' }), comp({ id: 'b', endAt: '2026-11-05T00:00:00Z' })];
    const copy = [...list];
    sortCompetitionsForPreview(list);
    expect(list).toEqual(copy);
  });
});

describe('sortCompetitionsForList', () => {
  test('active first, then pending_approval, then the rest', () => {
    const finished = comp({ id: 'finished', status: 'finished' });
    const active = comp({ id: 'active', status: 'active' });
    const pending = comp({ id: 'pending', status: 'pending_approval' });
    const rejected = comp({ id: 'rejected', status: 'rejected' });
    const result = sortCompetitionsForList([finished, pending, rejected, active]);
    expect(result.map((c) => c.id)).toEqual(['active', 'pending', 'finished', 'rejected']);
  });

  test('within the same status group, applies the same date criterion as the preview sort', () => {
    const activeSoon = comp({ id: 'soon', status: 'active', endAt: '2026-11-05T00:00:00Z' });
    const activeLater = comp({ id: 'later', status: 'active', endAt: '2026-11-10T00:00:00Z' });
    const result = sortCompetitionsForList([activeLater, activeSoon]);
    expect(result.map((c) => c.id)).toEqual(['soon', 'later']);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest competition-sort -v`
Expected: FAIL with "Cannot find module '../utils/competition-sort.js'"

- [ ] **Step 3: Write minimal implementation**

```js
// `endAt`/`startAt` son ISO datetime strings -- Date.parse las compara bien
// sin parsing manual, a diferencia del bug de calendar-today.js (ahí el
// problema era un string FECHA-SOLA, sin hora; acá siempre viene con hora
// y zona, Date.parse es seguro).

function byEndAtAscending(a, b) {
  return new Date(a.endAt).getTime() - new Date(b.endAt).getTime();
}

function byStartAtDescending(a, b) {
  return new Date(b.startAt).getTime() - new Date(a.startAt).getTime();
}

// Orden compartido por las dos funciones de este archivo: dentro de un
// mismo grupo (preview: todas; lista: cada status), metric antes que
// route, metric ordenado por cierre más próximo, route por más reciente.
function sortByTypeAndDate(competitions) {
  const metric = competitions.filter((c) => c.type === 'metric').sort(byEndAtAscending);
  const route = competitions.filter((c) => c.type !== 'metric').sort(byStartAtDescending);
  return [...metric, ...route];
}

export function sortCompetitionsForPreview(competitions) {
  return sortByTypeAndDate(competitions);
}

const STATUS_PRIORITY = { active: 0, pending_approval: 1 };

export function sortCompetitionsForList(competitions) {
  const groups = new Map();
  competitions.forEach((c) => {
    const priority = STATUS_PRIORITY[c.status] ?? 2;
    if (!groups.has(priority)) groups.set(priority, []);
    groups.get(priority).push(c);
  });
  return [...groups.keys()].sort((a, b) => a - b).flatMap((priority) => sortByTypeAndDate(groups.get(priority)));
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest competition-sort -v`
Expected: PASS (5 tests)

- [ ] **Step 5: Commit**

```bash
git add utils/competition-sort.js __tests__/competition-sort.test.js
git commit -m "feat(competitions): add pure sort helpers for preview and list views"
```

---

### Task 4: Cross-team competitions fan-out hook

**Files:**
- Modify: `hooks/use-competitions.js`
- Create: `hooks/use-my-competitions.js`

**Interfaces:**
- Consumes: `useMyMemberTeams(userId)` from `hooks/use-teams.js` (existing, returns
  `{ teams, loading, error }`, each team `{ id: string, name: string, ... }`).
  `listCompetitions(teamId, { status, groupId })` from `services/competitions.js`
  (existing). `toCompetitionModel` from `services/normalizers.js` (existing).
- Produces: `competitionsQueryOptions(teamId, { status, groupId } = {})` → a
  TanStack Query options object (`{ queryKey, queryFn, enabled }`), exported from
  `hooks/use-competitions.js`, usable with both `useQuery` (as `useCompetitions`
  already does) and `useQueries` (as this task's new hook does).
  `useMyCompetitions(userId, { status } = {})` → `{ competitions: Array<Competition
  & { teamName: string }>, loading: boolean }`, exported from
  `hooks/use-my-competitions.js`. Every item has already been filtered to ones where
  `competition.participantUserIds.includes(String(userId))`.

- [ ] **Step 1: Extract `competitionsQueryOptions` in `hooks/use-competitions.js`**

This file currently has `useCompetitions(teamId, { status, groupId } = {})` with the
`queryKey`/`queryFn` written inline inside a `useQuery({...})` call. Replace it with:

```js
// Factorizado para que useMyCompetitions (hooks/use-my-competitions.js) pueda
// pedir el mismo recurso con useQueries (N equipos en paralelo) sin duplicar
// la key/queryFn -- mismo patrón que teamQueryOptions en hooks/use-teams.js.
export function competitionsQueryOptions(teamId, { status, groupId } = {}) {
  return {
    queryKey: ['competitions', teamId, status, groupId],
    queryFn: () => listCompetitions(teamId, { status, groupId }).then((response) => ({
      competitions: (response.data ?? response).map(toCompetitionModel),
      hasUnseen: Boolean(response.has_unseen),
    })),
    enabled: Boolean(teamId),
  };
}

export function useCompetitions(teamId, { status, groupId } = {}) {
  const query = useQuery(competitionsQueryOptions(teamId, { status, groupId }));

  return {
    competitions: query.data?.competitions ?? [],
    hasUnseen: query.data?.hasUnseen ?? false,
    loading: query.isLoading,
    error: query.error ?? null,
  };
}
```

(Every other export in this file -- `useCompetitionDetail`, `useCompetitionAttempts`,
etc. -- stays untouched. This is a pure refactor: same queryKey, same queryFn, same
return shape for `useCompetitions`'s existing callers.)

- [ ] **Step 2: Run the full test suite to confirm the refactor is behavior-neutral**

Run: `npm test`
Expected: all suites still passing, same count as before this task (there is no
dedicated test file for `use-competitions.js` today, but `competitions-mock.test.js`
and other integration-adjacent tests must be unaffected).

- [ ] **Step 3: Write `hooks/use-my-competitions.js`**

```js
import { useQueries } from '@tanstack/react-query';
import { useMyMemberTeams } from './use-teams.js';
import { competitionsQueryOptions } from './use-competitions.js';

// Fan-out cross-equipo sin endpoint nuevo -- mismo mecanismo que ya usa el
// punto rojo global de Gap 34 (docs/BACKEND_API_GAPS.md): recorrer los
// equipos donde el usuario es corredor y pedir las competencias de cada
// uno en paralelo con useQueries (mismo patrón que hooks/use-team-fees.js).
// "Participa" = su userId está en participantUserIds (campo real, ya
// normalizado) -- NO "es miembro del equipo", un equipo puede tener
// competencias en las que este corredor no fue anotado.
export function useMyCompetitions(userId, { status } = {}) {
  const { teams, loading: teamsLoading } = useMyMemberTeams(userId);
  const teamIds = teams.map((t) => t.id);

  const queries = useQueries({
    queries: teamIds.map((teamId) => competitionsQueryOptions(teamId, { status })),
  });

  const userIdStr = String(userId);
  const competitions = [];
  teamIds.forEach((teamId, i) => {
    const teamName = teams[i].name;
    const list = queries[i]?.data?.competitions ?? [];
    list.forEach((competition) => {
      if (competition.participantUserIds.includes(userIdStr)) {
        competitions.push({ ...competition, teamName });
      }
    });
  });

  return {
    competitions,
    loading: teamsLoading || queries.some((q) => q.isLoading),
  };
}
```

- [ ] **Step 4: Run lint**

Run: `npm run lint`
Expected: 0 new errors, 0 new warnings.

- [ ] **Step 5: Commit**

```bash
git add hooks/use-competitions.js hooks/use-my-competitions.js
git commit -m "feat(competitions): add cross-team useMyCompetitions fan-out hook"
```

---

### Task 5: Home widget — `CompetitionsPreviewCard`

**Files:**
- Create: `components/home/competitions-preview-card.jsx`
- Modify: `components/home/authenticated-home-screen.jsx`

**Interfaces:**
- Consumes: `useMyCompetitions(userId, { status: 'active' })` (Task 4),
  `sortCompetitionsForPreview` (Task 3), `buildCompetitionTitle` from
  `utils/competition-title.js` (existing), `useIsNarrowWeb` from
  `hooks/use-is-narrow-web.js` (existing), `isWeb` from `utils/platform.js`
  (existing), `useAuthStore((s) => s.userId)` from `store/auth-store.js` (existing).

- [ ] **Step 1: Write `components/home/competitions-preview-card.jsx`**

```jsx
import { Pressable, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useAuthStore } from '../../store/auth-store.js';
import { useMyCompetitions } from '../../hooks/use-my-competitions.js';
import { sortCompetitionsForPreview } from '../../utils/competition-sort.js';
import { buildCompetitionTitle } from '../../utils/competition-title.js';
import { useIsNarrowWeb } from '../../hooks/use-is-narrow-web.js';
import { useThemeColors } from '../../theme/colors.js';
import { isWeb } from '../../utils/platform.js';

const TYPE_ICON = { route: 'flag-checkered', metric: 'trophy-variant' };

function statusLabel(competition) {
  if (competition.type === 'route') return 'Abierta';
  if (!competition.endAt) return 'Abierta';
  const days = Math.ceil((new Date(competition.endAt).getTime() - Date.now()) / 86_400_000);
  if (days <= 0) return 'Cierra hoy';
  return `Cierra en ${days} ${days === 1 ? 'día' : 'días'}`;
}

function PreviewBox({ competition, onPress, wide }) {
  const colors = useThemeColors();
  const idPrefix = `competitions-preview-box-${competition.id}`;
  return (
    <View className={`rounded-2xl bg-white p-4 dark:border dark:border-surface-2 dark:bg-surface ${wide ? 'flex-1' : ''}`} nativeID={idPrefix} testID={idPrefix}>
      <View className="mb-2 flex-row items-center gap-2" nativeID={`${idPrefix}-header`} testID={`${idPrefix}-header`}>
        <MaterialCommunityIcons color={colors.primary} name={TYPE_ICON[competition.type] ?? 'trophy-variant'} size={18} />
        <Text className="flex-1 font-bold text-slate-900 dark:text-white" nativeID={`${idPrefix}-title`} numberOfLines={1} testID={`${idPrefix}-title`}>
          {buildCompetitionTitle(competition)}
        </Text>
      </View>
      <Text className="mb-1 text-xs text-slate-500 dark:text-slate-400" nativeID={`${idPrefix}-team`} numberOfLines={1} testID={`${idPrefix}-team`}>
        {competition.teamName}
      </Text>
      <Text className="mb-3 text-xs font-semibold text-primary" nativeID={`${idPrefix}-status`} testID={`${idPrefix}-status`}>
        {statusLabel(competition)}
      </Text>
      <Pressable
        accessibilityLabel={`Ver ${buildCompetitionTitle(competition)}`}
        accessibilityRole="button"
        className="self-start rounded-full bg-primary px-3 py-1.5 hover:opacity-90 active:opacity-90"
        nativeID={`${idPrefix}-cta`}
        onPress={onPress}
        testID={`${idPrefix}-cta`}
      >
        <Text className="text-xs font-bold text-[#111518]" nativeID={`${idPrefix}-cta-label`} testID={`${idPrefix}-cta-label`}>Ver</Text>
      </Pressable>
    </View>
  );
}

export function CompetitionsPreviewCard() {
  const router = useRouter();
  const userId = useAuthStore((s) => s.userId);
  const isNarrow = useIsNarrowWeb();
  const { competitions, loading } = useMyCompetitions(userId, { status: 'active' });

  if (loading || competitions.length === 0) return null;

  const preview = sortCompetitionsForPreview(competitions).slice(0, 3);
  const wide = isWeb && !isNarrow;

  return (
    <View className={`mt-4 ${wide ? 'flex-row gap-3' : 'gap-3'}`} nativeID="competitions-preview-card" testID="competitions-preview-card">
      {preview.map((competition) => (
        <PreviewBox
          competition={competition}
          key={competition.id}
          onPress={() => router.push(`/teams/${competition.teamId}?tab=competencias`)}
          wide={wide}
        />
      ))}
    </View>
  );
}
```

- [ ] **Step 2: Mount it in `authenticated-home-screen.jsx`**

Add the import near the other home-card imports:

```js
import { CompetitionsPreviewCard } from './competitions-preview-card.jsx';
```

Find the `activeRole === 'runner'` block:

```jsx
{activeRole === 'runner' && (
  <>
    <StreakBanner />
    <AchievementHighlightCard />
    <RunnerKpisCard />
  </>
)}
```

Add the new card as the last child:

```jsx
{activeRole === 'runner' && (
  <>
    <StreakBanner />
    <AchievementHighlightCard />
    <RunnerKpisCard />
    <CompetitionsPreviewCard />
  </>
)}
```

- [ ] **Step 3: Run lint**

Run: `npm run lint`
Expected: 0 new errors, 0 new warnings (watch for `local/require-native-id` --
every `View`/`Pressable`/`Text` above already has `nativeID`/`testID`).

- [ ] **Step 4: Manual verification in preview**

Start the web preview, log in as a runner account that's a member of a team with at
least one `active` competition with this user in `participants` (use
`services/__mocks__/competitions-mock.js` if needed -- add this user's id to an
existing active competition's `participants` array for a quick manual check). Confirm:
the card appears below the KPIs on the home screen; resizing the window below 1024px
stacks the boxes; clicking "Ver" navigates to that team's Competencias tab.

- [ ] **Step 5: Commit**

```bash
git add components/home/competitions-preview-card.jsx components/home/authenticated-home-screen.jsx
git commit -m "feat(home): show up to 3 active competitions the runner participates in"
```

---

### Task 6: Gamification hub — "Competencias" tab

**Files:**
- Create: `components/achievements/my-competitions-tab.jsx`
- Modify: `components/achievements/achievements-screen.jsx`

**Interfaces:**
- Consumes: `useMyCompetitions(userId)` (Task 4, no `status` filter this time --
  "todas"), `sortCompetitionsForList` (Task 3), `buildCompetitionTitle` (existing).

- [ ] **Step 1: Write `components/achievements/my-competitions-tab.jsx`**

```jsx
import { Pressable, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuthStore } from '../../store/auth-store.js';
import { useMyCompetitions } from '../../hooks/use-my-competitions.js';
import { sortCompetitionsForList } from '../../utils/competition-sort.js';
import { buildCompetitionTitle } from '../../utils/competition-title.js';

// Mismo par de tonos fijo por color que el resto de la app (ver
// docs/superpowers/specs/2026-10-31-visual-design-refresh-design.md,
// sección "Badges"), no se reusa ComplianceBadge -- ese toma un `pct`
// numérico, no un status de competencia.
const STATUS_TONE = {
  active: { label: 'Activa', bg: 'bg-primary-tint-subtle dark:bg-primary/15', text: 'text-on-primary-tint dark:text-primary' },
  pending_approval: { label: 'Pendiente', bg: 'bg-amber-50 dark:bg-amber-900/20', text: 'text-amber-700 dark:text-amber-400' },
  finished: { label: 'Finalizada', bg: 'bg-slate-100 dark:bg-surface-2', text: 'text-slate-600 dark:text-slate-300' },
  rejected: { label: 'Rechazada', bg: 'bg-slate-100 dark:bg-surface-2', text: 'text-slate-600 dark:text-slate-300' },
};

function StatusBadge({ status }) {
  const tone = STATUS_TONE[status] ?? STATUS_TONE.finished;
  return (
    <View className={`self-start rounded-full px-2.5 py-0.5 ${tone.bg}`} nativeID={`my-competitions-tab-status-${status}`} testID={`my-competitions-tab-status-${status}`}>
      <Text className={`text-xs font-bold ${tone.text}`} nativeID={`my-competitions-tab-status-${status}-label`} testID={`my-competitions-tab-status-${status}-label`}>{tone.label}</Text>
    </View>
  );
}

function CompetitionRow({ competition, onPress }) {
  const idPrefix = `my-competitions-tab-row-${competition.id}`;
  return (
    <View className="mb-2 flex-row items-center gap-3 rounded-xl bg-slate-50 p-3 dark:bg-surface-2" nativeID={idPrefix} testID={idPrefix}>
      <View className="flex-1" nativeID={`${idPrefix}-text`} testID={`${idPrefix}-text`}>
        <Text className="font-semibold text-slate-900 dark:text-white" nativeID={`${idPrefix}-title`} numberOfLines={1} testID={`${idPrefix}-title`}>
          {buildCompetitionTitle(competition)}
        </Text>
        <Text className="text-xs text-slate-500 dark:text-slate-400" nativeID={`${idPrefix}-team`} numberOfLines={1} testID={`${idPrefix}-team`}>
          {competition.teamName}
        </Text>
      </View>
      <StatusBadge status={competition.status} />
      <Pressable
        accessibilityLabel={`Ver ${buildCompetitionTitle(competition)} en el equipo`}
        accessibilityRole="button"
        className="rounded-full px-3 py-1.5 hover:bg-slate-200 dark:hover:bg-surface-3"
        nativeID={`${idPrefix}-cta`}
        onPress={onPress}
        testID={`${idPrefix}-cta`}
      >
        <Text className="text-xs font-bold text-primary" nativeID={`${idPrefix}-cta-label`} testID={`${idPrefix}-cta-label`}>Ver en el equipo</Text>
      </Pressable>
    </View>
  );
}

export function MyCompetitionsTab() {
  const router = useRouter();
  const userId = useAuthStore((s) => s.userId);
  const { competitions, loading } = useMyCompetitions(userId);

  if (loading) return null;

  if (competitions.length === 0) {
    return (
      <Text className="py-6 text-center text-sm text-slate-400 dark:text-slate-500" nativeID="my-competitions-tab-empty" testID="my-competitions-tab-empty">
        Todavía no participás de ninguna competencia.
      </Text>
    );
  }

  const sorted = sortCompetitionsForList(competitions);

  return (
    <View nativeID="my-competitions-tab-root" testID="my-competitions-tab-root">
      {sorted.map((competition) => (
        <CompetitionRow
          competition={competition}
          key={competition.id}
          onPress={() => router.push(`/teams/${competition.teamId}?tab=competencias`)}
        />
      ))}
    </View>
  );
}
```

- [ ] **Step 2: Wire the tab into `achievements-screen.jsx`**

Add the import:

```js
import { MyCompetitionsTab } from './my-competitions-tab.jsx';
```

Update `TABS`:

```js
const TABS = [
  { id: 'streaks', label: 'Rachas', icon: 'fire' },
  { id: 'achievements', label: 'Logros', icon: 'medal-outline' },
  { id: 'competitions', label: 'Competencias', icon: 'sword-cross' },
  { id: 'trophies', label: 'Vitrina', icon: 'trophy' },
];
```

Update the ack-section ternary (find the line that reads
`const section = activeTab === 'streaks' ? 'streaks' : 'achievements';`):

```js
const section = activeTab === 'streaks' ? 'streaks' : activeTab === 'competitions' ? 'competitions' : 'achievements';
```

Update the render block (find
`{activeTab === 'achievements' && <AchievementsTab />}` /
`{activeTab === 'trophies' && <TrophyCaseTab />}`):

```jsx
{activeTab === 'achievements' && <AchievementsTab />}
{activeTab === 'competitions' && <MyCompetitionsTab />}
{activeTab === 'trophies' && <TrophyCaseTab />}
```

- [ ] **Step 3: Run lint**

Run: `npm run lint`
Expected: 0 new errors, 0 new warnings.

- [ ] **Step 4: Manual verification in preview**

Open the gamification hub ("Logros" in the nav), confirm the new "Competencias" tab
appears between Logros and Vitrina, shows the same participant's competitions as
Task 5 (all statuses now, not just active), and "Ver en el equipo" navigates
correctly. Confirm the empty state renders for a user with zero competitions.

- [ ] **Step 5: Commit**

```bash
git add components/achievements/my-competitions-tab.jsx components/achievements/achievements-screen.jsx
git commit -m "feat(achievements): add cross-team Competencias tab to the gamification hub"
```

---

### Task 7: Document the same-day assignment policy gap

**Files:**
- Modify: `docs/BACKEND_API_GAPS.md`

**Interfaces:** None -- documentation only, no code.

- [ ] **Step 1: Find the next free Gap number**

Open `docs/BACKEND_API_GAPS.md` and find the highest `## Gap N —` heading currently in
the file (as of this plan, Gap 36 is the latest). Use the next integer.

- [ ] **Step 2: Add the new section**

Append this section (replacing `N` with the actual next number found in Step 1), right
after the last existing `## Gap` section in the file:

```markdown
## Gap N — política de asignación same-day: async-hoy debería quedar a discreción del entrenador

**Contexto.** Decidido con el usuario junto con el fix de symptom #4 de
`route-attempt-orphaned-attempt-bug-2026-10-31` (ver memoria de sesión): el bloqueo
actual de asignación same-day no distingue presencial de asíncrono, y para
asíncrono es más estricto de lo que el entrenador necesita.

**Estado actual, confirmado** (`calendar_service.go#isCalendarDayClosed`, otro repo):
una sesión asíncrona del día de HOY está cerrada para asignar, exactamente igual que
un día ya pasado -- bloqueo duro, sin excepción. Una sesión presencial de hoy sigue
abierta hasta que pasa su horario planificado (`presencial_time_from`); ese
comportamiento ya es el correcto, sin cambios pedidos ahí.

**Pedido:** que async-hoy sea asignable, a discreción del entrenador -- sin un
bloqueo duro del sistema. "Es muy tarde en el día para asignar esto" no lo decide
una regla nuestra: el entrenador ve el día de hoy en el calendario y decide si
igual quiere asignar la sesión o esperar a mañana.

**Alcance:** cambio de backend únicamente, en `isCalendarDayClosed`
(`calendar_service.go`). Confirmado que el frontend no necesita ningún cambio de
código una vez que el backend lo habilite -- la pantalla de asignación ya intenta la
request tal cual hoy, el bloqueo es 100% del lado backend. Sin trabajo de frontend
pendiente más allá de esta nota.
```

- [ ] **Step 3: Commit**

```bash
git add docs/BACKEND_API_GAPS.md
git commit -m "docs(backend-gaps): document same-day async assignment policy change"
```

---

## Self-Review Notes

- **Spec coverage:** Section A → Tasks 4-5. Section B → Tasks 4, 6. Section C → Tasks
  1-2. Section D → Task 7. All 4 spec sections have a task.
- **Type consistency:** `useMyCompetitions` is defined once in Task 4 and consumed
  identically (same signature, same `{ competitions, loading }` return shape) by
  Tasks 5 and 6 -- Task 5 passes `{ status: 'active' }`, Task 6 passes no options
  (spec's explicit "todas" requirement for the tab). `competition.teamId` (used in
  both Tasks 5 and 6 for the deep link) comes from `toCompetitionModel` (already a
  string, per `services/normalizers.js`) unchanged by the `teamName` enrichment Task 4
  adds.
- **No placeholders:** every step has real, complete code -- no "add error handling"
  or "similar to Task N" shortcuts.
