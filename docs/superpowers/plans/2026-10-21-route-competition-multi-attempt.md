# Route Competition Multi-Attempt Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a route-type competition's creator set a `max_attempts` cap, let participants run the route up to that many times, rank each participant by their best attempt, and let anyone who can view the ranking also browse the full attempt history of any participant — all built and testable against mocks, with the real backend requirement written up as a new Gap entry for the teammate who maintains `paceron-backend`.

**Architecture:** One `session_instance` per attempt (not shared across all attempts of a competition) reuses the existing pre-start/live/sync/detail pipeline untouched. A pure comparator (`pickBestAttempt`) picks the winning attempt per athlete, reused by both the mock layer (to fake what the real backend will eventually compute) and `competition-ranking-modal.jsx` (to sort route-type rows). A new `AttemptsListModal` + `useCompetitionAttempts` hook expose the full history; `useAttemptDetail` gains an optional `sessionInstanceId` override so a specific (not necessarily "best") attempt can be opened from that modal.

**Tech Stack:** React Native + Expo Router, NativeWind, TanStack Query, Jest (pure-logic + mock-service tests only — no component render tests, per repo convention).

**Spec:** `docs/superpowers/specs/2026-10-21-route-competition-multi-attempt-design.md`

## Global Constraints

- **No backend Go code in this plan.** The real backend work (model field, `CreateAttempt` rule change, new endpoint, `progress` shape change) is documented as a new Gap entry for the teammate who maintains `paceron-backend` — this plan never edits anything under `../paceron-backend`.
- **Everything builds and is testable against mocks** (`EXPO_PUBLIC_USE_MOCKS=true`, the default) — no task may gate on a backend field/endpoint that doesn't exist yet.
- **`max_attempts` only applies to `type='route'`** — `null`/absent for `type='metric'`, same pattern as `acceptance_radius_meters`.
- **`canRun`'s existing conditions are additive, never replaced** — `remainingAttempts > 0` is one more `&&` clause alongside `!isTrainerView && type==='route' && status==='active' && participantUserIds.includes(currentUserId)`.
- **No component render tests** — verify new UI (`AttemptsListModal`, `competitions-tab.jsx` changes, `create-competition-modal.jsx` field) manually in the web preview against mocks, same as every other visual change in this repo.
- **IDs:** every new/modified visual component (`View`, `Pressable`, `Text`, `Modal`, etc.) needs `nativeID` + `testID`, kebab-case, scoped to its component (lint-enforced, `local/require-native-id`).
- **No cooldown between attempts, no editing `max_attempts` after creation** — explicitly out of scope per the spec.

---

### Task 1: `pickBestAttempt` pure comparator

**Files:**
- Modify: `utils/route-geometry.js`
- Test: `__tests__/route-geometry.test.js`

**Interfaces:**
- Produces: `pickBestAttempt(attempts: {complianceRatio: number|null, durationMs: number|null, [k: string]: any}[]): (typeof attempts[number] | null)` — highest `complianceRatio` wins, ties broken by lower `durationMs`; attempts with `complianceRatio == null` are ignored; returns `null` if no attempt has a usable `complianceRatio`. Any extra fields on each attempt object (e.g. `sessionInstanceId`) are returned untouched on the winner, so callers can read them off the result.

- [ ] **Step 1: Write the failing tests**

Add to the bottom of `__tests__/route-geometry.test.js` (after the existing `computeRouteComplianceRatio` describe block, same file, no new import needed beyond adding `pickBestAttempt` to the existing import line at the top):

```js
describe('pickBestAttempt', () => {
  test('returns null for an empty list', () => {
    expect(pickBestAttempt([])).toBeNull();
  });

  test('returns null when no attempt has a usable complianceRatio', () => {
    const attempts = [{ complianceRatio: null, durationMs: 100 }, { complianceRatio: null, durationMs: 50 }];
    expect(pickBestAttempt(attempts)).toBeNull();
  });

  test('higher complianceRatio wins', () => {
    const attempts = [
      { complianceRatio: 60, durationMs: 100000, label: 'a' },
      { complianceRatio: 95, durationMs: 200000, label: 'b' },
    ];
    expect(pickBestAttempt(attempts).label).toBe('b');
  });

  test('tie on complianceRatio -> lower durationMs wins', () => {
    const attempts = [
      { complianceRatio: 90, durationMs: 150000, label: 'slower' },
      { complianceRatio: 90, durationMs: 120000, label: 'faster' },
    ];
    expect(pickBestAttempt(attempts).label).toBe('faster');
  });

  test('ignores attempts without a usable complianceRatio, picks among the rest', () => {
    const attempts = [
      { complianceRatio: null, durationMs: 1000, label: 'unfinished' },
      { complianceRatio: 70, durationMs: 100000, label: 'finished' },
    ];
    expect(pickBestAttempt(attempts).label).toBe('finished');
  });
});
```

Update the top-of-file import to also pull in `pickBestAttempt`:

```js
import { computeRouteComplianceRatio, pickBestAttempt } from '../utils/route-geometry.js';
```

(Keep whatever other names that import line already pulls in — just add `pickBestAttempt` to the list.)

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx jest route-geometry -t pickBestAttempt`
Expected: FAIL with `pickBestAttempt is not a function` (or similar "not defined").

- [ ] **Step 3: Implement `pickBestAttempt`**

Add to the bottom of `utils/route-geometry.js`:

```js
// Elige, entre los intentos de UN atleta, cuál cuenta para el ranking --
// mismo comparador que ya ordena entre corredores distintos (% de
// cumplimiento desc, empate por menor duración). Usado por los mocks (el
// backend real todavía no calcula esto, ver Gap 36 en
// docs/BACKEND_API_GAPS.md) y por competition-ranking-modal.jsx para
// ordenar filas type='route'. Ignora intentos sin complianceRatio
// (todavía no terminaron/sincronizaron) -- null, no 0, es "no hay nada que
// comparar todavía", mismo criterio que computeRouteComplianceRatio.
export function pickBestAttempt(attempts) {
  const valid = (attempts ?? []).filter((a) => a.complianceRatio != null);
  if (valid.length === 0) return null;
  return valid.reduce((best, curr) => {
    if (curr.complianceRatio > best.complianceRatio) return curr;
    if (curr.complianceRatio < best.complianceRatio) return best;
    return (curr.durationMs ?? Infinity) < (best.durationMs ?? Infinity) ? curr : best;
  });
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx jest route-geometry`
Expected: PASS, all tests in the file (existing `computeRouteComplianceRatio` tests + the 5 new ones).

- [ ] **Step 5: Commit**

```bash
git add utils/route-geometry.js __tests__/route-geometry.test.js
git commit -m "feat(competitions): add pickBestAttempt comparator for multi-attempt ranking"
```

---

### Task 2: Backend Gap doc entry (Gap 36)

**Files:**
- Modify: `docs/BACKEND_API_GAPS.md`

**Interfaces:**
- Produces: nothing code-level — a written requirement a teammate reads later. No dependency for any other task in this plan.

- [ ] **Step 1: Add the new Gap section**

Insert a new section right after the end of Gap 35 (which ends right before the end of the file, or before whatever next top-level `## Gap` heading follows it — append at the end of the file if Gap 35 is currently the last one):

```markdown
## Gap 36 — competencias de ruta: intentos múltiples configurables (`max_attempts`)

**Pedido concreto.** Hoy una competencia `type='route'` admite un solo intento por
corredor (Gap 33 punto 28, `400` en el segundo). Se pide hacerlo configurable: el
creador de la competencia elige un `max_attempts` al crearla, y cada participante
puede correr la ruta hasta esa cantidad de veces. El ranking usa, para cada
corredor, el mejor de sus intentos propios (mayor % de cumplimiento de la
trayectoria, empate por menor duración).

**Arquitectura elegida (ver spec completa en
`docs/superpowers/specs/2026-10-21-route-competition-multi-attempt-design.md`):
un `session_instance` nuevo por cada intento, no uno compartido por toda la
competencia.** Hoy `CreateAttempt` (`competition_service.go`) reusa la única
`session_instance` sintética de la competencia (`comp.RouteSessionInstanceID`,
Gap 33 punto 26) para el primer y único intento permitido. Para intentos
adicionales del MISMO atleta, hace falta crear una `session_instance` nueva (la
compartida ya quedó "ocupada" por ese atleta en su primer intento, y el índice
único genérico de `runner_session` — `session_instance_id, athlete_user_id` —
rige TODAS las sesiones del sistema, no solo competencias, así que no se toca).
El primer intento de CUALQUIER atleta sigue reusando la instancia compartida
sin cambios — el comportamiento de hoy para "un solo intento" queda intacto.

**Campo nuevo en `Competition`:** `max_attempts: number`, solo para
`type='route'` (`null`/ausente para `type='metric'`). Pregunta abierta: ¿cuál es
el rango mínimo/máximo válido? El frontend valida client-side `[1, 10]` con
default 3 mientras no haya respuesta (mismo criterio que
`acceptance_radius_meters`, Gap 33 punto 31).

**`CreateAttempt` cambia de regla:** de "¿existe ya un intento de este atleta
contra esta competencia? → 400" a "`COUNT(runner_session WHERE competition_id=X
AND athlete_user_id=Y) >= max_attempts` → 400". El primer intento de un atleta
(count=0) sigue usando `comp.RouteSessionInstanceID`; el segundo en adelante
crea una `session_instance` nueva.

**Endpoint nuevo: `GET /competitions/{id}/attempts?athlete_user_id=X`**
(`athlete_user_id` opcional, default = caller) → lista de intentos de ESE
atleta contra esa competencia, mismo criterio de visibilidad que el ranking
(cualquiera que vea la competencia puede pedir los intentos de cualquier
participante, no solo los propios):

```json
[{
  "runner_session_id": 123,
  "session_instance_id": 9001,
  "status": "finished",
  "started_at": "2026-10-21T10:00:00Z",
  "finished_at": "2026-10-21T10:15:00Z",
  "distance_meters": 2850,
  "duration_ms": 900000,
  "compliance_ratio": 94.2
}]
```

**`progress` del detalle de competencia (`GET /competitions/{id}`) deja de ser
inútil para `type='route'`.** Hoy `progress: [{user_id, value}]` con `value`
siempre sin semántica real para ruta. Pasa a llevar, por atleta, el MEJOR
intento (mismo comparador de arriba): `{user_id, compliance_ratio, duration_ms,
session_instance_id}` en vez de `value` — el `session_instance_id` es el de ESE
mejor intento, imprescindible para que la navegación desde el ranking (que no
elige un intento específico) pueda seguir pidiendo
`GET /session-instances/:id/feedback` sin depender del endpoint de lista.

**Nice-to-have, no bloqueante:** exponer `attempts_used`/`remaining_attempts`
del caller en la fila de la competencia misma (listado o detalle), para que el
frontend no tenga que pedir el endpoint de lista completo solo para decidir si
mostrar el botón "Correr esta trayectoria". El frontend de esta ronda (ver
spec) resuelve esto pidiendo el endpoint de lista igual, filtrado al usuario
actual — funciona sin este campo, pero es más barato con él si en algún
momento se agrega.

**Impacto en frontend:** bloquea la versión real (no-mock) de todo el flujo de
intentos múltiples — mismo patrón que Gap 18/35, el frontend ya está
construido y probado contra mocks (branch `feature/route-competitions-polish`,
ver el plan de implementación en
`docs/superpowers/plans/2026-10-21-route-competition-multi-attempt.md`) y
solo falta el flip a datos reales cuando esto se mergee.
```

- [ ] **Step 2: Commit**

```bash
git add docs/BACKEND_API_GAPS.md
git commit -m "docs(backend-gaps): document Gap 36, configurable multi-attempt route competitions"
```

---

### Task 3: Mock seed data — a second finished attempt + a raw lister export

**Files:**
- Modify: `services/__mocks__/runner-session-mock.js`
- Modify: `services/__mocks__/workoutFeedback-mock.js`

**Interfaces:**
- Produces: `__listRunnerSessionsByCompetitionAndAthlete(competitionId, athleteUserId): {id, session_instance_id, athlete_user_id, status, start_date, end_date, competition_id}[]` (raw rows, exported from `runner-session-mock.js`) — consumed by Task 4's `mockGetCompetitionAttempts`/`computeRouteProgress`.
- Consumes: nothing new from earlier tasks (this task only adds seed data + one export, independent of Task 1/2).

**Context:** `runner-session-mock.js` already seeds ONE finished attempt (`id: 9000, session_instance_id: 9000, athlete_user_id: 101, competition_id: 7`) matching `workoutFeedback-mock.js`'s seeded `feedbacks` row `id: 9000` (287m, 107000ms, 5 GPS points tracing competition seed 7's route almost exactly — near-100% compliance). This task adds a SECOND, worse attempt for the same athlete/competition pair, with points that drift noticeably off the route for part of the way, so `pickBestAttempt` (Task 1) has two real, distinguishable candidates to choose between in Task 4's tests.

- [ ] **Step 1: Add the raw lister export to `runner-session-mock.js`**

Add this function right after `__countFinishedRunnerSessionsByCompetition` (around line 58 of the current file):

```js
// Lista CRUDA (sin joins) de las filas de runner_session de UN atleta contra
// UNA competencia -- base de GET /competitions/{id}/attempts (Gap 36,
// intentos múltiples). A diferencia de __countFinishedRunnerSessionsByCompetition
// (que solo cuenta 'finished'), esto devuelve TODAS las filas sin filtrar por
// status -- el caller (competitions-mock.js) decide qué hacer con cada una.
export function __listRunnerSessionsByCompetitionAndAthlete(competitionId, athleteUserId) {
  return runnerSessions.filter(
    (r) => r.competition_id === Number(competitionId) && r.athlete_user_id === Number(athleteUserId),
  );
}
```

- [ ] **Step 2: Add the second seeded `runner_session` row**

Replace this block (around line 29-38 of the current file):

```js
runnerSessions.push({
  id: 9000,
  session_instance_id: 9000,
  athlete_user_id: 101,
  status: 'finished',
  start_date: '2026-10-18T14:02:00Z',
  end_date: '2026-10-18T14:03:47Z',
  competition_id: 7,
});
nextRunnerSessionId = 9001;
```

with:

```js
runnerSessions.push({
  id: 9000,
  session_instance_id: 9000,
  athlete_user_id: 101,
  status: 'finished',
  start_date: '2026-10-18T14:02:00Z',
  end_date: '2026-10-18T14:03:47Z',
  competition_id: 7,
});
// Segundo intento de la MISMA atleta contra la MISMA competencia -- pedido
// real 2026-10-21 (Gap 36, intentos múltiples configurables): necesita
// existir un atleta con MÁS de un intento contra la misma competencia para
// poder probar pickBestAttempt/AttemptsListModal contra datos reales, no
// solo tests unitarios aislados. session_instance_id 9010, no 9001 -- el
// rango 9001+ lo usa nextSyntheticInstanceId de competitions-mock.js para
// instancias creadas EN RUNTIME (nueva competencia, o segundo+ intento real
// vía mockCreateCompetitionAttempt); un id fijo en el bloque "reservado para
// seeds" (9000 = seed 7 intento 1, 9100 = seed 8) evita cualquier colisión
// futura. Peor que el intento 9000 a propósito (ver el feedback/puntos
// correspondientes en workoutFeedback-mock.js) -- así pickBestAttempt tiene
// un ganador real y verificable, no dos intentos empatados por accidente.
runnerSessions.push({
  id: 9001,
  session_instance_id: 9010,
  athlete_user_id: 101,
  status: 'finished',
  start_date: '2026-10-19T09:00:00Z',
  end_date: '2026-10-19T09:03:05Z',
  competition_id: 7,
});
nextRunnerSessionId = 9002;
```

- [ ] **Step 3: Add the matching seeded `workout_feedback` row + points in `workoutFeedback-mock.js`**

Replace this block (around line 26-52 of the current file):

```js
feedbacks.push({
  id: 9000,
  assigned_session_id: 9000,
  assigned_exercise_id: 90000,
  athlete_user_id: 101,
  team_id: 5,
  exercise_name: 'Corrida',
  set_number: 1,
  completion_status: 'completed',
  started_at: '2026-10-18T14:02:00Z',
  ended_at: '2026-10-18T14:03:47Z',
  duration_ms: 107000,
  active_duration_ms: 107000,
  distance_meters: 287,
  report_source: 'corredor',
  annotations: null,
  created_at: '2026-10-18T14:03:50Z',
  updated_at: '2026-10-18T14:03:50Z',
});
pointsByFeedback.set(9000, [
  { order: 0, session_instance_id: 9000, exercise_instance_id: 90000, latitude: -34.660, longitude: -58.365, recorded_at: '2026-10-18T14:02:00Z' },
  { order: 1, session_instance_id: 9000, exercise_instance_id: 90000, latitude: -34.660, longitude: -58.3645, recorded_at: '2026-10-18T14:02:30Z' },
  { order: 2, session_instance_id: 9000, exercise_instance_id: 90000, latitude: -34.6605, longitude: -58.364, recorded_at: '2026-10-18T14:03:00Z' },
  { order: 3, session_instance_id: 9000, exercise_instance_id: 90000, latitude: -34.661, longitude: -58.364, recorded_at: '2026-10-18T14:03:25Z' },
  { order: 4, session_instance_id: 9000, exercise_instance_id: 90000, latitude: -34.661, longitude: -58.365, recorded_at: '2026-10-18T14:03:47Z' },
]);
nextFeedbackId = 9001;
```

with:

```js
feedbacks.push({
  id: 9000,
  assigned_session_id: 9000,
  assigned_exercise_id: 90000,
  athlete_user_id: 101,
  team_id: 5,
  exercise_name: 'Corrida',
  set_number: 1,
  completion_status: 'completed',
  started_at: '2026-10-18T14:02:00Z',
  ended_at: '2026-10-18T14:03:47Z',
  duration_ms: 107000,
  active_duration_ms: 107000,
  distance_meters: 287,
  report_source: 'corredor',
  annotations: null,
  created_at: '2026-10-18T14:03:50Z',
  updated_at: '2026-10-18T14:03:50Z',
});
pointsByFeedback.set(9000, [
  { order: 0, session_instance_id: 9000, exercise_instance_id: 90000, latitude: -34.660, longitude: -58.365, recorded_at: '2026-10-18T14:02:00Z' },
  { order: 1, session_instance_id: 9000, exercise_instance_id: 90000, latitude: -34.660, longitude: -58.3645, recorded_at: '2026-10-18T14:02:30Z' },
  { order: 2, session_instance_id: 9000, exercise_instance_id: 90000, latitude: -34.6605, longitude: -58.364, recorded_at: '2026-10-18T14:03:00Z' },
  { order: 3, session_instance_id: 9000, exercise_instance_id: 90000, latitude: -34.661, longitude: -58.364, recorded_at: '2026-10-18T14:03:25Z' },
  { order: 4, session_instance_id: 9000, exercise_instance_id: 90000, latitude: -34.661, longitude: -58.365, recorded_at: '2026-10-18T14:03:47Z' },
]);
// Segundo intento (Gap 36) -- mismo athlete_user_id/team_id, apuntando a la
// session_instance NUEVA (9010, ver runner-session-mock.js). assigned_exercise_id
// = 90100 = 9010*10, mismo criterio que mockCreateCompetitionAttempt
// (session_instance_id * 10) para el ejercicio sintético. Deliberadamente
// PEOR que el intento 9000: más lento (185000ms vs 107000ms) y con 2 de los
// 5 puntos desviados ~150-200m del trazado de la seed 7
// (acceptance_radius_meters: 50), así que su % de cumplimiento queda
// claramente por debajo del ~100% del intento 9000 -- pickBestAttempt tiene
// que elegir 9000, no un empate.
feedbacks.push({
  id: 9001,
  assigned_session_id: 9010,
  assigned_exercise_id: 90100,
  athlete_user_id: 101,
  team_id: 5,
  exercise_name: 'Corrida',
  set_number: 1,
  completion_status: 'completed',
  started_at: '2026-10-19T09:00:00Z',
  ended_at: '2026-10-19T09:03:05Z',
  duration_ms: 185000,
  active_duration_ms: 185000,
  distance_meters: 310,
  report_source: 'corredor',
  annotations: null,
  created_at: '2026-10-19T09:03:10Z',
  updated_at: '2026-10-19T09:03:10Z',
});
pointsByFeedback.set(9001, [
  { order: 0, session_instance_id: 9010, exercise_instance_id: 90100, latitude: -34.660, longitude: -58.365, recorded_at: '2026-10-19T09:00:00Z' },
  { order: 1, session_instance_id: 9010, exercise_instance_id: 90100, latitude: -34.6585, longitude: -58.3625, recorded_at: '2026-10-19T09:00:50Z' },
  { order: 2, session_instance_id: 9010, exercise_instance_id: 90100, latitude: -34.6625, longitude: -58.3625, recorded_at: '2026-10-19T09:01:45Z' },
  { order: 3, session_instance_id: 9010, exercise_instance_id: 90100, latitude: -34.661, longitude: -58.364, recorded_at: '2026-10-19T09:02:30Z' },
  { order: 4, session_instance_id: 9010, exercise_instance_id: 90100, latitude: -34.661, longitude: -58.365, recorded_at: '2026-10-19T09:03:05Z' },
]);
nextFeedbackId = 9002;
```

- [ ] **Step 4: Run the full test suite to confirm nothing broke**

Run: `npm test`
Expected: all existing suites still pass (this task only adds data, doesn't change any existing function's signature or behavior) — in particular `__tests__/runner-session-mock.test.js` and `__tests__/workout-feedback*.test.js` (if any) should be unaffected, since both seed rows live outside the `__reset*` functions (same as the original 9000 seed already did).

- [ ] **Step 5: Commit**

```bash
git add services/__mocks__/runner-session-mock.js services/__mocks__/workoutFeedback-mock.js
git commit -m "feat(competitions): seed a second, worse route-competition attempt for mock testing"
```

---

### Task 4: `competitions-mock.js` — attempt cap/mint, attempts-list, route progress

**Files:**
- Modify: `services/__mocks__/competitions-mock.js`
- Modify: `__tests__/competitions-mock.test.js`

**Interfaces:**
- Consumes: `pickBestAttempt` from `utils/route-geometry.js` (Task 1); `computeRouteComplianceRatio` from the same file (already existed before this plan); `__listRunnerSessionsByCompetitionAndAthlete` from `services/__mocks__/runner-session-mock.js` (Task 3); `__getMockFeedbacks`, `__getMockPoints` from `services/__mocks__/workoutFeedback-mock.js` (already exported before this plan).
- Produces: `mockGetCompetitionAttempts(competitionId, athleteUserId): Promise<{data: {runner_session_id, session_instance_id, status, started_at, finished_at, distance_meters, duration_ms, compliance_ratio}[]}>` — consumed by Task 6's `services/competitions.js#getCompetitionAttempts`. `mockCreateCompetitionAttempt`'s cap-check now uses `competition.max_attempts` instead of a boolean exists-check (signature unchanged). `mockGetCompetition`'s `progress` entries for `type='route'` now carry `compliance_ratio`/`duration_ms`/`session_instance_id` (previously always `null`/absent) — consumed by Task 5's normalizer change.

**Context — read before writing code:** `mockCreateCompetitionAttempt` currently uses a `Set` (`mockAttempts`) keyed by `"${competitionId}:${athleteUserId}"` to block any second attempt outright. This task replaces it with a `Map` counting attempts per key, checked against `competition.max_attempts` (default `1` when absent, so every existing single-attempt competition behaves identically to today). The competition's PRE-EXISTING `session_instance_id` (set at creation, Gap 33 punto 26) keeps being reused for each athlete's FIRST attempt — only the SECOND and later attempts of the SAME athlete mint a fresh one via `nextSyntheticInstanceId++`. This is why the existing test `'user_id 1 puede correr un intento contra la seed 7...'` (a first attempt) must keep returning `session_instance_id: 9000` unchanged.

- [ ] **Step 1: Write the failing tests**

Add these new `describe` blocks to the bottom of `__tests__/competitions-mock.test.js` (keep all existing tests in the file as-is for now — Step 1 only ADDS new tests; two existing tests get fixed in Step 5 below once the new behavior lands):

```js
describe('mockCreateCompetitionAttempt -- max_attempts', () => {
  beforeEach(() => {
    __resetMockCompetitions();
  });

  test('con max_attempts=2, el primer intento reusa la instancia de la competencia', async () => {
    const competition = await mockCreateCompetition(1, {
      type: 'route', route: { type: 'LineString', coordinates: [[-58.4, -34.6], [-58.41, -34.61]] },
      acceptance_radius_meters: 50, max_attempts: 2, participant_user_ids: [2, 3],
    }, { isTrainerCreator: true });
    const attempt = await mockCreateCompetitionAttempt(competition.id, 2);
    expect(attempt.session_instance_id).toBe(competition.session_instance_id);
  });

  test('con max_attempts=2, el segundo intento del mismo atleta mintea una instancia nueva', async () => {
    const competition = await mockCreateCompetition(1, {
      type: 'route', route: { type: 'LineString', coordinates: [[-58.4, -34.6], [-58.41, -34.61]] },
      acceptance_radius_meters: 50, max_attempts: 2, participant_user_ids: [2, 3],
    }, { isTrainerCreator: true });
    const first = await mockCreateCompetitionAttempt(competition.id, 2);
    const second = await mockCreateCompetitionAttempt(competition.id, 2);
    expect(second.session_instance_id).not.toBe(first.session_instance_id);
  });

  test('con max_attempts=2, el tercer intento del mismo atleta -> error', async () => {
    const competition = await mockCreateCompetition(1, {
      type: 'route', route: { type: 'LineString', coordinates: [[-58.4, -34.6], [-58.41, -34.61]] },
      acceptance_radius_meters: 50, max_attempts: 2, participant_user_ids: [2, 3],
    }, { isTrainerCreator: true });
    await mockCreateCompetitionAttempt(competition.id, 2);
    await mockCreateCompetitionAttempt(competition.id, 2);
    await expect(mockCreateCompetitionAttempt(competition.id, 2)).rejects.toThrow('máximo de intentos');
  });

  test('sin max_attempts en el payload -> default 1, mismo comportamiento que antes', async () => {
    const competition = await mockCreateCompetition(1, {
      type: 'route', route: { type: 'LineString', coordinates: [[-58.4, -34.6], [-58.41, -34.61]] },
      acceptance_radius_meters: 50, participant_user_ids: [2, 3],
    }, { isTrainerCreator: true });
    expect(competition.max_attempts).toBe(1);
  });
});

describe('mockGetCompetitionAttempts', () => {
  beforeEach(() => {
    __resetMockCompetitions();
  });

  test('devuelve los 2 intentos seed de la atleta 101 contra la competencia 7, con compliance_ratio distinto', async () => {
    const { data } = await mockGetCompetitionAttempts(7, 101);
    expect(data).toHaveLength(2);
    const bySessionInstance = Object.fromEntries(data.map((a) => [a.session_instance_id, a]));
    expect(bySessionInstance[9000].compliance_ratio).toBeGreaterThan(bySessionInstance[9010].compliance_ratio);
    expect(bySessionInstance[9000].duration_ms).toBe(107000);
    expect(bySessionInstance[9010].duration_ms).toBe(185000);
  });

  test('atleta sin intentos -> lista vacía, no error', async () => {
    const { data } = await mockGetCompetitionAttempts(7, 102);
    expect(data).toEqual([]);
  });
});

describe('mockGetCompetition -- progress de type=route (Gap 36)', () => {
  beforeEach(() => {
    __resetMockCompetitions();
  });

  test('el mejor intento de la atleta 101 contra la seed 7 aparece en progress', async () => {
    const { data } = await mockGetCompetition(7);
    const own = data.progress.find((p) => p.user_id === 101);
    expect(own.session_instance_id).toBe(9000);
    expect(own.compliance_ratio).toBeGreaterThan(0);
    expect(own.duration_ms).toBe(107000);
  });

  test('un participante sin intentos tiene compliance_ratio/duration_ms/session_instance_id null', async () => {
    const { data } = await mockGetCompetition(7);
    const noAttempts = data.progress.find((p) => p.user_id === 102);
    expect(noAttempts.compliance_ratio).toBeNull();
    expect(noAttempts.duration_ms).toBeNull();
    expect(noAttempts.session_instance_id).toBeNull();
  });
});
```

Add `mockGetCompetitionAttempts` to the top-of-file import list:

```js
import {
  mockListCompetitions,
  mockCreateCompetition,
  mockApproveCompetition,
  mockRejectCompetition,
  mockCancelCompetition,
  mockCloseCompetition,
  mockCreateCompetitionAttempt,
  mockGetCompetition,
  mockGetCompetitionAttempts,
  mockSeedDynamicRouteCompetitionStart,
  __resetMockCompetitions,
} from '../services/__mocks__/competitions-mock.js';
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx jest competitions-mock`
Expected: FAIL — `mockGetCompetitionAttempts is not a function`, and the `max_attempts` tests fail because `mockCreateCompetition` doesn't read `payload.max_attempts` yet.

- [ ] **Step 3: Rewrite `mockCreateCompetition`'s `max_attempts` field**

In `services/__mocks__/competitions-mock.js`, find `mockCreateCompetition` and change:

```js
    // Instancia sintética (Gap 33 punto 26) -- una sola por competencia,
    // compartida por todos los participantes, generada al crear.
    session_instance_id: payload.type === 'route' ? nextSyntheticInstanceId++ : null,
  };
```

to:

```js
    // Instancia sintética (Gap 33 punto 26) -- una sola por competencia al
    // crearla; reusada por el PRIMER intento de cada atleta (Gap 36, ver
    // mockCreateCompetitionAttempt más abajo).
    session_instance_id: payload.type === 'route' ? nextSyntheticInstanceId++ : null,
    // max_attempts (Gap 36) -- solo type='route'; default 1 cuando no viene
    // en el payload, mismo comportamiento que antes de este gap.
    max_attempts: payload.type === 'route' ? (payload.max_attempts ?? 1) : null,
  };
```

- [ ] **Step 4: Add `max_attempts` to every SEED row**

In the `SEED` array, add `max_attempts: null` to seeds 1-6 (`type='metric'`) and `max_attempts: 3` to seed 7, `max_attempts: 1` to seed 8. For example, seed 1 goes from:

```js
  { id: 1, team_id: 1, group_id: null, type: 'metric', metric: 'distance', start_at: '2026-10-01', end_at: '2026-10-07', route: null, acceptance_radius_meters: null, participant_user_ids: [2, 3], created_by_user_id: 1, created_by_role: 'trainer', status: 'active', approved_by_user_id: null, rejection_reason: null, winner_user_ids: [], finished_at: null },
```

to:

```js
  { id: 1, team_id: 1, group_id: null, type: 'metric', metric: 'distance', start_at: '2026-10-01', end_at: '2026-10-07', route: null, acceptance_radius_meters: null, max_attempts: null, participant_user_ids: [2, 3], created_by_user_id: 1, created_by_role: 'trainer', status: 'active', approved_by_user_id: null, rejection_reason: null, winner_user_ids: [], finished_at: null },
```

Apply the same `max_attempts: null,` insertion (right after `acceptance_radius_meters: null,`) to seeds 2, 3, 4, 5, 6. For seed 7, add `max_attempts: 3,` right after its `acceptance_radius_meters: 50,` line (3, not 1 — this seed already has 2 hand-seeded finished attempts from Task 3, so `max_attempts: 3` leaves exactly 1 remaining, enough to demo both "has history" and "can still run" at once). For seed 8, add `max_attempts: 1,` right after its `acceptance_radius_meters: 75,` line (keep this one's existing single-attempt GPS-gate demo behavior untouched).

- [ ] **Step 5: Rewrite the attempt-tracking state and `mockCreateCompetitionAttempt`**

Replace:

```js
// (competition_id, athlete_user_id) ya intentados -- Gap 33 punto 28, sin
// reintentos en v1.
const mockAttempts = new Set();
```

with:

```js
// Cantidad de intentos ya hechos por (competition_id, athlete_user_id) --
// Gap 36, reemplaza el Set booleano de "ya intentó sí/no" de la v1
// sin-reintentos (Gap 33 punto 28). Clave igual que antes
// (`${competitionId}:${athleteUserId}`), valor = cantidad de intentos.
const attemptCounts = new Map();
```

Replace, in `resetSeed()`:

```js
  mockAttempts.clear();
  // user_id 101 (Lucía Fernández, participante de la seed 7, NO el user_id 1
  // de pruebas -- ese slot lo necesita libre el test existente "user_id 1
  // puede correr un intento contra la seed 7") ya corrió la seed 7 -- ver
  // seed de runner-session-mock.js/workoutFeedback-mock.js para el
  // runner_session finished + feedback + puntos correspondientes. Sin
  // esto, "Correr esta trayectoria" seguiría ofreciéndose para un
  // intento que ya tiene resultado (contradice "sin reintentos v1").
  mockAttempts.add('7:101');
  dynamicRouteSeeded = false;
```

with:

```js
  attemptCounts.clear();
  // user_id 101 (Lucía Fernández, participante de la seed 7, NO el user_id 1
  // de pruebas -- ese slot lo necesita libre el test existente "user_id 1
  // puede correr un intento contra la seed 7") ya corrió la seed 7 DOS veces
  // -- ver los 2 runner_session finished + feedback + puntos de
  // runner-session-mock.js/workoutFeedback-mock.js (Gap 36, Task 3 de este
  // plan). Sin esto, "Correr esta trayectoria" seguiría ofreciéndose como si
  // tuviera 3 intentos libres en vez de 1 (max_attempts: 3, ver SEED).
  attemptCounts.set('7:101', 2);
  dynamicRouteSeeded = false;
```

Replace `mockCreateCompetitionAttempt` entirely:

```js
// POST /competitions/{id}/attempts (Gap 33 punto 26) -- valida active +
// participante + sin intento previo, devuelve la instancia sintética.
export async function mockCreateCompetitionAttempt(competitionId, athleteUserId) {
  const competition = mockCompetitions.find((c) => c.id === Number(competitionId));
  if (!competition) throw new Error('Competencia no encontrada');
  if (competition.status !== 'active') throw new Error('La competencia no está activa');
  if (!competition.participant_user_ids.includes(Number(athleteUserId))) throw new Error('No participás de esta competencia');
  const key = `${competitionId}:${athleteUserId}`;
  if (mockAttempts.has(key)) throw new Error('Ya tenés un intento registrado para esta competencia');
  mockAttempts.add(key);
  return {
    session_instance_id: competition.session_instance_id,
    session_instance: {
      id: competition.session_instance_id,
      name: 'Corrida',
      exercises: [{ id: competition.session_instance_id * 10, name: 'Corrida', role: 'main', repeat_count: 1, rest_minutes: 0 }],
    },
  };
}
```

with:

```js
// POST /competitions/{id}/attempts (Gap 33 punto 26, Gap 36) -- valida
// active + participante + cupo contra max_attempts, devuelve la instancia
// sintética. El PRIMER intento de un atleta (attemptsSoFar === 0) reusa la
// instancia de la competencia (comportamiento sin cambios desde Gap 33); el
// segundo en adelante mintea una instancia nueva -- esa misma instancia
// compartida ya está "ocupada" por este atleta, y el índice único real del
// backend es (session_instance_id, athlete_user_id), así que una segunda
// fila con el mismo par rompería esa unicidad.
export async function mockCreateCompetitionAttempt(competitionId, athleteUserId) {
  const competition = mockCompetitions.find((c) => c.id === Number(competitionId));
  if (!competition) throw new Error('Competencia no encontrada');
  if (competition.status !== 'active') throw new Error('La competencia no está activa');
  if (!competition.participant_user_ids.includes(Number(athleteUserId))) throw new Error('No participás de esta competencia');
  const key = `${competitionId}:${athleteUserId}`;
  const attemptsSoFar = attemptCounts.get(key) ?? 0;
  const maxAttempts = competition.max_attempts ?? 1;
  if (attemptsSoFar >= maxAttempts) throw new Error('Ya alcanzaste el máximo de intentos para esta competencia');
  const sessionInstanceId = attemptsSoFar === 0 ? competition.session_instance_id : nextSyntheticInstanceId++;
  attemptCounts.set(key, attemptsSoFar + 1);
  return {
    session_instance_id: sessionInstanceId,
    session_instance: {
      id: sessionInstanceId,
      name: 'Corrida',
      exercises: [{ id: sessionInstanceId * 10, name: 'Corrida', role: 'main', repeat_count: 1, rest_minutes: 0 }],
    },
  };
}
```

- [ ] **Step 6: Add `buildAttemptSummaries`, `mockGetCompetitionAttempts`, and `computeRouteProgress`**

Add the new imports at the top of the file:

```js
import { __countFinishedRunnerSessionsByCompetition, __listRunnerSessionsByCompetitionAndAthlete } from './runner-session-mock.js';
import { __getMockFeedbacks, __getMockPoints } from './workoutFeedback-mock.js';
import { computeRouteComplianceRatio, pickBestAttempt } from '../../utils/route-geometry.js';
import { addDaysISO } from '../../utils/build-stamp-draft.js';
```

(This replaces the existing single-line `import { __countFinishedRunnerSessionsByCompetition } from './runner-session-mock.js';` and adds 2 new import lines; the `addDaysISO` import line already existed, keep it as the last line of the import block.)

Add these functions right before `mockGetCompetition` (which already exists near the bottom of the file):

```js
// Intentos de UN atleta contra UNA competencia de ruta, con compliance_ratio
// calculado contra la ruta/radio de esa competencia -- base común de
// mockGetCompetitionAttempts (Gap 36, endpoint nuevo) y computeRouteProgress
// (progress de mockGetCompetition para type='route', más abajo).
function buildAttemptSummaries(competition, athleteUserId) {
  const rows = __listRunnerSessionsByCompetitionAndAthlete(competition.id, athleteUserId);
  return rows.map((row) => {
    const feedback = __getMockFeedbacks().find(
      (f) => f.assigned_session_id === row.session_instance_id && f.athlete_user_id === Number(athleteUserId),
    );
    const points = feedback ? __getMockPoints(feedback.id) : [];
    const traveledPoints = points.map((p) => ({ latitude: p.latitude, longitude: p.longitude }));
    const complianceRatio = competition.route
      ? computeRouteComplianceRatio(traveledPoints, competition.route.coordinates, competition.acceptance_radius_meters)
      : null;
    return {
      runner_session_id: row.id,
      session_instance_id: row.session_instance_id,
      status: row.status,
      started_at: row.start_date,
      finished_at: row.end_date,
      distance_meters: feedback?.distance_meters ?? null,
      duration_ms: feedback?.duration_ms ?? null,
      compliance_ratio: complianceRatio,
    };
  });
}

// GET /competitions/{id}/attempts?athlete_user_id=X (Gap 36, endpoint nuevo).
export async function mockGetCompetitionAttempts(competitionId, athleteUserId) {
  const competition = mockCompetitions.find((c) => c.id === Number(competitionId));
  if (!competition) throw new Error('Competencia no encontrada');
  return { data: buildAttemptSummaries(competition, athleteUserId) };
}

// Mejor intento de UN atleta (Gap 36) -- mismo comparador que ordena entre
// corredores distintos, aplicado primero adentro de los intentos propios.
// Solo cuenta intentos 'finished' -- uno 'wip' todavía no tiene feedback real
// que comparar. null en los 3 campos si el atleta no tiene ningún intento
// terminado -- no un 0%/duración inventada.
function computeRouteProgress(competition, userId) {
  const attempts = buildAttemptSummaries(competition, userId)
    .filter((a) => a.status === 'finished')
    .map((a) => ({ complianceRatio: a.compliance_ratio, durationMs: a.duration_ms, sessionInstanceId: a.session_instance_id }));
  const best = pickBestAttempt(attempts);
  return {
    compliance_ratio: best?.complianceRatio ?? null,
    duration_ms: best?.durationMs ?? null,
    session_instance_id: best?.sessionInstanceId ?? null,
  };
}
```

- [ ] **Step 7: Wire `computeRouteProgress` into `mockGetCompetition`**

Change:

```js
// GET /competitions/{id} (detalle, Gap 33 punto 23) -- `progress` siempre
// `[{user_id, value}]`, `value` null para type='route' en v1.
export async function mockGetCompetition(id) {
  const competition = mockCompetitions.find((c) => c.id === Number(id));
  if (!competition) throw new Error('Competencia no encontrada');
  const progress = competition.participant_user_ids.map((userId) => ({
    user_id: userId,
    value: computeProgressValue(competition, userId),
  }));
  return { data: { ...competition, progress } };
}
```

to:

```js
// GET /competitions/{id} (detalle, Gap 33 punto 23, Gap 36) -- `progress`
// siempre `[{user_id, value}]` para type='metric'; para type='route' suma
// compliance_ratio/duration_ms/session_instance_id del MEJOR intento de ese
// atleta (Gap 36) en vez del `value` siempre-null de antes.
export async function mockGetCompetition(id) {
  const competition = mockCompetitions.find((c) => c.id === Number(id));
  if (!competition) throw new Error('Competencia no encontrada');
  const progress = competition.participant_user_ids.map((userId) => {
    if (competition.type === 'route') {
      return { user_id: userId, value: null, ...computeRouteProgress(competition, userId) };
    }
    return { user_id: userId, value: computeProgressValue(competition, userId) };
  });
  return { data: { ...competition, progress } };
}
```

- [ ] **Step 8: Run the tests to verify they pass**

Run: `npx jest competitions-mock`
Expected: most tests pass; the pre-existing `'segundo intento del mismo atleta -> error'` test (asserting the OLD error text `'Ya tenés un intento'`) now FAILS, because the error message legitimately changed in Step 5 — this is expected, fixed in the next step.

- [ ] **Step 9: Fix the one pre-existing test whose expectation is now outdated**

In `__tests__/competitions-mock.test.js`, change:

```js
  test('segundo intento del mismo atleta -> error', async () => {
    const competition = await mockCreateCompetition(1, {
      type: 'route', route: { type: 'LineString', coordinates: [[-58.4, -34.6], [-58.41, -34.61]] },
      acceptance_radius_meters: 50, participant_user_ids: [2, 3],
    }, { isTrainerCreator: true });
    await mockCreateCompetitionAttempt(competition.id, 2);
    await expect(mockCreateCompetitionAttempt(competition.id, 2)).rejects.toThrow('Ya tenés un intento');
  });
```

to:

```js
  test('segundo intento del mismo atleta sin max_attempts (default 1) -> error', async () => {
    const competition = await mockCreateCompetition(1, {
      type: 'route', route: { type: 'LineString', coordinates: [[-58.4, -34.6], [-58.41, -34.61]] },
      acceptance_radius_meters: 50, participant_user_ids: [2, 3],
    }, { isTrainerCreator: true });
    await mockCreateCompetitionAttempt(competition.id, 2);
    await expect(mockCreateCompetitionAttempt(competition.id, 2)).rejects.toThrow('máximo de intentos');
  });
```

- [ ] **Step 10: Run the full test suite to verify everything passes**

Run: `npm test`
Expected: all suites pass, including every test added/modified in this task.

- [ ] **Step 11: Commit**

```bash
git add services/__mocks__/competitions-mock.js __tests__/competitions-mock.test.js
git commit -m "feat(competitions): mock support for max_attempts cap, attempt listing, route progress"
```

---

### Task 5: Normalizers — `maxAttempts`, attempt list model, route `progress` shape

**Files:**
- Modify: `services/normalizers.js`
- Modify: `__tests__/normalizers.test.js`

**Interfaces:**
- Consumes: the `{runner_session_id, session_instance_id, status, started_at, finished_at, distance_meters, duration_ms, compliance_ratio}` shape from Task 4's `mockGetCompetitionAttempts`.
- Produces: `toCompetitionModel(dto).maxAttempts: number|null`; `toCompetitionDetailModel(dto).progress[].{complianceRatio, durationMs, sessionInstanceId}` (route type only, alongside the pre-existing `userId`/`value`); `toCompetitionAttemptModel(dto): {runnerSessionId, sessionInstanceId, status, startedAt, finishedAt, distanceMeters, durationMs, complianceRatio}`; `toCompetitionAttemptListModel(list): toCompetitionAttemptModel[]`; `toCreateCompetitionPayload(form)` now includes `max_attempts` when `form.type === 'route'`. Consumed by Task 6 (`useCompetitionAttempts` hook) and Task 7/8/9/10/11 (screens/modals reading `maxAttempts`/`progress[].complianceRatio` etc.).

- [ ] **Step 1: Write the failing tests**

Add to `__tests__/normalizers.test.js`, right after the existing `describe('toCompetitionModel', ...)` block (around line 1362):

```js
describe('toCompetitionModel -- maxAttempts', () => {
  test('maps max_attempts through for a route competition', () => {
    const dto = {
      id: 7, team_id: 5, group_id: null, type: 'route', metric: null,
      start_at: '2026-10-20T10:00:00Z', end_at: null,
      route: null, acceptance_radius_meters: 50, max_attempts: 3,
      participant_user_ids: [1], created_by_user_id: 99, created_by_role: 'trainer',
      status: 'active', approved_by_user_id: null, rejection_reason: null,
      winner_user_ids: [], finished_at: null, session_instance_id: 9000,
    };
    expect(toCompetitionModel(dto).maxAttempts).toBe(3);
  });

  test('maps a null max_attempts (metric competitions) to null', () => {
    const dto = {
      id: 1, team_id: 5, group_id: null, type: 'metric', metric: 'distance',
      start_at: '2026-10-20T10:00:00Z', end_at: '2026-10-27T10:00:00Z',
      route: null, acceptance_radius_meters: null, max_attempts: null,
      participant_user_ids: [1], created_by_user_id: 99, created_by_role: 'trainer',
      status: 'active', approved_by_user_id: null, rejection_reason: null,
      winner_user_ids: [], finished_at: null, session_instance_id: null,
    };
    expect(toCompetitionModel(dto).maxAttempts).toBeNull();
  });
});

describe('toCompetitionDetailModel -- progress de type=route', () => {
  test('carga complianceRatio/durationMs/sessionInstanceId para type=route', () => {
    const dto = {
      id: 7, team_id: 5, group_id: null, type: 'route', metric: null,
      start_at: '2026-10-20T10:00:00Z', end_at: null,
      route: null, acceptance_radius_meters: 50, max_attempts: 3,
      participant_user_ids: [101], created_by_user_id: 99, created_by_role: 'trainer',
      status: 'active', approved_by_user_id: null, rejection_reason: null,
      winner_user_ids: [], finished_at: null, session_instance_id: 9000,
      progress: [{ user_id: 101, value: null, compliance_ratio: 94.2, duration_ms: 107000, session_instance_id: 9000 }],
    };
    const entry = toCompetitionDetailModel(dto).progress[0];
    expect(entry.userId).toBe('101');
    expect(entry.complianceRatio).toBe(94.2);
    expect(entry.durationMs).toBe(107000);
    expect(entry.sessionInstanceId).toBe('9000');
  });

  test('sin intentos (atleta sin registro) -- los 3 campos son null', () => {
    const dto = {
      id: 7, team_id: 5, group_id: null, type: 'route', metric: null,
      start_at: '2026-10-20T10:00:00Z', end_at: null,
      route: null, acceptance_radius_meters: 50, max_attempts: 3,
      participant_user_ids: [102], created_by_user_id: 99, created_by_role: 'trainer',
      status: 'active', approved_by_user_id: null, rejection_reason: null,
      winner_user_ids: [], finished_at: null, session_instance_id: 9000,
      progress: [{ user_id: 102, value: null, compliance_ratio: null, duration_ms: null, session_instance_id: null }],
    };
    const entry = toCompetitionDetailModel(dto).progress[0];
    expect(entry.complianceRatio).toBeNull();
    expect(entry.durationMs).toBeNull();
    expect(entry.sessionInstanceId).toBeNull();
  });
});

describe('toCompetitionAttemptListModel', () => {
  test('mapea cada intento, ids a string', () => {
    const list = [{
      runner_session_id: 9000, session_instance_id: 9000, status: 'finished',
      started_at: '2026-10-18T14:02:00Z', finished_at: '2026-10-18T14:03:47Z',
      distance_meters: 287, duration_ms: 107000, compliance_ratio: 94.2,
    }];
    const [entry] = toCompetitionAttemptListModel(list);
    expect(entry.runnerSessionId).toBe('9000');
    expect(entry.sessionInstanceId).toBe('9000');
    expect(entry.status).toBe('finished');
    expect(entry.distanceMeters).toBe(287);
    expect(entry.durationMs).toBe(107000);
    expect(entry.complianceRatio).toBe(94.2);
  });

  test('lista vacía -> array vacío', () => {
    expect(toCompetitionAttemptListModel([])).toEqual([]);
  });
});

describe('toCreateCompetitionPayload -- max_attempts', () => {
  test('incluye max_attempts cuando type=route', () => {
    const payload = toCreateCompetitionPayload({
      type: 'route', startAt: '2026-11-01', route: { type: 'LineString', coordinates: [] },
      acceptanceRadiusMeters: '50', maxAttempts: '3', participantUserIds: ['1', '2'],
    });
    expect(payload.max_attempts).toBe(3);
  });

  test('no incluye max_attempts cuando type=metric', () => {
    const payload = toCreateCompetitionPayload({
      type: 'metric', startAt: '2026-11-01', metric: 'distance', endAt: '2026-11-07',
      participantUserIds: ['1', '2'],
    });
    expect(payload).not.toHaveProperty('max_attempts');
  });
});
```

Add `toCompetitionDetailModel`, `toCompetitionAttemptListModel`, `toCreateCompetitionPayload` to the top-of-file import list (`toCompetitionModel` is already imported; add the other three next to it).

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx jest normalizers -t "maxAttempts|progress de type=route|toCompetitionAttemptListModel|max_attempts"`
Expected: FAIL — `maxAttempts` is `undefined` not `3`/`null`, `toCompetitionAttemptListModel is not a function`, etc.

- [ ] **Step 3: Implement the normalizer changes**

In `services/normalizers.js`, change `toCompetitionModel` — add this line right after `acceptanceRadiusMeters: dto.acceptance_radius_meters ?? null,`:

```js
    // Gap 36 -- tope de intentos de una competencia de ruta, null para
    // type='metric'. Default 1 ya lo aplica el backend/mock si viene
    // ausente -- este normalizer no inventa un default propio, solo
    // refleja lo que llegó.
    maxAttempts: dto.max_attempts ?? null,
```

Change `toCompetitionDetailModel`'s `progress` mapping from:

```js
    progress: (dto.progress ?? []).map((p) => ({ userId: String(p.user_id), value: p.value })),
```

to:

```js
    // Gap 36 -- compliance_ratio/duration_ms/session_instance_id solo
    // llegan con datos reales para type='route' (el mejor intento de ese
    // atleta); quedan null/ausentes para type='metric', donde `value` sigue
    // siendo el campo real.
    progress: (dto.progress ?? []).map((p) => ({
      userId: String(p.user_id),
      value: p.value,
      complianceRatio: p.compliance_ratio ?? null,
      durationMs: p.duration_ms ?? null,
      sessionInstanceId: p.session_instance_id != null ? String(p.session_instance_id) : null,
    })),
```

Add these two new functions right after `toCompetitionDetailModel`:

```js
// Un intento de competencia de ruta (GET /competitions/{id}/attempts, Gap
// 36) -- usado por AttemptsListModal y por competitions-tab.jsx para contar
// cupo restante del usuario actual.
export function toCompetitionAttemptModel(dto) {
  return {
    runnerSessionId: String(dto.runner_session_id),
    sessionInstanceId: String(dto.session_instance_id),
    status: dto.status,
    startedAt: dto.started_at,
    finishedAt: dto.finished_at ?? null,
    distanceMeters: dto.distance_meters ?? null,
    durationMs: dto.duration_ms ?? null,
    complianceRatio: dto.compliance_ratio ?? null,
  };
}

export function toCompetitionAttemptListModel(list) {
  return (list ?? []).map(toCompetitionAttemptModel);
}
```

Change `toCreateCompetitionPayload`'s route branch from:

```js
  if (form.type === 'route') {
    payload.route = form.route;
    payload.acceptance_radius_meters = Number(form.acceptanceRadiusMeters);
  } else {
```

to:

```js
  if (form.type === 'route') {
    payload.route = form.route;
    payload.acceptance_radius_meters = Number(form.acceptanceRadiusMeters);
    // Gap 36 -- tope de intentos, solo para competencias de ruta.
    payload.max_attempts = Number(form.maxAttempts);
  } else {
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx jest normalizers`
Expected: PASS, full file (existing + new tests).

- [ ] **Step 5: Commit**

```bash
git add services/normalizers.js __tests__/normalizers.test.js
git commit -m "feat(competitions): normalize max_attempts, route progress fields, attempt list"
```

---

### Task 6: `services/competitions.js` + `hooks/use-competitions.js` — attempts-list endpoint/hook

**Files:**
- Modify: `services/competitions.js`
- Modify: `hooks/use-competitions.js`

**Interfaces:**
- Consumes: `mockGetCompetitionAttempts` (Task 4), `toCompetitionAttemptListModel` (Task 5).
- Produces: `getCompetitionAttempts(competitionId, athleteUserId): Promise<{data: object[]}>` (service function); `useCompetitionAttempts(competitionId, athleteUserId, {enabled}): {attempts: {runnerSessionId, sessionInstanceId, status, startedAt, finishedAt, distanceMeters, durationMs, complianceRatio}[], loading: boolean}` (hook). Consumed by Task 11 (`competitions-tab.jsx`'s remaining-attempts gate) and Task 10 (`AttemptsListModal`).

- [ ] **Step 1: Add the service function**

In `services/competitions.js`, add this import to the top-of-file mock import block (next to the existing `mockGetCompetition` import):

```js
  mockGetCompetitionAttempts,
```

Add this function right after `createCompetitionAttempt`:

```js
// GET /api/v1/competitions/{id}/attempts -- listado de intentos de un
// atleta contra una competencia de ruta (Gap 36, intentos múltiples
// configurables, endpoint todavía no mergeado al backend real).
// `athleteUserId` opcional -- default caller del lado real (no se manda
// query param); en mocks siempre explícito, no hay token real que simular.
export async function getCompetitionAttempts(competitionId, athleteUserId) {
  if (USE_MOCKS) return await mockGetCompetitionAttempts(competitionId, athleteUserId);
  const query = athleteUserId ? `?athlete_user_id=${Number(athleteUserId)}` : '';
  return await api.get(`/competitions/${competitionId}/attempts${query}`);
}
```

- [ ] **Step 2: Add the hook**

In `hooks/use-competitions.js`, add `getCompetitionAttempts` to the existing `services/competitions.js` import block, and `toCompetitionAttemptListModel` to the existing `services/normalizers.js` import line:

```js
import {
  listCompetitions,
  getCompetition,
  getCompetitionAttempts,
  createCompetition as createCompetitionService,
  approveCompetition as approveCompetitionService,
  rejectCompetition as rejectCompetitionService,
  cancelCompetition as cancelCompetitionService,
  closeCompetition as closeCompetitionService,
  createCompetitionAttempt as createCompetitionAttemptService,
  seedDynamicRouteCompetitionStart,
} from '../services/competitions.js';
import { toCompetitionModel, toCompetitionDetailModel, toCompetitionAttemptListModel, toCreateCompetitionPayload } from '../services/normalizers.js';
```

Add this hook right after `useCompetitionDetail`:

```js
// Lista de intentos de UN atleta contra una competencia de ruta (Gap 36,
// endpoint nuevo). Dos consumidores: AttemptsListModal (elegir atleta y
// listar sus intentos) y competitions-tab.jsx (contar cupo restante del
// usuario actual antes de mostrar/deshabilitar "Correr esta trayectoria").
export function useCompetitionAttempts(competitionId, athleteUserId, { enabled = true } = {}) {
  const query = useQuery({
    queryKey: ['competition-attempts', competitionId, athleteUserId],
    queryFn: () => getCompetitionAttempts(competitionId, athleteUserId).then((response) => toCompetitionAttemptListModel(response.data ?? response)),
    enabled: Boolean(competitionId) && Boolean(athleteUserId) && enabled,
  });

  return { attempts: query.data ?? [], loading: query.isLoading };
}
```

- [ ] **Step 3: Invalidate the new query after a successful attempt**

Without this, `competitions-tab.jsx`'s `useCompetitionAttempts` (Task 11) can keep showing the OLD attempt count after a successful `POST /competitions/{id}/attempts` — TanStack Query doesn't know the two are related unless told. In `useCompetitionMutations`, change:

```js
  // Sin invalidate -- correr un intento no cambia el status/listado de la
  // competencia, solo crea el runner_session sintético del lado backend.
  const attemptMutation = useMutation({ mutationFn: ({ id, athleteUserId }) => createCompetitionAttemptService(id, athleteUserId) });
```

to:

```js
  // Gap 36 -- SÍ invalida ahora: el comentario de arriba ("no cambia el
  // status/listado") sigue siendo cierto para la query de LISTADO de
  // competencias (sin tocar), pero el listado de intentos propios
  // (useCompetitionAttempts) y el progress/ranking de la competencia
  // (useCompetitionDetail) necesitan reflejar el intento recién creado la
  // próxima vez que se consulten -- típicamente al volver a
  // competitions-tab.jsx después de correr.
  const attemptMutation = useMutation({
    mutationFn: ({ id, athleteUserId }) => createCompetitionAttemptService(id, athleteUserId),
    onSuccess: (_, { id, athleteUserId }) => {
      queryClient.invalidateQueries({ queryKey: ['competition-attempts', id, athleteUserId] });
      queryClient.invalidateQueries({ queryKey: ['competition', id] });
    },
  });
```

- [ ] **Step 4: Verify with the full test suite**

Run: `npm test`
Expected: PASS (this task has no dedicated test file of its own — `services/competitions.js` and `hooks/use-competitions.js` have no existing unit tests in this repo; correctness is exercised by Task 4's mock tests underneath and verified end-to-end manually in Task 13).

Run: `npx eslint services/competitions.js hooks/use-competitions.js`
Expected: clean.

- [ ] **Step 5: Commit**

```bash
git add services/competitions.js hooks/use-competitions.js
git commit -m "feat(competitions): add getCompetitionAttempts service call, invalidate on new attempt"
```

---

### Task 7: `create-competition-modal.jsx` — `maxAttempts` field

**Files:**
- Modify: `components/team/create-competition-modal.jsx`

**Interfaces:**
- Consumes: `toCreateCompetitionPayload` reading `form.maxAttempts` (Task 5) via the existing `onSubmit(form)` → `mutations.createCompetition` → `createCompetitionService(teamId, toCreateCompetitionPayload(form), ...)` chain (`hooks/use-competitions.js`, unchanged by this task).
- Produces: nothing new consumed by later tasks — this is a leaf UI task.

- [ ] **Step 1: Add the `maxAttempts` state + default constant**

Add this constant right after `const DEFAULT_ACCEPTANCE_RADIUS = 50;`:

```js
const DEFAULT_MAX_ATTEMPTS = 3;
```

Add this state right after `const [acceptanceRadius, setAcceptanceRadius] = useState(String(DEFAULT_ACCEPTANCE_RADIUS));`:

```js
  const [maxAttempts, setMaxAttempts] = useState(String(DEFAULT_MAX_ATTEMPTS));
```

Add the matching reset line in the `isResetting` block, right after `setAcceptanceRadius(String(DEFAULT_ACCEPTANCE_RADIUS));`:

```js
    setMaxAttempts(String(DEFAULT_MAX_ATTEMPTS));
```

- [ ] **Step 2: Add validation in `handleSubmit`**

In `handleSubmit`, right after the existing radius validation block:

```js
      const radius = Number(acceptanceRadius);
      if (!Number.isFinite(radius) || radius < 5 || radius > 500) {
        setError('El radio de aceptación tiene que estar entre 5 y 500 metros.');
        return;
      }
```

add:

```js
      const attempts = Number(maxAttempts);
      if (!Number.isInteger(attempts) || attempts < 1 || attempts > 10) {
        setError('El máximo de intentos tiene que ser un número entero entre 1 y 10.');
        return;
      }
```

Change the `onSubmit` call's route-type spread from:

```js
      ...(type === 'metric'
        ? { metric, endAt: endIso }
        : { route, acceptanceRadiusMeters: Number(acceptanceRadius) }),
```

to:

```js
      ...(type === 'metric'
        ? { metric, endAt: endIso }
        : { route, acceptanceRadiusMeters: Number(acceptanceRadius), maxAttempts: Number(maxAttempts) }),
```

- [ ] **Step 3: Add the field to the form JSX**

Change:

```jsx
                    <DateField dense disableFutureLimit hideErrorRow label="Desde" onChange={setStartDate} value={startDate} />
                    <RouteDrawPicker acceptanceRadiusMeters={Number(acceptanceRadius)} onChange={setRoute} onMapTouchEnd={() => setMapInteracting(false)} onMapTouchStart={() => setMapInteracting(true)} value={route} />
                    <InputField className="mb-0" dense hideErrorRow keyboardType="numeric" label="Radio de aceptación (metros)" onChange={setAcceptanceRadius} value={acceptanceRadius} />
```

to:

```jsx
                    <DateField dense disableFutureLimit hideErrorRow label="Desde" onChange={setStartDate} value={startDate} />
                    <RouteDrawPicker acceptanceRadiusMeters={Number(acceptanceRadius)} onChange={setRoute} onMapTouchEnd={() => setMapInteracting(false)} onMapTouchStart={() => setMapInteracting(true)} value={route} />
                    <InputField className="mb-0" dense hideErrorRow keyboardType="numeric" label="Radio de aceptación (metros)" onChange={setAcceptanceRadius} value={acceptanceRadius} />
                    <InputField className="mb-0" dense hideErrorRow keyboardType="numeric" label="Máximo de intentos por corredor" onChange={setMaxAttempts} value={maxAttempts} />
```

- [ ] **Step 4: Verify**

Run: `npx eslint components/team/create-competition-modal.jsx`
Expected: clean (confirms `nativeID`/`testID` lint didn't trip — `InputField` already handles those internally for its own wrapper, same as the pre-existing `acceptanceRadius` field right above it).

Manual check (web preview, mocks): open "Nueva competencia", pick "Por trayectoria", confirm a new "Máximo de intentos por corredor" field appears pre-filled with `3`, and that submitting with `0` or `11` shows the new validation error.

- [ ] **Step 5: Commit**

```bash
git add components/team/create-competition-modal.jsx
git commit -m "feat(competitions): add max_attempts field to the create-competition form"
```

---

### Task 8: `useAttemptDetail` — specific-attempt override

**Files:**
- Modify: `hooks/use-attempt-detail.js`

**Interfaces:**
- Consumes: `competition.progress[].sessionInstanceId` (Task 5).
- Produces: `useAttemptDetail({..., sessionInstanceId?})` — when `sessionInstanceId` is passed, the remote branch uses it directly instead of deriving one; when absent, it now resolves the CALLED athlete's BEST attempt (via `progress`) instead of the single competition-wide `sessionInstanceId`, fixing the existing ranking-tap path for athletes with more than one attempt. Consumed by Task 9 (ranking tap, no override, unaffected codepath but now correctly athlete-specific) and Task 10 (`AttemptsListModal` row tap, with override) and Task 12 (threading the param through from the screen).

**Context:** Before this task, `useRemoteAttemptDetail` derives `const sessionInstanceId = competition?.sessionInstanceId ?? null;` — a SINGLE value shared by the whole competition (correct only when every athlete has at most one attempt, which was true before this plan). With multiple attempts, different athletes have different "best" `session_instance_id`s (the per-athlete values now living in `competition.progress`, Task 5), so this derivation must change even for the no-override (ranking) path.

- [ ] **Step 1: Change `useRemoteAttemptDetail`'s signature and derivation**

Change:

```js
function useRemoteAttemptDetail(athleteUserId, { competition, competitionLoading }) {
  const sessionInstanceId = competition?.sessionInstanceId ?? null;
```

to:

```js
function useRemoteAttemptDetail(athleteUserId, { competition, competitionLoading, sessionInstanceIdOverride }) {
  // Prioridad: (1) un intento específico elegido explícitamente (viene de
  // AttemptsListModal, Task 10) -- (2) el mejor intento de ESTE atleta
  // puntual (Gap 36, vive en competition.progress, distinto por atleta) --
  // (3) fallback al session_instance_id único de la competencia (gap 35,
  // competencias viejas sin progress poblado todavía). Antes de este plan
  // SIEMPRE usaba (3) sin más -- correcto solo mientras cada atleta tenía
  // como máximo un intento.
  const athleteProgress = competition?.progress?.find((p) => p.userId === String(athleteUserId));
  const sessionInstanceId = sessionInstanceIdOverride
    ?? athleteProgress?.sessionInstanceId
    ?? competition?.sessionInstanceId
    ?? null;
```

- [ ] **Step 2: Thread the override through `useAttemptDetail`**

Change:

```js
export function useAttemptDetail({ competitionId, athleteUserId, setId, distanceMeters, durationMs, startedAt }) {
  const { detail: competition, loading: competitionLoading } = useCompetitionDetail(competitionId);
  const local = useLocalAttemptDetail(setId, { distanceMeters, durationMs, startedAt, competition });
  const remote = useRemoteAttemptDetail(athleteUserId, { competition, competitionLoading });
```

to:

```js
export function useAttemptDetail({ competitionId, athleteUserId, setId, distanceMeters, durationMs, startedAt, sessionInstanceId }) {
  const { detail: competition, loading: competitionLoading } = useCompetitionDetail(competitionId);
  const local = useLocalAttemptDetail(setId, { distanceMeters, durationMs, startedAt, competition });
  const remote = useRemoteAttemptDetail(athleteUserId, { competition, competitionLoading, sessionInstanceIdOverride: sessionInstanceId });
```

- [ ] **Step 3: Verify**

Run: `npm test`
Expected: PASS, no existing test exercises this hook directly (per repo convention, only the extracted pure `deriveAttemptStatus` is unit-tested, see `__tests__/use-attempt-detail-status.test.js`, untouched by this task) — correctness is verified manually in Task 13 (navigate from the ranking modal AND from the new attempts list modal, confirm each shows the RIGHT attempt's data).

Run: `npx eslint hooks/use-attempt-detail.js`
Expected: clean.

- [ ] **Step 4: Commit**

```bash
git add hooks/use-attempt-detail.js
git commit -m "feat(competitions): useAttemptDetail resolves per-athlete best attempt, or a specific override"
```

---

### Task 9: `competition-ranking-modal.jsx` — real sort/display for route type

**Files:**
- Modify: `components/team/competition-ranking-modal.jsx`

**Interfaces:**
- Consumes: `entry.complianceRatio`/`entry.durationMs` (Task 5's `progress` shape).

**Context:** Today, `ranked` sorts by `entry.value` for both types (`value` is always `null` for route, so route rows end up in whatever order the backend/mock returned them, and the value column always shows `'—'`). This task makes route sort by the SAME rule as `pickBestAttempt` (Task 1) — but inline, since here we're sorting ATHLETES against each other (not attempts within one athlete), a subtly different comparison that happens to use the same two fields.

- [ ] **Step 1: Change the sort/display logic**

Change:

```js
  // `pace`: menor es mejor (más rápido) -- único metric donde "menos" gana.
  // El resto (distance/duration/peak_speed/sessions_count/attendance_count)
  // ordena de mayor a menor.
  const direction = competition?.metric === 'pace' ? 1 : -1;
  const ranked = [...(detail?.progress ?? [])].sort((a, b) => direction * ((a.value ?? 0) - (b.value ?? 0)));
```

to:

```js
  // `pace`: menor es mejor (más rápido) -- único metric donde "menos" gana.
  // El resto (distance/duration/peak_speed/sessions_count/attendance_count)
  // ordena de mayor a menor.
  const direction = competition?.metric === 'pace' ? 1 : -1;
  // type='route' (Gap 36): mayor % de cumplimiento gana, empate por menor
  // duración -- mismo comparador que pickBestAttempt (utils/route-geometry.js),
  // aplicado acá entre atletas distintos en vez de entre los intentos
  // propios de uno. Participantes sin ningún intento (complianceRatio null)
  // quedan siempre al final, sin importar el resto del orden.
  const ranked = [...(detail?.progress ?? [])].sort((a, b) => {
    if (competition?.type === 'route') {
      if (a.complianceRatio == null && b.complianceRatio == null) return 0;
      if (a.complianceRatio == null) return 1;
      if (b.complianceRatio == null) return -1;
      if (a.complianceRatio !== b.complianceRatio) return b.complianceRatio - a.complianceRatio;
      return (a.durationMs ?? Infinity) - (b.durationMs ?? Infinity);
    }
    return direction * ((a.value ?? 0) - (b.value ?? 0));
  });
```

Change the displayed value cell from:

```jsx
                    <Text className="text-sm font-semibold text-primary" nativeID={`competition-ranking-modal-row-${entry.userId}-value`} testID={`competition-ranking-modal-row-${entry.userId}-value`}>
                      {competition?.type === 'metric' ? formatMetricValue(competition.metric, entry.value) : '—'}
                    </Text>
```

to:

```jsx
                    <Text className="text-sm font-semibold text-primary" nativeID={`competition-ranking-modal-row-${entry.userId}-value`} testID={`competition-ranking-modal-row-${entry.userId}-value`}>
                      {competition?.type === 'metric'
                        ? formatMetricValue(competition.metric, entry.value)
                        : entry.complianceRatio != null ? `${Math.round(entry.complianceRatio)}%` : 'Sin intentos'}
                    </Text>
```

- [ ] **Step 2: Verify**

Run: `npx eslint components/team/competition-ranking-modal.jsx`
Expected: clean.

Manual check (web preview, mocks): open the ranking for competition seed 7 (team 5) — athlete 101 (Lucía Fernández) should show a compliance percentage (not `'—'`) and sort ahead of any participant with no attempts, who should show "Sin intentos" instead.

- [ ] **Step 3: Commit**

```bash
git add components/team/competition-ranking-modal.jsx
git commit -m "feat(competitions): real sort and display for route-type ranking rows"
```

---

### Task 10: `AttemptsListModal` (new component)

**Files:**
- Create: `components/team/attempts-list-modal.jsx`

**Interfaces:**
- Consumes: `useCompetitionAttempts` (Task 6), `pickBestAttempt` (Task 1), `ResponsiveSelectField` (`components/forms/responsive-select-field.jsx`, pre-existing), `memberName`-equivalent lookup (same pattern as `competitions-tab.jsx`'s own `memberName`, duplicated locally since this is a separate file — no shared export exists for it today).
- Produces: `<AttemptsListModal competition members currentUserId onClose visible />` — rendered by Task 11's `competitions-tab.jsx`. Built BEFORE Task 11 on purpose, so that task's new import of this file resolves immediately instead of leaving an intermediate broken-lint commit.

- [ ] **Step 1: Write the component**

```jsx
import { useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useThemeColors } from '../../theme/colors.js';
import { useCompetitionAttempts } from '../../hooks/use-competitions.js';
import { pickBestAttempt } from '../../utils/route-geometry.js';
import { formatMeters } from '../../utils/distance.js';
import { formatStopwatch } from '../../utils/time.js';
import { ResponsiveSelectField } from '../forms/responsive-select-field.jsx';
import { buildCompetitionTitle } from '../../utils/competition-title.js';

function memberName(members, userId) {
  return members.find((m) => m.userId === userId)?.name ?? 'Corredor';
}

const pad2 = (n) => String(n).padStart(2, '0');
function formatAttemptDate(iso) {
  if (!iso) return '—';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '—';
  return `${pad2(date.getDate())}/${pad2(date.getMonth() + 1)}/${date.getFullYear()} ${pad2(date.getHours())}:${pad2(date.getMinutes())}`;
}

// Historial completo de intentos de UN participante contra una competencia
// de ruta (Gap 36, intentos múltiples) -- mismo criterio de visibilidad que
// CompetitionRankingModal: cualquiera que pueda ver la competencia puede
// elegir cualquier participante en el select de arriba, no solo verse a sí
// mismo. Default del select: el usuario actual si participa, si no el
// primer participante de la lista -- pedido real, 2026-10-21.
export function AttemptsListModal({ visible, onClose, competition, members, currentUserId }) {
  const router = useRouter();
  const colors = useThemeColors();
  const participantIds = competition?.participantUserIds ?? [];
  const defaultAthleteId = participantIds.includes(currentUserId) ? currentUserId : (participantIds[0] ?? null);
  const [athleteId, setAthleteId] = useState(defaultAthleteId);
  const resolvedAthleteId = participantIds.includes(athleteId) ? athleteId : defaultAthleteId;

  const { attempts, loading } = useCompetitionAttempts(competition?.id, resolvedAthleteId, { enabled: visible && Boolean(competition) });
  const best = pickBestAttempt(attempts.map((a) => ({ ...a, durationMs: a.durationMs })));

  const athleteOptions = participantIds.map((id) => ({ id, name: memberName(members, id) }));

  const handleOpenAttempt = (attempt) => {
    onClose();
    router.push({
      pathname: '/route-attempt-detail',
      params: { competitionId: competition.id, athleteUserId: resolvedAthleteId, sessionInstanceId: attempt.sessionInstanceId },
    });
  };

  return (
    <Modal animationType="fade" nativeID="attempts-list-modal" onRequestClose={onClose} testID="attempts-list-modal" transparent visible={visible}>
      <Pressable className="flex-1 items-center justify-center bg-black/50 px-4" nativeID="attempts-list-modal-backdrop" onPress={onClose} testID="attempts-list-modal-backdrop">
        <Pressable className="max-h-[80vh] w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-xl dark:border-slate-700 dark:bg-surface" nativeID="attempts-list-modal-card" onPress={() => {}} testID="attempts-list-modal-card">
          <View className="mb-4 flex-row items-center gap-2" nativeID="attempts-list-modal-header" testID="attempts-list-modal-header">
            <MaterialCommunityIcons color={colors.primary} name="format-list-bulleted" size={20} />
            <Text className="flex-1 text-base font-bold text-slate-900 dark:text-white" nativeID="attempts-list-modal-title" numberOfLines={2} testID="attempts-list-modal-title">
              {competition ? (competition.name ?? buildCompetitionTitle(competition)) : 'Intentos'}
            </Text>
            <Pressable className="h-8 w-8 items-center justify-center rounded-full hover:bg-slate-100 active:opacity-70 dark:hover:bg-slate-800" nativeID="attempts-list-modal-close-button" onPress={onClose} testID="attempts-list-modal-close-button">
              <MaterialCommunityIcons color={colors.onSurfaceVariant} name="close" size={18} />
            </Pressable>
          </View>

          <View className="mb-3" nativeID="attempts-list-modal-athlete-picker-wrap" testID="attempts-list-modal-athlete-picker-wrap">
            <ResponsiveSelectField dense hideErrorRow label="Corredor" onChange={setAthleteId} options={athleteOptions} value={resolvedAthleteId} />
          </View>

          {loading ? (
            <View className="items-center py-6" nativeID="attempts-list-modal-loading" testID="attempts-list-modal-loading">
              <ActivityIndicator color={colors.primary} />
            </View>
          ) : (
            <ScrollView className="max-h-[50vh]" nativeID="attempts-list-modal-scroll" testID="attempts-list-modal-scroll">
              <View className="gap-2" nativeID="attempts-list-modal-list" testID="attempts-list-modal-list">
                {attempts.map((attempt) => {
                  const isBest = best?.sessionInstanceId === attempt.sessionInstanceId;
                  return (
                    <Pressable
                      className="flex-row items-center justify-between gap-2 rounded-xl bg-slate-50 px-3 py-2 active:opacity-70 dark:bg-slate-900"
                      key={attempt.sessionInstanceId}
                      nativeID={`attempts-list-modal-row-${attempt.sessionInstanceId}`}
                      onPress={() => handleOpenAttempt(attempt)}
                      testID={`attempts-list-modal-row-${attempt.sessionInstanceId}`}
                    >
                      <View className="flex-1" nativeID={`attempts-list-modal-row-${attempt.sessionInstanceId}-info`} testID={`attempts-list-modal-row-${attempt.sessionInstanceId}-info`}>
                        <Text className="text-sm font-medium text-slate-900 dark:text-white" nativeID={`attempts-list-modal-row-${attempt.sessionInstanceId}-date`} testID={`attempts-list-modal-row-${attempt.sessionInstanceId}-date`}>
                          {formatAttemptDate(attempt.startedAt)}
                        </Text>
                        <Text className="text-xs text-slate-500 dark:text-slate-400" nativeID={`attempts-list-modal-row-${attempt.sessionInstanceId}-meta`} testID={`attempts-list-modal-row-${attempt.sessionInstanceId}-meta`}>
                          {formatMeters(attempt.distanceMeters ?? 0)} · {formatStopwatch(attempt.durationMs ?? 0)}
                        </Text>
                      </View>
                      <View className="items-end gap-0.5" nativeID={`attempts-list-modal-row-${attempt.sessionInstanceId}-compliance-wrap`} testID={`attempts-list-modal-row-${attempt.sessionInstanceId}-compliance-wrap`}>
                        <Text className="text-sm font-semibold text-primary" nativeID={`attempts-list-modal-row-${attempt.sessionInstanceId}-compliance`} testID={`attempts-list-modal-row-${attempt.sessionInstanceId}-compliance`}>
                          {attempt.complianceRatio != null ? `${Math.round(attempt.complianceRatio)}%` : '—'}
                        </Text>
                        {isBest && (
                          <View className="flex-row items-center gap-0.5" nativeID={`attempts-list-modal-row-${attempt.sessionInstanceId}-badge`} testID={`attempts-list-modal-row-${attempt.sessionInstanceId}-badge`}>
                            <MaterialCommunityIcons color="#eab308" name="trophy" size={12} />
                            <Text className="text-[10px] font-semibold text-amber-700 dark:text-amber-400" nativeID={`attempts-list-modal-row-${attempt.sessionInstanceId}-badge-label`} testID={`attempts-list-modal-row-${attempt.sessionInstanceId}-badge-label`}>
                              Mejor
                            </Text>
                          </View>
                        )}
                      </View>
                    </Pressable>
                  );
                })}
                {attempts.length === 0 && (
                  <Text className="text-sm text-slate-400 dark:text-slate-500" nativeID="attempts-list-modal-empty" testID="attempts-list-modal-empty">
                    Este corredor todavía no registró ningún intento.
                  </Text>
                )}
              </View>
            </ScrollView>
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
}
```

- [ ] **Step 2: Verify lint**

Run: `npx eslint components/team/attempts-list-modal.jsx`
Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add components/team/attempts-list-modal.jsx
git commit -m "feat(competitions): add AttemptsListModal for browsing any participant's attempt history"
```

---

### Task 11: `competitions-tab.jsx` — remaining-attempts gate + copy + "Ver todos los intentos" button

**Files:**
- Modify: `components/team/competitions-tab.jsx`

**Interfaces:**
- Consumes: `useCompetitionAttempts` (Task 6); `AttemptsListModal` (Task 10).
- Produces: a new `onOpenAttempts(competition)` prop on `CompetitionRow`, wired up in `CompetitionsTab`.

- [ ] **Step 1: Add the import**

Add `useCompetitionAttempts` to the existing `hooks/use-competitions.js` import line:

```js
import { useCompetitions, useCompetitionMutations, useCompetitionDetail, useCompetitionAttempts, useSeedDynamicRouteCompetition } from '../../hooks/use-competitions.js';
```

- [ ] **Step 2: Change `canRun` and add the attempt-gate variables**

Change:

```js
  const isOwnPendingProposal = competition.status === 'pending_approval' && competition.createdByRole === 'runner' && competition.createdByUserId === currentUserId;
  const canClose = isTrainerView && competition.status === 'active' && competition.endAt && competition.endAt < new Date().toISOString().slice(0, 10);
  const canRun = !isTrainerView && competition.type === 'route' && competition.status === 'active' && competition.participantUserIds.includes(currentUserId);
  const canApproveReject = isTrainerView && competition.status === 'pending_approval';
```

to:

```js
  const isOwnPendingProposal = competition.status === 'pending_approval' && competition.createdByRole === 'runner' && competition.createdByUserId === currentUserId;
  const canClose = isTrainerView && competition.status === 'active' && competition.endAt && competition.endAt < new Date().toISOString().slice(0, 10);
  // Gap 36 -- antes `canRun` no chequeaba intentos usados en absoluto (el
  // único bloqueo era un 400 server-side, invisible hasta que el corredor
  // lo tocaba). Con max_attempts > 1 posible, un corredor con cupo agotado
  // necesita feedback claro de entrada, no un error de red.
  const canRunBase = !isTrainerView && competition.type === 'route' && competition.status === 'active' && competition.participantUserIds.includes(currentUserId);
  const { attempts: myAttempts } = useCompetitionAttempts(competition.id, currentUserId, { enabled: canRunBase });
  const maxAttempts = competition.maxAttempts ?? 1;
  const remainingAttempts = maxAttempts - myAttempts.length;
  const canRun = canRunBase && remainingAttempts > 0;
  const runTooltipLabel = remainingAttempts > 0 ? `Correr esta trayectoria (intento ${myAttempts.length + 1} de ${maxAttempts})` : 'Sin intentos disponibles';
  const canApproveReject = isTrainerView && competition.status === 'pending_approval';
```

- [ ] **Step 3: Use `runTooltipLabel` and disable the icon button when exhausted**

Change:

```jsx
            {canRun && !isWeb && (
              <IconTooltip align="end" idPrefix={`${idPrefix}-run-tooltip`} label="Correr esta trayectoria" position="bottom">
                <Pressable className="h-8 w-8 items-center justify-center rounded-full bg-primary-tint dark:bg-primary/15 active:opacity-70 disabled:opacity-60" disabled={busy} nativeID={`${idPrefix}-run-button`} onPress={() => onRun(competition)} testID={`${idPrefix}-run-button`}>
                  <MaterialCommunityIcons color={colors.primary} name="play" size={18} />
                </Pressable>
              </IconTooltip>
            )}
```

to:

```jsx
            {canRunBase && !isWeb && (
              <IconTooltip align="end" idPrefix={`${idPrefix}-run-tooltip`} label={runTooltipLabel} position="bottom">
                <Pressable className="h-8 w-8 items-center justify-center rounded-full bg-primary-tint dark:bg-primary/15 active:opacity-70 disabled:opacity-60" disabled={busy || remainingAttempts <= 0} nativeID={`${idPrefix}-run-button`} onPress={() => onRun(competition)} testID={`${idPrefix}-run-button`}>
                  <MaterialCommunityIcons color={colors.primary} name="play" size={18} />
                </Pressable>
              </IconTooltip>
            )}
```

(Note: the button's VISIBILITY condition changes from `canRun` to `canRunBase` — the button itself should still be visible-but-disabled once attempts run out, only hidden when the broader participation/status conditions don't hold. The `hasActions` line further up — `const hasActions = canApproveReject || isOwnPendingProposal || canClose || canViewRanking || (canRun && !isWeb);` — also needs `canRun` replaced with `canRunBase` so the actions row doesn't disappear once a route competition's Run button goes from enabled to disabled-but-visible.)

Change:

```js
  const hasActions = canApproveReject || isOwnPendingProposal || canClose || canViewRanking || (canRun && !isWeb);
```

to:

```js
  const hasActions = canApproveReject || isOwnPendingProposal || canClose || canViewRanking || (canRunBase && !isWeb);
```

And the web notice block — change:

```jsx
      {canRun && isWeb && (
        <View className="ml-6 mt-3" nativeID={`${idPrefix}-run-row`} testID={`${idPrefix}-run-row`}>
          <Text className="self-start rounded-full bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400" nativeID={`${idPrefix}-run-web-notice`} testID={`${idPrefix}-run-web-notice`}>
            Correr una trayectoria solo está disponible en la app nativa
          </Text>
        </View>
      )}
```

to:

```jsx
      {canRunBase && isWeb && (
        <View className="ml-6 mt-3" nativeID={`${idPrefix}-run-row`} testID={`${idPrefix}-run-row`}>
          <Text className="self-start rounded-full bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400" nativeID={`${idPrefix}-run-web-notice`} testID={`${idPrefix}-run-web-notice`}>
            {remainingAttempts > 0
              ? `Correr una trayectoria solo está disponible en la app nativa (intento ${myAttempts.length + 1} de ${maxAttempts})`
              : 'Ya alcanzaste el máximo de intentos para esta competencia'}
          </Text>
        </View>
      )}
```

- [ ] **Step 4: Add the "Ver todos los intentos" button and the `onOpenAttempts` prop**

Change `CompetitionRow`'s props list from:

```js
function CompetitionRow({ competition, members, isTrainerView, currentUserId, expanded, onToggleExpand, onApprove, onReject, onCancel, onClose, onRun, onOpenRanking, busy }) {
```

to:

```js
function CompetitionRow({ competition, members, isTrainerView, currentUserId, expanded, onToggleExpand, onApprove, onReject, onCancel, onClose, onRun, onOpenRanking, onOpenAttempts, busy }) {
```

Add the new button right after the ranking button:

```jsx
            {canViewRanking && (
              <IconTooltip align="end" idPrefix={`${idPrefix}-ranking-tooltip`} label="Ver ranking" position="bottom">
                <Pressable className="h-8 w-8 items-center justify-center rounded-full bg-slate-100 active:opacity-70 dark:bg-slate-800" nativeID={`${idPrefix}-ranking-button`} onPress={() => onOpenRanking(competition)} testID={`${idPrefix}-ranking-button`}>
                  <MaterialCommunityIcons color={colors.onSurfaceVariant} name="podium" size={18} />
                </Pressable>
              </IconTooltip>
            )}
            {canViewRanking && competition.type === 'route' && (
              <IconTooltip align="end" idPrefix={`${idPrefix}-attempts-tooltip`} label="Ver todos los intentos" position="bottom">
                <Pressable className="h-8 w-8 items-center justify-center rounded-full bg-slate-100 active:opacity-70 dark:bg-slate-800" nativeID={`${idPrefix}-attempts-button`} onPress={() => onOpenAttempts(competition)} testID={`${idPrefix}-attempts-button`}>
                  <MaterialCommunityIcons color={colors.onSurfaceVariant} name="format-list-bulleted" size={18} />
                </Pressable>
              </IconTooltip>
            )}
```

- [ ] **Step 5: Wire the new modal's state in `CompetitionsTab`**

Add state right after `const [rankingCompetition, setRankingCompetition] = useState(null);`:

```js
  const [attemptsCompetition, setAttemptsCompetition] = useState(null);
```

Pass the prop at the `CompetitionRow` call site — add `onOpenAttempts={setAttemptsCompetition}` next to the existing `onOpenRanking={setRankingCompetition}`.

Render the modal right after `<CompetitionRankingModal .../>` (component already exists from Task 10):

```jsx
      <AttemptsListModal
        competition={attemptsCompetition}
        currentUserId={currentUserId}
        members={members}
        onClose={() => setAttemptsCompetition(null)}
        visible={attemptsCompetition != null}
      />
```

Add the import at the top of the file, next to the existing `CompetitionRankingModal` import:

```js
import { AttemptsListModal } from './attempts-list-modal.jsx';
```

- [ ] **Step 6: Verify**

Run: `npx eslint components/team/competitions-tab.jsx`
Expected: clean — `AttemptsListModal` already exists from Task 10, so this import resolves immediately.

- [ ] **Step 7: Manual verification (web preview, mocks)**

Open team 5's Competencias tab, expand competition seed 7 (route), click the new "Ver todos los intentos" icon. Confirm: the select defaults to the logged-in demo user (if participant) or the first participant; switching the select to athlete 101 (Lucía Fernández) shows 2 rows (one with a "Mejor" badge, the higher-compliance one); tapping a row navigates to `/route-attempt-detail` and shows that SPECIFIC attempt's data (not necessarily the best one, if you tapped the worse row). Also confirm the Run button/tooltip copy reflects the right "intento X de Y" count for a route competition with remaining attempts.

- [ ] **Step 8: Commit**

```bash
git add components/team/competitions-tab.jsx
git commit -m "feat(competitions): remaining-attempts gate, copy, and attempts-list button"
```

---

### Task 12: `route-attempt-detail-screen.jsx` — read the `sessionInstanceId` param

**Files:**
- Modify: `components/session-runtime/route-attempt-detail-screen.jsx`

**Interfaces:**
- Consumes: `useAttemptDetail`'s new `sessionInstanceId` param (Task 8).

- [ ] **Step 1: Thread the param through**

Change:

```js
  const detail = useAttemptDetail({
    competitionId: params.competitionId,
    athleteUserId: params.athleteUserId,
    setId: params.setId,
    distanceMeters: params.distanceMeters,
    durationMs: params.durationMs,
    startedAt: params.startedAt,
  });
```

to:

```js
  const detail = useAttemptDetail({
    competitionId: params.competitionId,
    athleteUserId: params.athleteUserId,
    setId: params.setId,
    distanceMeters: params.distanceMeters,
    durationMs: params.durationMs,
    startedAt: params.startedAt,
    // Gap 36 -- presente solo cuando se navega desde AttemptsListModal (un
    // intento puntual, no necesariamente el mejor); ausente desde el
    // ranking, que sigue resolviendo el mejor intento del atleta por su
    // cuenta (ver hooks/use-attempt-detail.js).
    sessionInstanceId: params.sessionInstanceId,
  });
```

- [ ] **Step 2: Verify**

Run: `npx eslint components/session-runtime/route-attempt-detail-screen.jsx`
Expected: clean.

Manual check (web preview, mocks): already covered by Task 11's Step 7 (navigating from `AttemptsListModal`'s worse-attempt row and confirming the screen shows THAT attempt, not the best one).

- [ ] **Step 3: Commit**

```bash
git add components/session-runtime/route-attempt-detail-screen.jsx
git commit -m "feat(competitions): route-attempt-detail-screen reads the sessionInstanceId param"
```

---

### Task 13: Final regression pass

**Files:** none (verification only).

- [ ] **Step 1: Full test suite**

Run: `npm test`
Expected: all suites pass.

- [ ] **Step 2: Full lint**

Run: `npm run lint`
Expected: clean (no new errors; pre-existing `react-hooks/exhaustive-deps` warnings elsewhere in the repo are not this plan's concern).

- [ ] **Step 3: Manual end-to-end walkthrough (web preview, mocks)**

1. Create a new route competition with `max_attempts: 2` via the modal (Task 7) — confirm the field defaults to 3, change it to 2, confirm validation rejects 0/11.
2. As a participant with 0 attempts, confirm the Run tooltip/notice shows "intento 1 de 2".
3. Run the attempt once (native-only flow — if testing from the web preview, skip the live run itself and instead rely on competition seed 7/athlete 101's pre-seeded 2 attempts to exercise the REST of the flow: ranking, attempts list, detail navigation).
4. Open the ranking for competition seed 7 — confirm athlete 101 shows a real compliance percentage (not `'—'`) and sorts correctly against any other participant.
5. Open "Ver todos los intentos" for the same competition, switch to athlete 101, confirm 2 rows with distinct compliance/duration and exactly one "Mejor" badge.
6. Tap the non-best row — confirm `/route-attempt-detail` shows THAT attempt's data (lower compliance, longer duration, matching the row tapped).
7. Go back to the ranking and tap athlete 101's row — confirm it shows the BEST attempt (matching the "Mejor"-badged row from step 5), not whichever one happened to load first.

- [ ] **Step 4: Report completion**

No push — per this repo's git workflow (`CLAUDE.md`), pushing and PR creation/update are explicitly left to whoever is running the session, confirmed with the user before doing so.
