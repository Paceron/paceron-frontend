# Recent Trainings Widget Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a Home widget showing the runner's 3 most recent finished trainings (presencial or async) with distance/duration/% compliance, and enrich the existing trainings-history list with distance/duration per session.

**Architecture:** The widget is a new, isolated component (`RecentTrainingsCard`) that reads `useComparisonList` (already built for the planned-vs-actual comparison feature) with a fixed 90-day window, filters to `status === 'finished'`, and shows the 3 most recent. Clicking a row navigates to the existing session-comparison detail screen. Separately, `groupHistoryItemsBySession` (powers `Entrenamientos > Historial`) gains summed duration/distance fields from data it already receives, surfaced in `TrainingsHistoryRow`.

**Tech Stack:** React Native + react-native-web, NativeWind, TanStack Query (`useComparisonList`), Zustand (not used here — no new store), Jest for pure-function tests.

**Spec:** `docs/superpowers/specs/2026-11-06-recent-trainings-widget-design.md`

## Global Constraints

- Widget shows exactly the **3 most recent** sessions with `status === 'finished'`, from a `dateFrom`/`dateTo` window of **90 days back from today** to today, both `'YYYY-MM-DD'`.
- `useComparisonList` call takes **no `teamId`/`kind`** — cross-team, all types. It does **not** read `trainings-history-filters-store.js` or any other screen's stored filter state.
- Loading or empty result → component renders `null` (no skeleton, no error UI) — same as `CompetitionsPreviewCard`.
- Reuse existing formatters/components verbatim, never reimplement: `formatCompliance`, `complianceTone`, `formatComparisonDate` (`utils/comparison-format.js`), `formatClock` (`utils/time.js`), `formatMeters` (`utils/distance.js`), `ComplianceBadge` (`components/comparison/compliance-badge.jsx`).
- Icon convention: `map-marker-radius` for presencial, `run-fast` for async (matches `next-training-banner.jsx`, same screen).
- Detail navigation: `/training-comparison/session?sessionInstanceId=<id>` — no `athleteUserId` param (defaults to the logged-in user).
- "Ver historial" navigates to the existing Entrenamientos > Historial tab via `useCalendarTabStore.setActiveTab('historial')` + `router.push('/calendar')` (mirrors `CompetitionsPreviewCard`'s `useAchievementsTabStore` pattern).
- Competition attempts are explicitly **out of scope** — this widget only covers training sessions.
- No new backend endpoint for the widget. The trainings-history enrichment is **distance/duration only** — no compliance % or presencial/async badge there (blocked by a missing `is_presencial` field on `/users/{id}/workout-feedback-history` and `/users/{id}/administered-workout-feedback-history` — documented as a gap, not built around).
- No component-render tests (repo convention) — only pure-function unit tests. Visual verification is manual.

## Review Focus

- A session with `status: 'wip'` or `'interrupted'` dated more recently than three `'finished'` sessions must **not** appear in the widget — the filter, not just the sort, decides inclusion.
- A finished session whose every raw history item has `durationMs: null` and `distanceMeters: null` must sum to `0`, not `NaN` or a thrown error, and `TrainingsHistoryRow` must render nothing for that pair (not `"0:00 · 0 m"`).
- Fewer than 3 finished sessions in the 90-day window (including zero) must not pad, error, or crash — the widget shows what it has, or nothing at all.
- A raw history item with `durationMs`/`distanceMeters` present on some items but `null` on others within the same session must sum only the present values (ignore nulls, don't let one `null` zero out the whole session).
- Two sessions sharing the exact same `date` string must both still appear, in a stable, non-crashing order (no assumption that `date` values are unique).

---

### Task 1: `selectRecentFinishedTrainings` pure helper

**Files:**
- Create: `utils/recent-trainings.js`
- Test: `__tests__/recent-trainings.test.js`

**Interfaces:**
- Consumes: an array of session objects shaped like `toComparisonHeader(dto)` + `totals` from `services/normalizers.js` (`toComparisonListModel`) — each has at least `{ sessionInstanceId: string, date: string /* 'YYYY-MM-DD' */, status: 'finished'|'wip'|'interrupted'|'none', ...rest }`.
- Produces: `selectRecentFinishedTrainings(sessions, limit = 3)` — exported function, pure, no React/network. Returns an array (never throws on empty/missing input), sorted by `date` descending, filtered to `status === 'finished'`, capped at `limit`. Task 2 calls this directly on `list.sessions`.

- [ ] **Step 1: Write the failing tests**

```javascript
import { selectRecentFinishedTrainings } from '../utils/recent-trainings.js';

function makeSession(overrides = {}) {
  return { sessionInstanceId: '1', date: '2026-10-01', status: 'finished', ...overrides };
}

describe('selectRecentFinishedTrainings', () => {
  it('returns an empty array for no sessions', () => {
    expect(selectRecentFinishedTrainings([])).toEqual([]);
  });

  it('excludes sessions that are not finished, even if more recent', () => {
    const sessions = [
      makeSession({ sessionInstanceId: '1', date: '2026-09-01', status: 'finished' }),
      makeSession({ sessionInstanceId: '2', date: '2026-10-05', status: 'wip' }),
      makeSession({ sessionInstanceId: '3', date: '2026-10-04', status: 'interrupted' }),
      makeSession({ sessionInstanceId: '4', date: '2026-10-03', status: 'none' }),
    ];
    const result = selectRecentFinishedTrainings(sessions);
    expect(result.map((s) => s.sessionInstanceId)).toEqual(['1']);
  });

  it('sorts finished sessions by date descending', () => {
    const sessions = [
      makeSession({ sessionInstanceId: '1', date: '2026-09-01' }),
      makeSession({ sessionInstanceId: '2', date: '2026-10-05' }),
      makeSession({ sessionInstanceId: '3', date: '2026-09-20' }),
    ];
    const result = selectRecentFinishedTrainings(sessions);
    expect(result.map((s) => s.sessionInstanceId)).toEqual(['2', '3', '1']);
  });

  it('caps at the given limit, defaulting to 3', () => {
    const sessions = Array.from({ length: 5 }, (_, i) => makeSession({ sessionInstanceId: String(i), date: `2026-10-0${i + 1}` }));
    expect(selectRecentFinishedTrainings(sessions)).toHaveLength(3);
    expect(selectRecentFinishedTrainings(sessions, 2)).toHaveLength(2);
  });

  it('returns fewer than the limit without padding when not enough finished sessions exist', () => {
    const sessions = [makeSession({ sessionInstanceId: '1' })];
    expect(selectRecentFinishedTrainings(sessions)).toHaveLength(1);
  });

  it('keeps both sessions when two share the same date, without crashing', () => {
    const sessions = [
      makeSession({ sessionInstanceId: '1', date: '2026-10-01' }),
      makeSession({ sessionInstanceId: '2', date: '2026-10-01' }),
    ];
    expect(selectRecentFinishedTrainings(sessions)).toHaveLength(2);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx jest __tests__/recent-trainings.test.js`
Expected: FAIL with "Cannot find module '../utils/recent-trainings.js'"

- [ ] **Step 3: Implement `selectRecentFinishedTrainings(sessions, limit = 3)` in `utils/recent-trainings.js`**

Filter to `status === 'finished'`, sort by `date` descending (plain string comparison is safe here — all dates are `'YYYY-MM-DD'`, same format, no time component, so lexicographic order matches chronological order), slice to `limit`. Default `sessions` to `[]` if not an array so the function never throws on bad input.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx jest __tests__/recent-trainings.test.js`
Expected: PASS, 6/6

- [ ] **Step 5: Commit**

```bash
git add utils/recent-trainings.js __tests__/recent-trainings.test.js
git commit -m "feat(recent-trainings): add pure selector for the 3 most recent finished sessions"
```

---

### Task 2: `RecentTrainingsCard` home widget component

**Files:**
- Create: `components/home/recent-trainings-card.jsx`

**Interfaces:**
- Consumes: `selectRecentFinishedTrainings` (Task 1); `useComparisonList` (`hooks/use-activity-comparison.js`, existing — returns `{ list, loading, ... }` where `list.sessions` is an array of `{ sessionInstanceId, date, sessionName, teamName, isPresencial, status, compliancePct, totals: { actualDurationMs, actualDistanceM } }`); `ComplianceBadge` (`components/comparison/compliance-badge.jsx`, props `{ pct, size, idPrefix }`); `formatComparisonDate`, `formatClock`, `formatMeters` (existing); `useCalendarTabStore` (`store/calendar-tab-store.js`, `setActiveTab` action); `useAuthStore` (`userId`).
- Produces: `export function RecentTrainingsCard()` — no props, mirrors `CompetitionsPreviewCard`'s signature. Task 3 imports and mounts it with no props.

Structural mirror of `components/home/competitions-preview-card.jsx` (read it for the exact loading/empty/kicker/footer pattern) but as a **vertical list of rows**, not a horizontal box grid — the spec explicitly rules out replicating the 2-box-plus-tile layout; one column is enough since there's no "view all" tile competing for width (the "Ver historial" link is a simple footer row, not a 4th tile).

- [ ] **Step 1: Write `RecentTrainingRow({ training, onPress })` (internal, not exported)**

One row, whole thing a single `Pressable` (`onPress` navigates to the session detail — Task 2 Step 2 wires the actual handler). Content, left to right / wrapped as needed:
- `MaterialCommunityIcons` — `name={training.isPresencial ? 'map-marker-radius' : 'run-fast'}`, `color={colors.primary}`.
- `formatComparisonDate(training.date)` and `training.sessionName` (and `training.teamName` if present) — same `Text` layering style as `TrainingsHistoryRow`'s top row (date · session · ...), i.e. small flex-wrap row of `Text`s separated by `·`.
- `formatClock(training.totals.actualDurationMs)` and `formatMeters(training.totals.actualDistanceM)` — both always shown (unlike the historial enrichment in Task 4/5, these always come from a `finished` comparison session, which always has real totals).
- `ComplianceBadge` with `pct={training.compliancePct}` and `size="sm"`.
- Trailing `MaterialCommunityIcons name="chevron-right"`.

Give every element a `nativeID`/`testID` under the prefix `` `recent-trainings-card-row-${training.sessionInstanceId}` `` (project-wide lint rule `local/require-native-id` enforces this on every `View`/`Text`/`Pressable`).

- [ ] **Step 2: Write `export function RecentTrainingsCard()`**

```javascript
export function RecentTrainingsCard() {
  const router = useRouter();
  const userId = useAuthStore((s) => s.userId);
  const setCalendarTab = useCalendarTabStore((s) => s.setActiveTab);
  const { dateFrom, dateTo } = /* today and 90 days back, both 'YYYY-MM-DD' */;
  const { list, loading } = useComparisonList({ dateFrom, dateTo });

  if (loading || !list) return null;
  const trainings = selectRecentFinishedTrainings(list.sessions);
  if (trainings.length === 0) return null;

  const goToHistory = () => {
    setCalendarTab('historial');
    router.push('/calendar');
  };

  return (/* card shell: same bg-white/dark:bg-surface/shadow-sm/kicker pattern as CompetitionsPreviewCard, kicker text "Tus entrenamientos" */);
}
```

Compute `dateFrom`/`dateTo` with plain `Date` arithmetic (`new Date()`, subtract 90 days, format both as `'YYYY-MM-DD'` — reuse `pad2` from `utils/calendar-month-range.js` if it's already imported elsewhere for this exact kind of formatting, otherwise a two-line local helper is fine, this is a formatting detail left to the implementer). `useComparisonList` is called with exactly `{ dateFrom, dateTo }` — no `teamId`, no `kind`, no read from `trainings-history-filters-store.js`.

Footer: a single `Pressable` row, "Ver historial" label + chevron, `onPress={goToHistory}` — not a 4th tile, a plain footer line below the rows (per the Global Constraints' "no view-all tile" note).

- [ ] **Step 3: Manual visual check**

Start the dev server, log in as a runner with at least one finished training in the last 90 days, confirm the card renders below `CompetitionsPreviewCard` on `/`. No component-render test — repo convention.

- [ ] **Step 4: Commit**

```bash
git add components/home/recent-trainings-card.jsx
git commit -m "feat(home): add recent trainings widget sourced from the comparison endpoint"
```

---

### Task 3: Mount the widget on the Home screen

**Files:**
- Modify: `components/home/authenticated-home-screen.jsx:14` (import), `:84` (mount point — inside the `activeRole === 'runner'` block, immediately after `<CompetitionsPreviewCard />`)

**Interfaces:**
- Consumes: `RecentTrainingsCard` (Task 2), no props.

- [ ] **Step 1: Add the import**

```javascript
import { RecentTrainingsCard } from './recent-trainings-card.jsx';
```

- [ ] **Step 2: Mount it after `<CompetitionsPreviewCard />`**

```jsx
{activeRole === 'runner' && (
  <>
    <StreakBanner />
    <AchievementHighlightCard />
    <RunnerKpisCard />
    <CompetitionsPreviewCard />
    <RecentTrainingsCard />
  </>
)}
```

- [ ] **Step 3: Manual visual check**

Reload the Home screen as a runner, confirm the new card appears last, below competitions, and that pull-to-refresh / role switch don't crash (it's inside the same `activeRole === 'runner'` guard as its siblings, no new guard needed).

- [ ] **Step 4: Commit**

```bash
git add components/home/authenticated-home-screen.jsx
git commit -m "feat(home): mount the recent trainings widget below competitions"
```

---

### Task 4: Sum duration/distance per session in `groupHistoryItemsBySession`

**Files:**
- Modify: `utils/trainings-history-grouping.js`
- Test: `__tests__/trainings-history-grouping.test.js` (existing file, add cases — do not replace the existing ones)

**Interfaces:**
- Consumes: raw items shaped like `toWorkoutFeedbackHistoryItemModel` (`services/normalizers.js`) — each has `durationMs: number|null` and `distanceMeters: number|null` among the existing fields.
- Produces: each group object gains two new numeric fields, `totalDurationMs` and `totalDistanceMeters` (both default to `0`, never `null`/`NaN`). Task 5 reads these two fields by name.

- [ ] **Step 1: Write the failing tests**

Add to the existing `describe('groupHistoryItemsBySession', ...)` block in `__tests__/trainings-history-grouping.test.js` (reuse the file's existing `makeItem` helper):

```javascript
it('sums durationMs and distanceMeters across the items of a session', () => {
  const items = [
    makeItem({ id: '1', durationMs: 60000, distanceMeters: 200 }),
    makeItem({ id: '2', durationMs: 30000, distanceMeters: 100 }),
  ];
  const groups = groupHistoryItemsBySession(items);
  expect(groups[0]).toMatchObject({ totalDurationMs: 90000, totalDistanceMeters: 300 });
});

it('treats null durationMs/distanceMeters on some items as zero, without poisoning the sum', () => {
  const items = [
    makeItem({ id: '1', durationMs: 60000, distanceMeters: 200 }),
    makeItem({ id: '2', durationMs: null, distanceMeters: null }),
  ];
  const groups = groupHistoryItemsBySession(items);
  expect(groups[0]).toMatchObject({ totalDurationMs: 60000, totalDistanceMeters: 200 });
});

it('sums to zero, not NaN, when every item has null durationMs/distanceMeters', () => {
  const items = [makeItem({ id: '1', durationMs: null, distanceMeters: null })];
  const groups = groupHistoryItemsBySession(items);
  expect(groups[0]).toMatchObject({ totalDurationMs: 0, totalDistanceMeters: 0 });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx jest __tests__/trainings-history-grouping.test.js`
Expected: FAIL — `totalDurationMs`/`totalDistanceMeters` are `undefined` in the current output (`toMatchObject` fails the new assertions; the 5 pre-existing tests still pass).

- [ ] **Step 3: Implement the sum in `groupHistoryItemsBySession`**

Initialize `totalDurationMs: 0, totalDistanceMeters: 0` alongside the existing `completedCount`/`skippedCount`/`totalCount` in the `group` object literal. Inside the loop, after the existing `completionStatus` branches, add `group.totalDurationMs += item.durationMs ?? 0;` and `group.totalDistanceMeters += item.distanceMeters ?? 0;`.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx jest __tests__/trainings-history-grouping.test.js`
Expected: PASS, 8/8 (5 existing + 3 new)

- [ ] **Step 5: Commit**

```bash
git add utils/trainings-history-grouping.js __tests__/trainings-history-grouping.test.js
git commit -m "feat(trainings-history): sum duration and distance per session"
```

---

### Task 5: Show duration/distance in `TrainingsHistoryRow`

**Files:**
- Modify: `components/calendar/trainings-history-row.jsx`

**Interfaces:**
- Consumes: `group.totalDurationMs`/`group.totalDistanceMeters` (Task 4); `formatClock` (`utils/time.js`), `formatMeters` (`utils/distance.js`) — neither is currently imported in this file.

- [ ] **Step 1: Add the imports**

```javascript
import { formatClock } from '../../utils/time.js';
import { formatMeters } from '../../utils/distance.js';
```

- [ ] **Step 2: Render the summed values in the meta row, gated on being non-zero**

In the `` `${idPrefix}-meta` `` row (the `View` at line 115 that already holds team/group/status), add a block that only renders when `group.totalDurationMs > 0 || group.totalDistanceMeters > 0` (per the spec: a session with no recorded duration/distance on any item shows nothing here, never `"0:00 · 0 m"`). Content: `formatClock(group.totalDurationMs)` and `formatMeters(group.totalDistanceMeters)` joined with `·` (same separator style already used elsewhere in this file), each only included if its own value is `> 0` (a session could have duration but no distance, or vice versa — don't force both into the string). Give the wrapping `View` and `Text` `nativeID`/`testID` under `` `${idPrefix}-metrics` ``.

- [ ] **Step 3: Manual visual check**

Open `Entrenamientos > Historial` as a runner with at least one reviewed session that has duration/distance recorded, confirm the new text appears in the row; confirm a session with no duration/distance recorded shows nothing extra (no `"0:00 · 0 m"`).

- [ ] **Step 4: Commit**

```bash
git add components/calendar/trainings-history-row.jsx
git commit -m "feat(trainings-history): show summed duration/distance on each history row"
```

---

### Task 6: Document the backend gap

**Files:**
- Modify: `docs/BACKEND_API_GAPS.md` (append a new numbered gap at the end, following the existing format of Gap 39 — read its heading style before adding the new one)

**Interfaces:** None — documentation only, no code interface.

- [ ] **Step 1: Append the gap entry**

Heading: `## Gap <N> — workout-feedback-history no trae is_presencial`. Body covers, in the repo's established gap-doc style (context → estado actual confirmado → pedido → alcance):
- `GET /users/{id}/workout-feedback-history` and `GET /users/{id}/administered-workout-feedback-history` (`services/trainingsHistory.js`) don't include `is_presencial` per item.
- Without it, the trainings-history list (`Entrenamientos > Historial`) can't show a presencial/async badge, and can't bring in `compliance_pct` either (that requires cross-referencing the plan, which only `/activities/comparison` already does).
- Ask: add `is_presencial` to both endpoints' response items.
- Scope: backend-only; once shipped, the badge/compliance addition to `TrainingsHistoryRow` is pure frontend follow-up, not covered by this plan.

- [ ] **Step 2: Commit**

```bash
git add docs/BACKEND_API_GAPS.md
git commit -m "docs(backend-gaps): document missing is_presencial on workout-feedback-history"
```
