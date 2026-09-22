# Calendario de asignaciones — Selección múltiple + acciones en lote Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> **Execution note:** el usuario pidió el método más barato en tokens en toda esta serie de piezas. Salvo instrucción nueva en contrario, preferir `superpowers:executing-plans` (inline) sobre `subagent-driven-development`.

**Goal:** modo de selección múltiple sobre la grilla del calendario (entrada desde el menú de día, ya implementado), con dos acciones en lote — vaciar y editar (mismo contenido para todas las fechas seleccionadas).

**Architecture:** un `Set<string>` de fechas seleccionadas en `group-calendar-screen.jsx`, con una regla pura (`canAddToSelection`) que fija la selección a una sola "clase" (cerrada o abierta) desde el primer día marcado. El header se reemplaza por contador + 3 botones-ícono mientras el modo está activo. "Editar en lote" abre un modal nuevo (`BulkEditDaysModal`) que reusa `CalendarDayFields` (ya existente) para un solo contenido aplicado a todas las fechas vía el endpoint `bulk` del backend.

**Tech Stack:** React Native + Expo Router, TanStack Query, Jest para lógica pura.

**Spec:** `docs/superpowers/specs/2026-09-21-calendar-multi-select-design.md`

## Global Constraints

- Todo `View`/`Text`/`Pressable`/`Modal`/etc necesita `nativeID`+`testID` únicos en su contexto.
- Todo `<Modal>` con backdrop cierra al click afuera (regla `local/require-modal-backdrop-close`).
- `npm test`/`npm run lint` en verde antes de cada commit.
- **Resolución de una ambigüedad que el spec dejó abierta (§5):** no se agrega un booleano `selectionMode` separado — el modo está activo si y solo si `selectedDates.size > 0` (la entrada siempre pre-selecciona un día, así que ese estado intermedio "modo activo, nada seleccionado" nunca ocurre en la práctica; una sola fuente de verdad es más simple).
- **Resolución de otra ambigüedad (spec §4, "confirmación simple"):** revisando el precedente real, "Vaciar día" individual (`group-calendar-day-screen.jsx#handleClear`) NO tiene ningún modal de confirmación — ejecuta directo. "Vaciar en lote" sigue el MISMO precedente exacto (ejecuta directo al tocar el ícono, sin modal de confirmación) — el texto del spec fue impreciso en este punto, este plan sigue el comportamiento real ya establecido, no lo que decía el spec.
- El selector de sesión de `BulkEditDaysModal` NUNCA ofrece `KEEP_CURRENT_SESSION` — cada fecha del lote puede tener una sesión actual distinta (o ninguna), "mantener la actual" no tiene un significado único aplicable a todas a la vez. `currentSessionInstance` que recibe `CalendarDayFields` es siempre `null` en este modal (mismo criterio ya usado en `stamp-plan-modal.jsx`).

---

### Task 1: `canAddToSelection` (regla pura de clase de selección)

**Files:**
- Create: `utils/calendar-selection.js`
- Create: `__tests__/calendar-selection.test.js`

**Interfaces:**
- Consumes: nada.
- Produces: `canAddToSelection(currentClosedClass: boolean | null, candidateClosed: boolean) -> boolean`. Consumido por Task 7 (`group-calendar-screen.jsx`).

- [ ] **Step 1: Escribir el test**

```js
// __tests__/calendar-selection.test.js
import { canAddToSelection } from '../utils/calendar-selection.js';

describe('canAddToSelection', () => {
  test('con selección vacía (null), siempre se puede agregar', () => {
    expect(canAddToSelection(null, true)).toBe(true);
    expect(canAddToSelection(null, false)).toBe(true);
  });

  test('con clase cerrada fijada, solo se pueden agregar días cerrados', () => {
    expect(canAddToSelection(true, true)).toBe(true);
    expect(canAddToSelection(true, false)).toBe(false);
  });

  test('con clase abierta fijada, solo se pueden agregar días abiertos', () => {
    expect(canAddToSelection(false, false)).toBe(true);
    expect(canAddToSelection(false, true)).toBe(false);
  });
});
```

- [ ] **Step 2: Correr el test, debe fallar**

Run: `npx jest calendar-selection`
Expected: FAIL — `Cannot find module '../utils/calendar-selection.js'`

- [ ] **Step 3: Implementar**

```js
// utils/calendar-selection.js
// Regla de "una sola clase por selección" del modo multi-selección del
// calendario (docs/superpowers/specs/2026-09-21-calendar-multi-select-design.md
// §3) — la selección entera es de días cerrados o de días abiertos/futuros,
// nunca mezcla. `currentClosedClass` es el estado `closed` del primer día
// ya seleccionado (`null` si la selección está vacía, en cuyo caso
// cualquier día puede arrancarla).
export function canAddToSelection(currentClosedClass, candidateClosed) {
  if (currentClosedClass === null) return true;
  return candidateClosed === currentClosedClass;
}
```

- [ ] **Step 4: Correr el test, debe pasar**

Run: `npx jest calendar-selection`
Expected: PASS (3/3)

- [ ] **Step 5: Commit**

```bash
git add utils/calendar-selection.js __tests__/calendar-selection.test.js
git commit -m "feat(calendar): add canAddToSelection pure rule for multi-select"
```

---

### Task 2: `toBulkAssignPayload` en `services/normalizers.js`

**Files:**
- Modify: `services/normalizers.js`
- Modify: `__tests__/normalizers.test.js`

**Interfaces:**
- Consumes: `toCalendarDayPayload(day)` (ya existente, sin cambios).
- Produces: `toBulkAssignPayload({ dates, day }) -> { dates: string[], kind, ...resto de toCalendarDayPayload }`. Consumido por Task 4 (`hooks/use-group-calendar.js`).

- [ ] **Step 1: Escribir los tests**

Agregar a `__tests__/normalizers.test.js`, junto a los tests de `toCalendarDayPayload` ya existentes:

```js
import { toBulkAssignPayload } from '../services/normalizers.js';

describe('toBulkAssignPayload', () => {
  test('arma el body de bulk-assign: dates + el mismo shape que toCalendarDayPayload', () => {
    const payload = toBulkAssignPayload({
      dates: ['2026-10-05', '2026-10-06'],
      day: { kind: 'rest' },
    });
    expect(payload).toEqual({ dates: ['2026-10-05', '2026-10-06'], kind: 'rest' });
  });

  test('con un día de entrenamiento presencial, incluye horario y ubicación', () => {
    const payload = toBulkAssignPayload({
      dates: ['2026-10-05'],
      day: {
        kind: 'training', sessionId: '9', isPresencial: true,
        presencialTimeFrom: '08:00', presencialTimeTo: '09:30',
        presencialLocation: { lat: -34.6, lng: -58.4, label: 'Plaza' },
      },
    });
    expect(payload).toEqual({
      dates: ['2026-10-05'], kind: 'training', session_id: 9, is_presencial: true,
      presencial_time_from: '08:00', presencial_time_to: '09:30',
      presencial_location: { lat: -34.6, lng: -58.4, label: 'Plaza' },
    });
  });
});
```

- [ ] **Step 2: Correr el test, debe fallar**

Run: `npx jest normalizers.test.js -t toBulkAssignPayload`
Expected: FAIL — `toBulkAssignPayload is not a function`

- [ ] **Step 3: Implementar**

Agregar en `services/normalizers.js`, después de `toStampPayload`:

```js
// Body de POST /groups/{id}/calendar/bulk — mismo shape por-día que
// toCalendarDayPayload, con `dates` agregado (el backend aplica el mismo
// contenido a todas las fechas listadas).
export function toBulkAssignPayload({ dates, day }) {
  return { dates, ...toCalendarDayPayload(day) };
}
```

- [ ] **Step 4: Correr el test, debe pasar**

Run: `npx jest normalizers.test.js`
Expected: PASS (todos, incluidos los ya existentes)

- [ ] **Step 5: Commit**

```bash
git add services/normalizers.js __tests__/normalizers.test.js
git commit -m "feat(calendar): add toBulkAssignPayload normalizer"
```

---

### Task 3: `bulkAssignDays`/`bulkClearDays` en `services/calendar.js` + mocks

**Files:**
- Modify: `services/calendar.js`
- Modify: `services/__mocks__/calendar-mock.js`
- Modify: `__tests__/calendar-mock.test.js`

**Interfaces:**
- Consumes: `mockUpsertCalendarDay`/`mockDeleteCalendarDay` (ya existentes en el mismo archivo, sin cambios de firma).
- Produces: `bulkAssignDays(groupId, payload) -> Promise<GroupCalendarDayDTO[]>`, `bulkClearDays(groupId, dates) -> Promise<null>`. Consumidos por Task 4.

- [ ] **Step 1: Escribir los tests del mock**

Agregar a `__tests__/calendar-mock.test.js`:

```js
import { mockBulkAssignDays, mockBulkClearDays } from '../services/__mocks__/calendar-mock.js';

describe('mockBulkAssignDays', () => {
  test('aplica el mismo contenido a todas las fechas listadas', async () => {
    const result = await mockBulkAssignDays(1, { dates: ['2026-10-05', '2026-10-06'], kind: 'rest' });
    expect(result).toHaveLength(2);
    expect(result.every((d) => d.kind === 'rest')).toBe(true);
    expect(await mockGetGroupCalendar(1, '2026-10-01', '2026-10-31')).toHaveLength(2);
  });

  test('con kind=training instancia la sesión en cada fecha', async () => {
    const result = await mockBulkAssignDays(1, { dates: ['2026-10-05', '2026-10-06'], kind: 'training', session_id: 1 });
    expect(result.every((d) => d.session_instance?.name === 'Fondo suave')).toBe(true);
  });
});

describe('mockBulkClearDays', () => {
  test('borra todas las fechas listadas', async () => {
    await mockUpsertCalendarDay(1, '2026-10-05', { kind: 'rest' });
    await mockUpsertCalendarDay(1, '2026-10-06', { kind: 'rest' });
    await mockBulkClearDays(1, ['2026-10-05', '2026-10-06']);
    expect(await mockGetGroupCalendar(1, '2026-10-01', '2026-10-31')).toEqual([]);
  });
});
```

- [ ] **Step 2: Correr los tests, deben fallar**

Run: `npx jest calendar-mock.test.js -t "mockBulkAssignDays|mockBulkClearDays"`
Expected: FAIL — `mockBulkAssignDays is not a function`

- [ ] **Step 3: Implementar los mocks**

Agregar en `services/__mocks__/calendar-mock.js`, después de `mockStampPlan`:

```js
export async function mockBulkAssignDays(groupId, { dates, ...payload }) {
  const results = [];
  for (const date of dates) {
    results.push(await mockUpsertCalendarDay(groupId, date, payload));
  }
  return results;
}

export async function mockBulkClearDays(groupId, dates) {
  for (const date of dates) {
    await mockDeleteCalendarDay(groupId, date);
  }
  return null;
}
```

- [ ] **Step 4: Correr los tests, deben pasar**

Run: `npx jest calendar-mock.test.js`
Expected: PASS (todos, incluidos los ya existentes de piezas anteriores)

- [ ] **Step 5: Agregar `bulkAssignDays`/`bulkClearDays` reales a `services/calendar.js`**

Editar el import:
```js
import {
  mockGetGroupCalendar,
  mockUpsertCalendarDay,
  mockDeleteCalendarDay,
  mockStampPlan,
} from './__mocks__/calendar-mock.js';
```
por:
```js
import {
  mockGetGroupCalendar,
  mockUpsertCalendarDay,
  mockDeleteCalendarDay,
  mockStampPlan,
  mockBulkAssignDays,
  mockBulkClearDays,
} from './__mocks__/calendar-mock.js';
```

Agregar al final del archivo:
```js
// POST /api/v1/groups/{id}/calendar/bulk.
export async function bulkAssignDays(groupId, payload) {
  if (USE_MOCKS) return await mockBulkAssignDays(groupId, payload);
  return await api.post(`/groups/${groupId}/calendar/bulk`, payload);
}

// POST /api/v1/groups/{id}/calendar/bulk-clear.
export async function bulkClearDays(groupId, dates) {
  if (USE_MOCKS) return await mockBulkClearDays(groupId, dates);
  return await api.post(`/groups/${groupId}/calendar/bulk-clear`, { dates });
}
```

- [ ] **Step 6: Commit**

```bash
git add services/calendar.js services/__mocks__/calendar-mock.js __tests__/calendar-mock.test.js
git commit -m "feat(calendar): add bulkAssignDays/bulkClearDays service + mocks"
```

---

### Task 4: `bulkAssign`/`bulkClear` en `useGroupCalendarMutations`

**Files:**
- Modify: `hooks/use-group-calendar.js`

**Interfaces:**
- Consumes: `bulkAssignDays`/`bulkClearDays` (Task 3), `toBulkAssignPayload` (Task 2).
- Produces: `useGroupCalendarMutations(groupId)` gana `bulkAssign: ({ dates, day }) => Promise<{ success: boolean, days?, error? }>`, `isBulkAssigning: boolean`, `bulkClear: ({ dates }) => Promise<{ success: boolean, error? }>`, `isBulkClearing: boolean`. Consumidos por Task 6 (`BulkEditDaysModal`) y Task 7 (`group-calendar-screen.jsx`).

- [ ] **Step 1: Editar imports**

```js
import {
  getGroupCalendar as getGroupCalendarService,
  upsertCalendarDay as upsertCalendarDayService,
  deleteCalendarDay as deleteCalendarDayService,
  stampPlan as stampPlanService,
  bulkAssignDays as bulkAssignDaysService,
  bulkClearDays as bulkClearDaysService,
} from '../services/calendar.js';
import { toGroupCalendarDayModel, toCalendarDayPayload, toStampPayload, toBulkAssignPayload } from '../services/normalizers.js';
```

- [ ] **Step 2: Agregar las mutaciones**

Agregar dentro de `useGroupCalendarMutations`, después de `stampPlanMutation`:

```js
  const bulkAssignMutation = useMutation({
    mutationFn: async ({ dates, day }) => {
      try {
        const updated = await bulkAssignDaysService(groupId, toBulkAssignPayload({ dates, day }));
        return { success: true, days: updated.map(toGroupCalendarDayModel) };
      } catch (error) {
        return { success: false, error: error.message };
      }
    },
    onSuccess: (result) => { if (result.success) invalidate(); },
  });

  const bulkClearMutation = useMutation({
    mutationFn: async ({ dates }) => {
      try {
        await bulkClearDaysService(groupId, dates);
        return { success: true };
      } catch (error) {
        return { success: false, error: error.message };
      }
    },
    onSuccess: (result) => { if (result.success) invalidate(); },
  });
```

Y en el `return`:
```js
  return {
    upsertDay: upsertDayMutation.mutateAsync,
    isUpserting: upsertDayMutation.isPending,
    deleteDay: deleteDayMutation.mutateAsync,
    isDeleting: deleteDayMutation.isPending,
    stampPlan: stampPlanMutation.mutateAsync,
    isStamping: stampPlanMutation.isPending,
    bulkAssign: bulkAssignMutation.mutateAsync,
    isBulkAssigning: bulkAssignMutation.isPending,
    bulkClear: bulkClearMutation.mutateAsync,
    isBulkClearing: bulkClearMutation.isPending,
  };
```

- [ ] **Step 3: Verificar**

Run: `npm test && npm run lint`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add hooks/use-group-calendar.js
git commit -m "feat(calendar): add bulkAssign/bulkClear mutations"
```

---

### Task 5: "Seleccionar" en `CalendarDayMenu`

**Files:**
- Modify: `components/team/calendar-day-menu.jsx`

**Interfaces:**
- Consumes: nada nuevo.
- Produces: `CalendarDayMenu` gana la prop `onSelect: () => void` (ítem siempre visible, sin condición — cualquier día puede arrancar una selección). Consumido por Task 7.

- [ ] **Step 1: Editar la firma y agregar el ítem**

Ubicar:
```jsx
export function CalendarDayMenu({ hasContent, closed, isTraining, onAssignOrEdit, onClear, onCancel }) {
```
Reemplazar por:
```jsx
export function CalendarDayMenu({ hasContent, closed, isTraining, onAssignOrEdit, onClear, onCancel, onSelect }) {
```

Ubicar el cierre del panel:
```jsx
      {isTraining && (
        <Pressable
          className="flex-row items-center gap-2 px-3 py-2 hover:bg-slate-100 active:opacity-70 dark:hover:bg-slate-800"
          nativeID="calendar-day-menu-cancel"
          onPress={onCancel}
          testID="calendar-day-menu-cancel"
        >
          <MaterialCommunityIcons color="#d97706" name="calendar-remove-outline" size={16} />
          <Text className="text-sm text-amber-700 dark:text-amber-400" nativeID="calendar-day-menu-cancel-label" testID="calendar-day-menu-cancel-label">
            Cancelar sesión
          </Text>
        </Pressable>
      )}
    </View>
  );
}
```
Reemplazar por (agrega "Seleccionar" siempre, al final):
```jsx
      {isTraining && (
        <Pressable
          className="flex-row items-center gap-2 px-3 py-2 hover:bg-slate-100 active:opacity-70 dark:hover:bg-slate-800"
          nativeID="calendar-day-menu-cancel"
          onPress={onCancel}
          testID="calendar-day-menu-cancel"
        >
          <MaterialCommunityIcons color="#d97706" name="calendar-remove-outline" size={16} />
          <Text className="text-sm text-amber-700 dark:text-amber-400" nativeID="calendar-day-menu-cancel-label" testID="calendar-day-menu-cancel-label">
            Cancelar sesión
          </Text>
        </Pressable>
      )}

      <Pressable
        className="flex-row items-center gap-2 px-3 py-2 hover:bg-slate-100 active:opacity-70 dark:hover:bg-slate-800"
        nativeID="calendar-day-menu-select"
        onPress={onSelect}
        testID="calendar-day-menu-select"
      >
        <MaterialCommunityIcons color="#64748b" name="checkbox-marked-outline" size={16} />
        <Text className="text-sm text-slate-700 dark:text-slate-200" nativeID="calendar-day-menu-select-label" testID="calendar-day-menu-select-label">
          Seleccionar
        </Text>
      </Pressable>
    </View>
  );
}
```

- [ ] **Step 2: Verificar**

Run: `npm run lint`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add components/team/calendar-day-menu.jsx
git commit -m "feat(calendar): add Seleccionar item to CalendarDayMenu"
```

---

### Task 6: `BulkEditDaysModal`

**Files:**
- Create: `components/team/bulk-edit-days-modal.jsx`

**Interfaces:**
- Consumes: `CalendarDayFields` (contrato de props exacto ya establecido, ver `components/team/calendar-day-fields.jsx`), `useSessions(ownerId)` (ya existente), `useGroupCalendarMutations(groupId)` (Task 4, `bulkAssign`/`isBulkAssigning`), `useFormDirty`/`useUnsavedChangesGuard`/`DiscardChangesModal` (ya existentes, mismo patrón que `stamp-plan-modal.jsx`).
- Produces: `BulkEditDaysModal({ visible, onClose, onSuccess, groupId, ownerId, dates })`. `onClose` se llama SIEMPRE que el modal se cierra (cancelar o backdrop) — NO implica que la edición se haya aplicado. `onSuccess` se llama SOLO tras un `bulkAssign` exitoso, ANTES de `onClose` — el caller (Task 7) usa `onSuccess` para saber cuándo vaciar la selección (cancelar no debería vaciarla, el usuario podría querer intentar otra acción sobre la misma selección).

- [ ] **Step 1: Crear el archivo**

```jsx
import { useRef, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, Text, View } from 'react-native';
import Toast from 'react-native-toast-message';
import { useThemeColors } from '../../theme/colors.js';
import { useSessions } from '../../hooks/use-sessions.js';
import { useGroupCalendarMutations } from '../../hooks/use-group-calendar.js';
import { useFormDirty } from '../../hooks/use-form-dirty.js';
import { useUnsavedChangesGuard } from '../../hooks/use-unsaved-changes-guard.js';
import { DiscardChangesModal } from '../shared/discard-changes-modal.jsx';
import { CalendarDayFields } from './calendar-day-fields.jsx';
import { notifySuccess, notifyError } from '../../utils/haptics.js';

// Modal de "editar en lote" — un solo kind/contenido aplicado a TODAS
// las fechas seleccionadas de una (mapea directo al bulk-assign del
// backend, ver docs/superpowers/specs/2026-09-21-calendar-multi-select-design.md
// §4). Nunca ofrece KEEP_CURRENT_SESSION en el selector de sesión — cada
// fecha del lote puede tener una sesión actual distinta o ninguna,
// "mantener la actual" no tiene un significado único acá.
export function BulkEditDaysModal({ visible, onClose, onSuccess, groupId, ownerId, dates }) {
  const colors = useThemeColors();
  const { sessions } = useSessions(ownerId);
  const { bulkAssign, isBulkAssigning } = useGroupCalendarMutations(groupId);

  const [kind, setKind] = useState('rest');
  const [otherName, setOtherName] = useState('');
  const [sessionId, setSessionId] = useState('');
  const [isPresencial, setIsPresencial] = useState(false);
  const [presencialTimeFrom, setPresencialTimeFrom] = useState('');
  const [presencialTimeTo, setPresencialTimeTo] = useState('');
  const [presencialLocation, setPresencialLocation] = useState(null);
  const [error, setError] = useState(null);

  const resetKey = visible;
  const prevResetKeyRef = useRef(resetKey);
  if (resetKey !== prevResetKeyRef.current) {
    prevResetKeyRef.current = resetKey;
    setKind('rest');
    setOtherName('');
    setSessionId('');
    setIsPresencial(false);
    setPresencialTimeFrom('');
    setPresencialTimeTo('');
    setPresencialLocation(null);
    setError(null);
  }

  const isDirty = useFormDirty({ kind, otherName, sessionId, isPresencial, presencialTimeFrom, presencialTimeTo, presencialLocation }, resetKey);
  const { confirmVisible, guardedClose, confirmDiscard, cancelDiscard } = useUnsavedChangesGuard(isDirty);

  const clearError = () => { if (error) setError(null); };
  const sessionOptions = sessions.map((s) => ({ id: s.id, name: s.name }));

  const handleSubmit = async () => {
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
    const result = await bulkAssign({ dates, day });
    if (!result.success) {
      notifyError();
      Toast.show({ type: 'error', text1: 'No pudimos editar los días', text2: result.error });
      return;
    }
    notifySuccess();
    Toast.show({ type: 'success', text1: `${dates.length} día${dates.length === 1 ? '' : 's'} actualizados` });
    onSuccess();
    onClose();
  };

  const handleClose = () => guardedClose(onClose);

  return (
    <>
      <Modal animationType="fade" nativeID="bulk-edit-days-modal" onRequestClose={handleClose} testID="bulk-edit-days-modal" transparent visible={visible}>
        <Pressable className="flex-1 items-center justify-center bg-black/50 px-4" nativeID="bulk-edit-days-modal-backdrop" onPress={handleClose} testID="bulk-edit-days-modal-backdrop">
          <Pressable
            className="max-h-[85%] w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-4 shadow-xl dark:border-slate-700 dark:bg-surface"
            nativeID="bulk-edit-days-modal-card"
            onPress={() => {}}
            testID="bulk-edit-days-modal-card"
          >
            <Text className="mb-2 text-lg font-bold text-slate-900 dark:text-white" nativeID="bulk-edit-days-modal-title" testID="bulk-edit-days-modal-title">
              Editar {dates.length} día{dates.length === 1 ? '' : 's'}
            </Text>

            {error && (
              <Text className="mb-2 text-xs text-red-500 dark:text-red-400" nativeID="bulk-edit-days-modal-error" testID="bulk-edit-days-modal-error">{error}</Text>
            )}

            <CalendarDayFields
              currentSessionInstance={null}
              disabled={isBulkAssigning}
              idPrefix="bulk-edit-days"
              isPresencial={isPresencial}
              kind={kind}
              onIsPresencialChange={setIsPresencial}
              onKindChange={(v) => { setKind(v); clearError(); }}
              onOtherNameChange={(text) => { setOtherName(text); clearError(); }}
              onPresencialLocationChange={(v) => { setPresencialLocation(v); clearError(); }}
              onPresencialTimeFromChange={(v) => { setPresencialTimeFrom(v); clearError(); }}
              onPresencialTimeToChange={(v) => { setPresencialTimeTo(v); clearError(); }}
              onSessionIdChange={(v) => { setSessionId(v); clearError(); }}
              otherName={otherName}
              presencialLocation={presencialLocation}
              presencialTimeFrom={presencialTimeFrom}
              presencialTimeTo={presencialTimeTo}
              sessionId={sessionId}
              sessionOptions={sessionOptions}
            />

            <Pressable
              className={`mt-2 h-11 flex-row items-center justify-center gap-2 rounded-full bg-primary hover:opacity-90 active:opacity-80 ${isBulkAssigning ? 'opacity-60' : ''}`}
              disabled={isBulkAssigning}
              nativeID="bulk-edit-days-modal-save-button"
              onPress={handleSubmit}
              testID="bulk-edit-days-modal-save-button"
            >
              {isBulkAssigning ? (
                <ActivityIndicator color={colors.onPrimary} size="small" />
              ) : (
                <Text className="text-sm font-semibold uppercase tracking-wide text-[#111518]" nativeID="bulk-edit-days-modal-save-button-label" testID="bulk-edit-days-modal-save-button-label">
                  Guardar
                </Text>
              )}
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>

      <DiscardChangesModal onCancel={cancelDiscard} onConfirm={confirmDiscard} visible={confirmVisible} />
    </>
  );
}
```

- [ ] **Step 2: Verificar**

Run: `npm run lint`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add components/team/bulk-edit-days-modal.jsx
git commit -m "feat(calendar): add BulkEditDaysModal"
```

---

### Task 7: Wirear selección múltiple en `group-calendar-screen.jsx`

**Files:**
- Modify: `components/team/group-calendar-screen.jsx`

**Interfaces:**
- Consumes: `canAddToSelection` (Task 1), `bulkClear`/`isBulkClearing` de `useGroupCalendarMutations` (Task 4), `onSelect` de `CalendarDayMenu` (Task 5), `BulkEditDaysModal` (Task 6).
- Produces: nada consumido después — última pieza de código de este plan.

- [ ] **Step 1: Editar imports**

Ubicar:
```js
import { isCalendarDayClosed } from '../../utils/calendar-day-closed.js';
import { StampPlanModal } from './stamp-plan-modal.jsx';
import { CalendarDayMenu } from './calendar-day-menu.jsx';
import { AnimatedDropdown } from '../shared/animated-dropdown.jsx';
import { notifySuccess, notifyError } from '../../utils/haptics.js';
import { RequireAuth } from '../guards/require-auth.jsx';
```
Reemplazar por:
```js
import { isCalendarDayClosed } from '../../utils/calendar-day-closed.js';
import { canAddToSelection } from '../../utils/calendar-selection.js';
import { StampPlanModal } from './stamp-plan-modal.jsx';
import { CalendarDayMenu } from './calendar-day-menu.jsx';
import { BulkEditDaysModal } from './bulk-edit-days-modal.jsx';
import { AnimatedDropdown } from '../shared/animated-dropdown.jsx';
import { notifySuccess, notifyError } from '../../utils/haptics.js';
import { RequireAuth } from '../guards/require-auth.jsx';
```

- [ ] **Step 2: Editar `CalendarDayCell` — selección**

Ubicar la firma y el cuerpo hasta el `return`:
```jsx
function CalendarDayCell({ date, state, marking, containerRef, onOpenMenu, isMenuOpen }) {
  const colors = useThemeColors();
  const cellRef = useRef(null);
  const isOtherMonth = state === 'disabled';
  const closed = marking ? isCalendarDayClosed(date.dateString, marking) : false;
  // Tinte leve de fondo por kind — ayuda a ubicar de un vistazo qué tipo
  // de día es sin tener que fijarse en el puntito. Alpha en hex (últimos
  // 2 dígitos) en vez de un color plano — funciona igual en claro/oscuro
  // sin necesitar una paleta de tinte aparte por tema.
  const tintAlpha = closed ? '14' : '26';
  const tintColor = marking ? `${KIND_DOT_COLORS[marking.kind]}${tintAlpha}` : 'transparent';

  const handlePress = () => {
    if (!containerRef.current || !cellRef.current) return;
    containerRef.current.measureInWindow((containerX, containerY) => {
      cellRef.current?.measureInWindow((x, y, width, height) => {
        onOpenMenu(date.dateString, { x: x - containerX, y: y - containerY, width, height });
      });
    });
  };

  return (
    <Pressable
      ref={cellRef}
      className={`h-14 w-full items-center justify-start gap-1 rounded-md border pt-1 ${isMenuOpen ? 'border-primary' : 'border-transparent'}`}
      nativeID={`group-calendar-day-${date.dateString}`}
      onPress={handlePress}
      style={{ backgroundColor: tintColor }}
      testID={`group-calendar-day-${date.dateString}`}
    >
```
Reemplazar por:
```jsx
function CalendarDayCell({ date, state, marking, containerRef, onOpenMenu, isMenuOpen, selectionActive, selectionClosedClass, selected, onToggleSelect }) {
  const colors = useThemeColors();
  const cellRef = useRef(null);
  const isOtherMonth = state === 'disabled';
  const closed = marking ? isCalendarDayClosed(date.dateString, marking) : false;
  // Estado de "cerrado" para la REGLA DE SELECCIÓN — a diferencia de
  // `closed` de arriba (que solo importa para el tinte y siempre da
  // false en un día vacío), acá sí necesitamos el valor real incluso sin
  // contenido: un día vacío del mes pasado igual cuenta como "cerrado" a
  // los fines de no mezclarlo con una selección de días futuros.
  const closedForSelection = isCalendarDayClosed(date.dateString, marking ?? {});
  const canSelect = !selectionActive || selected || canAddToSelection(selectionClosedClass, closedForSelection);
  // Tinte leve de fondo por kind — ayuda a ubicar de un vistazo qué tipo
  // de día es sin tener que fijarse en el puntito. Alpha en hex (últimos
  // 2 dígitos) en vez de un color plano — funciona igual en claro/oscuro
  // sin necesitar una paleta de tinte aparte por tema.
  const tintAlpha = closed ? '14' : '26';
  const tintColor = marking ? `${KIND_DOT_COLORS[marking.kind]}${tintAlpha}` : 'transparent';

  const handlePress = () => {
    if (selectionActive) {
      if (!canSelect) return;
      onToggleSelect(date.dateString);
      return;
    }
    if (!containerRef.current || !cellRef.current) return;
    containerRef.current.measureInWindow((containerX, containerY) => {
      cellRef.current?.measureInWindow((x, y, width, height) => {
        onOpenMenu(date.dateString, { x: x - containerX, y: y - containerY, width, height });
      });
    });
  };

  const borderClass = selected ? 'border-2 border-primary' : isMenuOpen ? 'border border-primary' : 'border border-transparent';

  return (
    <Pressable
      ref={cellRef}
      className={`h-14 w-full items-center justify-start gap-1 rounded-md pt-1 ${borderClass}`}
      nativeID={`group-calendar-day-${date.dateString}`}
      onPress={handlePress}
      style={{ backgroundColor: tintColor, opacity: selectionActive && !canSelect ? 0.35 : 1 }}
      testID={`group-calendar-day-${date.dateString}`}
    >
```
El resto del cuerpo de `CalendarDayCell` (el `<Text>` del número, el bloque `{marking && (...)}`) queda exactamente igual.

- [ ] **Step 3: Estado de selección y handlers en `GroupCalendarScreenContent`**

Ubicar:
```js
  const { days, loading: loadingDays, isFetching } = useGroupCalendar(groupId, from, to);
  const { deleteDay } = useGroupCalendarMutations(groupId);
  const currentMonthISO = `${visibleYear}-${pad2(visibleMonth)}-01`;
  const monthViewRef = useRef(null);
  const [openDayMenu, setOpenDayMenu] = useState(null);
```
Reemplazar por:
```js
  const { days, loading: loadingDays, isFetching } = useGroupCalendar(groupId, from, to);
  const { deleteDay, bulkClear } = useGroupCalendarMutations(groupId);
  const currentMonthISO = `${visibleYear}-${pad2(visibleMonth)}-01`;
  const monthViewRef = useRef(null);
  const [openDayMenu, setOpenDayMenu] = useState(null);
  const [selectedDates, setSelectedDates] = useState(new Set());
  const [selectionClosedClass, setSelectionClosedClass] = useState(null);
  const [bulkEditModalVisible, setBulkEditModalVisible] = useState(false);
  const selectionActive = selectedDates.size > 0;
```

Ubicar (después de `handleCancelSession`, antes de `openMarking`):
```js
  const handleCancelSession = () => {
    const date = openDayMenu.date;
    handleCloseDayMenu();
    router.push(`/teams/${teamId}/groups/${groupId}/calendar/${date}?action=cancel`);
  };

  const openMarking = openDayMenu ? markingsByDate[openDayMenu.date] : null;
```
Reemplazar por:
```js
  const handleCancelSession = () => {
    const date = openDayMenu.date;
    handleCloseDayMenu();
    router.push(`/teams/${teamId}/groups/${groupId}/calendar/${date}?action=cancel`);
  };

  const handleSelectDay = () => {
    const date = openDayMenu.date;
    const marking = markingsByDate[date];
    handleCloseDayMenu();
    setSelectedDates(new Set([date]));
    setSelectionClosedClass(isCalendarDayClosed(date, marking ?? {}));
  };

  const handleToggleDaySelection = (date) => {
    setSelectedDates((prev) => {
      const next = new Set(prev);
      if (next.has(date)) {
        next.delete(date);
      } else {
        next.add(date);
      }
      if (next.size === 0) setSelectionClosedClass(null);
      return next;
    });
  };

  const handleExitSelection = () => {
    setSelectedDates(new Set());
    setSelectionClosedClass(null);
  };

  const handleBulkClear = async () => {
    const dates = Array.from(selectedDates);
    handleExitSelection();
    const result = await bulkClear({ dates });
    if (!result.success) {
      notifyError();
      Toast.show({ type: 'error', text1: 'No pudimos vaciar los días', text2: result.error });
      return;
    }
    notifySuccess();
    Toast.show({ type: 'success', text1: `${dates.length} día${dates.length === 1 ? '' : 's'} vaciados` });
  };

  const openMarking = openDayMenu ? markingsByDate[openDayMenu.date] : null;
```

- [ ] **Step 4: Header condicional**

Ubicar:
```jsx
          <Pressable
            className="ml-auto h-9 flex-row items-center gap-1.5 rounded-full bg-primary px-3 hover:opacity-90 active:opacity-80"
            nativeID="group-calendar-screen-stamp-button"
            onPress={() => setStampModalVisible(true)}
            testID="group-calendar-screen-stamp-button"
          >
            <MaterialCommunityIcons color="#111518" name="stamper" size={16} />
            <Text className="text-xs font-semibold uppercase tracking-wide text-[#111518]" nativeID="group-calendar-screen-stamp-button-label" testID="group-calendar-screen-stamp-button-label">
              Estampar plan
            </Text>
          </Pressable>
        </View>
```
Reemplazar por:
```jsx
          {selectionActive ? (
            <View className="ml-auto flex-row items-center gap-2" nativeID="group-calendar-screen-selection-bar" testID="group-calendar-screen-selection-bar">
              <Text className="text-xs font-semibold text-slate-600 dark:text-slate-300" nativeID="group-calendar-screen-selection-count" testID="group-calendar-screen-selection-count">
                {selectedDates.size} seleccionado{selectedDates.size === 1 ? '' : 's'}
              </Text>
              <Pressable
                accessibilityLabel="Vaciar en lote"
                className={`h-9 w-9 items-center justify-center rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 ${selectionClosedClass === true ? 'opacity-40' : ''}`}
                disabled={selectionClosedClass === true || isBulkClearing}
                nativeID="group-calendar-screen-bulk-clear-button"
                onPress={handleBulkClear}
                testID="group-calendar-screen-bulk-clear-button"
              >
                <MaterialCommunityIcons color="#ef4444" name="trash-can-outline" size={18} />
              </Pressable>
              <Pressable
                accessibilityLabel="Editar en lote"
                className={`h-9 w-9 items-center justify-center rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 ${selectionClosedClass === true ? 'opacity-40' : ''}`}
                disabled={selectionClosedClass === true}
                nativeID="group-calendar-screen-bulk-edit-button"
                onPress={() => setBulkEditModalVisible(true)}
                testID="group-calendar-screen-bulk-edit-button"
              >
                <MaterialCommunityIcons color={colors.onSurfaceVariant} name="pencil-outline" size={18} />
              </Pressable>
              <Pressable
                accessibilityLabel="Salir de selección"
                className="h-9 w-9 items-center justify-center rounded-full hover:bg-slate-100 dark:hover:bg-slate-800"
                nativeID="group-calendar-screen-selection-exit-button"
                onPress={handleExitSelection}
                testID="group-calendar-screen-selection-exit-button"
              >
                <MaterialCommunityIcons color={colors.onSurfaceVariant} name="close" size={18} />
              </Pressable>
            </View>
          ) : (
            <Pressable
              className="ml-auto h-9 flex-row items-center gap-1.5 rounded-full bg-primary px-3 hover:opacity-90 active:opacity-80"
              nativeID="group-calendar-screen-stamp-button"
              onPress={() => setStampModalVisible(true)}
              testID="group-calendar-screen-stamp-button"
            >
              <MaterialCommunityIcons color="#111518" name="stamper" size={16} />
              <Text className="text-xs font-semibold uppercase tracking-wide text-[#111518]" nativeID="group-calendar-screen-stamp-button-label" testID="group-calendar-screen-stamp-button-label">
                Estampar plan
              </Text>
            </Pressable>
          )}
        </View>
```

Necesitás `isBulkClearing` desestructurado del `useGroupCalendarMutations` del Step 3 — actualizar esa línea:
```js
  const { deleteDay, bulkClear } = useGroupCalendarMutations(groupId);
```
por:
```js
  const { deleteDay, bulkClear, isBulkClearing } = useGroupCalendarMutations(groupId);
```

- [ ] **Step 5: `dayComponent` — pasar las props de selección**

Ubicar:
```jsx
            dayComponent={({ date, state }) => (
              <CalendarDayCell
                containerRef={monthViewRef}
                date={date}
                isMenuOpen={openDayMenu?.date === date.dateString}
                marking={markingsByDate[date.dateString]}
                onOpenMenu={handleOpenDayMenu}
                state={state}
              />
            )}
```
Reemplazar por:
```jsx
            dayComponent={({ date, state }) => (
              <CalendarDayCell
                containerRef={monthViewRef}
                date={date}
                isMenuOpen={openDayMenu?.date === date.dateString}
                marking={markingsByDate[date.dateString]}
                onOpenMenu={handleOpenDayMenu}
                onToggleSelect={handleToggleDaySelection}
                selected={selectedDates.has(date.dateString)}
                selectionActive={selectionActive}
                selectionClosedClass={selectionClosedClass}
                state={state}
              />
            )}
```

- [ ] **Step 6: `CalendarDayMenu` — pasar `onSelect`**

Ubicar:
```jsx
            {openDayMenu && (
              <CalendarDayMenu
                closed={openClosed}
                hasContent={Boolean(openMarking)}
                isTraining={openMarking?.kind === 'training'}
                onAssignOrEdit={handleAssignOrEdit}
                onCancel={handleCancelSession}
                onClear={handleClearDay}
              />
            )}
```
Reemplazar por:
```jsx
            {openDayMenu && (
              <CalendarDayMenu
                closed={openClosed}
                hasContent={Boolean(openMarking)}
                isTraining={openMarking?.kind === 'training'}
                onAssignOrEdit={handleAssignOrEdit}
                onCancel={handleCancelSession}
                onClear={handleClearDay}
                onSelect={handleSelectDay}
              />
            )}
```

- [ ] **Step 7: Montar `BulkEditDaysModal`**

Ubicar:
```jsx
      <StampPlanModal groupId={groupId} onClose={() => setStampModalVisible(false)} ownerId={userId} visible={stampModalVisible} />
    </View>
  );
}
```
Reemplazar por:
```jsx
      <StampPlanModal groupId={groupId} onClose={() => setStampModalVisible(false)} ownerId={userId} visible={stampModalVisible} />

      <BulkEditDaysModal
        dates={Array.from(selectedDates)}
        groupId={groupId}
        onClose={() => setBulkEditModalVisible(false)}
        onSuccess={handleExitSelection}
        ownerId={userId}
        visible={bulkEditModalVisible}
      />
    </View>
  );
}
```

- [ ] **Step 8: Verificar**

Run: `npm test && npm run lint`
Expected: PASS — sin tests nuevos en este archivo (convención del proyecto, sin lógica pura nueva acá — la lógica pura ya se testeó en Tasks 1-3).

- [ ] **Step 9: Commit**

```bash
git add components/team/group-calendar-screen.jsx
git commit -m "feat(calendar): wire multi-select mode + bulk actions into month view"
```

---

### Task 8: Verificación final + script de test manual

**Files:** ninguno (solo verificación)

- [ ] **Step 1: Correr la suite completa**

Run: `npm test && npm run lint`
Expected: PASS — 0 fallos, 0 errores de lint.

- [ ] **Step 2: Entregar el script de test manual**

En la respuesta final de esta tarea, mostrar el siguiente script en el chat:

```
## Script de test manual — selección múltiple + acciones en lote

### 1. Entrar a modo selección
1. Tocar un día futuro cualquiera, tocar "Seleccionar" en el menú.
2. El día debe quedar marcado (borde grueso), el header debe cambiar:
   "1 seleccionado" + 3 íconos (tacho, lápiz, X).
3. "Estampar plan" no debe estar visible mientras tanto.

### 2. Agregar/sacar días de la selección
1. Tocar otro día futuro (sin contenido) → debe sumarse a la selección
   ("2 seleccionados"), SIN abrir ningún menú.
2. Tocar el mismo día de nuevo → debe sacarse de la selección
   ("1 seleccionado").
3. Tocar un día del mes pasado (cerrado) mientras la selección es de
   días futuros → no debe pasar nada (día bloqueado, atenuado).

### 3. Vaciar en lote
1. Con 2-3 días futuros seleccionados (con contenido asignado a mano
   antes), tocar el ícono de tacho.
2. Debe vaciar los días directo (sin modal de confirmación), toast de
   éxito, salir del modo selección solo.

### 4. Editar en lote
1. Seleccionar 2-3 días futuros vacíos, tocar el ícono de lápiz.
2. Se abre el modal — elegir un kind (ej. entrenamiento con sesión).
3. Guardar → toast de éxito, los días seleccionados deben reflejar el
   mismo contenido en el mes, modo selección debe salir solo.
4. Repetir, esta vez cancelando el modal (tocar afuera con cambios
   cargados) → debe pedir confirmación de descarte, Y la selección de
   días debe seguir activa después de cerrar (no se pierde).

### 5. Selección de días cerrados
1. Tocar un día del mes pasado con contenido, tocar "Seleccionar".
2. El header debe mostrar los 2 íconos de acción DESHABILITADOS
   (atenuados) — solo la X (Salir) debe funcionar.
3. Tocar otro día del mes pasado → debe sumarse igual (misma clase).
4. Tocar un día futuro mientras esta selección está activa → no debe
   pasar nada (bloqueado, clase distinta).

### 6. Salir de selección
1. Con días seleccionados, tocar la X del header.
2. Debe volver el estado normal (bordes sueltos, "Estampar plan" de
   vuelta).

Probar en web alcanza — no hay comportamiento específico de plataforma
nuevo en esta pieza.
```

- [ ] **Step 3: Marcar el plan como completo**

No hay commit en este task. Si `npm test`/`npm run lint` fallaran, volver al task correspondiente y corregir antes de considerar el plan terminado.
