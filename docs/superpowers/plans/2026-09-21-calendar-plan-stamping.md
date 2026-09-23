# Calendario de asignaciones — Pieza 2 (estampado de plan) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> **Execution note:** el usuario de este proyecto pidió explícitamente, y de forma repetida, el método de ejecución más barato en tokens ("quiero realmente el mas barato, no me importa que sea el mas lento, quiero el mas barato"). Salvo instrucción nueva en contrario, preferir `superpowers:executing-plans` (inline, misma sesión) sobre `subagent-driven-development` para este plan — igual que la pieza 1 del mismo sub-proyecto.

**Goal:** permitir que un entrenador "estampe" un `TrainingPlan` completo sobre el calendario de un grupo (elegir plan + fecha de inicio, revisar/ajustar un preview local día por día, y persistir todo de una vez), y que el catálogo de planes soporte marcar un día como presencial por default (horario, sin ubicación).

**Architecture:** un modal de 2 pasos (`StampPlanModal`) arma un preview 100% local a partir de los días del plan elegido (`buildStampDraft`), permite editar cualquier día del preview con un componente de campos compartido (`CalendarDayFields`, extraído de la pantalla de día suelto de la pieza 1), y al guardar dispara un único `POST stamp` más un `PUT` por cada día tocado a mano. El catálogo de planes (`TrainingPlanFormFields`) suma presencial+horario por día, sin ubicación (queda para el momento de estampar).

**Tech Stack:** React Native + Expo Router, TanStack Query, Zustand (solo para lo que ya vivía en `training-plan-store.js`), Jest para lógica pura.

**Spec:** `docs/superpowers/specs/2026-09-21-calendar-plan-stamping-design.md`

## Global Constraints

- Todo `View`/`Text`/`Pressable`/`TextInput`/`Modal`/etc necesita `nativeID` + `testID` únicos en su contexto (regla de ESLint `local/require-native-id`, CLAUDE.md).
- Nunca importar `SelectField`/`PickerField` directo — siempre `ResponsiveSelectField` (regla `local/no-direct-select-field`).
- Todo `<Modal>` con backdrop debe cerrar al click afuera, mismo handler que `onRequestClose` (regla `local/require-modal-backdrop-close`).
- `npm test` (Jest, solo lógica pura — sin tests de render de componentes, convención del proyecto) y `npm run lint` deben quedar en verde antes de cada commit.
- Fechas de calendario siempre en formato ISO `'YYYY-MM-DD'` internamente (mismo criterio que `GroupCalendarDay.date`/`utils/calendar-day-closed.js`).
- No hay cambios de backend pendientes — todos los endpoints que usa este plan (`stamp`, y los campos `default_presencial`/`default_time_from`/`default_time_to` de `PlanDay`) ya están deployados.

---

### Task 1: Utilidades de fecha puras (`toISODate`, `buildStampDraft`, `findClosedDraftDates`)

**Files:**
- Create: `utils/date-field-format.js`
- Create: `__tests__/date-field-format.test.js`
- Create: `utils/build-stamp-draft.js`
- Create: `__tests__/build-stamp-draft.test.js`

**Interfaces:**
- Consumes: `isCalendarDayClosed(dateStr, { isPresencial, presencialTimeFrom } = {}, now = new Date())` de `utils/calendar-day-closed.js` (ya existe, pieza 1, sin cambios).
- Produces:
  - `toISODate(value: string) -> string` — acepta `'DD/MM/YYYY'` (valor que devuelve `DateField` en nativo) o `'YYYY-MM-DD'` (valor que devuelve `DateField` en web), siempre devuelve `'YYYY-MM-DD'`. Devuelve `''` si `value` es falsy o no matchea ningún formato.
  - `addDaysISO(isoDate: string, daysToAdd: number) -> string` — fecha ISO + N días, maneja cruce de mes/año.
  - `buildStampDraft(plan: { days: PlanDayModel[] }, startDate: string) -> DraftDay[]` — `PlanDayModel` es la forma que devuelve `toPlanDayModel` en `services/normalizers.js` DESPUÉS del Task 2 de este plan (`{ sequenceNo, kind, otherName, sessionId, isPresencial, presencialTimeFrom, presencialTimeTo }`). `DraftDay` es exactamente:
    ```js
    {
      date: string,              // 'YYYY-MM-DD'
      sequenceNo: number,
      kind: 'rest' | 'other' | 'training',
      otherName: string | null,
      sessionId: string | null,
      isPresencial: boolean,
      presencialTimeFrom: string | null,
      presencialTimeTo: string | null,
      presencialLocation: null,  // siempre null al inicializar — ver spec §2
      touched: false,
    }
    ```
    Este shape lo consume Task 8 (`StampPlanModal`) tal cual, sin ninguna transformación intermedia.
  - `findClosedDraftDates(draftDays: DraftDay[], now: Date = new Date()) -> string[]` — array de `date` (ISO) de los `draftDays` que `isCalendarDayClosed` considera cerrados, usando el `isPresencial`/`presencialTimeFrom` propio de CADA `draftDay` (no un valor fijo). Array vacío si ninguno está cerrado.

- [ ] **Step 1: Escribir los tests de `toISODate`**

```js
// __tests__/date-field-format.test.js
import { toISODate } from '../utils/date-field-format.js';

describe('toISODate', () => {
  test('convierte DD/MM/YYYY (valor nativo de DateField) a YYYY-MM-DD', () => {
    expect(toISODate('15/03/2026')).toBe('2026-03-15');
  });

  test('deja YYYY-MM-DD (valor web de DateField) sin cambios', () => {
    expect(toISODate('2026-03-15')).toBe('2026-03-15');
  });

  test('devuelve string vacío si el valor es vacío o inválido', () => {
    expect(toISODate('')).toBe('');
    expect(toISODate(undefined)).toBe('');
    expect(toISODate('no es una fecha')).toBe('');
  });
});
```

- [ ] **Step 2: Correr el test, debe fallar**

Run: `npx jest date-field-format -t toISODate`
Expected: FAIL — `Cannot find module '../utils/date-field-format.js'`

- [ ] **Step 3: Implementar `toISODate`**

```js
// utils/date-field-format.js
// DateField (components/forms/fields.jsx) devuelve un formato de fecha
// distinto según plataforma: 'YYYY-MM-DD' en web (input type="date"
// nativo del navegador), 'DD/MM/YYYY' en mobile nativo (mismo criterio
// que utils/date-validators.js#validateBirthDate, que ya acepta ambos).
// Esta función normaliza siempre a ISO, que es lo que espera el backend
// del calendario (start_date del endpoint stamp) y lo que usan las
// funciones de utils/calendar-day-closed.js y utils/build-stamp-draft.js.
export function toISODate(value) {
  if (!value) return '';
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (iso) return value;
  const dmy = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(value);
  if (dmy) return `${dmy[3]}-${dmy[2]}-${dmy[1]}`;
  return '';
}
```

- [ ] **Step 4: Correr el test, debe pasar**

Run: `npx jest date-field-format`
Expected: PASS (3/3)

- [ ] **Step 5: Escribir los tests de `buildStampDraft` y `findClosedDraftDates`**

```js
// __tests__/build-stamp-draft.test.js
import { addDaysISO, buildStampDraft, findClosedDraftDates } from '../utils/build-stamp-draft.js';

const PLAN = {
  days: [
    { sequenceNo: 1, kind: 'training', otherName: null, sessionId: '9', isPresencial: true, presencialTimeFrom: '08:00', presencialTimeTo: '09:30' },
    { sequenceNo: 2, kind: 'rest', otherName: null, sessionId: null, isPresencial: false, presencialTimeFrom: null, presencialTimeTo: null },
    { sequenceNo: 3, kind: 'other', otherName: 'Elongación', sessionId: null, isPresencial: false, presencialTimeFrom: null, presencialTimeTo: null },
  ],
};

describe('addDaysISO', () => {
  test('suma días dentro del mismo mes', () => {
    expect(addDaysISO('2026-03-10', 3)).toBe('2026-03-13');
  });

  test('cruza de mes correctamente', () => {
    expect(addDaysISO('2026-01-30', 2)).toBe('2026-02-01');
  });

  test('cruza de año correctamente (fin de diciembre)', () => {
    expect(addDaysISO('2026-12-30', 2)).toBe('2027-01-01');
  });

  test('con 0 días devuelve la misma fecha', () => {
    expect(addDaysISO('2026-03-10', 0)).toBe('2026-03-10');
  });
});

describe('buildStampDraft', () => {
  test('arma un draftDay por día del plan, con fecha calculada desde sequenceNo', () => {
    const draft = buildStampDraft(PLAN, '2026-03-10');
    expect(draft).toHaveLength(3);
    expect(draft.map((d) => d.date)).toEqual(['2026-03-10', '2026-03-11', '2026-03-12']);
  });

  test('copia kind/otherName/sessionId/presencial+horario del PlanDay', () => {
    const [first] = buildStampDraft(PLAN, '2026-03-10');
    expect(first).toEqual({
      date: '2026-03-10',
      sequenceNo: 1,
      kind: 'training',
      otherName: null,
      sessionId: '9',
      isPresencial: true,
      presencialTimeFrom: '08:00',
      presencialTimeTo: '09:30',
      presencialLocation: null,
      touched: false,
    });
  });

  test('presencialLocation siempre arranca null y touched siempre arranca false', () => {
    const draft = buildStampDraft(PLAN, '2026-03-10');
    expect(draft.every((d) => d.presencialLocation === null && d.touched === false)).toBe(true);
  });

  test('un plan que empieza cerca de fin de mes calcula bien el cruce', () => {
    const draft = buildStampDraft(PLAN, '2026-01-30');
    expect(draft.map((d) => d.date)).toEqual(['2026-01-30', '2026-01-31', '2026-02-01']);
  });
});

describe('findClosedDraftDates', () => {
  const NOW = new Date(2026, 2, 15, 10, 0, 0); // 2026-03-15 10:00, hora local

  test('fechas pasadas están cerradas', () => {
    const draft = buildStampDraft(PLAN, '2026-03-10');
    expect(findClosedDraftDates(draft, NOW)).toEqual(['2026-03-10', '2026-03-11', '2026-03-12']);
  });

  test('fechas futuras no están cerradas', () => {
    const draft = buildStampDraft(PLAN, '2026-04-01');
    expect(findClosedDraftDates(draft, NOW)).toEqual([]);
  });

  test('un día de HOY presencial con horario aún no arrancado no está cerrado', () => {
    const draft = [{ date: '2026-03-15', sequenceNo: 1, kind: 'training', otherName: null, sessionId: '9', isPresencial: true, presencialTimeFrom: '18:00', presencialTimeTo: '19:00', presencialLocation: null, touched: false }];
    expect(findClosedDraftDates(draft, NOW)).toEqual([]);
  });

  test('un día de HOY presencial con horario ya arrancado está cerrado', () => {
    const draft = [{ date: '2026-03-15', sequenceNo: 1, kind: 'training', otherName: null, sessionId: '9', isPresencial: true, presencialTimeFrom: '08:00', presencialTimeTo: '09:00', presencialLocation: null, touched: false }];
    expect(findClosedDraftDates(draft, NOW)).toEqual(['2026-03-15']);
  });

  test('un día de HOY no presencial siempre está cerrado', () => {
    const draft = [{ date: '2026-03-15', sequenceNo: 1, kind: 'rest', otherName: null, sessionId: null, isPresencial: false, presencialTimeFrom: null, presencialTimeTo: null, presencialLocation: null, touched: false }];
    expect(findClosedDraftDates(draft, NOW)).toEqual(['2026-03-15']);
  });
});
```

- [ ] **Step 6: Correr los tests, deben fallar**

Run: `npx jest build-stamp-draft`
Expected: FAIL — `Cannot find module '../utils/build-stamp-draft.js'`

- [ ] **Step 7: Implementar `utils/build-stamp-draft.js`**

```js
// utils/build-stamp-draft.js
import { isCalendarDayClosed } from './calendar-day-closed.js';

// Suma días de calendario a una fecha ISO ('YYYY-MM-DD'), manejando
// cruce de mes/año — construye un Date real a partir de los componentes
// Y-M-D (no concatenación de strings) para que el cruce lo resuelva el
// motor de fechas de JS, no lógica escrita a mano.
export function addDaysISO(isoDate, daysToAdd) {
  const [year, month, day] = isoDate.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  date.setDate(date.getDate() + daysToAdd);
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

// Arma el preview local de "estampar un plan a partir de tal fecha" —
// un draftDay por PlanDay del plan, con la fecha real calculada
// (día 1 del plan → startDate, día 2 → startDate + 1, etc, ver
// docs/BACKEND_CALENDAR_ASSIGNMENTS_SPEC.md §4). `presencialLocation`
// arranca siempre null — el catálogo de planes no guarda ubicación (ver
// docs/superpowers/specs/2026-09-21-calendar-plan-stamping-design.md §2),
// se completa recién acá, por estampado. `touched` arranca en false —
// se vuelve true cuando el entrenador edita ese día a mano en el preview
// (stamp-plan-modal.jsx), y decide qué días llevan un PUT extra después
// del stamp.
export function buildStampDraft(plan, startDate) {
  return plan.days.map((day) => ({
    date: addDaysISO(startDate, day.sequenceNo - 1),
    sequenceNo: day.sequenceNo,
    kind: day.kind,
    otherName: day.otherName,
    sessionId: day.sessionId,
    isPresencial: Boolean(day.isPresencial),
    presencialTimeFrom: day.presencialTimeFrom ?? null,
    presencialTimeTo: day.presencialTimeTo ?? null,
    presencialLocation: null,
    touched: false,
  }));
}

// Qué fechas del preview quedarían cerradas (pasadas, o presencial de
// hoy ya arrancado) si se estampara ahora mismo — usa el isPresencial/
// horario propio de CADA draftDay, no un valor fijo, porque la única
// fecha donde eso importa es HOY (ver utils/calendar-day-closed.js): el
// resto del rango es simplemente pasado o futuro sin importar presencial.
export function findClosedDraftDates(draftDays, now = new Date()) {
  return draftDays
    .filter((d) => isCalendarDayClosed(d.date, { isPresencial: d.isPresencial, presencialTimeFrom: d.presencialTimeFrom }, now))
    .map((d) => d.date);
}
```

- [ ] **Step 8: Correr los tests, deben pasar**

Run: `npx jest date-field-format build-stamp-draft`
Expected: PASS (todos)

- [ ] **Step 9: Commit**

```bash
git add utils/date-field-format.js utils/build-stamp-draft.js __tests__/date-field-format.test.js __tests__/build-stamp-draft.test.js
git commit -m "feat(calendar): add pure date utilities for plan stamping"
```

---

### Task 2: `PlanDay` presencial fields + `toStampPayload` en `services/normalizers.js`

**Files:**
- Modify: `services/normalizers.js` (funciones `toPlanDayModel`/`toPlanDayPayload`, ambas privadas del módulo, más nueva función exportada `toStampPayload`)
- Modify: `__tests__/normalizers.test.js`

**Interfaces:**
- Consumes: nada nuevo — extiende funciones ya existentes.
- Produces: `toStampPayload({ planId, startDate, force }) -> { plan_id: number, start_date: string, force: boolean }`, consumido por Task 4 (`hooks/use-group-calendar.js`).
  `toPlanDayModel`/`toPlanDayPayload` siguen privados (no exportados) — se testean indirecto a través de `toTrainingPlanModel`/`toCreateTrainingPlanPayload`, que sí están exportados y ya se usan en `hooks/use-training-plans.js` sin cambios de firma.

- [ ] **Step 1: Escribir los tests (indirectos vía `toTrainingPlanModel`/`toCreateTrainingPlanPayload`, más uno directo de `toStampPayload`)**

Agregar al final de `__tests__/normalizers.test.js`:

```js
import { toTrainingPlanModel, toCreateTrainingPlanPayload, toStampPayload } from '../services/normalizers.js';

describe('toTrainingPlanModel — PlanDay presencial', () => {
  test('mapea default_presencial/default_time_from/default_time_to a isPresencial/presencialTimeFrom/presencialTimeTo', () => {
    const dto = {
      id: 1, owner_id: 7, name: 'Plan', description: '', created_at: 'x', updated_at: 'x',
      days: [
        { sequence_no: 1, kind: 'training', other_name: null, session_id: 9, default_presencial: true, default_time_from: '08:00', default_time_to: '09:30' },
        { sequence_no: 2, kind: 'rest', other_name: null, session_id: null, default_presencial: false, default_time_from: null, default_time_to: null },
      ],
    };
    const model = toTrainingPlanModel(dto);
    expect(model.days[0]).toMatchObject({ isPresencial: true, presencialTimeFrom: '08:00', presencialTimeTo: '09:30' });
    expect(model.days[1]).toMatchObject({ isPresencial: false, presencialTimeFrom: null, presencialTimeTo: null });
  });

  test('un PlanDay sin default_presencial (planes viejos, campo nunca seteado) mapea isPresencial false', () => {
    const dto = {
      id: 1, owner_id: 7, name: 'Plan', description: '', created_at: 'x', updated_at: 'x',
      days: [{ sequence_no: 1, kind: 'rest', other_name: null, session_id: null }],
    };
    expect(toTrainingPlanModel(dto).days[0]).toMatchObject({ isPresencial: false, presencialTimeFrom: null, presencialTimeTo: null });
  });
});

describe('toCreateTrainingPlanPayload — PlanDay presencial', () => {
  test('un día training presencial manda default_presencial true + horarios', () => {
    const form = {
      ownerId: 7, name: 'Plan', description: '',
      days: [{ sequenceNo: 1, kind: 'training', otherName: null, sessionId: '9', isPresencial: true, presencialTimeFrom: '08:00', presencialTimeTo: '09:30' }],
    };
    expect(toCreateTrainingPlanPayload(form).days[0]).toMatchObject({
      default_presencial: true, default_time_from: '08:00', default_time_to: '09:30',
    });
  });

  test('un día no presencial manda default_presencial false y horarios null', () => {
    const form = {
      ownerId: 7, name: 'Plan', description: '',
      days: [{ sequenceNo: 1, kind: 'rest', otherName: null, sessionId: null, isPresencial: false, presencialTimeFrom: '', presencialTimeTo: '' }],
    };
    expect(toCreateTrainingPlanPayload(form).days[0]).toMatchObject({
      default_presencial: false, default_time_from: null, default_time_to: null,
    });
  });
});

describe('toStampPayload', () => {
  test('arma el body de POST stamp', () => {
    expect(toStampPayload({ planId: '5', startDate: '2026-03-10', force: false })).toEqual({
      plan_id: 5, start_date: '2026-03-10', force: false,
    });
  });

  test('force default a false si no se pasa', () => {
    expect(toStampPayload({ planId: '5', startDate: '2026-03-10' })).toEqual({
      plan_id: 5, start_date: '2026-03-10', force: false,
    });
  });
});
```

- [ ] **Step 2: Correr los tests, deben fallar**

Run: `npx jest normalizers.test.js -t "PlanDay presencial|toStampPayload"`
Expected: FAIL — `toStampPayload is not a function`, y los `toMatchObject` de presencial no matchean (undefined en vez de boolean/string).

- [ ] **Step 3: Editar `toPlanDayModel`/`toPlanDayPayload`, agregar `toStampPayload`**

Ubicar `toPlanDayModel` (actualmente):
```js
function toPlanDayModel(dto) {
  return {
    sequenceNo: dto.sequence_no,
    kind: dto.kind,
    otherName: dto.other_name ?? null,
    sessionId: dto.session_id != null ? String(dto.session_id) : null,
  };
}
```
Reemplazar por:
```js
function toPlanDayModel(dto) {
  return {
    sequenceNo: dto.sequence_no,
    kind: dto.kind,
    otherName: dto.other_name ?? null,
    sessionId: dto.session_id != null ? String(dto.session_id) : null,
    isPresencial: Boolean(dto.default_presencial),
    presencialTimeFrom: dto.default_time_from ?? null,
    presencialTimeTo: dto.default_time_to ?? null,
  };
}
```

Ubicar `toPlanDayPayload` (actualmente):
```js
function toPlanDayPayload(day) {
  return {
    sequence_no: day.sequenceNo,
    kind: day.kind,
    other_name: day.kind === 'other' ? day.otherName : null,
    session_id: day.kind === 'training' && day.sessionId ? Number(day.sessionId) : null,
  };
}
```
Reemplazar por:
```js
function toPlanDayPayload(day) {
  const presencial = day.kind === 'training' && Boolean(day.isPresencial);
  return {
    sequence_no: day.sequenceNo,
    kind: day.kind,
    other_name: day.kind === 'other' ? day.otherName : null,
    session_id: day.kind === 'training' && day.sessionId ? Number(day.sessionId) : null,
    default_presencial: presencial,
    default_time_from: presencial ? day.presencialTimeFrom : null,
    default_time_to: presencial ? day.presencialTimeTo : null,
  };
}
```

Agregar, después de `toCalendarDayPayload` (al final del bloque de calendario, antes de que termine el archivo):
```js
// Body de POST /groups/{id}/calendar/stamp — ver
// docs/BACKEND_CALENDAR_ASSIGNMENTS_SPEC.md §4.
export function toStampPayload({ planId, startDate, force }) {
  return { plan_id: Number(planId), start_date: startDate, force: Boolean(force) };
}
```

- [ ] **Step 4: Correr los tests, deben pasar**

Run: `npx jest normalizers.test.js`
Expected: PASS (todos, incluidos los ya existentes — no debería haber roto ninguno)

- [ ] **Step 5: Commit**

```bash
git add services/normalizers.js __tests__/normalizers.test.js
git commit -m "feat(calendar): map PlanDay presencial fields + add toStampPayload"
```

---

### Task 3: `stampPlan` en `services/calendar.js` + mock

**Files:**
- Modify: `services/api.js` (adjuntar el body parseado al error, no solo `.status`)
- Modify: `services/calendar.js`
- Modify: `services/__mocks__/calendar-mock.js`
- Modify: `__tests__/calendar-mock.test.js`

**Interfaces:**
- Consumes: `toStampPayload` (Task 2, ya definida, pero `stampPlan` NO la llama — quien arma el payload es `hooks/use-group-calendar.js` en el Task 4; `stampPlan` recibe el payload ya armado en snake_case y solo hace el `POST`). `mockGetTrainingPlan(planId)` de `services/__mocks__/training-plans-mock.js` (ya existe, devuelve el dto snake_case del plan con `days` incluyendo, después del Task 2, `default_presencial`/`default_time_from`/`default_time_to`). `addDaysISO` de `utils/build-stamp-draft.js` (Task 1).
- Produces: `stampPlan(groupId, payload: { plan_id, start_date, force }) -> Promise<{ conflict: false, days: GroupCalendarDayDTO[] } | { conflict: true, dates: string[] }>` — nunca lanza en el caso de conflicto (409), solo en errores reales (red, 500, etc). Consumido por Task 4.

- [ ] **Step 1: Adjuntar el body de error en `services/api.js`**

En `services/api.js`, ubicar:
```js
    const error = new Error(mapHttpErrorMessage(response.status, body?.message));
    error.status = response.status;
    throw error;
```
Reemplazar por:
```js
    const error = new Error(mapHttpErrorMessage(response.status, body?.message));
    error.status = response.status;
    error.data = body;
    throw error;
```

(Sin test dedicado — `api.js` no tiene suite propia hoy, se ejercita indirecto por cualquier service que ya lo use; el 409 con body se cubre en el test del mock de este mismo Task, que no pasa por `api.js` real, y el camino real se verifica en el script de test manual del Task 9.)

- [ ] **Step 2: Escribir los tests del mock de `stampPlan`**

Agregar a `__tests__/calendar-mock.test.js`:

```js
import { mockStampPlan } from '../services/__mocks__/calendar-mock.js';
import { mockCreateTrainingPlan, __resetMockTrainingPlans } from '../services/__mocks__/training-plans-mock.js';

beforeEach(() => {
  __resetMockCalendar();
  __resetMockSessions();
  __resetMockTrainingPlans();
});

describe('mockStampPlan', () => {
  test('crea un GroupCalendarDay por cada día del plan, con fechas correlativas', async () => {
    const plan = await mockCreateTrainingPlan({
      owner_id: 1, name: 'Plan test', description: '',
      days: [
        { sequence_no: 1, kind: 'training', other_name: null, session_id: 1, default_presencial: false, default_time_from: null, default_time_to: null },
        { sequence_no: 2, kind: 'rest', other_name: null, session_id: null, default_presencial: false, default_time_from: null, default_time_to: null },
      ],
    });
    const result = await mockStampPlan(1, { plan_id: plan.id, start_date: '2026-10-05', force: false });
    expect(result.conflict).toBe(false);
    expect(result.days).toHaveLength(2);
    expect(result.days.map((d) => d.date)).toEqual(['2026-10-05', '2026-10-06']);
    expect(result.days[0].session_instance.name).toBe('Fondo suave');
    expect(result.days[0].source_plan_id).toBe(plan.id);
  });

  test('copia default_presencial/default_time_from/default_time_to a is_presencial/presencial_time_from/presencial_time_to', async () => {
    const plan = await mockCreateTrainingPlan({
      owner_id: 1, name: 'Plan presencial', description: '',
      days: [{ sequence_no: 1, kind: 'training', other_name: null, session_id: 1, default_presencial: true, default_time_from: '08:00', default_time_to: '09:30' }],
    });
    const result = await mockStampPlan(1, { plan_id: plan.id, start_date: '2026-10-05', force: false });
    expect(result.days[0].is_presencial).toBe(true);
    expect(result.days[0].presencial_time_from).toBe('08:00');
    expect(result.days[0].presencial_time_to).toBe('09:30');
    expect(result.days[0].presencial_location).toBeNull();
  });

  test('si algún día del rango ya tiene contenido y force no es true, devuelve conflicto sin escribir nada', async () => {
    await mockUpsertCalendarDay(1, '2026-10-06', { kind: 'rest' });
    const plan = await mockCreateTrainingPlan({
      owner_id: 1, name: 'Plan test', description: '',
      days: [
        { sequence_no: 1, kind: 'rest', other_name: null, session_id: null },
        { sequence_no: 2, kind: 'rest', other_name: null, session_id: null },
      ],
    });
    const result = await mockStampPlan(1, { plan_id: plan.id, start_date: '2026-10-05', force: false });
    expect(result.conflict).toBe(true);
    expect(result.dates).toEqual(['2026-10-06']);
    expect(await mockGetGroupCalendar(1, '2026-10-05', '2026-10-06')).toHaveLength(1); // solo el que ya existía
  });

  test('con force=true, pisa los días en conflicto', async () => {
    await mockUpsertCalendarDay(1, '2026-10-06', { kind: 'rest' });
    const plan = await mockCreateTrainingPlan({
      owner_id: 1, name: 'Plan test', description: '',
      days: [
        { sequence_no: 1, kind: 'rest', other_name: null, session_id: null },
        { sequence_no: 2, kind: 'other', other_name: 'Pisado', session_id: null },
      ],
    });
    const result = await mockStampPlan(1, { plan_id: plan.id, start_date: '2026-10-05', force: true });
    expect(result.conflict).toBe(false);
    expect(result.days[1].other_name).toBe('Pisado');
  });
});
```

- [ ] **Step 3: Correr los tests, deben fallar**

Run: `npx jest calendar-mock.test.js -t mockStampPlan`
Expected: FAIL — `mockStampPlan is not a function`

- [ ] **Step 4: Implementar `mockStampPlan` en `services/__mocks__/calendar-mock.js`**

Agregar el import al tope del archivo (junto al de `mockGetSession`):
```js
import { mockGetTrainingPlan } from './training-plans-mock.js';
import { addDaysISO } from '../../utils/build-stamp-draft.js';
```

Agregar la función, después de `mockUpsertCalendarDay` y antes de `mockDeleteCalendarDay`:
```js
export async function mockStampPlan(groupId, { plan_id, start_date, force }) {
  const plan = await mockGetTrainingPlan(plan_id);
  const dates = plan.days.map((_, i) => addDaysISO(start_date, i));

  const conflicts = dates.filter((date) => Boolean(mockCalendarDays[keyFor(groupId, date)]));
  if (conflicts.length > 0 && !force) {
    return { conflict: true, dates: conflicts };
  }

  const created = [];
  for (let i = 0; i < plan.days.length; i++) {
    const planDay = plan.days[i];
    const presencial = planDay.kind === 'training' && Boolean(planDay.default_presencial);
    const payload = {
      kind: planDay.kind,
      other_name: planDay.other_name,
      session_id: planDay.kind === 'training' ? planDay.session_id : undefined,
      is_presencial: presencial,
      presencial_time_from: presencial ? planDay.default_time_from : null,
      presencial_time_to: presencial ? planDay.default_time_to : null,
      presencial_location: null,
    };
    const savedDay = await mockUpsertCalendarDay(groupId, dates[i], payload);
    savedDay.source_plan_id = Number(plan_id);
    created.push(savedDay);
  }
  return { conflict: false, days: created };
}
```

- [ ] **Step 5: Correr los tests, deben pasar**

Run: `npx jest calendar-mock.test.js`
Expected: PASS (todos, incluidos los ya existentes de la pieza 1)

- [ ] **Step 6: Agregar `stampPlan` real a `services/calendar.js`**

```js
import {
  mockGetGroupCalendar,
  mockUpsertCalendarDay,
  mockDeleteCalendarDay,
  mockStampPlan,
} from './__mocks__/calendar-mock.js';
```

Agregar al final del archivo:
```js
// POST /api/v1/groups/{id}/calendar/stamp. 409 con { dates: [...] } si
// hay conflictos y no se pasó force — se devuelve como { conflict: true,
// dates } en vez de lanzar, porque es un resultado esperado del flujo
// (el modal lo muestra, no es un error real). Cualquier otro status sigue
// lanzando normal.
export async function stampPlan(groupId, payload) {
  if (USE_MOCKS) return await mockStampPlan(groupId, payload);
  try {
    const days = await api.post(`/groups/${groupId}/calendar/stamp`, payload);
    return { conflict: false, days };
  } catch (error) {
    if (error.status === 409) return { conflict: true, dates: error.data?.dates ?? [] };
    throw error;
  }
}
```

- [ ] **Step 7: Commit**

```bash
git add services/api.js services/calendar.js services/__mocks__/calendar-mock.js __tests__/calendar-mock.test.js
git commit -m "feat(calendar): add stampPlan service + mock with conflict handling"
```

---

### Task 4: `stampPlan`/`isStamping` en `hooks/use-group-calendar.js`

**Files:**
- Modify: `hooks/use-group-calendar.js`

**Interfaces:**
- Consumes: `stampPlan` (Task 3, `services/calendar.js`), `toStampPayload`/`toGroupCalendarDayModel` (Task 2 / ya existente, `services/normalizers.js`).
- Produces: `useGroupCalendarMutations(groupId)` ahora también devuelve `stampPlan: ({ planId, startDate, force }) => Promise<{ success: true, days: GroupCalendarDayModel[] } | { success: false, conflict: true, dates: string[] } | { success: false, conflict: false, error: string }>` e `isStamping: boolean`. Consumido por Task 8 (`StampPlanModal`).

- [ ] **Step 1: Editar `hooks/use-group-calendar.js`**

Cambiar el import de servicios:
```js
import {
  getGroupCalendar as getGroupCalendarService,
  upsertCalendarDay as upsertCalendarDayService,
  deleteCalendarDay as deleteCalendarDayService,
  stampPlan as stampPlanService,
} from '../services/calendar.js';
import { toGroupCalendarDayModel, toCalendarDayPayload, toStampPayload } from '../services/normalizers.js';
```

Dentro de `useGroupCalendarMutations`, agregar (después de `deleteDayMutation`, antes del `return`):
```js
  const stampPlanMutation = useMutation({
    mutationFn: async ({ planId, startDate, force }) => {
      try {
        const result = await stampPlanService(groupId, toStampPayload({ planId, startDate, force }));
        if (result.conflict) return { success: false, conflict: true, dates: result.dates };
        return { success: true, days: result.days.map(toGroupCalendarDayModel) };
      } catch (error) {
        return { success: false, conflict: false, error: error.message };
      }
    },
    onSuccess: (result) => { if (result.success) invalidate(); },
  });
```

Y en el `return`, agregar:
```js
  return {
    upsertDay: upsertDayMutation.mutateAsync,
    isUpserting: upsertDayMutation.isPending,
    deleteDay: deleteDayMutation.mutateAsync,
    isDeleting: deleteDayMutation.isPending,
    stampPlan: stampPlanMutation.mutateAsync,
    isStamping: stampPlanMutation.isPending,
  };
```

- [ ] **Step 2: Verificar que nada se rompió**

Run: `npm test`
Expected: PASS (este hook no tiene test propio — convención del proyecto, hooks de TanStack Query no se testean directo — pero confirma que ningún otro test que importe este archivo transitivamente se rompió)

- [ ] **Step 3: Commit**

```bash
git add hooks/use-group-calendar.js
git commit -m "feat(calendar): add stampPlan mutation to useGroupCalendarMutations"
```

---

### Task 5: `DateField` soporta fechas futuras (`minimumDate`/`disableFutureLimit`)

**Files:**
- Modify: `components/forms/fields.jsx`

**Interfaces:**
- Consumes: nada nuevo.
- Produces: `DateField` gana 2 props opcionales, `minimumDate?: Date` y `disableFutureLimit?: boolean` (default `false`). Con `disableFutureLimit=false` (default), comportamiento IDÉNTICO al actual (`maximumDate` fijo en hoy — usado por `register-screen.jsx`/`edit-profile-screen.jsx` para fecha de nacimiento, no se tocan). Con `disableFutureLimit=true`, no hay tope superior — usado por Task 8 (`StampPlanModal`) para elegir una fecha de inicio futura.

**Motivo:** `DateField` hoy hardcodea `maximumDate={new Date()}` en los dos `DateTimePicker` nativos (pensado para fecha de nacimiento) — sin este cambio, sería imposible elegir una fecha de inicio futura en mobile nativo (en web no aplica, el `<input type="date">` no tiene tope hoy).

- [ ] **Step 1: Editar la firma de `DateField`**

Ubicar:
```js
export function DateField({ label, value, onChange, onBlur, error, touched, disabled }) {
```
Reemplazar por:
```js
export function DateField({ label, value, onChange, onBlur, error, touched, disabled, minimumDate, disableFutureLimit = false }) {
```

- [ ] **Step 2: Editar el `DateTimePicker` de Android**

Ubicar:
```js
        <DateTimePicker
          accentColor="#8cc63e"
          display="default"
          maximumDate={new Date()}
          mode="date"
          onChange={handleChange}
          value={parseDDMMYYYY(value)}
        />
```
Reemplazar por:
```js
        <DateTimePicker
          accentColor="#8cc63e"
          display="default"
          maximumDate={disableFutureLimit ? undefined : new Date()}
          minimumDate={minimumDate}
          mode="date"
          onChange={handleChange}
          value={parseDDMMYYYY(value)}
        />
```

- [ ] **Step 3: Editar el `DateTimePicker` de iOS**

Ubicar:
```js
              <DateTimePicker
                display="inline"
                maximumDate={new Date()}
                mode="date"
                onChange={handleChange}
                themeVariant={themeMode}
                value={parseDDMMYYYY(value)}
              />
```
Reemplazar por:
```js
              <DateTimePicker
                display="inline"
                maximumDate={disableFutureLimit ? undefined : new Date()}
                minimumDate={minimumDate}
                mode="date"
                onChange={handleChange}
                themeVariant={themeMode}
                value={parseDDMMYYYY(value)}
              />
```

- [ ] **Step 4: Verificar que nada se rompió**

Run: `npm test && npm run lint`
Expected: PASS — sin tests de render, esto se verifica manual en el Task 9. `register-screen.jsx`/`edit-profile-screen.jsx` no pasan las props nuevas, así que su comportamiento no cambia (`disableFutureLimit` default `false`, `minimumDate` default `undefined`).

- [ ] **Step 5: Commit**

```bash
git add components/forms/fields.jsx
git commit -m "feat(forms): add minimumDate/disableFutureLimit to DateField"
```

---

### Task 6: Extraer `CalendarDayFields` de `group-calendar-day-screen.jsx`

**Files:**
- Create: `components/team/calendar-day-fields.jsx`
- Modify: `components/team/group-calendar-day-screen.jsx`

**Interfaces:**
- Consumes: `TimeField`/`InputField` de `components/forms/fields.jsx`, `ResponsiveSelectField`, `LocationPicker` de `components/shared/location-picker` (ya existían, sin cambios de firma — `LocationPicker({ value, onChange })`).
- Produces: `CalendarDayFields(props)`, componente presentacional puro (sin estado propio), prop contract EXACTO (Task 8 lo consume con este mismo contrato, sin variaciones):
  ```js
  {
    idPrefix: string,               // prefijo único de nativeID/testID para esta instancia — el caller decide el namespace (ej. 'group-calendar-day' en la pantalla de día, `stamp-plan-day-${sequenceNo}` por fila del preview)
    kind: 'rest' | 'other' | 'training', onKindChange: (kind: string) => void,
    otherName: string, onOtherNameChange: (text: string) => void,
    sessionId: string, onSessionIdChange: (id: string) => void,
    sessionOptions: Array<{ id: string, name: string }>,
    isPresencial: boolean, onIsPresencialChange: (value: boolean) => void,
    presencialTimeFrom: string, onPresencialTimeFromChange: (value: string) => void,
    presencialTimeTo: string, onPresencialTimeToChange: (value: string) => void,
    presencialLocation: { lat, lng, label } | null, onPresencialLocationChange: (value) => void,
    currentSessionInstance: { name: string, description: string | null } | null,  // si hay una instancia YA guardada en este slot — muestra la caja "Sesión asignada actualmente" + el hint correspondiente. La pantalla de día suelto pasa `existingDay?.sessionInstance ?? null`; el preview de estampado (Task 8) siempre pasa `null` — un estampado no tiene concepto de "mantener la sesión actual", siempre asigna la del plan.
    disabled: boolean,               // deshabilita el KindSelector (loading state del caller, ej. isUpserting/isStamping)
  }
  ```

- [ ] **Step 1: Crear `components/team/calendar-day-fields.jsx`**

```jsx
import { Pressable, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useThemeColors } from '../../theme/colors.js';
import { InputField, TimeField } from '../forms/fields.jsx';
import { ResponsiveSelectField } from '../forms/responsive-select-field.jsx';
import { LocationPicker } from '../shared/location-picker';

const KIND_OPTIONS = [
  { id: 'rest', label: 'Descanso' },
  { id: 'other', label: 'Otra actividad' },
  { id: 'training', label: 'Entrenamiento' },
];

function KindSelector({ idPrefix, value, onChange, disabled }) {
  return (
    <View className="mb-5 flex-row gap-2" nativeID={`${idPrefix}-kind-selector`} testID={`${idPrefix}-kind-selector`}>
      {KIND_OPTIONS.map((opt) => {
        const selected = value === opt.id;
        return (
          <Pressable
            className={`flex-1 items-center rounded-xl border px-2 py-2.5 ${selected ? 'border-primary bg-primary-tint dark:bg-primary/15' : 'border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900'}`}
            disabled={disabled}
            key={opt.id}
            nativeID={`${idPrefix}-kind-${opt.id}`}
            onPress={() => onChange(opt.id)}
            testID={`${idPrefix}-kind-${opt.id}`}
          >
            <Text
              className={`text-xs font-semibold ${selected ? 'text-on-primary-tint dark:text-primary' : 'text-slate-600 dark:text-slate-300'}`}
              nativeID={`${idPrefix}-kind-${opt.id}-label`}
              testID={`${idPrefix}-kind-${opt.id}-label`}
            >
              {opt.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function PresencialToggle({ idPrefix, value, onChange, colors }) {
  return (
    <Pressable
      accessibilityLabel="¿Es presencial?"
      accessibilityRole="checkbox"
      accessibilityState={{ checked: value }}
      className="mb-4 flex-row items-center gap-3 py-1"
      nativeID={`${idPrefix}-presencial-checkbox`}
      onPress={() => onChange(!value)}
      testID={`${idPrefix}-presencial-checkbox`}
    >
      <View
        className={`h-5 w-5 items-center justify-center rounded border ${value ? 'border-primary bg-primary' : 'border-slate-300 dark:border-slate-600'}`}
        nativeID={`${idPrefix}-presencial-checkbox-box`}
        testID={`${idPrefix}-presencial-checkbox-box`}
      >
        {value && <MaterialCommunityIcons color={colors.onPrimary} name="check-bold" size={14} />}
      </View>
      <Text className="text-sm font-medium text-slate-900 dark:text-white" nativeID={`${idPrefix}-presencial-checkbox-label`} testID={`${idPrefix}-presencial-checkbox-label`}>
        ¿Es presencial?
      </Text>
    </Pressable>
  );
}

// Campos de "contenido de un día de calendario" (kind, sesión,
// presencial+horario+ubicación) — extraído de group-calendar-day-screen.jsx
// para reusarlo tal cual en cada fila expandida del preview de
// stamp-plan-modal.jsx. Sin estado propio: el caller controla todo por
// props (ver contrato completo en el plan que armó este archivo,
// docs/superpowers/plans/2026-09-21-calendar-plan-stamping.md, Task 6).
export function CalendarDayFields({
  idPrefix,
  kind, onKindChange,
  otherName, onOtherNameChange,
  sessionId, onSessionIdChange, sessionOptions,
  isPresencial, onIsPresencialChange,
  presencialTimeFrom, onPresencialTimeFromChange,
  presencialTimeTo, onPresencialTimeToChange,
  presencialLocation, onPresencialLocationChange,
  currentSessionInstance,
  disabled,
}) {
  const colors = useThemeColors();

  return (
    <>
      <KindSelector disabled={disabled} idPrefix={idPrefix} onChange={onKindChange} value={kind} />

      {kind === 'other' && (
        <InputField dense label="Nombre de la actividad" onChange={onOtherNameChange} placeholder="Ej. Elongación" value={otherName} />
      )}

      {kind === 'training' && (
        <>
          {currentSessionInstance && (
            <View
              className="mb-4 rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-900"
              nativeID={`${idPrefix}-current-session`}
              testID={`${idPrefix}-current-session`}
            >
              <Text
                className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400"
                nativeID={`${idPrefix}-current-session-label`}
                testID={`${idPrefix}-current-session-label`}
              >
                Sesión asignada actualmente
              </Text>
              <Text
                className="mt-1 text-sm font-medium text-slate-900 dark:text-white"
                nativeID={`${idPrefix}-current-session-name`}
                testID={`${idPrefix}-current-session-name`}
              >
                {currentSessionInstance.name}
              </Text>
              {currentSessionInstance.description && (
                <Text
                  className="mt-0.5 text-xs text-slate-500 dark:text-slate-400"
                  nativeID={`${idPrefix}-current-session-description`}
                  testID={`${idPrefix}-current-session-description`}
                >
                  {currentSessionInstance.description}
                </Text>
              )}
            </View>
          )}
          {currentSessionInstance ? (
            <Text className="mb-2 text-xs text-slate-500 dark:text-slate-400" nativeID={`${idPrefix}-session-hint`} testID={`${idPrefix}-session-hint`}>
              &ldquo;Mantener sesión actual&rdquo; no toca el contenido guardado. Elegir cualquier otra sesión reemplaza la actual por una copia congelada nueva.
            </Text>
          ) : (
            <Text className="mb-2 text-xs text-slate-500 dark:text-slate-400" nativeID={`${idPrefix}-session-hint`} testID={`${idPrefix}-session-hint`}>
              Guardar instancia una copia congelada de la sesión elegida — editarla después en el catálogo no la va a afectar.
            </Text>
          )}
          <ResponsiveSelectField dense label="Sesión del catálogo" onChange={onSessionIdChange} options={sessionOptions} placeholder="Elegí una sesión" value={sessionId} />
          <PresencialToggle colors={colors} idPrefix={idPrefix} onChange={onIsPresencialChange} value={isPresencial} />
          {isPresencial && (
            <>
              <View className="flex-row gap-3" nativeID={`${idPrefix}-time-row`} testID={`${idPrefix}-time-row`}>
                <View className="flex-1" nativeID={`${idPrefix}-time-from-wrapper`} testID={`${idPrefix}-time-from-wrapper`}>
                  <TimeField label="Hora desde" onChange={onPresencialTimeFromChange} value={presencialTimeFrom} />
                </View>
                <View className="flex-1" nativeID={`${idPrefix}-time-to-wrapper`} testID={`${idPrefix}-time-to-wrapper`}>
                  <TimeField label="Hora hasta" onChange={onPresencialTimeToChange} value={presencialTimeTo} />
                </View>
              </View>
              <View className="mb-5" nativeID={`${idPrefix}-location-wrapper`} testID={`${idPrefix}-location-wrapper`}>
                <LocationPicker onChange={onPresencialLocationChange} value={presencialLocation} />
              </View>
            </>
          )}
        </>
      )}
    </>
  );
}
```

- [ ] **Step 2: Editar `components/team/group-calendar-day-screen.jsx` para usar `CalendarDayFields`**

Sacar del tope del archivo las funciones `KindSelector` y `PresencialToggle` completas (líneas 24-81 del archivo actual) y el import de `MaterialCommunityIcons` se mantiene (se sigue usando en el resto del archivo, ej. el botón de "Volver" y el ícono de warning), pero sacar los imports de `TimeField`, `LocationPicker` y `ResponsiveSelectField` (ya no se usan directo en este archivo) y agregar:
```js
import { CalendarDayFields } from './calendar-day-fields.jsx';
```

Ubicar el bloque completo desde `<KindSelector disabled={isUpserting} .../>` hasta el cierre del `{kind === 'training' && (...)}` (todo el contenido de campos, no los botones de Guardar/Cancelar/Vaciar que quedan igual) y reemplazarlo por:
```jsx
            <CalendarDayFields
              currentSessionInstance={existingDay?.sessionInstance ?? null}
              disabled={isUpserting}
              idPrefix="group-calendar-day"
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
```

El resto del archivo (estado, `handleSubmit`, `handleClear`, cancelación, botones, el modal de cancelar sesión, el guard de cambios sin guardar) queda exactamente igual — sin cambio de comportamiento.

- [ ] **Step 3: Verificar**

Run: `npm test && npm run lint`
Expected: PASS — sin tests de render para esta pantalla (convención del proyecto), pero el lint confirma que no quedaron imports sin usar ni faltan `nativeID`/`testID`.

- [ ] **Step 4: Commit**

```bash
git add components/team/calendar-day-fields.jsx components/team/group-calendar-day-screen.jsx
git commit -m "refactor(calendar): extract CalendarDayFields from day screen"
```

---

### Task 7: Presencial+horario por default en el catálogo de planes (`PlanDay`)

**Files:**
- Modify: `store/training-plan-store.js` (`buildEmptyPlanDays`)
- Modify: `hooks/use-training-plan-form.js` (`setDayCount`, `validate`)
- Modify: `components/plans/training-plan-form-fields.jsx` (`DayHeaderRowWide`, `DayRow`)

**Interfaces:**
- Consumes: `TimeField` de `components/forms/fields.jsx` (ya existe, sin cambios).
- Produces: cada día de un `TrainingPlan` en el form ahora tiene `isPresencial: boolean`, `presencialTimeFrom: string`, `presencialTimeTo: string` además de los campos ya existentes (`sequenceNo`, `kind`, `otherName`, `sessionId`) — mismo shape que consume `toPlanDayModel`/`toPlanDayPayload` del Task 2 y `buildStampDraft` del Task 1.

- [ ] **Step 1: `store/training-plan-store.js` — `buildEmptyPlanDays`**

Ubicar:
```js
export function buildEmptyPlanDays(dayCount) {
  return Array.from({ length: dayCount }, (_, i) => ({ sequenceNo: i + 1, kind: 'rest', otherName: null, sessionId: null }));
}
```
Reemplazar por:
```js
export function buildEmptyPlanDays(dayCount) {
  return Array.from({ length: dayCount }, (_, i) => ({
    sequenceNo: i + 1, kind: 'rest', otherName: null, sessionId: null,
    isPresencial: false, presencialTimeFrom: '', presencialTimeTo: '',
  }));
}
```

- [ ] **Step 2: `hooks/use-training-plan-form.js` — `setDayCount` y `validate`**

Ubicar, dentro de `setDayCount`:
```js
      const extra = Array.from({ length: clamped - prev.length }, (_, i) => ({
        sequenceNo: prev.length + i + 1, kind: 'rest', otherName: null, sessionId: null,
      }));
```
Reemplazar por:
```js
      const extra = Array.from({ length: clamped - prev.length }, (_, i) => ({
        sequenceNo: prev.length + i + 1, kind: 'rest', otherName: null, sessionId: null,
        isPresencial: false, presencialTimeFrom: '', presencialTimeTo: '',
      }));
```

Dentro de `validate`, ubicar:
```js
    const otherDaysWithoutName = days.some((d) => d.kind === 'other' && !d.otherName?.trim());
    if (otherDaysWithoutName) next.days = 'Ingresá el nombre de la actividad en los días marcados como "Otra actividad".';

    setErrors(next);
```
Reemplazar por:
```js
    const otherDaysWithoutName = days.some((d) => d.kind === 'other' && !d.otherName?.trim());
    if (otherDaysWithoutName) next.days = 'Ingresá el nombre de la actividad en los días marcados como "Otra actividad".';

    const badPresencialTimes = days.some((d) => d.kind === 'training' && d.isPresencial && (!d.presencialTimeFrom || !d.presencialTimeTo || d.presencialTimeTo <= d.presencialTimeFrom));
    if (badPresencialTimes) next.days = 'Revisá el horario de los días presenciales: hace falta desde y hasta, y hasta debe ser posterior a desde.';

    setErrors(next);
```

- [ ] **Step 3: `components/plans/training-plan-form-fields.jsx` — agregar los campos**

Cambiar el import de `fields.jsx`:
```js
import { InputField } from '../forms/fields.jsx';
```
por:
```js
import { InputField, TimeField } from '../forms/fields.jsx';
```

Agregar, después de `DaySegmentedPicker` y antes de `DayHeaderRowWide` (nueva función en el mismo archivo):
```jsx
// Toggle + horario "por default" del día — solo aplica a días de
// entrenamiento. Sin ubicación acá a propósito (ver
// docs/superpowers/specs/2026-09-21-calendar-plan-stamping-design.md §2):
// la ubicación concreta se completa recién al estampar el plan a un
// grupo real, nunca en el catálogo.
function PlanDayPresencialFields({ idPrefix, day, onChangeDay }) {
  return (
    <View className="mt-2 gap-2" nativeID={`${idPrefix}-presencial-fields`} testID={`${idPrefix}-presencial-fields`}>
      <Pressable
        accessibilityLabel="¿Presencial por default?"
        accessibilityRole="checkbox"
        accessibilityState={{ checked: day.isPresencial }}
        className="flex-row items-center gap-2 py-1"
        nativeID={`${idPrefix}-presencial-checkbox`}
        onPress={() => onChangeDay({ isPresencial: !day.isPresencial })}
        testID={`${idPrefix}-presencial-checkbox`}
      >
        <View
          className={`h-4 w-4 items-center justify-center rounded border ${day.isPresencial ? 'border-primary bg-primary' : 'border-slate-300 dark:border-slate-600'}`}
          nativeID={`${idPrefix}-presencial-checkbox-box`}
          testID={`${idPrefix}-presencial-checkbox-box`}
        >
          {day.isPresencial && <MaterialCommunityIcons color="#111518" name="check-bold" size={10} />}
        </View>
        <Text className="text-xs font-medium text-slate-600 dark:text-slate-300" nativeID={`${idPrefix}-presencial-checkbox-label`} testID={`${idPrefix}-presencial-checkbox-label`}>
          Presencial por default (se puede ajustar al estampar)
        </Text>
      </Pressable>
      {day.isPresencial && (
        <View className="flex-row gap-3" nativeID={`${idPrefix}-time-row`} testID={`${idPrefix}-time-row`}>
          <View className="flex-1" nativeID={`${idPrefix}-time-from-wrapper`} testID={`${idPrefix}-time-from-wrapper`}>
            <TimeField label="Hora desde" onChange={(v) => onChangeDay({ presencialTimeFrom: v })} value={day.presencialTimeFrom} />
          </View>
          <View className="flex-1" nativeID={`${idPrefix}-time-to-wrapper`} testID={`${idPrefix}-time-to-wrapper`}>
            <TimeField label="Hora hasta" onChange={(v) => onChangeDay({ presencialTimeTo: v })} value={day.presencialTimeTo} />
          </View>
        </View>
      )}
    </View>
  );
}
```

En `DayHeaderRowWide`, ubicar:
```jsx
      {day.kind === 'training' && selectedSession && (
        <View className="pl-24 pt-2" nativeID={`${idPrefix}-session-preview`} testID={`${idPrefix}-session-preview`}>
          <SessionExercisesPreview session={selectedSession} />
        </View>
      )}
```
Reemplazar por:
```jsx
      {day.kind === 'training' && (
        <View className="pl-24 pt-2" nativeID={`${idPrefix}-session-preview`} testID={`${idPrefix}-session-preview`}>
          {selectedSession && <SessionExercisesPreview session={selectedSession} />}
          <PlanDayPresencialFields day={day} idPrefix={idPrefix} onChangeDay={onChangeDay} />
        </View>
      )}
```

En `DayRow`, dentro de `conditionalContent`, ubicar:
```jsx
      {day.kind === 'training' && (
        <View className="mt-2" nativeID={`${idPrefix}-session-picker`} testID={`${idPrefix}-session-picker`}>
          <ResponsiveSelectField
            dense
            hideErrorRow
            hideLabel
            label="Sesión"
            onChange={(sessionId) => onChangeDay({ sessionId })}
            options={sessions.map((s) => ({ id: s.id, name: s.name }))}
            placeholder={sessions.length ? 'Elegí una sesión' : 'Todavía no creaste ninguna sesión'}
            value={day.sessionId ?? ''}
          />
          <SessionExercisesPreview session={selectedSession} />
        </View>
      )}
```
Reemplazar por:
```jsx
      {day.kind === 'training' && (
        <View className="mt-2" nativeID={`${idPrefix}-session-picker`} testID={`${idPrefix}-session-picker`}>
          <ResponsiveSelectField
            dense
            hideErrorRow
            hideLabel
            label="Sesión"
            onChange={(sessionId) => onChangeDay({ sessionId })}
            options={sessions.map((s) => ({ id: s.id, name: s.name }))}
            placeholder={sessions.length ? 'Elegí una sesión' : 'Todavía no creaste ninguna sesión'}
            value={day.sessionId ?? ''}
          />
          <SessionExercisesPreview session={selectedSession} />
          <PlanDayPresencialFields day={day} idPrefix={idPrefix} onChangeDay={onChangeDay} />
        </View>
      )}
```

Por último, en `DayRow`, ubicar `handleKindChange`:
```js
  const handleKindChange = (kind) => {
    if (kind === 'training') {
      onChangeDay({ kind, otherName: null, sessionId: day.sessionId });
    } else if (kind === 'other') {
      onChangeDay({ kind, otherName: day.otherName ?? '', sessionId: null });
    } else {
      onChangeDay({ kind, otherName: null, sessionId: null });
    }
  };
```
Reemplazar por (al salir de `training`, se limpia presencial/horario — no tiene sentido conservarlo para un día de descanso u otra actividad):
```js
  const handleKindChange = (kind) => {
    if (kind === 'training') {
      onChangeDay({ kind, otherName: null, sessionId: day.sessionId });
    } else if (kind === 'other') {
      onChangeDay({ kind, otherName: day.otherName ?? '', sessionId: null, isPresencial: false, presencialTimeFrom: '', presencialTimeTo: '' });
    } else {
      onChangeDay({ kind, otherName: null, sessionId: null, isPresencial: false, presencialTimeFrom: '', presencialTimeTo: '' });
    }
  };
```

- [ ] **Step 4: Test de la validación nueva (`__tests__/use-training-plan-form.test.js`, nuevo archivo)**

Mismo patrón que `__tests__/use-form-dirty.test.js` (`renderHook`/`act` de `@testing-library/react-native`):

```js
// __tests__/use-training-plan-form.test.js
import { renderHook, act } from '@testing-library/react-native';
import { useTrainingPlanForm } from '../hooks/use-training-plan-form.js';

test('validate rechaza un día presencial sin horario completo', () => {
  const { result } = renderHook(() => useTrainingPlanForm({ ownerId: 1 }));
  act(() => {
    result.current.setName('Plan test');
    result.current.updateDay(1, { kind: 'training', sessionId: '1', isPresencial: true, presencialTimeFrom: '', presencialTimeTo: '' });
  });
  let valid;
  act(() => { valid = result.current.validate(); });
  expect(valid).toBe(false);
  expect(result.current.errors.days).toMatch(/horario/i);
});

test('validate rechaza un día presencial con hora hasta anterior o igual a hora desde', () => {
  const { result } = renderHook(() => useTrainingPlanForm({ ownerId: 1 }));
  act(() => {
    result.current.setName('Plan test');
    result.current.updateDay(1, { kind: 'training', sessionId: '1', isPresencial: true, presencialTimeFrom: '09:00', presencialTimeTo: '08:00' });
  });
  let valid;
  act(() => { valid = result.current.validate(); });
  expect(valid).toBe(false);
});

test('validate acepta un día presencial con horario válido', () => {
  const { result } = renderHook(() => useTrainingPlanForm({ ownerId: 1 }));
  act(() => {
    result.current.setName('Plan test');
    result.current.updateDay(1, { kind: 'training', sessionId: '1', isPresencial: true, presencialTimeFrom: '08:00', presencialTimeTo: '09:00' });
  });
  let valid;
  act(() => { valid = result.current.validate(); });
  expect(valid).toBe(true);
});

test('un día no presencial nunca dispara la validación de horario', () => {
  const { result } = renderHook(() => useTrainingPlanForm({ ownerId: 1 }));
  act(() => {
    result.current.setName('Plan test');
    result.current.updateDay(1, { kind: 'training', sessionId: '1', isPresencial: false, presencialTimeFrom: '', presencialTimeTo: '' });
  });
  let valid;
  act(() => { valid = result.current.validate(); });
  expect(valid).toBe(true);
});
```

Run: `npx jest use-training-plan-form`
Expected: PASS (4/4) — este test se corre DESPUÉS de completar el Step 2 de este mismo task (la validación nueva ya tiene que estar implementada).

- [ ] **Step 5: Verificar**

Run: `npm test && npm run lint`
Expected: PASS — `__tests__/training-plan-store.test.js` (`buildEmptyPlanDays`) sigue pasando sin cambios, ya que solo verifica `length`/`sequenceNo`/`kind`, no un `toEqual` exacto del objeto completo.

- [ ] **Step 6: Commit**

```bash
git add store/training-plan-store.js hooks/use-training-plan-form.js components/plans/training-plan-form-fields.jsx __tests__/use-training-plan-form.test.js
git commit -m "feat(plans): add default presencial + schedule fields to plan days"
```

---

### Task 8: `StampPlanModal` + wiring en `group-calendar-screen.jsx`

**Files:**
- Create: `components/team/stamp-plan-modal.jsx`
- Modify: `components/team/group-calendar-screen.jsx`

**Interfaces:**
- Consumes (todo ya definido en tasks anteriores, firmas exactas):
  - `buildStampDraft(plan, startDate) -> DraftDay[]`, `findClosedDraftDates(draftDays, now) -> string[]`, `toISODate(value) -> string` (Task 1).
  - `useTrainingPlans(ownerId) -> { plans, loading }` (ya existente).
  - `useGroupCalendar(groupId, from, to) -> { days, loading, isFetching }` (ya existente, pieza 1) — se usa acá con el rango exacto del plan, independiente del mes visible en `group-calendar-screen.jsx`.
  - `useGroupCalendarMutations(groupId) -> { upsertDay, stampPlan, isStamping }` (Task 4 + pieza 1).
  - `CalendarDayFields` con el contrato de props exacto del Task 6.
  - `DateField` con `minimumDate`/`disableFutureLimit` (Task 5).
  - `useSessions(userId) -> { sessions }` (ya existente, pieza 1).
- Produces: `StampPlanModal({ visible, onClose, groupId, ownerId })`, montado desde `group-calendar-screen.jsx`.

- [ ] **Step 1: Crear `components/team/stamp-plan-modal.jsx`**

```jsx
import { useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, Text, View } from 'react-native';
import Toast from 'react-native-toast-message';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useThemeColors } from '../../theme/colors.js';
import { useTrainingPlans } from '../../hooks/use-training-plans.js';
import { useSessions } from '../../hooks/use-sessions.js';
import { useGroupCalendar, useGroupCalendarMutations } from '../../hooks/use-group-calendar.js';
import { useFormDirty } from '../../hooks/use-form-dirty.js';
import { useUnsavedChangesGuard } from '../../hooks/use-unsaved-changes-guard.js';
import { DiscardChangesModal } from '../shared/discard-changes-modal.jsx';
import { DateField } from '../forms/fields.jsx';
import { ResponsiveSelectField } from '../forms/responsive-select-field.jsx';
import { CalendarDayFields } from './calendar-day-fields.jsx';
import { toISODate } from '../../utils/date-field-format.js';
import { buildStampDraft, addDaysISO, findClosedDraftDates } from '../../utils/build-stamp-draft.js';
import { notifySuccess, notifyError } from '../../utils/haptics.js';

function StampPreviewRow({ day, onToggleExpand, expanded, sessionOptions, onChangeDay, existingDay }) {
  const colors = useThemeColors();
  const idPrefix = `stamp-plan-day-${day.sequenceNo}`;
  const kindLabel = day.kind === 'rest' ? 'Descanso' : day.kind === 'other' ? (day.otherName || 'Otra actividad') : 'Entrenamiento';

  return (
    <View className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 dark:border-slate-700 dark:bg-slate-900" nativeID={idPrefix} testID={idPrefix}>
      <Pressable
        accessibilityRole="button"
        className="flex-row items-center gap-2 active:opacity-80"
        nativeID={`${idPrefix}-toggle`}
        onPress={onToggleExpand}
        testID={`${idPrefix}-toggle`}
      >
        <Text className="w-24 shrink-0 text-xs font-semibold text-slate-500 dark:text-slate-400" nativeID={`${idPrefix}-date`} testID={`${idPrefix}-date`}>
          {day.date}
        </Text>
        <Text className="flex-1 text-sm text-slate-900 dark:text-white" nativeID={`${idPrefix}-summary`} testID={`${idPrefix}-summary`}>
          {kindLabel}
        </Text>
        {existingDay && (
          <View className="rounded-full bg-amber-100 px-2 py-0.5 dark:bg-amber-900/30" nativeID={`${idPrefix}-conflict-badge`} testID={`${idPrefix}-conflict-badge`}>
            <Text className="text-[10px] font-semibold text-amber-700 dark:text-amber-400" nativeID={`${idPrefix}-conflict-badge-label`} testID={`${idPrefix}-conflict-badge-label`}>
              Se pisa
            </Text>
          </View>
        )}
        <MaterialCommunityIcons color={colors.onSurfaceVariant} name={expanded ? 'chevron-up' : 'chevron-down'} size={20} />
      </Pressable>

      {expanded && (
        <View className="mt-2" nativeID={`${idPrefix}-expanded`} testID={`${idPrefix}-expanded`}>
          <CalendarDayFields
            currentSessionInstance={null}
            disabled={false}
            idPrefix={idPrefix}
            isPresencial={day.isPresencial}
            kind={day.kind}
            onIsPresencialChange={(v) => onChangeDay({ isPresencial: v, touched: true })}
            onKindChange={(v) => onChangeDay({ kind: v, touched: true })}
            onOtherNameChange={(text) => onChangeDay({ otherName: text, touched: true })}
            onPresencialLocationChange={(v) => onChangeDay({ presencialLocation: v, touched: true })}
            onPresencialTimeFromChange={(v) => onChangeDay({ presencialTimeFrom: v, touched: true })}
            onPresencialTimeToChange={(v) => onChangeDay({ presencialTimeTo: v, touched: true })}
            onSessionIdChange={(v) => onChangeDay({ sessionId: v, touched: true })}
            otherName={day.otherName ?? ''}
            presencialLocation={day.presencialLocation}
            presencialTimeFrom={day.presencialTimeFrom ?? ''}
            presencialTimeTo={day.presencialTimeTo ?? ''}
            sessionId={day.sessionId ?? ''}
            sessionOptions={sessionOptions}
          />
        </View>
      )}
    </View>
  );
}

export function StampPlanModal({ visible, onClose, groupId, ownerId }) {
  const colors = useThemeColors();
  const { plans } = useTrainingPlans(ownerId);
  const { sessions } = useSessions(ownerId);
  const { upsertDay, stampPlan, isStamping } = useGroupCalendarMutations(groupId);

  const [step, setStep] = useState('select');
  const [planId, setPlanId] = useState('');
  const [startDate, setStartDate] = useState('');
  const [draftDays, setDraftDays] = useState([]);
  const [expandedSeq, setExpandedSeq] = useState(null);
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);

  const plan = plans.find((p) => p.id === planId) ?? null;
  const rangeEnd = plan && startDate ? addDaysISO(startDate, plan.days.length - 1) : null;
  const { days: existingDays } = useGroupCalendar(groupId, startDate || null, rangeEnd);
  const existingByDate = useMemo(() => Object.fromEntries(existingDays.map((d) => [d.date, d])), [existingDays]);

  const isDirty = useFormDirty({ planId, startDate, draftDays }, visible);
  const { confirmVisible, guardedClose, confirmDiscard, cancelDiscard, bypassGuard } = useUnsavedChangesGuard(isDirty);

  const resetKey = visible;
  const prevResetKeyRef = useRef(resetKey);
  if (resetKey !== prevResetKeyRef.current) {
    prevResetKeyRef.current = resetKey;
    setStep('select');
    setPlanId('');
    setStartDate('');
    setDraftDays([]);
    setExpandedSeq(null);
    setError(null);
  }

  const sessionOptions = sessions.map((s) => ({ id: s.id, name: s.name }));

  const handleClose = () => guardedClose(onClose);

  const handleContinue = () => {
    if (!plan || !startDate) {
      setError('Elegí un plan y una fecha de inicio.');
      return;
    }
    const draft = buildStampDraft(plan, startDate);
    const closedDates = findClosedDraftDates(draft);
    if (closedDates.length > 0) {
      setError(`El plan cubre ${closedDates.length} día(s) ya cerrado(s) (empezando ${closedDates[0]}). Elegí otra fecha de inicio.`);
      return;
    }
    setError(null);
    setDraftDays(draft);
    setStep('preview');
  };

  const handleChangeDraftDay = (sequenceNo, updates) => {
    setDraftDays((prev) => prev.map((d) => (d.sequenceNo === sequenceNo ? { ...d, ...updates } : d)));
  };

  const handleSave = async () => {
    setSaving(true);
    const hasConflicts = draftDays.some((d) => Boolean(existingByDate[d.date]));
    const stampResult = await stampPlan({ planId, startDate, force: hasConflicts });
    if (!stampResult.success) {
      setSaving(false);
      notifyError();
      if (stampResult.conflict) {
        Toast.show({ type: 'error', text1: 'El calendario cambió', text2: 'Volvé a revisar el preview antes de guardar.' });
      } else {
        Toast.show({ type: 'error', text1: 'No pudimos estampar el plan', text2: stampResult.error });
      }
      return;
    }

    const touchedDays = draftDays.filter((d) => d.touched);
    for (const day of touchedDays) {
      const result = await upsertDay({ date: day.date, day });
      if (!result.success) {
        notifyError();
        Toast.show({ type: 'error', text1: `No pudimos ajustar el día ${day.date}`, text2: result.error });
      }
    }

    setSaving(false);
    notifySuccess();
    Toast.show({ type: 'success', text1: 'Plan estampado' });
    bypassGuard(onClose);
  };

  return (
    <>
      <Modal animationType="fade" nativeID="stamp-plan-modal" onRequestClose={handleClose} testID="stamp-plan-modal" transparent visible={visible}>
        <Pressable className="flex-1 items-center justify-center bg-black/50 px-4" nativeID="stamp-plan-modal-backdrop" onPress={handleClose} testID="stamp-plan-modal-backdrop">
          <Pressable
            className="max-h-[85%] w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-xl dark:border-slate-700 dark:bg-surface"
            nativeID="stamp-plan-modal-card"
            onPress={() => {}}
            testID="stamp-plan-modal-card"
          >
            <Text className="mb-4 text-lg font-bold text-slate-900 dark:text-white" nativeID="stamp-plan-modal-title" testID="stamp-plan-modal-title">
              Estampar plan
            </Text>

            {error && (
              <Text className="mb-3 text-xs text-red-500 dark:text-red-400" nativeID="stamp-plan-modal-error" testID="stamp-plan-modal-error">{error}</Text>
            )}

            {step === 'select' && (
              <>
                <ResponsiveSelectField
                  dense
                  label="Plan"
                  onChange={setPlanId}
                  options={plans.map((p) => ({ id: p.id, name: p.name }))}
                  placeholder="Elegí un plan"
                  value={planId}
                />
                <DateField
                  disableFutureLimit
                  label="Fecha de inicio"
                  minimumDate={new Date()}
                  onChange={(v) => setStartDate(toISODate(v))}
                  value={startDate}
                />
                <Pressable
                  className="mt-2 h-11 flex-row items-center justify-center rounded-full bg-primary hover:opacity-90 active:opacity-80"
                  nativeID="stamp-plan-modal-continue-button"
                  onPress={handleContinue}
                  testID="stamp-plan-modal-continue-button"
                >
                  <Text className="text-sm font-semibold uppercase tracking-wide text-[#111518]" nativeID="stamp-plan-modal-continue-button-label" testID="stamp-plan-modal-continue-button-label">
                    Continuar
                  </Text>
                </Pressable>
              </>
            )}

            {step === 'preview' && (
              <>
                <ScrollView className="max-h-96" nativeID="stamp-plan-modal-preview-scroll" testID="stamp-plan-modal-preview-scroll">
                  <View className="gap-2" nativeID="stamp-plan-modal-preview-list" testID="stamp-plan-modal-preview-list">
                    {draftDays.map((day) => (
                      <StampPreviewRow
                        day={day}
                        existingDay={existingByDate[day.date] ?? null}
                        expanded={expandedSeq === day.sequenceNo}
                        key={day.sequenceNo}
                        onChangeDay={(updates) => handleChangeDraftDay(day.sequenceNo, updates)}
                        onToggleExpand={() => setExpandedSeq((prev) => (prev === day.sequenceNo ? null : day.sequenceNo))}
                        sessionOptions={sessionOptions}
                      />
                    ))}
                  </View>
                </ScrollView>
                <View className="mt-4 flex-row gap-3" nativeID="stamp-plan-modal-preview-actions" testID="stamp-plan-modal-preview-actions">
                  <Pressable
                    className="h-11 flex-1 items-center justify-center rounded-full border border-slate-200 hover:bg-slate-100 active:opacity-70 dark:border-slate-700 dark:hover:bg-slate-800"
                    nativeID="stamp-plan-modal-back-button"
                    onPress={() => setStep('select')}
                    testID="stamp-plan-modal-back-button"
                  >
                    <Text className="text-sm font-semibold text-slate-700 dark:text-slate-200" nativeID="stamp-plan-modal-back-button-label" testID="stamp-plan-modal-back-button-label">
                      Atrás
                    </Text>
                  </Pressable>
                  <Pressable
                    className={`h-11 flex-1 flex-row items-center justify-center gap-2 rounded-full bg-primary hover:opacity-90 active:opacity-80 ${saving || isStamping ? 'opacity-60' : ''}`}
                    disabled={saving || isStamping}
                    nativeID="stamp-plan-modal-save-button"
                    onPress={handleSave}
                    testID="stamp-plan-modal-save-button"
                  >
                    {saving || isStamping ? (
                      <ActivityIndicator color={colors.onPrimary} size="small" />
                    ) : (
                      <Text className="text-sm font-semibold uppercase tracking-wide text-[#111518]" nativeID="stamp-plan-modal-save-button-label" testID="stamp-plan-modal-save-button-label">
                        Guardar
                      </Text>
                    )}
                  </Pressable>
                </View>
              </>
            )}
          </Pressable>
        </Pressable>
      </Modal>

      <DiscardChangesModal onCancel={cancelDiscard} onConfirm={confirmDiscard} visible={confirmVisible} />
    </>
  );
}
```

- [ ] **Step 2: Wirear en `components/team/group-calendar-screen.jsx`**

Agregar el import:
```js
import { StampPlanModal } from './stamp-plan-modal.jsx';
```

En `GroupCalendarScreenContent`, agregar estado y el botón en el header. Ubicar:
```jsx
          {(loadingDays || isFetching) && (
            <ActivityIndicator color={colors.primary} nativeID="group-calendar-screen-fetching" size="small" testID="group-calendar-screen-fetching" />
          )}
        </View>
```
Reemplazar por:
```jsx
          {(loadingDays || isFetching) && (
            <ActivityIndicator color={colors.primary} nativeID="group-calendar-screen-fetching" size="small" testID="group-calendar-screen-fetching" />
          )}
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

Agregar el `useState`, junto a los demás (después de `const [visibleMonth, setVisibleMonth] = useState(...)`):
```js
  const [stampModalVisible, setStampModalVisible] = useState(false);
```

Y montar el modal al final del `return`, justo antes del cierre del `View` raíz (después del `</View>` que cierra `group-calendar-month-view`):
```jsx
        </View>
      </View>

      <StampPlanModal groupId={groupId} onClose={() => setStampModalVisible(false)} ownerId={userId} visible={stampModalVisible} />
    </View>
```

(Reemplaza el cierre actual `</View>\n    </View>\n  );` del final del componente.)

- [ ] **Step 3: Verificar**

Run: `npm test && npm run lint`
Expected: PASS. El ícono `stamper` de `MaterialCommunityIcons` existe en el set de Material Community Icons (usado también en otras apps para "sellar/estampar") — si `npm run lint`/la carga de la app señalara un ícono inválido, reemplazar por `content-copy` (ambos son razonables, `stamper` es más literal al verbo "estampar").

- [ ] **Step 4: Commit**

```bash
git add components/team/stamp-plan-modal.jsx components/team/group-calendar-screen.jsx
git commit -m "feat(calendar): add StampPlanModal with local draft preview and save flow"
```

---

### Task 9: Verificación final + script de test manual

**Files:** ninguno (solo verificación)

- [ ] **Step 1: Correr la suite completa**

Run: `npm test && npm run lint`
Expected: PASS — 0 fallos, 0 errores de lint.

- [ ] **Step 2: Entregar el script de test manual**

En la respuesta final de esta tarea, output the following manual test script verbatim for the user (this project's convention — see CLAUDE.md "Verificación visual" and the project memory "ask-before-browser-verification" — is to hand a written manual test script instead of Claude driving browser verification, since the user does all manual testing themselves):

```
## Script de test manual — estampado de plan (pieza 2)

### 1. Presencial por default en el catálogo de planes
1. Ir a Planes de entrenamiento → crear o editar un plan.
2. En un día "Entrenamiento", tildar "Presencial por default" → deben
   aparecer los campos Hora desde / Hora hasta.
3. Dejar "Hora hasta" antes o igual a "Hora desde" → guardar debe
   rechazar con el mensaje de horario inválido.
4. Cargar un horario válido y guardar → reabrir el plan (o navegar y
   volver) y confirmar que el toggle y el horario quedaron guardados.

### 2. Estampado — happy path
1. Ir al calendario de un grupo (Equipo → grupo → "Ver calendario").
2. Tocar "Estampar plan".
3. Elegir un plan y una fecha de inicio futura (probar que en mobile NO
   deja elegir una fecha pasada — antes de este cambio el picker de
   fecha estaba limitado a "hoy o antes").
4. Tocar "Continuar" → debe verse un preview con un renglón por día del
   plan, cada uno con SU fecha real.
5. Expandir un día de entrenamiento presencial (si el plan tiene uno
   marcado por default) → debe venir precargado con el horario del plan,
   sin ubicación — cargarla ahí.
6. Tocar "Guardar" → toast de éxito, modal se cierra, el mes del
   calendario refleja los días nuevos.

### 3. Conflicto
1. Con un grupo que YA tiene algún día cargado en el rango, repetir el
   flujo de estampado apuntando a ese mismo rango.
2. En el preview, el/los día(s) con contenido previo deben mostrar el
   badge "Se pisa".
3. Guardar igual → debe aplicarse sin error (el modal ya asume `force`
   cuando detecta conflictos en el preview).

### 4. Día cerrado bloquea continuar
1. Elegir una fecha de inicio tal que el rango del plan incluya HOY (no
   presencial) o una fecha pasada.
2. Tocar "Continuar" → debe mostrar el error de día(s) cerrado(s) y NO
   avanzar al preview.

### 5. Edición dentro del preview persiste
1. En el paso de preview, expandir un día y cambiarle la sesión (o
   activar presencial y cargar horario+ubicación).
2. Guardar.
3. Abrir ese día puntual desde el calendario (tocar el día en el mes) →
   debe reflejar el cambio hecho en el preview, no el default del plan.

### 6. Guard de cambios sin guardar
1. Abrir "Estampar plan", elegir un plan y una fecha, tocar afuera del
   modal (backdrop) → debe aparecer la confirmación de "salir sin
   guardar", no cerrar directo.
2. "Seguir editando" debe cancelar el cierre y mantener lo cargado.

Probar todo esto en web; en mobile nativo alcanza con re-confirmar el
punto 2 del bloque 1 (el date picker respetando fecha futura) y el
punto 1 de este bloque — son los dos casos con comportamiento
específico de plataforma.
```

- [ ] **Step 3: Marcar el plan como completo**

No hay commit en este task — es solo verificación y entrega del script. Si `npm test`/`npm run lint` fallaran, volver al task correspondiente y corregir antes de considerar el plan terminado.
