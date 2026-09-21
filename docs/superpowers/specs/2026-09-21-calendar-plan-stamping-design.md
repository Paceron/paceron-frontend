# Calendario de asignaciones — Pieza 2: estampado de plan (design)

**Status:** aprobado, pendiente de plan de implementación.

**Contexto:** pieza 1 (vista mensual del calendario de un grupo + edición de
día suelto) ya está implementada y pulida en `feature/group-calendar` —
ver `docs/superpowers/specs/2026-09-19-group-calendar-design.md`. Esta
pieza cubre la otra mitad del sub-proyecto de calendario de asignaciones:
volcar un `TrainingPlan` completo sobre el calendario de un grupo de una
sola vez ("estampar"), en vez de cargar día por día.

**Spec hermana (backend, ya implementado, sin cambios necesarios):**
`docs/BACKEND_CALENDAR_ASSIGNMENTS_SPEC.md` (endpoint `stamp`, guard de
día cerrado) y `docs/BACKEND_TRAINING_PLANS_SPEC.md` §3.5 (`PlanDay`,
incluye `default_presencial`/`default_time_from`/`default_time_to`/
`default_location`, ya deployados, sin UI frontend hasta esta pieza).

## 1. Alcance

**Incluido:**
- Botón "Estampar plan" en `group-calendar-screen.jsx` que abre un modal
  de 2 pasos: elegir plan + fecha de inicio, y un preview editable
  día-por-día antes de persistir.
- El preview acumula ediciones en local (sin pegarle al backend) y recién
  al tocar "Guardar" dispara los requests reales — un `stamp` (todo el
  plan de una) más un `PUT` por cada día que el usuario haya tocado
  distinto del default del plan.
- Sumar `default_presencial`/`default_time_from`/`default_time_to` al
  formulario de creación/edición de `TrainingPlan` (`PlanDay` por día,
  solo si `kind = 'training'`) — el backend ya soporta estos campos, no
  hay UI todavía. **`default_location` queda deliberadamente fuera** del
  catálogo (ver §2).

**Explícitamente fuera de esta pieza (decisiones ya tomadas en
brainstorming, no reabrir sin nueva conversación):**
- Drag-and-drop real de una card de plan sobre la grilla — se descartó
  por el historial de costos de este proyecto con gesture-handler sobre
  componentes de terceros (ver sección de drag-and-drop en `CLAUDE.md`).
  El flujo es selección explícita (elegir plan + fecha de inicio).
- Un "modo batch" general para acumular ediciones de días sueltos
  (fuera de un estampado) sin persistir — la pantalla de día suelto de
  la pieza 1 sigue persistiendo al tocar Guardar en cada día individual.
  El acumulado local es específico del flujo de estampado, donde el caso
  de uso real (cargar un plan completo) lo justifica.
- Ubicación (`default_location`) a nivel de `Session` — sigue fuera,
  mismo razonamiento de reutilización que en §2. (Sí terminó sumándose a
  `PlanDay` — ver actualización en §2, no fue posible dejarla afuera del
  catálogo por completo.)
- `bulk`/`bulk-clear`/`shift` (multi-select manual, aplazar fechas) —
  quedan para una pieza futura si hace falta, no están bloqueando nada
  de esto.
- Vista del corredor (pieza 3 del sub-proyecto original) — sin empezar.

## 2. Dónde vive `default_presencial`/horario: `PlanDay`, no `Session`

> **Actualización 2026-09-21 (post-implementación):** la sub-decisión de
> "sin ubicación en el catálogo" de este apartado **se revirtió** al
> integrar contra el backend real. `training_plan_service.go` (código
> real, no solo el schema) exige `default_location` no nulo en todo
> `PlanDay` con `default_presencial=true` (`ErrPlanDayFieldMismatch`,
> mismo criterio que ya aplica a `GroupCalendarDay` — aparente copy-paste
> de esa validación sin ajustar para el caso de un template reusable). Se
> le preguntó al usuario si pedía al backend relajar esa regla (mantenía
> el diseño original) o sumaba `LocationPicker` también al catálogo de
> planes — eligió lo segundo. `PlanDay` ahora incluye `presencialLocation`
> (mapea a `default_location`), editable en `training-plan-form-fields.jsx`
> junto al horario; `buildStampDraft` la precarga en el preview de
> estampado (el entrenador la puede ajustar ahí igual, no es de solo
> lectura). El resto de esta sección (por qué NO va en `Session`) sigue
> vigente.

Decisión explícita del usuario durante brainstorming, con la siguiente
razón documentada para no reabrirla sin motivo nuevo:

- `Session` (catálogo de ejercicios) se reutiliza entre planes y grupos
  distintos — atarle una ubicación fija rompería esa reutilización (la
  misma sesión de pista puede hacerse en un club en un grupo y en un
  predio distinto en otro).
- `PlanDay` también se re-estampa en distintos grupos con el tiempo —
  la **ubicación concreta** en principio tampoco tenía sentido fijarla
  ahí por el mismo motivo (ver actualización arriba: el backend real no
  dejó margen para esa preferencia, `default_location` terminó siendo
  obligatorio junto con el horario).
- `default_location` de `PlanDay` (ya existía en el schema del backend)
  ahora SÍ tiene editor en el catálogo (`LocationPicker`, junto al
  horario) — el entrenador puede ajustarla igual al momento de estampar,
  el valor del plan es solo el default inicial del preview.

## 3. Flujo

### 3.1 Entry point

Botón "Estampar plan" en el header de `group-calendar-screen.jsx` (junto
al título, mismo estilo que el resto de acciones del header). Abre
`StampPlanModal`.

### 3.2 Paso 1 — selección de plan y fecha de inicio

- `ResponsiveSelectField` con los planes del entrenador (`useTrainingPlans(userId)`).
- `DateField` para la fecha de inicio.
- Al tener ambos, se calcula el rango `[start_date, start_date + plan.days.length - 1]`
  y se valida con `isCalendarDayClosed` (mismo utilitario de la pieza 1)
  que **ningún** día del rango esté cerrado. Si alguno lo está, error
  inline listando la primera fecha en conflicto y el botón "Continuar"
  queda deshabilitado — mismo criterio todo-o-nada que usa el backend
  para `stamp` (ver `BACKEND_CALENDAR_ASSIGNMENTS_SPEC.md` §4, guard de
  día cerrado).
- "Continuar" arma el preview del paso 2 y dispara el fetch de días
  existentes en ese rango exacto (independiente del mes visible en la
  pantalla de atrás — ver §3.3).

### 3.3 Paso 2 — preview editable

Estado local del modal, no persistido hasta "Guardar":

```js
draftDays: [{
  date: 'YYYY-MM-DD',              // start_date + (sequenceNo - 1)
  sequenceNo: number,
  kind: 'rest' | 'other' | 'training',
  otherName: string | null,
  sessionId: string | null,
  isPresencial: boolean,
  presencialTimeFrom: string | null,
  presencialTimeTo: string | null,
  presencialLocation: { lat, lng, label } | null,
  touched: boolean,                // true si el usuario lo editó en el preview
}]
```

- Inicialización: un `draftDay` por cada `PlanDay` del plan elegido,
  `date` calculada, resto de campos copiados del `PlanDay`
  (`default_presencial`/`default_time_from`/`default_time_to`,
  `presencialLocation: null` siempre — ver §2), `touched: false`.
- Fetch de conflictos: `useGroupCalendar(groupId, from, to)` con
  `from`/`to` = el rango exacto del plan (una query independiente de la
  que usa la pantalla de fondo, que sigue mostrando el mes visible). Por
  cada `draftDay`, si existe un `GroupCalendarDay` real en esa fecha, la
  fila lo muestra como "hay algo acá, se va a pisar" (resumen corto:
  tipo + nombre de sesión si aplica).
- Cada fila muestra: fecha (con día de semana), tipo, resumen de sesión
  si aplica, badge de presencial, y el badge de conflicto si corresponde.
- Tocar una fila la expande e inserta `CalendarDayFields` (ver §4) —
  cualquier cambio ahí actualiza ese `draftDay` y lo marca `touched: true`.
- Filas dentro del rango pero que resultarían cerradas para cuando el
  usuario llegue a esta pantalla (edge case: el usuario dejó el modal
  abierto varios días) no aplica — la validación del paso 1 ya lo cubre
  al momento de continuar; no hace falta revalidar en el paso 2 porque
  no hay demora real entre pasos.

### 3.4 Guardar

1. `stampPlan(groupId, { planId, startDate, force: algúnDraftDayTieneConflicto })`.
   - Si igual devuelve `409` (carrera: alguien tocó el calendario entre
     el fetch del paso 2 y este submit) — toast de error explicando que
     el calendario cambió, no reintenta solo, invalida la query para que
     el usuario vea el estado real y decida de nuevo.
2. Por cada `draftDay` con `touched: true`: un `PUT` individual
   (`upsertCalendarDay`, mismo `toCalendarDayPayload` de la pieza 1) con
   sus valores finales — el `stamp` ya aplicó el default del plan, este
   paso solo corrige las filas que el usuario tocó a mano.
3. Si algún `PUT` puntual falla después de que el `stamp` ya se aplicó:
   no hay rollback del `stamp` — toast de error nombrando la fecha que no
   se pudo ajustar, e invalida la query igual (el usuario ve el estado
   real resultante y puede reintentar esa fecha puntual desde la pantalla
   de día suelto de la pieza 1).
4. Éxito: invalida `['group-calendar', groupId]`, cierra el modal, toast
   de éxito.

## 4. Componentes y archivos

- **`components/team/calendar-day-fields.jsx`** (nuevo) — extraído de
  `group-calendar-day-screen.jsx`: los campos de kind / selector de
  sesión / toggle presencial + `TimeField` desde-hasta + `LocationPicker`.
  Sin estado propio — recibe `values`/`onChange` por props, controlado
  por quien lo monte. Usado por `group-calendar-day-screen.jsx` (pieza 1,
  refactor) y por cada fila expandida de `StampPlanModal` (pieza 2).
- **`components/team/stamp-plan-modal.jsx`** (nuevo) — el modal de 2
  pasos completo: selección (plan + fecha) y preview (lista de filas +
  `CalendarDayFields` por fila expandida + botón Guardar).
- **`group-calendar-day-screen.jsx`** (modificado) — reemplaza su JSX
  inline de campos por `<CalendarDayFields />`, sin cambio de
  comportamiento.
- **`group-calendar-screen.jsx`** (modificado) — botón "Estampar plan"
  en el header, monta `StampPlanModal`.
- **`services/calendar.js`** (modificado) — nueva función
  `stampPlan(groupId, { planId, startDate, force })` →
  `POST /groups/{id}/calendar/stamp`.
- **`services/normalizers.js`** (modificado) — `toPlanDayModel`/
  `toPlanDayPayload` suman `isPresencial`/`presencialTimeFrom`/
  `presencialTimeTo` (mapeo directo a `default_presencial`/
  `default_time_from`/`default_time_to`); nueva `toStampPayload({ planId,
  startDate, force })` → `{ plan_id, start_date, force }`.
- **`hooks/use-group-calendar.js`** (modificado) — `useGroupCalendarMutations`
  suma `stampPlan`/`isStamping`, invalida `['group-calendar', groupId]`
  en éxito, mismo patrón que `upsertDay`/`deleteDay` ya existentes.
- **`components/plans/training-plan-form-fields.jsx`** (modificado) —
  `DayRow`/`DayHeaderRowWide` suman toggle presencial + `TimeField`
  desde-hasta cuando `day.kind === 'training'` (mismo `TimeField` de
  `components/forms/fields.jsx`, creado en la pieza 1).
- **`hooks/use-training-plan-form.js`** / **`store/training-plan-store.js#buildEmptyPlanDays`**
  (modificados) — nuevos campos default (`isPresencial: false`,
  `presencialTimeFrom: ''`, `presencialTimeTo: ''`) en cada día nuevo;
  `validate()` suma: si `isPresencial`, `presencialTimeTo` debe ser
  posterior a `presencialTimeFrom` (mismo criterio que ya usa el backend
  y que ya replica `group-calendar-day-screen.jsx`).
- **`utils/build-stamp-draft.js`** (nuevo, lógica pura) —
  `buildStampDraft(plan, startDate)` → array de `draftDays` (cálculo de
  fechas + mapeo de defaults), extraído a función standalone
  específicamente para que sea testeable con Jest sin montar el modal.

## 5. Testing

Lógica pura (Jest, `__tests__/`):
- `build-stamp-draft.test.js` — `buildStampDraft`: fechas correctas
  (incluyendo cruce de mes/año), mapeo de `kind`/`sessionId`/
  `isPresencial`/horarios desde el `PlanDay`, `presencialLocation`
  siempre `null` al inicializar, `touched: false` inicial.
- `use-training-plan-form.test.js` (si existe, si no se crea) — nuevo
  caso: `isPresencial: true` con `presencialTimeTo <= presencialTimeFrom`
  falla `validate()`.

El resto (modal de 2 pasos, expand/collapse de filas, `CalendarDayFields`
compartido, flujo de guardado) se verifica manual — mismo criterio que
toda esta pieza (sin tests de render de componentes, convención del
proyecto).

## 6. Guard de día cerrado — reconfirmación

Mismo mecanismo ya construido en la pieza 1 (`utils/calendar-day-closed.js`),
sin cambios — se reusa tal cual para validar el rango completo del plan
en el paso 1 del modal. No hace falta extenderlo ni tocarlo.
