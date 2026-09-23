# Live Session Base — Navigation & Pre-Start Screen Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a runner reach a pre-start screen for today's async training, and a trainer reach the same screen for a presencial training within ±30min of its scheduled start, from the existing calendar surfaces — with nowhere further to go yet (the actual timer/GPS/recording interface is a separate future plan).

**Architecture:** A pure gating util (`utils/session-start-window.js`) decides eligibility per role. A shared `StartSessionButton` renders (or no-ops) based on that gate and, on press, stashes the tapped day in a transient Zustand store (`store/session-runtime-store.js`) and navigates to a new native-only route. That route renders a pre-start screen (date, session name, exercise preview, expandable full list, Play button) reading the stashed day. Play navigates to a second, empty stub route reserved for the real recording interface. Two existing calendar files gain the button; two new routes and their components are created; no backend calls, no new fetch hooks — everything reads data already present in memory at the call site.

**Tech Stack:** React Native + Expo Router (`~6.0.24`), Zustand (`^5.0.13`), NativeWind, `@expo/vector-icons`. No new dependencies.

**Spec:** `docs/superpowers/specs/2026-09-23-live-session-base-design.md`

## Global Constraints

- Every visual element (`View`/`Text`/`Pressable`/`Modal`/etc., including `Animated.*`) needs both `nativeID` and `testID`, kebab-case, unique in context — enforced by ESLint `local/require-native-id`, blocks CI.
- No component render tests (project convention) — only Jest for pure logic (utils, store).
- `npm test` and `npm run lint` must be green before any task counts as done.
- This entire module (`components/session-runtime/`, `app/training-session/`, `app/training-session-active.jsx`) is **native-only by design** — no web fallback. Gate every screen with the existing `MobileOnlyRoute` (`components/guards/platform-gate.jsx`), never a new inline `Platform.OS` check.
- `<Redirect href="...">` (from `expo-router`) for any first-render conditional redirect — never `router.replace()` inside a `useEffect` (established project convention, see `components/auth/reset-password-screen.jsx`).
- No timer, no GPS, no save/history logic in this plan — the stub route (Task 7) is intentionally empty.

---

### Task 1: Session start-window gating util

**Files:**
- Create: `utils/session-start-window.js`
- Test: `__tests__/session-start-window.test.js`

**Interfaces:**
- Consumes: nothing (pure function, no project imports).
- Produces: `canStartAsyncSession(day, now = new Date())` → `boolean`; `canStartPresencialSession(day, now = new Date())` → `boolean`. Both take a day-like object with at least `{ kind, isPresencial, date, presencialTimeFrom }` (matches the shape of `GroupCalendarDayModel`/`AggregatedCalendarDayModel` from `services/normalizers.js`). Task 3 (`StartSessionButton`) imports both by name.

Mirrors the existing `isCalendarDayClosed` pattern (`utils/calendar-day-closed.js`) exactly: wall-clock literal comparison (no timezone conversion), `now` injectable for tests instead of relying on fake timers.

- [ ] **Step 1: Write the failing tests**

```js
// __tests__/session-start-window.test.js
import { canStartAsyncSession, canStartPresencialSession } from '../utils/session-start-window.js';

const NOW = new Date(2026, 9, 15, 10, 0, 0); // 2026-10-15 10:00 local

describe('canStartAsyncSession', () => {
  test('hoy, entrenamiento no presencial, habilitado', () => {
    expect(canStartAsyncSession({ kind: 'training', isPresencial: false, date: '2026-10-15' }, NOW)).toBe(true);
  });

  test('otro día, deshabilitado', () => {
    expect(canStartAsyncSession({ kind: 'training', isPresencial: false, date: '2026-10-16' }, NOW)).toBe(false);
  });

  test('presencial, deshabilitado (lo arranca el entrenador)', () => {
    expect(canStartAsyncSession({ kind: 'training', isPresencial: true, date: '2026-10-15' }, NOW)).toBe(false);
  });

  test('descanso u otra actividad, deshabilitado', () => {
    expect(canStartAsyncSession({ kind: 'rest', isPresencial: false, date: '2026-10-15' }, NOW)).toBe(false);
    expect(canStartAsyncSession({ kind: 'other', isPresencial: false, date: '2026-10-15' }, NOW)).toBe(false);
  });
});

describe('canStartPresencialSession', () => {
  const base = { kind: 'training', isPresencial: true, date: '2026-10-15' };

  test('dentro de la ventana de 30 min antes del horario, habilitado', () => {
    expect(canStartPresencialSession({ ...base, presencialTimeFrom: '10:29' }, NOW)).toBe(true);
  });

  test('dentro de la ventana de 30 min después del horario, habilitado', () => {
    expect(canStartPresencialSession({ ...base, presencialTimeFrom: '09:31' }, NOW)).toBe(true);
  });

  test('fuera de la ventana (más de 30 min antes), deshabilitado', () => {
    expect(canStartPresencialSession({ ...base, presencialTimeFrom: '10:31' }, NOW)).toBe(false);
  });

  test('fuera de la ventana (más de 30 min después), deshabilitado', () => {
    expect(canStartPresencialSession({ ...base, presencialTimeFrom: '09:29' }, NOW)).toBe(false);
  });

  test('otro día, deshabilitado aunque el horario coincida', () => {
    expect(canStartPresencialSession({ ...base, date: '2026-10-16', presencialTimeFrom: '10:00' }, NOW)).toBe(false);
  });

  test('sin presencialTimeFrom cargado, deshabilitado', () => {
    expect(canStartPresencialSession({ ...base, presencialTimeFrom: null }, NOW)).toBe(false);
  });

  test('no presencial, deshabilitado', () => {
    expect(canStartPresencialSession({ ...base, isPresencial: false, presencialTimeFrom: '10:00' }, NOW)).toBe(false);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx jest session-start-window -v`
Expected: FAIL with "Cannot find module '../utils/session-start-window.js'"

- [ ] **Step 3: Write the implementation**

```js
// utils/session-start-window.js
// Mismo criterio de "hoy" que isCalendarDayClosed (utils/calendar-day-closed.js)
// — wall-clock literal, sin conversión de huso horario, `now` inyectable
// para tests en vez de fake timers. Advisory del lado del frontend, sin
// dependencia de backend — este módulo todavía no persiste nada.
const PRESENCIAL_WINDOW_MINUTES = 30;

function isSameDay(dateStr, now) {
  const [year, month, day] = dateStr.split('-').map(Number);
  const target = new Date(year, month - 1, day);
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return target.getTime() === today.getTime();
}

export function canStartAsyncSession(day, now = new Date()) {
  return day.kind === 'training' && !day.isPresencial && isSameDay(day.date, now);
}

export function canStartPresencialSession(day, now = new Date()) {
  if (day.kind !== 'training' || !day.isPresencial || !day.presencialTimeFrom) return false;
  if (!isSameDay(day.date, now)) return false;
  const [hours, minutes] = day.presencialTimeFrom.split(':').map(Number);
  const scheduledStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hours, minutes, 0, 0);
  const diffMinutes = (now.getTime() - scheduledStart.getTime()) / 60000;
  return diffMinutes >= -PRESENCIAL_WINDOW_MINUTES && diffMinutes <= PRESENCIAL_WINDOW_MINUTES;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx jest session-start-window -v`
Expected: PASS, 8/8

- [ ] **Step 5: Commit**

```bash
git add utils/session-start-window.js __tests__/session-start-window.test.js
git commit -m "feat(session-runtime): add pure gating util for start-session eligibility"
```

---

### Task 2: Transient session-runtime store

**Files:**
- Create: `store/session-runtime-store.js`
- Test: `__tests__/session-runtime-store.test.js`

**Interfaces:**
- Consumes: `zustand`'s `create` (same minimal style as `store/team-store.js` — no persist/middleware, intentionally in-memory only, lost on app restart).
- Produces: `useSessionRuntimeStore` hook, with state shape `{ pendingSession, setPendingSession(day), clearPendingSession() }`. Task 3 (`StartSessionButton`) calls `setPendingSession`; Task 6 (pre-start screen) reads `pendingSession`.

- [ ] **Step 1: Write the failing tests**

```js
// __tests__/session-runtime-store.test.js
import { useSessionRuntimeStore } from '../store/session-runtime-store.js';

describe('session-runtime-store', () => {
  afterEach(() => {
    useSessionRuntimeStore.getState().clearPendingSession();
  });

  test('arranca en null', () => {
    expect(useSessionRuntimeStore.getState().pendingSession).toBeNull();
  });

  test('setPendingSession guarda el día elegido', () => {
    const day = { id: '1', date: '2026-10-15', kind: 'training' };
    useSessionRuntimeStore.getState().setPendingSession(day);
    expect(useSessionRuntimeStore.getState().pendingSession).toEqual(day);
  });

  test('clearPendingSession lo vacía', () => {
    useSessionRuntimeStore.getState().setPendingSession({ id: '1' });
    useSessionRuntimeStore.getState().clearPendingSession();
    expect(useSessionRuntimeStore.getState().pendingSession).toBeNull();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx jest session-runtime-store -v`
Expected: FAIL with "Cannot find module '../store/session-runtime-store.js'"

- [ ] **Step 3: Write the implementation**

```js
// store/session-runtime-store.js
import { create } from 'zustand';

// Slot transitorio, sin persist — solo pasa el día elegido del botón del
// calendario a la pantalla previa al inicio, dentro de la misma sesión de
// app (no sobrevive un cold-start). Ver
// docs/superpowers/specs/2026-09-23-live-session-base-design.md para el
// razonamiento y la mejora futura anotada (endpoint GET /calendar-days/{id}
// si algún día hace falta reconstruir esto de forma deep-link-safe).
export const useSessionRuntimeStore = create((set) => ({
  pendingSession: null,
  setPendingSession: (day) => set({ pendingSession: day }),
  clearPendingSession: () => set({ pendingSession: null }),
}));
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx jest session-runtime-store -v`
Expected: PASS, 3/3

- [ ] **Step 5: Commit**

```bash
git add store/session-runtime-store.js __tests__/session-runtime-store.test.js
git commit -m "feat(session-runtime): add transient store to hand off the selected calendar day"
```

---

### Task 3: Shared `StartSessionButton`

**Files:**
- Create: `components/calendar/start-session-button.jsx`

**Interfaces:**
- Consumes: `canStartAsyncSession`/`canStartPresencialSession` (Task 1), `useSessionRuntimeStore` (Task 2), `useThemeColors` (`theme/colors.js`, existing), `useRouter` (`expo-router`, existing).
- Produces: `<StartSessionButton assignment={dayModel} role="runner" | "trainer" />`. Renders `null` when not eligible — callers (Tasks 4 and 5) never need to pre-filter by `kind`/`isPresencial` themselves. No test file — this is a presentational component with no pure logic of its own (all logic already covered by Task 1's tests); project convention skips component render tests.

- [ ] **Step 1: Write the implementation**

```jsx
// components/calendar/start-session-button.jsx
import { Pressable, Text } from 'react-native';
import { useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useThemeColors } from '../../theme/colors.js';
import { canStartAsyncSession, canStartPresencialSession } from '../../utils/session-start-window.js';
import { useSessionRuntimeStore } from '../../store/session-runtime-store.js';

export function StartSessionButton({ assignment, role }) {
  const router = useRouter();
  const colors = useThemeColors();
  const setPendingSession = useSessionRuntimeStore((s) => s.setPendingSession);

  const eligible = role === 'runner' ? canStartAsyncSession(assignment) : canStartPresencialSession(assignment);
  if (!eligible) return null;

  const idPrefix = `start-session-button-${assignment.id}`;

  const handlePress = () => {
    setPendingSession(assignment);
    router.push('/training-session');
  };

  return (
    <Pressable
      className="mt-2 h-9 flex-row items-center justify-center gap-1.5 rounded-full bg-primary active:opacity-80"
      nativeID={idPrefix}
      onPress={handlePress}
      testID={idPrefix}
    >
      <MaterialCommunityIcons color={colors.onPrimary} name="play" size={14} />
      <Text className="text-xs font-semibold uppercase tracking-wide text-[#111518]" nativeID={`${idPrefix}-label`} testID={`${idPrefix}-label`}>
        Iniciar entrenamiento
      </Text>
    </Pressable>
  );
}
```

- [ ] **Step 2: Verify lint passes**

Run: `npm run lint`
Expected: clean (every `Pressable`/`Text` has `nativeID`+`testID` — `local/require-native-id` passes)

- [ ] **Step 3: Commit**

```bash
git add components/calendar/start-session-button.jsx
git commit -m "feat(session-runtime): add shared gated start-session button"
```

---

### Task 4: Wire the button into the aggregated day-detail modal

**Files:**
- Modify: `components/calendar/day-detail-modal.jsx`

**Interfaces:**
- Consumes: `StartSessionButton` (Task 3).
- Produces: nothing new for later tasks — this is a leaf wiring task.

`AssignmentRow` currently renders (in order): team/group scope row, kind label, presencial row, session-name row, collision badge (`variant === 'administered'` only), go-to-day button (`variant === 'administered'` only). Insert `StartSessionButton` right after the session-name `<Text>` block, before the collision badge — for **both** variants. Role mapping: `variant === 'member'` (corredor's own calendar) → `role="runner"`; `variant === 'administered'` (entrenador's calendar) → `role="trainer"`.

- [ ] **Step 1: Add the import**

In `components/calendar/day-detail-modal.jsx`, add to the top imports:

```jsx
import { StartSessionButton } from './start-session-button.jsx';
```

- [ ] **Step 2: Render the button in `AssignmentRow`**

Find the session-name block:

```jsx
      {assignment.sessionInstance && (
        <Text className="mt-1 text-xs text-slate-600 dark:text-slate-300" nativeID={`${idPrefix}-session-name`} testID={`${idPrefix}-session-name`}>
          {assignment.sessionInstance.name}
          {assignment.sessionInstance.exercises.length > 0
            ? ` · ${assignment.sessionInstance.exercises.length} ejercicio${assignment.sessionInstance.exercises.length === 1 ? '' : 's'}`
            : ''}
        </Text>
      )}
```

Add immediately after it (still inside `AssignmentRow`, before the `presencialCollision` block):

```jsx
      <StartSessionButton assignment={assignment} role={variant === 'member' ? 'runner' : 'trainer'} />
```

- [ ] **Step 3: Verify tests and lint still pass**

Run: `npm test && npm run lint`
Expected: both green — this file has no dedicated test suite (component render tests are out of project convention), so "tests pass" here means the full suite doesn't regress.

- [ ] **Step 4: Commit**

```bash
git add components/calendar/day-detail-modal.jsx
git commit -m "feat(calendar): show start-session button in the day detail modal"
```

---

### Task 5: Wire the button into the single-group day screen

**Files:**
- Modify: `components/team/group-calendar-day-screen.jsx`

**Interfaces:**
- Consumes: `StartSessionButton` (Task 3).
- Produces: nothing new for later tasks — leaf wiring task.

This screen is always trainer context (editing one group's one day). `existingDay` here is a `GroupCalendarDayModel` (`services/normalizers.js#toGroupCalendarDayModel`) — it has `{ id, groupId, date, kind, otherName, sessionInstance, cancelledReason, isPresencial, presencialTimeFrom, presencialTimeTo, presencialLocation, sourcePlanId }`, no `teamId`/`teamName`/`groupName` (those only exist on the aggregated model). `StartSessionButton` doesn't need them — it only reads `id`, `date`, `kind`, `isPresencial`, `presencialTimeFrom`.

- [ ] **Step 1: Add the import**

In `components/team/group-calendar-day-screen.jsx`, add to the top imports:

```jsx
import { StartSessionButton } from '../calendar/start-session-button.jsx';
```

- [ ] **Step 2: Render the button above the edit form**

Find the header `View` (`nativeID="group-calendar-day-screen-header"`) — it's the direct child right before `<SectionCard icon="calendar-blank-outline" title={...}>`. Add right after the header `View` closes and before `<SectionCard`:

```jsx
          {existingDay && <StartSessionButton assignment={existingDay} role="trainer" />}
```

(`StartSessionButton` renders `null` on its own for non-training/non-presencial/out-of-window days — no extra guard needed here beyond `existingDay` existing at all.)

- [ ] **Step 3: Verify tests and lint still pass**

Run: `npm test && npm run lint`
Expected: both green.

- [ ] **Step 4: Commit**

```bash
git add components/team/group-calendar-day-screen.jsx
git commit -m "feat(calendar): show start-session button on the group day screen"
```

---

### Task 6: Pre-start screen and its route

**Files:**
- Create: `components/session-runtime/session-pre-start-screen.jsx`
- Create: `app/training-session/index.jsx`

**Interfaces:**
- Consumes: `useSessionRuntimeStore` (Task 2), `MobileOnlyRoute` (`components/guards/platform-gate.jsx`, existing), `formatDisplayDate`/`formatWeekdayLabel` (`utils/format-date-display.js`, existing), `useThemeColors` (existing).
- Produces: the `/training-session` route, reachable only via `StartSessionButton`'s `router.push('/training-session')` (Task 3) — never linked to directly with params, always reads `pendingSession` from the store.

Shows: date + weekday, session name, first 3 exercises, a "ver todos" button opening a modal with the full list (same Modal+backdrop-closes pattern as `day-detail-modal.jsx`), and a Play button at the bottom that navigates to the stub route from Task 7.

- [ ] **Step 1: Write the screen component**

```jsx
// components/session-runtime/session-pre-start-screen.jsx
import { useState } from 'react';
import { Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { Redirect, useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useThemeColors } from '../../theme/colors.js';
import { MobileOnlyRoute } from '../guards/platform-gate.jsx';
import { useSessionRuntimeStore } from '../../store/session-runtime-store.js';
import { formatDisplayDate, formatWeekdayLabel } from '../../utils/format-date-display.js';

const PREVIEW_EXERCISE_COUNT = 3;

function ExerciseRow({ exercise, idPrefix }) {
  const rowId = `${idPrefix}-exercise-${exercise.id}`;
  return (
    <View className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 dark:border-slate-700 dark:bg-slate-900" nativeID={rowId} testID={rowId}>
      <Text className="text-sm font-semibold text-slate-900 dark:text-white" nativeID={`${rowId}-name`} testID={`${rowId}-name`}>
        {exercise.name}
      </Text>
      <Text className="text-xs text-slate-500 dark:text-slate-400" nativeID={`${rowId}-detail`} testID={`${rowId}-detail`}>
        {exercise.repeatCount} serie{exercise.repeatCount === 1 ? '' : 's'} · descanso {exercise.restMinutes} min
      </Text>
    </View>
  );
}

function SessionPreStartScreenContent() {
  const router = useRouter();
  const colors = useThemeColors();
  const pendingSession = useSessionRuntimeStore((s) => s.pendingSession);
  const [listVisible, setListVisible] = useState(false);

  if (!pendingSession) return <Redirect href="/" />;

  const exercises = pendingSession.sessionInstance?.exercises ?? [];
  const previewExercises = exercises.slice(0, PREVIEW_EXERCISE_COUNT);
  const hasMore = exercises.length > PREVIEW_EXERCISE_COUNT;

  return (
    <View className="flex-1 bg-paper dark:bg-ink" nativeID="session-pre-start-screen-root" testID="session-pre-start-screen-root">
      <ScrollView contentContainerClassName="flex-1 px-4 py-8" nativeID="session-pre-start-screen-scroll" testID="session-pre-start-screen-scroll">
        <View className="mb-6 flex-row items-center gap-2" nativeID="session-pre-start-screen-header" testID="session-pre-start-screen-header">
          <Pressable
            className="flex-row items-center gap-1.5 py-1 pr-1 active:opacity-70"
            nativeID="session-pre-start-screen-back-button"
            onPress={() => router.back()}
            testID="session-pre-start-screen-back-button"
          >
            <MaterialCommunityIcons color={colors.onSurfaceVariant} name="arrow-left" size={18} />
          </Pressable>
          <View nativeID="session-pre-start-screen-date-wrapper" testID="session-pre-start-screen-date-wrapper">
            <Text className="text-xs text-slate-500 dark:text-slate-400" nativeID="session-pre-start-screen-date" testID="session-pre-start-screen-date">
              {formatWeekdayLabel(pendingSession.date)}, {formatDisplayDate(pendingSession.date)}
            </Text>
            <Text className="text-xl text-slate-900 dark:text-white" nativeID="session-pre-start-screen-title" style={{ fontFamily: 'Orbitron_700Bold' }} testID="session-pre-start-screen-title">
              {pendingSession.sessionInstance?.name ?? 'Entrenamiento'}
            </Text>
          </View>
        </View>

        <View className="mb-4 gap-2" nativeID="session-pre-start-screen-exercise-list" testID="session-pre-start-screen-exercise-list">
          {previewExercises.map((exercise) => (
            <ExerciseRow exercise={exercise} idPrefix="session-pre-start-screen" key={exercise.id} />
          ))}
        </View>

        {hasMore && (
          <Pressable
            className="mb-6 h-9 flex-row items-center justify-center gap-1.5 self-start rounded-full border border-slate-200 px-3 active:opacity-70 dark:border-slate-700"
            nativeID="session-pre-start-screen-see-all-button"
            onPress={() => setListVisible(true)}
            testID="session-pre-start-screen-see-all-button"
          >
            <MaterialCommunityIcons color={colors.onSurfaceVariant} name="dots-horizontal" size={16} />
            <Text className="text-xs font-semibold text-slate-700 dark:text-slate-200" nativeID="session-pre-start-screen-see-all-button-label" testID="session-pre-start-screen-see-all-button-label">
              Ver los {exercises.length} ejercicios
            </Text>
          </Pressable>
        )}

        <View className="flex-1" nativeID="session-pre-start-screen-spacer" testID="session-pre-start-screen-spacer" />

        <Pressable
          className="h-16 w-16 items-center justify-center self-center rounded-full bg-primary active:opacity-80"
          nativeID="session-pre-start-screen-play-button"
          onPress={() => router.push('/training-session-active')}
          testID="session-pre-start-screen-play-button"
        >
          <MaterialCommunityIcons color={colors.onPrimary} name="play" size={32} />
        </Pressable>
      </ScrollView>

      <Modal
        animationType="fade"
        nativeID="session-pre-start-screen-exercise-modal"
        onRequestClose={() => setListVisible(false)}
        testID="session-pre-start-screen-exercise-modal"
        transparent
        visible={listVisible}
      >
        <Pressable
          className="flex-1 items-center justify-center bg-black/50 px-4"
          nativeID="session-pre-start-screen-exercise-modal-backdrop"
          onPress={() => setListVisible(false)}
          testID="session-pre-start-screen-exercise-modal-backdrop"
        >
          <Pressable
            className="max-h-[80%] w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-4 shadow-xl dark:border-slate-700 dark:bg-surface"
            nativeID="session-pre-start-screen-exercise-modal-card"
            onPress={() => {}}
            testID="session-pre-start-screen-exercise-modal-card"
          >
            <Text className="mb-3 text-lg font-bold text-slate-900 dark:text-white" nativeID="session-pre-start-screen-exercise-modal-title" testID="session-pre-start-screen-exercise-modal-title">
              Ejercicios de la sesión
            </Text>
            <ScrollView nativeID="session-pre-start-screen-exercise-modal-scroll" testID="session-pre-start-screen-exercise-modal-scroll">
              <View className="gap-2" nativeID="session-pre-start-screen-exercise-modal-list" testID="session-pre-start-screen-exercise-modal-list">
                {exercises.map((exercise) => (
                  <ExerciseRow exercise={exercise} idPrefix="session-pre-start-screen-modal" key={exercise.id} />
                ))}
              </View>
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

export function SessionPreStartScreen() {
  return (
    <MobileOnlyRoute>
      <SessionPreStartScreenContent />
    </MobileOnlyRoute>
  );
}
```

- [ ] **Step 2: Write the route wrapper**

```jsx
// app/training-session/index.jsx
import { SessionPreStartScreen } from '../../components/session-runtime/session-pre-start-screen.jsx';

export default function TrainingSession() {
  return <SessionPreStartScreen />;
}
```

- [ ] **Step 3: Verify tests and lint pass**

Run: `npm test && npm run lint`
Expected: both green.

- [ ] **Step 4: Commit**

```bash
git add components/session-runtime/session-pre-start-screen.jsx app/training-session/index.jsx
git commit -m "feat(session-runtime): add pre-start screen and its native-only route"
```

---

### Task 7: Stub "active session" route

**Files:**
- Create: `components/session-runtime/training-session-active-screen.jsx`
- Create: `app/training-session-active.jsx`

**Interfaces:**
- Consumes: `MobileOnlyRoute` (existing).
- Produces: the `/training-session-active` route that Task 6's Play button navigates to. Deliberately empty — this is the extension point for the real recording interface (timer, series, GPS), out of scope for this plan.

- [ ] **Step 1: Write the stub screen**

```jsx
// components/session-runtime/training-session-active-screen.jsx
import { Text, View } from 'react-native';
import { MobileOnlyRoute } from '../guards/platform-gate.jsx';

// Stub intencional — acá va el cronómetro/series/GPS de la sesión en
// curso (ver docs/superpowers/specs/2026-09-23-live-session-base-design.md,
// "Explícitamente fuera de alcance de esta spec"). Esta pantalla existe
// solo para que el botón Play del pre-start tenga a dónde navegar.
export function TrainingSessionActiveScreen() {
  return (
    <MobileOnlyRoute>
      <View className="flex-1 items-center justify-center bg-paper px-6 dark:bg-ink" nativeID="training-session-active-screen-root" testID="training-session-active-screen-root">
        <Text className="text-center text-base text-slate-500 dark:text-slate-400" nativeID="training-session-active-screen-placeholder" testID="training-session-active-screen-placeholder">
          Acá va la sesión en curso — cronómetro, series y GPS. Todavía no está construido.
        </Text>
      </View>
    </MobileOnlyRoute>
  );
}
```

- [ ] **Step 2: Write the route wrapper**

```jsx
// app/training-session-active.jsx
import { TrainingSessionActiveScreen } from '../components/session-runtime/training-session-active-screen.jsx';

export default function TrainingSessionActive() {
  return <TrainingSessionActiveScreen />;
}
```

- [ ] **Step 3: Verify tests and lint pass**

Run: `npm test && npm run lint`
Expected: both green.

- [ ] **Step 4: Commit**

```bash
git add components/session-runtime/training-session-active-screen.jsx app/training-session-active.jsx
git commit -m "feat(session-runtime): add stub route for the future active-session screen"
```

---

### Task 8: Document the backend gap and the native-only decision

**Files:**
- Modify: `docs/BACKEND_API_GAPS.md`
- Modify: `CLAUDE.md`

**Interfaces:** none — documentation only, no code consumes this.

- [ ] **Step 1: Add the new gap**

In `docs/BACKEND_API_GAPS.md`, after the last gap (Gap 11, ends the file), add:

```markdown

## Gap 12 — persistencia de la actividad realizada + historial (registro en vivo)

Sin resolver, sin endpoints todavía. El nuevo módulo de registro de actividad en vivo (ver
`docs/superpowers/specs/2026-09-23-live-session-base-design.md`) va a necesitar, cuando se
construya la interfaz real (fuera del alcance de esta base):

- Un endpoint para persistir la actividad finalizada de un `GroupCalendarDay`: por ejercicio y por
  serie, estado (`completado`/`skippeado`/`terminado`), tiempos, y puntos GPS tomados en background
  (para reconstruir el recorrido). El registro se arma primero en almacenamiento local nativo
  durante la sesión (para no depender de conectividad mientras corre) y se sube recién al
  finalizar.
- Endpoints de historial multiplataforma: listar actividades finalizadas, ver el detalle de una,
  editar valores puntuales (tiempos, distancias), eliminar una actividad.

**Impacto en frontend:** sin acción pendiente mientras este gap sigue abierto — bloquea el guardado
real y el historial del módulo de registro en vivo, todavía sin implementar (la base de navegación
sí está resuelta, ver spec citada arriba).
```

- [ ] **Step 2: Add the CLAUDE.md quirk**

In `CLAUDE.md`, inside the "Quirks conocidos" section, add a new bullet (after the last existing bullet):

```markdown
- **El módulo de registro de actividad en vivo (`components/session-runtime/`, rutas
  `app/training-session/` y `app/training-session-active.jsx`) es exclusivo mobile nativo, sin
  fallback web** — a diferencia de mp-connect (que sí tenía variante web), acá no hay alternativa
  posible porque se necesitan sensores reales (GPS, cronómetro). Gateado con el `MobileOnlyRoute`
  existente (`components/guards/platform-gate.jsx`), no con un `Platform.OS` inline nuevo. El
  historial de actividades ya finalizadas (ver/editar/eliminar) sí es multiplataforma — vive en un
  dominio aparte, todavía sin construir (ver `docs/BACKEND_API_GAPS.md`, Gap 12). Base de
  navegación (solo llegar a la pantalla previa al inicio, sin cronómetro/GPS reales) resuelta en
  `docs/superpowers/specs/2026-09-23-live-session-base-design.md`.
```

- [ ] **Step 3: Commit**

```bash
git add docs/BACKEND_API_GAPS.md CLAUDE.md
git commit -m "docs(session-runtime): open backend gap for activity persistence and document native-only scope"
```

---

## Final check

- [ ] Run `npm test` — full suite green.
- [ ] Run `npm run lint` — clean.
- [ ] Manual verification (native device/emulator, not preview — this module is native-only): open a calendar day for a training assigned today as a runner → "Iniciar entrenamiento" button appears → tap → pre-start screen shows date/session/exercises → "ver todos" opens the full list modal → Play navigates to the stub screen. Repeat as a trainer on a presencial day within ±30min of its start time.
