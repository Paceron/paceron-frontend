# Sesión presencial (2/2): cliente entrenador — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the trainer-side client for presencial live sessions — a pre-start screen with an a-priori participant roster and attendance access, and a live screen with a map of connected runners, live per-participant progress, a live records feed, and a manual slide-to-finish that closes the session for every connected runner.

**Architecture:** Two new native-only screens (`trainer-session-pre-start-screen.jsx`, `trainer-session-live-screen.jsx`) plus one orchestration hook (`use-trainer-session-runtime.js`) that reuses the already-shipped generic WebSocket bus (`services/realtime-client.js`/`hooks/use-realtime-channel.js`) exactly as the runner's spec-1 hook does. The trainer creates no local SQLite run — it is a supervisor, not a participant executing sets — so the hook's only local state is two pure reducers (participant status, live feed) fed by incoming WS messages, plus a REST fan-out bootstrap for feedback that already happened before the trainer joined. Attendance is a thin modal composing the already-shipped `components/attendance/` pieces, unmodified.

**Tech Stack:** React Native (Expo Router), `@maplibre/maplibre-react-native` (already a dependency, used today in `components/shared/location-picker.jsx`), `react-native-reanimated` + `react-native-gesture-handler` (slide-to-finish, copied from the already-working spec-1 pattern), TanStack Query (`useQueries` fan-out for the feedback bootstrap), Zustand (`store/live-session-store.js`, reused for `gpsEnabled` only).

**Spec:** `docs/superpowers/specs/2026-09-30-presencial-live-session-trainer-design.md`

## Global Constraints

- Every `View`/`Text`/`Pressable`/`Modal`/`ScrollView`/`Animated.*` in every new file needs both `nativeID` and `testID`, kebab-case, scoped/unique (ESLint `local/require-native-id`, no exceptions).
- No component render tests (project convention) — Jest covers pure logic only: reducers, bounds math, the two utils files below.
- The trainer creates **no local SQLite run** — no `session-db.js` calls at all in this plan.
- Both new screens wrapped in `MobileOnlyRoute` (`components/guards/platform-gate.jsx`), same pattern as spec 1.
- `components/attendance/*`, `components/session-runtime/session-pre-start-screen.jsx`, `components/session-runtime/training-session-live-screen.jsx` (runner, spec 1), `services/realtime-client.js`, `hooks/use-realtime-channel.js` — **never modified**, only consumed.
- The slide-to-finish control is copied nearly verbatim from spec 1's already-working `DragToFinishButton` (`components/session-runtime/training-session-live-screen.jsx`) — same `Gesture.Pan().runOnJS(true)`, `useSharedValue`/`useAnimatedStyle`, `onLayout` for width. Do not redesign the gesture.
- Message envelope: `send(type, payload, extra)` from `hooks/use-realtime-channel.js` → `sendMessage(channel, type, payload, extra)` from `services/realtime-client.js` → `buildMessage({channel, type, payload, ...extra})`. The real payload always goes inside `extra.payload` (the middle positional `payload` arg is always `undefined` in every existing call — mirror this exactly, do not "fix" it).
- `presence:joined`/`presence:left` go through the RAW `send` from `services/realtime-client.js` (not the hook's `send`) inside `onSubscribed`/`onBeforeUnsubscribe` — exact pattern already shipped in `hooks/use-live-session-runtime.js` lines 97-106.

---

### Task 1: Map bounds — pure function

**Files:**
- Create: `utils/map-bounds.js`
- Test: `__tests__/map-bounds.test.js`

**Interfaces:**
- Produces: `computeBounds(points)` where `points` is `Array<{latitude, longitude}>` → returns `[west, south, east, north]` (the shape `Camera.fitBounds` expects per `@maplibre/maplibre-react-native`'s `LngLatBounds`) or `null` if `points.length === 0`.

- [ ] **Step 1: Write the failing test**

```js
import { computeBounds } from '../utils/map-bounds.js';

describe('computeBounds', () => {
  test('sin puntos devuelve null', () => {
    expect(computeBounds([])).toBeNull();
  });

  test('un solo punto -- bounds degenerados en ese punto', () => {
    expect(computeBounds([{ latitude: -34.6, longitude: -58.4 }])).toEqual([-58.4, -34.6, -58.4, -34.6]);
  });

  test('varios puntos -- envuelve el rectángulo mínimo', () => {
    const points = [
      { latitude: -34.6, longitude: -58.4 },
      { latitude: -34.5, longitude: -58.45 },
      { latitude: -34.65, longitude: -58.38 },
    ];
    expect(computeBounds(points)).toEqual([-58.45, -34.65, -58.38, -34.5]);
  });

  test('ignora puntos sin latitude/longitude numéricos', () => {
    const points = [
      { latitude: -34.6, longitude: -58.4 },
      { latitude: null, longitude: -58.45 },
      {},
    ];
    expect(computeBounds(points)).toEqual([-58.4, -34.6, -58.4, -34.6]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest map-bounds -v`
Expected: FAIL with "Cannot find module '../utils/map-bounds.js'"

- [ ] **Step 3: Write minimal implementation**

```js
// Rectángulo mínimo que contiene todos los puntos, formato [west, south, east,
// north] -- el que espera cameraRef.current.fitBounds() de
// @maplibre/maplibre-react-native. Pura a propósito: la llamada imperativa a
// la cámara real no es testeable en Jest, pero el cálculo del rectángulo sí.
export function computeBounds(points) {
  const valid = (points ?? []).filter(
    (p) => typeof p?.latitude === 'number' && typeof p?.longitude === 'number',
  );
  if (valid.length === 0) return null;

  let west = valid[0].longitude;
  let east = valid[0].longitude;
  let south = valid[0].latitude;
  let north = valid[0].latitude;

  for (const point of valid) {
    if (point.longitude < west) west = point.longitude;
    if (point.longitude > east) east = point.longitude;
    if (point.latitude < south) south = point.latitude;
    if (point.latitude > north) north = point.latitude;
  }

  return [west, south, east, north];
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest map-bounds -v`
Expected: PASS (4/4)

- [ ] **Step 5: Commit**

```bash
git add utils/map-bounds.js __tests__/map-bounds.test.js
git commit -m "feat(trainer-live): add pure map bounds calculation"
```

---

### Task 2: Session set-count helpers — pure functions

**Files:**
- Create: `utils/trainer-participant-progress.js`
- Test: `__tests__/trainer-participant-progress.test.js`

**Interfaces:**
- Consumes: an `exercises` array shaped like `pendingSession.sessionInstance.exercises` — each item `{id, name, repeatCount, restMinutes}` (same shape already used throughout `session-pre-start-screen.jsx`/`session-db.js#createRun`).
- Produces: `countSetsForExercise(exercises, exerciseInstanceId)` → number; `totalSetsForSession(exercises)` → number. Task 3 consumes both.

- [ ] **Step 1: Write the failing test**

```js
import { countSetsForExercise, totalSetsForSession } from '../utils/trainer-participant-progress.js';

const EXERCISES = [
  { id: 10, name: 'Caminata', repeatCount: 1 },
  { id: 11, name: 'Sentadillas', repeatCount: 3 },
  { id: 12, name: 'Elongación', repeatCount: null },
];

describe('countSetsForExercise', () => {
  test('repeatCount definido', () => {
    expect(countSetsForExercise(EXERCISES, 11)).toBe(3);
  });

  test('repeatCount null -- mínimo 1', () => {
    expect(countSetsForExercise(EXERCISES, 12)).toBe(1);
  });

  test('ejercicio no encontrado -- 0', () => {
    expect(countSetsForExercise(EXERCISES, 999)).toBe(0);
  });

  test('compara id como string -- ids mixtos number/string no fallan', () => {
    expect(countSetsForExercise(EXERCISES, '11')).toBe(3);
  });
});

describe('totalSetsForSession', () => {
  test('suma repeatCount de todos los ejercicios', () => {
    expect(totalSetsForSession(EXERCISES)).toBe(5);
  });

  test('lista vacía o undefined -- 0', () => {
    expect(totalSetsForSession([])).toBe(0);
    expect(totalSetsForSession(undefined)).toBe(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest trainer-participant-progress -v`
Expected: FAIL with "Cannot find module"

- [ ] **Step 3: Write minimal implementation**

```js
// Cuántas series tiene un ejercicio de la sesión -- mismo criterio que
// session-db.js#createRun (repeatCount ?? 1, mínimo 1). Se usa para derivar
// cuántas series resuelve un update de "saltear ejercicio completo" (que llega
// como UN mensaje, no una serie a la vez), y para saber cuándo un atleta
// terminó TODO.
export function countSetsForExercise(exercises, exerciseInstanceId) {
  const exercise = (exercises ?? []).find((e) => String(e.id) === String(exerciseInstanceId));
  if (!exercise) return 0;
  return Math.max(1, exercise.repeatCount ?? 1);
}

export function totalSetsForSession(exercises) {
  return (exercises ?? []).reduce((sum, exercise) => sum + Math.max(1, exercise.repeatCount ?? 1), 0);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest trainer-participant-progress -v`
Expected: PASS (6/6)

- [ ] **Step 5: Commit**

```bash
git add utils/trainer-participant-progress.js __tests__/trainer-participant-progress.test.js
git commit -m "feat(trainer-live): add pure set-count helpers for participant progress"
```

---

### Task 3: Participant state reducer — pure function

**Files:**
- Create: `utils/trainer-participant-state.js`
- Test: `__tests__/trainer-participant-state.test.js`

**Interfaces:**
- Consumes: `countSetsForExercise`, `totalSetsForSession` from `utils/trainer-participant-progress.js` (Task 2). Message shapes exactly as shipped by the runner's hook (`hooks/use-live-session-runtime.js`): `presence:joined` payload `{}`, `presence:left` payload `{}`, `presence:position` payload `{latitude, longitude}`, `presence:set_status` payload EITHER `{setId, status}` (one series) OR `{exerciseInstanceId, status: 'skipped', scope: 'exercise'}` (whole exercise skipped). The envelope's `from: {userId, role}` field carries who sent it (server-assigned, never trust a client-supplied `from`) — confirm this is actually populated once the trainer screen is testable on device; if it turns out `from` is missing, every function here degrades gracefully by returning the participants map unchanged (see Step 3 comments).
- Produces: `PARTICIPANT_STATUS` enum object (`{NOT_JOINED, IN_PROGRESS, PAUSED, COMPLETED}`); `initParticipants(rosterMembers)` → `Map<string, Participant>` where a `Participant` is `{userId, name, photoUrl, joined, status, position, resolvedSetCount}`; `applyParticipantMessage(participants, msg, exercises)` → new `Map` (never mutates the input). Task 7 (the orchestration hook) and Task 10 (the live screen) consume this map shape directly — `participant.position` (`{latitude, longitude, ts} | null`) feeds the map markers, `participant.status` feeds the participant-list chips.

- [ ] **Step 1: Write the failing test**

```js
import {
  PARTICIPANT_STATUS,
  initParticipants,
  applyParticipantMessage,
} from '../utils/trainer-participant-state.js';

const ROSTER = [
  { userId: '12', name: 'Juan Pérez', photoUrl: 'https://x/12.jpg' },
  { userId: '13', name: 'Ana Gómez', photoUrl: null },
];

const EXERCISES = [
  { id: 500, name: 'Caminata', repeatCount: 1 },
  { id: 501, name: 'Sentadillas', repeatCount: 2 },
];

describe('initParticipants', () => {
  test('un participante por miembro del roster, todos not_joined', () => {
    const participants = initParticipants(ROSTER);
    expect(participants.size).toBe(2);
    expect(participants.get('12')).toEqual({
      userId: '12',
      name: 'Juan Pérez',
      photoUrl: 'https://x/12.jpg',
      joined: false,
      status: PARTICIPANT_STATUS.NOT_JOINED,
      position: null,
      resolvedSetCount: 0,
    });
  });
});

describe('applyParticipantMessage', () => {
  test('presence joined marca joined=true y pasa a in_progress', () => {
    const initial = initParticipants(ROSTER);
    const msg = { type: 'presence', event: 'joined', payload: {}, from: { userId: 12, role: 'corredor' } };
    const next = applyParticipantMessage(initial, msg, EXERCISES);
    expect(next.get('12').joined).toBe(true);
    expect(next.get('12').status).toBe(PARTICIPANT_STATUS.IN_PROGRESS);
    // No muta el mapa original
    expect(initial.get('12').joined).toBe(false);
  });

  test('presence left marca joined=false sin tocar el status', () => {
    const initial = initParticipants(ROSTER);
    const joined = applyParticipantMessage(initial, { type: 'presence', event: 'joined', payload: {}, from: { userId: 12 } }, EXERCISES);
    const left = applyParticipantMessage(joined, { type: 'presence', event: 'left', payload: {}, from: { userId: 12 } }, EXERCISES);
    expect(left.get('12').joined).toBe(false);
    expect(left.get('12').status).toBe(PARTICIPANT_STATUS.IN_PROGRESS);
  });

  test('presence position actualiza la posición', () => {
    const initial = initParticipants(ROSTER);
    const msg = { type: 'presence', event: 'position', payload: { latitude: -34.6, longitude: -58.4 }, ts: 1000, from: { userId: 13 } };
    const next = applyParticipantMessage(initial, msg, EXERCISES);
    expect(next.get('13').position).toEqual({ latitude: -34.6, longitude: -58.4, ts: 1000 });
  });

  test('set_status started -> in_progress, paused -> paused', () => {
    const initial = initParticipants(ROSTER);
    const started = applyParticipantMessage(initial, { type: 'presence', event: 'set_status', payload: { setId: 1, status: 'started' }, from: { userId: 12 } }, EXERCISES);
    expect(started.get('12').status).toBe(PARTICIPANT_STATUS.IN_PROGRESS);
    const paused = applyParticipantMessage(started, { type: 'presence', event: 'set_status', payload: { setId: 1, status: 'paused' }, from: { userId: 12 } }, EXERCISES);
    expect(paused.get('12').status).toBe(PARTICIPANT_STATUS.PAUSED);
  });

  test('set_status finished suma 1 al resolvedSetCount, completa si llega al total', () => {
    let participants = initParticipants(ROSTER);
    participants = applyParticipantMessage(participants, { type: 'presence', event: 'set_status', payload: { setId: 1, status: 'finished' }, from: { userId: '12' } }, EXERCISES);
    expect(participants.get('12').resolvedSetCount).toBe(1);
    expect(participants.get('12').status).toBe(PARTICIPANT_STATUS.IN_PROGRESS);
    // total de la sesión es 1 (Caminata) + 2 (Sentadillas) = 3 -- todavía no completó
    participants = applyParticipantMessage(participants, { type: 'presence', event: 'set_status', payload: { setId: 2, status: 'finished' }, from: { userId: '12' } }, EXERCISES);
    participants = applyParticipantMessage(participants, { type: 'presence', event: 'set_status', payload: { setId: 3, status: 'skipped' }, from: { userId: '12' } }, EXERCISES);
    expect(participants.get('12').resolvedSetCount).toBe(3);
    expect(participants.get('12').status).toBe(PARTICIPANT_STATUS.COMPLETED);
  });

  test('set_status scope exercise suma TODAS las series de ese ejercicio de una vez', () => {
    const initial = initParticipants(ROSTER);
    const msg = { type: 'presence', event: 'set_status', payload: { exerciseInstanceId: 501, status: 'skipped', scope: 'exercise' }, from: { userId: 13 } };
    const next = applyParticipantMessage(initial, msg, EXERCISES);
    expect(next.get('13').resolvedSetCount).toBe(2);
  });

  test('mensaje sin from.userId -- devuelve el mapa sin cambios', () => {
    const initial = initParticipants(ROSTER);
    const next = applyParticipantMessage(initial, { type: 'presence', event: 'joined', payload: {} }, EXERCISES);
    expect(next).toBe(initial);
  });

  test('from.userId de alguien fuera del roster -- se ignora (no agrega entradas nuevas)', () => {
    const initial = initParticipants(ROSTER);
    const next = applyParticipantMessage(initial, { type: 'presence', event: 'joined', payload: {}, from: { userId: 999 } }, EXERCISES);
    expect(next.size).toBe(2);
  });

  test('mensaje que no es type presence -- devuelve el mapa sin cambios', () => {
    const initial = initParticipants(ROSTER);
    const next = applyParticipantMessage(initial, { type: 'control', event: 'session_finished', from: { userId: 12 } }, EXERCISES);
    expect(next).toBe(initial);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest trainer-participant-state -v`
Expected: FAIL with "Cannot find module"

- [ ] **Step 3: Write minimal implementation**

```js
import { countSetsForExercise, totalSetsForSession } from './trainer-participant-progress.js';

// Estado por participante que ve la pantalla en vivo del entrenador,
// reconstruido PURAMENTE a partir del stream de mensajes WS -- el entrenador
// no tiene SQLite propio de otro atleta, así que esto es la única fuente de
// verdad mientras la pantalla está montada (el bootstrap por REST, Task 7,
// llena resolvedSetCount al abrir; de ahí en más este reducer sigue solo).
export const PARTICIPANT_STATUS = {
  NOT_JOINED: 'not_joined',
  IN_PROGRESS: 'in_progress',
  PAUSED: 'paused',
  COMPLETED: 'completed',
};

function emptyParticipant(userId, member) {
  return {
    userId,
    name: member?.name ?? null,
    photoUrl: member?.photoUrl ?? null,
    joined: false,
    status: PARTICIPANT_STATUS.NOT_JOINED,
    position: null,
    resolvedSetCount: 0,
  };
}

// `rosterMembers` -- mismo shape que useTeamRoster().members (Task 5: userId
// ya viene como string ahí). Un participante por miembro, todos "sin unirse".
export function initParticipants(rosterMembers) {
  const map = new Map();
  for (const member of rosterMembers ?? []) {
    map.set(String(member.userId), emptyParticipant(String(member.userId), member));
  }
  return map;
}

// Nunca muta `participants` -- devuelve el MISMO mapa (misma referencia) si el
// mensaje no aporta nada nuevo (no es `presence`, no trae `from.userId`, o ese
// userId no está en el roster), para que el caller pueda comparar por
// identidad y evitar un re-render de más.
export function applyParticipantMessage(participants, msg, exercises) {
  if (msg?.type !== 'presence') return participants;
  const userId = msg.from?.userId != null ? String(msg.from.userId) : null;
  if (!userId) return participants;

  const current = participants.get(userId);
  if (!current) return participants; // alguien fuera del roster de esta sesión -- se ignora

  const next = new Map(participants);

  if (msg.event === 'joined') {
    next.set(userId, {
      ...current,
      joined: true,
      status: current.status === PARTICIPANT_STATUS.NOT_JOINED ? PARTICIPANT_STATUS.IN_PROGRESS : current.status,
    });
    return next;
  }

  if (msg.event === 'left') {
    next.set(userId, { ...current, joined: false });
    return next;
  }

  if (msg.event === 'position') {
    next.set(userId, {
      ...current,
      position: { latitude: msg.payload?.latitude, longitude: msg.payload?.longitude, ts: msg.ts ?? Date.now() },
    });
    return next;
  }

  if (msg.event === 'set_status') {
    const { status, scope, exerciseInstanceId } = msg.payload ?? {};
    const addedSets = scope === 'exercise' ? countSetsForExercise(exercises, exerciseInstanceId) : (status === 'finished' || status === 'skipped') ? 1 : 0;
    const resolvedSetCount = current.resolvedSetCount + addedSets;
    const total = totalSetsForSession(exercises);

    let nextStatus = current.status;
    if (status === 'started') nextStatus = PARTICIPANT_STATUS.IN_PROGRESS;
    else if (status === 'paused') nextStatus = PARTICIPANT_STATUS.PAUSED;
    else if (addedSets > 0) nextStatus = total > 0 && resolvedSetCount >= total ? PARTICIPANT_STATUS.COMPLETED : PARTICIPANT_STATUS.IN_PROGRESS;

    next.set(userId, { ...current, resolvedSetCount, status: nextStatus });
    return next;
  }

  return participants;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest trainer-participant-state -v`
Expected: PASS (9/9)

- [ ] **Step 5: Commit**

```bash
git add utils/trainer-participant-state.js __tests__/trainer-participant-state.test.js
git commit -m "feat(trainer-live): add pure participant-state reducer for the live map/list"
```

---

### Task 4: Live records feed — pure reducer

**Files:**
- Create: `utils/trainer-records-feed.js`
- Test: `__tests__/trainer-records-feed.test.js`

**Interfaces:**
- Consumes: nothing from earlier tasks (standalone pure module).
- Produces: `appendFeedEvent(feed, event)` → new array, most-recent-first, deduped by `id`; `filterFeedByAthlete(feed, athleteUserId)` → filtered array (returns `feed` unchanged if `athleteUserId` is `null`/`undefined`). A `FeedEvent` is `{id, athleteUserId, athleteName, exerciseName, setNumber, status, timestamp}`. Task 7 builds these from both the REST bootstrap (Task 7) and live `update:set_event` messages; Task 10 (live screen) renders them and calls `filterFeedByAthlete`.

- [ ] **Step 1: Write the failing test**

```js
import { appendFeedEvent, filterFeedByAthlete } from '../utils/trainer-records-feed.js';

const EVENT_A = { id: 'a', athleteUserId: '12', athleteName: 'Juan', exerciseName: 'Caminata', setNumber: 1, status: 'finished', timestamp: 1000 };
const EVENT_B = { id: 'b', athleteUserId: '13', athleteName: 'Ana', exerciseName: 'Sentadillas', setNumber: 1, status: 'skipped', timestamp: 2000 };

describe('appendFeedEvent', () => {
  test('agrega al tope (más reciente primero)', () => {
    const feed = appendFeedEvent([EVENT_A], EVENT_B);
    expect(feed).toEqual([EVENT_B, EVENT_A]);
  });

  test('feed vacío -- el evento queda solo', () => {
    expect(appendFeedEvent([], EVENT_A)).toEqual([EVENT_A]);
  });

  test('mismo id ya presente -- lo reemplaza en vez de duplicar (edición de una serie ya vista)', () => {
    const updated = { ...EVENT_A, status: 'skipped' };
    const feed = appendFeedEvent([EVENT_A, EVENT_B], updated);
    expect(feed).toHaveLength(2);
    expect(feed.find((e) => e.id === 'a').status).toBe('skipped');
  });

  test('no muta el array original', () => {
    const original = [EVENT_A];
    appendFeedEvent(original, EVENT_B);
    expect(original).toEqual([EVENT_A]);
  });
});

describe('filterFeedByAthlete', () => {
  const feed = [EVENT_B, EVENT_A];

  test('sin athleteUserId devuelve todo tal cual', () => {
    expect(filterFeedByAthlete(feed, null)).toBe(feed);
    expect(filterFeedByAthlete(feed, undefined)).toBe(feed);
  });

  test('con athleteUserId filtra por ese atleta', () => {
    expect(filterFeedByAthlete(feed, '12')).toEqual([EVENT_A]);
  });

  test('compara como string -- un number también matchea', () => {
    expect(filterFeedByAthlete(feed, 13)).toEqual([EVENT_B]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest trainer-records-feed -v`
Expected: FAIL with "Cannot find module"

- [ ] **Step 3: Write minimal implementation**

```js
// Feed cronológico (más reciente primero) de series completadas/salteadas de
// TODOS los corredores de la sesión -- alimentado por el bootstrap REST
// (feedback ya sincronizado antes de que el entrenador se sumara) y por cada
// update:set_event que llega mientras la pantalla está montada.
export function appendFeedEvent(feed, event) {
  const withoutDuplicate = feed.filter((item) => item.id !== event.id);
  return [event, ...withoutDuplicate].sort((a, b) => b.timestamp - a.timestamp);
}

export function filterFeedByAthlete(feed, athleteUserId) {
  if (athleteUserId === null || athleteUserId === undefined) return feed;
  const needle = String(athleteUserId);
  return feed.filter((event) => String(event.athleteUserId) === needle);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest trainer-records-feed -v`
Expected: PASS (7/7)

- [ ] **Step 5: Commit**

```bash
git add utils/trainer-records-feed.js __tests__/trainer-records-feed.test.js
git commit -m "feat(trainer-live): add pure live-feed reducer (append/filter)"
```

---

### Task 5: Roster photo — extend `use-team-roster.js`

**Files:**
- Modify: `hooks/use-team-roster.js:53-67` (the `members` mapping)

**Interfaces:**
- Consumes: nothing new — `batchLookupUsers` (`services/user.js`) already resolves each user's raw DTO, which carries `photo_url` (confirmed in `services/normalizers.js:27`, `photoUrl: dto.photo_url ?? null`, same backend field used elsewhere for the exact same user model).
- Produces: `members[].photoUrl` (string URL or `null`) added to the existing shape (`id, userId, name, email, groupId, joinedAt, subscriptionStatus`) — purely additive, no existing field renamed or removed. Task 3's `initParticipants` and Task 9's participant list consume `member.photoUrl`.

This is a small, additive, backward-compatible change to a shared hook (no existing consumer reads a fixed key list that would break by gaining one more field) — needed because the map markers and participant list require a photo/initials fallback, and today's roster model silently drops the field that's already available on the raw user DTO.

- [ ] **Step 1: Read the current mapping**

`hooks/use-team-roster.js:53-67` today:

```js
  const members = teamUserDtos
    .map((teamUserDto) => {
      const user = userById.get(teamUserDto.user_id);
      if (!user) return null;
      return {
        id: String(teamUserDto.user_id),
        userId: String(teamUserDto.user_id),
        name: `${user.name ?? ''} ${user.surname ?? ''}`.trim() || user.email,
        email: user.email,
        groupId: groupIdByUserId.get(teamUserDto.user_id) ?? null,
        joinedAt: teamUserDto.assignment_date ?? null,
        subscriptionStatus: null,
      };
    })
    .filter(Boolean);
```

- [ ] **Step 2: Add `photoUrl` to the returned member**

```js
  const members = teamUserDtos
    .map((teamUserDto) => {
      const user = userById.get(teamUserDto.user_id);
      if (!user) return null;
      return {
        id: String(teamUserDto.user_id),
        userId: String(teamUserDto.user_id),
        name: `${user.name ?? ''} ${user.surname ?? ''}`.trim() || user.email,
        email: user.email,
        photoUrl: user.photo_url ?? null,
        groupId: groupIdByUserId.get(teamUserDto.user_id) ?? null,
        joinedAt: teamUserDto.assignment_date ?? null,
        subscriptionStatus: null,
      };
    })
    .filter(Boolean);
```

- [ ] **Step 3: Run the full suite to confirm no existing test asserts an exact member shape that would now fail**

Run: `npx jest -v 2>&1 | tail -20`
Expected: PASS, same count as before this change (no `__tests__/use-team-roster*` file exists today — confirmed before writing this plan — so this step is a regression check on the rest of the suite, not a new assertion).

- [ ] **Step 4: Commit**

```bash
git add hooks/use-team-roster.js
git commit -m "feat(trainer-live): expose photoUrl on team roster members"
```

---

### Task 6: Document the backend confirmation gap

**Files:**
- Modify: `docs/BACKEND_API_GAPS.md` (append after Gap 19)

**Interfaces:** None — documentation only, no code produced or consumed.

- [ ] **Step 1: Read the last existing gap section for exact format**

`docs/BACKEND_API_GAPS.md`'s Gap 19 (just added) ends with a `## Gap 19 — ...` heading followed by prose paragraphs and a closing "Impacto en frontend" paragraph — match that structure.

- [ ] **Step 2: Append Gap 20**

```markdown

## Gap 20 — confirmar 2 comportamientos del bus de tiempo real para el cliente entrenador

Dos confirmaciones necesarias para la pantalla en vivo del entrenador (spec
`docs/superpowers/specs/2026-09-30-presencial-live-session-trainer-design.md`), ninguna bloquea el
plan — las dos tienen fallback ya decidido.

1. **`GET /session-instances/:id/feedback` sin `?athlete_user_id=` — ¿devuelve todos los atletas de
   la sesión?** Siempre se documentó y usó con ese filtro puesto (un atleta puntual). El feed de
   registros del entrenador necesita ver el progreso de TODOS los corredores, incluido lo que pasó
   antes de que el entrenador se sumara. **Fallback ya implementado (Task 7 de este plan):**
   fan-out de `useQueries`, una consulta `?athlete_user_id=` por miembro del roster, mismo patrón
   que `hooks/use-team-roster.js` usa para resolver nombres. Si el filtro resulta ser opcional,
   se simplifica a una sola consulta más adelante.
2. **El envelope de cada mensaje WS reenviado declara `from: {userId, role}`, asignado por el
   servidor — ¿está esto realmente implementado en el gateway ya desplegado?** El cliente corredor
   (spec 1) nunca tuvo que leer `from` (solo procesa `control`, siempre asumido del entrenador). El
   cliente entrenador SÍ depende de `from.userId` para saber a qué corredor pertenece cada
   `presence:joined/left/position/set_status` — esos mensajes no llevan el id del atleta en su
   `payload` (a diferencia de `update:set_event`, que sí trae `athleteUserId` explícito). **Sin
   confirmar, el mapa/lista de participantes simplemente no atribuye ningún mensaje a nadie** (el
   reducer de `utils/trainer-participant-state.js` ignora silenciosamente cualquier mensaje sin
   `from.userId`, sin romper nada, pero sin mostrar nada tampoco).
3. **Casing exacto del payload de `update:set_event`** — la spec 1 lo documentó en prosa
   ("payload incluye los mismos campos persistidos + athleteUserId") sin fijar si es
   `athlete_user_id` (snake, como el resto del DTO de `workout_feedback`) o `athleteUserId`
   (camel). El cliente entrenador (Task 7) lee ambas variantes defensivamente hasta confirmar.

**Impacto en frontend:** sin acción pendiente mientras se confirma — los tres puntos ya tienen
manejo defensivo en el código de este plan (Task 7), listos para simplificarse si backend confirma
el camino más simple en cada caso.
```

- [ ] **Step 3: Commit**

```bash
git add docs/BACKEND_API_GAPS.md
git commit -m "docs(gaps): add Gap 20 — confirm from.userId and all-athletes feedback for trainer live view"
```

---

### Task 7: Trainer session runtime hook

**Files:**
- Create: `hooks/use-trainer-session-runtime.js`

**Interfaces:**
- Consumes: `useRealtimeChannel` (`hooks/use-realtime-channel.js`, signature `useRealtimeChannel(channel, {onMessage, enabled, onSubscribed, onBeforeUnsubscribe}) → {status, send}`), `send as sendRaw` (`services/realtime-client.js`, signature `send(channel, type, payload, extra)`), `useSessionGpsTracker` (`hooks/use-session-gps-tracker.js`, signature `useSessionGpsTracker(enabled) → {start({onPoint}), stop()}`), `useLiveSessionStore` (`store/live-session-store.js`, only `gpsEnabled`/`setGpsEnabled` — `runId`/`setSessionStarted`/`clearLiveSession` are NOT used, the trainer has no run), `getSessionFeedback` (`services/runnerSession.js`), `toSessionFeedbackModel` (`services/normalizers.js`), `initParticipants`/`applyParticipantMessage`/`PARTICIPANT_STATUS` (Task 3), `appendFeedEvent` (Task 4), `useQueries` (`@tanstack/react-query`).
- Produces: `useTrainerSessionRuntime({ sessionInstanceId, exercises, rosterMembers })` → `{ connectionStatus, participants, feed, gpsEnabled, finalize }`. `participants` is the `Map<string, Participant>` from Task 3 (already merged with the REST bootstrap's `resolvedSetCount`). `feed` is the sorted array from Task 4. `finalize()` sends `control:session_finished` to the whole channel and returns a Promise that resolves once sent (fire-and-forget at the transport level, like every other `send()` call in this bus — there's no ack). Task 10 (the live screen) consumes all four.

- [ ] **Step 1: Write the hook**

```js
import { useEffect, useMemo, useRef, useState } from 'react';
import { useQueries } from '@tanstack/react-query';
import { useLiveSessionStore } from '../store/live-session-store.js';
import { useRealtimeChannel } from './use-realtime-channel.js';
import { useSessionGpsTracker } from './use-session-gps-tracker.js';
import { send as sendRaw } from '../services/realtime-client.js';
import { getSessionFeedback } from '../services/runnerSession.js';
import { toSessionFeedbackModel } from '../services/normalizers.js';
import { initParticipants, applyParticipantMessage } from '../utils/trainer-participant-state.js';
import { appendFeedEvent } from '../utils/trainer-records-feed.js';
import { logDebug } from '../utils/debug-log.js';

// Motor no-visual de la pantalla en vivo del entrenador. A diferencia de
// hooks/use-live-session-runtime.js (corredor), acá NO hay SQLite ni ningún
// session_run local -- el entrenador es supervisor, no ejecuta series. Su GPS
// es incondicional mientras la pantalla está montada (sin el gate por serie
// activa que tiene el corredor, porque no hay series propias que gatear).
export function useTrainerSessionRuntime({ sessionInstanceId, exercises, rosterMembers }) {
  const gpsEnabled = useLiveSessionStore((s) => s.gpsEnabled);

  const [participants, setParticipants] = useState(() => initParticipants(rosterMembers));
  const [feed, setFeed] = useState([]);
  const [bootstrapped, setBootstrapped] = useState(false);

  const channel = sessionInstanceId ? `session:${sessionInstanceId}` : null;

  const handleChannelMessage = (msg) => {
    if (msg.type === 'presence') {
      setParticipants((current) => applyParticipantMessage(current, msg, exercises));
      return;
    }
    if (msg.type === 'update' && msg.event === 'set_event') {
      const payload = msg.payload ?? {};
      // Casing defensivo hasta confirmar Gap 20 -- probar snake primero (es el
      // que usa el resto del DTO de workout_feedback vía REST).
      const athleteUserId = payload.athlete_user_id ?? payload.athleteUserId;
      if (athleteUserId == null) return;
      const feedback = toSessionFeedbackModel(payload);
      if (!feedback) return;
      const member = rosterMembers.find((m) => String(m.userId) === String(athleteUserId));
      setFeed((current) => appendFeedEvent(current, {
        id: feedback.id,
        athleteUserId: String(athleteUserId),
        athleteName: member?.name ?? `Atleta ${athleteUserId}`,
        exerciseName: feedback.exerciseName ?? '',
        setNumber: feedback.setNumber,
        status: feedback.completionStatus,
        timestamp: new Date(feedback.updatedAt ?? feedback.endedAt ?? Date.now()).getTime(),
      }));
    }
  };

  const { status: connectionStatus, send } = useRealtimeChannel(channel, {
    onMessage: handleChannelMessage,
    enabled: Boolean(channel),
    onSubscribed: () => sendRaw(channel, 'presence', undefined, { event: 'joined', payload: {} }),
    onBeforeUnsubscribe: () => sendRaw(channel, 'presence', undefined, { event: 'left', payload: {} }),
  });

  // Bootstrap del feed: un fan-out de GET .../feedback?athlete_user_id= por
  // cada miembro del roster (Gap 20, punto 1 -- fallback ya implementado acá
  // desde el principio, no una rama condicional). Cubre lo que ya pasó ANTES
  // de que el entrenador se sumara; de ahí en más, update:set_event lo sigue.
  const feedbackQueries = useQueries({
    queries: (rosterMembers ?? []).map((member) => ({
      queryKey: ['session-feedback', sessionInstanceId, member.userId],
      queryFn: () => getSessionFeedback(sessionInstanceId, member.userId),
      enabled: Boolean(sessionInstanceId && member.userId),
    })),
  });

  const feedbackQueriesResolved = feedbackQueries.length > 0 && feedbackQueries.every((q) => q.isFetched);

  useEffect(() => {
    if (bootstrapped || !feedbackQueriesResolved) return;
    let bootstrapFeed = [];
    let resolvedByAthlete = new Map();
    feedbackQueries.forEach((query, index) => {
      const member = rosterMembers[index];
      const rows = (query.data?.data ?? []).map(toSessionFeedbackModel).filter(Boolean);
      resolvedByAthlete.set(String(member.userId), rows.length);
      for (const row of rows) {
        bootstrapFeed = appendFeedEvent(bootstrapFeed, {
          id: row.id,
          athleteUserId: String(member.userId),
          athleteName: member.name,
          exerciseName: row.exerciseName ?? '',
          setNumber: row.setNumber,
          status: row.completionStatus,
          timestamp: new Date(row.updatedAt ?? row.endedAt ?? 0).getTime(),
        });
      }
    });
    setFeed(bootstrapFeed);
    setParticipants((current) => {
      const next = new Map(current);
      for (const [userId, count] of resolvedByAthlete.entries()) {
        const existing = next.get(userId);
        if (existing) next.set(userId, { ...existing, resolvedSetCount: count });
      }
      return next;
    });
    setBootstrapped(true);
    logDebug(`[trainer-live] bootstrap feed OK, ${bootstrapFeed.length} eventos previos`);
  }, [bootstrapped, feedbackQueriesResolved, feedbackQueries, rosterMembers]);

  const gps = useSessionGpsTracker(gpsEnabled);

  useEffect(() => {
    if (!channel) return undefined;
    gps.start({
      onPoint: (point) => {
        send('presence', undefined, { event: 'position', payload: { latitude: point.latitude, longitude: point.longitude } });
      },
    });
    return () => { gps.stop(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [channel]);

  const finalize = async () => {
    logDebug('[trainer-live] finalize -- control:session_finished a todo el canal');
    send('control', undefined, { event: 'session_finished', to: 'all', payload: {} });
  };

  return { connectionStatus, participants, feed, gpsEnabled, finalize };
}
```

- [ ] **Step 2: Verify lint is clean**

Run: `npx eslint hooks/use-trainer-session-runtime.js`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add hooks/use-trainer-session-runtime.js
git commit -m "feat(trainer-live): add trainer session orchestration hook (WS + GPS + feed bootstrap)"
```

---

### Task 8: Attendance session modal

**Files:**
- Create: `components/session-runtime/attendance-session-modal.jsx`

**Interfaces:**
- Consumes: `useSessionAttendance(sessionInstanceId, teamId, groupId)`, `useSaveAttendance(teamId)`, `useDeleteAttendance(teamId)` (`hooks/use-attendance.js`, exact shapes confirmed: `useSessionAttendance` → `{rows, summary, session, isLoading, isRefetching, error, refetch}`; `useSaveAttendance` → `{saveAttendance, isSaving, error}` where `saveAttendance({teamId, trainingSessionId, userIds})` throws on failure, Pattern C; `useDeleteAttendance` → `{deleteAttendance, isDeleting, error}` where `deleteAttendance({attendanceId})` throws on failure). `AttendanceGrid` (`components/attendance/attendance-grid.jsx`, props: `rows, summary, isLoading, isRefetching, error, selectedIds, onToggle, onRequestDelete, onSave, onRetry, onRefresh, isSaving, idPrefix`). `AttendanceQrModal` (`components/attendance/attendance-qr-modal.jsx`, props: `visible, onClose, teamName, session, teamId, sessionInstanceId, formatDate`). `formatSessionDate` (`components/attendance/attendance-selection-panel.jsx`). `ConfirmDestructiveModal` (`components/shared/confirm-destructive-modal.jsx`). `DiscardChangesModal` (`components/shared/discard-changes-modal.jsx`). `notifyError/notifySuccess/notifyWarning` (`utils/haptics.js`).
- Produces: `AttendanceSessionModal({visible, onClose, teamId, groupId, sessionInstanceId, teamName, sessionName, sessionDate})` — a self-contained `Modal`. Tasks 9 and 10 render this exact component with the ids/names already known from `pendingSession`.

- [ ] **Step 1: Write the component**

```jsx
import { useCallback, useEffect, useState } from 'react';
import { Modal, Pressable, Text, View } from 'react-native';
import Toast from 'react-native-toast-message';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useThemeColors } from '../../theme/colors.js';
import { useSessionAttendance, useSaveAttendance, useDeleteAttendance } from '../../hooks/use-attendance.js';
import { AttendanceGrid } from '../attendance/attendance-grid.jsx';
import { AttendanceQrModal } from '../attendance/attendance-qr-modal.jsx';
import { formatSessionDate } from '../attendance/attendance-selection-panel.jsx';
import { ConfirmDestructiveModal } from '../shared/confirm-destructive-modal.jsx';
import { DiscardChangesModal } from '../shared/discard-changes-modal.jsx';
import { notifyError, notifySuccess, notifyWarning } from '../../utils/haptics.js';

// Empaqueta components/attendance/ (AttendanceGrid + AttendanceQrModal, sin
// modificarlos) para una sesión YA CONOCIDA -- sin el selector team→grupo→
// sesión de AttendanceScreen, porque acá los tres ids ya se saben de
// pendingSession. Un solo componente, usado desde el pre-start y la pantalla
// en vivo del entrenador.
export function AttendanceSessionModal({ visible, onClose, teamId, groupId, sessionInstanceId, teamName, sessionName, sessionDate }) {
  const colors = useThemeColors();
  const idPrefix = 'attendance-session-modal';

  const { rows, summary, isLoading, isRefetching, error, refetch } = useSessionAttendance(sessionInstanceId, teamId, groupId);
  const [selectedIds, setSelectedIds] = useState(() => new Set());
  const [discardVisible, setDiscardVisible] = useState(false);
  const [pendingDelete, setPendingDelete] = useState(null);
  const [qrModalVisible, setQrModalVisible] = useState(false);

  const toggleRow = useCallback((userId) => {
    const key = String(userId);
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  const { saveAttendance, isSaving } = useSaveAttendance(teamId);
  const { deleteAttendance, isDeleting } = useDeleteAttendance(teamId);

  useEffect(() => { if (pendingDelete) notifyWarning(); }, [pendingDelete]);

  const handleSave = async () => {
    if (selectedIds.size === 0) return;
    try {
      const result = await saveAttendance({ teamId, trainingSessionId: sessionInstanceId, userIds: [...selectedIds] });
      setSelectedIds(new Set());
      notifySuccess();
      Toast.show({
        type: 'success',
        text1: 'Asistencia guardada',
        text2: `${result?.created ?? 0} nueva${(result?.created ?? 0) === 1 ? '' : 's'}, ${result?.updated ?? 0} actualizada${(result?.updated ?? 0) === 1 ? '' : 's'}`,
      });
    } catch (err) {
      notifyError();
      if (err.status === 403) {
        Toast.show({ type: 'error', text1: 'No administrás ese equipo', text2: 'Pedile a otro entrenador del equipo que cargue la asistencia.' });
      } else if (err.status === 422) {
        Toast.show({ type: 'error', text1: 'No se pudo guardar', text2: 'La sesión dejó de ser presencial o algún corredor no era del grupo en esa fecha.' });
      } else {
        Toast.show({ type: 'error', text1: 'No se pudo guardar la asistencia', text2: err.message });
      }
    }
  };

  const handleRequestDelete = useCallback((row) => setPendingDelete(row), []);
  const handleCancelDelete = () => { if (!isDeleting) setPendingDelete(null); };

  const handleConfirmDelete = async () => {
    if (!pendingDelete || isDeleting) return;
    try {
      await deleteAttendance({ attendanceId: pendingDelete.attendance_id });
      setSelectedIds((current) => {
        const next = new Set(current);
        next.delete(String(pendingDelete.user_id));
        return next;
      });
      setPendingDelete(null);
      notifySuccess();
      Toast.show({ type: 'success', text1: 'Asistencia eliminada' });
    } catch (err) {
      notifyError();
      Toast.show({ type: 'error', text1: 'No se pudo eliminar', text2: err.message });
    }
  };

  // Sin useUnsavedChangesGuard/usePreventRemove: no hay navegación que
  // interceptar acá, solo un Modal con dos vías de cierre que ya controlamos
  // (backdrop y el botón de cerrar) -- las dos pasan por este mismo embudo.
  const handleRequestClose = () => {
    if (selectedIds.size > 0) {
      setDiscardVisible(true);
      return;
    }
    onClose();
  };

  const session = { name: sessionName, date: sessionDate };

  return (
    <Modal animationType="fade" nativeID={`${idPrefix}-modal`} onRequestClose={handleRequestClose} testID={`${idPrefix}-modal`} transparent visible={visible}>
      <Pressable className="flex-1 items-end bg-black/50" nativeID={`${idPrefix}-backdrop`} onPress={handleRequestClose} testID={`${idPrefix}-backdrop`}>
        <Pressable
          className="h-full w-full max-w-lg bg-white p-4 dark:bg-surface"
          nativeID={`${idPrefix}-card`}
          onPress={() => {}}
          testID={`${idPrefix}-card`}
        >
          <View className="mb-3 flex-row items-center justify-between" nativeID={`${idPrefix}-header`} testID={`${idPrefix}-header`}>
            <Text className="text-lg font-bold text-slate-900 dark:text-white" nativeID={`${idPrefix}-title`} testID={`${idPrefix}-title`}>
              Asistencia
            </Text>
            <View className="flex-row items-center gap-2" nativeID={`${idPrefix}-header-actions`} testID={`${idPrefix}-header-actions`}>
              <Pressable
                className="h-9 flex-row items-center gap-1.5 rounded-full border border-slate-200 px-3 active:opacity-70 dark:border-slate-700"
                nativeID={`${idPrefix}-qr-button`}
                onPress={() => setQrModalVisible(true)}
                testID={`${idPrefix}-qr-button`}
              >
                <MaterialCommunityIcons color={colors.onSurfaceVariant} name="qrcode" size={16} />
                <Text className="text-xs font-semibold text-slate-700 dark:text-slate-200" nativeID={`${idPrefix}-qr-button-label`} testID={`${idPrefix}-qr-button-label`}>
                  Mostrar QR
                </Text>
              </Pressable>
              <Pressable className="h-9 w-9 items-center justify-center rounded-full active:opacity-70" nativeID={`${idPrefix}-close-button`} onPress={handleRequestClose} testID={`${idPrefix}-close-button`}>
                <MaterialCommunityIcons color={colors.onSurfaceVariant} name="close" size={22} />
              </Pressable>
            </View>
          </View>

          <AttendanceGrid
            error={error}
            idPrefix={`${idPrefix}-grid`}
            isLoading={isLoading}
            isRefetching={isRefetching}
            isSaving={isSaving}
            onRefresh={refetch}
            onRequestDelete={handleRequestDelete}
            onRetry={refetch}
            onSave={handleSave}
            onToggle={toggleRow}
            rows={rows}
            selectedIds={selectedIds}
            summary={summary}
          />
        </Pressable>
      </Pressable>

      <DiscardChangesModal onCancel={() => setDiscardVisible(false)} onConfirm={() => { setDiscardVisible(false); setSelectedIds(new Set()); onClose(); }} visible={discardVisible} />

      <ConfirmDestructiveModal
        confirmLabel="Eliminar"
        description={pendingDelete ? `Vas a eliminar la asistencia de ${pendingDelete.name} a la sesión del ${formatSessionDate(sessionDate)}. Esta acción no se puede deshacer.` : ''}
        idPrefix={`${idPrefix}-delete-attendance`}
        loading={isDeleting}
        onCancel={handleCancelDelete}
        onConfirm={handleConfirmDelete}
        title="Eliminar asistencia"
        visible={Boolean(pendingDelete)}
      />

      <AttendanceQrModal
        formatDate={formatSessionDate}
        onClose={() => setQrModalVisible(false)}
        session={session}
        sessionInstanceId={sessionInstanceId}
        teamId={teamId}
        teamName={teamName}
        visible={qrModalVisible}
      />
    </Modal>
  );
}
```

- [ ] **Step 2: Verify `ConfirmDestructiveModal`'s exact prop names before running lint**

Read `components/shared/confirm-destructive-modal.jsx`'s export signature — if any prop name above (`confirmLabel`, `description`, `idPrefix`, `loading`, `onCancel`, `onConfirm`, `title`, `visible`) differs from the real component, fix this file to match before proceeding (this plan wrote them from the exact call site already shipped in `attendance-screen.jsx`, so they should match, but confirm before committing).

- [ ] **Step 3: Verify lint is clean**

Run: `npx eslint components/session-runtime/attendance-session-modal.jsx`
Expected: no errors (in particular, no `local/require-modal-backdrop-close` failure — the backdrop `Pressable` has `onPress`).

- [ ] **Step 4: Commit**

```bash
git add components/session-runtime/attendance-session-modal.jsx
git commit -m "feat(trainer-live): add attendance modal composing existing attendance module"
```

---

### Task 9: Trainer pre-start screen + route

**Files:**
- Create: `components/session-runtime/trainer-session-pre-start-screen.jsx`
- Create: `app/trainer-session-pre-start.jsx`

**Interfaces:**
- Consumes: `useSessionRuntimeStore` (`store/session-runtime-store.js`, `pendingSession`), `useAuthStore` (`store/auth-store.js`, `userId`), `useTeamRoster` (`hooks/use-team-roster.js`, Task 5's extended shape), `filterByName` (`utils/attendance-filter.js`), `MobileOnlyRoute` (`components/guards/platform-gate.jsx`), `AttendanceSessionModal` (Task 8), `openLocationInMaps`/`formatWeekdayLabel`/`formatDisplayDate` (same imports `session-pre-start-screen.jsx` already uses — `utils/format-date-display.js`, and `Linking` from `react-native` for the maps link, since `openLocationInMaps` itself is a private, unexported function local to `session-pre-start-screen.jsx` — copy the same 5-line function here, do not import from that file).
- Produces: `TrainerSessionPreStartScreen` (default export from the route file wraps it in `MobileOnlyRoute` at the component's own top level, same pattern as `SessionPreStartScreen`). Nothing else consumes this — it's a route leaf.

- [ ] **Step 1: Write the screen**

```jsx
import { useState } from 'react';
import { Linking, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Redirect, useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useThemeColors } from '../../theme/colors.js';
import { MobileOnlyRoute } from '../guards/platform-gate.jsx';
import { useSessionRuntimeStore } from '../../store/session-runtime-store.js';
import { useAuthStore } from '../../store/auth-store.js';
import { useTeamRoster } from '../../hooks/use-team-roster.js';
import { filterByName } from '../../utils/attendance-filter.js';
import { formatDisplayDate, formatWeekdayLabel } from '../../utils/format-date-display.js';
import { AttendanceSessionModal } from './attendance-session-modal.jsx';

// Mismo criterio que session-pre-start-screen.jsx (URL universal de Google
// Maps, coordenadas no label) -- copiado, no importado: esa función no está
// exportada y ese archivo no se toca.
function openLocationInMaps(location) {
  if (!location?.lat || !location?.lng) return;
  Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${location.lat},${location.lng}`);
}

const PARTICIPANTS_COLLAPSED_COUNT = 5;

function ExerciseRow({ exercise, idPrefix }) {
  const rowId = `${idPrefix}-exercise-${exercise.id}`;
  return (
    <View className="rounded-xl border border-slate-200 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-900" nativeID={rowId} testID={rowId}>
      <Text className="text-sm font-semibold text-slate-900 dark:text-white" nativeID={`${rowId}-name`} testID={`${rowId}-name`}>
        {exercise.name}
      </Text>
      <Text className="text-xs text-slate-500 dark:text-slate-400" nativeID={`${rowId}-detail`} testID={`${rowId}-detail`}>
        {exercise.repeatCount} serie{exercise.repeatCount > 1 ? 's' : ''} · descanso {exercise.restMinutes} min
      </Text>
    </View>
  );
}

function ParticipantRow({ member, idPrefix }) {
  const rowId = `${idPrefix}-participant-${member.userId}`;
  return (
    <View className="flex-row items-center gap-2.5 rounded-xl border border-slate-200 bg-white p-2.5 dark:border-slate-700 dark:bg-slate-900" nativeID={rowId} testID={rowId}>
      {member.photoUrl ? (
        <View className="h-9 w-9 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700" nativeID={`${rowId}-photo`} testID={`${rowId}-photo`}>
          <Text className="sr-only" nativeID={`${rowId}-photo-placeholder`} testID={`${rowId}-photo-placeholder`}>{member.name}</Text>
        </View>
      ) : (
        <View className="h-9 w-9 items-center justify-center rounded-full bg-primary/20" nativeID={`${rowId}-initials`} testID={`${rowId}-initials`}>
          <Text className="text-xs font-bold text-primary" nativeID={`${rowId}-initials-label`} testID={`${rowId}-initials-label`}>
            {member.name.slice(0, 2).toUpperCase()}
          </Text>
        </View>
      )}
      <Text className="flex-1 text-sm font-semibold text-slate-900 dark:text-white" nativeID={`${rowId}-name`} numberOfLines={1} testID={`${rowId}-name`}>
        {member.name}
      </Text>
    </View>
  );
}

function TrainerSessionPreStartScreenContent() {
  const router = useRouter();
  const colors = useThemeColors();
  const pendingSession = useSessionRuntimeStore((s) => s.pendingSession);
  const userId = useAuthStore((s) => s.userId);
  const [participantsExpanded, setParticipantsExpanded] = useState(false);
  const [participantsQuery, setParticipantsQuery] = useState('');
  const [attendanceVisible, setAttendanceVisible] = useState(false);

  const teamId = pendingSession?.teamId ?? null;
  const groupId = pendingSession?.groupId ?? null;
  const { members, loading: rosterLoading } = useTeamRoster(teamId, groupId ? [groupId] : []);

  if (!pendingSession) return <Redirect href="/" />;

  const exercises = pendingSession.sessionInstance?.exercises ?? [];
  const sortedMembers = [...members].sort((a, b) => a.name.localeCompare(b.name));
  const visibleMembers = participantsExpanded ? filterByName(sortedMembers, participantsQuery) : sortedMembers.slice(0, PARTICIPANTS_COLLAPSED_COUNT);

  const handlePlay = () => {
    router.push('/trainer-session-live');
  };

  return (
    <SafeAreaView className="flex-1 bg-paper dark:bg-ink" edges={['top', 'bottom']} nativeID="trainer-session-pre-start-screen-root" testID="trainer-session-pre-start-screen-root">
      <ScrollView contentContainerClassName="px-4 py-6" nativeID="trainer-session-pre-start-screen-scroll" testID="trainer-session-pre-start-screen-scroll">
        <View className="flex-row items-center justify-between" nativeID="trainer-session-pre-start-screen-header-row" testID="trainer-session-pre-start-screen-header-row">
          <Pressable className="h-9 w-9 items-center justify-center rounded-full active:opacity-70" nativeID="trainer-session-pre-start-screen-back-button" onPress={() => router.back()} testID="trainer-session-pre-start-screen-back-button">
            <MaterialCommunityIcons color={colors.onSurfaceVariant} name="arrow-left" size={20} />
          </Pressable>
          <Pressable
            className="h-9 flex-row items-center gap-1.5 rounded-full border border-slate-200 px-3 active:opacity-70 dark:border-slate-700"
            nativeID="trainer-session-pre-start-screen-attendance-button"
            onPress={() => setAttendanceVisible(true)}
            testID="trainer-session-pre-start-screen-attendance-button"
          >
            <MaterialCommunityIcons color={colors.onSurfaceVariant} name="clipboard-check-outline" size={18} />
            <Text className="text-xs font-semibold text-slate-700 dark:text-slate-200" nativeID="trainer-session-pre-start-screen-attendance-button-label" testID="trainer-session-pre-start-screen-attendance-button-label">
              Asistencia
            </Text>
          </Pressable>
        </View>

        <View className="mb-6 mt-4 items-center" nativeID="trainer-session-pre-start-screen-title-block" testID="trainer-session-pre-start-screen-title-block">
          <Text className="text-base text-slate-500 dark:text-slate-400" nativeID="trainer-session-pre-start-screen-date" testID="trainer-session-pre-start-screen-date">
            {formatWeekdayLabel(pendingSession.date)}, {formatDisplayDate(pendingSession.date)}
            {pendingSession.presencialTimeFrom ? ` · ${pendingSession.presencialTimeFrom}–${pendingSession.presencialTimeTo}` : ''}
          </Text>
          <Text className="mt-1 text-center text-3xl text-slate-900 dark:text-white" nativeID="trainer-session-pre-start-screen-title" style={{ fontFamily: 'Orbitron_700Bold' }} testID="trainer-session-pre-start-screen-title">
            {pendingSession.sessionInstance?.name ?? 'Entrenamiento'}
          </Text>
          {(pendingSession.teamName || pendingSession.groupName) && (
            <View className="mt-2 flex-row items-center gap-4" nativeID="trainer-session-pre-start-screen-scope" testID="trainer-session-pre-start-screen-scope">
              {pendingSession.teamName && (
                <View className="flex-row items-center gap-1" nativeID="trainer-session-pre-start-screen-team" testID="trainer-session-pre-start-screen-team">
                  <MaterialCommunityIcons color={colors.onSurfaceVariant} name="shield-account-outline" size={16} />
                  <Text className="text-sm font-semibold text-slate-600 dark:text-slate-300" nativeID="trainer-session-pre-start-screen-team-label" testID="trainer-session-pre-start-screen-team-label">
                    {pendingSession.teamName}
                  </Text>
                </View>
              )}
              {pendingSession.groupName && (
                <View className="flex-row items-center gap-1" nativeID="trainer-session-pre-start-screen-group" testID="trainer-session-pre-start-screen-group">
                  <MaterialCommunityIcons color={colors.onSurfaceVariant} name="account-multiple-outline" size={16} />
                  <Text className="text-sm font-semibold text-slate-600 dark:text-slate-300" nativeID="trainer-session-pre-start-screen-group-label" testID="trainer-session-pre-start-screen-group-label">
                    {pendingSession.groupName}
                  </Text>
                </View>
              )}
            </View>
          )}
          {pendingSession.presencialLocation?.label && (
            <Pressable
              className="mt-2 max-w-full flex-row items-center gap-1 px-4"
              nativeID="trainer-session-pre-start-screen-presencial-location"
              onPress={() => openLocationInMaps(pendingSession.presencialLocation)}
              testID="trainer-session-pre-start-screen-presencial-location"
            >
              <MaterialCommunityIcons color={colors.primary} name="map-marker-outline" size={16} />
              <Text className="text-sm font-semibold text-primary underline" nativeID="trainer-session-pre-start-screen-presencial-location-label" numberOfLines={1} testID="trainer-session-pre-start-screen-presencial-location-label">
                {pendingSession.presencialLocation.label}
              </Text>
            </Pressable>
          )}
        </View>

        <View className="mb-4" nativeID="trainer-session-pre-start-screen-exercise-container" testID="trainer-session-pre-start-screen-exercise-container">
          <Text className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400" nativeID="trainer-session-pre-start-screen-exercise-container-label" testID="trainer-session-pre-start-screen-exercise-container-label">
            Ejercicios de la sesión ({exercises.length})
          </Text>
          <View className="gap-2" nativeID="trainer-session-pre-start-screen-exercise-list" testID="trainer-session-pre-start-screen-exercise-list">
            {exercises.map((exercise) => (
              <ExerciseRow exercise={exercise} idPrefix="trainer-session-pre-start-screen" key={exercise.id} />
            ))}
          </View>
        </View>

        <View className="mb-4" nativeID="trainer-session-pre-start-screen-participants-container" testID="trainer-session-pre-start-screen-participants-container">
          <Text className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400" nativeID="trainer-session-pre-start-screen-participants-label" testID="trainer-session-pre-start-screen-participants-label">
            Participantes ({sortedMembers.length})
          </Text>
          {participantsExpanded && (
            <TextInput
              className="mb-2 h-10 rounded-full border border-slate-200 bg-white px-4 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-white"
              nativeID="trainer-session-pre-start-screen-participants-search"
              onChangeText={setParticipantsQuery}
              placeholder="Buscar participante"
              placeholderTextColor={colors.onSurfaceVariant}
              testID="trainer-session-pre-start-screen-participants-search"
              value={participantsQuery}
            />
          )}
          <View className="gap-2" nativeID="trainer-session-pre-start-screen-participants-list" testID="trainer-session-pre-start-screen-participants-list">
            {visibleMembers.map((member) => (
              <ParticipantRow idPrefix="trainer-session-pre-start-screen" key={member.userId} member={member} />
            ))}
            {!rosterLoading && sortedMembers.length === 0 && (
              <Text className="text-sm text-slate-500 dark:text-slate-400" nativeID="trainer-session-pre-start-screen-participants-empty" testID="trainer-session-pre-start-screen-participants-empty">
                Sin participantes en este grupo.
              </Text>
            )}
          </View>
          {!participantsExpanded && sortedMembers.length > PARTICIPANTS_COLLAPSED_COUNT && (
            <Pressable
              className="mt-2 items-center"
              nativeID="trainer-session-pre-start-screen-participants-expand-button"
              onPress={() => setParticipantsExpanded(true)}
              testID="trainer-session-pre-start-screen-participants-expand-button"
            >
              <Text className="text-sm font-semibold text-primary" nativeID="trainer-session-pre-start-screen-participants-expand-label" testID="trainer-session-pre-start-screen-participants-expand-label">
                Ver todos ({sortedMembers.length})
              </Text>
            </Pressable>
          )}
        </View>
      </ScrollView>

      <View className="border-t border-slate-100 px-4 pb-4 pt-3 dark:border-slate-800" nativeID="trainer-session-pre-start-screen-footer" testID="trainer-session-pre-start-screen-footer">
        <Pressable
          className="h-24 w-24 items-center justify-center self-center rounded-full bg-primary active:opacity-80"
          nativeID="trainer-session-pre-start-screen-play-button"
          onPress={handlePlay}
          testID="trainer-session-pre-start-screen-play-button"
        >
          <MaterialCommunityIcons color={colors.onPrimary} name="play" size={44} />
        </Pressable>
      </View>

      <AttendanceSessionModal
        groupId={groupId}
        onClose={() => setAttendanceVisible(false)}
        sessionDate={pendingSession.date}
        sessionInstanceId={pendingSession.sessionInstance?.id}
        sessionName={pendingSession.sessionInstance?.name}
        teamId={teamId}
        teamName={pendingSession.teamName}
        visible={attendanceVisible}
      />
    </SafeAreaView>
  );
}

export function TrainerSessionPreStartScreen() {
  return (
    <MobileOnlyRoute>
      <TrainerSessionPreStartScreenContent />
    </MobileOnlyRoute>
  );
}
```

- [ ] **Step 2: Write the route wrapper**

```jsx
import { TrainerSessionPreStartScreen } from '../components/session-runtime/trainer-session-pre-start-screen.jsx';

export default function TrainerSessionPreStart() {
  return <TrainerSessionPreStartScreen />;
}
```

- [ ] **Step 3: Verify lint is clean**

Run: `npx eslint components/session-runtime/trainer-session-pre-start-screen.jsx app/trainer-session-pre-start.jsx`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add components/session-runtime/trainer-session-pre-start-screen.jsx app/trainer-session-pre-start.jsx
git commit -m "feat(trainer-live): add trainer pre-start screen with a-priori roster and attendance"
```

---

### Task 10: Trainer live screen + route

**Files:**
- Create: `components/session-runtime/trainer-session-live-screen.jsx`
- Create: `app/trainer-session-live.jsx`

**Interfaces:**
- Consumes: `useTrainerSessionRuntime` (Task 7), `useTeamRoster` (Task 5), `computeBounds` (Task 1), `filterFeedByAthlete` (Task 4), `PARTICIPANT_STATUS` (Task 3), `SearchablePickerField` (`components/forms/searchable-picker-field.jsx`), `Camera`/`Map`/`Marker` (`@maplibre/maplibre-react-native`), `OPENFREEMAP_STYLE_URL` (`config/maps.js`), `MobileOnlyRoute`, `useSessionRuntimeStore`. The slide-to-finish (`DragToFinishButton`, `DRAG_VARIANTS`) is copied from `components/session-runtime/training-session-live-screen.jsx` (spec 1, lines 150-229 as they exist today) verbatim, adapted only in the icon/label/`onTrigger` passed to it.
- Produces: `TrainerSessionLiveScreen`. Route leaf, nothing downstream consumes it.

- [ ] **Step 1: Write the screen**

```jsx
import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Camera, Map, Marker } from '@maplibre/maplibre-react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { MobileOnlyRoute } from '../guards/platform-gate.jsx';
import { useThemeColors } from '../../theme/colors.js';
import { OPENFREEMAP_STYLE_URL } from '../../config/maps.js';
import { useSessionRuntimeStore } from '../../store/session-runtime-store.js';
import { useTeamRoster } from '../../hooks/use-team-roster.js';
import { useTrainerSessionRuntime } from '../../hooks/use-trainer-session-runtime.js';
import { computeBounds } from '../../utils/map-bounds.js';
import { filterFeedByAthlete } from '../../utils/trainer-records-feed.js';
import { PARTICIPANT_STATUS } from '../../utils/trainer-participant-state.js';
import { SearchablePickerField } from '../forms/searchable-picker-field.jsx';
import { AttendanceSessionModal } from './attendance-session-modal.jsx';
import { notifySuccess } from '../../utils/haptics.js';

// Runtime de la sesión PRESENCIAL para el ENTRENADOR -- mapa con los
// corredores conectados arriba, controles abajo. A diferencia de
// training-session-live-screen.jsx (corredor), acá no hay navegación
// serie-a-serie: el entrenador es supervisor, ve el avance de otros.

const STATUS_META = {
  [PARTICIPANT_STATUS.NOT_JOINED]: { label: 'No se unió', bg: 'bg-slate-200 dark:bg-slate-700', text: 'text-slate-600 dark:text-slate-200' },
  [PARTICIPANT_STATUS.IN_PROGRESS]: { label: 'En curso', bg: 'bg-primary', text: 'text-[#111518]' },
  [PARTICIPANT_STATUS.PAUSED]: { label: 'Pausado', bg: 'bg-amber-300', text: 'text-amber-950' },
  [PARTICIPANT_STATUS.COMPLETED]: { label: 'Completó todo', bg: 'bg-emerald-500', text: 'text-white' },
};

const CONNECTION_META = {
  open: { label: 'En vivo', dot: 'bg-primary', text: 'text-emerald-700 dark:text-emerald-400' },
  connecting: { label: 'Conectando…', dot: 'bg-amber-400', text: 'text-amber-700 dark:text-amber-400' },
  reconnecting: { label: 'Reconectando…', dot: 'bg-amber-400', text: 'text-amber-700 dark:text-amber-400' },
  closed: { label: 'Sin conexión', dot: 'bg-slate-400', text: 'text-slate-500 dark:text-slate-400' },
};

function ConnectionBanner({ status }) {
  const meta = CONNECTION_META[status] ?? CONNECTION_META.closed;
  return (
    <View className="flex-row items-center gap-2 self-center rounded-full bg-slate-100 px-3 py-1 dark:bg-slate-800" nativeID="trainer-session-live-connection-banner" testID="trainer-session-live-connection-banner">
      <View className={`h-2 w-2 rounded-full ${meta.dot}`} nativeID="trainer-session-live-connection-dot" testID="trainer-session-live-connection-dot" />
      <Text className={`text-xs font-semibold ${meta.text}`} nativeID="trainer-session-live-connection-label" testID="trainer-session-live-connection-label">{meta.label}</Text>
    </View>
  );
}

// `Marker` en sí no expone un `onPress` propio en esta versión de
// @maplibre/maplibre-react-native -- pero su contenido es un árbol de vistas
// nativo normal, así que un `Pressable` adentro recibe el toque igual que en
// cualquier otro lugar de la app (mismo criterio ya usado en
// location-picker.jsx, que solo necesitaba mostrar el marcador y por eso
// nunca necesitó probar esto). `onSelect` es `setSelectedParticipantId` del
// componente padre.
function ParticipantMarker({ participant, onSelect }) {
  const initials = (participant.name ?? '?').slice(0, 2).toUpperCase();
  return (
    <Marker anchor="center" key={participant.userId} lngLat={[participant.position.longitude, participant.position.latitude]}>
      <Pressable
        className="h-9 w-9 items-center justify-center rounded-full border-2 border-white bg-primary shadow-md"
        nativeID={`trainer-session-live-marker-${participant.userId}`}
        onPress={() => onSelect(participant.userId)}
        testID={`trainer-session-live-marker-${participant.userId}`}
      >
        <Text className="text-[10px] font-bold text-[#111518]" nativeID={`trainer-session-live-marker-${participant.userId}-label`} testID={`trainer-session-live-marker-${participant.userId}-label`}>
          {initials}
        </Text>
      </Pressable>
    </Marker>
  );
}

const DRAG_VARIANTS = {
  finish: {
    trackBorder: 'border-emerald-300 dark:border-emerald-800/70',
    fill: 'bg-emerald-500/20',
    thumb: 'bg-emerald-500/70 border border-emerald-600/60',
    iconColor: '#ffffff',
    label: 'text-emerald-700 dark:text-emerald-300',
  },
};

// Copiado casi verbatim de training-session-live-screen.jsx (spec 1) -- mismo
// mecanismo de gesto ya probado en dispositivo, no reinventado.
function DragToFinishButton({ onTrigger, idPrefix, label }) {
  const THUMB_SIZE = 64;
  const colors = DRAG_VARIANTS.finish;
  const translateX = useSharedValue(0);
  const widthSV = useSharedValue(120);
  const triggeredRef = useSharedValue(false);

  const fillStyle = useAnimatedStyle(() => ({ width: translateX.value }));
  const thumbStyle = useAnimatedStyle(() => ({ transform: [{ translateX: translateX.value }] }));

  const pan = useMemo(() => Gesture.Pan()
    .runOnJS(true)
    .onStart(() => { triggeredRef.value = false; })
    .onUpdate((e) => {
      if (triggeredRef.value) return;
      const maxX = (widthSV.value || 120) - THUMB_SIZE;
      translateX.value = Math.max(0, Math.min(maxX, e.translationX));
      if (e.translationX >= maxX) {
        triggeredRef.value = true;
        onTrigger();
      }
    })
    .onEnd((e) => {
      if (triggeredRef.value) return;
      const maxX = (widthSV.value || 120) - THUMB_SIZE;
      if (e.translationX >= maxX) {
        triggeredRef.value = true;
        onTrigger();
      } else {
        translateX.value = withSpring(0, { damping: 14, stiffness: 200 });
      }
    })
    .onFinalize(() => {
      if (!triggeredRef.value) translateX.value = withSpring(0, { damping: 14, stiffness: 200 });
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []);

  return (
    <GestureDetector gesture={pan}>
      <View
        className={`h-20 flex-1 rounded-full border ${colors.trackBorder}`}
        nativeID={`${idPrefix}-drag-track`}
        onLayout={(event) => { widthSV.value = Math.round(event.nativeEvent.layout.width); }}
        testID={`${idPrefix}-drag-track`}
      >
        <Animated.View className={`absolute inset-y-0 left-0 rounded-full ${colors.fill}`} nativeID={`${idPrefix}-drag-fill`} style={fillStyle} testID={`${idPrefix}-drag-fill`} />
        <Animated.View className={`absolute left-0.5 top-2 h-16 w-16 items-center justify-center rounded-full ${colors.thumb}`} nativeID={`${idPrefix}-drag-thumb`} style={thumbStyle} testID={`${idPrefix}-drag-thumb`}>
          <MaterialCommunityIcons color={colors.iconColor} name="flag-checkered" size={24} />
        </Animated.View>
        <View className="absolute inset-0 items-center justify-center px-20" nativeID={`${idPrefix}-drag-content`} pointerEvents="none" testID={`${idPrefix}-drag-content`}>
          <Text className={`text-center text-sm font-bold uppercase tracking-wide ${colors.label}`} nativeID={`${idPrefix}-drag-label`} numberOfLines={1} testID={`${idPrefix}-drag-label`}>{label}</Text>
        </View>
      </View>
    </GestureDetector>
  );
}

function ParticipantDetailModal({ participant, onClose }) {
  return (
    <Modal animationType="fade" nativeID="trainer-session-live-participant-detail-modal" onRequestClose={onClose} testID="trainer-session-live-participant-detail-modal" transparent visible={Boolean(participant)}>
      <Pressable className="flex-1 items-center justify-center bg-black/50 px-4" nativeID="trainer-session-live-participant-detail-backdrop" onPress={onClose} testID="trainer-session-live-participant-detail-backdrop">
        <Pressable className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-surface" nativeID="trainer-session-live-participant-detail-card" onPress={() => {}} testID="trainer-session-live-participant-detail-card">
          {participant && (
            <>
              <Text className="text-lg font-bold text-slate-900 dark:text-white" nativeID="trainer-session-live-participant-detail-name" testID="trainer-session-live-participant-detail-name">{participant.name}</Text>
              <View className="mt-3 flex-row items-center gap-2" nativeID="trainer-session-live-participant-detail-status" testID="trainer-session-live-participant-detail-status">
                <View className={`rounded-full px-3 py-1 ${STATUS_META[participant.status].bg}`} nativeID="trainer-session-live-participant-detail-status-chip" testID="trainer-session-live-participant-detail-status-chip">
                  <Text className={`text-xs font-semibold ${STATUS_META[participant.status].text}`} nativeID="trainer-session-live-participant-detail-status-label" testID="trainer-session-live-participant-detail-status-label">{STATUS_META[participant.status].label}</Text>
                </View>
                <Text className="text-xs text-slate-500 dark:text-slate-400" nativeID="trainer-session-live-participant-detail-sets" testID="trainer-session-live-participant-detail-sets">{participant.resolvedSetCount} serie(s) resueltas</Text>
              </View>
            </>
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function TrainerSessionLiveScreenContent() {
  const router = useRouter();
  const colors = useThemeColors();
  const pendingSession = useSessionRuntimeStore((s) => s.pendingSession);
  const clearPendingSession = useSessionRuntimeStore((s) => s.clearPendingSession);

  const sessionInstanceId = pendingSession?.sessionInstance?.id;
  const exercises = pendingSession?.sessionInstance?.exercises ?? [];
  const teamId = pendingSession?.teamId ?? null;
  const groupId = pendingSession?.groupId ?? null;
  const { members: rosterMembers } = useTeamRoster(teamId, groupId ? [groupId] : []);

  const { connectionStatus, participants, feed, finalize } = useTrainerSessionRuntime({ sessionInstanceId, exercises, rosterMembers });

  const [mode, setMode] = useState('map'); // 'map' | 'participants' | 'feed'
  const [selectedParticipantId, setSelectedParticipantId] = useState(null);
  const [feedFilterAthleteId, setFeedFilterAthleteId] = useState(null);
  const [fullscreenMap, setFullscreenMap] = useState(false);
  const [attendanceVisible, setAttendanceVisible] = useState(false);
  const cameraRef = useRef(null);

  const participantList = useMemo(() => [...participants.values()].sort((a, b) => a.name.localeCompare(b.name)), [participants]);
  const positionedParticipants = useMemo(() => participantList.filter((p) => p.position), [participantList]);
  const bounds = useMemo(() => computeBounds(positionedParticipants.map((p) => p.position)), [positionedParticipants]);

  // Auto-encuadre SOLO cuando se suma un participante nuevo (el conteo sube),
  // no en cada movimiento -- clave en las deps es positionedParticipants.length,
  // no el array completo, así que actualizar la posición de alguien ya
  // conocido no vuelve a disparar el fitBounds.
  useEffect(() => {
    if (bounds) cameraRef.current?.fitBounds(bounds, { top: 60, right: 60, bottom: 60, left: 60 }, 800);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [positionedParticipants.length]);

  const selectedParticipant = participantList.find((p) => p.userId === selectedParticipantId) ?? null;
  const visibleFeed = filterFeedByAthlete(feed, feedFilterAthleteId);
  const feedOptions = rosterMembers.map((m) => ({ id: m.userId, name: m.name }));

  const handleFinish = async () => {
    await finalize();
    notifySuccess();
    clearPendingSession();
    router.back();
  };

  if (!pendingSession) return null;

  return (
    <SafeAreaView className="flex-1 bg-paper dark:bg-ink" edges={['top', 'bottom']} nativeID="trainer-session-live-root" testID="trainer-session-live-root">
      <View className="items-center py-2" nativeID="trainer-session-live-banner-container" testID="trainer-session-live-banner-container">
        {connectionStatus && <ConnectionBanner status={connectionStatus} />}
      </View>

      <View className={fullscreenMap ? 'flex-1' : 'h-[45%]'} nativeID="trainer-session-live-map-container" testID="trainer-session-live-map-container">
        <Map mapStyle={OPENFREEMAP_STYLE_URL} nativeID="trainer-session-live-map" style={{ flex: 1 }} testID="trainer-session-live-map">
          <Camera initialViewState={{ center: [-58.4, -34.6], zoom: 12 }} ref={cameraRef} />
          {positionedParticipants.map((participant) => (
            <ParticipantMarker key={participant.userId} onSelect={setSelectedParticipantId} participant={participant} />
          ))}
        </Map>
        <Pressable
          className="absolute right-3 top-3 h-10 w-10 items-center justify-center rounded-full bg-white shadow-md dark:bg-surface"
          nativeID="trainer-session-live-fullscreen-button"
          onPress={() => setFullscreenMap((v) => !v)}
          testID="trainer-session-live-fullscreen-button"
        >
          <MaterialCommunityIcons color={colors.onSurfaceVariant} name={fullscreenMap ? 'fullscreen-exit' : 'fullscreen'} size={22} />
        </Pressable>
      </View>

      {!fullscreenMap && (
        <View className="flex-1 gap-3 p-4" nativeID="trainer-session-live-controls" testID="trainer-session-live-controls">
          <View className="flex-row gap-3" nativeID="trainer-session-live-controls-row" testID="trainer-session-live-controls-row">
            <Pressable
              className="h-11 flex-1 flex-row items-center justify-center gap-1.5 rounded-full border border-slate-200 active:opacity-70 dark:border-slate-700"
              nativeID="trainer-session-live-attendance-button"
              onPress={() => setAttendanceVisible(true)}
              testID="trainer-session-live-attendance-button"
            >
              <MaterialCommunityIcons color={colors.onSurfaceVariant} name="clipboard-check-outline" size={18} />
              <Text className="text-xs font-semibold text-slate-700 dark:text-slate-200" nativeID="trainer-session-live-attendance-button-label" testID="trainer-session-live-attendance-button-label">Asistencia</Text>
            </Pressable>
            <Pressable
              className="h-11 flex-1 flex-row items-center justify-center gap-1.5 rounded-full border border-slate-200 active:opacity-70 dark:border-slate-700"
              nativeID="trainer-session-live-participants-button"
              onPress={() => setMode('participants')}
              testID="trainer-session-live-participants-button"
            >
              <MaterialCommunityIcons color={colors.onSurfaceVariant} name="account-group-outline" size={18} />
              <Text className="text-xs font-semibold text-slate-700 dark:text-slate-200" nativeID="trainer-session-live-participants-button-label" testID="trainer-session-live-participants-button-label">Participantes</Text>
            </Pressable>
          </View>

          <Pressable
            className="h-11 flex-row items-center justify-center gap-1.5 rounded-full border border-slate-200 active:opacity-70 dark:border-slate-700"
            nativeID="trainer-session-live-feed-button"
            onPress={() => setMode('feed')}
            testID="trainer-session-live-feed-button"
          >
            <MaterialCommunityIcons color={colors.onSurfaceVariant} name="clipboard-text-clock-outline" size={18} />
            <Text className="text-xs font-semibold text-slate-700 dark:text-slate-200" nativeID="trainer-session-live-feed-button-label" testID="trainer-session-live-feed-button-label">Ver registros</Text>
          </Pressable>

          {mode === 'participants' && (
            <ScrollView className="flex-1 rounded-2xl border border-slate-200 dark:border-slate-700" nativeID="trainer-session-live-participants-list" testID="trainer-session-live-participants-list">
              {participantList.map((participant) => (
                <Pressable
                  className="flex-row items-center justify-between border-b border-slate-100 p-3 active:opacity-70 dark:border-slate-800"
                  key={participant.userId}
                  nativeID={`trainer-session-live-participants-list-${participant.userId}`}
                  onPress={() => setSelectedParticipantId(participant.userId)}
                  testID={`trainer-session-live-participants-list-${participant.userId}`}
                >
                  <Text className="text-sm font-semibold text-slate-900 dark:text-white" nativeID={`trainer-session-live-participants-list-${participant.userId}-name`} testID={`trainer-session-live-participants-list-${participant.userId}-name`}>{participant.name}</Text>
                  <View className={`rounded-full px-2.5 py-1 ${STATUS_META[participant.status].bg}`} nativeID={`trainer-session-live-participants-list-${participant.userId}-status`} testID={`trainer-session-live-participants-list-${participant.userId}-status`}>
                    <Text className={`text-[11px] font-semibold ${STATUS_META[participant.status].text}`} nativeID={`trainer-session-live-participants-list-${participant.userId}-status-label`} testID={`trainer-session-live-participants-list-${participant.userId}-status-label`}>{STATUS_META[participant.status].label}</Text>
                  </View>
                </Pressable>
              ))}
            </ScrollView>
          )}

          {mode === 'feed' && (
            <View className="flex-1 gap-2" nativeID="trainer-session-live-feed-container" testID="trainer-session-live-feed-container">
              <SearchablePickerField
                dense
                idPrefix="trainer-session-live-feed-filter"
                label="Filtrar por corredor"
                onChange={setFeedFilterAthleteId}
                options={feedOptions}
                placeholder="Todos"
                value={feedFilterAthleteId}
              />
              <ScrollView className="flex-1 rounded-2xl border border-slate-200 dark:border-slate-700" nativeID="trainer-session-live-feed-list" testID="trainer-session-live-feed-list">
                {visibleFeed.map((event) => (
                  <View className="border-b border-slate-100 p-3 dark:border-slate-800" key={event.id} nativeID={`trainer-session-live-feed-item-${event.id}`} testID={`trainer-session-live-feed-item-${event.id}`}>
                    <Text className="text-sm text-slate-900 dark:text-white" nativeID={`trainer-session-live-feed-item-${event.id}-text`} testID={`trainer-session-live-feed-item-${event.id}-text`}>
                      {event.athleteName} · {event.exerciseName} · Serie {event.setNumber} · {event.status === 'skipped' ? 'Salteada' : 'Completada'}
                    </Text>
                  </View>
                ))}
                {visibleFeed.length === 0 && (
                  <Text className="p-4 text-center text-sm text-slate-500 dark:text-slate-400" nativeID="trainer-session-live-feed-empty" testID="trainer-session-live-feed-empty">
                    Sin registros todavía.
                  </Text>
                )}
              </ScrollView>
            </View>
          )}

          <DragToFinishButton idPrefix="trainer-session-live-finish" label="Deslizá para finalizar la sesión" onTrigger={handleFinish} />
        </View>
      )}

      <ParticipantDetailModal onClose={() => setSelectedParticipantId(null)} participant={selectedParticipant} />

      <AttendanceSessionModal
        groupId={groupId}
        onClose={() => setAttendanceVisible(false)}
        sessionDate={pendingSession.date}
        sessionInstanceId={sessionInstanceId}
        sessionName={pendingSession.sessionInstance?.name}
        teamId={teamId}
        teamName={pendingSession.teamName}
        visible={attendanceVisible}
      />
    </SafeAreaView>
  );
}

export function TrainerSessionLiveScreen() {
  return (
    <MobileOnlyRoute>
      <TrainerSessionLiveScreenContent />
    </MobileOnlyRoute>
  );
}
```

- [ ] **Step 2: Write the route wrapper**

```jsx
import { TrainerSessionLiveScreen } from '../components/session-runtime/trainer-session-live-screen.jsx';

export default function TrainerSessionLive() {
  return <TrainerSessionLiveScreen />;
}
```

- [ ] **Step 3: Apply the implementer notes from Step 1, then verify lint is clean**

Run: `npx eslint components/session-runtime/trainer-session-live-screen.jsx app/trainer-session-live.jsx`
Expected: no errors, no unused imports.

- [ ] **Step 4: Commit**

```bash
git add components/session-runtime/trainer-session-live-screen.jsx app/trainer-session-live.jsx
git commit -m "feat(trainer-live): add trainer live screen (map, participants, feed, finish)"
```

---

### Task 11: Route the trainer's Play from the calendar

**Files:**
- Modify: `components/calendar/start-session-button.jsx:180-197` (the not-yet-past, native, non-review branch)

**Interfaces:**
- Consumes: `assignment.isPresencial` (already read elsewhere in this same file's callers, e.g. `session-pre-start-screen.jsx`), `role` prop (already passed by every call site of `StartSessionButton`).
- Produces: nothing new — this is the entry point Task 9's screen needs to be reachable at all.

Today (confirmed by a fresh read of this file before writing this plan), the not-yet-past/native branch has **zero role branching** — `handlePress` always does `setPendingSession(assignment); router.push('/training-session')`, meaning a trainer tapping Play on an upcoming/current presencial session lands on the runner's own async screen. Async sessions are unaffected by this task — a trainer has no live role there, only "Ver registros" after the fact (the existing `showReview` branch above, untouched).

- [ ] **Step 1: Read the current not-yet-past branch**

`components/calendar/start-session-button.jsx:180-197` today:

```jsx
  const handlePress = () => {
    setPendingSession(assignment);
    router.push('/training-session');
  };

  return (
    <Pressable
      className={`${fill ? 'flex-1' : 'mt-2'} h-9 flex-row items-center justify-center gap-1.5 rounded-full bg-primary active:opacity-80`}
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

- [ ] **Step 2: Add the trainer+presencial branch, preserving the existing branch untouched for every other case**

```jsx
  const handlePress = () => {
    setPendingSession(assignment);
    if (role === 'trainer' && assignment.isPresencial) {
      router.push('/trainer-session-pre-start');
      return;
    }
    router.push('/training-session');
  };
```

Only this function changes — the `Pressable` below it, its label, and every branch above (`showReview`, `!inWindow`, `isWeb`) are unchanged. A trainer on an ASYNC session still falls through to `/training-session` exactly as today (unaffected — the label "Iniciar entrenamiento" showing for a trainer on an async upcoming session is pre-existing behavior, out of scope for this plan to fix).

- [ ] **Step 3: Run the full suite**

Run: `npx jest -v 2>&1 | tail -20`
Expected: PASS, same count as before this change (no existing test asserts `StartSessionButton`'s not-yet-past branch by role — confirmed no `__tests__/start-session-button*` file exists).

- [ ] **Step 4: Verify lint is clean**

Run: `npx eslint components/calendar/start-session-button.jsx`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add components/calendar/start-session-button.jsx
git commit -m "fix(trainer-live): route trainer's Play to the new trainer pre-start on presencial sessions"
```

---

## Self-Review

**Spec coverage:**
- Entry point / `StartSessionButton` branch → Task 11. ✅
- Trainer pre-start (roster, search, attendance button, Play with no local run) → Task 9. ✅
- `AttendanceSessionModal` (grid + QR, no cascade, no window restriction) → Task 8. ✅
- Live screen: map + markers + auto-fit-on-join + fullscreen → Task 10 (with an explicit implementer note fixing the declarative-vs-imperative bounds gap found during self-review). ✅
- Participant list with roster-wide status + drill-down → Task 10 + Task 3 (reducer) + Task 7 (bootstrap). ✅
- Live records feed with `SearchablePickerField` filter → Task 10 + Task 4 (reducer) + Task 7 (bootstrap fan-out). ✅
- Slide-to-finish, manual only, `control:session_finished` to `'all'` → Task 10 + Task 7. ✅
- Trainer's own GPS sharing → Task 7 (`useSessionGpsTracker` reused as-is). ✅
- Animations (marker pulse, connection-banner pulse, status-chip glow) → **not implemented in any task above.** Flagged as a gap below, fixed inline.
- Gap to confirm with backend (all-athletes feedback + `from.userId` + `update:set_event` casing) → Task 6. ✅
- `photoUrl` on roster (needed by Task 9/10, not explicitly in the spec's own file list but a direct, small, necessary consequence of it) → Task 5. ✅

**Fix found during spec-coverage review:** the spec's animation section (marker pulse tied to position recency, connection-banner pulse, status-chip glow) has no task. Adding it as Task 12 below rather than folding it into Task 10 (which is already large) — it is a self-contained, independently reviewable visual polish pass over an already-working screen, exactly the kind of unit worth its own task and its own gate per this skill's task-sizing rule.

### Task 12: Live-state animations

**Files:**
- Modify: `components/session-runtime/trainer-session-live-screen.jsx` (`ParticipantMarker`, `ConnectionBanner`)

**Interfaces:**
- Consumes: `react-native-reanimated` (`useSharedValue`, `useAnimatedStyle`, `withRepeat`, `withTiming`, already a dependency, same import already used by `DragToFinishButton` in the same file).
- Produces: no new exports — purely visual.

- [ ] **Step 1: Add a recency-gated pulse to `ParticipantMarker`**

```jsx
// El pulso vive en un Animated.View NO interactivo que solo aplica el scale
// (pointerEvents="box-none") -- el Pressable de Task 10 sigue siendo el
// elemento que realmente recibe el toque, sin envolverlo en Animated
// (reanimated no expone un Animated.Pressable propio en este repo).
function ParticipantMarker({ participant, onSelect }) {
  const initials = (participant.name ?? '?').slice(0, 2).toUpperCase();
  const pulse = useSharedValue(1);
  const isRecent = Date.now() - (participant.position.ts ?? 0) < 20000;

  useEffect(() => {
    if (isRecent) {
      pulse.value = withRepeat(withTiming(1.15, { duration: 700 }), -1, true);
    } else {
      pulse.value = withTiming(1, { duration: 300 });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isRecent]);

  const pulseStyle = useAnimatedStyle(() => ({ transform: [{ scale: pulse.value }] }));

  return (
    <Marker anchor="center" key={participant.userId} lngLat={[participant.position.longitude, participant.position.latitude]}>
      <Animated.View nativeID={`trainer-session-live-marker-${participant.userId}-pulse`} pointerEvents="box-none" style={pulseStyle} testID={`trainer-session-live-marker-${participant.userId}-pulse`}>
        <Pressable
          className={`h-9 w-9 items-center justify-center rounded-full border-2 border-white shadow-md ${isRecent ? 'bg-primary' : 'bg-slate-400'}`}
          nativeID={`trainer-session-live-marker-${participant.userId}`}
          onPress={() => onSelect(participant.userId)}
          testID={`trainer-session-live-marker-${participant.userId}`}
        >
          <Text className="text-[10px] font-bold text-[#111518]" nativeID={`trainer-session-live-marker-${participant.userId}-label`} testID={`trainer-session-live-marker-${participant.userId}-label`}>
            {initials}
          </Text>
        </Pressable>
      </Animated.View>
    </Marker>
  );
}
```

`useEffect` is already imported by Task 10's `import { useEffect, useMemo, useRef, useState } from 'react';` line. Add `withRepeat`/`withTiming` to the existing reanimated import (becomes `import Animated, { useAnimatedStyle, useSharedValue, withRepeat, withSpring, withTiming } from 'react-native-reanimated';`).

- [ ] **Step 2: Same pulse on the connection banner's dot**

```jsx
function ConnectionBanner({ status }) {
  const meta = CONNECTION_META[status] ?? CONNECTION_META.closed;
  const pulse = useSharedValue(1);

  useEffect(() => {
    pulse.value = status === 'open'
      ? withRepeat(withTiming(1.4, { duration: 700 }), -1, true)
      : withTiming(1, { duration: 300 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  const pulseStyle = useAnimatedStyle(() => ({ transform: [{ scale: pulse.value }] }));

  return (
    <View className="flex-row items-center gap-2 self-center rounded-full bg-slate-100 px-3 py-1 dark:bg-slate-800" nativeID="trainer-session-live-connection-banner" testID="trainer-session-live-connection-banner">
      <Animated.View className={`h-2 w-2 rounded-full ${meta.dot}`} nativeID="trainer-session-live-connection-dot" style={pulseStyle} testID="trainer-session-live-connection-dot" />
      <Text className={`text-xs font-semibold ${meta.text}`} nativeID="trainer-session-live-connection-label" testID="trainer-session-live-connection-label">{meta.label}</Text>
    </View>
  );
}
```

- [ ] **Step 3: Verify lint is clean and the full suite still passes**

Run: `npx eslint components/session-runtime/trainer-session-live-screen.jsx && npx jest -v 2>&1 | tail -20`
Expected: no lint errors, same test count/pass rate as Task 11.

- [ ] **Step 4: Commit**

```bash
git add components/session-runtime/trainer-session-live-screen.jsx
git commit -m "feat(trainer-live): pulse animation on map markers and connection banner"
```

---

**Placeholder scan:** no `TBD`/`TODO` left in any step above. An earlier draft of this plan had three "Note for the implementer" call-outs in Tasks 9 and 10 flagging a guessed field name, a declarative-vs-imperative camera API mismatch, and a missing marker tap handler — all three were resolved directly in the code during this self-review (confirmed `pendingSession.groupId` is the real flat field via `day-detail-modal.jsx`; replaced the declarative `bounds` prop with `cameraRef`/`fitBounds` in an effect keyed on participant count; wrapped the marker's content in a `Pressable`) rather than left as call-outs, per the skill's "no placeholders" rule.

**Type/signature consistency:** `Participant` shape (`{userId, name, photoUrl, joined, status, position, resolvedSetCount}`, Task 3) is used identically in Task 7 (bootstrap merge), Task 10 (rendering), and Task 12 (animation) — no field renamed between tasks. `FeedEvent` shape (`{id, athleteUserId, athleteName, exerciseName, setNumber, status, timestamp}`, Task 4) matches exactly what Task 7 constructs from both the bootstrap and the live `update:set_event` path. `useTrainerSessionRuntime`'s return shape (`{connectionStatus, participants, feed, gpsEnabled, finalize}`, Task 7) matches exactly what Task 10 destructures.

Plan complete and saved to `docs/superpowers/plans/2026-09-30-presencial-live-session-trainer.md`. Two execution options:

**1. Subagent-Driven (recommended)** — I dispatch a fresh subagent per task, review between tasks, fast iteration. Same approach used for spec 1 of this feature and for the earlier trainings-history sub-project, with cheap models for the mechanical tasks (1-4, 5, 6, 11 — isolated pure functions or small tightly-scoped diffs) and a standard-tier model for the integration-heavy ones (7, 8, 9, 10, 12).

**2. Inline Execution** — Execute tasks in this session using executing-plans, batch execution with checkpoints.

Which approach?
