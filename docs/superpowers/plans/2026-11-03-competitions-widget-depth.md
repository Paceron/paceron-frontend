# Competitions Widget Depth Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Home competition boxes become the click target (navigate + scroll-to +
4s highlight, both platforms), `CompetitionsTab` and `MyCompetitionsTab` gain a
shared collapsible filter panel contained inside their subtabs' bordered frame,
and `MyCompetitionsTab` splits into Activas/Historial subtabs.

**Architecture:** One new pure-logic file (`utils/competition-filters.js`) backs
both tabs' client-side filtering/lifecycle split. One new shared UI component
(`components/shared/filterable-subtabs.jsx`) replaces the bare `<TabBar
variant="compact">` block in both tabs. One new hook
(`hooks/use-scroll-to-highlight.js`) is the cross-platform scroll+flash
mechanism, written generically for reuse by a future onboarding feature.

**Tech Stack:** React Native + NativeWind, Expo Router (`useLocalSearchParams`),
Zustand (`achievements-tab-store.js`, already exists).

**Spec:** `docs/superpowers/specs/2026-11-03-competitions-widget-depth-design.md`

## Global Constraints

- No backend changes — confirmed in the spec, everything is client-side on data
  already fetched by `useCompetitions`/`useMyCompetitions`.
- Highlight duration: exactly 4000ms, identical on web and native.
- Native scroll math: `measureInWindow`, never `measureLayout` (known to fail
  silently under Fabric/New Architecture — see CLAUDE.md "Quirks conocidos").
- `FilterableSubtabs` has no `trailingAction` prop — neither real consumer needs
  one; `competitions-tab.jsx`'s create button stays exactly where it already is
  (`SectionCard`'s `headerRight`), untouched.
- No component-render tests (repo convention) — only pure functions in
  `utils/` get Jest tests.
- `npm test`/`npm run lint` must stay green after every task.

---

### Task 1: `utils/competition-filters.js` — pure filter/lifecycle helpers

**Files:**
- Create: `utils/competition-filters.js`
- Test: `__tests__/competition-filters.test.js`

**Interfaces:**
- Produces: `filterCompetitionsByFields(competitions, { teamId, type, from, to })`
  → filtered array (same shape as input items, no mutation). `splitByLifecycle
  (competitions)` → `{ active: [...], history: [...] }`.
- Consumes: nothing from other tasks (pure, standalone).

Both functions take an array of normalized competition objects (same shape
already used elsewhere this session: `{ id, teamId, type, status, startAt,
endAt, ... }`, `startAt`/`endAt` are ISO datetime strings or `null`).

- [ ] **Step 1: Write the failing tests**

```js
const { filterCompetitionsByFields, splitByLifecycle } = require('../utils/competition-filters.js');

function comp(overrides) {
  return { id: '1', teamId: '1', type: 'metric', status: 'active', startAt: '2026-11-01T00:00:00Z', endAt: '2026-11-10T00:00:00Z', ...overrides };
}

describe('filterCompetitionsByFields', () => {
  test('no filters -> returns everything unchanged', () => {
    const list = [comp({ id: 'a' }), comp({ id: 'b' })];
    expect(filterCompetitionsByFields(list, {})).toEqual(list);
  });

  test('filters by teamId', () => {
    const list = [comp({ id: 'a', teamId: '1' }), comp({ id: 'b', teamId: '2' })];
    expect(filterCompetitionsByFields(list, { teamId: '2' }).map((c) => c.id)).toEqual(['b']);
  });

  test('filters by type', () => {
    const list = [comp({ id: 'a', type: 'metric' }), comp({ id: 'b', type: 'route' })];
    expect(filterCompetitionsByFields(list, { type: 'route' }).map((c) => c.id)).toEqual(['b']);
  });

  test('filters by date range -- startAt within [from, to]', () => {
    const list = [
      comp({ id: 'early', startAt: '2026-10-01T00:00:00Z' }),
      comp({ id: 'inside', startAt: '2026-11-05T00:00:00Z' }),
      comp({ id: 'late', startAt: '2026-12-01T00:00:00Z' }),
    ];
    const result = filterCompetitionsByFields(list, { from: '2026-11-01T00:00:00Z', to: '2026-11-30T00:00:00Z' });
    expect(result.map((c) => c.id)).toEqual(['inside']);
  });

  test('only "from" given -- keeps startAt >= from', () => {
    const list = [comp({ id: 'a', startAt: '2026-10-01T00:00:00Z' }), comp({ id: 'b', startAt: '2026-11-05T00:00:00Z' })];
    expect(filterCompetitionsByFields(list, { from: '2026-11-01T00:00:00Z' }).map((c) => c.id)).toEqual(['b']);
  });

  test('only "to" given -- keeps startAt <= to', () => {
    const list = [comp({ id: 'a', startAt: '2026-10-01T00:00:00Z' }), comp({ id: 'b', startAt: '2026-11-05T00:00:00Z' })];
    expect(filterCompetitionsByFields(list, { to: '2026-10-31T00:00:00Z' }).map((c) => c.id)).toEqual(['a']);
  });

  test('empty-string fields are treated as "no filter", not as a literal match', () => {
    const list = [comp({ id: 'a', teamId: '1' })];
    expect(filterCompetitionsByFields(list, { teamId: '', type: '', from: '', to: '' })).toEqual(list);
  });

  test('does not mutate the input array', () => {
    const list = [comp({ id: 'a' }), comp({ id: 'b', type: 'route' })];
    const copy = [...list];
    filterCompetitionsByFields(list, { type: 'metric' });
    expect(list).toEqual(copy);
  });
});

describe('splitByLifecycle', () => {
  test('active and pending_approval go to "active"; finished and rejected go to "history"', () => {
    const list = [
      comp({ id: 'a', status: 'active' }),
      comp({ id: 'b', status: 'pending_approval' }),
      comp({ id: 'c', status: 'finished' }),
      comp({ id: 'd', status: 'rejected' }),
    ];
    const { active, history } = splitByLifecycle(list);
    expect(active.map((c) => c.id).sort()).toEqual(['a', 'b']);
    expect(history.map((c) => c.id).sort()).toEqual(['c', 'd']);
  });

  test('empty input -> both groups empty', () => {
    expect(splitByLifecycle([])).toEqual({ active: [], history: [] });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx jest competition-filters --verbose`
Expected: FAIL with "Cannot find module '../utils/competition-filters.js'"

- [ ] **Step 3: Write the implementation**

```js
// Filtrado 100% client-side (Gap de backend confirmado innecesario -- ver
// docs/superpowers/specs/2026-11-03-competitions-widget-depth-design.md,
// sección Alcance) sobre el modelo ya normalizado (services/normalizers.js
// #toCompetitionModel). `from`/`to` comparan contra `startAt` -- no hace
// falta mirar `endAt`: lo que el usuario busca al poner un rango es "qué
// arrancó en esa ventana", no si sigue abierta hoy.
export function filterCompetitionsByFields(competitions, { teamId, type, from, to } = {}) {
  return competitions.filter((c) => {
    if (teamId && String(c.teamId) !== String(teamId)) return false;
    if (type && c.type !== type) return false;
    const startMs = new Date(c.startAt).getTime();
    if (from && startMs < new Date(from).getTime()) return false;
    if (to && startMs > new Date(to).getTime()) return false;
    return true;
  });
}

// Activas = todavía no cerrada (incluye lo que espera aprobación). Historial =
// cerrada, en cualquier desenlace. Sin una 3ra categoría a propósito (pedido
// real: no tiene sentido ver "pendientes" sueltas en esta vista cross-equipo).
export function splitByLifecycle(competitions) {
  const active = competitions.filter((c) => c.status === 'active' || c.status === 'pending_approval');
  const history = competitions.filter((c) => c.status === 'finished' || c.status === 'rejected');
  return { active, history };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx jest competition-filters --verbose`
Expected: PASS, all tests green

- [ ] **Step 5: Run lint and full suite**

Run: `npm run lint && npm test`
Expected: 0 errors, same warning baseline as before this task; all suites pass

- [ ] **Step 6: Commit**

```bash
git add utils/competition-filters.js __tests__/competition-filters.test.js
git commit -m "feat(competitions): add pure client-side filter and lifecycle-split helpers"
```

---

### Task 2: `hooks/use-scroll-to-highlight.js` — cross-platform scroll + 4s flash

**Files:**
- Create: `hooks/use-scroll-to-highlight.js`

**Interfaces:**
- Consumes: nothing from Task 1.
- Produces: `useScrollToHighlight(targetId, scrollViewRef)` → `{ registerRow,
  highlightedId }`. `registerRow(id)` returns a ref-callback to attach to a
  row's outer `View`. `highlightedId` is `null` normally, or the id currently
  flashing (compare `competition.id === highlightedId` in Task 5/6's row
  components to swap in the highlight background).

No test for this file — it's a hook wrapping `useEffect`/`setTimeout`/platform
branching, not pure logic, and the repo doesn't unit-test hooks (only pure
`utils/` functions get Jest coverage — see CLAUDE.md "Testing").

- [ ] **Step 1: Write the hook**

```js
import { useEffect, useRef, useState } from 'react';
import { isWeb } from '../utils/platform.js';

// Pensado desde el día uno para reusarse en un futuro mecanismo de
// onboarding (pedido explícito, no es exclusivo de competencias) -- por eso
// vive en hooks/ y no adentro de components/team/competitions-tab.jsx.
//
// `measureInWindow`, nunca `measureLayout`, para el camino nativo -- ver
// CLAUDE.md "Quirks conocidos": measureLayout puede fallar en silencio bajo
// New Architecture/Fabric cuando se mide contra un ancestro lejano a través
// de un ScrollView, exactamente el caso de uso de este hook.
export function useScrollToHighlight(targetId, scrollViewRef) {
  const [highlightedId, setHighlightedId] = useState(null);
  const rowRefs = useRef({});

  const registerRow = (id) => (el) => {
    rowRefs.current[id] = el;
  };

  useEffect(() => {
    if (!targetId) return;
    const node = rowRefs.current[targetId];
    if (!node) return;

    if (isWeb) {
      node.scrollIntoView?.({ behavior: 'smooth', block: 'center' });
    } else if (scrollViewRef?.current) {
      node.measureInWindow((x, winY) => {
        scrollViewRef.current.measureInWindow((sx, scrollWinY) => {
          scrollViewRef.current.scrollTo({ y: winY - scrollWinY - 80, animated: true });
        });
      });
    }

    setHighlightedId(targetId);
    const timer = setTimeout(() => setHighlightedId(null), 4000);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- solo cuando cambia targetId, no en cada re-render por otros motivos
  }, [targetId]);

  return { registerRow, highlightedId };
}
```

- [ ] **Step 2: Run lint**

Run: `npm run lint`
Expected: 0 errors (the `exhaustive-deps` disable comment is the same pattern
already used elsewhere in the repo, e.g. `achievements-screen.jsx`'s ack effect)

- [ ] **Step 3: Commit**

```bash
git add hooks/use-scroll-to-highlight.js
git commit -m "feat(shared): add cross-platform scroll-to-highlight hook"
```

---

### Task 3: `components/shared/filterable-subtabs.jsx` — new shared component

**Files:**
- Create: `components/shared/filterable-subtabs.jsx`

**Interfaces:**
- Consumes: `TabBar` (`components/shared/tab-bar.jsx`, unchanged, used with
  `variant="compact"` and an overridden `wrapClassName`).
- Produces: `FilterableSubtabs({ tabs, active, onChange, badges, scope,
  filterCount, filterContent })` — a JSX component. `tabs`/`active`/`onChange`/
  `badges`/`scope` have the exact same shape `TabBar` already expects (array of
  `{id, label, icon}`, current active id string, change handler, badges map,
  scope string for nativeID/testID prefixing).

- [ ] **Step 1: Write the component**

```jsx
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { TabBar } from './tab-bar.jsx';
import { useThemeColors } from '../../theme/colors.js';

// Compartido por CompetitionsTab (equipo) y MyCompetitionsTab (gamificación)
// -- pedido explícito de que las dos pantallas usen el MISMO mecanismo, no
// una reimplementación cada una. El borde `border-b-2` que antes vivía
// adentro de TabBar variant="compact" se MUEVE a este contenedor: TabBar
// sigue sin cambios, se le pasa un wrapClassName "pelado" (sin su propio
// borde/redondeo) para que el marco no se dibuje dos veces.
export function FilterableSubtabs({ tabs, active, onChange, badges, scope, filterCount = 0, filterContent }) {
  const colors = useThemeColors();
  const [expanded, setExpanded] = useState(false);

  return (
    <View className="mb-4 rounded-xl border-b-2 border-slate-300 dark:border-slate-700" nativeID={`${scope}-frame`} testID={`${scope}-frame`}>
      <View className="flex-row items-center gap-2 px-3 py-1.5" nativeID={`${scope}-row`} testID={`${scope}-row`}>
        <TabBar active={active} badges={badges} onChange={onChange} scope={scope} tabs={tabs} variant="compact" wrapClassName="flex-1 flex-row gap-4" />
        <Pressable
          accessibilityLabel={expanded ? 'Ocultar filtros' : 'Mostrar filtros'}
          accessibilityRole="button"
          className="flex-row items-center gap-1 rounded-full px-2.5 py-1 hover:bg-slate-100 active:opacity-70 dark:hover:bg-slate-800"
          nativeID={`${scope}-filter-toggle`}
          onPress={() => setExpanded((v) => !v)}
          testID={`${scope}-filter-toggle`}
        >
          <MaterialCommunityIcons color={colors.onSurfaceVariant} name="filter-variant" size={18} />
          {filterCount > 0 && (
            <Text className="text-xs font-semibold text-primary" nativeID={`${scope}-filter-count`} testID={`${scope}-filter-count`}>{filterCount}</Text>
          )}
        </Pressable>
      </View>
      {expanded && (
        <View className="px-3 pb-3" nativeID={`${scope}-filter-panel`} testID={`${scope}-filter-panel`}>
          {filterContent}
        </View>
      )}
    </View>
  );
}
```

- [ ] **Step 2: Run lint**

Run: `npm run lint`
Expected: 0 errors (every `View`/`Pressable`/`Text` above already has
`nativeID`+`testID`, satisfies `local/require-native-id`)

- [ ] **Step 3: Commit**

```bash
git add components/shared/filterable-subtabs.jsx
git commit -m "feat(shared): add FilterableSubtabs, collapsible filter panel inside subtabs frame"
```

---

### Task 4: `team-detail-screen.jsx` — scroll ref + `focus` param plumbing

**Files:**
- Modify: `components/team/team-detail-screen.jsx:646-660` (params reading),
  `:1033-1046` (ScrollView + `competitionsContent`)

**Interfaces:**
- Produces: a `scrollViewRef` (via `useRef(null)`) attached to the screen's root
  `<ScrollView>`, and a `focusCompetitionId` value (from `params.focus`, or
  `null`) — both threaded into `<CompetitionsTab>` as new props
  `scrollViewRef`/`focusCompetitionId` (Task 5 consumes these).

- [ ] **Step 1: Add the ref and read the `focus` param**

Find this block (around line 655-660):

```js
  useEffect(() => {
    if (TABS.some((t) => t.id === params.tab)) setActiveTab(params.tab);
  }, [params.tab, setActiveTab]);
```

Add right after it (same component body, before `competitionsContent` is
defined):

```js
  const scrollViewRef = useRef(null);
  const focusCompetitionId = params.focus ?? null;
```

- [ ] **Step 2: Attach the ref to the root `ScrollView`**

Find (around line 1039):

```jsx
    <ScrollView
      className="flex-1 bg-paper dark:bg-ink"
      contentContainerClassName="px-4 py-8"
      nativeID="team-detail-screen-scroll"
      refreshControl={isMobile ? <RefreshControl onRefresh={onRefresh} refreshing={refreshing} tintColor={colors.primary} /> : undefined}
      showsVerticalScrollIndicator={false}
      testID="team-detail-screen-scroll"
    >
```

Add `ref={scrollViewRef}`:

```jsx
    <ScrollView
      className="flex-1 bg-paper dark:bg-ink"
      contentContainerClassName="px-4 py-8"
      nativeID="team-detail-screen-scroll"
      ref={scrollViewRef}
      refreshControl={isMobile ? <RefreshControl onRefresh={onRefresh} refreshing={refreshing} tintColor={colors.primary} /> : undefined}
      showsVerticalScrollIndicator={false}
      testID="team-detail-screen-scroll"
    >
```

- [ ] **Step 3: Pass both down to `CompetitionsTab`**

Find (around line 1033-1035):

```jsx
  const competitionsContent = (
    <CompetitionsTab currentUserId={String(user?.userId)} groups={groupOptions} isTrainerView={isTrainerView} members={members} teamId={team.id} teamName={team.name} />
  );
```

Change to:

```jsx
  const competitionsContent = (
    <CompetitionsTab currentUserId={String(user?.userId)} focusCompetitionId={focusCompetitionId} groups={groupOptions} isTrainerView={isTrainerView} members={members} scrollViewRef={scrollViewRef} teamId={team.id} teamName={team.name} />
  );
```

- [ ] **Step 4: Run lint and full suite**

Run: `npm run lint && npm test`
Expected: 0 errors, all suites pass (nothing here changes behavior yet —
`CompetitionsTab` doesn't read these new props until Task 5)

- [ ] **Step 5: Commit**

```bash
git add components/team/team-detail-screen.jsx
git commit -m "feat(team-detail): thread scrollViewRef and focus query param to CompetitionsTab"
```

---

### Task 5: `competitions-tab.jsx` — filters, highlight, and `FilterableSubtabs`

**Files:**
- Modify: `components/team/competitions-tab.jsx`

**Interfaces:**
- Consumes: `filterCompetitionsByFields` (Task 1), `useScrollToHighlight` (Task
  2), `FilterableSubtabs` (Task 3), `scrollViewRef`/`focusCompetitionId` props
  (Task 4).
- Produces: nothing new for later tasks (this tab has no further consumers in
  this plan).

- [ ] **Step 1: Add imports**

At the top of the file, alongside the existing imports:

```js
import { DateField, ResponsiveSelectField } from '../forms/fields.jsx';
import { filterCompetitionsByFields } from '../../utils/competition-filters.js';
import { useScrollToHighlight } from '../../hooks/use-scroll-to-highlight.js';
import { FilterableSubtabs } from '../shared/filterable-subtabs.jsx';
```

(Confirmed: `DateField` lives in `components/forms/fields.jsx`;
`ResponsiveSelectField` lives in the separate `components/forms/responsive-
select-field.jsx` — two different files, already split into two import lines
above.)

- [ ] **Step 2: Accept the two new props on `CompetitionsTab`**

Change the function signature:

```js
export function CompetitionsTab({ teamId, teamName, members, groups, isTrainerView, currentUserId, scrollViewRef, focusCompetitionId }) {
```

- [ ] **Step 3: Add filter state and the filtered list**

Inside `CompetitionsTab`, near the other `useState` calls (after `const
[subTab, setSubTab] = useState('active');`):

```js
  const [filterType, setFilterType] = useState('');
  const [filterFrom, setFilterFrom] = useState('');
  const [filterTo, setFilterTo] = useState('');
  const filterCount = [filterType, filterFrom, filterTo].filter(Boolean).length;
```

Replace the existing `listByTab`/`visibleList` block:

```js
  const listByTab = {
    active: competitions.filter((c) => c.status === 'active'),
    pending: competitions.filter((c) => c.status === 'pending_approval'),
    history: competitions.filter((c) => c.status === 'finished' || c.status === 'rejected'),
  };
  const visibleList = listByTab[subTab];
```

with:

```js
  const filteredCompetitions = filterCompetitionsByFields(competitions, { type: filterType, from: filterFrom, to: filterTo });
  const listByTab = {
    active: filteredCompetitions.filter((c) => c.status === 'active'),
    pending: filteredCompetitions.filter((c) => c.status === 'pending_approval'),
    history: filteredCompetitions.filter((c) => c.status === 'finished' || c.status === 'rejected'),
  };
  const visibleList = listByTab[subTab];
```

- [ ] **Step 4: Wire the focus deep link to the right subtab, before the highlight hook runs**

Add near the top of the component body, after `competitions`/`loading` are
available (needs the raw `competitions` list, not the filtered one — focus
should work even if a filter would otherwise hide the target):

```js
  useEffect(() => {
    if (!focusCompetitionId || loading) return;
    const target = competitions.find((c) => String(c.id) === String(focusCompetitionId));
    if (!target) return;
    const tabForStatus = target.status === 'pending_approval' ? 'pending' : target.status === 'active' ? 'active' : 'history';
    setSubTab(tabForStatus);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- solo cuando cambia el id de foco, no en cada fetch
  }, [focusCompetitionId, loading]);

  const { registerRow, highlightedId } = useScrollToHighlight(focusCompetitionId, scrollViewRef);
```

- [ ] **Step 5: Register each row's ref and pass the highlight flag down to `CompetitionRow`**

In the `visibleList.map(...)` block, add a wrapping `View` with the ref (since
`CompetitionRow` itself doesn't accept a `ref` prop — wrap it instead of
modifying `CompetitionRow`'s own root):

```jsx
          {visibleList.map((competition) => (
            <View key={competition.id} ref={registerRow(competition.id)}>
              <CompetitionRow
                busy={busy}
                competition={competition}
                currentUserId={currentUserId}
                expanded={!collapsedIds.has(competition.id)}
                highlighted={competition.id === highlightedId}
                isTrainerView={isTrainerView}
                members={members}
                onApprove={handleApprove}
                onCancel={handleCancel}
                onClose={handleClose}
                onRun={handleRun}
                onReject={setRejectTargetId}
                onOpenAttempts={setAttemptsCompetition}
                onOpenRanking={setRankingCompetition}
                onToggleExpand={() => toggleExpanded(competition.id)}
              />
            </View>
          ))}
```

- [ ] **Step 6: Make `CompetitionRow` use the `highlighted` flag**

Change `CompetitionRow`'s signature:

```js
function CompetitionRow({ competition, members, isTrainerView, currentUserId, expanded, highlighted, onToggleExpand, onApprove, onReject, onCancel, onClose, onRun, onOpenRanking, onOpenAttempts, busy }) {
```

Change its root `View`'s className (currently `"rounded-xl border border-
slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-900"`) to swap
in the amber flash when `highlighted` is true:

```jsx
    <View className={`rounded-xl border p-3 transition-all ${highlighted ? 'border-amber-300 bg-amber-100 dark:border-amber-700 dark:bg-amber-900/30' : 'border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-900'}`} nativeID={idPrefix} testID={idPrefix}>
```

- [ ] **Step 7: Replace the subtabs block with `FilterableSubtabs`**

Find:

```jsx
      <View className="mb-4" nativeID="competitions-tab-header" testID="competitions-tab-header">
        <TabBar active={subTab} badges={{ pending: listByTab.pending.length > 0 }} onChange={setSubTab} scope="competitions-tab-subtabs" tabs={SUB_TABS} variant="compact" />
      </View>
```

Replace with:

```jsx
      <FilterableSubtabs
        active={subTab}
        badges={{ pending: listByTab.pending.length > 0 }}
        filterContent={(
          <>
            <ResponsiveSelectField dense label="Tipo" onChange={setFilterType} options={[{ id: 'metric', name: 'Por métrica' }, { id: 'route', name: 'Por trayectoria' }]} placeholder="Todos los tipos" value={filterType} />
            <View className="mt-3 flex-row gap-3" nativeID="competitions-tab-date-range" testID="competitions-tab-date-range">
              <View className="flex-1" nativeID="competitions-tab-date-from" testID="competitions-tab-date-from">
                <DateField dense label="Desde" onChange={setFilterFrom} value={filterFrom} />
              </View>
              <View className="flex-1" nativeID="competitions-tab-date-to" testID="competitions-tab-date-to">
                <DateField dense label="Hasta" onChange={setFilterTo} value={filterTo} />
              </View>
            </View>
          </>
        )}
        filterCount={filterCount}
        onChange={setSubTab}
        scope="competitions-tab-subtabs"
        tabs={SUB_TABS}
      />
```

Remove the now-unused `TabBar` import if nothing else in this file still uses
it directly (check with `grep -n "TabBar" components/team/competitions-tab.jsx`
before deleting the import line — if `FilterableSubtabs` is the only remaining
reference, drop the `TabBar` import).

- [ ] **Step 8: Run lint and full suite**

Run: `npm run lint && npm test`
Expected: 0 errors, same warning baseline, all suites pass

- [ ] **Step 9: Commit**

```bash
git add components/team/competitions-tab.jsx
git commit -m "feat(competitions-tab): add type/date filters and scroll-to-highlight on focus"
```

---

### Task 6: `my-competitions-tab.jsx` — Activas/Historial subtabs + filters

**Files:**
- Modify: `components/achievements/my-competitions-tab.jsx`

**Interfaces:**
- Consumes: `splitByLifecycle`/`filterCompetitionsByFields` (Task 1),
  `FilterableSubtabs` (Task 3), `useMyMemberTeams` (`hooks/use-teams.js`,
  already used internally by `useMyCompetitions`).
- Produces: nothing new for later tasks.

- [ ] **Step 1: Add imports**

```js
import { useState } from 'react';
import { DateField } from '../forms/fields.jsx';
import { ResponsiveSelectField } from '../forms/responsive-select-field.jsx';
import { filterCompetitionsByFields, splitByLifecycle } from '../../utils/competition-filters.js';
import { FilterableSubtabs } from '../shared/filterable-subtabs.jsx';
import { useAuthStore } from '../../store/auth-store.js';
import { useMyMemberTeams } from '../../hooks/use-teams.js';
```

(`useAuthStore` already imported — don't duplicate; add only what's missing.)

- [ ] **Step 2: Bump `numberOfLines` on the title**

Change (in `CompetitionRow`):

```jsx
        <Text className="font-semibold text-slate-900 dark:text-white" nativeID={`${idPrefix}-title`} numberOfLines={1} testID={`${idPrefix}-title`}>
```

to `numberOfLines={3}`.

- [ ] **Step 3: Rewrite `MyCompetitionsTab`'s body**

Replace the whole function (keep `CompetitionRow`/`StatusBadge` as they are,
aside from Step 2's change):

```jsx
const SUBTABS = [
  { id: 'active_tab', icon: 'sword-cross', label: 'Activas' },
  { id: 'history_tab', icon: 'archive-outline', label: 'Historial' },
];

const EMPTY_MESSAGE = {
  active_tab: 'Todavía no participás de ninguna competencia activa.',
  history_tab: 'Todavía no tenés competencias en tu historial.',
};

export function MyCompetitionsTab() {
  const router = useRouter();
  const userId = useAuthStore((s) => s.userId);
  const { teams } = useMyMemberTeams(userId);
  const { competitions, loading } = useMyCompetitions(userId);
  const [subTab, setSubTab] = useState('active_tab');
  const [filterTeamId, setFilterTeamId] = useState('');
  const [filterType, setFilterType] = useState('');
  const [filterFrom, setFilterFrom] = useState('');
  const [filterTo, setFilterTo] = useState('');
  const filterCount = [filterTeamId, filterType, filterFrom, filterTo].filter(Boolean).length;

  if (loading) return null;

  const filtered = filterCompetitionsByFields(competitions, { teamId: filterTeamId, type: filterType, from: filterFrom, to: filterTo });
  const { active, history } = splitByLifecycle(filtered);
  const visibleList = sortCompetitionsForList(subTab === 'active_tab' ? active : history);
  const teamOptions = teams.map((t) => ({ id: t.id, name: t.name }));

  return (
    <View nativeID="my-competitions-tab-root" testID="my-competitions-tab-root">
      <FilterableSubtabs
        active={subTab}
        filterContent={(
          <>
            <ResponsiveSelectField dense label="Equipo" onChange={setFilterTeamId} options={teamOptions} placeholder="Todos los equipos" value={filterTeamId} />
            <ResponsiveSelectField dense label="Tipo" onChange={setFilterType} options={[{ id: 'metric', name: 'Por métrica' }, { id: 'route', name: 'Por trayectoria' }]} placeholder="Todos los tipos" value={filterType} />
            <View className="mt-3 flex-row gap-3" nativeID="my-competitions-tab-date-range" testID="my-competitions-tab-date-range">
              <View className="flex-1" nativeID="my-competitions-tab-date-from" testID="my-competitions-tab-date-from">
                <DateField dense label="Desde" onChange={setFilterFrom} value={filterFrom} />
              </View>
              <View className="flex-1" nativeID="my-competitions-tab-date-to" testID="my-competitions-tab-date-to">
                <DateField dense label="Hasta" onChange={setFilterTo} value={filterTo} />
              </View>
            </View>
          </>
        )}
        filterCount={filterCount}
        onChange={setSubTab}
        scope="my-competitions-tab-subtabs"
        tabs={SUBTABS}
      />
      {visibleList.length === 0 ? (
        <Text className="py-6 text-center text-sm text-slate-400 dark:text-slate-500" nativeID="my-competitions-tab-empty" testID="my-competitions-tab-empty">
          {EMPTY_MESSAGE[subTab]}
        </Text>
      ) : (
        visibleList.map((competition) => (
          <CompetitionRow
            competition={competition}
            key={competition.id}
            onPress={() => router.push(`/teams/${competition.teamId}?tab=competencias`)}
          />
        ))
      )}
    </View>
  );
}
```

Note `ResponsiveSelectField`'s `options` need string-ish `id`/`name` fields —
`teamOptions` above maps `useMyMemberTeams`' team objects (`{id, name, ...}`)
directly, same shape already used by `CompetitionsTab`'s own team-scoped call
sites elsewhere in the app.

- [ ] **Step 4: Run lint and full suite**

Run: `npm run lint && npm test`
Expected: 0 errors, same warning baseline, all suites pass

- [ ] **Step 5: Commit**

```bash
git add components/achievements/my-competitions-tab.jsx
git commit -m "feat(my-competitions-tab): split into Activas/Historial with team/type/date filters"
```

---

### Task 7: `competitions-preview-card.jsx` — box-as-button, 4th tile, numberOfLines

**Files:**
- Modify: `components/home/competitions-preview-card.jsx`

**Interfaces:**
- Consumes: `useAchievementsTabStore` (`store/achievements-tab-store.js`,
  confirmed exports `activeTab`/`setActiveTab`).
- Produces: nothing new for later tasks (last consumer in this plan).

- [ ] **Step 1: Add the store import**

```js
import { useAchievementsTabStore } from '../../store/achievements-tab-store.js';
```

- [ ] **Step 2: Make the whole box the `Pressable`, drop the separate "Ver" CTA**

Replace `PreviewBox`'s body. Current root is a plain `View`; it becomes a
`Pressable` taking `onPress` directly (same prop name the caller already
passes), and the inner CTA `Pressable`+label are removed — their content
(team name, status, chevron) moves into the footer row as plain `View`/`Text`:

```jsx
function PreviewBox({ competition, onPress, wide }) {
  const colors = useThemeColors();
  const idPrefix = `competitions-preview-box-${competition.id}`;
  return (
    <Pressable
      accessibilityLabel={`Ver ${buildCompetitionTitle(competition)}`}
      accessibilityRole="button"
      className={`rounded-2xl border border-slate-200 bg-slate-100 p-4 hover:opacity-90 active:opacity-90 dark:bg-slate-800 dark:border-slate-700 ${wide ? 'flex-1' : ''}`}
      nativeID={idPrefix}
      onPress={onPress}
      testID={idPrefix}
    >
      <View className="mb-4 flex-row items-center gap-2" nativeID={`${idPrefix}-header`} testID={`${idPrefix}-header`}>
        <MaterialCommunityIcons color={colors.primary} name={TYPE_ICON[competition.type] ?? 'trophy-variant'} size={18} />
        <Text className="flex-1 font-bold text-slate-900 dark:text-white" nativeID={`${idPrefix}-title`} numberOfLines={3} testID={`${idPrefix}-title`}>
          {buildCompetitionTitle(competition)}
        </Text>
      </View>
      <View className="flex-row items-center justify-between" nativeID={`${idPrefix}-footer`} testID={`${idPrefix}-footer`}>
        <View className="flex-1" nativeID={`${idPrefix}-footer-text`} testID={`${idPrefix}-footer-text`}>
          <Text className="mb-1 text-xs text-slate-500 dark:text-slate-400" nativeID={`${idPrefix}-team`} numberOfLines={1} testID={`${idPrefix}-team`}>
            {competition.teamName}
          </Text>
          <Text className="text-xs font-semibold text-primary" nativeID={`${idPrefix}-status`} testID={`${idPrefix}-status`}>
            {statusLabel(competition)}
          </Text>
        </View>
        <MaterialCommunityIcons color={colors.onSurfaceVariant} name="chevron-right" size={18} />
      </View>
    </Pressable>
  );
}
```

- [ ] **Step 3: Add the "ver todas" tile**

Add right after `PreviewBox`'s definition (same file):

```jsx
function ViewAllTile({ wide, onPress }) {
  const colors = useThemeColors();
  return (
    <Pressable
      accessibilityLabel="Ver todas las competencias"
      accessibilityRole="button"
      className={`items-center justify-center gap-1 rounded-2xl border border-slate-200 bg-slate-100 hover:opacity-90 active:opacity-90 dark:bg-slate-800 dark:border-slate-700 ${wide ? 'w-20' : 'flex-row gap-2 p-3'}`}
      nativeID="competitions-preview-card-view-all"
      onPress={onPress}
      testID="competitions-preview-card-view-all"
    >
      <MaterialCommunityIcons color={colors.onSurfaceVariant} name="dots-horizontal-circle-outline" size={wide ? 22 : 18} />
      <Text className="text-xs font-semibold text-slate-600 dark:text-slate-300" nativeID="competitions-preview-card-view-all-label" testID="competitions-preview-card-view-all-label">
        Ver todas
      </Text>
    </Pressable>
  );
}
```

- [ ] **Step 4: Wire the focus deep link and mount the new tile**

Replace `CompetitionsPreviewCard`'s body:

```jsx
export function CompetitionsPreviewCard() {
  const router = useRouter();
  const userId = useAuthStore((s) => s.userId);
  const isNarrow = useIsNarrowWeb();
  const setAchievementsTab = useAchievementsTabStore((s) => s.setActiveTab);
  const { competitions, loading } = useMyCompetitions(userId, { status: 'active' });

  if (loading || competitions.length === 0) return null;

  const preview = sortCompetitionsForPreview(competitions).slice(0, 3);
  const wide = isWeb && !isNarrow;

  const goToAllCompetitions = () => {
    setAchievementsTab('competitions');
    router.push('/achievements');
  };

  return (
    <View className="mb-3 rounded-2xl bg-white p-4 shadow-sm dark:bg-surface" nativeID="competitions-preview-card" testID="competitions-preview-card">
      <Text className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500" nativeID="competitions-preview-card-kicker" testID="competitions-preview-card-kicker">
        Tus competencias
      </Text>
      <View className={wide ? 'flex-row gap-3' : 'gap-3'} nativeID="competitions-preview-card-list" testID="competitions-preview-card-list">
        {preview.map((competition) => (
          <PreviewBox
            competition={competition}
            key={competition.id}
            onPress={() => router.push(`/teams/${competition.teamId}?tab=competencias&focus=${competition.id}`)}
            wide={wide}
          />
        ))}
        <ViewAllTile onPress={goToAllCompetitions} wide={wide} />
      </View>
    </View>
  );
}
```

- [ ] **Step 5: Run lint and full suite**

Run: `npm run lint && npm test`
Expected: 0 errors, same warning baseline, all suites pass

- [ ] **Step 6: Commit**

```bash
git add components/home/competitions-preview-card.jsx
git commit -m "feat(competitions-preview): boxes are the button, add view-all tile and focus deep link"
```

---

### Task 8: Final regression

**Files:** none (verification-only task, no code changes).

- [ ] **Step 1: Run the full suite and lint once more**

Run: `npm test && npm run lint`
Expected: all green, same warning baseline as the start of this plan

- [ ] **Step 2: Manual sweep in preview (web)**

- Home: confirm the 3 boxes (or fewer) + the 4th "Ver todas" tile render, in
  both wide (`flex-row`) and narrow (stacked) layouts, light and dark.
- Click a box: lands on the team's Competencias tab, correct subtab
  auto-selected, the row visibly flashes amber then fades back within ~4s.
- "Ver todas": lands on `/achievements` with the Competencias tab already
  active, showing the Activas subtab by default.
- In both `CompetitionsTab` and `MyCompetitionsTab`: open the filter panel,
  confirm the panel renders INSIDE the same bordered frame as the subtabs (no
  gap, no double border), apply a type filter and a date range, confirm the
  list narrows correctly, confirm the filter-count badge on the toggle button
  updates.
- `MyCompetitionsTab`: confirm Historial shows finished+rejected only, Activas
  shows active+pending_approval only, and the team filter narrows correctly.

- [ ] **Step 3: Note what's unverifiable in this pass**

The native `measureInWindow`-based scroll path (Task 2) cannot be exercised in
the web preview — it only runs on native. Write this down as the one
pending-device-confirmation item, same pattern as the rest of this session's
mobile-only gaps.

- [ ] **Step 4: No commit for this task** (verification-only).
