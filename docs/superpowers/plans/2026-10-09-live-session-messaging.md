# Mensajería en sesión presencial en vivo — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let the trainer and any runner message each other (or everyone) during a live presencial
session, with 3 severity levels (info/aviso/alerta), quick replies, and a persisted history that
survives reconnection.

**Architecture:** REST is the source of truth (`POST`/`GET /session-instances/:id/messages`,
already deployed — see Gap 27 in `docs/BACKEND_API_GAPS.md`); the WS channel only carries a
contentless `control:message_created` nudge that triggers a refetch. Both live-session runtime
hooks (`use-live-session-runtime.js` for the runner, `use-trainer-session-runtime.js` for the
trainer) already own a channel subscription — this plan adds one branch to each `handleChannelMessage`
to invalidate the TanStack Query cache on that nudge, nothing new to subscribe. A single shared
`SessionMessagesModal` component (prop `role: 'trainer' | 'runner'`) renders the list, compose bar,
and recipient picker for both screens — only the recipient-picker's candidate list and the
severity-delivery call site differ per screen (already-mounted parent, not the modal).

**Tech Stack:** TanStack Query (existing), `expo-audio` (new native dependency, SDK 54), Jest for
pure-logic tests (project convention — no component render tests).

**Spec:** `docs/superpowers/specs/2026-10-09-live-session-messaging-design.md`. The backend
contract referenced throughout this plan is the **confirmed, deployed** version in
`docs/BACKEND_API_GAPS.md`, Gap 27, "Actualización 2026-10-09 (2)" block — it is more precise than
the spec's own "Modelo de datos" section on exact shapes/authorization/WS frame; where they
differ, this plan follows the Gap 27 doc.

## Global Constraints

- Backend endpoints are live now: `POST /api/v1/session-instances/{id}/messages`,
  `GET /api/v1/session-instances/{id}/messages?since=<id>`. Confirmed response shapes below are
  exact, not illustrative.
- `POST` response body is the created message **directly** (no `{data: ...}` wrapper) — different
  from `runnerSession.js`'s endpoints, which do wrap. Do not copy that wrapper assumption.
- `GET` response body is `{"messages": [...]}` — an object, never a bare array.
- WS frame for the nudge: `{"type":"control:message_created","channel":"session:{id}","payload":{"sessionMessageId":N}}`
  — `type` is a single string literal (same family as `update:set_event`), never `type:"control"` +
  a separate `event` field. This is **not** a relayed client-to-client message, so the `event`-folded-
  into-`payload` workaround documented in Gap 21 does not apply here.
- `recipient_mode` values: `'all' | 'multiple' | 'direct'`. `recipient_user_ids` is always an array
  (`[]` when `recipient_mode: 'all'`), never `null`.
- `type` values: `'info' | 'aviso' | 'alerta'`.
- No pagination, no message limit (confirmed with backend — session-scoped volume is naturally
  small).
- No edit/delete of a sent message (out of scope).
- This feature only renders inside `trainer-session-live-screen.jsx` /
  `training-session-live-screen.jsx`, both already `MobileOnlyRoute`-gated — no web-specific
  branching needed anywhere in this plan's new code.
- Project convention: no component-render tests. Jest covers pure logic only. Every new `utils/*`
  file in this plan ships with a `__tests__/*.test.js` file in the same task.
- `nativeID`/`testID` required on every `View`/`Text`/`Pressable`/`TextInput`/`ScrollView`/`Modal`
  (enforced by `local/require-native-id` ESLint rule) — every new element in this plan's JSX
  includes both, with a value unique in its context.
- `npm test` and `npm run lint` must stay green after every task's commit.

---

### Task 1: Data layer — service, mock, normalizers

**Files:**
- Create: `services/sessionMessages.js`
- Create: `services/__mocks__/session-messages-mock.js`
- Modify: `services/normalizers.js` (append two new exported functions)
- Modify: `__tests__/normalizers.test.js` (append one new `describe` block)

**Interfaces:**
- Produces: `createSessionMessage(sessionInstanceId, body)` (POST, returns the raw message DTO),
  `getSessionMessages(sessionInstanceId, since)` (GET, returns `{messages: [...]}`),
  `toSessionMessageModel(dto) -> {id, sessionInstanceId, senderUserId, senderRole, type,
  recipientMode, recipientUserIds, body, replyToMessageId, createdAt}` (all ids as strings except
  `type`/`senderRole`/`recipientMode`/`body`/`createdAt`, which stay as-is),
  `toSessionMessagePayload({type, recipientMode, recipientUserIds, body, replyToMessageId}) ->
  {type, recipient_mode, recipient_user_ids, body, reply_to_message_id}` (snake_case wire body).
- Consumes: nothing from earlier tasks (this is the base layer).

- [ ] **Step 1: Write the service**

Create `services/sessionMessages.js`:

```js
import api from './api.js';
import { USE_MOCKS } from '../config/env.js';
import { mockCreateSessionMessage, mockGetSessionMessages } from './__mocks__/session-messages-mock.js';

// Mensajería en sesión presencial en vivo (Gap 27, docs/BACKEND_API_GAPS.md).
// El POST responde el mensaje creado DIRECTO en el body -- sin envoltorio
// `{data: ...}`, a diferencia de runnerSession.js. El GET sí envuelve, en
// `{messages: [...]}`, nunca un array crudo. Ambos confirmados contra el
// contrato real desplegado, no son una suposición.
const messagesPath = (sessionInstanceId) => `/session-instances/${Number(sessionInstanceId)}/messages`;

// POST /api/v1/session-instances/:id/messages -- 201 con el mensaje creado.
// `body` ya viene en snake_case (armado por toSessionMessagePayload en el caller).
export async function createSessionMessage(sessionInstanceId, body) {
  if (USE_MOCKS) return await mockCreateSessionMessage(sessionInstanceId, body);
  return await api.post(messagesPath(sessionInstanceId), body);
}

// GET /api/v1/session-instances/:id/messages?since=<id> -- el backend ya
// filtra por visibilidad (emisor, recipient_mode='all', o mi userId en
// recipient_user_ids); el frontend no vuelve a filtrar nada. Sin `since` (o
// `0`/null) trae todo el historial visible de la sesión.
export async function getSessionMessages(sessionInstanceId, since) {
  const query = since ? `?since=${Number(since)}` : '';
  if (USE_MOCKS) return await mockGetSessionMessages(sessionInstanceId, since);
  return await api.get(`${messagesPath(sessionInstanceId)}${query}`);
}
```

- [ ] **Step 2: Write the mock**

Create `services/__mocks__/session-messages-mock.js`:

```js
// Mock stateful en memoria de session_messages -- mismo patrón que
// services/__mocks__/runner-session-mock.js. No reimplementa la regla de
// visibilidad del backend real de forma completa (no hace falta para probar
// contra mocks en un solo dispositivo): devuelve todos los mensajes de la
// sesión tal cual se crearon, sin filtrar por destinatario. Suficiente para
// ver tus propios mensajes enviados y los que vos mismo recibís como "todos".
let nextMessageId = 1;
const messagesBySession = new Map(); // sessionInstanceId (number) -> array de DTOs

export function __resetSessionMessagesMock() {
  messagesBySession.clear();
  nextMessageId = 1;
}

function listFor(sessionInstanceId) {
  const key = Number(sessionInstanceId);
  if (!messagesBySession.has(key)) messagesBySession.set(key, []);
  return messagesBySession.get(key);
}

export async function mockCreateSessionMessage(sessionInstanceId, body) {
  const row = {
    id: nextMessageId++,
    session_instance_id: Number(sessionInstanceId),
    sender_user_id: body.sender_user_id ?? 0,
    sender_role: body.sender_role ?? 'runner',
    type: body.type,
    recipient_mode: body.recipient_mode,
    recipient_user_ids: body.recipient_user_ids ?? [],
    body: body.body,
    reply_to_message_id: body.reply_to_message_id ?? null,
    created_at: new Date().toISOString(),
  };
  listFor(sessionInstanceId).push(row);
  return row;
}

export async function mockGetSessionMessages(sessionInstanceId, since) {
  const sinceId = since ? Number(since) : 0;
  const rows = listFor(sessionInstanceId).filter((r) => r.id > sinceId);
  return { messages: rows };
}
```

Note: the mock has no way to know `sender_user_id`/`sender_role` (the real backend derives both
from the auth token, never from the request body) — `services/sessionMessages.js#createSessionMessage`
never sends those two fields in the body (see Task 6's `toSessionMessagePayload`, which omits
them). The mock's `body.sender_user_id ?? 0` / `body.sender_role ?? 'runner'` fallbacks exist only
so the mock doesn't crash; they are never meaningfully exercised against real traffic.

- [ ] **Step 3: Add the two normalizers**

Open `services/normalizers.js`. Find the end of the file (after the last exported function) and
append:

```js
// Mensajería en sesión presencial en vivo (Gap 27). `recipientUserIds`
// siempre array de strings (nunca null) -- el backend ya lo normaliza a `[]`
// cuando recipient_mode es 'all'.
export function toSessionMessageModel(dto) {
  if (!dto) return null;
  return {
    id: String(dto.id),
    sessionInstanceId: String(dto.session_instance_id),
    senderUserId: String(dto.sender_user_id),
    senderRole: dto.sender_role,
    type: dto.type,
    recipientMode: dto.recipient_mode,
    recipientUserIds: (dto.recipient_user_ids ?? []).map((id) => String(id)),
    body: dto.body,
    replyToMessageId: dto.reply_to_message_id != null ? String(dto.reply_to_message_id) : null,
    createdAt: dto.created_at,
  };
}

// Payload del POST -- `sender_user_id`/`sender_role` NUNCA van en el body (el
// backend los deriva del token, ver Gap 27); si algún caller los pasara por
// error, esta función los descarta a propósito. `recipient_user_ids` entra
// como strings (todo id en el modal/hooks de esta feature es string, mismo
// criterio que el resto del repo) pero el backend espera `int[]` -- sin el
// Number() acá, el mismo bug ya documentado en CLAUDE.md ("IDs numéricos en
// bodies de request") se repetiría.
export function toSessionMessagePayload({ type, recipientMode, recipientUserIds, body, replyToMessageId }) {
  const payload = {
    type,
    recipient_mode: recipientMode,
    recipient_user_ids: (recipientUserIds ?? []).map((id) => Number(id)),
    body,
  };
  if (replyToMessageId != null) payload.reply_to_message_id = Number(replyToMessageId);
  return payload;
}
```

- [ ] **Step 4: Write the regression test**

Open `__tests__/normalizers.test.js`. Add the import of the two new functions to the existing
import block at the top of the file (find the line starting with `toCreatePreferencePayload,
toPreferenceResponseModel, toProcessPaymentPayload, ...` and add `toSessionMessageModel,
toSessionMessagePayload` to that same import list). Then append this block at the end of the file:

```js
describe('toSessionMessageModel', () => {
  test('mapea snake_case a camelCase, ids a string', () => {
    const dto = {
      id: 501,
      session_instance_id: 88,
      sender_user_id: 12,
      sender_role: 'trainer',
      type: 'aviso',
      recipient_mode: 'direct',
      recipient_user_ids: [34],
      body: 'Bajen el ritmo',
      reply_to_message_id: null,
      created_at: '2026-10-09T10:00:00Z',
    };
    expect(toSessionMessageModel(dto)).toEqual({
      id: '501',
      sessionInstanceId: '88',
      senderUserId: '12',
      senderRole: 'trainer',
      type: 'aviso',
      recipientMode: 'direct',
      recipientUserIds: ['34'],
      body: 'Bajen el ritmo',
      replyToMessageId: null,
      createdAt: '2026-10-09T10:00:00Z',
    });
  });

  test('recipient_user_ids vacío cuando recipient_mode es all', () => {
    const dto = {
      id: 502, session_instance_id: 88, sender_user_id: 12, sender_role: 'trainer',
      type: 'info', recipient_mode: 'all', recipient_user_ids: [], body: 'Hola a todos',
      reply_to_message_id: null, created_at: '2026-10-09T10:01:00Z',
    };
    expect(toSessionMessageModel(dto).recipientUserIds).toEqual([]);
  });

  test('null da null', () => {
    expect(toSessionMessageModel(null)).toBeNull();
  });
});

describe('toSessionMessagePayload', () => {
  test('arma el body snake_case, sin reply_to_message_id si no viene', () => {
    expect(toSessionMessagePayload({
      type: 'info', recipientMode: 'all', recipientUserIds: [], body: 'Hola',
    })).toEqual({ type: 'info', recipient_mode: 'all', recipient_user_ids: [], body: 'Hola' });
  });

  test('incluye reply_to_message_id como número cuando viene', () => {
    expect(toSessionMessagePayload({
      type: 'info', recipientMode: 'direct', recipientUserIds: ['12'], body: 'Dale', replyToMessageId: '501',
    })).toEqual({
      type: 'info', recipient_mode: 'direct', recipient_user_ids: [12], body: 'Dale', reply_to_message_id: 501,
    });
  });

  test('recipient_user_ids siempre sale numérico, aunque entre como string', () => {
    expect(toSessionMessagePayload({
      type: 'info', recipientMode: 'multiple', recipientUserIds: ['7', '8'], body: 'Hola',
    }).recipient_user_ids).toEqual([7, 8]);
  });
});
```

- [ ] **Step 5: Run tests**

Run: `npm test -- normalizers`
Expected: all tests in `normalizers.test.js` pass, including the 5 new ones.

- [ ] **Step 6: Lint and commit**

Run: `npm run lint`
Expected: no new errors.

```bash
git add services/sessionMessages.js services/__mocks__/session-messages-mock.js services/normalizers.js __tests__/normalizers.test.js
git commit -m "feat(session-messages): data layer — service, mock, normalizers"
```

---

### Task 2: Pure utils — delivery, recipients, connected-peers

**Files:**
- Create: `utils/session-message-delivery.js`
- Create: `utils/session-message-recipients.js`
- Create: `utils/connected-peers.js`
- Test: `__tests__/session-message-delivery.test.js`
- Test: `__tests__/session-message-recipients.test.js`
- Test: `__tests__/connected-peers.test.js`

**Interfaces:**
- Consumes: nothing from Task 1.
- Produces: `deliveryFor(type) -> {toast, modal, haptics, sound}`,
  `pickUndeliveredMessages(messages, deliveredIds, selfUserId) -> Array` (messages array uses the
  camelCase shape from `toSessionMessageModel`: `{id, senderUserId, ...}`),
  `deriveRecipients({allSelected, selectedUserIds}) -> {recipientMode, recipientUserIds} | null`,
  `applyPeerPresence(current: Set<string>, msg) -> Set<string>` (used by Task 5's modification to
  `use-live-session-runtime.js`).

- [ ] **Step 1: Write `utils/session-message-delivery.js`**

```js
// Qué dispara cada tipo de mensaje de sesión en vivo (Gap 27) -- función pura
// para no hardcodear el mapeo inline en el modal, así se puede testear sin
// montar nada (ver spec, sección "Entrega por severidad").
export function deliveryFor(type) {
  if (type === 'aviso') return { toast: false, modal: true, haptics: 'medium', sound: false };
  if (type === 'alerta') return { toast: false, modal: true, haptics: 'heavy', sound: true };
  // 'info' y cualquier valor desconocido caen al comportamiento más simple --
  // nunca bloquear la pantalla por un tipo que no se reconoce.
  return { toast: true, modal: false, haptics: null, sound: false };
}

// Filtra, de la lista COMPLETA de mensajes ya visibles para mí (el backend ya
// aplicó la regla de privacidad), los que todavía no se "entregaron"
// (toast/modal/haptics/sonido) y que no son míos -- un mensaje propio no se
// entrega a mí mismo, ya lo vi al escribirlo. `deliveredIds` es un Set de
// strings (los `id` ya normalizados a string por toSessionMessageModel). No
// muta `deliveredIds` -- el caller decide cuándo marcar como entregado.
export function pickUndeliveredMessages(messages, deliveredIds, selfUserId) {
  const self = String(selfUserId);
  return (messages ?? []).filter((msg) => !deliveredIds.has(msg.id) && msg.senderUserId !== self);
}
```

- [ ] **Step 2: Write `__tests__/session-message-delivery.test.js`**

```js
import { deliveryFor, pickUndeliveredMessages } from '../utils/session-message-delivery.js';

describe('deliveryFor', () => {
  test('info -> solo toast', () => {
    expect(deliveryFor('info')).toEqual({ toast: true, modal: false, haptics: null, sound: false });
  });

  test('aviso -> modal + haptics medio, sin sonido', () => {
    expect(deliveryFor('aviso')).toEqual({ toast: false, modal: true, haptics: 'medium', sound: false });
  });

  test('alerta -> modal + haptics fuerte + sonido', () => {
    expect(deliveryFor('alerta')).toEqual({ toast: false, modal: true, haptics: 'heavy', sound: true });
  });

  test('tipo desconocido cae al comportamiento de info', () => {
    expect(deliveryFor('algo-nuevo')).toEqual({ toast: true, modal: false, haptics: null, sound: false });
  });
});

describe('pickUndeliveredMessages', () => {
  const base = { id: '1', senderUserId: '12', type: 'info', body: 'hola' };

  test('excluye mensajes ya entregados', () => {
    const messages = [base, { ...base, id: '2' }];
    const delivered = new Set(['1']);
    expect(pickUndeliveredMessages(messages, delivered, '99')).toEqual([{ ...base, id: '2' }]);
  });

  test('excluye mensajes propios', () => {
    const messages = [{ ...base, senderUserId: '99' }];
    expect(pickUndeliveredMessages(messages, new Set(), '99')).toEqual([]);
  });

  test('sin mensajes nuevos devuelve array vacío', () => {
    expect(pickUndeliveredMessages([base], new Set(['1']), '99')).toEqual([]);
  });
});
```

- [ ] **Step 3: Write `utils/session-message-recipients.js`**

```js
// Deriva recipient_mode/recipient_user_ids de la selección del selector
// multi-destinatario del entrenador (checkboxes + atajo "Todos") -- función
// pura para que el modal no tenga que decidir la regla inline. `null` cuando
// la selección no alcanza para mandar nada (ni "Todos" tocado, ni ningún
// destinatario marcado) -- el caller usa esto para deshabilitar "Enviar".
export function deriveRecipients({ allSelected, selectedUserIds }) {
  if (allSelected) return { recipientMode: 'all', recipientUserIds: [] };
  const ids = [...(selectedUserIds ?? [])];
  if (ids.length === 0) return null;
  if (ids.length === 1) return { recipientMode: 'direct', recipientUserIds: ids };
  return { recipientMode: 'multiple', recipientUserIds: ids };
}
```

- [ ] **Step 4: Write `__tests__/session-message-recipients.test.js`**

```js
import { deriveRecipients } from '../utils/session-message-recipients.js';

describe('deriveRecipients', () => {
  test('allSelected -> all, lista vacía', () => {
    expect(deriveRecipients({ allSelected: true, selectedUserIds: new Set(['1', '2']) }))
      .toEqual({ recipientMode: 'all', recipientUserIds: [] });
  });

  test('un solo seleccionado -> direct', () => {
    expect(deriveRecipients({ allSelected: false, selectedUserIds: new Set(['7']) }))
      .toEqual({ recipientMode: 'direct', recipientUserIds: ['7'] });
  });

  test('dos o más seleccionados -> multiple', () => {
    const result = deriveRecipients({ allSelected: false, selectedUserIds: new Set(['7', '8']) });
    expect(result.recipientMode).toBe('multiple');
    expect(result.recipientUserIds.sort()).toEqual(['7', '8']);
  });

  test('ninguno seleccionado y no es Todos -> null', () => {
    expect(deriveRecipients({ allSelected: false, selectedUserIds: new Set() })).toBeNull();
  });
});
```

- [ ] **Step 5: Write `utils/connected-peers.js`**

```js
// Roster liviano de "quién está conectado ahora" para el selector de
// destinatario del CORREDOR (spec: "un compañero de la lista de
// participantes conectados") -- a diferencia de
// utils/trainer-participant-state.js (mucho más rico: posición, estado por
// serie, etc.), acá solo hace falta un Set de userIds conectados, nada más.
// Nunca muta `current` -- devuelve el MISMO Set (misma referencia) si el
// mensaje no cambia nada, para que el caller pueda comparar por identidad.
export function applyPeerPresence(current, msg) {
  if (msg?.type !== 'presence') return current;
  const userId = msg.from != null ? String(msg.from) : null;
  if (!userId) return current;

  if (msg.event === 'left') {
    if (!current.has(userId)) return current;
    const next = new Set(current);
    next.delete(userId);
    return next;
  }

  // joined, position, set_status -- CUALQUIERA de estos prueba que ese
  // userId está conectado, mismo criterio que ya usa
  // trainer-participant-state.js#applyParticipantMessage (si alguien llega
  // tarde al `joined` explícito, su primer `position`/`set_status` igual lo
  // confirma conectado).
  if (current.has(userId)) return current;
  const next = new Set(current);
  next.add(userId);
  return next;
}
```

- [ ] **Step 6: Write `__tests__/connected-peers.test.js`**

```js
import { applyPeerPresence } from '../utils/connected-peers.js';

describe('applyPeerPresence', () => {
  test('joined agrega el userId', () => {
    const next = applyPeerPresence(new Set(), { type: 'presence', event: 'joined', from: 12 });
    expect(next.has('12')).toBe(true);
  });

  test('left lo quita', () => {
    const next = applyPeerPresence(new Set(['12']), { type: 'presence', event: 'left', from: 12 });
    expect(next.has('12')).toBe(false);
  });

  test('position también prueba conexión aunque nunca llegó joined', () => {
    const next = applyPeerPresence(new Set(), { type: 'presence', event: 'position', from: 7, payload: {} });
    expect(next.has('7')).toBe(true);
  });

  test('set_status también prueba conexión', () => {
    const next = applyPeerPresence(new Set(), { type: 'presence', event: 'set_status', from: 7, payload: {} });
    expect(next.has('7')).toBe(true);
  });

  test('mensaje que no es presence no cambia nada (misma referencia)', () => {
    const current = new Set(['12']);
    expect(applyPeerPresence(current, { type: 'control', event: 'session_paused' })).toBe(current);
  });

  test('left de alguien que no estaba devuelve la misma referencia', () => {
    const current = new Set();
    expect(applyPeerPresence(current, { type: 'presence', event: 'left', from: 9 })).toBe(current);
  });

  test('joined de alguien ya presente devuelve la misma referencia', () => {
    const current = new Set(['12']);
    expect(applyPeerPresence(current, { type: 'presence', event: 'joined', from: 12 })).toBe(current);
  });

  test('sin from no cambia nada', () => {
    const current = new Set();
    expect(applyPeerPresence(current, { type: 'presence', event: 'joined', from: null })).toBe(current);
  });
});
```

- [ ] **Step 7: Run tests**

Run: `npm test -- session-message-delivery session-message-recipients connected-peers`
Expected: all pass (4 + 4 + 8 = 16 new tests).

- [ ] **Step 8: Lint and commit**

Run: `npm run lint`
Expected: no new errors.

```bash
git add utils/session-message-delivery.js utils/session-message-recipients.js utils/connected-peers.js __tests__/session-message-delivery.test.js __tests__/session-message-recipients.test.js __tests__/connected-peers.test.js
git commit -m "feat(session-messages): pure utils — delivery rules, recipient derivation, peer presence"
```

---

### Task 3: Haptics additions

**Files:**
- Modify: `utils/haptics.js`
- Modify: `__tests__/haptics.test.js`
- Modify: `__tests__/haptics-web.test.js`

**Interfaces:**
- Produces: `notifyAviso()`, `notifyAlerta()` (both no-op outside `isMobile`, same as the 3
  existing functions).

- [ ] **Step 1: Add the two functions**

Open `utils/haptics.js`. It currently ends with `notifyWarning`. Append:

```js
// Severidad "aviso"/"alerta" de la mensajería en sesión en vivo (Gap 27) --
// impactAsync (no notificationAsync, que es para resultado de una acción
// propia tipo "guardado con éxito") porque esto es un impacto EXTERNO que
// llega, no una confirmación de algo que el usuario disparó.
export const notifyAviso = () => {
  if (isMobile) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
};

export const notifyAlerta = () => {
  if (isMobile) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
};
```

- [ ] **Step 2: Update the mobile test file**

Open `__tests__/haptics.test.js`. Replace the entire file with:

```js
jest.mock('expo-haptics', () => ({
  notificationAsync: jest.fn(),
  impactAsync: jest.fn(),
  NotificationFeedbackType: { Success: 'success', Error: 'error', Warning: 'warning' },
  ImpactFeedbackStyle: { Medium: 'medium', Heavy: 'heavy' },
}));

describe('en mobile', () => {
  jest.mock('../utils/platform.js', () => ({ isMobile: true }));

  test('notifySuccess dispara notificationAsync con Success', async () => {
    const Haptics = require('expo-haptics');
    const { notifySuccess } = require('../utils/haptics.js');
    notifySuccess();
    expect(Haptics.notificationAsync).toHaveBeenCalledWith(Haptics.NotificationFeedbackType.Success);
  });

  test('notifyAviso dispara impactAsync con Medium', async () => {
    const Haptics = require('expo-haptics');
    const { notifyAviso } = require('../utils/haptics.js');
    notifyAviso();
    expect(Haptics.impactAsync).toHaveBeenCalledWith(Haptics.ImpactFeedbackStyle.Medium);
  });

  test('notifyAlerta dispara impactAsync con Heavy', async () => {
    const Haptics = require('expo-haptics');
    const { notifyAlerta } = require('../utils/haptics.js');
    notifyAlerta();
    expect(Haptics.impactAsync).toHaveBeenCalledWith(Haptics.ImpactFeedbackStyle.Heavy);
  });
});
```

- [ ] **Step 3: Update the web test file**

Open `__tests__/haptics-web.test.js`. Replace the entire file with:

```js
jest.mock('expo-haptics', () => ({
  notificationAsync: jest.fn(),
  impactAsync: jest.fn(),
  NotificationFeedbackType: { Success: 'success', Error: 'error', Warning: 'warning' },
  ImpactFeedbackStyle: { Medium: 'medium', Heavy: 'heavy' },
}));

describe('fuera de mobile (web)', () => {
  jest.mock('../utils/platform.js', () => ({ isMobile: false }));

  test('notifySuccess no llama a Haptics', () => {
    const Haptics = require('expo-haptics');
    const { notifySuccess } = require('../utils/haptics.js');
    notifySuccess();
    expect(Haptics.notificationAsync).not.toHaveBeenCalled();
  });

  test('notifyAviso no llama a Haptics', () => {
    const Haptics = require('expo-haptics');
    const { notifyAviso } = require('../utils/haptics.js');
    notifyAviso();
    expect(Haptics.impactAsync).not.toHaveBeenCalled();
  });

  test('notifyAlerta no llama a Haptics', () => {
    const Haptics = require('expo-haptics');
    const { notifyAlerta } = require('../utils/haptics.js');
    notifyAlerta();
    expect(Haptics.impactAsync).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 4: Run tests**

Run: `npm test -- haptics`
Expected: both files pass (3 tests each).

- [ ] **Step 5: Lint and commit**

```bash
npm run lint
git add utils/haptics.js __tests__/haptics.test.js __tests__/haptics-web.test.js
git commit -m "feat(session-messages): notifyAviso/notifyAlerta haptics"
```

---

### Task 4: `expo-audio` dependency + alert sound asset + wrapper util

**Files:**
- Create: `scripts/generate-alert-sound.js` (one-off, deleted at the end of this task)
- Create: `assets/sounds/session-alert.wav` (binary, generated by the script above)
- Create: `utils/session-alert-sound.js`
- Modify: `package.json` (new dependency, via `npx expo install`, not a manual edit)

**Interfaces:**
- Produces: `playAlertSound()` (no-op outside `isMobile`, fires-and-forgets, swallows any error).
- Consumes: nothing from earlier tasks.

- [ ] **Step 1: Install the dependency**

Run: `npx expo install expo-audio`
Expected: `package.json` gains an `expo-audio` entry at an SDK-54-compatible version (the command
resolves the right version automatically — do not hand-edit the version string).

- [ ] **Step 2: Generate the alert sound asset**

This project has no audio library and no existing short alert sound to reuse (unlike the
check-in GIF, which was already an asset in the repo). Rather than leave a placeholder, generate a
real, tiny, valid WAV file with a one-off Node script — a short two-tone beep (~450ms total),
using only Node's built-in `fs`/`Buffer` (no new dependency, no `ffmpeg`/`sox` needed).

Create `scripts/generate-alert-sound.js`:

```js
const fs = require('fs');
const path = require('path');

const SAMPLE_RATE = 22050;
const AMPLITUDE = 0.5;

function toneSamples(freqHz, durationMs) {
  const n = Math.round((SAMPLE_RATE * durationMs) / 1000);
  const samples = new Float32Array(n);
  const fadeN = Math.round((SAMPLE_RATE * 15) / 1000); // 15ms fade in/out, evita clicks
  for (let i = 0; i < n; i += 1) {
    const t = i / SAMPLE_RATE;
    let envelope = 1;
    if (i < fadeN) envelope = i / fadeN;
    else if (i > n - fadeN) envelope = (n - i) / fadeN;
    samples[i] = Math.sin(2 * Math.PI * freqHz * t) * AMPLITUDE * envelope;
  }
  return samples;
}

function silenceSamples(durationMs) {
  return new Float32Array(Math.round((SAMPLE_RATE * durationMs) / 1000));
}

const parts = [toneSamples(880, 180), silenceSamples(80), toneSamples(1100, 180)];
const totalLength = parts.reduce((sum, part) => sum + part.length, 0);
const pcm = new Int16Array(totalLength);
let offset = 0;
for (const part of parts) {
  for (let i = 0; i < part.length; i += 1) {
    pcm[offset + i] = Math.max(-32768, Math.min(32767, Math.round(part[i] * 32767)));
  }
  offset += part.length;
}

const dataSize = pcm.length * 2;
const header = Buffer.alloc(44);
header.write('RIFF', 0, 'ascii');
header.writeUInt32LE(36 + dataSize, 4);
header.write('WAVE', 8, 'ascii');
header.write('fmt ', 12, 'ascii');
header.writeUInt32LE(16, 16);
header.writeUInt16LE(1, 20); // PCM
header.writeUInt16LE(1, 22); // mono
header.writeUInt32LE(SAMPLE_RATE, 24);
header.writeUInt32LE(SAMPLE_RATE * 2, 28); // byte rate = sampleRate * blockAlign
header.writeUInt16LE(2, 32); // block align = channels(1) * bitsPerSample(16)/8
header.writeUInt16LE(16, 34); // bits per sample
header.write('data', 36, 'ascii');
header.writeUInt32LE(dataSize, 40);

const wav = Buffer.concat([header, Buffer.from(pcm.buffer)]);
const outDir = path.join(__dirname, '..', 'assets', 'sounds');
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, 'session-alert.wav'), wav);
console.log(`Escrito assets/sounds/session-alert.wav (${wav.length} bytes)`);
```

Run: `node scripts/generate-alert-sound.js`
Expected output: `Escrito assets/sounds/session-alert.wav (NNNNN bytes)`, and the file exists at
`assets/sounds/session-alert.wav`.

This is a functional placeholder — a real two-tone beep, not silence or a stub — good enough to
ship; replacing it with a designed sound later is a cosmetic follow-up, not a blocker.

Delete the generator script once the asset exists — it is not meant to run again:

```bash
rm scripts/generate-alert-sound.js
rmdir scripts 2>/dev/null || true
```

- [ ] **Step 3: Verify `expo-audio`'s actual API before writing the wrapper**

This project has been bitten before by assuming a library's API from memory instead of reading it
(see `CLAUDE.md`, the MapLibre `fitBounds` incident). Before writing Step 4, read
`node_modules/expo-audio/build/AudioModule.types.d.ts` and
`node_modules/expo-audio/build/index.d.ts` (or the package's own README if the `.d.ts` files are
hard to follow) and confirm:
- A non-hook factory function exists for creating a player outside a React component body (the
  expected name is `createAudioPlayer(source, updateIntervalMillis?)`, mirroring the `useAudioPlayer`
  hook's internals).
- The returned player object exposes `.play()` and either `.seekTo(seconds)` or an equivalent to
  restart playback from the beginning on a second call.

If the actual exports differ from `createAudioPlayer`/`.play()`/`.seekTo()`, adapt Step 4's code to
the real API — do not force the assumed names.

- [ ] **Step 4: Write the wrapper**

Create `utils/session-alert-sound.js`:

```js
import { createAudioPlayer } from 'expo-audio';
import { isMobile } from './platform.js';

// Sonido corto de severidad "alerta" (Gap 27, mensajería en sesión en vivo).
// createAudioPlayer (no el hook useAudioPlayer) porque esto se dispara desde
// un listener de WS/efecto, no desde el render de un componente. No-op fuera
// de mobile, mismo criterio que utils/haptics.js -- RNW no necesita esto y
// expo-audio en web sería otro camino (HTMLAudioElement) sin motivo de peso
// para mantenerlo andando ahí.
let player = null;

export function playAlertSound() {
  if (!isMobile) return;
  try {
    if (!player) player = createAudioPlayer(require('../assets/sounds/session-alert.wav'));
    player.seekTo(0);
    player.play();
  } catch {
    // Dispositivo sin audio disponible, o el módulo no está listo todavía --
    // la alerta ya se mostró por modal + haptics, el sonido es un refuerzo,
    // no la única señal (ver utils/session-message-delivery.js).
  }
}
```

- [ ] **Step 5: Manual smoke check (no Jest coverage for this file)**

This file is never imported by a test (only by the modal built in Task 7, which nothing in Jest
renders) — there is nothing to run here automatically. Confirm only that `npm run lint` passes and
that the import path `../assets/sounds/session-alert.wav` resolves (the file exists on disk from
Step 2).

- [ ] **Step 6: Lint and commit**

```bash
npm run lint
git add package.json package-lock.json assets/sounds/session-alert.wav utils/session-alert-sound.js
git commit -m "feat(session-messages): expo-audio dependency + generated alert sound + wrapper"
```

Note for later manual verification (not part of this task): this is the first native dependency
added since the `gestion-asistencia-entrenador` branch — the dev client needs a rebuild
(`npm run android:run`) before the sound plays on a real device. A Metro reload is not enough.

---

### Task 5: `hooks/use-session-messages.js`

**Files:**
- Create: `hooks/use-session-messages.js`

**Interfaces:**
- Consumes: `getSessionMessages`, `createSessionMessage` (Task 1, `services/sessionMessages.js`),
  `toSessionMessageModel`, `toSessionMessagePayload` (Task 1, `services/normalizers.js`).
- Produces: `useSessionMessages(sessionInstanceId) -> {messages, isLoading, error, refetch}`
  (`messages` already normalized, camelCase, chronological — the backend already returns `id ASC`,
  this hook does not re-sort), `useSendSessionMessage(sessionInstanceId) -> {sendMessage, isSending,
  error}` where `sendMessage({type, recipientMode, recipientUserIds, body, replyToMessageId}) ->
  Promise`.

- [ ] **Step 1: Write the hook**

```js
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createSessionMessage, getSessionMessages } from '../services/sessionMessages.js';
import { toSessionMessageModel, toSessionMessagePayload } from '../services/normalizers.js';

// Historial de mensajes de una sesión en vivo (Gap 27). `staleTime: 0` --
// mismo criterio que use-runner-session.js/use-session-feedback.js: este
// dato cambia por un evento externo (el WS lo invalida, ver
// hooks/use-live-session-runtime.js / hooks/use-trainer-session-runtime.js),
// no solo por una acción propia del usuario, así que no conviene confiar en
// que siga "fresco" solo porque se pidió hace poco.
export function useSessionMessages(sessionInstanceId) {
  const query = useQuery({
    queryKey: ['session-messages', sessionInstanceId],
    queryFn: () => getSessionMessages(sessionInstanceId),
    enabled: Boolean(sessionInstanceId),
    staleTime: 0,
  });

  return {
    messages: (query.data?.messages ?? []).map(toSessionMessageModel).filter(Boolean),
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
  };
}

// La mutation invalida su propia query al completar -- cubre el caso del
// propio emisor, que no recibe el aviso de WS que dispara ESTE mismo mensaje
// (el backend no se lo reenvía a sí mismo, ver spec "Bordes").
export function useSendSessionMessage(sessionInstanceId) {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: (input) => createSessionMessage(sessionInstanceId, toSessionMessagePayload(input)),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['session-messages', sessionInstanceId] }),
  });

  return { sendMessage: mutation.mutateAsync, isSending: mutation.isPending, error: mutation.error };
}
```

- [ ] **Step 2: Lint and commit**

No Jest coverage for this file by itself (it is a thin TanStack Query wrapper around already-tested
pieces — same convention as every other `hooks/use-*.js` in this repo, none of which have their own
test file).

```bash
npm run lint
git add hooks/use-session-messages.js
git commit -m "feat(session-messages): useSessionMessages / useSendSessionMessage hooks"
```

---

### Task 6: Wire both live-session runtime hooks to the WS nudge (+ peer presence for the runner)

**Files:**
- Modify: `hooks/use-live-session-runtime.js`
- Modify: `hooks/use-trainer-session-runtime.js`

**Interfaces:**
- Consumes: `applyPeerPresence` (Task 2, `utils/connected-peers.js`).
- Produces: `useLiveSessionRuntime()`'s return object gains one new field, `connectedPeerIds`
  (`Set<string>` of userIds of OTHER participants currently known to be connected — never includes
  the caller's own userId, since the caller never receives its own `presence` broadcasts back).
  `useTrainerSessionRuntime()`'s return shape is unchanged (the new behavior is a side effect only).

- [ ] **Step 1: Modify `hooks/use-trainer-session-runtime.js`**

This hook already has `queryClient` (added in an earlier, unrelated change — `const queryClient =
useQueryClient();` near the top of the hook body) and already branches on `msg.type` inside
`handleChannelMessage` for `update:attendance_event`. Add one more branch, same style, right after
the existing `update:attendance_event` block (inside the function body, before its closing `};`):

```js
    // Gap 27: aviso de que se mandó un mensaje nuevo en la sesión -- sin
    // contenido, a propósito (ver utils/session-message-delivery.js y la
    // nota de privacidad en BACKEND_API_GAPS.md). Invalida la query de
    // mensajes; quien la tenga montada (el componente que usa
    // useSessionMessages) hace el refetch solo.
    if (msg.type === 'control:message_created') {
      queryClient.invalidateQueries({ queryKey: ['session-messages', sessionInstanceId] });
    }
```

Do not add a new `import` for `useQueryClient` — it is already imported and already destructured
as `queryClient` in this file.

- [ ] **Step 2: Modify `hooks/use-live-session-runtime.js`**

This hook has no `useQueryClient` yet. Add the import, add a `connectedPeerIds` state, update
`handleChannelMessage`, and return the new field.

At the top of the file, change:

```js
import { useEffect, useRef, useState } from 'react';
```

to:

```js
import { useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
```

Add the import of the new pure util, right after the existing `import { acceptGpsLeg } from
'../utils/distance.js';` line:

```js
import { applyPeerPresence } from '../utils/connected-peers.js';
```

Inside `export function useLiveSessionRuntime() {`, right after the existing
`const userId = useAuthStore((s) => s.userId);` line, add:

```js
  const queryClient = useQueryClient();
```

Right after the existing `const [pendingControl, setPendingControl] = useState(null);` line, add:

```js
  // Roster liviano de "quién está conectado" para el selector de
  // destinatario de mensajería (Gap 27) -- nunca incluye mi propio userId
  // (nunca recibo mis propios broadcasts de presence de vuelta).
  const [connectedPeerIds, setConnectedPeerIds] = useState(() => new Set());
```

Replace the current `handleChannelMessage`:

```js
  const handleChannelMessage = (msg) => {
    if (msg.type !== 'control') return;
    setPendingControl({ event: msg.event, payload: msg.payload });
    // El entrenador pausa remotamente pausando la serie que esté corriendo
    // en ESTE momento -- misma acción que el botón local de pausa, no hay
    // "reanudar" remoto en esta spec (ver nota de alcance en Task 10).
    if (msg.event === 'session_paused') pauseSet();
  };
```

with:

```js
  const handleChannelMessage = (msg) => {
    setConnectedPeerIds((current) => applyPeerPresence(current, msg));

    // Gap 27: aviso de mensaje nuevo -- `run` ya está seteado en este punto
    // (el canal solo se habilita cuando `run` existe, ver `channel` abajo),
    // así que `run.session_instance_id` es seguro de leer acá.
    if (msg.type === 'control:message_created') {
      queryClient.invalidateQueries({ queryKey: ['session-messages', run.session_instance_id] });
      return;
    }

    if (msg.type !== 'control') return;
    setPendingControl({ event: msg.event, payload: msg.payload });
    // El entrenador pausa remotamente pausando la serie que esté corriendo
    // en ESTE momento -- misma acción que el botón local de pausa, no hay
    // "reanudar" remoto en esta spec (ver nota de alcance en Task 10).
    if (msg.event === 'session_paused') pauseSet();
  };
```

Finally, add `connectedPeerIds` to the hook's return object (find the existing `return { booted,
bootError, run, sets, connectionStatus, pendingControl, ... };` at the end of the file) — add
`connectedPeerIds,` to that object, anywhere in the list.

- [ ] **Step 3: Run the full test suite**

Run: `npm test`
Expected: all existing tests still pass (this task's changes are additive — no existing behavior
of either hook was removed, only new branches added before/around the pre-existing ones).

- [ ] **Step 4: Lint and commit**

```bash
npm run lint
git add hooks/use-live-session-runtime.js hooks/use-trainer-session-runtime.js
git commit -m "feat(session-messages): invalidate on control:message_created, track connected peers"
```

---

### Task 7: `SessionMessagesModal` component

**Files:**
- Create: `components/session-runtime/session-messages-modal.jsx`

**Interfaces:**
- Consumes: `deliveryFor` is NOT used inside this component (delivery side effects live in the
  parent screens, Tasks 8/9 — this component is purely the list + compose + recipient-picker UI).
  Consumes `colorForUserId` (`utils/participant-color.js`, existing), `filterByName`
  (`utils/attendance-filter.js`, existing), `deriveRecipients` (Task 2).
- Produces: `SessionMessagesModal` component with this prop contract:
  - `visible`, `onClose` — standard modal visibility.
  - `role: 'trainer' | 'runner'` — decides ONLY the recipient-picker's shape (checkboxes + "Todos"
    for trainer; single-select for runner) and whether `connectedPeerIds`/`trainerName` are used.
  - `myUserId` (string) — to label my own messages "Vos" and to exclude myself from delivery (done
    by the parent, not here, but also needed here to never show myself in the recipient picker).
  - `messages` (array, from `useSessionMessages`) — already chronological.
  - `onSend(input)` — `input` is `{type, recipientMode, recipientUserIds, body, replyToMessageId}`,
    forwarded verbatim to `useSendSessionMessage`'s `sendMessage`.
  - `isSending` (bool) — disables the send button while a request is in flight.
  - `rosterMembers` (array of `{userId, name, photoUrl}`) — recipient candidates. The caller is
    responsible for excluding itself (both screens already compute a roster that excludes the
    caller's own userId) and, for `role === 'runner'`, for also excluding the trainer (handled as
    the separate fixed `trainerName` entry below).
  - `trainerName` (string, optional) — only meaningful for `role === 'runner'`: labels the fixed
    "Entrenador" recipient option, and is used to resolve a received message's sender name when
    `senderRole === 'trainer'`.
  - `trainerUserId` (string, optional) — only meaningful for `role === 'runner'`: the ACTUAL id to
    send when the runner picks the fixed "Entrenador" option. `recipient_mode: 'direct'` requires
    **exactly one** id (confirmed contract) — there is no "send direct with no id, let the backend
    infer the trainer" shortcut, an empty array fails the backend's own validation.
  - `connectedPeerIds` (`Set<string>`, optional) — only meaningful for `role === 'runner'`: the
    peer picker only lists `rosterMembers` whose `userId` is in this set.
  - `idPrefix` (string).

- [ ] **Step 1: Write the component**

```jsx
import { useState } from 'react';
import { Modal, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useThemeColors } from '../../theme/colors.js';
import { filterByName } from '../../utils/attendance-filter.js';
import { colorForUserId } from '../../utils/participant-color.js';
import { deriveRecipients } from '../../utils/session-message-recipients.js';

// Mensajería de sesión en vivo (Gap 27) -- un solo componente para los dos
// roles (prop `role`), compartiendo lista/compose/respuesta rápida. Solo el
// selector de destinatario difiere: el entrenador elige entre varios con
// checkboxes + "Todos"; el corredor elige UNO ("Entrenador" o un compañero
// conectado). Ver docs/superpowers/specs/2026-10-09-live-session-messaging-design.md.

const TYPE_META = {
  info: { label: 'Info', icon: 'information-outline', color: '#64748b', bg: 'bg-slate-100 dark:bg-slate-800' },
  aviso: { label: 'Aviso', icon: 'alert-outline', color: '#d97706', bg: 'bg-amber-100 dark:bg-amber-900/30' },
  alerta: { label: 'Alerta', icon: 'alert-decagram-outline', color: '#dc2626', bg: 'bg-red-100 dark:bg-red-900/30' },
};

const QUICK_REPLIES = ['Recibido', 'Necesito ayuda', 'Dale, ahí voy'];

function formatTime(iso) {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
}

function senderLabel(message, { myUserId, rosterMembers, trainerName }) {
  if (message.senderUserId === String(myUserId)) return 'Vos';
  if (message.senderRole === 'trainer') return trainerName ?? 'Entrenador';
  const member = rosterMembers.find((m) => String(m.userId) === message.senderUserId);
  return member?.name ?? 'Corredor';
}

function recipientSummary(message, { myUserId, rosterMembers, trainerName }) {
  if (message.recipientMode === 'all') return 'Para todos';
  if (message.recipientMode === 'multiple') return `Para ${message.recipientUserIds.length} personas`;
  const onlyId = message.recipientUserIds[0];
  if (onlyId === String(myUserId)) return 'Para vos';
  const member = rosterMembers.find((m) => String(m.userId) === onlyId);
  if (member) return `Para ${member.name}`;
  return trainerName ? `Para ${trainerName}` : 'Directo';
}

function MessageRow({ message, idPrefix, myUserId, rosterMembers, trainerName, onReply, replyDisabled }) {
  const meta = TYPE_META[message.type] ?? TYPE_META.info;
  const isMine = message.senderUserId === String(myUserId);
  const [replyText, setReplyText] = useState('');

  return (
    <View className="mb-3 gap-1.5" nativeID={`${idPrefix}-row`} testID={`${idPrefix}-row`}>
      <View className={`rounded-xl p-3 ${meta.bg}`} nativeID={`${idPrefix}-bubble`} testID={`${idPrefix}-bubble`}>
        <View className="mb-1 flex-row items-center justify-between" nativeID={`${idPrefix}-header`} testID={`${idPrefix}-header`}>
          <View className="flex-row items-center gap-1.5" nativeID={`${idPrefix}-identity`} testID={`${idPrefix}-identity`}>
            <MaterialCommunityIcons color={meta.color} name={meta.icon} size={14} />
            <Text className="text-xs font-semibold text-slate-700 dark:text-slate-200" nativeID={`${idPrefix}-sender`} testID={`${idPrefix}-sender`}>
              {senderLabel(message, { myUserId, rosterMembers, trainerName })}
            </Text>
          </View>
          <Text className="text-[11px] text-slate-400 dark:text-slate-500" nativeID={`${idPrefix}-time`} testID={`${idPrefix}-time`}>
            {formatTime(message.createdAt)}
          </Text>
        </View>
        <Text className="text-sm text-slate-800 dark:text-slate-100" nativeID={`${idPrefix}-body`} testID={`${idPrefix}-body`}>
          {message.body}
        </Text>
        <Text className="mt-1 text-[11px] text-slate-400 dark:text-slate-500" nativeID={`${idPrefix}-recipients`} testID={`${idPrefix}-recipients`}>
          {recipientSummary(message, { myUserId, rosterMembers, trainerName })}
        </Text>
      </View>

      {!isMine && (
        <View className="gap-1.5 pl-1" nativeID={`${idPrefix}-reply-area`} testID={`${idPrefix}-reply-area`}>
          <View className="flex-row flex-wrap gap-1.5" nativeID={`${idPrefix}-reply-chips`} testID={`${idPrefix}-reply-chips`}>
            {QUICK_REPLIES.map((chip, index) => (
              <Pressable
                className="rounded-full border border-slate-200 px-2.5 py-1 active:opacity-70 dark:border-slate-700"
                disabled={replyDisabled}
                key={chip}
                nativeID={`${idPrefix}-reply-chip-${index}`}
                onPress={() => onReply(chip, message)}
                testID={`${idPrefix}-reply-chip-${index}`}
              >
                <Text className="text-xs font-medium text-slate-600 dark:text-slate-300" nativeID={`${idPrefix}-reply-chip-${index}-label`} testID={`${idPrefix}-reply-chip-${index}-label`}>
                  {chip}
                </Text>
              </Pressable>
            ))}
          </View>
          <View className="flex-row items-center gap-1.5" nativeID={`${idPrefix}-reply-input-row`} testID={`${idPrefix}-reply-input-row`}>
            <TextInput
              className="h-8 flex-1 rounded-full border border-slate-200 bg-white px-3 text-xs dark:border-slate-700 dark:bg-slate-900 dark:text-white"
              editable={!replyDisabled}
              nativeID={`${idPrefix}-reply-input`}
              onChangeText={setReplyText}
              placeholder="Responder…"
              testID={`${idPrefix}-reply-input`}
              value={replyText}
            />
            <Pressable
              className="h-8 w-8 items-center justify-center rounded-full bg-primary active:opacity-80 disabled:opacity-40"
              disabled={replyDisabled || !replyText.trim()}
              nativeID={`${idPrefix}-reply-send-button`}
              onPress={() => { onReply(replyText.trim(), message); setReplyText(''); }}
              testID={`${idPrefix}-reply-send-button`}
            >
              <MaterialCommunityIcons color="#111518" name="send" size={14} />
            </Pressable>
          </View>
        </View>
      )}
    </View>
  );
}

function TrainerRecipientPicker({ idPrefix, rosterMembers, allSelected, setAllSelected, selectedUserIds, setSelectedUserIds }) {
  const colors = useThemeColors();
  const [query, setQuery] = useState('');
  const visibleMembers = filterByName(rosterMembers, query);

  const toggleMember = (userId) => {
    setAllSelected(false);
    setSelectedUserIds((current) => {
      const next = new Set(current);
      if (next.has(userId)) next.delete(userId);
      else next.add(userId);
      return next;
    });
  };

  return (
    <View className="gap-2" nativeID={`${idPrefix}-trainer-picker`} testID={`${idPrefix}-trainer-picker`}>
      <TextInput
        className="h-9 rounded-full border border-slate-200 bg-white px-3 text-xs dark:border-slate-700 dark:bg-slate-900 dark:text-white"
        nativeID={`${idPrefix}-trainer-picker-search`}
        onChangeText={setQuery}
        placeholder="Buscar participante"
        placeholderTextColor={colors.onSurfaceVariant}
        testID={`${idPrefix}-trainer-picker-search`}
        value={query}
      />
      <Pressable
        className={`flex-row items-center gap-2 rounded-lg p-2 ${allSelected ? 'bg-primary-tint-subtle dark:bg-primary/10' : ''}`}
        nativeID={`${idPrefix}-trainer-picker-all`}
        onPress={() => { setAllSelected(true); setSelectedUserIds(new Set()); }}
        testID={`${idPrefix}-trainer-picker-all`}
      >
        <MaterialCommunityIcons color={allSelected ? colors.primary : colors.onSurfaceVariant} name={allSelected ? 'check-circle' : 'checkbox-blank-circle-outline'} size={18} />
        <Text className="text-sm font-semibold text-slate-800 dark:text-white" nativeID={`${idPrefix}-trainer-picker-all-label`} testID={`${idPrefix}-trainer-picker-all-label`}>Todos</Text>
      </Pressable>
      <ScrollView className="max-h-40" nativeID={`${idPrefix}-trainer-picker-list`} testID={`${idPrefix}-trainer-picker-list`}>
        {visibleMembers.map((member) => {
          const checked = !allSelected && selectedUserIds.has(String(member.userId));
          return (
            <Pressable
              className="flex-row items-center gap-2 p-2"
              key={member.userId}
              nativeID={`${idPrefix}-trainer-picker-member-${member.userId}`}
              onPress={() => toggleMember(String(member.userId))}
              testID={`${idPrefix}-trainer-picker-member-${member.userId}`}
            >
              <MaterialCommunityIcons color={checked ? colors.primary : colors.onSurfaceVariant} name={checked ? 'checkbox-marked' : 'checkbox-blank-outline'} size={18} />
              <View className="h-2 w-2 rounded-full" nativeID={`${idPrefix}-trainer-picker-member-${member.userId}-dot`} style={{ backgroundColor: colorForUserId(member.userId) }} testID={`${idPrefix}-trainer-picker-member-${member.userId}-dot`} />
              <Text className="text-sm text-slate-800 dark:text-white" nativeID={`${idPrefix}-trainer-picker-member-${member.userId}-name`} testID={`${idPrefix}-trainer-picker-member-${member.userId}-name`}>{member.name}</Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

function RunnerRecipientPicker({ idPrefix, trainerName, peerMembers, selectedUserId, setSelectedUserId }) {
  const colors = useThemeColors();
  return (
    <ScrollView className="max-h-40" nativeID={`${idPrefix}-runner-picker`} testID={`${idPrefix}-runner-picker`}>
      <Pressable
        className={`flex-row items-center gap-2 p-2 ${selectedUserId === 'trainer' ? 'bg-primary-tint-subtle dark:bg-primary/10' : ''}`}
        nativeID={`${idPrefix}-runner-picker-trainer`}
        onPress={() => setSelectedUserId('trainer')}
        testID={`${idPrefix}-runner-picker-trainer`}
      >
        <MaterialCommunityIcons color={selectedUserId === 'trainer' ? colors.primary : colors.onSurfaceVariant} name={selectedUserId === 'trainer' ? 'check-circle' : 'checkbox-blank-circle-outline'} size={18} />
        <Text className="text-sm font-semibold text-slate-800 dark:text-white" nativeID={`${idPrefix}-runner-picker-trainer-label`} testID={`${idPrefix}-runner-picker-trainer-label`}>
          {trainerName ?? 'Entrenador'}
        </Text>
      </Pressable>
      {peerMembers.map((member) => {
        const selected = selectedUserId === String(member.userId);
        return (
          <Pressable
            className={`flex-row items-center gap-2 p-2 ${selected ? 'bg-primary-tint-subtle dark:bg-primary/10' : ''}`}
            key={member.userId}
            nativeID={`${idPrefix}-runner-picker-peer-${member.userId}`}
            onPress={() => setSelectedUserId(String(member.userId))}
            testID={`${idPrefix}-runner-picker-peer-${member.userId}`}
          >
            <MaterialCommunityIcons color={selected ? colors.primary : colors.onSurfaceVariant} name={selected ? 'check-circle' : 'checkbox-blank-circle-outline'} size={18} />
            <View className="h-2 w-2 rounded-full" nativeID={`${idPrefix}-runner-picker-peer-${member.userId}-dot`} style={{ backgroundColor: colorForUserId(member.userId) }} testID={`${idPrefix}-runner-picker-peer-${member.userId}-dot`} />
            <Text className="text-sm text-slate-800 dark:text-white" nativeID={`${idPrefix}-runner-picker-peer-${member.userId}-name`} testID={`${idPrefix}-runner-picker-peer-${member.userId}-name`}>{member.name}</Text>
          </Pressable>
        );
      })}
      {peerMembers.length === 0 && (
        <Text className="p-2 text-xs text-slate-400 dark:text-slate-500" nativeID={`${idPrefix}-runner-picker-empty`} testID={`${idPrefix}-runner-picker-empty`}>
          Ningún compañero conectado todavía.
        </Text>
      )}
    </ScrollView>
  );
}

export function SessionMessagesModal({
  visible, onClose, role, myUserId, messages, onSend, isSending,
  rosterMembers, trainerName, trainerUserId, connectedPeerIds, idPrefix,
}) {
  const colors = useThemeColors();
  const [pickerOpen, setPickerOpen] = useState(false);
  const [type, setType] = useState('info');
  const [body, setBody] = useState('');
  // Entrenador: multi-select. Corredor: single-select ('trainer' o un userId string).
  const [allSelected, setAllSelected] = useState(true);
  const [selectedUserIds, setSelectedUserIds] = useState(() => new Set());
  const [runnerRecipientId, setRunnerRecipientId] = useState('trainer');

  const peerMembers = role === 'runner'
    ? rosterMembers.filter((m) => connectedPeerIds?.has(String(m.userId)))
    : [];

  const handleReply = (text, originalMessage) => {
    const clean = text.trim();
    if (!clean) return;
    onSend({
      type: 'info',
      recipientMode: 'direct',
      recipientUserIds: [originalMessage.senderUserId],
      body: clean,
      replyToMessageId: originalMessage.id,
    });
  };

  const handleSendCompose = () => {
    const clean = body.trim();
    if (!clean) return;
    if (role === 'trainer') {
      const recipients = deriveRecipients({ allSelected, selectedUserIds });
      if (!recipients) return;
      onSend({ type, ...recipients, body: clean });
    } else {
      // recipient_mode:'direct' exige EXACTAMENTE un id (contrato confirmado)
      // -- un array vacío no es "que el backend adivine el entrenador", es
      // simplemente inválido (400). Por eso el runner picker necesita
      // `trainerUserId` real, no solo el label `trainerName`.
      const recipientUserIds = runnerRecipientId === 'trainer' ? [trainerUserId] : [runnerRecipientId];
      onSend({ type, recipientMode: 'direct', recipientUserIds, body: clean });
    }
    setBody('');
  };

  const canSendCompose = role === 'trainer'
    ? Boolean(deriveRecipients({ allSelected, selectedUserIds })) && body.trim().length > 0
    // Si todavía no resolvió quién es el entrenador (useTeam en curso, ver
    // Task 9) y la elección actual es justo "Entrenador", no hay un id
    // válido para armar el mensaje -- se deshabilita en vez de mandar
    // recipient_user_ids:[undefined].
    : body.trim().length > 0 && (runnerRecipientId !== 'trainer' || Boolean(trainerUserId));

  const recipientSummaryLabel = role === 'trainer'
    ? (allSelected ? 'Todos' : selectedUserIds.size === 0 ? 'Elegí destinatario' : `${selectedUserIds.size} seleccionado(s)`)
    : (runnerRecipientId === 'trainer' ? (trainerName ?? 'Entrenador') : rosterMembers.find((m) => String(m.userId) === runnerRecipientId)?.name ?? 'Elegí destinatario');

  return (
    <Modal animationType="fade" nativeID={idPrefix} onRequestClose={onClose} testID={idPrefix} transparent visible={visible}>
      <Pressable className="flex-1 items-end bg-black/50" nativeID={`${idPrefix}-backdrop`} onPress={onClose} testID={`${idPrefix}-backdrop`}>
        <Pressable className="h-full w-full max-w-lg bg-white dark:bg-surface" nativeID={`${idPrefix}-card`} onPress={() => {}} testID={`${idPrefix}-card`}>
          <SafeAreaView className="flex-1 p-4" edges={['top', 'bottom']} nativeID={`${idPrefix}-card-safe-area`} testID={`${idPrefix}-card-safe-area`}>
            <View className="mb-3 flex-row items-center justify-between" nativeID={`${idPrefix}-header`} testID={`${idPrefix}-header`}>
              <Text className="text-lg font-bold text-slate-900 dark:text-white" nativeID={`${idPrefix}-title`} testID={`${idPrefix}-title`}>Mensajes</Text>
              <Pressable className="h-9 w-9 items-center justify-center rounded-full active:opacity-70" nativeID={`${idPrefix}-close-button`} onPress={onClose} testID={`${idPrefix}-close-button`}>
                <MaterialCommunityIcons color={colors.onSurfaceVariant} name="close" size={22} />
              </Pressable>
            </View>

            {pickerOpen ? (
              <View className="flex-1" nativeID={`${idPrefix}-picker-area`} testID={`${idPrefix}-picker-area`}>
                {role === 'trainer' ? (
                  <TrainerRecipientPicker
                    allSelected={allSelected}
                    idPrefix={idPrefix}
                    rosterMembers={rosterMembers}
                    selectedUserIds={selectedUserIds}
                    setAllSelected={setAllSelected}
                    setSelectedUserIds={setSelectedUserIds}
                  />
                ) : (
                  <RunnerRecipientPicker
                    idPrefix={idPrefix}
                    peerMembers={peerMembers}
                    selectedUserId={runnerRecipientId}
                    setSelectedUserId={setRunnerRecipientId}
                    trainerName={trainerName}
                  />
                )}
                <Pressable
                  className="mt-3 h-10 items-center justify-center rounded-full bg-primary active:opacity-80"
                  nativeID={`${idPrefix}-picker-done-button`}
                  onPress={() => setPickerOpen(false)}
                  testID={`${idPrefix}-picker-done-button`}
                >
                  <Text className="text-sm font-semibold uppercase tracking-wide text-[#111518]" nativeID={`${idPrefix}-picker-done-label`} testID={`${idPrefix}-picker-done-label`}>Listo</Text>
                </Pressable>
              </View>
            ) : (
              <>
                <ScrollView className="flex-1" nativeID={`${idPrefix}-list`} testID={`${idPrefix}-list`}>
                  {messages.map((message) => (
                    <MessageRow
                      idPrefix={`${idPrefix}-message-${message.id}`}
                      key={message.id}
                      message={message}
                      myUserId={myUserId}
                      onReply={handleReply}
                      replyDisabled={isSending}
                      rosterMembers={rosterMembers}
                      trainerName={trainerName}
                    />
                  ))}
                  {messages.length === 0 && (
                    <Text className="p-4 text-center text-sm text-slate-500 dark:text-slate-400" nativeID={`${idPrefix}-empty`} testID={`${idPrefix}-empty`}>
                      Todavía no hay mensajes en esta sesión.
                    </Text>
                  )}
                </ScrollView>

                <View className="gap-2 border-t border-slate-100 pt-3 dark:border-slate-800" nativeID={`${idPrefix}-compose`} testID={`${idPrefix}-compose`}>
                  <View className="flex-row gap-2" nativeID={`${idPrefix}-compose-type-row`} testID={`${idPrefix}-compose-type-row`}>
                    {Object.entries(TYPE_META).map(([key, meta]) => (
                      <Pressable
                        className={`flex-1 flex-row items-center justify-center gap-1 rounded-full border px-2 py-1.5 ${type === key ? 'border-primary bg-primary-tint-subtle dark:bg-primary/10' : 'border-slate-200 dark:border-slate-700'}`}
                        key={key}
                        nativeID={`${idPrefix}-compose-type-${key}`}
                        onPress={() => setType(key)}
                        testID={`${idPrefix}-compose-type-${key}`}
                      >
                        <MaterialCommunityIcons color={type === key ? colors.primary : colors.onSurfaceVariant} name={meta.icon} size={14} />
                        <Text className={`text-xs font-semibold ${type === key ? 'text-primary' : 'text-slate-600 dark:text-slate-300'}`} nativeID={`${idPrefix}-compose-type-${key}-label`} testID={`${idPrefix}-compose-type-${key}-label`}>
                          {meta.label}
                        </Text>
                      </Pressable>
                    ))}
                  </View>

                  <Pressable
                    className="h-9 flex-row items-center justify-between rounded-full border border-slate-200 px-3 active:opacity-70 dark:border-slate-700"
                    nativeID={`${idPrefix}-compose-recipient-button`}
                    onPress={() => setPickerOpen(true)}
                    testID={`${idPrefix}-compose-recipient-button`}
                  >
                    <Text className="text-xs font-medium text-slate-600 dark:text-slate-300" nativeID={`${idPrefix}-compose-recipient-label`} numberOfLines={1} testID={`${idPrefix}-compose-recipient-label`}>
                      {recipientSummaryLabel}
                    </Text>
                    <MaterialCommunityIcons color={colors.onSurfaceVariant} name="chevron-right" size={16} />
                  </Pressable>

                  <View className="flex-row items-end gap-2" nativeID={`${idPrefix}-compose-input-row`} testID={`${idPrefix}-compose-input-row`}>
                    <TextInput
                      className="min-h-10 flex-1 rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                      multiline
                      nativeID={`${idPrefix}-compose-input`}
                      onChangeText={setBody}
                      placeholder="Escribí un mensaje…"
                      placeholderTextColor={colors.onSurfaceVariant}
                      testID={`${idPrefix}-compose-input`}
                      value={body}
                    />
                    <Pressable
                      className="h-10 w-10 items-center justify-center rounded-full bg-primary active:opacity-80 disabled:opacity-40"
                      disabled={!canSendCompose || isSending}
                      nativeID={`${idPrefix}-compose-send-button`}
                      onPress={handleSendCompose}
                      testID={`${idPrefix}-compose-send-button`}
                    >
                      <MaterialCommunityIcons color="#111518" name="send" size={18} />
                    </Pressable>
                  </View>
                </View>
              </>
            )}
          </SafeAreaView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
```

- [ ] **Step 2: Lint**

Run: `npm run lint`
Expected: no new errors (this file is large — if `local/require-native-id` flags anything, every
`View`/`Text`/`Pressable`/`TextInput`/`ScrollView`/`Modal` above already has both `nativeID` and
`testID`; double check nothing was dropped by a copy/paste mistake).

- [ ] **Step 3: Commit**

```bash
git add components/session-runtime/session-messages-modal.jsx
git commit -m "feat(session-messages): SessionMessagesModal component (list, compose, recipient pickers)"
```

---

### Task 8: Wire into `trainer-session-live-screen.jsx`

**Files:**
- Modify: `components/session-runtime/trainer-session-live-screen.jsx`

**Interfaces:**
- Consumes: `useSessionMessages`, `useSendSessionMessage` (Task 5), `SessionMessagesModal` (Task 7),
  `pickUndeliveredMessages`, `deliveryFor` (Task 2), `notifyAviso`, `notifyAlerta` (Task 3),
  `playAlertSound` (Task 4).

- [ ] **Step 1: Add imports**

Near the top of the file, alongside the existing imports, add:

```js
import Toast from 'react-native-toast-message';
import { useSessionMessages, useSendSessionMessage } from '../../hooks/use-session-messages.js';
import { SessionMessagesModal } from './session-messages-modal.jsx';
import { deliveryFor, pickUndeliveredMessages } from '../../utils/session-message-delivery.js';
import { notifyAviso, notifyAlerta } from '../../utils/haptics.js';
import { playAlertSound } from '../../utils/session-alert-sound.js';
```

(No `useQueryClient` here — this screen never calls it directly; the cache invalidation on
`control:message_created` already happens inside `use-trainer-session-runtime.js` itself, Task 6.
`Toast` — check whether `react-native-toast-message` is already imported in this file; if it
already is, do not duplicate the import, just reuse it.)

- [ ] **Step 2: Add state and the messages/delivery wiring**

Inside `function TrainerSessionLiveScreenContent() {`, after the existing
`const [attendanceVisible, setAttendanceVisible] = useState(false);` line, add:

```js
  const [messagesVisible, setMessagesVisible] = useState(false);
  const { messages } = useSessionMessages(sessionInstanceId);
  const { sendMessage, isSending } = useSendSessionMessage(sessionInstanceId);
```

After the existing `cameraRef`/`dragRef` `useRef` declarations, add two more refs for the
delivery-tracking state (a `ref`, not `useState`, because this bookkeeping never needs to trigger a
re-render on its own — only the `messages` array changing does):

```js
  const deliveredMessageIdsRef = useRef(new Set());
  const messagesSeededRef = useRef(false);
  const [deliveryQueue, setDeliveryQueue] = useState([]);
```

Add this effect right after the `useEffect` that calls `notifyWarning()` for `finishConfirmVisible`
(the one that already exists in this file):

```js
  // Entrega por severidad (Gap 27) -- el PRIMER fetch (al montar la pantalla,
  // trae TODO el historial) solo siembra deliveredMessageIdsRef, sin disparar
  // ningún toast/modal/haptics/sonido -- si no, reabrir esta pantalla
  // reproduciría cada alerta de toda la sesión otra vez. Solo los mensajes
  // que llegan DESPUÉS de ese primer fetch (vía la invalidación que dispara
  // useTrainerSessionRuntime al recibir control:message_created) se entregan.
  useEffect(() => {
    if (!messagesSeededRef.current) {
      for (const message of messages) deliveredMessageIdsRef.current.add(message.id);
      messagesSeededRef.current = true;
      return;
    }
    const toDeliver = pickUndeliveredMessages(messages, deliveredMessageIdsRef.current, trainerUserId);
    if (toDeliver.length === 0) return;
    for (const message of toDeliver) {
      deliveredMessageIdsRef.current.add(message.id);
      const delivery = deliveryFor(message.type);
      const senderName = message.senderRole === 'trainer' ? 'Vos' : (runnerMembers.find((m) => String(m.userId) === message.senderUserId)?.name ?? 'Corredor');
      if (delivery.toast) Toast.show({ type: 'info', text1: senderName, text2: message.body });
      if (delivery.modal) setDeliveryQueue((current) => [...current, message]);
      if (delivery.haptics === 'medium') notifyAviso();
      if (delivery.haptics === 'heavy') notifyAlerta();
      if (delivery.sound) playAlertSound();
    }
  }, [messages, trainerUserId, runnerMembers]);
```

- [ ] **Step 3: Add the "Mensajes" button**

In the controls row block, find:

```jsx
          <View className="flex-row gap-3" nativeID="trainer-session-live-controls-row" testID="trainer-session-live-controls-row">
            <Pressable
              className="h-11 flex-1 flex-row items-center justify-center gap-1.5 rounded-full border border-slate-200 bg-white shadow-sm active:opacity-70 dark:border-slate-700 dark:bg-surface"
              nativeID="trainer-session-live-attendance-button"
              onPress={() => setAttendanceVisible(true)}
              testID="trainer-session-live-attendance-button"
            >
              <MaterialCommunityIcons color={colors.onSurfaceVariant} name="clipboard-check-outline" size={18} />
              <Text className="text-xs font-semibold text-slate-700 dark:text-slate-200" nativeID="trainer-session-live-attendance-button-label" testID="trainer-session-live-attendance-button-label">Asistencia</Text>
            </Pressable>
            <Pressable
              className="h-11 flex-1 flex-row items-center justify-center gap-1.5 rounded-full border border-slate-200 bg-white shadow-sm active:opacity-70 dark:border-slate-700 dark:bg-surface"
              nativeID="trainer-session-live-participants-button"
              onPress={() => setParticipantsVisible(true)}
              testID="trainer-session-live-participants-button"
            >
              <MaterialCommunityIcons color={colors.onSurfaceVariant} name="account-group-outline" size={18} />
              <Text className="text-xs font-semibold text-slate-700 dark:text-slate-200" nativeID="trainer-session-live-participants-button-label" testID="trainer-session-live-participants-button-label">Participantes</Text>
            </Pressable>
          </View>
```

Replace it with the same block plus a third button (the row was two-wide; it becomes three-wide —
the existing `flex-1` on each Pressable already shares space evenly, no layout changes needed
beyond adding the third child):

```jsx
          <View className="flex-row gap-3" nativeID="trainer-session-live-controls-row" testID="trainer-session-live-controls-row">
            <Pressable
              className="h-11 flex-1 flex-row items-center justify-center gap-1.5 rounded-full border border-slate-200 bg-white shadow-sm active:opacity-70 dark:border-slate-700 dark:bg-surface"
              nativeID="trainer-session-live-attendance-button"
              onPress={() => setAttendanceVisible(true)}
              testID="trainer-session-live-attendance-button"
            >
              <MaterialCommunityIcons color={colors.onSurfaceVariant} name="clipboard-check-outline" size={18} />
              <Text className="text-xs font-semibold text-slate-700 dark:text-slate-200" nativeID="trainer-session-live-attendance-button-label" testID="trainer-session-live-attendance-button-label">Asistencia</Text>
            </Pressable>
            <Pressable
              className="h-11 flex-1 flex-row items-center justify-center gap-1.5 rounded-full border border-slate-200 bg-white shadow-sm active:opacity-70 dark:border-slate-700 dark:bg-surface"
              nativeID="trainer-session-live-participants-button"
              onPress={() => setParticipantsVisible(true)}
              testID="trainer-session-live-participants-button"
            >
              <MaterialCommunityIcons color={colors.onSurfaceVariant} name="account-group-outline" size={18} />
              <Text className="text-xs font-semibold text-slate-700 dark:text-slate-200" nativeID="trainer-session-live-participants-button-label" testID="trainer-session-live-participants-button-label">Participantes</Text>
            </Pressable>
            <Pressable
              className="h-11 flex-1 flex-row items-center justify-center gap-1.5 rounded-full border border-slate-200 bg-white shadow-sm active:opacity-70 dark:border-slate-700 dark:bg-surface"
              nativeID="trainer-session-live-messages-button"
              onPress={() => setMessagesVisible(true)}
              testID="trainer-session-live-messages-button"
            >
              <MaterialCommunityIcons color={colors.onSurfaceVariant} name="message-text-outline" size={18} />
              <Text className="text-xs font-semibold text-slate-700 dark:text-slate-200" nativeID="trainer-session-live-messages-button-label" testID="trainer-session-live-messages-button-label">Mensajes</Text>
            </Pressable>
          </View>
```

- [ ] **Step 4: Mount the modal and the blocking delivery alert**

Right after the existing `<AttendanceSessionModal ... />` block (find its closing `/>`), add:

```jsx
      <SessionMessagesModal
        idPrefix="trainer-session-live-messages-modal"
        isSending={isSending}
        myUserId={trainerUserId}
        onClose={() => setMessagesVisible(false)}
        onSend={sendMessage}
        messages={messages}
        role="trainer"
        rosterMembers={runnerMembers}
        visible={messagesVisible}
      />

      <Modal animationType="fade" nativeID="trainer-session-live-delivery-modal" onRequestClose={() => setDeliveryQueue((q) => q.slice(1))} testID="trainer-session-live-delivery-modal" transparent visible={deliveryQueue.length > 0}>
        <Pressable className="flex-1 items-center justify-center bg-black/50 px-4" nativeID="trainer-session-live-delivery-modal-backdrop" onPress={() => setDeliveryQueue((q) => q.slice(1))} testID="trainer-session-live-delivery-modal-backdrop">
          <Pressable className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-xl dark:border-slate-700 dark:bg-surface" nativeID="trainer-session-live-delivery-modal-card" onPress={() => {}} testID="trainer-session-live-delivery-modal-card">
            <Text className="text-lg font-bold text-slate-900 dark:text-white" nativeID="trainer-session-live-delivery-modal-title" testID="trainer-session-live-delivery-modal-title">
              {deliveryQueue[0]?.type === 'alerta' ? 'Alerta' : 'Aviso'}
            </Text>
            <Text className="mt-2 text-sm leading-5 text-slate-600 dark:text-slate-300" nativeID="trainer-session-live-delivery-modal-body" testID="trainer-session-live-delivery-modal-body">
              {deliveryQueue[0]?.body}
            </Text>
            <Pressable className="mt-5 h-11 items-center justify-center rounded-full bg-primary active:opacity-80" nativeID="trainer-session-live-delivery-modal-close-button" onPress={() => setDeliveryQueue((q) => q.slice(1))} testID="trainer-session-live-delivery-modal-close-button">
              <Text className="text-sm font-semibold uppercase tracking-wide text-[#111518]" nativeID="trainer-session-live-delivery-modal-close-label" testID="trainer-session-live-delivery-modal-close-label">Cerrar</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
```

`Modal` is already imported at the top of this file (used elsewhere in it already for other
modals) — do not add a duplicate import.

- [ ] **Step 5: Run tests and lint**

Run: `npm test && npm run lint`
Expected: both green (no new Jest test targets this file directly — the project convention is no
component-render tests — this step only confirms nothing else broke).

- [ ] **Step 6: Commit**

```bash
git add components/session-runtime/trainer-session-live-screen.jsx
git commit -m "feat(session-messages): wire messaging into trainer-session-live-screen.jsx"
```

---

### Task 9: Wire into `training-session-live-screen.jsx` (runner)

**Files:**
- Modify: `components/session-runtime/training-session-live-screen.jsx`

**Interfaces:**
- Consumes: same as Task 8, plus `connectedPeerIds` and `run` from `useLiveSessionRuntime()`
  (Task 6), `useTeamRoster` (existing hook, not yet imported in this file).

- [ ] **Step 1: Add imports**

```js
import { useAuthStore } from '../../store/auth-store.js';
import { useTeam } from '../../hooks/use-teams.js';
import { useTeamRoster } from '../../hooks/use-team-roster.js';
import { useSessionMessages, useSendSessionMessage } from '../../hooks/use-session-messages.js';
import { SessionMessagesModal } from './session-messages-modal.jsx';
import { deliveryFor, pickUndeliveredMessages } from '../../utils/session-message-delivery.js';
import { notifyAviso, notifyAlerta } from '../../utils/haptics.js';
import { playAlertSound } from '../../utils/session-alert-sound.js';
```

(`useAuthStore` may already be imported elsewhere in the app but check this specific file — it is
likely NOT yet imported here, since `use-live-session-runtime.js` is the one that reads `userId`
today, not this screen component. `Toast` from `react-native-toast-message` is already imported in
this file — reuse it, do not duplicate.)

- [ ] **Step 2: Resolve the team roster and trainer identity**

Confirmed by reading both hooks' source while writing this plan: `useTeamRoster(teamId)` returns
`{members, loading, error}` — `members` has no role field, so it cannot tell you which member is
the trainer. `useTeam(teamId)` (from `hooks/use-teams.js`) returns `{team, loading, error}`, and
`team.ownerId` (`services/normalizers.js#toTeamModel`) is the trainer's userId — but `toTeamModel`
has no `ownerName` field (only `toTeamSearchResultModel`, a different endpoint, has that). The
trainer's NAME is resolved instead by cross-referencing `team.ownerId` against `rosterMembers`
(the trainer is expected to appear as a member row of their own team's roster, same assumption
`trainer-session-live-screen.jsx` already makes about itself) — if that lookup ever misses (the
trainer never joined their own team as a member row), the UI falls back to a generic "Entrenador"
label instead of a real name; it never crashes or blocks sending.

Inside `function TrainingSessionLiveScreenContent() {`, the hook call list currently starts with
`const router = useRouter();` and `const clearLiveSession = ...`. Right after those two lines, add:

```js
  const myUserId = useAuthStore((s) => s.userId);
```

The hook's destructured return (`const { booted, bootError, run, sets, ... } = useLiveSessionRuntime();`)
needs one more field pulled out — add `connectedPeerIds` to that destructuring list.

After the full `useLiveSessionRuntime()` destructuring block, add:

```js
  // `run` recién existe después del bootstrap -- antes de eso, `teamId` es
  // null y los dos hooks de abajo simplemente no piden nada todavía (su
  // propio `enabled` interno por id, mismo patrón que el resto del repo).
  const teamId = run?.team_id ?? null;
  const { team } = useTeam(teamId);
  const { members: rosterMembers } = useTeamRoster(teamId);
  const trainerUserId = team?.ownerId ?? null;
  const trainerName = rosterMembers.find((m) => String(m.userId) === String(trainerUserId))?.name ?? null;
  const peerMembers = rosterMembers.filter((m) => String(m.userId) !== String(myUserId) && String(m.userId) !== String(trainerUserId));
```

- [ ] **Step 3: Add messages state and delivery wiring**

Inside the same component, after the `const [sessionComplete, setSessionComplete] = useState(false);`
line, add:

```js
  const [messagesVisible, setMessagesVisible] = useState(false);
  const sessionInstanceId = run?.session_instance_id ?? null;
  const { messages } = useSessionMessages(sessionInstanceId);
  const { sendMessage, isSending } = useSendSessionMessage(sessionInstanceId);
  const deliveredMessageIdsRef = useRef(new Set());
  const messagesSeededRef = useRef(false);
  const [deliveryQueue, setDeliveryQueue] = useState([]);
```

Add the same seed-then-deliver effect used in Task 8 (adjust the sender-name resolution: the
runner's peers come from `peerMembers`, and the trainer is a FIXED label, not a roster lookup):

```js
  useEffect(() => {
    if (!messagesSeededRef.current) {
      for (const message of messages) deliveredMessageIdsRef.current.add(message.id);
      messagesSeededRef.current = true;
      return;
    }
    const toDeliver = pickUndeliveredMessages(messages, deliveredMessageIdsRef.current, myUserId);
    if (toDeliver.length === 0) return;
    for (const message of toDeliver) {
      deliveredMessageIdsRef.current.add(message.id);
      const delivery = deliveryFor(message.type);
      const senderName = message.senderRole === 'trainer' ? (trainerName ?? 'Entrenador') : (peerMembers.find((m) => String(m.userId) === message.senderUserId)?.name ?? 'Corredor');
      if (delivery.toast) Toast.show({ type: 'info', text1: senderName, text2: message.body });
      if (delivery.modal) setDeliveryQueue((current) => [...current, message]);
      if (delivery.haptics === 'medium') notifyAviso();
      if (delivery.haptics === 'heavy') notifyAlerta();
      if (delivery.sound) playAlertSound();
    }
  }, [messages, myUserId, trainerName, peerMembers]);
```

- [ ] **Step 4: Add the "Mensajes" button**

Find `LiveOverviewView`'s header row:

```jsx
      <View className="flex-row items-center justify-between px-4 pt-2" nativeID="training-session-live-overview-header-row" testID="training-session-live-overview-header-row">
        <Text className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400" nativeID="training-session-live-overview-header-label" testID="training-session-live-overview-header-label">
          Sesión presencial
        </Text>
        <AttendanceQuickAccessButton idPrefix="training-session-live-overview" router={router} />
      </View>
```

`LiveOverviewView` does not currently receive a way to open the messages modal — add a new prop
`onOpenMessages` to its signature (find `function LiveOverviewView({ sets, run, activeSetId,
activePhase, onOpenSet, onCancel, router }) {` and add `onOpenMessages` to that parameter list), and
use it in the header row:

```jsx
      <View className="flex-row items-center justify-between px-4 pt-2" nativeID="training-session-live-overview-header-row" testID="training-session-live-overview-header-row">
        <Text className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400" nativeID="training-session-live-overview-header-label" testID="training-session-live-overview-header-label">
          Sesión presencial
        </Text>
        <View className="flex-row items-center gap-1" nativeID="training-session-live-overview-header-actions" testID="training-session-live-overview-header-actions">
          <Pressable
            className="h-9 w-9 items-center justify-center rounded-full active:opacity-70"
            nativeID="training-session-live-overview-messages-button"
            onPress={onOpenMessages}
            testID="training-session-live-overview-messages-button"
          >
            <MaterialCommunityIcons color={colors.onSurfaceVariant} name="message-text-outline" size={20} />
          </Pressable>
          <AttendanceQuickAccessButton idPrefix="training-session-live-overview" router={router} />
        </View>
      </View>
```

`LiveOverviewView` does not currently call `useThemeColors()` — add `const colors =
useThemeColors();` at the top of that function if it is not already there (check first; if the
function already has a `colors` variable in scope, reuse it, do not redeclare).

At the call site of `<LiveOverviewView .../>` (inside `TrainingSessionLiveScreenContent`'s
`return`), add the new prop:

```jsx
          <LiveOverviewView
            activePhase={activePhase}
            activeSetId={activeSetId}
            onCancel={handleCancelConfirmed}
            onOpenMessages={() => setMessagesVisible(true)}
            onOpenSet={handleOpenSet}
            router={router}
            run={run}
            sets={sets}
          />
```

- [ ] **Step 5: Mount the modal and the blocking delivery alert**

Right before the closing `</SafeAreaView>` of `TrainingSessionLiveScreenContent`'s main return
(after the existing `sessionComplete` `<Modal>` block), add:

```jsx
        <SessionMessagesModal
          connectedPeerIds={connectedPeerIds}
          idPrefix="training-session-live-messages-modal"
          isSending={isSending}
          myUserId={myUserId}
          onClose={() => setMessagesVisible(false)}
          onSend={sendMessage}
          messages={messages}
          role="runner"
          rosterMembers={peerMembers}
          trainerName={trainerName}
          trainerUserId={trainerUserId != null ? String(trainerUserId) : null}
          visible={messagesVisible}
        />

        <Modal animationType="fade" nativeID="training-session-live-delivery-modal" onRequestClose={() => setDeliveryQueue((q) => q.slice(1))} testID="training-session-live-delivery-modal" transparent visible={deliveryQueue.length > 0}>
          <Pressable className="flex-1 items-center justify-center bg-black/50 px-4" nativeID="training-session-live-delivery-modal-backdrop" onPress={() => setDeliveryQueue((q) => q.slice(1))} testID="training-session-live-delivery-modal-backdrop">
            <Pressable className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-xl dark:border-slate-700 dark:bg-surface" nativeID="training-session-live-delivery-modal-card" onPress={() => {}} testID="training-session-live-delivery-modal-card">
              <Text className="text-lg font-bold text-slate-900 dark:text-white" nativeID="training-session-live-delivery-modal-title" testID="training-session-live-delivery-modal-title">
                {deliveryQueue[0]?.type === 'alerta' ? 'Alerta' : 'Aviso'}
              </Text>
              <Text className="mt-2 text-sm leading-5 text-slate-600 dark:text-slate-300" nativeID="training-session-live-delivery-modal-body" testID="training-session-live-delivery-modal-body">
                {deliveryQueue[0]?.body}
              </Text>
              <Pressable className="mt-5 h-11 items-center justify-center rounded-full bg-primary active:opacity-80" nativeID="training-session-live-delivery-modal-close-button" onPress={() => setDeliveryQueue((q) => q.slice(1))} testID="training-session-live-delivery-modal-close-button">
                <Text className="text-sm font-semibold uppercase tracking-wide text-[#111518]" nativeID="training-session-live-delivery-modal-close-label" testID="training-session-live-delivery-modal-close-label">Cerrar</Text>
              </Pressable>
            </Pressable>
          </Pressable>
        </Modal>
```

`connectedPeerIds` must be added to this component's destructuring of `useLiveSessionRuntime()`'s
return value if Step 2 above did not already do it — confirm it is present before this step.

- [ ] **Step 6: Run tests and lint**

Run: `npm test && npm run lint`
Expected: both green.

- [ ] **Step 7: Commit**

```bash
git add components/session-runtime/training-session-live-screen.jsx
git commit -m "feat(session-messages): wire messaging into training-session-live-screen.jsx (runner)"
```

---

### Task 10: Final verification

**Files:** none (verification only).

- [ ] **Step 1: Full test suite**

Run: `npm test`
Expected: every test suite passes, including all new ones added across Tasks 1-3 (normalizers: +5,
session-message-delivery: +4, session-message-recipients: +4, connected-peers: +8, haptics: +3,
haptics-web: +3 — 27 new tests total on top of the pre-existing suite).

- [ ] **Step 2: Full lint**

Run: `npm run lint`
Expected: zero errors (pre-existing warnings like `react-hooks/exhaustive-deps` in unrelated files
are fine, per project convention — see `CLAUDE.md`, "Testing" section).

- [ ] **Step 3: Confirm `docs/BACKEND_API_GAPS.md` already reflects Gap 27 as resolved**

This was already updated in an earlier session (commit `b508198` on this branch, before this plan
was written) — nothing to do here, just confirm with `git log --oneline -- docs/BACKEND_API_GAPS.md`
that the entry exists. If it somehow does not, that is a sign something regressed and needs
investigation before closing this branch — do not re-write it blindly.

- [ ] **Step 4: Manual test script (hand to the user — this plan does not include browser/device
verification, per this project's standing convention of the user doing their own QA)**

Both screens this plan touches are `MobileOnlyRoute`-gated — this cannot be verified in the web
preview. On a real device (or the dev client, rebuilt per Task 4's note), with two
accounts/devices (one trainer, one runner) in the same live presencial session:

1. Trainer opens "Mensajes", picks "Todos", types "Arrancamos en 2 minutos", type `info`, sends.
   Runner sees a toast with that text within a couple seconds (no need to have the modal open).
2. Trainer sends a message to the SAME runner only (uncheck "Todos", check just that one name),
   type `aviso`. Confirm only that runner sees a blocking modal + a medium haptic buzz; a SECOND
   runner on another device does NOT get interrupted (no modal, no toast — though their own
   "Mensajes" history WILL show the message if they open it, with "Para <name>" under it — the
   privacy rule is "backend doesn't deliver it to them", not "nobody else can ever see it exists" —
   confirm this distinction holds, i.e. a non-recipient runner does not receive the toast/modal/
   haptics at all).
3. Same again with type `alerta` — confirm a strong haptic buzz AND the short beep sound play on
   the device that was built with the dev client rebuild; on a device still running the OLD dev
   client build (pre-`expo-audio`), confirm it does NOT crash — the sound call is wrapped in
   try/catch and gated by `isMobile`, it should just silently skip the sound while haptics+modal
   still work.
4. From a runner device, open "Mensajes", confirm the recipient picker shows "Entrenador" always,
   and shows other CONNECTED runners (have a third device join mid-test and confirm it appears in
   the list within a few seconds — it should NOT need an app restart).
5. One runner sends a direct message to ANOTHER runner (not the trainer). Confirm the trainer's own
   "Mensajes" history never shows that message, on either device.
6. Under a received message, tap one of the quick-reply chips ("Recibido"). Confirm it sends back
   to the original sender and shows up in their history as "Para <you>".
7. Close and reopen the live screen (simulating a reconnect) — confirm the full message history is
   still there (it survives via REST, not the WS nudge), and confirm reopening does NOT replay any
   toast/haptics/sound for the old messages (only genuinely new ones after that point should ever
   trigger delivery again).
