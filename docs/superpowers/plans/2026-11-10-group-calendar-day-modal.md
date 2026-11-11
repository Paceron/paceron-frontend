# Group Calendar Day Content Modal Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Clicking a day with content in the group calendar (`group-calendar-screen.jsx`) shows what's assigned (hover tooltip + a content modal) instead of opening a blind action list; rest days are treated as visually empty; and the "Se pisa" badge in `StampPlanModal` stops flashing against the stamping operation's own writes.

**Architecture:** A new pure function builds the hover-tooltip label. A new shared sub-component (`CalendarDayOverflowActions`) holds the 4 less-frequent day actions, reused by the existing `CalendarDayMenu` (empty/rest days, unchanged UI) and by a new centered `GroupDayContentModal` (days with content, two columns wide / stacked narrow). `group-calendar-screen.jsx` routes a day click to one or the other based on `marking.kind`. `StampPlanModal` freezes its conflict-lookup map at the start of a save so the live query's own invalidation can't repaint it mid-save.

**Tech Stack:** React Native + React Native Web (Expo), NativeWind, TanStack Query, Jest.

**Spec:** `docs/superpowers/specs/2026-11-10-group-calendar-day-modal-design.md`

## Global Constraints

- Every visual element (`View`, `Text`, `Pressable`, etc.) needs a unique `nativeID` and `testID` (enforced by ESLint `local/require-native-id`).
- Every `Modal` with a backdrop closes on backdrop click: the backdrop `Pressable`'s `nativeID` ends in `-backdrop` and has `onPress`; the card `Pressable` has a no-op `onPress={() => {}}` (enforced by ESLint `local/require-modal-backdrop-close`).
- Wide-vs-narrow layout decisions use `isWeb && !useIsNarrowWeb()` (from `hooks/use-is-narrow-web.js`, breakpoint `BREAKPOINTS.lg` = 1024px) in JS — never NativeWind `sm:`/`md:`/`lg:` classes to decide structure.
- Do not modify `components/calendar/day-detail-modal.jsx`, `components/calendar/administered-calendar-screen.jsx`, `components/calendar/my-calendar-screen.jsx`, or `components/team/group-calendar-day-screen.jsx` — out of scope per spec.
- `npm test` and `npm run lint` must be green before merging.
- This codebase has no component render tests by convention (see CLAUDE.md "Testing") — visual/presentational components are verified manually in the browser preview, not with Jest. Only pure functions get Jest tests in this plan.

## Review Focus

- `day.kind === 'other'` with `otherName` null/empty string — the content card's title must fall back to "Otra actividad", never show a blank or literal `null`. Covered as a manual-verification step in Task 4.
- `day.kind === 'cancelled'` — the content card must show "Sesión cancelada" and never render an exercise count, even if `sessionInstance` happens to be present on that day. Covered as a manual-verification step in Task 4.
- An unexpected/unknown `marking.kind` value reaching `buildCalendarDayTooltipLabel` — must return a safe fallback label, never throw. Covered by a Jest test in Task 1.
- `day.isPresencial === true` with `presencialLocation === null` — the metadata line must show only the time range, never `" · null"` or `" · undefined"`. Covered as a manual-verification step in Task 4.
- The `StampPlanModal` freeze fix must not leak into the normal pre-save editing flow: toggling "Se pisa"/"Se conserva" or switching the chosen plan while `saving` is `false` must still reflect live `existingByDate`, not a stale snapshot. Covered as a manual-verification step in Task 6.

---

### Task 1: `buildCalendarDayTooltipLabel` pure function

**Files:**
- Create: `utils/calendar-day-tooltip.js`
- Test: `__tests__/calendar-day-tooltip.test.js`

**Interfaces:**
- Consumes: `KIND_LABELS` from `utils/calendar-kind-colors.js` (`{ training: 'Entrenamiento', rest: 'Descanso', other: 'Otra actividad', cancelled: 'Cancelado' }`).
- Produces: `buildCalendarDayTooltipLabel(marking: { kind: string, isPresencial?: boolean, presencialTimeFrom?: string|null, presencialTimeTo?: string|null } | null) -> string | null`, used by Task 2.

- [ ] **Step 1: Write the failing tests**

```js
import { buildCalendarDayTooltipLabel } from '../utils/calendar-day-tooltip.js';

describe('buildCalendarDayTooltipLabel', () => {
  test('sin marking no hay tooltip', () => {
    expect(buildCalendarDayTooltipLabel(null)).toBeNull();
  });

  test('descanso no es contenido a estos fines', () => {
    expect(buildCalendarDayTooltipLabel({ kind: 'rest' })).toBeNull();
  });

  test('entrenamiento sin presencial muestra solo el label', () => {
    expect(buildCalendarDayTooltipLabel({ kind: 'training' })).toBe('Entrenamiento');
  });

  test('entrenamiento presencial agrega el horario', () => {
    expect(buildCalendarDayTooltipLabel({ kind: 'training', isPresencial: true, presencialTimeFrom: '18:00', presencialTimeTo: '19:30' })).toBe('Entrenamiento · 18:00–19:30');
  });

  test('otra actividad muestra su label', () => {
    expect(buildCalendarDayTooltipLabel({ kind: 'other' })).toBe('Otra actividad');
  });

  test('cancelado muestra su label', () => {
    expect(buildCalendarDayTooltipLabel({ kind: 'cancelled' })).toBe('Cancelado');
  });

  test('kind desconocido no explota, cae a Otra actividad', () => {
    expect(buildCalendarDayTooltipLabel({ kind: 'bogus' })).toBe('Otra actividad');
  });

  test('presencial sin horario completo no agrega el separador', () => {
    expect(buildCalendarDayTooltipLabel({ kind: 'training', isPresencial: true, presencialTimeFrom: null, presencialTimeTo: null })).toBe('Entrenamiento');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx jest calendar-day-tooltip -v`
Expected: FAIL with "buildCalendarDayTooltipLabel is not a function" (module doesn't exist yet).

- [ ] **Step 3: Implement `buildCalendarDayTooltipLabel(marking)` in `utils/calendar-day-tooltip.js`**

```js
import { KIND_LABELS } from './calendar-kind-colors.js';

export function buildCalendarDayTooltipLabel(marking) {
  if (!marking || marking.kind === 'rest') return null;
  const kindLabel = KIND_LABELS[marking.kind] ?? KIND_LABELS.other;
  if (marking.isPresencial && marking.presencialTimeFrom && marking.presencialTimeTo) {
    return `${kindLabel} · ${marking.presencialTimeFrom}–${marking.presencialTimeTo}`;
  }
  return kindLabel;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx jest calendar-day-tooltip -v`
Expected: PASS, 8/8.

- [ ] **Step 5: Commit**

```bash
git add utils/calendar-day-tooltip.js __tests__/calendar-day-tooltip.test.js
git commit -m "feat(calendar): add pure tooltip-label builder for group calendar days"
```

---

### Task 2: `CalendarDayCell` — hover tooltip + rest days treated as empty

**Files:**
- Modify: `components/team/group-calendar-screen.jsx:49-164` (the `KIND_FILLED_CLASS` constant and the `CalendarDayCell` component)

**Interfaces:**
- Consumes: `buildCalendarDayTooltipLabel` from Task 1; `IconTooltip` (already imported in this file, `components/shared/icon-tooltip.jsx`) — it clones its single child and injects `onHoverIn`/`onHoverOut`, and on native returns `children` unchanged.
- Produces: no new exports — `CalendarDayCell`'s existing props (`date, state, isToday, marking, containerRef, onOpenMenu, isMenuOpen, selectionActive, selectionClosedClass, selected, onToggleSelect, canManage`) are unchanged by this task (Task 5 adds `onOpenContent`).

- [ ] **Step 1: Add the import**

In `components/team/group-calendar-screen.jsx`, add near the other `utils/` imports:

```js
import { buildCalendarDayTooltipLabel } from '../../utils/calendar-day-tooltip.js';
```

- [ ] **Step 2: Exclude `rest` from the "plain filled day" styling**

Change the `isPlainFilledDay` line (currently `Boolean(marking) && !isOtherMonth && !selected && !isMenuOpen && !isToday`) to also exclude rest, so a rest day falls through to the default empty-cell class instead of hitting `KIND_FILLED_CLASS[marking.kind] ?? KIND_FILLED_CLASS.other` (which would otherwise mis-route to the `other`/amber fallback, since `rest` stays a valid `marking.kind` value in the data):

```js
const isPlainFilledDay = Boolean(marking) && marking.kind !== 'rest' && !isOtherMonth && !selected && !isMenuOpen && !isToday;
```

Leave `KIND_FILLED_CLASS` itself untouched (its `rest` entry becomes dead code reachable only via `?? KIND_FILLED_CLASS.other`, never actually hit now that `isPlainFilledDay` excludes it) — removing the entry is unnecessary churn.

- [ ] **Step 3: Hide the dot/icon mark for rest days**

Change the marks block condition (currently `{marking && ( ... )}`, the block rendering the presencial pin or the kind dot) to:

```jsx
{marking && marking.kind !== 'rest' && (
  // ...unchanged contents...
)}
```

- [ ] **Step 4: Wrap the cell in `IconTooltip` when there's a label**

Change the `return` of `CalendarDayCell` from a single `<Pressable>` to:

```jsx
const tooltipLabel = buildCalendarDayTooltipLabel(marking);
const cell = (
  <Pressable
    ref={cellRef}
    className={`h-14 w-full items-center justify-start p-1 gap-1 rounded-xl ${borderClass}`}
    nativeID={`group-calendar-day-${date.dateString}`}
    onPress={handlePress}
    style={{ opacity: selectionActive && !canSelect ? 0.35 : 1 }}
    testID={`group-calendar-day-${date.dateString}`}
  >
    {/* ...unchanged children... */}
  </Pressable>
);

if (!tooltipLabel) return cell;

return (
  <IconTooltip idPrefix={`group-calendar-day-${date.dateString}-tooltip`} label={tooltipLabel}>
    {cell}
  </IconTooltip>
);
```

`tooltipLabel` must be computed before the `borderClass`/mark-block logic that already exists in the function (it only needs `marking`, which is already a prop) — place the `const tooltipLabel = ...` line right after the existing `const isPlainFilledDay = ...` line.

- [ ] **Step 5: Run the full test suite and lint**

Run: `npm test && npm run lint`
Expected: both green — this task touches no pure-function logic covered by existing tests, so this step is a regression check, not a new-test check.

- [ ] **Step 6: Manual verification (browser preview)**

Open the group calendar screen with at least one `training` day (presencial and non-presencial), one `other` day, one `cancelled` day, and one `rest` day in the visible month. Confirm: hovering a `training`/`other`/`cancelled` cell on web shows the tooltip bubble with the expected text; hovering a `rest` cell shows no tooltip and the cell renders with the same border/background as an empty day (no dot, no colored fill).

- [ ] **Step 7: Commit**

```bash
git add components/team/group-calendar-screen.jsx
git commit -m "feat(calendar): hover tooltip on filled days, treat rest as visually empty"
```

---

### Task 3: Extract `CalendarDayOverflowActions`, refactor `CalendarDayMenu`

**Files:**
- Create: `components/team/calendar-day-overflow-actions.jsx`
- Modify: `components/team/calendar-day-menu.jsx`

**Interfaces:**
- Produces: `CalendarDayOverflowActions({ hasContent, closed, isTraining, onClear, onCancel, onSelect, onShift, idPrefix })` — renders the 4 less-frequent day actions (Vaciar día, Cancelar sesión, Seleccionar, Desplazar desde acá), each gated exactly as before (`hasContent && !closed` for Vaciar, `isTraining` for Cancelar, no gate for Seleccionar/Desplazar). No internal state. Consumed by `CalendarDayMenu` (this task) and by `GroupDayContentModal` (Task 4).

- [ ] **Step 1: Create `components/team/calendar-day-overflow-actions.jsx`**

```jsx
import { Pressable, Text } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';

// Las 4 acciones menos frecuentes de un día del calendario de grupo --
// compartidas entre CalendarDayMenu (día vacío/descanso, dropdown anclado
// a la celda) y el overflow "..." de GroupDayContentModal (día con
// contenido, modal centrado). Nunca se montan los dos a la vez, así que
// comparten esta lista sin pisarse ids -- cada caller pasa su propio
// `idPrefix`.
export function CalendarDayOverflowActions({ hasContent, closed, isTraining, onClear, onCancel, onSelect, onShift, idPrefix }) {
  return (
    <>
      {hasContent && !closed && (
        <Pressable
          className="flex-row items-center gap-2 px-3 py-2 hover:bg-slate-100 active:opacity-70 dark:hover:bg-slate-800"
          nativeID={`${idPrefix}-clear`}
          onPress={onClear}
          testID={`${idPrefix}-clear`}
        >
          <MaterialCommunityIcons color="#ef4444" name="trash-can-outline" size={16} />
          <Text className="text-sm text-red-600 dark:text-red-400" nativeID={`${idPrefix}-clear-label`} testID={`${idPrefix}-clear-label`}>
            Vaciar día
          </Text>
        </Pressable>
      )}

      {isTraining && (
        <Pressable
          className="flex-row items-center gap-2 px-3 py-2 hover:bg-slate-100 active:opacity-70 dark:hover:bg-slate-800"
          nativeID={`${idPrefix}-cancel`}
          onPress={onCancel}
          testID={`${idPrefix}-cancel`}
        >
          <MaterialCommunityIcons color="#d97706" name="calendar-remove-outline" size={16} />
          <Text className="text-sm text-amber-700 dark:text-amber-400" nativeID={`${idPrefix}-cancel-label`} testID={`${idPrefix}-cancel-label`}>
            Cancelar sesión
          </Text>
        </Pressable>
      )}

      <Pressable
        className="flex-row items-center gap-2 px-3 py-2 hover:bg-slate-100 active:opacity-70 dark:hover:bg-slate-800"
        nativeID={`${idPrefix}-select`}
        onPress={onSelect}
        testID={`${idPrefix}-select`}
      >
        <MaterialCommunityIcons color="#64748b" name="checkbox-marked-outline" size={16} />
        <Text className="text-sm text-slate-700 dark:text-slate-200" nativeID={`${idPrefix}-select-label`} testID={`${idPrefix}-select-label`}>
          Seleccionar
        </Text>
      </Pressable>

      <Pressable
        className="flex-row items-center gap-2 px-3 py-2 hover:bg-slate-100 active:opacity-70 dark:hover:bg-slate-800"
        nativeID={`${idPrefix}-shift`}
        onPress={onShift}
        testID={`${idPrefix}-shift`}
      >
        <MaterialCommunityIcons color="#64748b" name="arrow-right-bold-outline" size={16} />
        <Text className="text-sm text-slate-700 dark:text-slate-200" nativeID={`${idPrefix}-shift-label`} testID={`${idPrefix}-shift-label`}>
          Desplazar desde acá
        </Text>
      </Pressable>
    </>
  );
}
```

- [ ] **Step 2: Refactor `CalendarDayMenu` to use it**

Replace the "Vaciar día", "Cancelar sesión", "Seleccionar", and "Desplazar desde acá" `Pressable` blocks in `components/team/calendar-day-menu.jsx` with a single `<CalendarDayOverflowActions>` call, keeping "Editar/Asignar" and "Estampar plan" as this component's own rows. This is a deliberate, accepted reorder: "Estampar plan" moves from between "Seleccionar" and "Desplazar" to after "Desplazar" (last item) — grouping the 4 shared rows together is worth the minor reorder in this day-empty/rest-day menu.

```jsx
import { Pressable, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { CalendarDayOverflowActions } from './calendar-day-overflow-actions.jsx';

export function CalendarDayMenu({ hasContent, closed, isTraining, onAssignOrEdit, onClear, onCancel, onSelect, onStamp, onShift }) {
  return (
    <View
      className="w-52 overflow-hidden rounded-xl border border-slate-200 bg-white py-1 shadow-2xl dark:border-slate-700 dark:bg-surface-2"
      nativeID="calendar-day-menu-panel"
      testID="calendar-day-menu-panel"
    >
      <Pressable
        className="flex-row items-center gap-2 px-3 py-2 hover:bg-slate-100 active:opacity-70 dark:hover:bg-slate-800"
        nativeID="calendar-day-menu-assign-or-edit"
        onPress={onAssignOrEdit}
        testID="calendar-day-menu-assign-or-edit"
      >
        <MaterialCommunityIcons color="#64748b" name="pencil-outline" size={16} />
        <Text className="text-sm text-slate-700 dark:text-slate-200" nativeID="calendar-day-menu-assign-or-edit-label" testID="calendar-day-menu-assign-or-edit-label">
          {hasContent ? 'Editar' : 'Asignar'}
        </Text>
      </Pressable>

      <CalendarDayOverflowActions closed={closed} hasContent={hasContent} idPrefix="calendar-day-menu" isTraining={isTraining} onCancel={onCancel} onClear={onClear} onSelect={onSelect} onShift={onShift} />

      {!closed && (
        <Pressable
          className="flex-row items-center gap-2 px-3 py-2 hover:bg-slate-100 active:opacity-70 dark:hover:bg-slate-800"
          nativeID="calendar-day-menu-stamp"
          onPress={onStamp}
          testID="calendar-day-menu-stamp"
        >
          <MaterialCommunityIcons color="#64748b" name="stamper" size={16} />
          <Text className="text-sm text-slate-700 dark:text-slate-200" nativeID="calendar-day-menu-stamp-label" testID="calendar-day-menu-stamp-label">
            Estampar plan
          </Text>
        </Pressable>
      )}
    </View>
  );
}
```

- [ ] **Step 3: Run lint and tests**

Run: `npm test && npm run lint`
Expected: both green — no behavior-affecting logic changed, this is a structural extraction.

- [ ] **Step 4: Manual verification**

Open the group calendar, click an empty day: confirm the menu shows Asignar, Vaciar (absent, no content), Seleccionar, Desplazar, Estampar — same items as before, just reordered (Estampar now last). Click a day with content you don't intend to keep testing further: confirm Editar/Vaciar/Cancelar(if training)/Seleccionar/Desplazar/Estampar all still work.

- [ ] **Step 5: Commit**

```bash
git add components/team/calendar-day-overflow-actions.jsx components/team/calendar-day-menu.jsx
git commit -m "refactor(calendar): extract shared overflow actions out of CalendarDayMenu"
```

---

### Task 4: `GroupDayContentModal` component

**Files:**
- Create: `components/team/group-day-content-modal.jsx`

**Interfaces:**
- Consumes: `CalendarDayOverflowActions` (Task 3); `StartSessionButton` from `components/calendar/start-session-button.jsx` (props `{ assignment, role, teamId, fill }`, already resolves `assignment.teamId ?? teamId ?? null` internally); `AnimatedDropdown` from `components/shared/animated-dropdown.jsx` (props `{ open, onClose, anchorStyle, children }`, positions `children` `position:absolute` relative to whatever ancestor is `position:relative` — here, this modal's own card); `useIsNarrowWeb` from `hooks/use-is-narrow-web.js`; `isWeb` from `utils/platform.js`; `KIND_LABELS` from `utils/calendar-kind-colors.js`; `formatDisplayDate`/`formatWeekdayLabel` from `utils/format-date-display.js`.
- Produces: `GroupDayContentModal({ visible, day, teamId, groupId, closed, onClose, onClear, onCancel, onSelect, onShift, onStamp })`. `day` is a `toGroupCalendarDayModel` result (`{ date, kind, otherName, sessionInstance, isPresencial, presencialTimeFrom, presencialTimeTo, presencialLocation }`) or `null`. `onClear`/`onCancel`/`onSelect`/`onShift`/`onStamp` are all `(date: string) => void` — consumed by Task 5's wiring in `group-calendar-screen.jsx`.

- [ ] **Step 1: Create `components/team/group-day-content-modal.jsx`**

```jsx
import { useRef, useState } from 'react';
import { Modal, Pressable, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useThemeColors } from '../../theme/colors.js';
import { useIsNarrowWeb } from '../../hooks/use-is-narrow-web.js';
import { isWeb } from '../../utils/platform.js';
import { formatDisplayDate, formatWeekdayLabel } from '../../utils/format-date-display.js';
import { KIND_LABELS } from '../../utils/calendar-kind-colors.js';
import { StartSessionButton } from '../calendar/start-session-button.jsx';
import { AnimatedDropdown } from '../shared/animated-dropdown.jsx';
import { CalendarDayOverflowActions } from './calendar-day-overflow-actions.jsx';

// Fondos de tarjeta por kind -- paleta suave (a diferencia de
// KIND_FILLED_CLASS de group-calendar-screen.jsx, que es sólida/alto
// contraste para una celda de 56px): acá hay texto largo encima.
const KIND_CARD_CLASS = {
  training: 'border-green-200 bg-green-50 dark:border-green-700 dark:bg-green-900/30',
  other: 'border-amber-200 bg-amber-50 dark:border-amber-700 dark:bg-amber-900/30',
  cancelled: 'border-red-200 bg-red-50 dark:border-red-700 dark:bg-red-900/30',
};

const idPrefix = 'group-day-content-modal';

export function GroupDayContentModal({ visible, day, teamId, groupId, closed, onClose, onClear, onCancel, onSelect, onShift, onStamp }) {
  const router = useRouter();
  const colors = useThemeColors();
  const isNarrowWeb = useIsNarrowWeb();
  const isWideLayout = isWeb && !isNarrowWeb;
  const [overflowOpen, setOverflowOpen] = useState(false);
  const [overflowAnchor, setOverflowAnchor] = useState(null);
  const cardRef = useRef(null);
  const overflowButtonRef = useRef(null);

  if (!day) return null;

  const isCancelled = day.kind === 'cancelled';
  const isTraining = day.kind === 'training';
  const kindLabel = day.kind === 'other' ? (day.otherName || KIND_LABELS.other) : (KIND_LABELS[day.kind] ?? KIND_LABELS.other);
  const exerciseCount = day.sessionInstance?.exercises?.length ?? 0;

  const handleOpenOverflow = () => {
    if (!cardRef.current || !overflowButtonRef.current) return;
    cardRef.current.measureInWindow((containerX, containerY) => {
      overflowButtonRef.current?.measureInWindow((x, y, width, height) => {
        setOverflowAnchor({ x: x - containerX, y: y - containerY + height + 4 });
      });
    });
    setOverflowOpen(true);
  };

  const handleEdit = () => {
    onClose();
    router.push(`/teams/${teamId}/groups/${groupId}/calendar/${day.date}`);
  };

  const handleStamp = () => {
    onClose();
    onStamp(day.date);
  };

  const handleOverflowAction = (action) => {
    setOverflowOpen(false);
    onClose();
    action(day.date);
  };

  return (
    <Modal animationType="fade" nativeID={idPrefix} onRequestClose={onClose} testID={idPrefix} transparent visible={visible}>
      <Pressable className="flex-1 items-center justify-center bg-black/50 px-4" nativeID={`${idPrefix}-backdrop`} onPress={onClose} testID={`${idPrefix}-backdrop`}>
        <Pressable
          className={`relative w-full rounded-2xl border border-slate-200 bg-white p-4 shadow-xl dark:border-slate-700 dark:bg-surface ${isWideLayout ? 'max-w-2xl flex-row gap-4' : 'max-w-md gap-4'}`}
          nativeID={`${idPrefix}-card`}
          onPress={() => {}}
          ref={cardRef}
          testID={`${idPrefix}-card`}
        >
          <View className={`rounded-xl border p-3 ${isWideLayout ? 'flex-1' : ''} ${KIND_CARD_CLASS[day.kind] ?? KIND_CARD_CLASS.other}`} nativeID={`${idPrefix}-content`} testID={`${idPrefix}-content`}>
            <Text className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400" nativeID={`${idPrefix}-kicker`} testID={`${idPrefix}-kicker`}>
              {formatWeekdayLabel(day.date, { short: true })}, {formatDisplayDate(day.date)}
            </Text>
            <Text className="mt-1 text-base font-bold text-slate-900 dark:text-white" nativeID={`${idPrefix}-title`} testID={`${idPrefix}-title`}>
              {isCancelled ? 'Sesión cancelada' : kindLabel}
            </Text>
            {!isCancelled && day.sessionInstance && (
              <Text className="mt-0.5 text-sm text-slate-700 dark:text-slate-200" nativeID={`${idPrefix}-session`} testID={`${idPrefix}-session`}>
                {day.sessionInstance.name}
                {exerciseCount > 0 ? ` · ${exerciseCount} ejercicio${exerciseCount === 1 ? '' : 's'}` : ''}
              </Text>
            )}
            {day.isPresencial && (
              <View className="mt-2 flex-row items-center gap-1.5" nativeID={`${idPrefix}-presencial`} testID={`${idPrefix}-presencial`}>
                <MaterialCommunityIcons color={colors.onSurfaceVariant} name="map-marker-outline" size={14} />
                <Text className="text-xs text-slate-600 dark:text-slate-300" nativeID={`${idPrefix}-presencial-label`} testID={`${idPrefix}-presencial-label`}>
                  {day.presencialTimeFrom}–{day.presencialTimeTo}
                  {day.presencialLocation?.label ? ` · ${day.presencialLocation.label}` : ''}
                </Text>
              </View>
            )}
          </View>

          <View className={isWideLayout ? 'w-40 gap-2' : 'gap-2'} nativeID={`${idPrefix}-actions`} testID={`${idPrefix}-actions`}>
            <StartSessionButton assignment={day} role="trainer" teamId={teamId} />
            <Pressable
              className="h-9 flex-row items-center justify-center gap-1.5 rounded-full border border-slate-200 hover:bg-slate-100 active:opacity-70 dark:border-slate-700 dark:hover:bg-slate-800"
              nativeID={`${idPrefix}-edit`}
              onPress={handleEdit}
              testID={`${idPrefix}-edit`}
            >
              <MaterialCommunityIcons color={colors.onSurfaceVariant} name="pencil-outline" size={14} />
              <Text className="text-xs font-semibold uppercase tracking-wide text-slate-700 dark:text-slate-200" nativeID={`${idPrefix}-edit-label`} testID={`${idPrefix}-edit-label`}>
                Editar
              </Text>
            </Pressable>
            {!closed && (
              <Pressable
                className="h-9 flex-row items-center justify-center gap-1.5 rounded-full border border-slate-200 hover:bg-slate-100 active:opacity-70 dark:border-slate-700 dark:hover:bg-slate-800"
                nativeID={`${idPrefix}-stamp`}
                onPress={handleStamp}
                testID={`${idPrefix}-stamp`}
              >
                <MaterialCommunityIcons color={colors.onSurfaceVariant} name="stamper" size={14} />
                <Text className="text-xs font-semibold uppercase tracking-wide text-slate-700 dark:text-slate-200" nativeID={`${idPrefix}-stamp-label`} testID={`${idPrefix}-stamp-label`}>
                  Estampar plan
                </Text>
              </Pressable>
            )}
            <Pressable
              accessibilityLabel="Más acciones"
              className="h-9 w-9 items-center justify-center self-end rounded-full hover:bg-slate-100 active:opacity-70 dark:hover:bg-slate-800"
              nativeID={`${idPrefix}-overflow-trigger`}
              onPress={handleOpenOverflow}
              ref={overflowButtonRef}
              testID={`${idPrefix}-overflow-trigger`}
            >
              <MaterialCommunityIcons color={colors.onSurfaceVariant} name="dots-horizontal" size={18} />
            </Pressable>
          </View>

          <AnimatedDropdown anchorStyle={overflowAnchor ? { right: 8, top: overflowAnchor.y } : {}} onClose={() => setOverflowOpen(false)} open={overflowOpen}>
            <View className="w-48 overflow-hidden rounded-xl border border-slate-200 bg-white py-1 shadow-2xl dark:border-slate-700 dark:bg-surface-2" nativeID={`${idPrefix}-overflow-panel`} testID={`${idPrefix}-overflow-panel`}>
              <CalendarDayOverflowActions
                closed={closed}
                hasContent
                idPrefix={`${idPrefix}-overflow`}
                isTraining={isTraining}
                onCancel={() => handleOverflowAction(onCancel)}
                onClear={() => handleOverflowAction(onClear)}
                onSelect={() => handleOverflowAction(onSelect)}
                onShift={() => handleOverflowAction(onShift)}
              />
            </View>
          </AnimatedDropdown>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
```

Note the card `Pressable` needs `position: 'relative'` for `AnimatedDropdown`'s `absolute inset-0` wrapper to anchor against it correctly (the `relative` NativeWind class in its `className` already provides this) — same pattern CLAUDE.md documents for `AnimatedDropdown` nested away from the screen root (measure the trigger and the reference container with `measureInWindow`, subtract, mount the dropdown as a child of that same reference container).

- [ ] **Step 2: Run lint**

Run: `npm run lint`
Expected: green (no render tests to run for this new file per project convention).

- [ ] **Step 3: Manual verification — the 4 Review Focus cases for this component**

Using the browser preview, open this modal (once Task 5 wires it in) for four constructed days and confirm:
1. `kind: 'other'`, `otherName: ''` → title shows "Otra actividad", not blank.
2. `kind: 'cancelled'` with a `sessionInstance` present on the day → title shows "Sesión cancelada" and no exercise-count line appears.
3. `isPresencial: true`, `presencialLocation: null` → the metadata line shows only `HH:MM–HH:MM`, no trailing `· null`/`· undefined`.
4. Resize to narrow/mobile width → content card and action column stack vertically instead of side-by-side.

- [ ] **Step 4: Commit**

```bash
git add components/team/group-day-content-modal.jsx
git commit -m "feat(calendar): add GroupDayContentModal with content preview and action pills"
```

---

### Task 5: Wire `GroupDayContentModal` into `group-calendar-screen.jsx`

**Files:**
- Modify: `components/team/group-calendar-screen.jsx`

**Interfaces:**
- Consumes: `GroupDayContentModal` (Task 4); `buildCalendarDayTooltipLabel` is unaffected here. `isCalendarDayClosed` (already imported in this file) determines the `closed` prop passed to the new modal.
- Produces: no new exports outside this file.

- [ ] **Step 1: Import the new modal**

```js
import { GroupDayContentModal } from './group-day-content-modal.jsx';
```

- [ ] **Step 2: Parameterize the 6 day-action handlers to take a `date` argument instead of reading `openDayMenu.date`**

Change each handler in `GroupCalendarScreenContent` from reading `openDayMenu.date` internally to accepting it as a parameter, and move the `handleCloseDayMenu()` call out to each JSX call site instead of inside the handler body — this lets both `CalendarDayMenu` (anchored dropdown) and `GroupDayContentModal` (centered modal) call the same action logic with their own close step:

```js
const handleAssignOrEdit = (date) => {
  router.push(`/teams/${teamId}/groups/${groupId}/calendar/${date}`);
};

const handleClearDay = async (date) => {
  const result = await deleteDay({ date });
  if (!result.success) {
    notifyError();
    Toast.show({ type: 'error', text1: 'No pudimos vaciar el día', text2: result.error });
    return;
  }
  notifySuccess();
  Toast.show({ type: 'success', text1: 'Día vaciado' });
};

const handleCancelSession = (date) => {
  router.push(`/teams/${teamId}/groups/${groupId}/calendar/${date}?action=cancel`);
};

const handleSelectDay = (date) => {
  const marking = markingsByDate[date];
  setSelectedDates(new Set([date]));
  setSelectionClosedClass(isCalendarDayClosed(date, marking ?? {}));
};

const handleStampFromDay = (date) => {
  setStampTargetDate(date);
};

const handleShiftFromDay = (date) => {
  setShiftTargetDate(date);
};
```

- [ ] **Step 3: Update the `CalendarDayMenu` call site to close-then-act**

```jsx
<CalendarDayMenu
  closed={openClosed}
  hasContent={Boolean(openMarking)}
  isTraining={openMarking?.kind === 'training'}
  onAssignOrEdit={() => { handleCloseDayMenu(); handleAssignOrEdit(openDayMenu.date); }}
  onCancel={() => { handleCloseDayMenu(); handleCancelSession(openDayMenu.date); }}
  onClear={() => { handleCloseDayMenu(); handleClearDay(openDayMenu.date); }}
  onSelect={() => { handleCloseDayMenu(); handleSelectDay(openDayMenu.date); }}
  onShift={() => { handleCloseDayMenu(); handleShiftFromDay(openDayMenu.date); }}
  onStamp={() => { handleCloseDayMenu(); handleStampFromDay(openDayMenu.date); }}
/>
```

- [ ] **Step 4: Add `daysByDate`, `openDayContent` state, and its open/close handlers**

Add alongside the existing `markingsByDate` memo:

```js
const daysByDate = useMemo(() => Object.fromEntries(days.map((d) => [d.date, d])), [days]);
```

Add alongside `openDayMenu` state:

```js
const [openDayContent, setOpenDayContent] = useState(null);

const handleOpenDayContent = (dateString) => setOpenDayContent(dateString);
const handleCloseDayContent = () => setOpenDayContent(null);

const openContentDay = openDayContent ? daysByDate[openDayContent] : null;
const openContentClosed = openContentDay ? isCalendarDayClosed(openDayContent, openContentDay) : false;
```

- [ ] **Step 5: Branch `CalendarDayCell`'s `handlePress` between the two UIs**

Add an `onOpenContent` prop to `CalendarDayCell` and change `handlePress` to:

```js
const handlePress = () => {
  if (!canManage || isOtherMonth) return;
  if (selectionActive) {
    if (!canSelect) return;
    onToggleSelect(date.dateString);
    return;
  }
  if (marking && marking.kind !== 'rest') {
    onOpenContent(date.dateString);
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

Pass `onOpenContent={handleOpenDayContent}` at the `<CalendarDayCell>` call site inside `dayComponent`.

- [ ] **Step 6: Mount `GroupDayContentModal`**

Add near the existing `<CalendarDayMenu>`/`<AnimatedDropdown>` block:

```jsx
<GroupDayContentModal
  closed={openContentClosed}
  day={openContentDay}
  groupId={groupId}
  onCancel={handleCancelSession}
  onClear={handleClearDay}
  onClose={handleCloseDayContent}
  onSelect={handleSelectDay}
  onShift={handleShiftFromDay}
  onStamp={handleStampFromDay}
  teamId={teamId}
  visible={Boolean(openDayContent)}
/>
```

Note these 6 callback props are passed directly (not wrapped) because `GroupDayContentModal` itself calls `onClose()` before invoking the action (see Task 4's `handleEdit`/`handleStamp`/`handleOverflowAction`) — unlike the `CalendarDayMenu` call site in Step 3, no extra close-then-act wrapping is needed here.

- [ ] **Step 7: Run tests and lint**

Run: `npm test && npm run lint`
Expected: both green.

- [ ] **Step 8: Manual verification**

Click a `training` day with a session assigned: confirm `GroupDayContentModal` opens (not `CalendarDayMenu`), shows the session name and exercise count, and that Editar/Estampar/the "⋯" overflow (Vaciar/Cancelar/Seleccionar/Desplazar) all perform the same actions they did before this branch, closing the modal first. Click an empty day and a `rest` day: confirm both still open `CalendarDayMenu` exactly as before.

- [ ] **Step 9: Commit**

```bash
git add components/team/group-calendar-screen.jsx
git commit -m "feat(calendar): route filled non-rest days to GroupDayContentModal"
```

---

### Task 6: Fix "Se pisa" flashing during stamp-plan save

**Files:**
- Modify: `components/team/stamp-plan-modal.jsx`

**Interfaces:**
- Consumes: none new.
- Produces: no new exports.

**Root cause** (already diagnosed, see spec "Fuera de este diseño, pero en la misma rama"): `existingByDate` is built from `useGroupCalendar(groupId, startDate, rangeEnd)` — a live query over the same date range being stamped. `handleSave` calls `stampPlan(...)`, whose `onSuccess` invalidates `['group-calendar', groupId]`, which refetches `existingDays` *while the modal is still open and `saving` is `true`* — the days just created by this very save now show up as "existing", so `StampPreviewRow` renders "Se pisa" against the operation's own writes, mid-save.

- [ ] **Step 1: Add a frozen-snapshot ref and an `effectiveExistingByDate`**

In `StampPlanModal`, alongside the existing `existingByDate` memo:

```js
const frozenExistingByDateRef = useRef(null);
const effectiveExistingByDate = saving ? (frozenExistingByDateRef.current ?? existingByDate) : existingByDate;
```

- [ ] **Step 2: Freeze the snapshot at the start of `handleSave`**

Change the first line of `handleSave` from `setSaving(true);` to:

```js
const handleSave = async () => {
  frozenExistingByDateRef.current = existingByDate;
  setSaving(true);
  // ...rest unchanged
```

- [ ] **Step 3: Clear the frozen snapshot on reset (defensive, avoids any stale read on next open)**

In the existing `resetKey` block (the `if (resetKey !== prevResetKeyRef.current) { ... }` block), add:

```js
frozenExistingByDateRef.current = null;
```

- [ ] **Step 4: Use `effectiveExistingByDate` instead of `existingByDate` when rendering the preview list**

Change the `existingDay={existingByDate[day.date] ?? null}` prop passed to `<StampPreviewRow>` to:

```jsx
existingDay={effectiveExistingByDate[day.date] ?? null}
```

- [ ] **Step 5: Run tests and lint**

Run: `npm test && npm run lint`
Expected: both green (no pure-function tests apply here — this is a live-query/timing fix, and `StampPlanModal` has no render tests per project convention).

- [ ] **Step 6: Manual verification — the bug and its non-regression**

Reproduce the original bug first: pick a plan and a `startDate` range that includes previously-empty days, press Guardar, and confirm (before this fix, on the pre-fix commit) "Se pisa" badges flash on days during the save. After the fix: repeat the same save and confirm no "Se pisa" badge appears on the days being written by this operation while `saving` is `true`. Then confirm the fix didn't break the live-update behavior it must NOT touch: with the modal open and `saving` still `false`, toggle a day's "Se pisa"/"Se conserva" badge and switch between two plans — confirm the preview still updates immediately from live `existingByDate` in both cases.

- [ ] **Step 7: Commit**

```bash
git add components/team/stamp-plan-modal.jsx
git commit -m "fix(calendar): freeze conflict lookup during stamp-plan save to stop Se pisa flashing"
```

---

## Self-Review

**1. Spec coverage:**
- §1 hover tooltip → Task 1 + Task 2.
- §2 modal replacing `CalendarDayMenu` for filled non-rest days, two-column/stacked layout, content card, action pills, "⋯" overflow with the 4 shared actions → Tasks 3, 4, 5.
- §3 empty day unchanged → Task 5 Step 5 (branch only triggers for `marking && kind !== 'rest'`; empty days have no `marking` at all, so they fall through to the unchanged anchored-menu path).
- §4 rest day treated as empty → Task 2.
- "Fuera de este diseño" stamp-plan bug → Task 6.

**2. Step scan:** every code step pins an exact signature or exact spec-mandated copy (labels, class names, route paths); no step says "handle edge cases" or leaves a signature undefined. No gaps found.

**3. Type consistency:** `buildCalendarDayTooltipLabel(marking)` (Task 1) is called with the same shape in Task 2 (`marking` prop, already `{ kind, isPresencial, presencialTimeFrom }` per `markingsByDate`'s existing memo — note it does NOT include `presencialTimeTo`; re-checked against `group-calendar-screen.jsx`'s `markingsByDate` memo, which only maps `{ kind, isPresencial, presencialTimeFrom }`. Task 2 must NOT rely on `presencialTimeTo` being present on the `marking` prop it receives from that memo — see fix below).

**Fix applied during self-review:** `markingsByDate` (the memo `CalendarDayCell` receives as `marking`) does not include `presencialTimeTo`, only `presencialTimeFrom`. `buildCalendarDayTooltipLabel`'s test in Task 1 checks both fields on the object it's given, which is correct for the function itself — but Task 2 needs `group-calendar-screen.jsx`'s `markingsByDate` memo (`components/team/group-calendar-screen.jsx:207-210`) extended to include `presencialTimeTo` so the tooltip can show the full time range. Added as a new sub-step:

- [ ] **Task 2, Step 0 (insert before Step 1): extend `markingsByDate` with `presencialTimeTo`**

Change the `markingsByDate` memo (`components/team/group-calendar-screen.jsx:207-210`) from:

```js
const markingsByDate = useMemo(
  () => Object.fromEntries(days.map((d) => [d.date, { kind: d.kind, isPresencial: d.isPresencial, presencialTimeFrom: d.presencialTimeFrom }])),
  [days],
);
```

to:

```js
const markingsByDate = useMemo(
  () => Object.fromEntries(days.map((d) => [d.date, { kind: d.kind, isPresencial: d.isPresencial, presencialTimeFrom: d.presencialTimeFrom, presencialTimeTo: d.presencialTimeTo }])),
  [days],
);
```

This is additive (no existing consumer of `markingsByDate` reads a field that would be affected), so it's safe to fold into Task 2 rather than opening a separate task.

**4. Review Focus:** all 5 lines have an owning task and a step (3 manual-verification steps in Tasks 4/6, 1 Jest test in Task 1, 1 already covered — see table above). No gaps.

**5. Proportion:** the spec is ~150 lines; this plan is longer because it includes full JSX for the 2 new components (`GroupDayContentModal`, `CalendarDayOverflowActions`) and the exact diffs for 3 modified files — all content the spec mandates precisely (exact labels, exact gating rules, exact route paths) but doesn't itself spell out as code. No step repeats another task's code or leaves a placeholder.
