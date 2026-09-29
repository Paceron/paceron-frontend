# Sesión presencial (1/2): transporte en tiempo real + cliente corredor — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a generic, reusable WebSocket channel infrastructure plus the corredor-side live
screen for presencial (in-person) training sessions — live position broadcast, incremental
per-series sync (reusing existing REST endpoints), and control-message handling — without touching
the existing async live-session screen.

**Architecture:** A singleton WebSocket client (`services/realtime-client.js`) multiplexes
arbitrary channels behind a small message envelope; a React hook (`use-realtime-channel.js`)
exposes it per-component. The corredor's new screen (`training-session-live-screen.jsx`, driven by
a new orchestration hook `use-live-session-runtime.js`) reuses the existing SQLite persistence
(`session-db.js`) and existing REST sync (`session-sync.js#syncRun`) unchanged, calling `syncRun`
after every finished/skipped/interrupted series instead of only at session end. GPS position
broadcasts live over the WS channel unconditionally (every accepted point, active series or not);
only the durable per-series result goes through REST.

**Tech Stack:** React Native (Expo), Zustand (existing stores, unchanged), `expo-location`,
`expo-sqlite` (existing `session-db.js`, unchanged schema), global `WebSocket` (no new
dependency — available natively in both RN/Expo and web), Jest for pure-logic tests.

**Spec:** `docs/superpowers/specs/2026-09-28-presencial-live-session-transport-runner-design.md`

## Global Constraints

- Every visual element (`View`/`Text`/`Pressable`/`TextInput`/`Image`/`ScrollView`/
  `TouchableOpacity`/`TouchableWithoutFeedback`/`TouchableHighlight`/`FlatList`/`SectionList`/
  `Modal`/`SafeAreaView`, including `Animated.*` variants) needs both `nativeID` and `testID`,
  kebab-case, unique in its screen scope (ESLint `local/require-native-id`).
- No component/hook render tests — Jest only covers pure logic (project convention, no exception
  in this plan).
- `training-session-active-screen.jsx`, `hooks/use-gps-tracker.js`, `services/session-db.js`,
  `services/session-sync.js`, `utils/session-start-window.js` are **not modified** by this plan —
  read from, never edited.
- `POST /workout-feedback/:id/points` needs a `feedback_id`, only available once a series has a
  final `completion_status` (`completed`/`skipped`) — never call it for a series still running.
- GPS location watch parameters are fixed and already tuned — always `Location.Accuracy.High`,
  `timeInterval: 1000`, `distanceInterval: 1` (see `hooks/use-gps-tracker.js`, do not change).
- `acceptGpsLeg` (`utils/distance.js`) is the single quality filter for every GPS point in this
  plan — never bypass it or add a second filter on top.
- Message envelope shape (all directions): `{ channel, type, event?, from?, to?, payload?, ts }` —
  every task producing or consuming a message uses exactly this shape, field names verbatim.

---

## Task 1: Message envelope + WS URL builder (`utils/realtime-message.js`)

**Files:**
- Create: `utils/realtime-message.js`
- Test: `__tests__/realtime-message.test.js`

**Interfaces:**
- Produces: `buildMessage({ channel, type, event, to, payload })` → object with the envelope shape
  plus `ts: number` (epoch ms). `buildWsUrl(apiBaseUrl)` → `string`. `parseMessage(raw)` → parsed
  object or `null`. All three consumed by Task 3 (`services/realtime-client.js`).

- [ ] **Step 1: Write the failing tests**

```js
// __tests__/realtime-message.test.js
import { buildMessage, buildWsUrl, parseMessage } from '../utils/realtime-message.js';

describe('buildMessage', () => {
  test('includes channel, type and a numeric ts', () => {
    const msg = buildMessage({ channel: 'session:42', type: 'presence', event: 'joined' });
    expect(msg.channel).toBe('session:42');
    expect(msg.type).toBe('presence');
    expect(msg.event).toBe('joined');
    expect(typeof msg.ts).toBe('number');
  });

  test('omits optional fields that were not provided', () => {
    const msg = buildMessage({ channel: 'session:42', type: 'ping' });
    expect(msg).not.toHaveProperty('event');
    expect(msg).not.toHaveProperty('to');
    expect(msg).not.toHaveProperty('payload');
    expect(msg).not.toHaveProperty('from');
  });

  test('includes to and payload when provided', () => {
    const msg = buildMessage({ channel: 'session:42', type: 'control', event: 'session_finished', to: 'all', payload: { reason: 'window_ended' } });
    expect(msg.to).toBe('all');
    expect(msg.payload).toEqual({ reason: 'window_ended' });
  });

  test('never lets a caller set `from` — that field is server-assigned only', () => {
    const msg = buildMessage({ channel: 'session:42', type: 'presence', event: 'joined', from: { userId: 999, role: 'trainer' } });
    expect(msg).not.toHaveProperty('from');
  });
});

describe('parseMessage', () => {
  test('parses a valid JSON envelope', () => {
    const raw = JSON.stringify({ channel: 'session:42', type: 'control', event: 'session_paused', ts: 123 });
    expect(parseMessage(raw)).toEqual({ channel: 'session:42', type: 'control', event: 'session_paused', ts: 123 });
  });

  test('returns null for invalid JSON', () => {
    expect(parseMessage('not json{{{')).toBeNull();
  });

  test('returns null when the parsed value has no string `type`', () => {
    expect(parseMessage(JSON.stringify({ channel: 'session:42', ts: 1 }))).toBeNull();
    expect(parseMessage(JSON.stringify({ type: 42 }))).toBeNull();
  });

  test('returns null for non-object JSON', () => {
    expect(parseMessage(JSON.stringify('hello'))).toBeNull();
    expect(parseMessage(JSON.stringify(null))).toBeNull();
  });
});

describe('buildWsUrl', () => {
  test('converts an https API base URL with a path suffix to a wss /ws URL', () => {
    expect(buildWsUrl('https://paceron-backend-as9c.onrender.com/api/v1')).toBe('wss://paceron-backend-as9c.onrender.com/ws');
  });

  test('converts an http (local dev) API base URL to a plain ws /ws URL', () => {
    expect(buildWsUrl('http://localhost:8080/api/v1')).toBe('ws://localhost:8080/ws');
  });

  test('handles a base URL without a path suffix', () => {
    expect(buildWsUrl('https://example.com')).toBe('wss://example.com/ws');
  });

  test('handles a base URL with a trailing slash', () => {
    expect(buildWsUrl('https://example.com/api/v1/')).toBe('wss://example.com/ws');
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx jest __tests__/realtime-message.test.js`
Expected: FAIL — `Cannot find module '../utils/realtime-message.js'`

- [ ] **Step 3: Implement**

```js
// utils/realtime-message.js

// Sobre de mensaje del bus de tiempo real genérico (spec 2026-09-28). `from`
// nunca lo pone el cliente -- lo pisa el servidor siempre -- así que
// buildMessage ni lo acepta como input.
export function buildMessage({ channel, type, event, to, payload }) {
  const msg = { channel, type, ts: Date.now() };
  if (event !== undefined) msg.event = event;
  if (to !== undefined) msg.to = to;
  if (payload !== undefined) msg.payload = payload;
  return msg;
}

export function parseMessage(raw) {
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (parsed == null || typeof parsed !== 'object' || Array.isArray(parsed)) return null;
  if (typeof parsed.type !== 'string') return null;
  return parsed;
}

// wss://host/ws (o ws:// para desarrollo local sobre http) a partir de
// EXPO_PUBLIC_API_URL / el default remoto -- ver config/env.js#API_BASE_URL.
// Tira el path (/api/v1 o lo que sea) y agrega /ws, sin importar si el base
// URL trae barra final o no.
export function buildWsUrl(apiBaseUrl) {
  const url = new URL(apiBaseUrl);
  const wsProtocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${wsProtocol}//${url.host}/ws`;
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx jest __tests__/realtime-message.test.js`
Expected: PASS, 12/12

- [ ] **Step 5: Commit**

```bash
git add utils/realtime-message.js __tests__/realtime-message.test.js
git commit -m "feat(realtime): add message envelope builder/parser and WS URL helper"
```

---

## Task 2: Reconnect backoff calculation (`utils/realtime-backoff.js`)

**Files:**
- Create: `utils/realtime-backoff.js`
- Test: `__tests__/realtime-backoff.test.js`

**Interfaces:**
- Produces: `computeBackoffMs(attempt, { baseMs, maxMs, jitterRatio, randomFn } = {})` → `number`.
  Consumed by Task 3.

- [ ] **Step 1: Write the failing tests**

```js
// __tests__/realtime-backoff.test.js
import { computeBackoffMs } from '../utils/realtime-backoff.js';

describe('computeBackoffMs', () => {
  test('attempt 0 returns roughly the base delay (jitter disabled via randomFn=0.5, no offset)', () => {
    // randomFn fijo en 0.5 => jitter factor neutro (ni resta ni suma, ver implementación)
    expect(computeBackoffMs(0, { baseMs: 1000, jitterRatio: 0.2, randomFn: () => 0.5 })).toBe(1000);
  });

  test('grows exponentially with the attempt number', () => {
    const opts = { baseMs: 1000, jitterRatio: 0, randomFn: () => 0.5 };
    expect(computeBackoffMs(0, opts)).toBe(1000);
    expect(computeBackoffMs(1, opts)).toBe(2000);
    expect(computeBackoffMs(2, opts)).toBe(4000);
    expect(computeBackoffMs(3, opts)).toBe(8000);
  });

  test('never exceeds maxMs even for large attempt numbers', () => {
    expect(computeBackoffMs(20, { baseMs: 1000, maxMs: 30000, jitterRatio: 0, randomFn: () => 0.5 })).toBe(30000);
  });

  test('jitter moves the result within +/- jitterRatio of the exponential value', () => {
    const base = 1000;
    const lowJitter = computeBackoffMs(0, { baseMs: base, jitterRatio: 0.2, randomFn: () => 0 });
    const highJitter = computeBackoffMs(0, { baseMs: base, jitterRatio: 0.2, randomFn: () => 1 });
    expect(lowJitter).toBe(800); // 1000 - 20%
    expect(highJitter).toBe(1200); // 1000 + 20%
  });

  test('result is never negative even with a tiny base and full negative jitter', () => {
    const result = computeBackoffMs(0, { baseMs: 10, jitterRatio: 1, randomFn: () => 0 });
    expect(result).toBeGreaterThanOrEqual(0);
  });

  test('uses sane defaults when no options are given', () => {
    const result = computeBackoffMs(0);
    expect(result).toBeGreaterThan(0);
    expect(result).toBeLessThanOrEqual(30000);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx jest __tests__/realtime-backoff.test.js`
Expected: FAIL — `Cannot find module '../utils/realtime-backoff.js'`

- [ ] **Step 3: Implement**

```js
// utils/realtime-backoff.js

// Backoff exponencial + jitter para la reconexión del WS (spec 2026-09-28).
// randomFn es inyectable a propósito -- sin eso el jitter no es testeable
// de forma determinística.
export function computeBackoffMs(attempt, { baseMs = 1000, maxMs = 30000, jitterRatio = 0.2, randomFn = Math.random } = {}) {
  const exponential = Math.min(maxMs, baseMs * 2 ** attempt);
  // randomFn() en [0,1) -> factor de jitter en [-jitterRatio, +jitterRatio]
  const jitterFactor = (randomFn() * 2 - 1) * jitterRatio;
  const withJitter = exponential * (1 + jitterFactor);
  return Math.max(0, Math.min(maxMs, Math.round(withJitter)));
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx jest __tests__/realtime-backoff.test.js`
Expected: PASS, 6/6

- [ ] **Step 5: Commit**

```bash
git add utils/realtime-backoff.js __tests__/realtime-backoff.test.js
git commit -m "feat(realtime): add reconnect backoff calculation with injectable jitter"
```

---

## Task 3: Generic WebSocket singleton client (`services/realtime-client.js`)

**Files:**
- Create: `services/realtime-client.js`
- Test: `__tests__/realtime-client.test.js`

**Interfaces:**
- Consumes: `buildMessage`, `parseMessage`, `buildWsUrl` from `utils/realtime-message.js` (Task 1);
  `computeBackoffMs` from `utils/realtime-backoff.js` (Task 2); `API_BASE_URL` from
  `config/env.js`; `useAuthStore` from `store/auth-store.js` (reads `useAuthStore.getState().token`,
  same pattern as `services/api.js`).
- Produces (consumed by Task 4):
  - `connect()` → `void` — idempotent, opens the socket if not already open/connecting.
  - `subscribe(channel: string)` → `void`
  - `unsubscribe(channel: string)` → `void`
  - `send(channel: string, type: string, payload?: object, extra?: { event?: string, to?: string | { userId: number } }) → void` — no-op if the socket is not open (fire-and-forget, matches the spec's "efímero" design for `presence`/`control` messages).
  - `on(channel: string, callback: (msg: object) => void)` → `void`
  - `off(channel: string, callback: (msg: object) => void)` → `void`
  - `getStatus()` → `'connecting' | 'open' | 'reconnecting' | 'closed'`
  - `onStatusChange(callback: (status: string) => void)` → `() => void` (unsubscribe function)

- [ ] **Step 1: Write the failing tests**

Create a fake `WebSocket` test double — the real global doesn't exist in the Jest/Node
environment used by this project (`jest-expo` preset, no jsdom WebSocket). Mirrors the
`global.fetch = jest.fn()` mocking precedent already used in `__tests__/api-client.test.js`.

```js
// __tests__/realtime-client.test.js
jest.mock('../store/auth-store.js', () => ({
  useAuthStore: { getState: () => ({ token: 'fake-jwt' }) },
}));

class FakeWebSocket {
  static instances = [];
  constructor(url) {
    this.url = url;
    this.readyState = 0; // CONNECTING
    this.sent = [];
    FakeWebSocket.instances.push(this);
  }
  send(data) {
    this.sent.push(data);
  }
  close() {
    this.readyState = 3; // CLOSED
    this.onclose?.({});
  }
  // Helpers de test, no parte de la API real de WebSocket
  simulateOpen() {
    this.readyState = 1; // OPEN
    this.onopen?.({});
  }
  simulateMessage(data) {
    this.onmessage?.({ data });
  }
  simulateClose() {
    this.readyState = 3;
    this.onclose?.({});
  }
}

describe('realtime-client', () => {
  let realtimeClient;

  beforeEach(() => {
    jest.resetModules();
    FakeWebSocket.instances = [];
    global.WebSocket = FakeWebSocket;
    jest.useFakeTimers();
    // eslint-disable-next-line global-require
    realtimeClient = require('../services/realtime-client.js');
  });

  afterEach(() => {
    jest.useRealTimers();
    delete global.WebSocket;
  });

  test('connect() opens a socket with the auth token in the URL', () => {
    realtimeClient.connect();
    expect(FakeWebSocket.instances).toHaveLength(1);
    expect(FakeWebSocket.instances[0].url).toContain('token=fake-jwt');
  });

  test('connect() is idempotent while a socket is already open', () => {
    realtimeClient.connect();
    FakeWebSocket.instances[0].simulateOpen();
    realtimeClient.connect();
    expect(FakeWebSocket.instances).toHaveLength(1);
  });

  test('status transitions to open on socket open, and listeners are notified', () => {
    const statusUpdates = [];
    realtimeClient.onStatusChange((status) => statusUpdates.push(status));
    realtimeClient.connect();
    expect(realtimeClient.getStatus()).toBe('connecting');
    FakeWebSocket.instances[0].simulateOpen();
    expect(realtimeClient.getStatus()).toBe('open');
    expect(statusUpdates).toContain('open');
  });

  test('subscribe() before the socket opens is sent once the socket opens', () => {
    realtimeClient.connect();
    realtimeClient.subscribe('session:42');
    const socket = FakeWebSocket.instances[0];
    expect(socket.sent).toHaveLength(0); // no envía nada mientras conecta
    socket.simulateOpen();
    const sentSubscribe = socket.sent.map((s) => JSON.parse(s)).find((m) => m.type === 'subscribe');
    expect(sentSubscribe).toMatchObject({ type: 'subscribe', channel: 'session:42' });
  });

  test('on(channel, cb) receives messages dispatched for that channel only', () => {
    realtimeClient.connect();
    const socket = FakeWebSocket.instances[0];
    socket.simulateOpen();
    const received = [];
    const otherReceived = [];
    realtimeClient.on('session:42', (msg) => received.push(msg));
    realtimeClient.on('session:99', (msg) => otherReceived.push(msg));
    socket.simulateMessage(JSON.stringify({ channel: 'session:42', type: 'control', event: 'announcement', ts: 1 }));
    expect(received).toHaveLength(1);
    expect(otherReceived).toHaveLength(0);
  });

  test('off(channel, cb) stops delivering messages to that callback', () => {
    realtimeClient.connect();
    const socket = FakeWebSocket.instances[0];
    socket.simulateOpen();
    const received = [];
    const handler = (msg) => received.push(msg);
    realtimeClient.on('session:42', handler);
    realtimeClient.off('session:42', handler);
    socket.simulateMessage(JSON.stringify({ channel: 'session:42', type: 'control', ts: 1 }));
    expect(received).toHaveLength(0);
  });

  test('send() writes an enveloped message when the socket is open', () => {
    realtimeClient.connect();
    const socket = FakeWebSocket.instances[0];
    socket.simulateOpen();
    realtimeClient.send('session:42', 'presence', undefined, { event: 'joined' });
    const sentJoin = socket.sent.map((s) => JSON.parse(s)).find((m) => m.type === 'presence');
    expect(sentJoin).toMatchObject({ channel: 'session:42', type: 'presence', event: 'joined' });
  });

  test('send() is a silent no-op when the socket is not open', () => {
    realtimeClient.connect(); // todavía CONNECTING, no OPEN
    expect(() => realtimeClient.send('session:42', 'presence', undefined, { event: 'position' })).not.toThrow();
  });

  test('an unexpected close schedules a reconnect and status becomes reconnecting', () => {
    realtimeClient.connect();
    FakeWebSocket.instances[0].simulateOpen();
    FakeWebSocket.instances[0].simulateClose();
    expect(realtimeClient.getStatus()).toBe('reconnecting');
    jest.advanceTimersByTime(35000); // más que el backoff máximo (30s)
    expect(FakeWebSocket.instances).toHaveLength(2); // se abrió un segundo socket
  });

  test('resubscribes to previously subscribed channels after a reconnect', () => {
    realtimeClient.connect();
    realtimeClient.subscribe('session:42');
    FakeWebSocket.instances[0].simulateOpen();
    FakeWebSocket.instances[0].simulateClose();
    jest.advanceTimersByTime(35000);
    const secondSocket = FakeWebSocket.instances[1];
    secondSocket.simulateOpen();
    const sentSubscribe = secondSocket.sent.map((s) => JSON.parse(s)).find((m) => m.type === 'subscribe' && m.channel === 'session:42');
    expect(sentSubscribe).toBeDefined();
  });

  test('unsubscribe() removes the channel from the resubscribe list', () => {
    realtimeClient.connect();
    realtimeClient.subscribe('session:42');
    FakeWebSocket.instances[0].simulateOpen();
    realtimeClient.unsubscribe('session:42');
    FakeWebSocket.instances[0].simulateClose();
    jest.advanceTimersByTime(35000);
    const secondSocket = FakeWebSocket.instances[1];
    secondSocket.simulateOpen();
    const sentSubscribe = secondSocket.sent.map((s) => JSON.parse(s)).find((m) => m.type === 'subscribe' && m.channel === 'session:42');
    expect(sentSubscribe).toBeUndefined();
  });

  test('a pong message is swallowed and never dispatched to channel listeners', () => {
    realtimeClient.connect();
    const socket = FakeWebSocket.instances[0];
    socket.simulateOpen();
    const received = [];
    realtimeClient.on('session:42', (msg) => received.push(msg));
    socket.simulateMessage(JSON.stringify({ type: 'pong', ts: 1 }));
    expect(received).toHaveLength(0);
  });

  test('an unparseable message is ignored without throwing', () => {
    realtimeClient.connect();
    const socket = FakeWebSocket.instances[0];
    socket.simulateOpen();
    expect(() => socket.simulateMessage('not-json{{')).not.toThrow();
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx jest __tests__/realtime-client.test.js`
Expected: FAIL — `Cannot find module '../services/realtime-client.js'`

- [ ] **Step 3: Implement**

```js
// services/realtime-client.js
import { API_BASE_URL } from '../config/env.js';
import { useAuthStore } from '../store/auth-store.js';
import { buildMessage, buildWsUrl, parseMessage } from '../utils/realtime-message.js';
import { computeBackoffMs } from '../utils/realtime-backoff.js';

// Cliente WS genérico, singleton a nivel módulo (spec 2026-09-28) -- un solo
// socket físico multiplexado por canales. Pensado para reusarse más allá de
// esta feature (notificaciones en vivo, etc.), no hardcodeado a sesiones.
const HEARTBEAT_MS = 25000;

let socket = null;
let status = 'closed';
const statusListeners = new Set();
const channelListeners = new Map(); // channel -> Set<callback>
const subscribedChannels = new Set();
let reconnectAttempt = 0;
let reconnectTimer = null;
let heartbeatTimer = null;
let explicitlyClosed = false;

function setStatus(next) {
  status = next;
  for (const listener of statusListeners) listener(status);
}

export function getStatus() {
  return status;
}

export function onStatusChange(callback) {
  statusListeners.add(callback);
  return () => statusListeners.delete(callback);
}

function stopHeartbeat() {
  if (heartbeatTimer) {
    clearInterval(heartbeatTimer);
    heartbeatTimer = null;
  }
}

function startHeartbeat() {
  stopHeartbeat();
  heartbeatTimer = setInterval(() => {
    if (socket && socket.readyState === 1) socket.send(JSON.stringify(buildMessage({ channel: undefined, type: 'ping' })));
  }, HEARTBEAT_MS);
}

function clearReconnectTimer() {
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
}

function scheduleReconnect() {
  clearReconnectTimer();
  const delay = computeBackoffMs(reconnectAttempt);
  reconnectAttempt += 1;
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    connect();
  }, delay);
}

function dispatchMessage(raw) {
  const msg = parseMessage(raw);
  if (!msg || msg.type === 'pong') return;
  const listeners = channelListeners.get(msg.channel);
  if (!listeners) return;
  for (const listener of listeners) listener(msg);
}

export function connect() {
  if (socket && (socket.readyState === 0 || socket.readyState === 1)) return; // ya conectando/abierto
  explicitlyClosed = false;
  const { token } = useAuthStore.getState();
  const url = `${buildWsUrl(API_BASE_URL)}?token=${encodeURIComponent(token ?? '')}`;
  setStatus(reconnectAttempt > 0 ? 'reconnecting' : 'connecting');
  socket = new WebSocket(url);

  socket.onopen = () => {
    reconnectAttempt = 0;
    setStatus('open');
    startHeartbeat();
    for (const channel of subscribedChannels) {
      socket.send(JSON.stringify(buildMessage({ channel, type: 'subscribe' })));
    }
  };

  socket.onmessage = (event) => dispatchMessage(event.data);

  socket.onclose = () => {
    stopHeartbeat();
    if (explicitlyClosed) {
      setStatus('closed');
      return;
    }
    setStatus('reconnecting');
    scheduleReconnect();
  };

  socket.onerror = () => {
    // el cierre real llega por onclose -- acá no hace falta lógica propia
  };
}

export function disconnect() {
  explicitlyClosed = true;
  clearReconnectTimer();
  stopHeartbeat();
  if (socket) socket.close();
  socket = null;
  setStatus('closed');
}

export function subscribe(channel) {
  subscribedChannels.add(channel);
  if (socket && socket.readyState === 1) {
    socket.send(JSON.stringify(buildMessage({ channel, type: 'subscribe' })));
  }
}

export function unsubscribe(channel) {
  subscribedChannels.delete(channel);
  if (socket && socket.readyState === 1) {
    socket.send(JSON.stringify(buildMessage({ channel, type: 'unsubscribe' })));
  }
}

export function send(channel, type, payload, extra = {}) {
  if (!socket || socket.readyState !== 1) return; // efímero -- sin cola, se descarta si no hay conexión
  socket.send(JSON.stringify(buildMessage({ channel, type, payload, ...extra })));
}

export function on(channel, callback) {
  if (!channelListeners.has(channel)) channelListeners.set(channel, new Set());
  channelListeners.get(channel).add(callback);
}

export function off(channel, callback) {
  channelListeners.get(channel)?.delete(callback);
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx jest __tests__/realtime-client.test.js`
Expected: PASS, 13/13

- [ ] **Step 5: Commit**

```bash
git add services/realtime-client.js __tests__/realtime-client.test.js
git commit -m "feat(realtime): add generic singleton WebSocket client with channel multiplexing"
```

---

## Task 4: `useRealtimeChannel` hook

**Files:**
- Create: `hooks/use-realtime-channel.js`

No test file for this task — it is a thin React hook wrapping side-effecting subscriptions from
Task 3; per this project's convention there are no component/hook render tests, and every piece of
logic it touches (envelope, status transitions, subscribe/dispatch) is already covered by Task 3's
tests. Do not attempt to add a render/hook test here.

**Interfaces:**
- Consumes: `getStatus`, `onStatusChange`, `connect`, `subscribe`, `unsubscribe`, `on`, `off`,
  `send` from `services/realtime-client.js` (Task 3).
- Produces (consumed by Task 9's `use-live-session-runtime.js`):
  `useRealtimeChannel(channel: string | null, { onMessage, enabled = true } = {})` →
  `{ status: string, send: (type: string, payload?: object, extra?: object) => void }`.

- [ ] **Step 1: Implement**

```js
// hooks/use-realtime-channel.js
import { useCallback, useEffect, useRef, useState } from 'react';
import { connect, getStatus, off, on, onStatusChange, send as sendMessage, subscribe, unsubscribe } from '../services/realtime-client.js';

// Suscripción a un canal del bus de tiempo real genérico (spec 2026-09-28).
// El socket físico es un singleton compartido -- este hook solo administra
// la suscripción/desuscripción de ESTE canal en particular durante el ciclo
// de vida del componente que lo usa.
export function useRealtimeChannel(channel, { onMessage, enabled = true } = {}) {
  const [status, setStatus] = useState(getStatus());
  const onMessageRef = useRef(onMessage);
  onMessageRef.current = onMessage;

  useEffect(() => {
    if (!enabled || !channel) return undefined;
    connect();
    subscribe(channel);
    const handler = (msg) => onMessageRef.current?.(msg);
    on(channel, handler);
    const unsubscribeStatus = onStatusChange(setStatus);
    return () => {
      off(channel, handler);
      unsubscribe(channel);
      unsubscribeStatus();
    };
  }, [channel, enabled]);

  const send = useCallback(
    (type, payload, extra) => {
      if (!channel) return;
      sendMessage(channel, type, payload, extra);
    },
    [channel],
  );

  return { status, send };
}
```

- [ ] **Step 2: Commit**

```bash
git add hooks/use-realtime-channel.js
git commit -m "feat(realtime): add useRealtimeChannel hook"
```

---

## Task 5: Document Gap 18 in `docs/BACKEND_API_GAPS.md`

**Files:**
- Modify: `docs/BACKEND_API_GAPS.md` (append after the Gap 17 section, at the end of the file)

No test — documentation-only task.

**Interfaces:** none (this task produces no code interface; it's a standalone markdown addition).

- [ ] **Step 1: Read the last ~40 lines of `docs/BACKEND_API_GAPS.md` fresh**, to confirm Gap 17 is
  still the last section and copy its exact heading style (`## Gap N — <title>`).

- [ ] **Step 2: Append this section at the end of the file, verbatim**

```markdown

## Gap 18 — gateway WebSocket genérico + broadcast de eventos de sesión

Pedido de infraestructura de tiempo real, mismo patrón que Gap 13/14 (contrato deseado, backend
confirma o ajusta) — ver
`docs/superpowers/specs/2026-09-28-presencial-live-session-transport-runner-design.md` para el
diseño completo del lado frontend.

- Gateway WebSocket genérico (`/ws`), autenticado por JWT en query param (`?token=`), con soporte
  de `subscribe`/`unsubscribe` por canal string arbitrario y reenvío de mensajes `presence`/
  `control` a los demás suscriptores del mismo canal, aplicando la autorización que ya existe para
  el recurso que el canal nombra (para `session:{id}`, la misma regla de "atleta asignado o
  entrenador/owner del equipo" que ya protege los endpoints REST de esa sesión).
- Al persistir vía `POST /workout-feedback` (creación de una serie ya terminada/salteada/
  interrumpida), backend emite además un mensaje `update:set_event` al canal
  `session:{sessionInstanceId}` correspondiente con el mismo payload persistido +
  `athleteUserId` — puramente informativo, no cambia la respuesta HTTP existente.
  `POST /workout-feedback/:id/points` no necesita broadcast propio.
- Heartbeat: servidor espera `ping` cada 20-30s, cierra conexiones inactivas más allá de eso (a
  confirmar el valor exacto con backend según límites de Render).

**Impacto en frontend:** sin acción pendiente mientras este gap sigue abierto — bloquea la
posición en vivo y el feed casi-en-vivo de registros de la spec 2 (pantalla del entrenador). El
cliente corredor de esta spec (piezas transporte + corredor) funciona igual sin este gap resuelto,
salvo que sus mensajes `presence`/`control` no llegan a ningún destinatario real todavía.
```

- [ ] **Step 3: Commit**

```bash
git add docs/BACKEND_API_GAPS.md
git commit -m "docs(gaps): add Gap 18 — generic WebSocket gateway + session event broadcast"
```

---

## Task 6: Session-scoped continuous GPS tracker (`hooks/use-session-gps-tracker.js`)

**Files:**
- Create: `hooks/use-session-gps-tracker.js`

No test file — this hook wraps `expo-location` side effects exactly like the existing
`hooks/use-gps-tracker.js` (which also has no test file, for the same reason: it cannot run
without a real device/location provider). Do not attempt to mock `expo-location` for a unit test
here; that is out of scope and outside this project's established testing convention.

**Interfaces:**
- Produces (consumed by Task 9): `useSessionGpsTracker(enabled: boolean)` →
  `{ start: ({ onPoint }) => Promise<void>, stop: () => Promise<void> }`. Same `onPoint` payload
  shape as `hooks/use-gps-tracker.js`: `{ latitude, longitude, timestamp, accuracy }`.

- [ ] **Step 1: Implement**

```js
// hooks/use-session-gps-tracker.js
import { useCallback, useRef } from 'react';
import * as Location from 'expo-location';

// Igual que hooks/use-gps-tracker.js (por-serie, NO se toca) pero pensado
// para correr sin cortes desde el Play hasta finalizar toda la sesión
// presencial -- sin gate por serie activa, sin `getInitialPoint` (no hace
// falta un punto instantáneo por serie: el watch corre de punta a punta).
// Mismos parámetros de precisión ya probados y documentados en
// use-gps-tracker.js -- no cambiar sin releer esa justificación.
export function useSessionGpsTracker(enabled) {
  const subscriptionRef = useRef(null);
  const startedRef = useRef(false);

  const stop = useCallback(async () => {
    const subscription = subscriptionRef.current;
    subscriptionRef.current = null;
    startedRef.current = false;
    if (subscription) await subscription.remove();
  }, []);

  const start = useCallback(
    async ({ onPoint } = {}) => {
      if (!enabled || startedRef.current) return;
      startedRef.current = true;
      try {
        const subscription = await Location.watchPositionAsync(
          {
            accuracy: Location.Accuracy.High,
            timeInterval: 1000,
            distanceInterval: 1,
          },
          (position) => {
            onPoint?.({
              latitude: position.coords.latitude,
              longitude: position.coords.longitude,
              timestamp: position.timestamp,
              accuracy: position.coords.accuracy,
            });
          },
        );
        subscriptionRef.current = subscription;
      } catch {
        startedRef.current = false;
      }
    },
    [enabled],
  );

  return { start, stop };
}
```

- [ ] **Step 2: Commit**

```bash
git add hooks/use-session-gps-tracker.js
git commit -m "feat(session-live): add continuous session-scoped GPS tracker hook"
```

---

## Task 7: Fix `start-session-button.jsx` presencial window check

**Files:**
- Modify: `components/calendar/start-session-button.jsx:123` (the `inWindow` line — read the file
  fresh first, this plan's implementer must confirm the exact current line number before editing,
  since neighboring lines may have shifted since this plan was written)
- Modify: `components/calendar/start-session-button.jsx:177-180` (the `handlePress` inside
  `StartSessionButton`, the un-named runner/general Play handler)

No new test file — the underlying window functions (`canStartAsyncSession`,
`canStartPresencialSession`) already have full coverage in `__tests__/session-start-window.test.js`
(verified before writing this plan). This task only changes which of those two already-tested
functions gets called for a runner, based on `assignment.isPresencial` — a component-level wiring
change with no new pure logic to test, per this project's "no component render tests" convention.

**Interfaces:**
- Consumes: `canStartAsyncSession`, `canStartPresencialSession` from `utils/session-start-window.js`
  (already imported in this file — no import change needed, just how they're called).

- [ ] **Step 1: Read `components/calendar/start-session-button.jsx` fresh** to confirm the current
  line numbers before editing (this plan was written against a version where the relevant lines
  are quoted below).

- [ ] **Step 2: Fix the `inWindow` calculation**

Current code (around line 123):

```js
const inWindow = role === 'runner' ? canStartAsyncSession(assignment) : canStartPresencialSession(assignment);
```

This always uses the **async** window check for a runner, even when `assignment.isPresencial` is
true — a presencial session's runner-side Play would use the wrong window (same-day, instead of
±30min around `presencialTimeFrom`). Change to:

```js
const inWindow = role === 'runner'
  ? (assignment.isPresencial ? canStartPresencialSession(assignment) : canStartAsyncSession(assignment))
  : canStartPresencialSession(assignment);
```

- [ ] **Step 3: Verify nothing else in this file assumes a runner's session is never presencial**

Read the rest of the file (already fixed at ~195 lines as of this plan's writing) — specifically
the `showReview`/`TrainerReviewButton`/`RunnerReviewWebButton` branches above `inWindow` and the
`handlePress` navigation below it. Confirm `handlePress` for the runner case still unconditionally
navigates to `/training-session` (the pre-start screen) — **do not** change this to navigate
directly to `/training-session-live`; the presencial-vs-async routing decision belongs inside
`session-pre-start-screen.jsx`'s own Play handler (Task 8), not here. If the file has drifted from
this description in a way that contradicts this plan's assumptions, stop and flag it rather than
guessing.

- [ ] **Step 4: Manual verification (no automated test for this file)**

Confirm by reading the diff that: (a) a runner assignment with `isPresencial: false` still behaves
exactly as before (uses `canStartAsyncSession`), and (b) a runner assignment with
`isPresencial: true` now uses `canStartPresencialSession` instead of `canStartAsyncSession`.

- [ ] **Step 5: Run the full test suite to confirm no regression**

Run: `npm test`
Expected: same pass count as before this task (this file has no dedicated test, but confirm no
other suite references its old behavior)

- [ ] **Step 6: Commit**

```bash
git add components/calendar/start-session-button.jsx
git commit -m "fix(calendar): use presencial window check for a runner's presencial session"
```

---

## Task 8: Route the corredor's Play to the live screen for presencial sessions

**Files:**
- Modify: `components/session-runtime/session-pre-start-screen.jsx:92-110` (the `handlePlay`
  function inside `SessionPreStartScreenContent`)

No test file — this is a component-level routing change with no new pure logic (`pendingSession`'s
`isPresencial` field is read directly, not computed).

**Interfaces:**
- Consumes: `pendingSession.isPresencial` (boolean field already present on the assignment/day
  object stored by `setPendingSession`, same object `utils/session-start-window.js`'s functions
  already read this field from).

- [ ] **Step 1: Read `components/session-runtime/session-pre-start-screen.jsx` fresh** to confirm
  `handlePlay`'s current exact content before editing (quoted below as of this plan's writing).

- [ ] **Step 2: Change the final navigation line of `handlePlay`**

Current code (last line of `handlePlay`, around line 109):

```js
    setGpsEnabled(gpsEnabled);
    router.push('/training-session-active');
  };
```

Change to:

```js
    setGpsEnabled(gpsEnabled);
    router.push(pendingSession.isPresencial ? '/training-session-live' : '/training-session-active');
  };
```

No other change to this file — the rest of `handlePlay` (permission request, `createRunnerSession`
fire-and-forget call, `gpsEnabled` detection) stays identical for both session types, since both
need the same permission grant and the same `runner_session` wip creation regardless of sync vs.
live.

- [ ] **Step 3: Run the full test suite to confirm no regression**

Run: `npm test`
Expected: same pass count as before this task

- [ ] **Step 4: Commit**

```bash
git add components/session-runtime/session-pre-start-screen.jsx
git commit -m "feat(session-live): route presencial Play to the new live screen"
```

---

## Task 9: Live session orchestration hook (`hooks/use-live-session-runtime.js`)

This is the non-visual engine behind the new screen: bootstrap, run/set state, the continuous GPS
tracker wiring (live position broadcast + durable per-series sync), and the realtime channel
(presence + control handling). Task 10 builds the screen that consumes it.

**Files:**
- Create: `hooks/use-live-session-runtime.js`

No test file — this hook coordinates SQLite (`session-db.js`), REST (`session-sync.js`), GPS
(Task 6), and the realtime channel (Task 4), none of which are unit-testable in this project
without a real device/network/database (same reasoning as `training-session-active-screen.jsx`,
which also has no test file for its equivalent orchestration logic).

**Interfaces:**
- Consumes:
  - `useSessionRuntimeStore((s) => s.pendingSession)` from `store/session-runtime-store.js`
    (unchanged store, already has `.sessionInstance`, `.date`, `.teamId`, `.isPresencial`).
  - `useLiveSessionStore` from `store/live-session-store.js` (`gpsEnabled`, unchanged store).
  - `useAuthStore((s) => s.userId)` from `store/auth-store.js`.
  - `initSessionDb`, `createRun`, `getRun`, `getActiveRun`, `getSetsForRun`, `markSetStarted`,
    `finishSet`, `markSetSkipped`, `skipSetsForExercise`, `markSetInterrupted`,
    `interruptStartedSets`, `updateSetDistance`, `updateSetTimings`, `insertGpsPoint`,
    `finalizeRun`, `cancelRun` from `services/session-db.js` (all pre-existing, unchanged).
  - `syncRun` from `services/session-sync.js` (pre-existing, unchanged — called more often than
    async does, never modified).
  - `acceptGpsLeg` from `utils/distance.js` (pre-existing, unchanged).
  - `useSessionGpsTracker` from `hooks/use-session-gps-tracker.js` (Task 6).
  - `useRealtimeChannel` from `hooks/use-realtime-channel.js` (Task 4).
  - `useStopwatch` from `hooks/use-stopwatch.js` (pre-existing, unchanged — same `{ start, pause,
    resumeFrom, wallMs, activeMs, running }` shape already used by `training-session-active-screen.jsx`).
- Produces (consumed by Task 10):
  `useLiveSessionRuntime()` → an object with:
  - `booted: boolean`, `bootError: Error | null`
  - `run: object | null`, `sets: Array<object>` (same row shapes as `session-db.js`'s tables)
  - `connectionStatus: 'connecting' | 'open' | 'reconnecting' | 'closed'`
  - `pendingControl: { event: 'session_paused' | 'session_finished' | 'announcement', payload?: object } | null` — the latest unhandled control message, cleared via `clearPendingControl()`
  - `clearPendingControl: () => void`
  - `distanceBySetId: Map<number, number>` — live-updating distance per set (mirrors `SeriesView`'s local `distance` state, but lifted here since the screen needs it too for the overview list)
  - `startSet: (setId: number) => Promise<void>` — begins a set (countdown handled by the screen, this just does the DB write + GPS wiring)
  - `finishSet: (setId: number, timings: { wallMs: number, activeMs: number }) => Promise<void>`
  - `skipSet: (setId: number) => Promise<void>`
  - `skipExercise: (exerciseInstanceId: number) => Promise<void>`
  - `pauseSet: (setId: number, timings: { wallMs: number, activeMs: number }) => Promise<void>`
  - `cancelSession: () => Promise<void>`
  - `finalizeSession: () => Promise<void>`

- [ ] **Step 1: Implement**

```js
// hooks/use-live-session-runtime.js
import { useEffect, useRef, useState } from 'react';
import { useSessionRuntimeStore } from '../store/session-runtime-store.js';
import { useLiveSessionStore } from '../store/live-session-store.js';
import { useAuthStore } from '../store/auth-store.js';
import {
  cancelRun,
  createRun,
  finalizeRun,
  finishSet as finishSetDb,
  getActiveRun,
  getRun,
  getSetsForRun,
  initSessionDb,
  insertGpsPoint,
  interruptStartedSets,
  markSetInterrupted,
  markSetSkipped,
  markSetStarted,
  skipSetsForExercise,
  updateSetDistance,
  updateSetTimings,
} from '../services/session-db.js';
import { syncRun } from '../services/session-sync.js';
import { acceptGpsLeg } from '../utils/distance.js';
import { toIsoUtc } from '../utils/time.js';
import { useSessionGpsTracker } from './use-session-gps-tracker.js';
import { useRealtimeChannel } from './use-realtime-channel.js';

// Motor no-visual de la pantalla presencial en vivo (Task 10 la consume).
// GPS continuo: TODO punto aceptado se manda en vivo por WS
// (presence:position, sin importar si hay serie activa) -- la persistencia
// durable sigue el timing de siempre (solo cuando una serie TERMINA), vía
// syncRun sin modificar, llamado por serie en vez de solo al final.
export function useLiveSessionRuntime() {
  const pendingSession = useSessionRuntimeStore((s) => s.pendingSession);
  const gpsEnabled = useLiveSessionStore((s) => s.gpsEnabled);
  const setSessionStarted = useLiveSessionStore((s) => s.setSessionStarted);
  const userId = useAuthStore((s) => s.userId);

  const [booted, setBooted] = useState(false);
  const [bootError, setBootError] = useState(null);
  const [run, setRun] = useState(null);
  const [sets, setSets] = useState([]);
  const [distanceBySetId, setDistanceBySetId] = useState(new Map());
  const [pendingControl, setPendingControl] = useState(null);

  const activeSetIdRef = useRef(null);
  const lastPointRef = useRef(null);
  const pointOrderRef = useRef(0);
  // Acumulador real por set-id, en un ref -- handleGpsPoint se pasa a
  // gps.start() UNA sola vez (el efecto de abajo corre solo al bootear), así
  // que cualquier valor leído de useState ahí quedaría pegado al snapshot de
  // ese momento para siempre. distanceBySetId (state) es solo el espejo para
  // renderizar -- la cuenta real vive acá.
  const distanceRef = useRef(new Map());

  const channel = run ? `session:${run.session_instance_id}` : null;

  const handleChannelMessage = (msg) => {
    if (msg.type !== 'control') return;
    setPendingControl({ event: msg.event, payload: msg.payload });
  };

  const { status: connectionStatus, send } = useRealtimeChannel(channel, {
    onMessage: handleChannelMessage,
    enabled: Boolean(channel),
  });

  const gps = useSessionGpsTracker(gpsEnabled);

  const reloadSets = async (runId) => {
    const all = await getSetsForRun(runId);
    setSets(all);
    return all;
  };

  const bootstrap = async () => {
    try {
      await initSessionDb();
      const sessionInstance = pendingSession.sessionInstance;
      const sessionDate = pendingSession.date;
      let runRow = await getActiveRun(sessionInstance.id, sessionDate, userId);
      if (!runRow) {
        const createdId = await createRun({
          sessionInstanceId: sessionInstance.id,
          sessionName: sessionInstance.name ?? 'Entrenamiento',
          sessionDate,
          teamId: pendingSession.teamId,
          userId,
          gpsEnabled,
          exercises: sessionInstance.exercises ?? [],
        });
        runRow = await getRun(createdId);
      }
      setSessionStarted(runRow.id, Boolean(runRow.gps_enabled));
      setRun(runRow);
      await reloadSets(runRow.id);
      setBooted(true);
    } catch (error) {
      setBootError(error);
    }
  };

  useEffect(() => {
    if (pendingSession) bootstrap();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingSession]);

  const handleGpsPoint = async (point) => {
    // Movimiento en vivo: SIEMPRE, haya o no serie activa -- efímero, nunca
    // se persiste. Ver spec 2026-09-28, sección "GPS continuo".
    send('presence', undefined, { event: 'position', payload: { latitude: point.latitude, longitude: point.longitude } });

    const setId = activeSetIdRef.current;
    if (!setId) return; // sin serie activa: solo el broadcast de arriba, nada más

    if (!lastPointRef.current) {
      lastPointRef.current = point;
      pointOrderRef.current = 0;
      await insertGpsPoint(setId, 0, point.latitude, point.longitude, point.timestamp ?? Date.now());
      distanceRef.current.set(setId, 0);
      setDistanceBySetId(new Map(distanceRef.current));
      await updateSetDistance(setId, 0);
      return;
    }
    const leg = acceptGpsLeg({ from: lastPointRef.current, to: point });
    if (leg == null) return;
    lastPointRef.current = point;
    pointOrderRef.current += 1;
    await insertGpsPoint(setId, pointOrderRef.current, point.latitude, point.longitude, point.timestamp ?? Date.now());
    if (leg > 0) {
      const nextTotal = (distanceRef.current.get(setId) ?? 0) + leg;
      distanceRef.current.set(setId, nextTotal);
      setDistanceBySetId(new Map(distanceRef.current));
      await updateSetDistance(setId, nextTotal);
    }
  };

  useEffect(() => {
    if (!booted) return undefined;
    gps.start({ onPoint: handleGpsPoint });
    return () => { gps.stop(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [booted]);

  const syncIncrementally = () => {
    if (run) syncRun(run.id).catch(() => {}); // fire-and-forget, mismo patrón que createRunnerSession en el pre-start
  };

  const startSet = async (setId) => {
    activeSetIdRef.current = setId;
    lastPointRef.current = null;
    pointOrderRef.current = 0;
    await markSetStarted(setId, toIsoUtc());
    await reloadSets(run.id);
  };

  const finishSet = async (setId, { wallMs, activeMs }) => {
    const distance = distanceRef.current.get(setId) ?? null;
    await finishSetDb(setId, { endedAtIso: toIsoUtc(), durationMs: wallMs, activeDurationMs: activeMs, distanceMeters: distance });
    activeSetIdRef.current = null;
    lastPointRef.current = null;
    await reloadSets(run.id);
    syncIncrementally();
  };

  const skipSet = async (setId) => {
    await markSetSkipped(setId);
    if (activeSetIdRef.current === setId) {
      activeSetIdRef.current = null;
      lastPointRef.current = null;
    }
    await reloadSets(run.id);
    syncIncrementally();
  };

  const skipExercise = async (exerciseInstanceId) => {
    await skipSetsForExercise(run.id, exerciseInstanceId);
    activeSetIdRef.current = null;
    lastPointRef.current = null;
    await reloadSets(run.id);
    syncIncrementally();
  };

  const pauseSet = async (setId, { wallMs, activeMs }) => {
    await updateSetTimings(setId, { durationMs: wallMs, activeDurationMs: activeMs });
    await reloadSets(run.id);
  };

  const cancelSession = async () => {
    await interruptStartedSets(run.id);
    await cancelRun(run.id);
    syncIncrementally();
  };

  const finalizeSession = async () => {
    await finalizeRun(run.id);
    syncIncrementally();
  };

  return {
    booted,
    bootError,
    run,
    sets,
    connectionStatus,
    pendingControl,
    clearPendingControl: () => setPendingControl(null),
    distanceBySetId,
    startSet,
    finishSet,
    skipSet,
    skipExercise,
    pauseSet,
    cancelSession,
    finalizeSession,
  };
}
```

- [ ] **Step 2: Commit**

```bash
git add hooks/use-live-session-runtime.js
git commit -m "feat(session-live): add live session orchestration hook (GPS + sync + channel)"
```

---

## Task 10: Live session screen + route (`training-session-live-screen.jsx`)

**Files:**
- Create: `components/session-runtime/training-session-live-screen.jsx`
- Create: `app/training-session-live.jsx`

No test file — visual screen, per this project's "no component render tests" convention. Verified
manually (see Step 4).

**Interfaces:**
- Consumes: `useLiveSessionRuntime` from `hooks/use-live-session-runtime.js` (Task 9);
  `useStopwatch` from `hooks/use-stopwatch.js` (pre-existing); `formatStopwatch`, `toIsoUtc` from
  `utils/time.js` (pre-existing, already used by `training-session-active-screen.jsx`);
  `formatMeters` from `utils/distance.js` (pre-existing); `MobileOnlyRoute` from
  `../guards/platform-gate.jsx`; `useThemeColors` from `../../theme/colors.js`.
- Produces: the route `/training-session-live`, target of Task 8's `router.push`.

Scope note 1: this screen intentionally uses simpler tap-based controls (Play / Finalizar /
Saltear buttons) instead of `training-session-active-screen.jsx`'s drag-gesture-to-finish
(`DragToFinishButton`, built on `react-native-gesture-handler`/`react-native-reanimated`). That
component is defined locally inside the async file (not exported) and this plan does not modify
that file — duplicating the full gesture machinery here for a first version is not worth the risk
this session's history has already logged around gesture-handler timing issues (see this repo's
CLAUDE.md, drag-and-drop section). Tap controls can be upgraded to match later as its own small
follow-up if desired; this is a deliberate, disclosed scope decision, not an oversight.

Scope note 2: the `control:session_paused` message (spec's "pausa el corredor") is **not wired in
this task**. The running stopwatch lives inside each `SeriesRow`'s own local `useStopwatch()`
instance, not in the shared runtime hook — pausing it remotely would require lifting that timer
state up into `use-live-session-runtime.js` so it's reachable from the channel's message handler, a
meaningfully bigger change than fits this task's scope. `control:announcement` and
`control:session_finished` ARE wired (below); `session_paused` is a disclosed gap, to close as a
small follow-up once this screen's base is confirmed working on a real device.

- [ ] **Step 1: Read `components/session-runtime/training-session-active-screen.jsx` fresh** for
  the exact surrounding visual patterns to mirror: `STATUS_META`/`SetStatusChip` styling, the
  overview list layout, `SafeAreaView`/`MobileOnlyRoute` wrapping, `useThemeColors()` usage, Toast
  usage pattern (`import Toast from 'react-native-toast-message'`), `notifyError`/`notifySuccess`
  from `../../utils/haptics.js`. Reuse these visual conventions; do not import anything from that
  file (nothing needed is exported from it).

- [ ] **Step 2: Implement the screen**

```jsx
// components/session-runtime/training-session-live-screen.jsx
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';
import { MobileOnlyRoute } from '../guards/platform-gate.jsx';
import { useThemeColors } from '../../theme/colors.js';
import { useLiveSessionStore } from '../../store/live-session-store.js';
import { useLiveSessionRuntime } from '../../hooks/use-live-session-runtime.js';
import { useStopwatch } from '../../hooks/use-stopwatch.js';
import { formatStopwatch } from '../../utils/time.js';
import { formatMeters } from '../../utils/distance.js';
import { notifyError, notifySuccess } from '../../utils/haptics.js';

const CONNECTION_META = {
  open: { label: 'En vivo', dot: 'bg-primary', text: 'text-emerald-700 dark:text-emerald-400' },
  connecting: { label: 'Conectando…', dot: 'bg-amber-400', text: 'text-amber-700 dark:text-amber-400' },
  reconnecting: { label: 'Reconectando…', dot: 'bg-amber-400', text: 'text-amber-700 dark:text-amber-400' },
  closed: { label: 'Sin conexión — guardando localmente', dot: 'bg-slate-400', text: 'text-slate-500 dark:text-slate-400' },
};

function ConnectionBanner({ status }) {
  const meta = CONNECTION_META[status] ?? CONNECTION_META.closed;
  return (
    <View className="flex-row items-center gap-2 self-center rounded-full bg-slate-100 px-3 py-1 dark:bg-slate-800" nativeID="training-session-live-connection-banner" testID="training-session-live-connection-banner">
      <View className={`h-2 w-2 rounded-full ${meta.dot}`} nativeID="training-session-live-connection-dot" testID="training-session-live-connection-dot" />
      <Text className={`text-xs font-semibold ${meta.text}`} nativeID="training-session-live-connection-label" testID="training-session-live-connection-label">
        {meta.label}
      </Text>
    </View>
  );
}

function SeriesRow({ set, isNext, onStart, onFinish, onSkip, distance }) {
  const colors = useThemeColors();
  const stopwatch = useStopwatch();
  const idPrefix = `training-session-live-set-${set.id}`;
  const running = set.status === 'started';

  const handlePlay = async () => {
    stopwatch.start();
    await onStart(set.id);
  };

  const handleFinish = async () => {
    const snap = stopwatch.pause();
    await onFinish(set.id, snap);
  };

  return (
    <View className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900" nativeID={`${idPrefix}-card`} testID={`${idPrefix}-card`}>
      <View className="flex-row items-center justify-between" nativeID={`${idPrefix}-header`} testID={`${idPrefix}-header`}>
        <Text className="text-sm font-semibold text-slate-900 dark:text-white" nativeID={`${idPrefix}-name`} testID={`${idPrefix}-name`}>
          {set.exercise_name} · Serie {set.set_number + 1}
        </Text>
        <Text className="text-xs uppercase text-slate-500 dark:text-slate-400" nativeID={`${idPrefix}-status`} testID={`${idPrefix}-status`}>
          {set.status}
        </Text>
      </View>
      {running && (
        <Text className="mt-2 text-3xl text-slate-900 dark:text-white" style={{ fontFamily: 'Orbitron_700Bold' }} nativeID={`${idPrefix}-timer`} testID={`${idPrefix}-timer`}>
          {formatStopwatch(stopwatch.wallMs)}
        </Text>
      )}
      {distance != null && (
        <Text className="mt-1 text-sm text-emerald-700 dark:text-emerald-400" nativeID={`${idPrefix}-distance`} testID={`${idPrefix}-distance`}>
          {formatMeters(distance)}
        </Text>
      )}
      {isNext && set.status === 'pending' && (
        <View className="mt-3 flex-row gap-2" nativeID={`${idPrefix}-actions-pending`} testID={`${idPrefix}-actions-pending`}>
          <Pressable className="h-11 flex-1 flex-row items-center justify-center gap-2 rounded-full bg-primary active:opacity-80" nativeID={`${idPrefix}-play-button`} onPress={handlePlay} testID={`${idPrefix}-play-button`}>
            <MaterialCommunityIcons color={colors.onPrimary} name="play" size={18} />
            <Text className="text-sm font-bold uppercase text-[#111518]" nativeID={`${idPrefix}-play-label`} testID={`${idPrefix}-play-label`}>Iniciar</Text>
          </Pressable>
          <Pressable className="h-11 items-center justify-center rounded-full border border-slate-200 px-4 active:opacity-70 dark:border-slate-700" nativeID={`${idPrefix}-skip-button`} onPress={() => onSkip(set.id)} testID={`${idPrefix}-skip-button`}>
            <Text className="text-sm font-semibold text-slate-700 dark:text-slate-200" nativeID={`${idPrefix}-skip-label`} testID={`${idPrefix}-skip-label`}>Saltear</Text>
          </Pressable>
        </View>
      )}
      {running && (
        <Pressable className="mt-3 h-11 flex-row items-center justify-center gap-2 rounded-full bg-primary active:opacity-80" nativeID={`${idPrefix}-finish-button`} onPress={handleFinish} testID={`${idPrefix}-finish-button`}>
          <MaterialCommunityIcons color={colors.onPrimary} name="flag-checkered" size={18} />
          <Text className="text-sm font-bold uppercase text-[#111518]" nativeID={`${idPrefix}-finish-label`} testID={`${idPrefix}-finish-label`}>Finalizar</Text>
        </Pressable>
      )}
    </View>
  );
}

function TrainingSessionLiveScreenContent() {
  const router = useRouter();
  const clearLiveSession = useLiveSessionStore((s) => s.clearLiveSession);
  const {
    booted,
    bootError,
    sets,
    connectionStatus,
    pendingControl,
    clearPendingControl,
    distanceBySetId,
    startSet,
    finishSet,
    skipSet,
    cancelSession,
    finalizeSession,
  } = useLiveSessionRuntime();
  const [finishing, setFinishing] = useState(false);

  const nextSet = sets.find((s) => s.status === 'pending');

  // Side effects de un mensaje de control entrante van en un efecto, nunca
  // directo en el cuerpo del render (llamar Toast.show/finalizeSession ahí
  // dispararía en cada render, no solo cuando pendingControl cambia).
  useEffect(() => {
    if (!pendingControl) return;
    if (pendingControl.event === 'announcement') {
      Toast.show({ type: 'info', text1: 'Aviso del entrenador', text2: pendingControl.payload?.message ?? '' });
      clearPendingControl();
      return;
    }
    if (pendingControl.event === 'session_finished' && !finishing) {
      setFinishing(true);
      finalizeSession().finally(() => {
        clearLiveSession();
        router.back();
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingControl]);

  if (!booted) {
    return (
      <MobileOnlyRoute>
        <View className="flex-1 items-center justify-center bg-paper dark:bg-ink" nativeID="training-session-live-loading" testID="training-session-live-loading">
          <ActivityIndicator color="#8cc63e" size="large" />
          <Text className="mt-3 text-sm text-slate-500 dark:text-slate-400" nativeID="training-session-live-loading-label" testID="training-session-live-loading-label">
            {bootError ? 'No pudimos preparar la sesión' : 'Preparando la sesión…'}
          </Text>
        </View>
      </MobileOnlyRoute>
    );
  }

  const handleFinishAll = async () => {
    try {
      await finalizeSession();
      notifySuccess();
    } catch {
      notifyError();
    } finally {
      clearLiveSession();
      router.back();
    }
  };

  const handleCancel = async () => {
    try {
      await cancelSession();
    } finally {
      clearLiveSession();
      router.back();
    }
  };

  return (
    <MobileOnlyRoute>
      <SafeAreaView className="flex-1 bg-paper dark:bg-ink" edges={['top', 'bottom']} nativeID="training-session-live-root" testID="training-session-live-root">
        <View className="items-center py-2" nativeID="training-session-live-banner-container" testID="training-session-live-banner-container">
          <ConnectionBanner status={connectionStatus} />
        </View>
        <ScrollView contentContainerClassName="gap-3 p-4" nativeID="training-session-live-scroll" testID="training-session-live-scroll">
          {sets.map((set) => (
            <SeriesRow
              distance={distanceBySetId.get(set.id)}
              isNext={nextSet?.id === set.id}
              key={set.id}
              onFinish={finishSet}
              onSkip={skipSet}
              onStart={startSet}
              set={set}
            />
          ))}
        </ScrollView>
        <View className="flex-row gap-3 border-t border-slate-100 p-4 dark:border-slate-800" nativeID="training-session-live-footer" testID="training-session-live-footer">
          <Pressable className="h-12 flex-1 items-center justify-center rounded-full border border-red-300 active:opacity-70 dark:border-red-900/60" nativeID="training-session-live-cancel-button" onPress={handleCancel} testID="training-session-live-cancel-button">
            <Text className="text-sm font-semibold text-red-700 dark:text-red-400" nativeID="training-session-live-cancel-label" testID="training-session-live-cancel-label">Cancelar</Text>
          </Pressable>
          <Pressable className="h-12 flex-1 items-center justify-center rounded-full bg-primary active:opacity-80" nativeID="training-session-live-finish-all-button" onPress={handleFinishAll} testID="training-session-live-finish-all-button">
            <Text className="text-sm font-bold uppercase text-[#111518]" nativeID="training-session-live-finish-all-label" testID="training-session-live-finish-all-label">Finalizar sesión</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    </MobileOnlyRoute>
  );
}

export function TrainingSessionLiveScreen() {
  return (
    <MobileOnlyRoute>
      <TrainingSessionLiveScreenContent />
    </MobileOnlyRoute>
  );
}
```

- [ ] **Step 3: Add the route wrapper**

```jsx
// app/training-session-live.jsx
import { TrainingSessionLiveScreen } from '../components/session-runtime/training-session-live-screen.jsx';

export default function TrainingSessionLive() {
  return <TrainingSessionLiveScreen />;
}
```

- [ ] **Step 4: Manual verification**

Run: `npm run lint` — must be clean (checks `local/require-native-id` on every new element).
Run: `npm test` — must show the same pass count as Task 9 plus any new tests from Tasks 1-3.

This screen's real behavior (live GPS, WS position broadcast, control messages, reconnection) is
not verifiable through the web preview per this project's established limitation for native-only
live-session screens (see CLAUDE.md, "Registro de actividad en vivo en vivo" section) — flag this
explicitly rather than claiming it was tested, per this project's verification standard.

- [ ] **Step 5: Commit**

```bash
git add components/session-runtime/training-session-live-screen.jsx app/training-session-live.jsx
git commit -m "feat(session-live): add presencial live session screen and route"
```

---

## Task 11: Final verification + manual QA script

**Files:** none created or modified — verification only.

- [ ] **Step 1: Run the full test suite**

Run: `npm test`
Expected: all tests pass, including every test added in Tasks 1-3.

- [ ] **Step 2: Run lint**

Run: `npm run lint`
Expected: no errors (warnings pre-existing and unrelated to this branch are acceptable per this
project's convention).

- [ ] **Step 3: Output this manual test script verbatim in the final chat reply**

```
Verificación manual — sesión presencial (corredor), requiere dispositivo/Expo dev client real
(no es verificable en el preview web, ver CLAUDE.md):

1. Backend local corriendo (Gap 18 todavía no resuelto en el backend real -- los mensajes de
   control/presencia no van a llegar a ningún otro cliente todavía; esto solo verifica que el
   cliente no rompe nada mientras tanto).
2. Crear/editar una sesión de calendario con `isPresencial: true` y un `presencialTimeFrom` dentro
   de los próximos ±30 minutos.
3. Como corredor, entrar al día del calendario -> confirmar que el botón "Iniciar entrenamiento"
   aparece (ventana ±30min, no la regla de "mismo día" de async) -- si no aparece fuera de esa
   ventana pero SÍ aparece para una sesión async el mismo día, el fix de start-session-button.jsx
   (Task 7) funcionó.
4. Presionar el botón -> entra al pre-start de siempre (misma interfaz, sin cambios visibles).
5. Presionar Play en el pre-start -> debe navegar a la pantalla NUEVA (`/training-session-live`),
   no a `/training-session-active` -- confirma el fix de Task 8.
6. En la pantalla nueva: confirmar el banner de conexión (probablemente "Conectando…" o
   "Sin conexión" si el gateway real todavía no existe -- eso es esperado).
7. Iniciar una serie, caminar/correr un poco, finalizar la serie -> confirmar que la distancia se
   actualiza en la card mientras la serie está en curso (mismo filtro de calidad que async).
8. Cortar la conexión a internet del dispositivo a mitad de una serie, finalizarla, y volver a
   conectar -> confirmar que `npx react-native log-android` (o la consola de Expo) no muestra
   ningún error no manejado -- `syncRun` debe fallar en silencio y la próxima serie terminada debe
   reintentar automáticamente (revisar en Postman/logs de backend si el feedback de la serie
   fallida efectivamente subió en el segundo intento).
9. Cancelar la sesión a mitad de camino -> confirmar que vuelve a la pantalla anterior sin crashear
   y que las series ya completadas quedan `synced` (revisar contra el backend o los logs).

Esto NO alcanza a verificar el lado del entrenador (mapa, participantes, control remoto) -- eso es
la spec 2, todavía sin construir. Tampoco verifica el broadcast real `update:set_event` ni
`control` entre dos dispositivos -- eso depende de que Gap 18 esté resuelto en el backend real.
```

- [ ] **Step 4: Report results** — do not claim the feature "works end-to-end"; report exactly
  what automated verification passed (tests, lint) and that live-device behavior is unverified
  pending Gap 18 and a real device session, per this project's verification-before-completion
  standard.

---

## Self-Review Notes

- **Spec coverage:** every "Sí" bullet in the spec's Alcance section maps to a task — generic WS
  client + channel hook (Tasks 3-4), Gap 18 doc (Task 5), live screen + route (Tasks 9-10),
  continuous GPS (Task 6), incremental REST via `syncRun` reuse (Task 9, no new sync code), Play
  routing (Task 8), presencial window fix (Task 7, a prerequisite bug found during brainstorming
  that blocks reaching the feature at all). The spec's "No" bullets (trainer screen, attendance
  popup, route/deviation detection, notifications, AI agent) have no tasks, correctly. One spec
  behavior — `control:session_paused` pausing the corredor remotely — is knowingly NOT implemented
  by Task 10 (disclosed as "Scope note 2" in that task) because the running timer lives local to
  `SeriesRow`, not in the shared runtime hook; flagged as a follow-up, not silently dropped.
- **Placeholder scan:** no task contains "TBD"/"add proper error handling"/"similar to Task N
  without code" — every step with code has complete code, every non-code step (Task 5, 7, 11) has
  concrete instructions and exact content to copy or exact lines to verify.
- **Type/signature consistency:** `buildMessage`/`parseMessage`/`buildWsUrl` (Task 1) signatures
  match their usage in Task 3 exactly. `computeBackoffMs` (Task 2) signature matches its one call
  site in Task 3. `services/realtime-client.js`'s exported function names (`connect`, `subscribe`,
  `unsubscribe`, `send`, `on`, `off`, `getStatus`, `onStatusChange`) match exactly what Task 4's
  hook imports and calls. `useRealtimeChannel`'s return shape (`{ status, send }`) matches what
  Task 9's hook destructures. `useSessionGpsTracker`'s `{ start, stop }` shape (Task 6) matches
  Task 9's usage (`gps.start({ onPoint })`, `gps.stop()`). `useLiveSessionRuntime`'s full returned
  object (Task 9) matches every field Task 10's screen destructures and calls, verified field by
  field against Task 10's code.
