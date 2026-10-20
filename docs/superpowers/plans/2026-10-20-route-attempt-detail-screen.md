# Route Attempt Detail Screen Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Generalize `route-attempt-result-screen.jsx` (today: mobile-only, only shows the attempt you *just* finished) into a multiplatform, shell-integrated "attempt detail" screen reachable for any participant of a route competition, at any time, from any platform.

**Architecture:** One screen, one hook (`useAttemptDetail`), two data-loading branches that normalize to the same shape: a local SQLite branch (used only when the screen is reached right after finishing an attempt, via a `setId` nav param) and a remote branch (used everywhere else, built entirely on existing backend endpoints — `getCompetition`, `getRunnerSession`, `getSessionFeedback`, `getWorkoutFeedbackPoints` — once the competition model exposes `session_instance_id`, which the backend has already shipped as Gap 35). The screen moves under `app/(tabs)/` to get `AppWebShell`/`AppMobileShell` for free, exactly like `app/(tabs)/training-session-review.jsx` already does.

**Tech Stack:** Expo Router, React Native, NativeWind, TanStack Query, Jest.

**Spec:** `docs/superpowers/specs/2026-10-20-route-attempt-detail-screen-design.md`

## Global Constraints

- `nativeID`/`testID` kebab-case on every visual component (`View`, `Text`, `Pressable`, etc.) — no exceptions, enforced by `local/require-native-id` lint rule.
- No component-render tests (repo convention) — only pure logic gets Jest tests.
- `npm test` and `npm run lint` must stay green after every task.
- Visibility rule: any participant's attempt detail is viewable by anyone who can see the competition (same criterion the ranking already uses) — no "own attempts only" restriction anywhere in this plan.
- Multi-attempt-per-competition is explicitly OUT of scope — the hook/screen must look up by `(competitionId, athleteUserId)` identity, never assume "the most recent attempt," but no attempts-list UI is built now.
- `progress.value` is always `null` for `type='route'` competitions in v1 — do not build anything that depends on it carrying a time value.

---

### Task 1: Rename the mock's synthetic-instance field to match the real backend contract, expose `sessionInstanceId` on the competition model

**Files:**
- Modify: `services/__mocks__/competitions-mock.js:63-72` (seed 7), `:88-97` (seed 8), `:147`, `:224`
- Modify: `services/normalizers.js:1131-1156` (`toCompetitionModel`)
- Test: `__tests__/normalizers.test.js`

**Interfaces:**
- Consumes: nothing new.
- Produces: `toCompetitionModel(dto).sessionInstanceId` — `string | null`. Every later task that needs the synthetic instance id reads this field.

**Context:** the mock already tracks a synthetic session-instance id per route competition internally, but under the field name `synthetic_session_instance_id` — a placeholder chosen before the real backend confirmed its actual field name. The backend has now shipped (not yet merged to `develop`, but confirmed implemented) `session_instance_id` on both `GET /teams/{id}/competitions` and `GET /competitions/{id}`, `null` for `type='metric'`. Renaming the mock's internal field to match means `USE_MOCKS=true` behaves identically to the real backend's future response, and nothing else in the mock file needs new logic — `mockGetCompetition`'s existing `{ ...competition, progress }` spread will carry the renamed field automatically.

- [ ] **Step 1: Rename the mock field**

In `services/__mocks__/competitions-mock.js`, find the two seed objects (`id: 7` and `id: 8`) and the one runtime-creation line. Rename `synthetic_session_instance_id` → `session_instance_id` in all three places, and in the one place it's read back out:

```js
// seed id: 7 — change this line:
    synthetic_session_instance_id: 9000,
// to:
    session_instance_id: 9000,

// seed id: 8 — change this line:
    synthetic_session_instance_id: 9100,
// to:
    session_instance_id: 9100,
```

Find the line (around line 147) inside `mockCreateCompetition` that assigns the field for runtime-created competitions:

```js
// change this line:
    synthetic_session_instance_id: payload.type === 'route' ? nextSyntheticInstanceId++ : null,
// to:
    session_instance_id: payload.type === 'route' ? nextSyntheticInstanceId++ : null,
```

Find the line (around line 224) inside the attempt-intake mock that reads the field back out:

```js
// change this line:
    session_instance_id: competition.synthetic_session_instance_id,
// to:
    session_instance_id: competition.session_instance_id,
```

- [ ] **Step 2: Add the failing test for the normalizer**

In `__tests__/normalizers.test.js`, add (near the existing `toCompetitionModel` tests, or create a new `describe` block if none exists yet — check the file first):

```js
describe('toCompetitionModel', () => {
  it('maps session_instance_id to sessionInstanceId as a string', () => {
    const dto = {
      id: 7, team_id: 5, group_id: null, type: 'route', metric: null,
      start_at: '2026-10-20T10:00:00Z', end_at: null,
      route: null, acceptance_radius_meters: 50,
      participant_user_ids: [1], created_by_user_id: 99, created_by_role: 'trainer',
      status: 'active', approved_by_user_id: null, rejection_reason: null,
      winner_user_ids: [], finished_at: null,
      session_instance_id: 9000,
    };
    expect(toCompetitionModel(dto).sessionInstanceId).toBe('9000');
  });

  it('maps a null session_instance_id (metric competitions) to null', () => {
    const dto = {
      id: 1, team_id: 5, group_id: null, type: 'metric', metric: 'distance',
      start_at: '2026-10-20T10:00:00Z', end_at: '2026-10-27T10:00:00Z',
      route: null, acceptance_radius_meters: null,
      participant_user_ids: [1], created_by_user_id: 99, created_by_role: 'trainer',
      status: 'active', approved_by_user_id: null, rejection_reason: null,
      winner_user_ids: [], finished_at: null,
      session_instance_id: null,
    };
    expect(toCompetitionModel(dto).sessionInstanceId).toBeNull();
  });
});
```

Make sure `toCompetitionModel` is imported at the top of the test file (check the existing import line from `'../services/normalizers.js'` and add it if it's not already there).

- [ ] **Step 3: Run the test to verify it fails**

Run: `npm test -- normalizers -t "sessionInstanceId"`
Expected: FAIL — `sessionInstanceId` is `undefined`, not `'9000'`/`null`.

- [ ] **Step 4: Add the field to the normalizer**

In `services/normalizers.js`, inside `toCompetitionModel` (around line 1133-1156), add one line to the returned object (right after `route: dto.route ?? null,` reads naturally, but any position in the object literal works):

```js
    route: dto.route ?? null,
    sessionInstanceId: dto.session_instance_id != null ? String(dto.session_instance_id) : null,
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npm test -- normalizers -t "sessionInstanceId"`
Expected: PASS (both cases).

- [ ] **Step 6: Run the full suite and lint, then commit**

Run: `npm test && npm run lint`
Expected: both green, no new errors/warnings.

```bash
git add services/__mocks__/competitions-mock.js services/normalizers.js __tests__/normalizers.test.js
git commit -m "feat(competitions): expose sessionInstanceId on the competition model

Mock renombrado para coincidir con el campo real del backend
(session_instance_id, Gap 35) -- sin esto no hay forma de pedir el
detalle de un intento viejo por API."
```

---

### Task 2: `useAttemptDetail` hook — dual-source data loading

**Files:**
- Create: `hooks/use-attempt-detail.js`
- Test: `__tests__/use-attempt-detail-status.test.js`

**Interfaces:**
- Consumes: `services/session-db.js#getGpsPoints(setId)` (existing), `services/competitions.js#getCompetition(id)` (existing, via `hooks/use-competitions.js#useCompetitionDetail`, existing), `services/runnerSession.js#getRunnerSession(sessionInstanceId, athleteUserId)`, `#getSessionFeedback(sessionInstanceId, athleteUserId)`, `#getWorkoutFeedbackPoints(feedbackId)` (all existing), `utils/route-geometry.js#totalRouteMeters(points)` (existing), `services/normalizers.js#toCompetitionDetailModel`/`toRunnerSessionModel`/`toSessionFeedbackListModel` (existing — check each one's exact export name before using).
- Produces: `useAttemptDetail({ competitionId, athleteUserId, setId })` → `{ loading, status, distanceMeters, durationMs, startedAt, teamId, traveledPoints, referenceRoute, expectedMeters }`. `status` is one of `'local' | 'synced' | 'pending' | 'not_found'`. Task 3 (the screen) is the only consumer.

**Context:** read the spec's "Arquitectura > `useAttemptDetail`" section for the full branching logic before starting. The pure piece worth testing in isolation is "given a runner-session state and a feedback list, what `status` do we report" — everything else (the actual network calls) is TanStack Query orchestration, not unit-testable per this repo's convention (no component/hook-render tests). Extract that piece as its own exported pure function so it has a real test.

- [ ] **Step 1: Write the failing test for the pure status-derivation function**

Create `__tests__/use-attempt-detail-status.test.js`:

```js
import { deriveAttemptStatus } from '../hooks/use-attempt-detail.js';

describe('deriveAttemptStatus', () => {
  it('returns not_found when there is no runner session', () => {
    expect(deriveAttemptStatus({ runnerSession: null, feedbackList: [] })).toBe('not_found');
  });

  it('returns pending when a runner session exists but no feedback synced yet', () => {
    expect(deriveAttemptStatus({ runnerSession: { status: 'wip' }, feedbackList: [] })).toBe('pending');
  });

  it('returns synced when a runner session exists and feedback has synced', () => {
    expect(deriveAttemptStatus({ runnerSession: { status: 'finished' }, feedbackList: [{ id: '1' }] })).toBe('synced');
  });

  it('returns synced even if runner session is still wip, as long as feedback already synced', () => {
    expect(deriveAttemptStatus({ runnerSession: { status: 'wip' }, feedbackList: [{ id: '1' }] })).toBe('synced');
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- use-attempt-detail-status`
Expected: FAIL with "Cannot find module '../hooks/use-attempt-detail.js'" (the file doesn't exist yet).

- [ ] **Step 3: Create the hook file with the pure function and the full hook**

Create `hooks/use-attempt-detail.js`:

```js
import { useQuery } from '@tanstack/react-query';
import { getGpsPoints } from '../services/session-db.js';
import { getRunnerSession, getSessionFeedback, getWorkoutFeedbackPoints } from '../services/runnerSession.js';
import { toRunnerSessionModel, toSessionFeedbackListModel } from '../services/normalizers.js';
import { useCompetitionDetail } from './use-competitions.js';
import { totalRouteMeters } from '../utils/route-geometry.js';
import { isWeb } from '../utils/platform.js';

// Status puro a partir de los dos datos remotos -- extraído para poder
// testearlo sin orquestar queries. `wip` con feedback ya sincronizado
// SÍ es `synced` (un intento de ruta es un solo set; una vez que ese set
// tiene feedback, hay stats reales que mostrar aunque el runner_session
// todavía no haya recibido el PATCH finished).
export function deriveAttemptStatus({ runnerSession, feedbackList }) {
  if (!runnerSession) return 'not_found';
  if (!feedbackList?.length) return 'pending';
  return 'synced';
}

function useLocalAttemptDetail(setId, { distanceMeters, durationMs }) {
  const query = useQuery({
    queryKey: ['attempt-detail-local', setId],
    queryFn: async () => {
      const points = await getGpsPoints(setId);
      return points.map((p) => ({ latitude: p.latitude, longitude: p.longitude }));
    },
    enabled: Boolean(setId) && !isWeb,
  });

  return {
    loading: query.isLoading,
    status: 'local',
    distanceMeters: Number(distanceMeters ?? 0),
    durationMs: Number(durationMs ?? 0),
    startedAt: null,
    teamId: null,
    traveledPoints: query.data ?? [],
    referenceRoute: null,
    expectedMeters: null,
  };
}

function useRemoteAttemptDetail(competitionId, athleteUserId) {
  const { detail, loading: competitionLoading } = useCompetitionDetail(competitionId);
  const sessionInstanceId = detail?.sessionInstanceId ?? null;

  const runnerSessionQuery = useQuery({
    queryKey: ['attempt-detail-runner-session', sessionInstanceId, athleteUserId],
    queryFn: async () => {
      try {
        const res = await getRunnerSession(sessionInstanceId, athleteUserId);
        return toRunnerSessionModel(res?.data ?? null);
      } catch (error) {
        if (error.status === 404) return null;
        throw error;
      }
    },
    enabled: Boolean(sessionInstanceId && athleteUserId),
  });

  const feedbackQuery = useQuery({
    queryKey: ['attempt-detail-feedback', sessionInstanceId, athleteUserId],
    queryFn: async () => {
      const res = await getSessionFeedback(sessionInstanceId, athleteUserId);
      return toSessionFeedbackListModel(res?.data ?? res ?? []);
    },
    enabled: Boolean(sessionInstanceId && athleteUserId) && runnerSessionQuery.data !== undefined,
  });

  // `toSessionFeedbackListModel` agrupa por ejercicio -- un intento de ruta
  // tiene un solo ejercicio sintético ("Corrida"), así que la primera
  // entrada del primer grupo es la única fila real.
  const feedback = feedbackQuery.data?.[0]?.sets?.[0] ?? null;
  const flatFeedbackList = feedback ? [feedback] : [];

  const pointsQuery = useQuery({
    queryKey: ['attempt-detail-points', feedback?.id],
    queryFn: async () => {
      const res = await getWorkoutFeedbackPoints(feedback.id);
      const points = res?.data ?? res ?? [];
      return points.map((p) => ({ latitude: p.latitude, longitude: p.longitude }));
    },
    enabled: Boolean(feedback?.id) && (feedback?.pointsCount ?? 0) > 0,
  });

  const status = deriveAttemptStatus({ runnerSession: runnerSessionQuery.data, feedbackList: flatFeedbackList });
  const referenceRoute = detail?.route ?? null;
  const expectedMeters = referenceRoute
    ? totalRouteMeters((referenceRoute.coordinates ?? []).map(([lng, lat]) => ({ lat, lng })))
    : null;

  return {
    loading: competitionLoading || runnerSessionQuery.isLoading || feedbackQuery.isLoading,
    status,
    distanceMeters: feedback?.distanceMeters ?? null,
    durationMs: feedback?.durationMs ?? null,
    startedAt: feedback?.startedAt ?? feedback?.createdAt ?? null,
    teamId: feedback?.teamId ?? null,
    traveledPoints: pointsQuery.data ?? [],
    referenceRoute,
    expectedMeters,
  };
}

export function useAttemptDetail({ competitionId, athleteUserId, setId, distanceMeters, durationMs }) {
  const local = useLocalAttemptDetail(setId, { distanceMeters, durationMs });
  const remote = useRemoteAttemptDetail(competitionId, athleteUserId);
  return setId ? local : remote;
}
```

**Confirmed shape:** `toSessionFeedbackListModel` returns `[{ exerciseId, sets: [...] }]` (verified against `services/normalizers.js:904-916`) — the `feedback?.[0]?.sets?.[0]` access above is exact, not a guess.

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test -- use-attempt-detail-status`
Expected: PASS (all 4 cases).

- [ ] **Step 5: Run the full suite and lint, then commit**

Run: `npm test && npm run lint`
Expected: both green.

```bash
git add hooks/use-attempt-detail.js __tests__/use-attempt-detail-status.test.js
git commit -m "feat(competitions): useAttemptDetail hook, local SQLite + remote dual source"
```

---

### Task 3: `route-attempt-detail-screen.jsx` — rename, rewrite, move into the shell

**Files:**
- Create: `components/session-runtime/route-attempt-detail-screen.jsx` (content based on today's `route-attempt-result-screen.jsx`, substantially rewritten)
- Delete: `components/session-runtime/route-attempt-result-screen.jsx`
- Create: `app/(tabs)/route-attempt-detail.jsx`
- Delete: `app/route-attempt-result.jsx`

**Interfaces:**
- Consumes: `hooks/use-attempt-detail.js#useAttemptDetail` (Task 2), `hooks/use-teams.js#useTeam(teamId)` (existing), `utils/distance.js#formatMeters` (existing), `utils/time.js#formatStopwatch` (existing), `components/session-runtime/live-trajectory-map.jsx#LiveTrajectoryMap` (existing, unchanged), `components/guards/require-auth.jsx#RequireAuth` (existing).
- Produces: route `/route-attempt-detail`, accepting nav params `{ competitionId, athleteUserId, setId?, distanceMeters?, durationMs? }`. Task 4 and Task 5 both navigate here.

**Context:** read the spec's "Arquitectura > Pantalla (`RouteAttemptDetailScreen`)" section. No `MobileOnlyRoute` (this screen is cross-platform now) — keep `RequireAuth`. No own `SafeAreaView` — root is a plain `View`/`ScrollView`, the shell (via the new `(tabs)` location) provides safe-area/header/nav, same pattern as `components/session-runtime/session-review-screen.jsx`'s root (`<ScrollView className="flex-1 w-full self-center ${isWeb ? 'max-w-3xl' : ''}" ...>`).

- [ ] **Step 1: Read the current result screen in full**

Read `components/session-runtime/route-attempt-result-screen.jsx` end to end before writing the replacement — it's 111 lines, short enough to hold in context, and the new screen reuses most of its JSX structure (map wrap, stats row, match-calculating section) with the changes below layered on top.

- [ ] **Step 2: Write the new screen component**

Create `components/session-runtime/route-attempt-detail-screen.jsx`:

```jsx
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { RequireAuth } from '../guards/require-auth.jsx';
import { useThemeColors } from '../../theme/colors.js';
import { useAttemptDetail } from '../../hooks/use-attempt-detail.js';
import { useTeam } from '../../hooks/use-teams.js';
import { formatMeters } from '../../utils/distance.js';
import { formatStopwatch } from '../../utils/time.js';
import { isWeb } from '../../utils/platform.js';
import { LiveTrajectoryMap } from './live-trajectory-map';

const pad2 = (n) => String(n).padStart(2, '0');

// Timestamp completo DD/MM/AAAA HH:mm -- mismo patrón sin exportar que
// `formatDayTime` en session-review-screen.jsx, no hay un formatter
// exportado para esto (solo para fecha sola YYYY-MM-DD).
function formatAttemptDate(iso) {
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  return `${pad2(date.getDate())}/${pad2(date.getMonth() + 1)}/${date.getFullYear()} ${pad2(date.getHours())}:${pad2(date.getMinutes())}`;
}

function RouteAttemptDetailScreenContent() {
  const router = useRouter();
  const colors = useThemeColors();
  const params = useLocalSearchParams();
  const detail = useAttemptDetail({
    competitionId: params.competitionId,
    athleteUserId: params.athleteUserId,
    setId: params.setId,
    distanceMeters: params.distanceMeters,
    durationMs: params.durationMs,
  });
  const { team } = useTeam(detail.teamId);

  const justFinished = Boolean(params.setId);
  const attemptDate = formatAttemptDate(detail.startedAt);

  return (
    <ScrollView className={`flex-1 w-full self-center bg-paper dark:bg-ink ${isWeb ? 'max-w-3xl' : ''}`} contentContainerClassName="p-4" nativeID="route-attempt-detail-screen-scroll" testID="route-attempt-detail-screen-scroll">
      {justFinished ? (
        <View className="mb-3 flex-row items-center gap-2 rounded-xl bg-emerald-50 p-3 dark:bg-emerald-950/40" nativeID="route-attempt-detail-screen-banner" testID="route-attempt-detail-screen-banner">
          <MaterialCommunityIcons color={colors.primary} name="flag-checkered" size={20} />
          <Text className="flex-1 text-sm font-semibold text-emerald-700 dark:text-emerald-300" nativeID="route-attempt-detail-screen-banner-text" testID="route-attempt-detail-screen-banner-text">
            ¡Completaste tu intento!
          </Text>
        </View>
      ) : (
        <Text className="mb-3 text-center text-2xl font-bold text-slate-900 dark:text-white" nativeID="route-attempt-detail-screen-title" testID="route-attempt-detail-screen-title">
          Detalle de intento
        </Text>
      )}

      {detail.status === 'pending' && (
        <View className="items-center gap-2 py-8" nativeID="route-attempt-detail-screen-pending" testID="route-attempt-detail-screen-pending">
          <ActivityIndicator color={colors.primary} />
          <Text className="text-center text-sm text-amber-600 dark:text-amber-400" nativeID="route-attempt-detail-screen-pending-label" testID="route-attempt-detail-screen-pending-label">
            Este intento todavía no terminó o no se sincronizó.
          </Text>
        </View>
      )}

      {detail.status === 'not_found' && (
        <View className="items-center py-8" nativeID="route-attempt-detail-screen-not-found" testID="route-attempt-detail-screen-not-found">
          <Text className="text-center text-sm text-slate-500 dark:text-slate-400" nativeID="route-attempt-detail-screen-not-found-label" testID="route-attempt-detail-screen-not-found-label">
            Este participante no tiene un intento registrado en esta competencia.
          </Text>
        </View>
      )}

      {(detail.status === 'local' || detail.status === 'synced') && (
        <>
          <View className="h-96 w-full" nativeID="route-attempt-detail-screen-map-wrap" testID="route-attempt-detail-screen-map-wrap">
            <LiveTrajectoryMap referenceRoute={detail.referenceRoute} traveledPoints={detail.traveledPoints} />
          </View>

          <View className="mt-4 flex-row flex-wrap justify-around gap-3" nativeID="route-attempt-detail-screen-stats" testID="route-attempt-detail-screen-stats">
            <View nativeID="route-attempt-detail-screen-distance" testID="route-attempt-detail-screen-distance">
              <Text className="text-xs text-slate-500 dark:text-slate-400" nativeID="route-attempt-detail-screen-distance-label" testID="route-attempt-detail-screen-distance-label">Distancia</Text>
              <Text className="text-lg font-bold text-slate-900 dark:text-white" nativeID="route-attempt-detail-screen-distance-value" testID="route-attempt-detail-screen-distance-value">{formatMeters(detail.distanceMeters ?? 0)}</Text>
            </View>
            <View nativeID="route-attempt-detail-screen-duration" testID="route-attempt-detail-screen-duration">
              <Text className="text-xs text-slate-500 dark:text-slate-400" nativeID="route-attempt-detail-screen-duration-label" testID="route-attempt-detail-screen-duration-label">Tiempo</Text>
              <Text className="text-lg font-bold text-slate-900 dark:text-white" nativeID="route-attempt-detail-screen-duration-value" testID="route-attempt-detail-screen-duration-value">{formatStopwatch(detail.durationMs ?? 0)}</Text>
            </View>
            {detail.expectedMeters != null && (
              <View nativeID="route-attempt-detail-screen-expected" testID="route-attempt-detail-screen-expected">
                <Text className="text-xs text-slate-500 dark:text-slate-400" nativeID="route-attempt-detail-screen-expected-label" testID="route-attempt-detail-screen-expected-label">Distancia esperada</Text>
                <Text className="text-lg font-bold text-slate-900 dark:text-white" nativeID="route-attempt-detail-screen-expected-value" testID="route-attempt-detail-screen-expected-value">{formatMeters(detail.expectedMeters)}</Text>
              </View>
            )}
            {attemptDate && (
              <View nativeID="route-attempt-detail-screen-date" testID="route-attempt-detail-screen-date">
                <Text className="text-xs text-slate-500 dark:text-slate-400" nativeID="route-attempt-detail-screen-date-label" testID="route-attempt-detail-screen-date-label">Fecha</Text>
                <Text className="text-lg font-bold text-slate-900 dark:text-white" nativeID="route-attempt-detail-screen-date-value" testID="route-attempt-detail-screen-date-value">{attemptDate}</Text>
              </View>
            )}
            {team?.name && (
              <View nativeID="route-attempt-detail-screen-team" testID="route-attempt-detail-screen-team">
                <Text className="text-xs text-slate-500 dark:text-slate-400" nativeID="route-attempt-detail-screen-team-label" testID="route-attempt-detail-screen-team-label">Equipo</Text>
                <Text className="text-lg font-bold text-slate-900 dark:text-white" nativeID="route-attempt-detail-screen-team-value" testID="route-attempt-detail-screen-team-value">{team.name}</Text>
              </View>
            )}
          </View>
        </>
      )}

      {justFinished && (
        <Pressable className="mt-6 h-12 flex-row items-center justify-center gap-1.5 rounded-full bg-primary active:opacity-80" nativeID="route-attempt-detail-screen-close-button" onPress={() => router.replace('/')} testID="route-attempt-detail-screen-close-button">
          <MaterialCommunityIcons color={colors.onPrimary} name="check" size={18} />
          <Text className="text-sm font-semibold uppercase tracking-wide text-[#111518]" nativeID="route-attempt-detail-screen-close-label" testID="route-attempt-detail-screen-close-label">Listo</Text>
        </Pressable>
      )}
    </ScrollView>
  );
}

export function RouteAttemptDetailScreen() {
  return (
    <RequireAuth>
      <RouteAttemptDetailScreenContent />
    </RequireAuth>
  );
}
```

**Decision: this deliberately drops the old screen's `getCompetition`-polling-with-backoff block** (`POLL_ATTEMPTS`/`POLL_DELAY_MS`, the `!competition && !exhausted` spinner / `!competition && exhausted` "se está procesando" message). Checked the old file in full: that block never actually displayed anything FROM `competition` once it loaded — no match percentage or ranking value was ever rendered, only used as a loading gate for something that was never wired to a visible payoff. The new `status` field (`'pending'` for the remote path) already covers the real "still processing" case with an actual explanation shown to the user; the local `justFinished` path has its data on disk already (no network wait possible), so there was never anything to poll for there. Not a regression — it's dropping dead UI that showed a spinner for a result that never appeared.

- [ ] **Step 3: Delete the old screen file**

```bash
git rm components/session-runtime/route-attempt-result-screen.jsx
```

- [ ] **Step 4: Move the route file**

Create `app/(tabs)/route-attempt-detail.jsx`:

```jsx
import { RouteAttemptDetailScreen } from '../../components/session-runtime/route-attempt-detail-screen.jsx';

export default function RouteAttemptDetail() {
  return <RouteAttemptDetailScreen />;
}
```

```bash
git rm app/route-attempt-result.jsx
```

- [ ] **Step 5: Lint**

Run: `npx eslint components/session-runtime/route-attempt-detail-screen.jsx app/\(tabs\)/route-attempt-detail.jsx`
Expected: no errors (warnings only if pre-existing elsewhere, not introduced by this file).

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat(competitions): generic route-attempt-detail-screen, inside the shell

Reemplaza route-attempt-result-screen.jsx (mobile-only, solo
post-intento) -- mapa más grande, stats de fecha/equipo/distancia
esperada, banner condicional segun si viene de terminar un intento o
se abrio desde el ranking. Movido a app/(tabs)/ para heredar el shell
gratis, igual que training-session-review.jsx."
```

---

### Task 4: Repoint `route-attempt-live-screen.jsx`'s navigation to the new route

**Files:**
- Modify: `components/session-runtime/route-attempt-live-screen.jsx` (the `goToResult` function)

**Interfaces:**
- Consumes: the new route `/route-attempt-detail` (Task 3).
- Produces: nothing new — this is the one existing caller being repointed.

**Context:** today `goToResult` navigates to `pathname: '/route-attempt-result'`. Find the exact current code before editing — it was last touched in the spec's referenced earlier work and includes a `usePreventRemove` bypass mechanism that must stay intact; only the `pathname` string changes.

- [ ] **Step 1: Find and update the pathname**

In `components/session-runtime/route-attempt-live-screen.jsx`, locate the `goToResult` function (search for `pathname: '/route-attempt-result'`). Change only the pathname string:

```js
// change:
    pathname: '/route-attempt-result',
// to:
    pathname: '/route-attempt-detail',
```

Leave every other line in that function (the `params` object, the `pendingExitRef`/`bypassingExit` mechanism around it) exactly as-is.

- [ ] **Step 2: Lint and test**

Run: `npx eslint components/session-runtime/route-attempt-live-screen.jsx && npm test`
Expected: both green.

- [ ] **Step 3: Commit**

```bash
git add components/session-runtime/route-attempt-live-screen.jsx
git commit -m "fix(competitions): repoint goToResult at the renamed /route-attempt-detail route"
```

---

### Task 5: Make ranking rows tappable into the detail screen

**Files:**
- Modify: `components/team/competition-ranking-modal.jsx`

**Interfaces:**
- Consumes: the new route `/route-attempt-detail` (Task 3), `expo-router#useRouter`.
- Produces: nothing new — this is a UI-only change to an existing component.

**Context:** read the spec's "Arquitectura > `competition-ranking-modal.jsx`" section — the only change is making each row `Pressable`, navigating with `{ competitionId, athleteUserId }` (no `setId`, so the screen takes the remote branch). No change to the value column or the sort direction — `progress.value` is always `null` for route type in v1, and that `'—'` display is correct, not a bug.

- [ ] **Step 1: Read the current file**

Read `components/team/competition-ranking-modal.jsx` in full (it's ~70 lines) to get the exact current row JSX before editing.

- [ ] **Step 2: Add the router import and wrap each row in a `Pressable`**

Add to the top imports:

```js
import { useRouter } from 'expo-router';
```

Inside the component, add near the top (after `const colors = useThemeColors();`):

```js
const router = useRouter();
```

Change the row rendering from a plain `View` to a `Pressable` that navigates on press. The row currently looks like:

```jsx
<View className="flex-row items-center gap-3 rounded-xl bg-slate-50 px-3 py-2 dark:bg-slate-900" key={entry.userId} nativeID={`competition-ranking-modal-row-${entry.userId}`} testID={`competition-ranking-modal-row-${entry.userId}`}>
```

Change the outer tag to `Pressable` and add `onPress`, keeping every existing prop and all children unchanged:

```jsx
<Pressable
  className="flex-row items-center gap-3 rounded-xl bg-slate-50 px-3 py-2 active:opacity-70 dark:bg-slate-900"
  key={entry.userId}
  nativeID={`competition-ranking-modal-row-${entry.userId}`}
  onPress={() => {
    onClose();
    router.push({ pathname: '/route-attempt-detail', params: { competitionId: competition.id, athleteUserId: entry.userId } });
  }}
  testID={`competition-ranking-modal-row-${entry.userId}`}
>
```

(and the matching closing tag changes from `</View>` to `</Pressable>` for that row only — leave every other `View` in the file untouched). `onClose()` closes the ranking modal itself before navigating, so the user doesn't end up with the modal still mounted underneath the new screen.

- [ ] **Step 3: Lint**

Run: `npx eslint components/team/competition-ranking-modal.jsx`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add components/team/competition-ranking-modal.jsx
git commit -m "feat(competitions): ranking rows navigate to the attempt detail screen"
```

---

### Task 6: Final regression pass

**Files:** none (verification only)

**Interfaces:** none — this task verifies Tasks 1-5 together.

- [ ] **Step 1: Full lint and test**

Run: `npm run lint && npm test`
Expected: both fully green, zero new errors/warnings beyond the pre-existing `react-hooks/exhaustive-deps` warnings already present on this branch before this plan started.

- [ ] **Step 2: Manual verification against mocks (web preview)**

With `EXPO_PUBLIC_USE_MOCKS=true` (or whatever the repo's current mock-toggle mechanism is — check `config/env.js` if unsure), start the web preview and:
1. Open a team with a route competition (seed 7 or 8 in the mocks), open its ranking modal, confirm rows are tappable and each opens `/route-attempt-detail` with the right params in the URL.
2. For a participant with a completed+synced attempt, confirm the detail screen shows the map, distance/time/date/team/expected-distance stats, no banner (opened from ranking, not `setId`).
3. For a participant with no attempt yet, confirm the "not_found" message shows instead of an infinite spinner.
4. Confirm the screen renders inside the normal web shell (sidebar/header visible), not full-bleed.

- [ ] **Step 3: Note what's blocked pending the backend merge**

The full real-backend path (non-mock) can't be exercised end-to-end until Gap 35 merges to `develop` — the `GET /competitions/{id}` response won't actually carry `session_instance_id` from the real backend until then. This is expected and not a regression in this plan's work; flag it to the user rather than trying to work around it.

- [ ] **Step 4: Final commit if any fixes were needed during verification**

If Step 2 surfaced any bugs, fix them, re-run Step 1, and commit the fix with a message describing what broke and why — do not bundle an unrelated fix into Task 1-5's commits after the fact.
