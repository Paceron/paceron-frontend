# Calendario de grupo — cableado + vista base del entrenador — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cablear el calendario de un grupo contra el backend real (listar rango, editar/borrar un día) y construir la vista mensual + pantalla de edición de un día individual, incluyendo marcar una sesión como presencial (reusando `LocationPicker`).

**Architecture:** TanStack Query para el estado de servidor (`useGroupCalendar`/`useGroupCalendarMutations`, mismo patrón que `hooks/use-sessions.js`), `react-native-calendars` para la grilla mensual con `dayComponent` custom (punto de color + ícono de pin), y una pantalla dedicada (no modal) para editar un día — evita anidar el `Modal` de `LocationPicker` dentro de otro `Modal`.

**Tech Stack:** React Native + Expo Router, `@tanstack/react-query`, `react-native-calendars`, `LocationPicker` ya construido (`components/shared/location-picker.jsx`/`.web.jsx`).

**Spec:** `docs/superpowers/specs/2026-09-19-group-calendar-design.md`

## Global Constraints

- Backend ya soporta `presencial_time_from`/`presencial_time_to` (`GroupCalendarDay`) y `default_time_from`/`default_time_to` (`PlanDay`) — Gap 6 resuelto, sin bloqueo. Guardar un día presencial funciona real de punta a punta.
- El backend **instancia** (copia congelada) la sesión al guardar un día `training` — la respuesta embebe `session_instance` (objeto), el request sigue mandando `session_id` (id de catálogo). Cada guardado reinstancia de cero, sin excepción — no hay forma de "conservar la instancia actual" hoy (Gap 7 abierto, `docs/BACKEND_API_GAPS.md`, sin bloquear esta pieza). Ver `docs/BACKEND_CALENDAR_ASSIGNMENTS_SPEC.md` §3.1bis.
- `react-native-calendars@1.1314.0` — 100% JS, sin módulo nativo, cero riesgo de incompatibilidad con Fabric/New Architecture.
- Todo `View`/`Text`/`Pressable`/`TextInput`/`Modal`/`ScrollView`/etc necesita `nativeID` y `testID` únicos (ESLint `local/require-native-id`, falla el lint si falta).
- Nunca importar `SelectField`/`PickerField` directo — siempre `ResponsiveSelectField` (ESLint `local/no-direct-select-field`).
- Todo `Modal` con backdrop cierra al click afuera: el elemento con `nativeID` terminado en `-backdrop` necesita `onPress` (ESLint `local/require-modal-backdrop-close`).
- Forms de edición de un recurso real: `useFormDirty` + `useUnsavedChangesGuard` + `bypassGuard(action)` al navegar tras un submit exitoso — nunca `router.back()`/`router.replace()` a mano tras guardar.
- `LocationPicker` se importa **sin extensión** (`from '../shared/location-picker'`) — así Metro resuelve `.jsx`/`.web.jsx` por plataforma (con extensión explícita, carga el archivo literal en cualquier plataforma).
- Sin tests de render de componentes (convención del proyecto) — solo los normalizers y el mock de calendario llevan test unitario nuevo.
- Sin verificación con herramientas de preview en este plan — la tarea final es `npm run lint` + `npm test`, más un script de test manual escrito para que el usuario verifique en web y mobile.

---

### Task 1: Normalizers de `GroupCalendarDay`

**Files:**
- Modify: `services/normalizers.js` (agregar al final del archivo)
- Test: `__tests__/normalizers.test.js` (agregar casos, no crear archivo nuevo)

**Interfaces:**
- Produces: `toGroupCalendarDayModel(dto) -> { id, groupId, date, kind, otherName, sessionInstance, cancelledReason, isPresencial, presencialTimeFrom, presencialTimeTo, presencialLocation, sourcePlanId }`, `toCalendarDayPayload(day) -> object` (snake_case, solo los campos que corresponden según `day.kind`).

**Nota — asimetría real, no error:** el backend instancia (copia congelada) la sesión al guardar un día `training` (`docs/BACKEND_CALENDAR_ASSIGNMENTS_SPEC.md` §3.1bis) — la respuesta embebe `session_instance` (objeto, sin vínculo de vuelta al catálogo), pero el `PUT` sigue esperando `session_id` (id de **catálogo**, un dato completamente distinto que sale del select de la pantalla de edición, Task 7). Por eso `toGroupCalendarDayModel` produce `sessionInstance` pero `toCalendarDayPayload` sigue tomando `day.sessionId` — no son la misma cosa ni deberían tener el mismo nombre de campo.

- [ ] **Step 1: Escribir los tests (van a fallar — las funciones no existen todavía)**

Agregar al final de `__tests__/normalizers.test.js`:

```js
import { toGroupCalendarDayModel, toCalendarDayPayload } from '../services/normalizers.js';

describe('toGroupCalendarDayModel', () => {
  test('mapea un día de descanso', () => {
    const dto = { id: 1, group_id: 5, date: '2026-10-05', kind: 'rest', is_presencial: false };
    expect(toGroupCalendarDayModel(dto)).toEqual({
      id: '1', groupId: '5', date: '2026-10-05', kind: 'rest',
      otherName: null, sessionInstance: null, cancelledReason: null,
      isPresencial: false, presencialTimeFrom: null, presencialTimeTo: null,
      presencialLocation: null, sourcePlanId: null,
    });
  });

  test('mapea un día presencial con sesión instanciada y ubicación', () => {
    const dto = {
      id: 2, group_id: 5, date: '2026-10-06', kind: 'training',
      session_instance: {
        id: 123, name: 'Fartlek 5K', description: null,
        exercises: [{ id: 456, name: 'Trote', role: 'warmup', repeat_count: 1, rest_minutes: 0 }],
      },
      is_presencial: true, presencial_time_from: '08:00', presencial_time_to: '09:30',
      presencial_location: { lat: -34.6, lng: -58.4, label: 'Plaza' }, source_plan_id: 3,
    };
    const model = toGroupCalendarDayModel(dto);
    expect(model.sessionInstance).toEqual({
      id: '123', name: 'Fartlek 5K', description: null,
      exercises: [{ id: '456', name: 'Trote', role: 'warmup', repeatCount: 1, restMinutes: 0 }],
    });
    expect(model.presencialTimeFrom).toBe('08:00');
    expect(model.presencialTimeTo).toBe('09:30');
    expect(model.presencialLocation).toEqual({ lat: -34.6, lng: -58.4, label: 'Plaza' });
    expect(model.sourcePlanId).toBe('3');
  });

  test('session_instance null (día sin sesión, ej. rest/other)', () => {
    const dto = { id: 3, group_id: 5, date: '2026-10-07', kind: 'other', other_name: 'Elongación', session_instance: null, is_presencial: false };
    expect(toGroupCalendarDayModel(dto).sessionInstance).toBeNull();
  });

  test('returns null for falsy dto', () => {
    expect(toGroupCalendarDayModel(null)).toBeNull();
  });
});

describe('toCalendarDayPayload', () => {
  test('día de descanso solo manda kind', () => {
    expect(toCalendarDayPayload({ kind: 'rest' })).toEqual({ kind: 'rest' });
  });

  test('otra actividad manda other_name', () => {
    expect(toCalendarDayPayload({ kind: 'other', otherName: 'Elongación' })).toEqual({
      kind: 'other', other_name: 'Elongación',
    });
  });

  test('entrenamiento no presencial manda session_id e is_presencial false, sin horarios/ubicación', () => {
    const payload = toCalendarDayPayload({ kind: 'training', sessionId: '9', isPresencial: false });
    expect(payload).toEqual({ kind: 'training', session_id: 9, is_presencial: false });
  });

  test('entrenamiento presencial manda horarios y ubicación', () => {
    const payload = toCalendarDayPayload({
      kind: 'training', sessionId: '9', isPresencial: true,
      presencialTimeFrom: '08:00', presencialTimeTo: '09:30',
      presencialLocation: { lat: -34.6, lng: -58.4, label: 'Plaza' },
    });
    expect(payload).toEqual({
      kind: 'training', session_id: 9, is_presencial: true,
      presencial_time_from: '08:00', presencial_time_to: '09:30',
      presencial_location: { lat: -34.6, lng: -58.4, label: 'Plaza' },
    });
  });

  test('cancelado manda solo cancelled_reason, sin session_id (el backend lo preserva)', () => {
    expect(toCalendarDayPayload({ kind: 'cancelled', cancelledReason: 'Lluvia' })).toEqual({
      kind: 'cancelled', cancelled_reason: 'Lluvia',
    });
  });
});
```

- [ ] **Step 2: Correr los tests, confirmar que fallan**

Run: `npm test -- normalizers.test.js`
Expected: FAIL — `toGroupCalendarDayModel`/`toCalendarDayPayload` no están exportados de `services/normalizers.js`.

- [ ] **Step 3: Implementar los normalizers**

Agregar al final de `services/normalizers.js` (después de `toSubscriptionModel`):

```js
// ---------------------------------------------------------------------
// Calendario de grupo (GroupCalendarDay) — ver
// docs/BACKEND_CALENDAR_ASSIGNMENTS_SPEC.md. IDs como string (mismo
// criterio que toSessionModel/toGroupModel) para evitar el bug de tipo
// ya documentado en CLAUDE.md ("IDs numéricos en bodies de request") —
// toCalendarDayPayload los vuelve a Number() donde el backend lo espera.
// ---------------------------------------------------------------------

// SessionInstance embebida (copia congelada, sin vínculo de vuelta al
// catálogo — ver docs/BACKEND_CALENDAR_ASSIGNMENTS_SPEC.md §3.1bis / Gap
// 7). NUNCA confundir con un id de catálogo — no sirve para preseleccionar
// el select de sesión al editar (ver utils/session-instance-match.js,
// Task 7).
function toSessionInstanceModel(dto) {
  if (!dto) return null;
  return {
    id: String(dto.id),
    name: dto.name,
    description: dto.description ?? null,
    exercises: (dto.exercises ?? []).map((e) => ({
      id: String(e.id),
      name: e.name,
      role: e.role,
      repeatCount: e.repeat_count ?? 1,
      restMinutes: e.rest_minutes ?? 0,
    })),
  };
}

export function toGroupCalendarDayModel(dto) {
  if (!dto) return null;
  return {
    id: String(dto.id),
    groupId: String(dto.group_id),
    date: dto.date,
    kind: dto.kind,
    otherName: dto.other_name ?? null,
    sessionInstance: toSessionInstanceModel(dto.session_instance),
    cancelledReason: dto.cancelled_reason ?? null,
    isPresencial: Boolean(dto.is_presencial),
    presencialTimeFrom: dto.presencial_time_from ?? null,
    presencialTimeTo: dto.presencial_time_to ?? null,
    presencialLocation: dto.presencial_location
      ? { lat: dto.presencial_location.lat, lng: dto.presencial_location.lng, label: dto.presencial_location.label ?? null }
      : null,
    sourcePlanId: dto.source_plan_id != null ? String(dto.source_plan_id) : null,
  };
}

// Manda solo los campos que corresponden según `kind` — mismo criterio
// que toPlanDayPayload, el servidor valida igual pero no hay que mandarle
// basura. `session_id` de un día cancelado NO se manda — el backend lo
// preserva del lado suyo (ver §3.1 de la spec: "si kind pasa a cancelled,
// se mantiene").
export function toCalendarDayPayload(day) {
  const payload = { kind: day.kind };

  if (day.kind === 'other') {
    payload.other_name = day.otherName;
  }

  if (day.kind === 'training') {
    payload.session_id = Number(day.sessionId);
    payload.is_presencial = Boolean(day.isPresencial);
    if (day.isPresencial) {
      payload.presencial_time_from = day.presencialTimeFrom;
      payload.presencial_time_to = day.presencialTimeTo;
      payload.presencial_location = day.presencialLocation
        ? { lat: day.presencialLocation.lat, lng: day.presencialLocation.lng, label: day.presencialLocation.label || null }
        : null;
    }
  }

  if (day.kind === 'cancelled') {
    payload.cancelled_reason = day.cancelledReason;
  }

  return payload;
}
```

- [ ] **Step 4: Correr los tests, confirmar que pasan**

Run: `npm test -- normalizers.test.js`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add services/normalizers.js __tests__/normalizers.test.js
git commit -m "feat(calendar): add GroupCalendarDay normalizers"
```

---

### Task 2: `services/calendar.js` + mock

**Files:**
- Create: `services/calendar.js`
- Create: `services/__mocks__/calendar-mock.js`
- Test: `__tests__/calendar-mock.test.js`

**Interfaces:**
- Consumes: `api` default export de `services/api.js` (`api.get`/`api.put`/`api.delete`), `USE_MOCKS` de `config/env.js`.
- Produces: `getGroupCalendar(groupId, from, to)`, `upsertCalendarDay(groupId, date, payload)`, `deleteCalendarDay(groupId, date)` — todas devuelven DTOs snake_case (sin normalizar, igual que `services/sessions.js`).

- [ ] **Step 1: Escribir el mock**

Crear `services/__mocks__/calendar-mock.js`. Arranca vacío (tabla dispersa del backend real: sin fila = día vacío). Para simular la instanciación real (`docs/BACKEND_CALENDAR_ASSIGNMENTS_SPEC.md` §3.1bis) importa `mockGetSession` de `sessions-mock.js` — al guardar `kind='training'` con `session_id`, "instancia" copiando nombre/descripción de esa sesión del catálogo mock, **siempre que llega `session_id`** (nunca conserva la instancia vieja, mismo comportamiento que el backend real hoy — Gap 7 pendiente). Los ejercicios de la instancia usan un nombre sintético (`Ejercicio <id>`) en vez de resolver contra `exercises-mock.js` — simplificación aceptable para un mock, alcanza para probar la UI sin triple cross-reference:

```js
import { mockGetSession } from './sessions-mock.js';

let mockCalendarDays = {};
let nextId = 1;
let nextInstanceId = 1000;

function keyFor(groupId, date) {
  return `${groupId}::${date}`;
}

async function instantiateSession(sessionId) {
  const catalogSession = await mockGetSession(sessionId);
  return {
    id: nextInstanceId++,
    name: catalogSession.name,
    description: catalogSession.description ?? null,
    exercises: catalogSession.exercises.map((e) => ({
      id: e.exercise_id,
      name: `Ejercicio ${e.exercise_id}`,
      role: e.role,
      repeat_count: e.repeat_count ?? 1,
      rest_minutes: e.rest_minutes ?? 0,
    })),
  };
}

export async function mockGetGroupCalendar(groupId, from, to) {
  return Object.values(mockCalendarDays).filter(
    (d) => String(d.group_id) === String(groupId) && d.date >= from && d.date <= to,
  );
}

export async function mockUpsertCalendarDay(groupId, date, payload) {
  const key = keyFor(groupId, date);
  const now = new Date().toISOString();
  const existing = mockCalendarDays[key];

  let sessionInstance = null;
  if (payload.kind === 'training' && payload.session_id != null) {
    sessionInstance = await instantiateSession(payload.session_id);
  } else if (payload.kind === 'cancelled') {
    sessionInstance = existing?.session_instance ?? null;
  }

  const day = {
    id: existing?.id ?? nextId++,
    group_id: Number(groupId),
    date,
    kind: payload.kind,
    other_name: payload.other_name ?? null,
    session_instance: sessionInstance,
    cancelled_reason: payload.cancelled_reason ?? null,
    is_presencial: payload.is_presencial ?? false,
    presencial_time_from: payload.presencial_time_from ?? null,
    presencial_time_to: payload.presencial_time_to ?? null,
    presencial_location: payload.presencial_location ?? null,
    source_plan_id: existing?.source_plan_id ?? null,
    created_at: existing?.created_at ?? now,
    updated_at: now,
  };
  mockCalendarDays[key] = day;
  return day;
}

export async function mockDeleteCalendarDay(groupId, date) {
  delete mockCalendarDays[keyFor(groupId, date)];
  return null;
}

export function __resetMockCalendar() {
  mockCalendarDays = {};
  nextId = 1;
  nextInstanceId = 1000;
}
```

- [ ] **Step 2: Escribir los tests del mock**

Crear `__tests__/calendar-mock.test.js`. Usa los ids de `sessions-mock.js` ya sembrados (`1` = "Fondo suave", `2` = "Series de velocidad" — ver `services/__mocks__/sessions-mock.js`):

```js
import {
  mockGetGroupCalendar, mockUpsertCalendarDay, mockDeleteCalendarDay, __resetMockCalendar,
} from '../services/__mocks__/calendar-mock.js';
import { __resetMockSessions } from '../services/__mocks__/sessions-mock.js';

beforeEach(() => {
  __resetMockCalendar();
  __resetMockSessions();
});

describe('calendar-mock', () => {
  test('mockGetGroupCalendar arranca vacío y filtra por grupo y rango de fechas', async () => {
    expect(await mockGetGroupCalendar(1, '2026-10-01', '2026-10-31')).toEqual([]);
    await mockUpsertCalendarDay(1, '2026-10-05', { kind: 'rest' });
    await mockUpsertCalendarDay(1, '2026-11-05', { kind: 'rest' });
    await mockUpsertCalendarDay(2, '2026-10-05', { kind: 'rest' });
    const octoberGroup1 = await mockGetGroupCalendar(1, '2026-10-01', '2026-10-31');
    expect(octoberGroup1).toHaveLength(1);
    expect(octoberGroup1[0].date).toBe('2026-10-05');
  });

  test('mockUpsertCalendarDay con kind=training instancia la sesión del catálogo', async () => {
    const day = await mockUpsertCalendarDay(1, '2026-10-05', {
      kind: 'training', session_id: 1, is_presencial: true,
      presencial_time_from: '08:00', presencial_time_to: '09:30',
      presencial_location: { lat: 1, lng: 2, label: 'Plaza' },
    });
    expect(day.kind).toBe('training');
    expect(day.session_instance.name).toBe('Fondo suave');
    expect(day.session_instance.exercises.length).toBeGreaterThan(0);
    expect(day.is_presencial).toBe(true);
    expect(day.presencial_time_from).toBe('08:00');
  });

  test('mockUpsertCalendarDay sobre un día existente actualiza en el mismo lugar (mismo id) y reinstancia', async () => {
    const first = await mockUpsertCalendarDay(1, '2026-10-05', { kind: 'training', session_id: 1 });
    const second = await mockUpsertCalendarDay(1, '2026-10-05', { kind: 'training', session_id: 2 });
    expect(second.id).toBe(first.id);
    expect(second.session_instance.id).not.toBe(first.session_instance.id);
    expect(second.session_instance.name).toBe('Series de velocidad');
  });

  test('mockUpsertCalendarDay a cancelled sin session_id en el payload preserva la instancia existente', async () => {
    await mockUpsertCalendarDay(1, '2026-10-05', { kind: 'training', session_id: 1 });
    const cancelled = await mockUpsertCalendarDay(1, '2026-10-05', { kind: 'cancelled', cancelled_reason: 'Lluvia' });
    expect(cancelled.kind).toBe('cancelled');
    expect(cancelled.session_instance).not.toBeNull();
    expect(cancelled.session_instance.name).toBe('Fondo suave');
    expect(cancelled.cancelled_reason).toBe('Lluvia');
  });

  test('mockUpsertCalendarDay con kind=rest no tiene session_instance', async () => {
    const day = await mockUpsertCalendarDay(1, '2026-10-05', { kind: 'rest' });
    expect(day.session_instance).toBeNull();
  });

  test('mockDeleteCalendarDay borra la fila', async () => {
    await mockUpsertCalendarDay(1, '2026-10-05', { kind: 'rest' });
    await mockDeleteCalendarDay(1, '2026-10-05');
    expect(await mockGetGroupCalendar(1, '2026-10-01', '2026-10-31')).toEqual([]);
  });
});
```

- [ ] **Step 3: Correr los tests, confirmar que pasan**

Run: `npm test -- calendar-mock.test.js`
Expected: PASS

- [ ] **Step 4: Escribir `services/calendar.js`**

Crear `services/calendar.js`:

```js
import api from './api.js';
import { USE_MOCKS } from '../config/env.js';
import {
  mockGetGroupCalendar,
  mockUpsertCalendarDay,
  mockDeleteCalendarDay,
} from './__mocks__/calendar-mock.js';

// Calendario de un grupo (GroupCalendarDay) — backend real desde
// 2026-09-19 (Gap 6 resuelto, ver docs/BACKEND_API_GAPS.md). Solo los 3
// endpoints de esta pieza (listar rango, upsert de un día, borrar un
// día) — stamp/bulk/bulk-clear/shift son de la pieza 2.

// GET /api/v1/groups/{id}/calendar?from=&to=.
export async function getGroupCalendar(groupId, from, to) {
  if (USE_MOCKS) return await mockGetGroupCalendar(groupId, from, to);
  const params = new URLSearchParams({ from, to });
  return await api.get(`/groups/${groupId}/calendar?${params.toString()}`);
}

// PUT /api/v1/groups/{id}/calendar/{date}.
export async function upsertCalendarDay(groupId, date, payload) {
  if (USE_MOCKS) return await mockUpsertCalendarDay(groupId, date, payload);
  return await api.put(`/groups/${groupId}/calendar/${date}`, payload);
}

// DELETE /api/v1/groups/{id}/calendar/{date}.
export async function deleteCalendarDay(groupId, date) {
  if (USE_MOCKS) return await mockDeleteCalendarDay(groupId, date);
  return await api.delete(`/groups/${groupId}/calendar/${date}`);
}
```

- [ ] **Step 5: Correr toda la suite, confirmar que sigue en verde**

Run: `npm test`
Expected: PASS (todos los tests, incluyendo los nuevos)

- [ ] **Step 6: Commit**

```bash
git add services/calendar.js services/__mocks__/calendar-mock.js __tests__/calendar-mock.test.js
git commit -m "feat(calendar): add calendar service with USE_MOCKS backend"
```

---

### Task 3: `hooks/use-group-calendar.js`

**Files:**
- Create: `hooks/use-group-calendar.js`

**Interfaces:**
- Consumes: `getGroupCalendar`/`upsertCalendarDay`/`deleteCalendarDay` de `services/calendar.js` (Task 2), `toGroupCalendarDayModel`/`toCalendarDayPayload` de `services/normalizers.js` (Task 1).
- Produces: `useGroupCalendar(groupId, from, to) -> { days: GroupCalendarDayModel[], loading, error }`, `useGroupCalendarMutations(groupId) -> { upsertDay: ({date, day}) => Promise<{success, day?, error?}>, isUpserting, deleteDay: ({date}) => Promise<{success, error?}>, isDeleting }`.

- [ ] **Step 1: Implementar el hook**

Crear `hooks/use-group-calendar.js`:

```js
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  getGroupCalendar as getGroupCalendarService,
  upsertCalendarDay as upsertCalendarDayService,
  deleteCalendarDay as deleteCalendarDayService,
} from '../services/calendar.js';
import { toGroupCalendarDayModel, toCalendarDayPayload } from '../services/normalizers.js';

// Calendario de un grupo — TanStack Query, mismo criterio que
// hooks/use-sessions.js. Se pide por rango (mes visible) — GroupCalendarDay
// es una tabla dispersa del lado del backend, sin fila = día vacío.
export function useGroupCalendar(groupId, from, to) {
  const query = useQuery({
    queryKey: ['group-calendar', groupId, from, to],
    queryFn: () => getGroupCalendarService(groupId, from, to).then((dtos) => dtos.map(toGroupCalendarDayModel)),
    enabled: Boolean(groupId && from && to),
  });
  return { days: query.data ?? [], loading: query.isLoading, error: query.error };
}

export function useGroupCalendarMutations(groupId) {
  const queryClient = useQueryClient();

  // Invalida por prefijo (sin from/to) — cualquier mes cacheado de este
  // grupo queda desactualizado, mismo criterio que ['sessions', ownerId].
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['group-calendar', groupId] });

  const upsertDayMutation = useMutation({
    mutationFn: async ({ date, day }) => {
      try {
        const updated = await upsertCalendarDayService(groupId, date, toCalendarDayPayload(day));
        return { success: true, day: toGroupCalendarDayModel(updated) };
      } catch (error) {
        return { success: false, error: error.message };
      }
    },
    onSuccess: (result) => { if (result.success) invalidate(); },
  });

  const deleteDayMutation = useMutation({
    mutationFn: async ({ date }) => {
      try {
        await deleteCalendarDayService(groupId, date);
        return { success: true };
      } catch (error) {
        return { success: false, error: error.message };
      }
    },
    onSuccess: (result) => { if (result.success) invalidate(); },
  });

  return {
    upsertDay: upsertDayMutation.mutateAsync,
    isUpserting: upsertDayMutation.isPending,
    deleteDay: deleteDayMutation.mutateAsync,
    isDeleting: deleteDayMutation.isPending,
  };
}
```

- [ ] **Step 2: Correr la suite completa y el lint**

Run: `npm test && npm run lint`
Expected: PASS en ambos (este archivo no tiene JSX, no lo toca la regla `require-native-id`)

- [ ] **Step 3: Commit**

```bash
git add hooks/use-group-calendar.js
git commit -m "feat(calendar): add useGroupCalendar query/mutations hook"
```

---

### Task 4: `TimeField` en `components/forms/fields.jsx`

**Files:**
- Modify: `components/forms/fields.jsx` (agregar después de `DateField`, antes de `InputField` — línea ~267 del archivo actual)

**Interfaces:**
- Produces: `TimeField({ label, value, onChange, onBlur, error, touched, disabled })` — `value`/`onChange` en formato `'HH:mm'` (string).

- [ ] **Step 1: Implementar `TimeField`**

Agregar en `components/forms/fields.jsx`, inmediatamente después del cierre de la función `DateField` (después de la línea `}` que cierra `DateField`, antes de `export function InputField`):

```jsx
// HH:mm <-> Date. Hermano de DateField (no una variante con prop de modo)
// — formato y validación de tiempo son distintos de fecha, y DateField ya
// está hardcodeado a mode="date"/DD-MM-AAAA.
function parseHHmm(value) {
  const m = /^(\d{2}):(\d{2})$/.exec(value || '');
  const date = new Date();
  if (!m) {
    date.setHours(0, 0, 0, 0);
    return date;
  }
  date.setHours(Number(m[1]), Number(m[2]), 0, 0);
  return date;
}

function formatHHmm(date) {
  const hh = String(date.getHours()).padStart(2, '0');
  const mm = String(date.getMinutes()).padStart(2, '0');
  return `${hh}:${mm}`;
}

export function TimeField({ label, value, onChange, onBlur, error, touched, disabled }) {
  const colors = useThemeColors();
  const { themeMode } = useThemeMode();
  const [pickerVisible, setPickerVisible] = useState(false);
  const slug = slugify(label);

  const borderClass = error
    ? 'border-red-400 bg-red-50 dark:border-red-800 dark:bg-slate-900'
    : touched
    ? 'border-primary bg-white dark:bg-slate-900'
    : 'border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900';

  if (isWeb) {
    return (
      <View className="mb-5" nativeID={`time-field-${slug}`} testID={`time-field-${slug}`}>
        <Text className={FIELD_LABEL} nativeID={`time-field-${slug}-label`} testID={`time-field-${slug}-label`}>{label}</Text>
        <View className="flex-row items-center gap-2" nativeID={`time-field-${slug}-row`} testID={`time-field-${slug}-row`}>
          <View className="flex-1 relative" nativeID={`time-field-${slug}-input-wrapper`} testID={`time-field-${slug}-input-wrapper`}>
            <input
              type="time"
              className={`${DATE_BASE} ${borderClass}`}
              value={value}
              onChange={(e) => onChange(e.target.value)}
              onBlur={onBlur}
              disabled={disabled}
            />
          </View>
        </View>
        <View className="h-5" nativeID={`time-field-${slug}-error-row`} testID={`time-field-${slug}-error-row`}>
          {error && <Text className="text-xs text-red-500 dark:text-red-400" nativeID={`time-field-${slug}-error`} testID={`time-field-${slug}-error`}>{error}</Text>}
        </View>
      </View>
    );
  }

  const handleChange = (event, selectedDate) => {
    if (Platform.OS === 'android') {
      setPickerVisible(false);
      onBlur?.();
    }
    if (selectedDate) onChange(formatHHmm(selectedDate));
  };

  const handleClose = () => {
    setPickerVisible(false);
    onBlur?.();
  };

  return (
    <View className="mb-5" nativeID={`time-field-${slug}`} testID={`time-field-${slug}`}>
      <Text className={FIELD_LABEL} nativeID={`time-field-${slug}-label`} testID={`time-field-${slug}-label`}>{label}</Text>
      <Pressable
        className={`h-12 flex-row items-center rounded-xl border px-4 hover:bg-slate-100 dark:hover:bg-slate-800 ${borderClass}`}
        disabled={disabled}
        onPress={() => setPickerVisible(true)}
        nativeID={`time-field-${slug}-trigger`}
        testID={`time-field-${slug}-trigger`}
      >
        <Text
          className={`flex-1 text-sm ${value ? 'text-slate-900 dark:text-white' : 'text-slate-400 dark:text-slate-500'}`}
          nativeID={`time-field-${slug}-value`}
          testID={`time-field-${slug}-value`}
        >
          {value || 'HH:mm'}
        </Text>
        <MaterialCommunityIcons color={colors.onSurfaceVariant} name="clock-outline" size={20} />
      </Pressable>
      <View className="h-5" nativeID={`time-field-${slug}-error-row`} testID={`time-field-${slug}-error-row`}>
        {error && <Text className="text-xs text-red-500 dark:text-red-400" nativeID={`time-field-${slug}-error`} testID={`time-field-${slug}-error`}>{error}</Text>}
      </View>

      {pickerVisible && Platform.OS === 'android' && (
        <DateTimePicker
          accentColor="#8cc63e"
          display="default"
          mode="time"
          onChange={handleChange}
          value={parseHHmm(value)}
        />
      )}

      {Platform.OS === 'ios' && (
        <Modal
          animationType="fade"
          onRequestClose={handleClose}
          transparent
          visible={pickerVisible}
          nativeID={`time-field-${slug}-modal`}
          testID={`time-field-${slug}-modal`}
        >
          <Pressable
            className="flex-1 justify-end bg-black/50"
            onPress={handleClose}
            nativeID={`time-field-${slug}-modal-backdrop`}
            testID={`time-field-${slug}-modal-backdrop`}
          >
            <Pressable
              className="rounded-t-2xl bg-white p-4 dark:bg-surface-2"
              onPress={() => {}}
              nativeID={`time-field-${slug}-modal-content`}
              testID={`time-field-${slug}-modal-content`}
            >
              <DateTimePicker
                display="inline"
                mode="time"
                onChange={handleChange}
                themeVariant={themeMode}
                value={parseHHmm(value)}
              />
              <Pressable
                className="mt-2 h-11 items-center justify-center rounded-full bg-primary hover:opacity-90 active:opacity-80"
                onPress={handleClose}
                nativeID={`time-field-${slug}-modal-done-button`}
                testID={`time-field-${slug}-modal-done-button`}
              >
                <Text
                  className="text-sm font-semibold uppercase tracking-wide text-[#111518]"
                  nativeID={`time-field-${slug}-modal-done-label`}
                  testID={`time-field-${slug}-modal-done-label`}
                >
                  Listo
                </Text>
              </Pressable>
            </Pressable>
          </Pressable>
        </Modal>
      )}
    </View>
  );
}
```

- [ ] **Step 2: Correr el lint**

Run: `npm run lint`
Expected: PASS (todos los tags nuevos ya llevan `nativeID`/`testID`)

- [ ] **Step 3: Commit**

```bash
git add components/forms/fields.jsx
git commit -m "feat(forms): add TimeField, sibling of DateField for HH:mm input"
```

---

### Task 5: Instalar `react-native-calendars` + config de locale

**Files:**
- Modify: `package.json` (dependencia nueva)
- Create: `config/calendarLocale.js`

**Interfaces:**
- Produces: side-effect import (`import '../../config/calendarLocale.js'`) que configura `LocaleConfig.defaultLocale = 'es'` antes de que se monte cualquier `Calendar`.

- [ ] **Step 1: Instalar la dependencia**

Run: `npm install react-native-calendars@1.1314.0`

- [ ] **Step 2: Crear la configuración de locale**

Crear `config/calendarLocale.js`:

```js
import { LocaleConfig } from 'react-native-calendars';

LocaleConfig.locales.es = {
  monthNames: ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'],
  monthNamesShort: ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'],
  dayNames: ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'],
  dayNamesShort: ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'],
  today: 'Hoy',
};
LocaleConfig.defaultLocale = 'es';
```

- [ ] **Step 3: Correr la suite completa**

Run: `npm test && npm run lint`
Expected: PASS (no rompe nada existente)

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json config/calendarLocale.js
git commit -m "chore(calendar): add react-native-calendars + es locale config"
```

---

### Task 6: Vista mensual del calendario de un grupo

**Files:**
- Create: `components/team/group-calendar-screen.jsx`
- Create: `app/(tabs)/teams/[teamId]/groups/[groupId]/calendar/index.jsx`

**Interfaces:**
- Consumes: `useGroups` (`hooks/use-groups.js`), `useGroupCalendar` (Task 3), `useUser`/`useAuthStore`, `RequireAuth` (`components/guards/require-auth.jsx`), `SkeletonBlock` (`components/shared/skeleton.jsx`), `config/calendarLocale.js` (Task 5, side-effect import).
- Produces: `GroupCalendarScreen({ teamId, groupId })` — pantalla exportada, montada por la ruta.

- [ ] **Step 1: Implementar la pantalla**

Crear `components/team/group-calendar-screen.jsx`:

```jsx
import { useMemo, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Calendar } from 'react-native-calendars';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import '../../config/calendarLocale.js';
import { useThemeColors } from '../../theme/colors.js';
import { isWeb } from '../../utils/platform.js';
import { useAuthStore } from '../../store/auth-store.js';
import { useUser } from '../../hooks/use-user.js';
import { useGroups } from '../../hooks/use-groups.js';
import { useGroupCalendar } from '../../hooks/use-group-calendar.js';
import { SkeletonBlock } from '../shared/skeleton.jsx';
import { RequireAuth } from '../guards/require-auth.jsx';

const KIND_DOT_COLORS = { rest: '#94a3b8', other: '#f59e0b', training: '#22c55e', cancelled: '#ef4444' };

function pad2(n) {
  return String(n).padStart(2, '0');
}

function monthRange(year, month) {
  const from = `${year}-${pad2(month)}-01`;
  const lastDay = new Date(year, month, 0).getDate();
  const to = `${year}-${pad2(month)}-${pad2(lastDay)}`;
  return { from, to };
}

function CalendarDayCell({ date, state, marking, onPress }) {
  const colors = useThemeColors();
  const isOtherMonth = state === 'disabled';
  return (
    <Pressable
      className="h-14 w-full items-center justify-start gap-1 pt-1"
      nativeID={`group-calendar-day-${date.dateString}`}
      onPress={() => onPress(date)}
      testID={`group-calendar-day-${date.dateString}`}
    >
      <Text
        className={`text-sm ${isOtherMonth ? 'text-slate-300 dark:text-slate-600' : state === 'today' ? 'font-bold text-primary' : 'text-slate-700 dark:text-slate-200'}`}
        nativeID={`group-calendar-day-${date.dateString}-label`}
        testID={`group-calendar-day-${date.dateString}-label`}
      >
        {date.day}
      </Text>
      {marking && (
        <View className="flex-row items-center gap-0.5" nativeID={`group-calendar-day-${date.dateString}-marks`} testID={`group-calendar-day-${date.dateString}-marks`}>
          <View
            nativeID={`group-calendar-day-${date.dateString}-dot`}
            style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: KIND_DOT_COLORS[marking.kind] }}
            testID={`group-calendar-day-${date.dateString}-dot`}
          />
          {marking.isPresencial && <MaterialCommunityIcons color={colors.primary} name="map-marker" size={10} />}
        </View>
      )}
    </Pressable>
  );
}

function GroupCalendarScreenContent({ teamId, groupId }) {
  const router = useRouter();
  const colors = useThemeColors();
  const userId = useAuthStore((s) => s.userId);
  const { user } = useUser(userId);
  const { groups, loading: loadingGroups } = useGroups(teamId, user?.userId);
  const group = groups.find((g) => g.id === groupId);

  const today = new Date();
  const [visibleYear, setVisibleYear] = useState(today.getFullYear());
  const [visibleMonth, setVisibleMonth] = useState(today.getMonth() + 1);
  const { from, to } = useMemo(() => monthRange(visibleYear, visibleMonth), [visibleYear, visibleMonth]);
  const { days, loading: loadingDays } = useGroupCalendar(groupId, from, to);

  const markingsByDate = useMemo(
    () => Object.fromEntries(days.map((d) => [d.date, { kind: d.kind, isPresencial: d.isPresencial }])),
    [days],
  );

  const handleDayPress = (date) => {
    router.push(`/teams/${teamId}/groups/${groupId}/calendar/${date.dateString}`);
  };

  if (loadingGroups) {
    return (
      <View className="flex-1 items-center justify-center bg-paper dark:bg-ink" nativeID="group-calendar-loading" testID="group-calendar-loading">
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  if (!group) {
    return (
      <View className="flex-1 items-center justify-center bg-paper px-6 dark:bg-ink" nativeID="group-calendar-not-found" testID="group-calendar-not-found">
        <Text className="mb-4 text-center text-sm text-slate-500 dark:text-slate-400" nativeID="group-calendar-not-found-label" testID="group-calendar-not-found-label">
          No encontramos este grupo.
        </Text>
        <Pressable
          className="h-11 flex-row items-center gap-2 rounded-full bg-primary px-6 active:opacity-80"
          nativeID="group-calendar-not-found-back-button"
          onPress={() => router.back()}
          testID="group-calendar-not-found-back-button"
        >
          <Text className="text-sm font-semibold uppercase tracking-wide text-[#111518]" nativeID="group-calendar-not-found-back-button-label" testID="group-calendar-not-found-back-button-label">
            Volver
          </Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-paper dark:bg-ink" nativeID="group-calendar-screen-root" testID="group-calendar-screen-root">
      <View className={`w-full flex-1 self-center px-4 py-8 ${isWeb ? 'max-w-3xl' : ''}`} nativeID="group-calendar-screen-container" testID="group-calendar-screen-container">
        <View className="mb-6 flex-row items-center gap-2" nativeID="group-calendar-screen-header" testID="group-calendar-screen-header">
          <Pressable
            className="flex-row items-center gap-1.5 py-1 pr-1 hover:opacity-70 active:opacity-70"
            nativeID="group-calendar-screen-back-button"
            onPress={() => router.back()}
            testID="group-calendar-screen-back-button"
          >
            <MaterialCommunityIcons color={colors.onSurfaceVariant} name="arrow-left" size={18} />
          </Pressable>
          <Text className="text-xl text-slate-900 dark:text-white" nativeID="group-calendar-screen-title" style={{ fontFamily: 'Orbitron_700Bold' }} testID="group-calendar-screen-title">
            Calendario de {group.name}
          </Text>
        </View>

        {loadingDays ? (
          <SkeletonBlock height={320} nativeID="group-calendar-skeleton" testID="group-calendar-skeleton" width="100%" />
        ) : (
          <View nativeID="group-calendar-month-view" testID="group-calendar-month-view">
            <Calendar
              dayComponent={({ date, state }) => (
                <CalendarDayCell date={date} marking={markingsByDate[date.dateString]} onPress={handleDayPress} state={state} />
              )}
              firstDay={1}
              onMonthChange={(month) => { setVisibleYear(month.year); setVisibleMonth(month.month); }}
              theme={{ textMonthFontFamily: 'Orbitron_700Bold' }}
            />
          </View>
        )}
      </View>
    </View>
  );
}

export function GroupCalendarScreen({ teamId, groupId }) {
  return (
    <RequireAuth>
      <GroupCalendarScreenContent teamId={teamId} groupId={groupId} />
    </RequireAuth>
  );
}
```

Nota: el import de `Modal` en este archivo no se usa — **no lo incluyas** en la lista de imports de `react-native` (a diferencia de la Task 7). Import real: `import { ActivityIndicator, Pressable, Text, View } from 'react-native';`.

- [ ] **Step 2: Crear la ruta**

Crear `app/(tabs)/teams/[teamId]/groups/[groupId]/calendar/index.jsx`:

```jsx
import { useLocalSearchParams } from 'expo-router';
import { GroupCalendarScreen } from '../../../../../../../components/team/group-calendar-screen.jsx';

export default function TeamGroupCalendar() {
  const { teamId, groupId } = useLocalSearchParams();
  return <GroupCalendarScreen groupId={groupId} teamId={teamId} />;
}
```

- [ ] **Step 3: Correr el lint**

Run: `npm run lint`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add "components/team/group-calendar-screen.jsx" "app/(tabs)/teams/[teamId]/groups/[groupId]/calendar/index.jsx"
git commit -m "feat(calendar): add group calendar month view"
```

---

### Task 7: Utilidad de match por nombre + pantalla de edición de un día

**Files:**
- Create: `utils/session-instance-match.js`
- Test: `__tests__/session-instance-match.test.js`
- Create: `components/team/group-calendar-day-screen.jsx`
- Create: `app/(tabs)/teams/[teamId]/groups/[groupId]/calendar/[date].jsx`

**Interfaces:**
- Consumes: `useGroups`, `useSessions` (`hooks/use-sessions.js`), `useGroupCalendar`/`useGroupCalendarMutations` (Task 3), `useFormDirty`/`useUnsavedChangesGuard`, `TimeField` (Task 4), `ResponsiveSelectField`, `LocationPicker` (importado **sin extensión**), `DiscardChangesModal`, `findMatchingCatalogSession` (este mismo Task, Step 1).
- Produces: `findMatchingCatalogSession(sessionInstance, sessions) -> session | null`, `GroupCalendarDayScreen({ teamId, groupId, date })` — pantalla exportada, montada por la ruta.

**Contexto — por qué existe esta utilidad:** el backend instancia (copia congelada) la sesión asignada a un día, y esa copia no tiene ninguna referencia de vuelta al catálogo (`docs/BACKEND_CALENDAR_ASSIGNMENTS_SPEC.md` §3.1bis, Gap 7 pendiente). Al editar un día ya asignado, no hay forma exacta de saber qué sesión de catálogo preseleccionar en el select — se usa un match por nombre como mejor esfuerzo, extraído a función pura para poder testearlo sin montar el componente.

- [ ] **Step 1: Escribir el test de la utilidad (va a fallar — el archivo no existe)**

Crear `__tests__/session-instance-match.test.js`:

```js
import { findMatchingCatalogSession } from '../utils/session-instance-match.js';

describe('findMatchingCatalogSession', () => {
  const sessions = [
    { id: '1', name: 'Fondo suave' },
    { id: '2', name: 'Series de velocidad' },
  ];

  test('devuelve la sesión del catálogo cuyo nombre coincide', () => {
    const match = findMatchingCatalogSession({ id: '99', name: 'Series de velocidad' }, sessions);
    expect(match).toEqual({ id: '2', name: 'Series de velocidad' });
  });

  test('devuelve null si no hay coincidencia (renombrada o borrada del catálogo)', () => {
    expect(findMatchingCatalogSession({ id: '99', name: 'Ya no existe' }, sessions)).toBeNull();
  });

  test('devuelve null si no hay instancia (día sin sesión asignada)', () => {
    expect(findMatchingCatalogSession(null, sessions)).toBeNull();
  });
});
```

- [ ] **Step 2: Correr el test, confirmar que falla**

Run: `npm test -- session-instance-match.test.js`
Expected: FAIL — el módulo `utils/session-instance-match.js` no existe.

- [ ] **Step 3: Implementar la utilidad**

Crear `utils/session-instance-match.js`:

```js
// Match por nombre (mejor esfuerzo) entre una SessionInstance ya congelada
// (sin referencia de vuelta al catálogo, ver
// docs/BACKEND_CALENDAR_ASSIGNMENTS_SPEC.md §3.1bis / Gap 7) y el catálogo
// actual del entrenador — permite preseleccionar el select de sesión al
// editar un día ya asignado, sin garantía de que sea "la misma" sesión si
// el catálogo cambió desde la asignación.
export function findMatchingCatalogSession(sessionInstance, sessions) {
  if (!sessionInstance) return null;
  return sessions.find((s) => s.name === sessionInstance.name) ?? null;
}
```

- [ ] **Step 4: Correr el test, confirmar que pasa**

Run: `npm test -- session-instance-match.test.js`
Expected: PASS

- [ ] **Step 5: Implementar la pantalla**

Crear `components/team/group-calendar-day-screen.jsx`:

```jsx
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import Toast from 'react-native-toast-message';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useThemeColors } from '../../theme/colors.js';
import { isWeb } from '../../utils/platform.js';
import { useAuthStore } from '../../store/auth-store.js';
import { useUser } from '../../hooks/use-user.js';
import { useGroups } from '../../hooks/use-groups.js';
import { useSessions } from '../../hooks/use-sessions.js';
import { useGroupCalendar, useGroupCalendarMutations } from '../../hooks/use-group-calendar.js';
import { useFormDirty } from '../../hooks/use-form-dirty.js';
import { useUnsavedChangesGuard } from '../../hooks/use-unsaved-changes-guard.js';
import { SectionCard } from '../forms/section-card.jsx';
import { InputField, TimeField } from '../forms/fields.jsx';
import { ResponsiveSelectField } from '../forms/responsive-select-field.jsx';
import { LocationPicker } from '../shared/location-picker';
import { DiscardChangesModal } from '../shared/discard-changes-modal.jsx';
import { RequireAuth } from '../guards/require-auth.jsx';
import { notifySuccess, notifyError, notifyWarning } from '../../utils/haptics.js';
import { findMatchingCatalogSession } from '../../utils/session-instance-match.js';

const KIND_OPTIONS = [
  { id: 'rest', label: 'Descanso' },
  { id: 'other', label: 'Otra actividad' },
  { id: 'training', label: 'Entrenamiento' },
];

function KindSelector({ value, onChange, disabled }) {
  return (
    <View className="mb-5 flex-row gap-2" nativeID="group-calendar-day-kind-selector" testID="group-calendar-day-kind-selector">
      {KIND_OPTIONS.map((opt) => {
        const selected = value === opt.id;
        return (
          <Pressable
            className={`flex-1 items-center rounded-xl border px-2 py-2.5 ${selected ? 'border-primary bg-primary-tint dark:bg-primary/15' : 'border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900'}`}
            disabled={disabled}
            key={opt.id}
            nativeID={`group-calendar-day-kind-${opt.id}`}
            onPress={() => onChange(opt.id)}
            testID={`group-calendar-day-kind-${opt.id}`}
          >
            <Text
              className={`text-xs font-semibold ${selected ? 'text-on-primary-tint dark:text-primary' : 'text-slate-600 dark:text-slate-300'}`}
              nativeID={`group-calendar-day-kind-${opt.id}-label`}
              testID={`group-calendar-day-kind-${opt.id}-label`}
            >
              {opt.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function PresencialToggle({ value, onChange, colors }) {
  return (
    <Pressable
      accessibilityLabel="¿Es presencial?"
      accessibilityRole="checkbox"
      accessibilityState={{ checked: value }}
      className="mb-4 flex-row items-center gap-3 py-1"
      nativeID="group-calendar-day-presencial-checkbox"
      onPress={() => onChange(!value)}
      testID="group-calendar-day-presencial-checkbox"
    >
      <View
        className={`h-5 w-5 items-center justify-center rounded border ${value ? 'border-primary bg-primary' : 'border-slate-300 dark:border-slate-600'}`}
        nativeID="group-calendar-day-presencial-checkbox-box"
        testID="group-calendar-day-presencial-checkbox-box"
      >
        {value && <MaterialCommunityIcons color={colors.onPrimary} name="check-bold" size={14} />}
      </View>
      <Text className="text-sm font-medium text-slate-900 dark:text-white" nativeID="group-calendar-day-presencial-checkbox-label" testID="group-calendar-day-presencial-checkbox-label">
        ¿Es presencial?
      </Text>
    </Pressable>
  );
}

function GroupCalendarDayScreenContent({ teamId, groupId, date }) {
  const router = useRouter();
  const colors = useThemeColors();
  const userId = useAuthStore((s) => s.userId);
  const { user } = useUser(userId);
  const { groups, loading: loadingGroups } = useGroups(teamId, user?.userId);
  const group = groups.find((g) => g.id === groupId);
  const { sessions, loading: loadingSessions } = useSessions(user?.userId);
  const { days, loading: loadingDay } = useGroupCalendar(groupId, date, date);
  const { upsertDay, isUpserting, deleteDay, isDeleting } = useGroupCalendarMutations(groupId);
  const existingDay = days[0] ?? null;

  const [kind, setKind] = useState('rest');
  const [otherName, setOtherName] = useState('');
  const [sessionId, setSessionId] = useState('');
  const [isPresencial, setIsPresencial] = useState(false);
  const [presencialTimeFrom, setPresencialTimeFrom] = useState('');
  const [presencialTimeTo, setPresencialTimeTo] = useState('');
  const [presencialLocation, setPresencialLocation] = useState(null);
  const [error, setError] = useState(null);
  const [cancelReason, setCancelReason] = useState('');
  const [cancelPromptVisible, setCancelPromptVisible] = useState(false);
  const [cancelling, setCancelling] = useState(false);

  // Solo semilla una vez, cuando el rango [date, date] Y el catálogo de
  // sesiones terminaron de cargar — no un useEffect que resincroniza en
  // cada render del objeto fuente (ver CLAUDE.md, bug real ya documentado
  // en edit-group-screen.jsx). Esperar también `loadingSessions`: el match
  // por nombre (findMatchingCatalogSession) necesita el catálogo ya
  // cargado, si sembrara antes de tiempo el select quedaría vacío para
  // siempre aunque el catálogo llegue un instante después.
  const seededRef = useRef(false);
  useEffect(() => {
    if (loadingDay || loadingSessions || seededRef.current) return;
    seededRef.current = true;
    if (existingDay) {
      setKind(existingDay.kind === 'cancelled' ? 'training' : existingDay.kind);
      setOtherName(existingDay.otherName ?? '');
      const matched = findMatchingCatalogSession(existingDay.sessionInstance, sessions);
      setSessionId(matched?.id ?? '');
      setIsPresencial(existingDay.isPresencial);
      setPresencialTimeFrom(existingDay.presencialTimeFrom ?? '');
      setPresencialTimeTo(existingDay.presencialTimeTo ?? '');
      setPresencialLocation(existingDay.presencialLocation ?? null);
    }
  }, [loadingDay, loadingSessions, existingDay, sessions]);

  const isDirty = useFormDirty({ kind, otherName, sessionId, isPresencial, presencialTimeFrom, presencialTimeTo, presencialLocation });
  const { confirmVisible, guardedClose, confirmDiscard, cancelDiscard, bypassGuard } = useUnsavedChangesGuard(isDirty);

  const clearError = () => { if (error) setError(null); };

  const handleSubmit = async () => {
    if (isUpserting) return;
    if (kind === 'other' && !otherName.trim()) {
      setError('Ingresá el nombre de la actividad.');
      return;
    }
    if (kind === 'training' && !sessionId) {
      setError('Elegí una sesión del catálogo.');
      return;
    }
    if (kind === 'training' && isPresencial) {
      if (!presencialTimeFrom || !presencialTimeTo) {
        setError('Cargá el horario de inicio y fin.');
        return;
      }
      if (presencialTimeTo <= presencialTimeFrom) {
        setError('El horario de fin debe ser posterior al de inicio.');
        return;
      }
      if (!presencialLocation) {
        setError('Elegí la ubicación del encuentro.');
        return;
      }
    }
    setError(null);

    const day = { kind, otherName, sessionId, isPresencial: kind === 'training' && isPresencial, presencialTimeFrom, presencialTimeTo, presencialLocation };
    const result = await upsertDay({ date, day });
    if (!result.success) {
      notifyError();
      Toast.show({ type: 'error', text1: 'No pudimos guardar el día', text2: result.error });
      return;
    }
    notifySuccess();
    Toast.show({ type: 'success', text1: 'Día guardado' });
    bypassGuard(() => router.back());
  };

  const handleClear = async () => {
    const result = await deleteDay({ date });
    if (!result.success) {
      notifyError();
      Toast.show({ type: 'error', text1: 'No pudimos vaciar el día', text2: result.error });
      return;
    }
    notifySuccess();
    Toast.show({ type: 'success', text1: 'Día vaciado' });
    bypassGuard(() => router.back());
  };

  const handleOpenCancelPrompt = () => {
    notifyWarning();
    setCancelPromptVisible(true);
  };

  const handleConfirmCancel = async () => {
    if (!cancelReason.trim()) return;
    setCancelling(true);
    const result = await upsertDay({ date, day: { kind: 'cancelled', cancelledReason: cancelReason.trim() } });
    setCancelling(false);
    setCancelPromptVisible(false);
    if (!result.success) {
      notifyError();
      Toast.show({ type: 'error', text1: 'No pudimos cancelar la sesión', text2: result.error });
      return;
    }
    notifySuccess();
    Toast.show({ type: 'success', text1: 'Sesión cancelada' });
    bypassGuard(() => router.back());
  };

  const sessionOptions = sessions.map((s) => ({ id: s.id, name: s.name }));
  const canCancelSession = existingDay?.kind === 'training';

  if (loadingGroups || loadingDay) {
    return (
      <View className="flex-1 items-center justify-center bg-paper dark:bg-ink" nativeID="group-calendar-day-loading" testID="group-calendar-day-loading">
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  if (!group) {
    return (
      <View className="flex-1 items-center justify-center bg-paper px-6 dark:bg-ink" nativeID="group-calendar-day-not-found" testID="group-calendar-day-not-found">
        <Text className="mb-4 text-center text-sm text-slate-500 dark:text-slate-400" nativeID="group-calendar-day-not-found-label" testID="group-calendar-day-not-found-label">
          No encontramos este grupo.
        </Text>
        <Pressable
          className="h-11 flex-row items-center gap-2 rounded-full bg-primary px-6 active:opacity-80"
          nativeID="group-calendar-day-not-found-back-button"
          onPress={() => router.back()}
          testID="group-calendar-day-not-found-back-button"
        >
          <Text className="text-sm font-semibold uppercase tracking-wide text-[#111518]" nativeID="group-calendar-day-not-found-back-button-label" testID="group-calendar-day-not-found-back-button-label">
            Volver
          </Text>
        </Pressable>
      </View>
    );
  }

  return (
    <>
      <ScrollView
        className="flex-1 bg-paper dark:bg-ink"
        contentContainerClassName="px-4 py-8"
        nativeID="group-calendar-day-screen-scroll"
        showsVerticalScrollIndicator={false}
        testID="group-calendar-day-screen-scroll"
      >
        <View className={`w-full self-center ${isWeb ? 'max-w-3xl' : ''}`} nativeID="group-calendar-day-screen-container" testID="group-calendar-day-screen-container">
          <View className="mb-8 flex-row items-center gap-2" nativeID="group-calendar-day-screen-header" testID="group-calendar-day-screen-header">
            <Pressable
              className="flex-row items-center gap-1.5 py-1 pr-1 hover:opacity-70 active:opacity-70"
              nativeID="group-calendar-day-screen-back-button"
              onPress={() => guardedClose(() => router.back())}
              testID="group-calendar-day-screen-back-button"
            >
              <MaterialCommunityIcons color={colors.onSurfaceVariant} name="arrow-left" size={18} />
            </Pressable>
            <Text className="text-xl text-slate-900 dark:text-white" nativeID="group-calendar-day-screen-title" style={{ fontFamily: 'Orbitron_700Bold' }} testID="group-calendar-day-screen-title">
              {date}
            </Text>
          </View>

          <SectionCard icon="calendar-blank-outline" title={`Día de ${group.name}`}>
            <KindSelector disabled={isUpserting} onChange={(v) => { setKind(v); clearError(); }} value={kind} />

            {error && (
              <Text className="mb-4 text-xs text-red-500 dark:text-red-400" nativeID="group-calendar-day-error" testID="group-calendar-day-error">{error}</Text>
            )}

            {kind === 'other' && (
              <InputField dense label="Nombre de la actividad" onChange={(text) => { setOtherName(text); clearError(); }} placeholder="Ej. Elongación" value={otherName} />
            )}

            {kind === 'training' && (
              <>
                {existingDay?.sessionInstance && (
                  <View
                    className="mb-4 rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-900"
                    nativeID="group-calendar-day-current-session"
                    testID="group-calendar-day-current-session"
                  >
                    <Text
                      className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400"
                      nativeID="group-calendar-day-current-session-label"
                      testID="group-calendar-day-current-session-label"
                    >
                      Sesión asignada actualmente
                    </Text>
                    <Text
                      className="mt-1 text-sm font-medium text-slate-900 dark:text-white"
                      nativeID="group-calendar-day-current-session-name"
                      testID="group-calendar-day-current-session-name"
                    >
                      {existingDay.sessionInstance.name}
                    </Text>
                    {existingDay.sessionInstance.description && (
                      <Text
                        className="mt-0.5 text-xs text-slate-500 dark:text-slate-400"
                        nativeID="group-calendar-day-current-session-description"
                        testID="group-calendar-day-current-session-description"
                      >
                        {existingDay.sessionInstance.description}
                      </Text>
                    )}
                  </View>
                )}
                <Text
                  className="mb-2 text-xs text-slate-500 dark:text-slate-400"
                  nativeID="group-calendar-day-session-hint"
                  testID="group-calendar-day-session-hint"
                >
                  Guardar siempre vuelve a instanciar la sesión elegida (una copia congelada, no un vínculo vivo) — aunque sea la misma.
                </Text>
                <ResponsiveSelectField dense label="Sesión del catálogo" onChange={(v) => { setSessionId(v); clearError(); }} options={sessionOptions} placeholder="Elegí una sesión" value={sessionId} />
                <PresencialToggle colors={colors} onChange={setIsPresencial} value={isPresencial} />
                {isPresencial && (
                  <>
                    <TimeField label="Hora desde" onChange={(v) => { setPresencialTimeFrom(v); clearError(); }} value={presencialTimeFrom} />
                    <TimeField label="Hora hasta" onChange={(v) => { setPresencialTimeTo(v); clearError(); }} value={presencialTimeTo} />
                    <View className="mb-5" nativeID="group-calendar-day-location-wrapper" testID="group-calendar-day-location-wrapper">
                      <LocationPicker onChange={(v) => { setPresencialLocation(v); clearError(); }} value={presencialLocation} />
                    </View>
                  </>
                )}
              </>
            )}

            <Pressable
              className={`h-12 flex-row items-center justify-center gap-2 rounded-full bg-primary hover:opacity-90 active:opacity-80 ${isUpserting ? 'opacity-60' : ''}`}
              disabled={isUpserting}
              nativeID="group-calendar-day-save-button"
              onPress={handleSubmit}
              testID="group-calendar-day-save-button"
            >
              {isUpserting ? (
                <ActivityIndicator color={colors.onPrimary} />
              ) : (
                <>
                  <MaterialCommunityIcons color={colors.onPrimary} name="check" size={18} />
                  <Text className="text-sm font-semibold uppercase tracking-wide text-[#111518]" nativeID="group-calendar-day-save-button-label" testID="group-calendar-day-save-button-label">
                    Guardar
                  </Text>
                </>
              )}
            </Pressable>

            {canCancelSession && (
              <Pressable
                className="mt-3 h-12 flex-row items-center justify-center gap-2 rounded-full border border-amber-400 hover:bg-amber-50 active:opacity-80 dark:border-amber-700 dark:hover:bg-amber-900/20"
                nativeID="group-calendar-day-cancel-session-button"
                onPress={handleOpenCancelPrompt}
                testID="group-calendar-day-cancel-session-button"
              >
                <MaterialCommunityIcons color="#d97706" name="calendar-remove-outline" size={18} />
                <Text className="text-sm font-semibold text-amber-700 dark:text-amber-400" nativeID="group-calendar-day-cancel-session-button-label" testID="group-calendar-day-cancel-session-button-label">
                  Cancelar esta sesión
                </Text>
              </Pressable>
            )}

            {existingDay && (
              <Pressable
                className={`mt-3 h-12 flex-row items-center justify-center gap-2 rounded-full border border-red-300 hover:bg-red-50 active:opacity-80 dark:border-red-800 dark:hover:bg-red-900/20 ${isDeleting ? 'opacity-60' : ''}`}
                disabled={isDeleting}
                nativeID="group-calendar-day-clear-button"
                onPress={handleClear}
                testID="group-calendar-day-clear-button"
              >
                {isDeleting ? (
                  <ActivityIndicator color="#ef4444" />
                ) : (
                  <>
                    <MaterialCommunityIcons color="#ef4444" name="trash-can-outline" size={18} />
                    <Text className="text-sm font-semibold text-red-600 dark:text-red-400" nativeID="group-calendar-day-clear-button-label" testID="group-calendar-day-clear-button-label">
                      Vaciar día
                    </Text>
                  </>
                )}
              </Pressable>
            )}
          </SectionCard>
        </View>
      </ScrollView>

      <Modal
        animationType="fade"
        nativeID="group-calendar-day-cancel-prompt-modal"
        onRequestClose={() => setCancelPromptVisible(false)}
        testID="group-calendar-day-cancel-prompt-modal"
        transparent
        visible={cancelPromptVisible}
      >
        <Pressable
          className="flex-1 items-center justify-center bg-black/50 px-4"
          nativeID="group-calendar-day-cancel-prompt-backdrop"
          onPress={() => setCancelPromptVisible(false)}
          testID="group-calendar-day-cancel-prompt-backdrop"
        >
          <Pressable
            className="w-full max-w-md rounded-2xl border border-amber-300 bg-white p-6 shadow-xl dark:border-amber-900/50 dark:bg-surface"
            nativeID="group-calendar-day-cancel-prompt-card"
            onPress={() => {}}
            testID="group-calendar-day-cancel-prompt-card"
          >
            <Text className="mb-3 text-lg font-bold text-amber-700 dark:text-amber-400" nativeID="group-calendar-day-cancel-prompt-title" testID="group-calendar-day-cancel-prompt-title">
              Cancelar sesión
            </Text>
            <InputField dense label="Motivo" multiline numberOfLines={2} onChange={setCancelReason} placeholder="Ej. Lluvia" value={cancelReason} />
            <View className="flex-row gap-3" nativeID="group-calendar-day-cancel-prompt-actions" testID="group-calendar-day-cancel-prompt-actions">
              <Pressable
                className="h-11 flex-1 items-center justify-center rounded-full border border-slate-200 hover:bg-slate-100 active:opacity-70 dark:border-slate-700 dark:hover:bg-slate-800"
                nativeID="group-calendar-day-cancel-prompt-cancel-button"
                onPress={() => setCancelPromptVisible(false)}
                testID="group-calendar-day-cancel-prompt-cancel-button"
              >
                <Text className="text-sm font-semibold text-slate-700 dark:text-slate-200" nativeID="group-calendar-day-cancel-prompt-cancel-label" testID="group-calendar-day-cancel-prompt-cancel-label">
                  Volver
                </Text>
              </Pressable>
              <Pressable
                className={`h-11 flex-1 items-center justify-center rounded-full bg-amber-600 hover:opacity-90 active:opacity-80 ${cancelling || !cancelReason.trim() ? 'opacity-60' : ''}`}
                disabled={cancelling || !cancelReason.trim()}
                nativeID="group-calendar-day-cancel-prompt-confirm-button"
                onPress={handleConfirmCancel}
                testID="group-calendar-day-cancel-prompt-confirm-button"
              >
                {cancelling ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text className="text-sm font-semibold uppercase tracking-wide text-white" nativeID="group-calendar-day-cancel-prompt-confirm-label" testID="group-calendar-day-cancel-prompt-confirm-label">
                    Confirmar
                  </Text>
                )}
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      <DiscardChangesModal onCancel={cancelDiscard} onConfirm={confirmDiscard} visible={confirmVisible} />
    </>
  );
}

export function GroupCalendarDayScreen({ teamId, groupId, date }) {
  return (
    <RequireAuth>
      <GroupCalendarDayScreenContent date={date} groupId={groupId} teamId={teamId} />
    </RequireAuth>
  );
}
```

- [ ] **Step 6: Crear la ruta**

Crear `app/(tabs)/teams/[teamId]/groups/[groupId]/calendar/[date].jsx`:

```jsx
import { useLocalSearchParams } from 'expo-router';
import { GroupCalendarDayScreen } from '../../../../../../../components/team/group-calendar-day-screen.jsx';

export default function TeamGroupCalendarDay() {
  const { teamId, groupId, date } = useLocalSearchParams();
  return <GroupCalendarDayScreen date={date} groupId={groupId} teamId={teamId} />;
}
```

- [ ] **Step 7: Correr toda la suite y el lint**

Run: `npm test && npm run lint`
Expected: PASS en ambos

- [ ] **Step 8: Commit**

```bash
git add "utils/session-instance-match.js" "__tests__/session-instance-match.test.js" "components/team/group-calendar-day-screen.jsx" "app/(tabs)/teams/[teamId]/groups/[groupId]/calendar/[date].jsx"
git commit -m "feat(calendar): add session-instance match helper + group calendar day edit screen"
```

---

### Task 8: Entrada de navegación "Ver calendario" en `GroupRow`

**Files:**
- Modify: `components/team/team-detail-screen.jsx`

**Interfaces:**
- Consumes: `GroupCalendarScreen`'s ruta (`/teams/{teamId}/groups/{groupId}/calendar`), ya creada en Task 6.

- [ ] **Step 1: Agregar el prop `onViewCalendar` a `GroupRow` y el botón**

En `components/team/team-detail-screen.jsx`, reemplazar la firma de `GroupRow` (línea 401):

```jsx
function GroupRow({ group, members, planName, colors, onEdit, canEdit, onDelete, deleting, onViewCalendar, canManageTeam }) {
```

Reemplazar el bloque `editButton` (líneas 431-453) por:

```jsx
  const actions = canManageTeam && (
    <View className="flex-row items-center gap-1" nativeID={`team-detail-group-${group.id}-actions`} testID={`team-detail-group-${group.id}-actions`}>
      <Pressable
        accessibilityLabel={`Ver calendario de ${group.name}`}
        className="rounded-full p-1.5 hover:bg-slate-200 dark:hover:bg-slate-800"
        nativeID={`team-detail-group-${group.id}-calendar-button`}
        onPress={onViewCalendar}
        testID={`team-detail-group-${group.id}-calendar-button`}
      >
        <MaterialCommunityIcons color={colors.onSurfaceVariant} name="calendar-month-outline" size={18} />
      </Pressable>
      {canEdit && (
        <Pressable
          accessibilityLabel={`Editar grupo ${group.name}`}
          className="rounded-full p-1.5 hover:bg-slate-200 dark:hover:bg-slate-800"
          nativeID={`team-detail-group-${group.id}-edit-button`}
          onPress={onEdit}
          testID={`team-detail-group-${group.id}-edit-button`}
        >
          <MaterialCommunityIcons color={colors.onSurfaceVariant} name="pencil-outline" size={18} />
        </Pressable>
      )}
      {canEdit && (
        <Pressable
          accessibilityLabel={`Eliminar grupo ${group.name}`}
          className="rounded-full p-1.5 hover:bg-slate-200 dark:hover:bg-slate-800"
          disabled={deleting}
          nativeID={`team-detail-group-${group.id}-delete-button`}
          onPress={onDelete}
          testID={`team-detail-group-${group.id}-delete-button`}
        >
          {deleting ? <ActivityIndicator color={colors.onSurfaceVariant} size="small" /> : <MaterialCommunityIcons color={colors.onSurfaceVariant} name="trash-can-outline" size={18} />}
        </Pressable>
      )}
    </View>
  );
```

Reemplazar las 2 apariciones de `{editButton}` (una en la rama web, una en la rama mobile de `GroupRow`, líneas ~485 y ~509) por `{actions}`.

- [ ] **Step 2: Pasar los props nuevos desde el caller**

En el mismo archivo, dentro de `gruposContent` (alrededor de la línea 938), agregar `onViewCalendar` y `canManageTeam` al `<GroupRow>`:

```jsx
          <GroupRow
            canEdit={canManageTeam && !group.isDefault}
            canManageTeam={canManageTeam}
            colors={colors}
            deleting={deletingGroupId === group.id}
            group={group}
            key={group.id}
            members={members.filter((m) => m.groupId === group.id)}
            onDelete={() => setGroupPendingDelete(group)}
            onEdit={() => router.push(`/teams/${team.id}/groups/${group.id}/edit`)}
            onViewCalendar={() => router.push(`/teams/${team.id}/groups/${group.id}/calendar`)}
            planName={TRAINING_PLAN_OPTIONS.find((p) => p.id === group.trainingPlanId)?.name}
          />
```

- [ ] **Step 3: Correr el lint**

Run: `npm run lint`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add components/team/team-detail-screen.jsx
git commit -m "feat(calendar): wire 'Ver calendario' action into GroupRow"
```

---

### Task 9: Verificación final + script de test manual

**Files:** ninguno (solo verificación)

- [ ] **Step 1: Correr la suite completa y el lint**

Run: `npm test && npm run lint`
Expected: ambos en verde (0 fallos, 0 errores de lint)

- [ ] **Step 2: Entregar el script de test manual**

No hay verificación con herramientas de preview en este plan (convención del usuario: método más barato en tokens). Al terminar la Task 9, la respuesta final al usuario debe incluir este script de test manual, para que lo corra él mismo en web y en mobile:

```
1. Ir a un equipo (como entrenador, rol activo "trainer") → pestaña "Grupos".
2. Confirmar que cada fila de grupo (incluido "Sin grupo") tiene un ícono
   de calendario nuevo, al lado de editar/borrar.
3. Tocar el ícono de calendario → confirmar que navega a la vista mensual
   (nombre del grupo en el header, grilla del mes actual, botón de volver).
4. Navegar al mes anterior/siguiente con las flechas del calendario →
   confirmar que no rompe nada (al principio, todos los días vacíos, sin
   puntos de color).
5. Tocar un día vacío → confirmar que navega a la pantalla de edición
   (fecha en el header, selector Descanso/Otra actividad/Entrenamiento,
   sin botón "Vaciar día" ni "Cancelar esta sesión").
6. Elegir "Descanso" → Guardar → confirmar toast de éxito y que vuelve al
   mes → confirmar que ese día ahora tiene un punto gris.
7. Volver a entrar a ese mismo día → confirmar que carga "Descanso" ya
   seleccionado, y que ahora SÍ aparece "Vaciar día" (sin "Cancelar esta
   sesión", eso es solo para entrenamiento).
8. Cambiar a "Otra actividad" sin escribir nombre → Guardar → confirmar
   que aparece el error "Ingresá el nombre de la actividad." sin navegar.
   Completar el nombre → Guardar → confirmar éxito, punto ámbar en el mes.
9. Ir a un día nuevo, elegir "Entrenamiento" sin elegir sesión → Guardar →
   confirmar error "Elegí una sesión del catálogo.". Elegir una sesión del
   catálogo → Guardar → confirmar éxito, punto verde en el mes.
10. Volver a entrar a ese mismo día → confirmar que aparece el bloque
    "Sesión asignada actualmente" (nombre real de la sesión) Y que el
    select de abajo quedó preseleccionado con esa misma sesión (match por
    nombre — ver docs/BACKEND_API_GAPS.md Gap 7 para el porqué de esta
    limitación). Guardar sin tocar nada → confirmar que igual funciona
    (reinstancia la misma sesión, comportamiento esperado hoy).
11. En ese mismo día, activar "¿Es presencial?" → confirmar que aparecen
    2 campos de hora (desde/hasta) + el LocationPicker. Guardar sin cargar
    nada → confirmar error de horario. Cargar hora desde 08:00, hasta
    07:00 (invertido) → confirmar error "El horario de fin debe ser
    posterior al de inicio.". Corregir a hasta 09:30, elegir una ubicación
    con el mapa → Guardar → confirmar éxito.
12. Volver a entrar a ese día presencial → confirmar que el punto ahora
    tiene también el ícono de pin superpuesto, y que al editar vuelven a
    cargar la hora/ubicación ya guardadas (además del bloque de sesión
    actual y el select preseleccionado, del paso 10).
13. En un día "Entrenamiento" ya guardado, tocar "Cancelar esta sesión" →
    confirmar que pide un motivo obligatorio (el botón de confirmar está
    deshabilitado hasta escribir algo) → confirmar → confirmar éxito y que
    el punto pasa a rojo.
14. Tocar "Vaciar día" en cualquier día con contenido → confirmar que
    borra y el punto desaparece del mes.
15. Cargar cualquier campo, intentar salir (back o navegar afuera) sin
    guardar → confirmar que aparece el modal "Salir sin guardar" y que
    "Continuar" cancela la salida.
16. Repetir los pasos 3, 5, 6, 9 y 11 en mobile (Expo dev client) — el
    LocationPicker y el picker nativo de hora (TimeField) solo se pueden
    verificar ahí, no en el preview web.
```

---
