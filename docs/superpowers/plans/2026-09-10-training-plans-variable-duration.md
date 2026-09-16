# Planes de entrenamiento: duración variable, sin caducidad Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Los planes de entrenamiento del entrenador dejan de tener caducidad (`durationDays`) y días atados a un día de la semana (`dayOfWeek`) — pasan a ser 2 a 31 días numerados "Día 1".."Día N", sin vencimiento propio. Se ajustan las pantallas del entrenador y del corredor que dependían del modelo viejo.

**Architecture:** Cambio de esquema de arriba hacia abajo — mock (fuente de la verdad hoy, sin backend real) → normalizadores → store/hook de formulario → pantallas. Las pantallas del corredor que resolvían "hoy" contra `dayOfWeek` (`TodaySessionCard`/`useTodayPlanSession`) pierden esa capacidad por diseño (ya no hay ancla de calendario en un plan-template) y se reemplazan por un estado fijo, no se intenta preservar el comportamiento viejo.

**Tech Stack:** React Native + React Native Web, Zustand (`training-plan-store.js` — todavía no migrado a TanStack Query, ver CLAUDE.md).

**Spec:** `docs/superpowers/specs/2026-09-10-training-plans-variable-duration-design.md`

## Global Constraints

- Cantidad de días de un plan: entre 2 y 31, sin caducidad ni día-de-semana.
- Ninguna asignación (`assignToGroup`, `assignToRunner`, `groupTrainingPlanIds`, `RunnerPlanAssignment`, marcar como "actual") se toca en este plan.
- `day.sessionId` sigue siendo un solo id (no array) — multi-sesión por día queda fuera de alcance.
- Todo elemento visual nuevo lleva `nativeID`/`testID` únicos.
- Sin tests de componente (convención del repo) — solo lógica pura (store/mocks) lleva test real.
- `npm test` y `npm run lint` en verde antes de cada commit.

---

### Task 1: `store/training-plan-store.js` — sacar duración/día-de-semana, `buildEmptyPlanDays(dayCount)`

**Files:**
- Modify: `store/training-plan-store.js`
- Modify: `__tests__/training-plan-store.test.js`

**Interfaces:**
- Consumes: nada de tasks anteriores (primer task).
- Produces: `buildEmptyPlanDays(dayCount) => Array<{sequenceNo, kind, otherName, sessionId}>` — consumida por Task 4 (`use-training-plan-form.js`). El resto de las funciones/actions del store (`createPlan`, `updatePlan`, `deletePlan`, `clonePlan`, `fetchPlans`, `fetchPlan`, todo lo de asignación) no cambia de firma — otros tasks siguen usándolas igual.

- [ ] **Step 1: Borrar las exports obsoletas**

En `store/training-plan-store.js`, borrar por completo (líneas 23-67
del archivo actual): `PLAN_DURATION_OPTIONS`, `DAY_ORDER`, `DAY_LABELS`,
`dayLabel`, `getPlanStatus`, `getPlanDaysRemaining`,
`getTodayDayOfWeek`.

- [ ] **Step 2: Reescribir `buildEmptyPlanDays`**

En el mismo lugar donde estaba, dejar:

```js
// Arma dayCount días vacíos (todos "rest"), numerados 1..dayCount —
// punto de partida al crear un plan nuevo o al agregar/quitar días en
// el form. Sin día de la semana: el orden es puramente secuencial.
export function buildEmptyPlanDays(dayCount) {
  return Array.from({ length: dayCount }, (_, i) => ({ sequenceNo: i + 1, kind: 'rest', otherName: null, sessionId: null }));
}
```

- [ ] **Step 3: Actualizar el test — borrar los describe obsoletos**

En `__tests__/training-plan-store.test.js`, borrar por completo:
- El import de `getPlanStatus, getPlanDaysRemaining, getTodayDayOfWeek, ..., dayLabel, PLAN_DURATION_OPTIONS` (línea 1-4) — dejar el import como:

```js
import { useTrainingPlanStore, buildEmptyPlanDays } from '../store/training-plan-store.js';
```

- Los `describe('getPlanStatus', ...)`, `describe('getPlanDaysRemaining', ...)`, `describe('getTodayDayOfWeek', ...)`, `describe('dayLabel / PLAN_DURATION_OPTIONS', ...)` (líneas 79-129 actuales) — borrar los 4 bloques completos.

- [ ] **Step 4: Actualizar `PLAN_DTO` y el test de `buildEmptyPlanDays`**

`PLAN_DTO` (línea 57-69) pierde `duration_days` y cada día pierde
`day_of_week`:

```js
const PLAN_DTO = {
  id: 1, owner_id: 7, name: 'Base 5K', description: 'desc',
  days: [
    { sequence_no: 1, kind: 'training', other_name: null, session_id: 9 },
    { sequence_no: 2, kind: 'rest', other_name: null, session_id: null },
    { sequence_no: 3, kind: 'rest', other_name: null, session_id: null },
    { sequence_no: 4, kind: 'rest', other_name: null, session_id: null },
    { sequence_no: 5, kind: 'rest', other_name: null, session_id: null },
    { sequence_no: 6, kind: 'rest', other_name: null, session_id: null },
    { sequence_no: 7, kind: 'rest', other_name: null, session_id: null },
  ],
  created_at: '2026-01-01T00:00:00.000Z', updated_at: '2026-01-01T00:00:00.000Z',
};
```

Reemplazar el `describe('buildEmptyPlanDays', ...)` (línea 110-118) por:

```js
describe('buildEmptyPlanDays', () => {
  test('arma dayCount días numerados 1..dayCount, todos rest, sin día de la semana', () => {
    const days = buildEmptyPlanDays(10);
    expect(days).toHaveLength(10);
    expect(days.map((d) => d.sequenceNo)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    expect(days.every((d) => d.kind === 'rest')).toBe(true);
    expect(days.every((d) => !('dayOfWeek' in d))).toBe(true);
  });

  test('con dayCount 2, arma exactamente 2 días', () => {
    expect(buildEmptyPlanDays(2)).toHaveLength(2);
  });
});
```

- [ ] **Step 5: Ajustar el test de `createPlan` (línea 144-151) que pasaba `durationDays`**

```js
  test('createPlan agrega el plan creado a la lista', async () => {
    createTrainingPlanService.mockResolvedValue(PLAN_DTO);
    const result = await useTrainingPlanStore.getState().createPlan({
      ownerId: 7, name: 'Base 5K', description: 'desc', days: [],
    });
    expect(result.success).toBe(true);
    expect(useTrainingPlanStore.getState().plans).toContainEqual(result.plan);
  });
```

- [ ] **Step 6: Correr el test y confirmar que pasa**

Run: `npx jest training-plan-store`
Expected: PASS, todos los tests del archivo (el resto — `fetchPlans`,
`updatePlan`, `clonePlan`, `deletePlan`, asignación, "mis planes",
marcar actual — no cambia de comportamiento, solo dejaron de existir
las 4 funciones borradas).

- [ ] **Step 7: Verificar lint**

Run: `npx eslint store/training-plan-store.js __tests__/training-plan-store.test.js`
Expected: sin errores.

- [ ] **Step 8: Commit**

```bash
git add store/training-plan-store.js __tests__/training-plan-store.test.js
git commit -m "feat(training-plans): drop duration/day-of-week from the store, variable day count"
```

---

### Task 2: `services/normalizers.js` — `PlanDay`/`TrainingPlan` sin duración ni día de semana

**Files:**
- Modify: `services/normalizers.js`

**Interfaces:**
- Consumes: nada de tasks anteriores.
- Produces: `toTrainingPlanModel`/`toCreateTrainingPlanPayload`/`toUpdateTrainingPlanPayload`/`toPlanDayModel`/`toPlanDayPayload` en su forma nueva — consumidas por Task 3 (mock) y por todas las pantallas (sin cambio de nombre, solo de forma).

- [ ] **Step 1: `toPlanDayModel`/`toPlanDayPayload`**

Reemplazar (líneas 339-357 actuales):

```js
function toPlanDayModel(dto) {
  return {
    sequenceNo: dto.sequence_no,
    kind: dto.kind,
    otherName: dto.other_name ?? null,
    sessionId: dto.session_id != null ? String(dto.session_id) : null,
  };
}

function toPlanDayPayload(day) {
  return {
    sequence_no: day.sequenceNo,
    kind: day.kind,
    other_name: day.kind === 'other' ? day.otherName : null,
    session_id: day.kind === 'training' && day.sessionId ? Number(day.sessionId) : null,
  };
}
```

- [ ] **Step 2: `toTrainingPlanModel`/`toCreateTrainingPlanPayload`/`toUpdateTrainingPlanPayload`**

En `toTrainingPlanModel` (línea 359-371 actuales), borrar la línea
`durationDays: dto.duration_days,`. En `toCreateTrainingPlanPayload`
(línea 373-381), borrar `duration_days: form.durationDays,`. En
`toUpdateTrainingPlanPayload` (línea 383-390), borrar la línea
`if (form.durationDays !== undefined) payload.duration_days = form.durationDays;`.

- [ ] **Step 3: Verificar lint y test completos**

Run: `npm run lint && npm test`
Expected: sin errores, todos los tests pasan (ningún test de
`normalizers.test.js` cubre estas funciones puntuales hoy, ver Task 1
de este plan para el ajuste correspondiente en `training-plan-store.test.js`).

- [ ] **Step 4: Commit**

```bash
git add services/normalizers.js
git commit -m "feat(training-plans): drop durationDays/dayOfWeek from normalizers"
```

---

### Task 3: `services/__mocks__/training-plans-mock.js` — validación y semillas nuevas

**Files:**
- Modify: `services/__mocks__/training-plans-mock.js`
- Modify: `__tests__/training-plans-mock.test.js`

**Interfaces:**
- Consumes: nada de tasks anteriores (el mock no importa de
  `normalizers.js` ni del store).
- Produces: `validatePlanDays` en su forma nueva (2-31, sin
  día-de-semana) — usada internamente por `mockCreateTrainingPlan`/
  `mockUpdateTrainingPlan`, sin otros consumidores en este plan.

- [ ] **Step 1: Reescribir el test que falla primero**

En `__tests__/training-plans-mock.test.js`, reemplazar `buildValidDays`
(línea 8-11):

```js
function buildValidDays(count = 7) {
  return Array.from({ length: count }, (_, i) => ({ sequence_no: i + 1, kind: 'rest', other_name: null, session_id: null }));
}
```

Reemplazar los 2 tests de `validatePlanDays` (línea 33-64 actuales):

```js
  test('validatePlanDays exige entre 2 y 31 días, en secuencia 1..N sin repetir', () => {
    expect(() => validatePlanDays(buildValidDays(7))).not.toThrow();
    expect(() => validatePlanDays(buildValidDays(2))).not.toThrow();
    expect(() => validatePlanDays(buildValidDays(31))).not.toThrow();
    expect(() => validatePlanDays(buildValidDays(1))).toThrow('entre 2 y 31 días');
    expect(() => validatePlanDays(buildValidDays(32))).toThrow('entre 2 y 31 días');

    const dupSequence = buildValidDays(7);
    dupSequence[1].sequence_no = 1;
    expect(() => validatePlanDays(dupSequence)).toThrow();

    const gapSequence = buildValidDays(7);
    gapSequence[6].sequence_no = 9;
    expect(() => validatePlanDays(gapSequence)).toThrow();
  });

  test('validatePlanDays exige session_id en los días de entrenamiento y other_name en los de otra actividad', () => {
    const trainingWithoutSession = buildValidDays();
    trainingWithoutSession[0].kind = 'training';
    expect(() => validatePlanDays(trainingWithoutSession)).toThrow('sesión para cada día de entrenamiento');

    const trainingWithSession = buildValidDays();
    trainingWithSession[0].kind = 'training';
    trainingWithSession[0].session_id = 1;
    expect(() => validatePlanDays(trainingWithSession)).not.toThrow();

    const otherWithoutName = buildValidDays();
    otherWithoutName[0].kind = 'other';
    expect(() => validatePlanDays(otherWithoutName)).toThrow('otra actividad');

    const otherWithName = buildValidDays();
    otherWithName[0].kind = 'other';
    otherWithName[0].other_name = 'Natación';
    expect(() => validatePlanDays(otherWithName)).not.toThrow();
  });
```

Y en el test de `mockCreateTrainingPlan` (línea 66-73), sacar
`duration_days: 14` del payload y el `expect(created.duration_days).toBe(14)`:

```js
  test('mockCreateTrainingPlan agrega un plan nuevo con id incremental', async () => {
    const before = await mockListTrainingPlans();
    const created = await mockCreateTrainingPlan({ owner_id: 5, name: 'Plan nuevo', description: null, days: buildValidDays() });
    const after = await mockListTrainingPlans();
    expect(after.length).toBe(before.length + 1);
    expect(created.name).toBe('Plan nuevo');
  });
```

Y en el test de rechazo (línea 75-77), sacar `duration_days: 7`:

```js
  test('mockCreateTrainingPlan rechaza días inválidos', async () => {
    await expect(mockCreateTrainingPlan({ owner_id: 5, name: 'X', days: [] })).rejects.toThrow();
  });
```

- [ ] **Step 2: Correr los tests y confirmar que fallan**

Run: `npx jest training-plans-mock`
Expected: FAIL — los mensajes de error todavía dicen "exactamente 7
días"/"día de la semana", no calzan con los nuevos `toThrow(...)`.

- [ ] **Step 3: Reescribir `validatePlanDays` y las semillas**

En `services/__mocks__/training-plans-mock.js`, borrar la constante
`DAY_ORDER` (línea 14) — ya no se usa.

Reemplazar `validatePlanDays` (líneas 92-109 actuales):

```js
export function validatePlanDays(days) {
  if (!Array.isArray(days) || days.length < 2 || days.length > 31) {
    throw new Error('Un plan tiene que tener entre 2 y 31 días.');
  }
  const sequences = days.map((d) => d.sequence_no).sort((a, b) => a - b);
  if (sequences.some((s, i) => s !== i + 1)) {
    throw new Error(`Los días tienen que numerarse del 1 al ${days.length} sin repetir.`);
  }
  if (days.some((d) => d.kind === 'training' && !d.session_id)) {
    throw new Error('Elegí una sesión para cada día de entrenamiento.');
  }
  if (days.some((d) => d.kind === 'other' && !d.other_name)) {
    throw new Error('Ingresá el nombre de la actividad en los días de "otra actividad".');
  }
}
```

Reemplazar `buildSeedPlans` (líneas 16-49 actuales) — mismos 2 planes,
misma cantidad de días (7 cada uno), sin `duration_days`/`day_of_week`:

```js
function buildSeedPlans() {
  const now = new Date().toISOString();
  return [
    {
      id: 1,
      owner_id: 1,
      name: 'Base 5K — nivel inicial',
      description: 'Progresión de 7 días para arrancar a correr 5K sin lesionarse — 3 sesiones de entrenamiento, resto descanso activo.',
      created_at: now,
      updated_at: now,
      days: [
        { sequence_no: 1, kind: 'training', other_name: null, session_id: 1 },
        { sequence_no: 2, kind: 'rest', other_name: null, session_id: null },
        { sequence_no: 3, kind: 'training', other_name: null, session_id: 2 },
        { sequence_no: 4, kind: 'other', other_name: 'Elongación y movilidad', session_id: null },
        { sequence_no: 5, kind: 'training', other_name: null, session_id: 3 },
        { sequence_no: 6, kind: 'rest', other_name: null, session_id: null },
        { sequence_no: 7, kind: 'rest', other_name: null, session_id: null },
      ],
    },
    {
      id: 2,
      owner_id: 1,
      name: 'Series y velocidad — nivel intermedio',
      description: 'Ciclo de 7 días con foco en velocidad — series y tempo run, con descanso completo entre estímulos fuertes.',
      created_at: now,
      updated_at: now,
      days: [
        { sequence_no: 1, kind: 'training', other_name: null, session_id: 2 },
        { sequence_no: 2, kind: 'rest', other_name: null, session_id: null },
        { sequence_no: 3, kind: 'training', other_name: null, session_id: 4 },
        { sequence_no: 4, kind: 'rest', other_name: null, session_id: null },
        { sequence_no: 5, kind: 'training', other_name: null, session_id: 5 },
        { sequence_no: 6, kind: 'other', other_name: 'Trote regenerativo suave', session_id: null },
        { sequence_no: 7, kind: 'rest', other_name: null, session_id: null },
      ],
    },
  ];
}
```

(La descripción del plan 2 decía "Ciclo de 14 días" — se corrige a "7
días" ya que `duration_days: 14` era el único lugar que sugería una
duración distinta de la cantidad real de `days`, campo que
desaparece.)

Reemplazar `mockCreateTrainingPlan` (líneas 121-135 actuales), sacando
la línea `duration_days: payload.duration_days,`:

```js
export async function mockCreateTrainingPlan(payload) {
  validatePlanDays(payload.days);
  const now = new Date().toISOString();
  const plan = {
    id: nextId++,
    owner_id: payload.owner_id,
    name: payload.name,
    description: payload.description ?? null,
    days: payload.days,
    created_at: now,
    updated_at: now,
  };
  mockPlans.push(plan);
  return plan;
}
```

(`mockUpdateTrainingPlan` no cambia — solo hace `Object.assign` de lo
que le llegue en `updates`, sin referenciar `duration_days` explícito.)

- [ ] **Step 4: Correr los tests y confirmar que pasan**

Run: `npx jest training-plans-mock`
Expected: PASS, todos los tests del archivo.

- [ ] **Step 5: Verificar lint y test completos**

Run: `npm run lint && npm test`
Expected: sin errores, todos los tests pasan.

- [ ] **Step 6: Commit**

```bash
git add services/__mocks__/training-plans-mock.js __tests__/training-plans-mock.test.js
git commit -m "feat(training-plans): mock validates 2-31 days without day-of-week"
```

---

### Task 4: `hooks/use-training-plan-form.js` — `dayCount`/`setDayCount`

**Files:**
- Modify: `hooks/use-training-plan-form.js`

**Interfaces:**
- Consumes: `buildEmptyPlanDays(dayCount)` (Task 1).
- Produces: `form.setDayCount(nextCount)` — consumida por Task 5 (control de cantidad de días en el form). `form.getValues()` deja de incluir `durationDays`.

- [ ] **Step 1: Reemplazar el archivo completo**

```js
import { useState } from 'react';
import { buildEmptyPlanDays } from '../store/training-plan-store.js';

// Estado + validación del formulario de crear/editar un plan de
// entrenamiento — mismo patrón que hooks/use-team-general-info-form.js
// (un hook compartido por CreateTrainingPlanScreen y
// EditTrainingPlanScreen, cada una con su propio `initial`).
export function useTrainingPlanForm({ initial, ownerId } = {}) {
  const [name, setName] = useState(initial?.name ?? '');
  const [description, setDescription] = useState(initial?.description ?? '');
  const [days, setDays] = useState(initial?.days ?? buildEmptyPlanDays(7));
  const [errors, setErrors] = useState({});

  const updateDay = (sequenceNo, updates) => {
    setDays((prev) => prev.map((day) => (day.sequenceNo === sequenceNo ? { ...day, ...updates } : day)));
  };

  // Sube o baja la cantidad de días — agrega/quita del final de la
  // lista para no reordenar los que ya están cargados. Clampeado a
  // [2, 31] acá mismo, no solo en el input que lo llama (defensa contra
  // un valor inválido que llegue por otro lado).
  const setDayCount = (nextCount) => {
    const clamped = Math.max(2, Math.min(31, nextCount));
    setDays((prev) => {
      if (clamped === prev.length) return prev;
      if (clamped < prev.length) return prev.slice(0, clamped);
      const extra = Array.from({ length: clamped - prev.length }, (_, i) => ({
        sequenceNo: prev.length + i + 1, kind: 'rest', otherName: null, sessionId: null,
      }));
      return [...prev, ...extra];
    });
  };

  const validate = () => {
    const next = {};
    if (!name.trim()) next.name = 'Ingresá un nombre para el plan.';

    if (days.length < 2 || days.length > 31) next.days = 'El plan tiene que tener entre 2 y 31 días.';

    const trainingDaysWithoutSession = days.some((d) => d.kind === 'training' && !d.sessionId);
    if (trainingDaysWithoutSession) next.days = 'Elegí una sesión para cada día de entrenamiento (o creá una nueva con el botón "Crear sesión").';

    const otherDaysWithoutName = days.some((d) => d.kind === 'other' && !d.otherName?.trim());
    if (otherDaysWithoutName) next.days = 'Ingresá el nombre de la actividad en los días marcados como "Otra actividad".';

    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const getValues = () => ({
    ownerId,
    name: name.trim(),
    description: description.trim(),
    days,
  });

  return {
    name, setName,
    description, setDescription,
    days, updateDay, setDayCount,
    errors,
    validate,
    getValues,
  };
}
```

- [ ] **Step 2: Verificar lint**

Run: `npx eslint hooks/use-training-plan-form.js`
Expected: sin errores.

- [ ] **Step 3: Commit**

```bash
git add hooks/use-training-plan-form.js
git commit -m "feat(training-plans): variable day count in the form hook"
```

---

### Task 5: `training-plan-form-fields.jsx` — control de días, "Día N", sin Caducidad

**Files:**
- Modify: `components/plans/training-plan-form-fields.jsx`

**Interfaces:**
- Consumes: `form.setDayCount` (Task 4).
- Produces: `TrainingPlanFormFields({ form, autoFocusName })` (sin `durationOptions`) — consumida por Task 6.

- [ ] **Step 1: Sacar el import de `dayLabel`**

Cambiar:

```js
import { dayLabel } from '../../store/training-plan-store.js';
```

por (borrar la línea completa — ya no se usa).

- [ ] **Step 2: `DayHeaderRowWide` — "Día N" en vez de `dayLabel(day.dayOfWeek)`**

Línea 77 actual:

```jsx
        <Text className="w-24 shrink-0 text-sm font-semibold text-slate-900 dark:text-white" nativeID={`${idPrefix}-label`} testID={`${idPrefix}-label`}>
          {dayLabel(day.dayOfWeek)}
        </Text>
```

pasa a:

```jsx
        <Text className="w-24 shrink-0 text-sm font-semibold text-slate-900 dark:text-white" nativeID={`${idPrefix}-label`} testID={`${idPrefix}-label`}>
          {`Día ${day.sequenceNo}`}
        </Text>
```

- [ ] **Step 3: `DayRow` — mismo cambio en las 2 apariciones (líneas 226 y 234)**

```jsx
      <Pressable
        accessibilityLabel={`${'Día ' + day.sequenceNo}, ${kindMeta.label}, ${expanded ? 'ocultar detalle' : 'ver detalle'}`}
        accessibilityRole="button"
        className="flex-row items-center gap-2 active:opacity-80"
        nativeID={`${idPrefix}-toggle`}
        onPress={() => setExpanded((v) => !v)}
        testID={`${idPrefix}-toggle`}
      >
        <Text className="flex-1 text-sm font-semibold text-slate-900 dark:text-white" nativeID={`${idPrefix}-label`} testID={`${idPrefix}-label`}>
          {`Día ${day.sequenceNo}`}
        </Text>
```

- [ ] **Step 4: `TrainingPlanFormFields` — sacar Caducidad, sumar control de cantidad de días, sacar `durationOptions`**

Reemplazar la firma y la card "Datos del plan" (líneas 259-278
actuales):

```jsx
export function TrainingPlanFormFields({ form, autoFocusName = false }) {
  const userId = useAuthStore((s) => s.userId);
  const { sessions } = useSessions(userId);
  useExercises(userId); // precarga el cache que usa SessionExercisesPreview del picker de sesión

  return (
    <>
      <SectionCard icon="clipboard-text-outline" title="Datos del plan">
        <InputField autoFocus={autoFocusName} dense error={form.errors.name} label="Nombre del plan" onChange={form.setName} placeholder="Ej. Base 5K — nivel inicial" value={form.name} />
        <InputField dense hideErrorRow label="Descripción" multiline numberOfLines={3} onChange={form.setDescription} placeholder="Para quién es, qué objetivo tiene." value={form.description} />
      </SectionCard>

      <SectionCard icon="calendar-week" title="Días del plan">
        {form.errors.days && (
          <View className="mb-4 rounded-xl bg-red-50 px-4 py-3 dark:bg-red-900/20" nativeID="plan-days-error" testID="plan-days-error">
            <Text className="text-xs text-red-600 dark:text-red-400" nativeID="plan-days-error-text" testID="plan-days-error-text">{form.errors.days}</Text>
          </View>
        )}

        <View className="mb-4 flex-row items-center justify-between" nativeID="plan-day-count-control" testID="plan-day-count-control">
          <InputField
            className="mb-0 w-32"
            dense
            hideErrorRow
            keyboardType="number-pad"
            label="Cantidad de días"
            onChange={(v) => form.setDayCount(Number(v) || form.days.length)}
            value={String(form.days.length)}
          />
          <View className="flex-row gap-2" nativeID="plan-day-count-buttons" testID="plan-day-count-buttons">
            <Pressable
              className="h-10 items-center justify-center rounded-full border border-slate-200 px-3 disabled:opacity-40 dark:border-slate-700"
              disabled={form.days.length <= 2}
              nativeID="plan-day-count-remove-button"
              onPress={() => form.setDayCount(form.days.length - 1)}
              testID="plan-day-count-remove-button"
            >
              <Text className="text-sm font-semibold text-slate-700 dark:text-slate-200" nativeID="plan-day-count-remove-button-label" testID="plan-day-count-remove-button-label">Quitar último día</Text>
            </Pressable>
            <Pressable
              className="h-10 items-center justify-center rounded-full border border-slate-200 px-3 disabled:opacity-40 dark:border-slate-700"
              disabled={form.days.length >= 31}
              nativeID="plan-day-count-add-button"
              onPress={() => form.setDayCount(form.days.length + 1)}
              testID="plan-day-count-add-button"
            >
              <Text className="text-sm font-semibold text-slate-700 dark:text-slate-200" nativeID="plan-day-count-add-button-label" testID="plan-day-count-add-button-label">Agregar día</Text>
            </Pressable>
          </View>
        </View>

        <View className="gap-2" nativeID="plan-days-list" testID="plan-days-list">
          {form.days.map((day) => (
            <DayRow
              day={day}
              key={day.sequenceNo}
              onChangeDay={(updates) => form.updateDay(day.sequenceNo, updates)}
              sessions={sessions}
            />
          ))}
        </View>
      </SectionCard>
    </>
  );
}
```

- [ ] **Step 5: Verificar lint**

Run: `npx eslint components/plans/training-plan-form-fields.jsx`
Expected: sin errores.

- [ ] **Step 6: Commit**

```bash
git add components/plans/training-plan-form-fields.jsx
git commit -m "feat(training-plans): variable day-count control, drop caducidad field"
```

---

### Task 6: `create-training-plan-screen.jsx` / `edit-training-plan-screen.jsx` — sacar `durationOptions`/`durationDays`

**Files:**
- Modify: `components/plans/create-training-plan-screen.jsx`
- Modify: `components/plans/edit-training-plan-screen.jsx`

**Interfaces:**
- Consumes: `TrainingPlanFormFields` sin `durationOptions` (Task 5).
- Produces: nada.

- [ ] **Step 1: `create-training-plan-screen.jsx`**

Cambiar el import (línea 10):

```js
import { useTrainingPlanStore } from '../../store/training-plan-store.js';
```

Cambiar `isDirty` (línea 29):

```js
  const isDirty = useFormDirty({ name: form.name, description: form.description, dayCount: form.days.length });
```

Cambiar la llamada a `TrainingPlanFormFields` (línea 74):

```jsx
          <TrainingPlanFormFields autoFocusName={!isWeb} form={form} />
```

- [ ] **Step 2: `edit-training-plan-screen.jsx`**

Cambiar el import (línea 8):

```js
import { useTrainingPlanStore } from '../../store/training-plan-store.js';
```

Cambiar `isDirty` (línea 83):

```js
  const isDirty = useFormDirty({ name: form.name, description: form.description, dayCount: form.days.length });
```

Cambiar la llamada a `TrainingPlanFormFields` (línea 131):

```jsx
          <TrainingPlanFormFields form={form} />
```

- [ ] **Step 3: Verificar lint y test completos**

Run: `npm run lint && npm test`
Expected: sin errores, todos los tests pasan.

- [ ] **Step 4: Verificar en preview**

Crear un plan nuevo: sin campo "Caducidad", con "Cantidad de días"
arrancando en 7, subir a 10 y bajar a 3, confirmar que la lista de días
se ajusta y muestra "Día 1".."Día N". Guardar y confirmar que el plan
se crea bien.

- [ ] **Step 5: Commit**

```bash
git add components/plans/create-training-plan-screen.jsx components/plans/edit-training-plan-screen.jsx
git commit -m "feat(training-plans): wire variable day count into create/edit screens"
```

---

### Task 7: Ripple en pantallas del corredor — sin vigencia, hero reemplazado

**Files:**
- Modify: `components/plans/my-plans-screen.jsx`
- Modify: `components/plans/today-session-card.jsx`
- Delete: `hooks/use-today-plan-session.js`

**Interfaces:**
- Consumes: nada de tasks de código anteriores (son pantallas hoja, consumen el store/normalizers ya migrados en tasks 1-2).
- Produces: nada.

- [ ] **Step 1: `my-plans-screen.jsx` — sacar `statusTag`/`STATUS_META`**

Cambiar el import (línea 11):

```js
import { useTrainingPlanStore } from '../../store/training-plan-store.js';
```

Borrar `STATUS_META` (líneas 18-21).

En `MyPlanRow`, borrar las líneas de `status`/`statusMeta`/
`daysRemaining`/`vigenciaLabel` y el bloque `statusTag` (líneas 27-29,
35, 52-58 actuales), y sacar `{statusTag}` de los 2 `return` (narrow y
ancho, líneas ~89 y ~105):

```jsx
function MyPlanRow({ plan, isCurrent, atCurrentLimit, onPress, onToggleCurrent }) {
  const isNarrow = useIsNarrowWeb();
  const trainingDaysCount = plan.days.filter((d) => d.kind === 'training').length;
  const idPrefix = `my-plan-row-${plan.id}`;

  const icon = (
    <View className="h-10 w-10 items-center justify-center rounded-full bg-primary-tint dark:bg-primary/15" nativeID={`${idPrefix}-icon`} testID={`${idPrefix}-icon`}>
      <MaterialCommunityIcons color="#8cc63e" name="clipboard-text-outline" size={18} />
    </View>
  );
  const info = (
    <View className="flex-1" nativeID={`${idPrefix}-info`} testID={`${idPrefix}-info`}>
      <Text className="text-sm font-semibold text-slate-900 dark:text-white" nativeID={`${idPrefix}-name`} numberOfLines={1} testID={`${idPrefix}-name`}>
        {plan.name}
      </Text>
      <Text className="text-xs text-slate-500 dark:text-slate-400" nativeID={`${idPrefix}-meta`} numberOfLines={1} testID={`${idPrefix}-meta`}>
        {trainingDaysCount} {trainingDaysCount === 1 ? 'sesión' : 'sesiones'} de entrenamiento
      </Text>
    </View>
  );
  const currentToggle = (
    <Pressable
      className={`rounded-lg p-1.5 ${isCurrent || !atCurrentLimit ? 'hover:bg-slate-200 active:opacity-70 dark:hover:bg-slate-800' : 'opacity-40'}`}
      nativeID={`${idPrefix}-current-toggle`}
      onPress={onToggleCurrent}
      testID={`${idPrefix}-current-toggle`}
    >
      <MaterialCommunityIcons color={isCurrent ? '#8cc63e' : '#94a3b8'} name={isCurrent ? 'star' : 'star-outline'} size={20} />
    </Pressable>
  );
  const chevron = <MaterialCommunityIcons color="#94a3b8" name="chevron-right" size={20} />;

  if (isNarrow) {
    return (
      <Pressable
        className="gap-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 hover:bg-slate-100 active:opacity-80 dark:border-slate-700 dark:bg-slate-900 dark:hover:bg-slate-800"
        nativeID={idPrefix}
        onPress={onPress}
        testID={idPrefix}
      >
        <View className="flex-row items-center gap-3" nativeID={`${idPrefix}-main-row`} testID={`${idPrefix}-main-row`}>
          {icon}
          {info}
          {chevron}
        </View>
        <View className="flex-row items-center gap-2 pl-[52px]" nativeID={`${idPrefix}-meta-row`} testID={`${idPrefix}-meta-row`}>
          {currentToggle}
        </View>
      </Pressable>
    );
  }

  return (
    <Pressable
      className="flex-row items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 hover:bg-slate-100 active:opacity-80 dark:border-slate-700 dark:bg-slate-900 dark:hover:bg-slate-800"
      nativeID={idPrefix}
      onPress={onPress}
      testID={idPrefix}
    >
      {icon}
      {info}
      {currentToggle}
      {chevron}
    </Pressable>
  );
}
```

- [ ] **Step 2: `today-session-card.jsx` — reemplazo completo por estado fijo**

Reemplazar el archivo entero:

```jsx
import { Pressable, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useThemeColors } from '../../theme/colors.js';

// Ex-hero de "sesión de hoy" — resolvía el día real contra
// plan.days[].dayOfWeek, campo que dejó de existir (planes pasaron a
// días numerados sin atarse a un día de semana real, ver
// docs/superpowers/specs/2026-09-10-training-plans-variable-duration-design.md).
// Hasta que un futuro sub-proyecto de calendario/asignación resuelva
// "qué día real es hoy" contra un plan-template, esta card muestra un
// estado fijo en vez de intentar (y no lograr) resolver un día.
export function TodaySessionCard({ plan }) {
  const router = useRouter();
  const colors = useThemeColors();
  const idPrefix = `today-session-card-${plan.id}`;

  return (
    <View className="w-full overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-lg dark:border-slate-700 dark:bg-surface" nativeID={idPrefix} testID={idPrefix}>
      <View className="flex-row items-center justify-between bg-primary-tint px-5 py-4 dark:bg-primary/15" nativeID={`${idPrefix}-header`} testID={`${idPrefix}-header`}>
        <Text
          className="flex-1 pr-3 text-lg text-slate-900 dark:text-white"
          nativeID={`${idPrefix}-plan-name`}
          numberOfLines={1}
          style={{ fontFamily: 'Orbitron_700Bold' }}
          testID={`${idPrefix}-plan-name`}
        >
          {plan.name}
        </Text>
        <View className="h-12 w-12 items-center justify-center rounded-full bg-white/60 dark:bg-black/20" nativeID={`${idPrefix}-header-icon`} testID={`${idPrefix}-header-icon`}>
          <MaterialCommunityIcons color={colors.primary} name="calendar-blank-outline" size={26} />
        </View>
      </View>

      <View className="items-center gap-2 p-5" nativeID={`${idPrefix}-body`} testID={`${idPrefix}-body`}>
        <MaterialCommunityIcons color={colors.onSurfaceVariant} name="calendar-blank-outline" size={40} />
        <Text className="text-center text-base font-bold text-slate-900 dark:text-white" nativeID={`${idPrefix}-no-calendar-title`} testID={`${idPrefix}-no-calendar-title`}>
          Todavía no tiene un calendario asignado
        </Text>
        <Text className="text-center text-xs text-slate-500 dark:text-slate-400" nativeID={`${idPrefix}-no-calendar-copy`} testID={`${idPrefix}-no-calendar-copy`}>
          Pronto vas a poder ver acá el entrenamiento de cada día real.
        </Text>

        <Pressable
          className="mt-3 h-11 w-full flex-row items-center justify-center gap-1.5 rounded-full bg-primary hover:opacity-90 active:opacity-80"
          nativeID={`${idPrefix}-view-plan-button`}
          onPress={() => router.push(`/plans/${plan.id}`)}
          testID={`${idPrefix}-view-plan-button`}
        >
          <Text className="text-sm font-semibold uppercase tracking-wide text-[#111518]" nativeID={`${idPrefix}-view-plan-label`} testID={`${idPrefix}-view-plan-label`}>
            Ver plan completo
          </Text>
          <MaterialCommunityIcons color="#111518" name="arrow-right" size={16} />
        </Pressable>
      </View>
    </View>
  );
}
```

- [ ] **Step 3: Borrar `hooks/use-today-plan-session.js`**

Confirmar que no queda ningún import de este archivo (`grep -rn
"use-today-plan-session" --include=*.jsx --include=*.js .` desde la raíz
del repo, excluyendo `node_modules`, `docs/`) antes de borrarlo — el
único consumidor real era `today-session-card.jsx`, ya reemplazado en
el Step 2.

```bash
rm hooks/use-today-plan-session.js
```

- [ ] **Step 4: Verificar lint**

Run: `npx eslint components/plans/my-plans-screen.jsx components/plans/today-session-card.jsx`
Expected: sin errores.

- [ ] **Step 5: Verificar en preview**

Como corredor con al menos un plan asignado y marcado como "actual"
(entorno de mock ya trae esto sembrado, ver `buildSeedRunnerPlanAssignments`/
`buildSeedCurrentPlanMarks` de `training-plans-mock.js`): "Mis planes"
sin badge de vigencia en las filas; hero arriba muestra "Todavía no
tiene un calendario asignado" en vez de intentar resolver el día de
hoy.

- [ ] **Step 6: Commit**

```bash
git add components/plans/my-plans-screen.jsx components/plans/today-session-card.jsx
git rm hooks/use-today-plan-session.js
git commit -m "feat(training-plans): replace today's-session hero, drop runner-side vigencia badge"
```

---

### Task 8: Ripple en pantallas del entrenador — sin badge de vigencia, "Día N"

**Files:**
- Modify: `components/plans/training-plans-screen.jsx`
- Modify: `components/plans/training-plan-detail-screen.jsx`

**Interfaces:**
- Consumes: nada de tasks de código anteriores.
- Produces: nada.

- [ ] **Step 1: `training-plans-screen.jsx` — sacar `STATUS_META`/`getPlanStatus`**

Cambiar el import (línea 10):

```js
import { useTrainingPlanStore } from '../../store/training-plan-store.js';
```

Borrar `STATUS_META` (líneas 18-21). Reemplazar `PlanRow` (líneas
33-59):

```jsx
function PlanRow({ plan, onPress }) {
  const trainingDaysCount = plan.days.filter((d) => d.kind === 'training').length;

  return (
    <Pressable
      className="flex-row items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 hover:bg-slate-100 active:opacity-80 dark:border-slate-700 dark:bg-slate-900 dark:hover:bg-slate-800"
      nativeID={`training-plan-row-${plan.id}`}
      onPress={onPress}
      testID={`training-plan-row-${plan.id}`}
    >
      <View className="h-10 w-10 items-center justify-center rounded-full bg-primary-tint dark:bg-primary/15" nativeID={`training-plan-row-${plan.id}-icon`} testID={`training-plan-row-${plan.id}-icon`}>
        <MaterialCommunityIcons color="#8cc63e" name="clipboard-text-outline" size={18} />
      </View>
      <View className="flex-1" nativeID={`training-plan-row-${plan.id}-info`} testID={`training-plan-row-${plan.id}-info`}>
        <Text className="text-sm font-semibold text-slate-900 dark:text-white" nativeID={`training-plan-row-${plan.id}-name`} numberOfLines={1} testID={`training-plan-row-${plan.id}-name`}>
          {plan.name}
        </Text>
        <Text className="text-xs text-slate-500 dark:text-slate-400" nativeID={`training-plan-row-${plan.id}-meta`} testID={`training-plan-row-${plan.id}-meta`}>
          {plan.days.length} días · {trainingDaysCount} {trainingDaysCount === 1 ? 'sesión' : 'sesiones'} de entrenamiento
        </Text>
      </View>
      <MaterialCommunityIcons color="#94a3b8" name="chevron-right" size={20} />
    </Pressable>
  );
}
```

- [ ] **Step 2: `training-plan-detail-screen.jsx` — sacar `STATUS_META`/`getPlanStatus`/badge/"caduca", "Día N"**

Cambiar el import (línea 10):

```js
import { useTrainingPlanStore } from '../../store/training-plan-store.js';
```

Borrar `STATUS_META` (líneas 19-22 actuales). En `DayRow` (línea 77),
cambiar `{dayLabel(day.dayOfWeek)}` por `` {`Día ${day.sequenceNo}`} ``,
y sacar el import de `dayLabel` de la línea 10 (queda
`import { useTrainingPlanStore } from ...` sin `getPlanStatus, dayLabel`).

En el componente principal, borrar la línea `const status =
getPlanStatus(plan);` y `const statusMeta = STATUS_META[status];`
(líneas 199-200 actuales). Reemplazar el bloque del título/badge/duración
(líneas 251-263 actuales):

```jsx
            <View className="mb-1 flex-row flex-wrap items-center gap-2" nativeID="training-plan-detail-title-row" testID="training-plan-detail-title-row">
              <Text className="text-xl text-slate-900 dark:text-white" nativeID="training-plan-detail-name" style={{ fontFamily: 'Orbitron_700Bold' }} testID="training-plan-detail-name">
                {plan.name}
              </Text>
            </View>
            <Text className="text-sm text-slate-500 dark:text-slate-400" nativeID="training-plan-detail-duration" testID="training-plan-detail-duration">
              {plan.days.length} días
            </Text>
```

- [ ] **Step 3: Verificar lint y test completos**

Run: `npm run lint && npm test`
Expected: sin errores, todos los tests pasan.

- [ ] **Step 4: Verificar en preview**

Catálogo de planes: filas sin badge de vigencia, con "N días · M
sesiones de entrenamiento". Detalle de un plan: sin badge
Activo/Vencido, sin "Caduca a los N días" (reemplazado por "N días"),
días numerados "Día 1".."Día N".

- [ ] **Step 5: Commit**

```bash
git add components/plans/training-plans-screen.jsx components/plans/training-plan-detail-screen.jsx
git commit -m "feat(training-plans): drop trainer-side vigencia badge, numbered days in detail"
```

---

### Task 9: Actualizar `docs/BACKEND_TRAINING_PLANS_SPEC.md`

**Files:**
- Modify: `docs/BACKEND_TRAINING_PLANS_SPEC.md`

**Interfaces:**
- Consumes: nada.
- Produces: nada — documentación.

- [ ] **Step 1: Reemplazar §3.4 `TrainingPlan`**

```markdown
### 3.4 `TrainingPlan`

| Campo | Tipo | Nullable | Notas |
|---|---|---|---|
| `id` | bigint PK | no | |
| `owner_id` | bigint FK → user | no | el entrenador dueño — el plan es reusable/asignable a cualquiera de sus equipos/grupos/corredores, no pertenece a un equipo |
| `name` | varchar | no | |
| `description` | text | sí | |
| `created_at` / `updated_at` | timestamptz | no | |

**Sin caducidad propia** (decisión 2026-09-10, reemplaza el modelo
anterior de `duration_days` 7/14 con `status` derivado) — un plan es un
template puro, reusable indefinidamente. La noción de "vigencia" pasa
a resolverse en la futura capa de asignación/calendario (fuera de
alcance de este documento), no en el plan en sí.
```

- [ ] **Step 2: Reemplazar §3.5 `PlanDay`**

```markdown
### 3.5 `PlanDay` (entre 2 y 31 filas por plan, tabla propia)

| Campo | Tipo | Nullable | Notas |
|---|---|---|---|
| `plan_id` | bigint FK → training_plan | no | `ON DELETE CASCADE` |
| `sequence_no` | int | no | `1`..`N`, `N` = cantidad de días del plan (entre 2 y 31) |
| `kind` | enum | no | `rest` \| `other` \| `training` |
| `other_name` | varchar | sí | obligatorio *solo* si `kind = 'other'` |
| `session_id` | bigint FK → session | sí | obligatorio *solo* si `kind = 'training'` |

**Sin `day_of_week`** (decisión 2026-09-10) — un plan-template ya no se
ata a un día real de la semana; los días son puramente secuenciales
(`sequence_no`). Esto reemplaza el modelo anterior de exactamente 7
filas, una por cada día de la semana.

**Validación al crear/editar un plan** (ya implementada del lado mock,
el backend debe re-validarla, nunca confiar solo en el frontend):
- Entre 2 y 31 filas.
- `sequence_no` cubre `1..N` sin repetidos, donde `N` es la cantidad de
  filas.
- `kind = 'training'` ⇒ `session_id` no nulo (y `other_name` nulo).
- `kind = 'other'` ⇒ `other_name` no nulo (y `session_id` nulo).
- `kind = 'rest'` ⇒ ambos nulos.
```

- [ ] **Step 3: Commit**

```bash
git add docs/BACKEND_TRAINING_PLANS_SPEC.md
git commit -m "docs: update BACKEND_TRAINING_PLANS_SPEC for variable-duration plans"
```

---

### Task 10: Barrido final y version bump

**Files:**
- Modify: `package.json`

**Interfaces:**
- Consumes: nada nuevo.
- Produces: nada — último task de este plan (sub-proyecto 2 de 3).

- [ ] **Step 1: Bump de versión**

Confirmar el valor actual de `"version"` en `package.json` e
incrementar un **minor** (cambio de modelo con ripple en varias
pantallas, no un fix puntual).

- [ ] **Step 2: Suite completa**

Run: `npm test`
Expected: todos los tests pasan.

Run: `npm run lint`
Expected: sin errores.

- [ ] **Step 3: Barrido de preview**

Repetir en una sola pasada: crear/editar un plan con cantidad de días
variable, ver el detalle (entrenador), ver "Mis planes" y el hero
(corredor, si el entorno tiene un plan asignado).

- [ ] **Step 4: Commit**

```bash
git add package.json
git commit -m "chore: version bump for training plans variable duration"
```
