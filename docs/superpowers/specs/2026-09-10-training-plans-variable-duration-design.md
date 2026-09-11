# Planes de entrenamiento: duración variable, sin caducidad — Design

## Contexto

Segundo sub-proyecto del rediseño de catálogo del entrenador, en la rama
compartida `feature/catalog-redesign` (ver spec hermana de ejercicios,
`2026-09-10-exercises-multiselect-context-menu-design.md`, y la de
sesiones que sigue después). Reemplaza por completo el modelo de "7 días
fijos (lunes a domingo) + caducidad de 7 o 14 días desde la creación" por
"N días numerados (2 a 31) sin caducidad" — decisión explícita del
usuario 2026-09-10, que **supersede** la nota de memoria previa
(`training-plans-calendar-redesign-paused.md`) que hablaba de duración
fija en 7. Motivación: los planes pasan a ser templates puros,
reutilizables como "sello" sobre un calendario real en el futuro
sub-proyecto de asignación — atarlos a un día de la semana o a una
caducidad propia no tiene sentido para eso.

**Fuera de este sub-proyecto:** todo lo de asignación/calendario
(`assignToGroup`, `assignToRunner`, `groupTrainingPlanIds`,
`RunnerPlanAssignment`, marcar como "actual") — esa capa sigue existiendo
tal cual, sin tocarla. Este spec solo cambia la forma del plan-template en
sí y lo que depende directamente de su forma vieja.

## Alcance

**Adentro:**
- `PlanDay` pierde `dayOfWeek`/`day_of_week` — un día es solo
  `sequenceNo` (1..N) + `kind`/`otherName`/`sessionId`, sin atarse a
  ningún día de la semana real.
- El plan pierde `durationDays`/`duration_days` como caducidad — ya no
  hay campo de vigencia en absoluto, ni derivada (`getPlanStatus`) ni
  fija.
- Cantidad de días del plan: variable, 2 a 31 (antes: fijo en 7).
- Días se etiquetan "Día 1", "Día 2", ..., "Día N" (antes: "Lunes",
  "Martes", etc.).
- Clonar (ya existe, `clonePlan`/`cloneTrainingPlan`) sigue funcionando
  sin cambios de código — hace una copia profunda de `days` sea cual sea
  su forma.
- Ripple necesario en pantallas del lado corredor que dependían del
  modelo viejo (ver sección dedicada más abajo) — decidido explícitamente
  con el usuario: ocultar/reemplazar en vez de dejar mostrando datos
  falsos.
- Actualizar `docs/BACKEND_TRAINING_PLANS_SPEC.md` con el modelo nuevo.

**Afuera (explícitamente):**
- Múltiples sesiones el mismo día (`day.sessionId` sigue siendo un solo
  id, no un array) — se suma cuando se diseñe el calendario de
  asignación.
- Cualquier cosa de `assignToGroup`/`assignToRunner`/`groupTrainingPlanIds`/
  marcar como "actual" — sin cambios.
- El picker "Plan de entrenamiento" al crear/editar un grupo
  (`group-list-editor.jsx`, `edit-group-screen.jsx`,
  `team-detail-screen.jsx`) — sigue leyendo `TRAINING_PLAN_OPTIONS`
  igual que hoy, sin tocarlo.

## Modelo de datos

**`PlanDay`** (antes: `sequenceNo`, `dayOfWeek`, `kind`, `otherName`,
`sessionId` / `sequence_no`, `day_of_week`, `kind`, `other_name`,
`session_id`):

```
PlanDay = { sequenceNo: number (1..N), kind: 'rest'|'other'|'training', otherName: string|null, sessionId: string|null }
```

`day_of_week` desaparece del payload/DTO por completo — no se reemplaza
por nada, el orden real ya lo da `sequenceNo`.

**`TrainingPlan`** pierde `durationDays`/`duration_days`. No se agrega
ningún campo nuevo de "cantidad de días" — se deriva de `days.length`,
igual que hoy se deriva `trainingDaysCount` filtrando por `kind`.

## `store/training-plan-store.js`

- `PLAN_DURATION_OPTIONS`, `DAY_ORDER`, `DAY_LABELS`, `dayLabel`,
  `getTodayDayOfWeek`, `getPlanStatus`, `getPlanDaysRemaining` — **se
  eliminan todas**, ya no tienen sentido sin día-de-semana ni caducidad.
- `buildEmptyPlanDays()` pasa a aceptar un `dayCount`:

```js
// Arma dayCount días vacíos (todos "rest"), numerados 1..dayCount —
// punto de partida al crear un plan nuevo o al agregar/quitar días en
// el form. Ya no hay día de la semana: el orden es puramente secuencial.
export function buildEmptyPlanDays(dayCount) {
  return Array.from({ length: dayCount }, (_, i) => ({ sequenceNo: i + 1, kind: 'rest', otherName: null, sessionId: null }));
}
```

- El resto del store (`createPlan`, `updatePlan`, `deletePlan`,
  `clonePlan`, `fetchPlans`, `fetchPlan`, todo lo de asignación) no
  cambia — no referencian `durationDays`/`dayOfWeek` directamente, solo
  pasan `form`/`days` de un lado a otro.

## `services/normalizers.js`

`toTrainingPlanModel` pierde la línea `durationDays: dto.duration_days`.
`toCreateTrainingPlanPayload`/`toUpdateTrainingPlanPayload` pierden la
línea `duration_days: form.durationDays`. `toPlanDayModel`/`toPlanDayPayload`
(las funciones que mapean cada día) pierden el campo `dayOfWeek`/`day_of_week`
de entrada y salida — el resto de los campos de un día no cambia.

## `services/__mocks__/training-plans-mock.js`

`validatePlanDays` se reescribe — de "exactamente 7, un día de semana
cada uno" a "entre 2 y 31, secuencia 1..N sin huecos ni repetidos":

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

`mockCreateTrainingPlan`/`mockUpdateTrainingPlan` — sacar la línea que
copia `duration_days` al objeto persistido (ya no existe ese campo en el
payload). El resto de esas funciones no cambia.

## Formulario (`hooks/use-training-plan-form.js`, `training-plan-form-fields.jsx`)

- `use-training-plan-form.js`: `durationDays`/`setDurationDays` se
  eliminan. Nuevo: `dayCount`/`setDayCount` (número, arranca en
  `initial?.days?.length ?? 7` — 7 como default razonable para un plan
  nuevo, no como límite). `updateDay` no cambia. Nuevas funciones:

```js
// Sube o baja la cantidad de días — agrega/quita del final de la lista
// para no reordenar los que ya están cargados. Clampeado a [2, 31] acá
// mismo, no solo en el input (defensa contra un valor inválido que
// llegue por otro lado).
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
```

  (Reemplaza el actual `const [durationDays, setDurationDays] = useState(...)`
  por `const [days, setDays] = useState(initial?.days ?? buildEmptyPlanDays(7))`
  ya existente, solo agregando esta función nueva junto a `updateDay`.)
- `getValues()` deja de incluir `durationDays`; `days.length` ya
  representa la cantidad, no hace falta mandar nada aparte.
- `validate()` agrega: `if (days.length < 2 || days.length > 31) next.days = 'El plan tiene que tener entre 2 y 31 días.'` (mismo mensaje que el mock, aunque nunca debería dispararse si el input ya clampea).

`training-plan-form-fields.jsx`:
- El `ResponsiveSelectField` de "Caducidad" (línea 269-277) se elimina
  por completo de la card "Datos del plan".
- Título de la card de días pasa de "Los 7 días de la semana" a "Días
  del plan".
- Debajo del título, antes de la lista, un control nuevo para
  `dayCount`:

```jsx
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
    <Pressable disabled={form.days.length <= 2} onPress={() => form.setDayCount(form.days.length - 1)} nativeID="plan-day-count-remove-button" testID="plan-day-count-remove-button">
      <Text>Quitar último día</Text>
    </Pressable>
    <Pressable disabled={form.days.length >= 31} onPress={() => form.setDayCount(form.days.length + 1)} nativeID="plan-day-count-add-button" testID="plan-day-count-add-button">
      <Text>Agregar día</Text>
    </Pressable>
  </View>
</View>
```

  (Estilos/clases exactas — el plan de implementación las ajusta al
  layout real de `Row`/`Col`/botones ya usados en este mismo archivo;
  este bloque es la interacción, no el pixel-perfect.)
- `TrainingPlanFormFields` pierde la prop `durationOptions` (ya no se
  usa) — queda `TrainingPlanFormFields({ form, autoFocusName = false })`.
- `DayHeaderRowWide` y `DayRow` (las dos variantes, ancha y colapsable):
  cambiar `{dayLabel(day.dayOfWeek)}` por `` {`Día ${day.sequenceNo}`} ``
  en las 3 apariciones (`DayHeaderRowWide` línea 77,
  `DayRow` líneas 226 y 234). Ya no importan `dayLabel` de
  `store/training-plan-store.js` (import a eliminar de este archivo).

## `create-training-plan-screen.jsx` / `edit-training-plan-screen.jsx`

Ambos importan `PLAN_DURATION_OPTIONS` de `store/training-plan-store.js`
(que se elimina) y se lo pasan a `TrainingPlanFormFields` como
`durationOptions` (que también se elimina, ver arriba) — sacar el import
y esa prop en las 2 llamadas. `isDirty`/`useFormDirty` en ambos archivos
compara `durationDays: form.durationDays` — pasa a comparar
`dayCount: form.days.length` en su lugar (mismo objeto de comparación,
solo cambia qué campo del form representa "cuánto contenido tiene esto
sin guardar").

## Ripple en pantallas del corredor (decidido con el usuario)

**`components/plans/my-plans-screen.jsx`** (`MyPlanRow`): se elimina
`statusTag` (badge "Quedan N días"/"Venció") y las líneas que calculan
`status`/`statusMeta`/`daysRemaining`/`vigenciaLabel` — la fila queda con
ícono, nombre, cantidad de sesiones de entrenamiento, la estrella de
"marcar como actual" y el chevron. `STATUS_META` (líneas 18-21) se
elimina del archivo, ya no se usa nada de ahí.

**`components/plans/today-session-hero.jsx`/`today-session-card.jsx`**:
`TodaySessionCard` deja de poder resolver "hoy" (no hay más
`dayOfWeek` contra el cual buscar) — `useTodayPlanSession` pierde su
razón de ser en esta forma. Reemplazo: `TodaySessionCard` pasa a mostrar
un estado fijo ("Este plan todavía no tiene un calendario asignado —
pronto vas a poder ver acá el entrenamiento de cada día real.") en vez de
intentar resolver un día. `useTodayPlanSession` y su import de
`getTodayDayOfWeek` se eliminan (archivo entero o vaciado, según decida
el plan de implementación — ya no tiene nada real que resolver). El
mecanismo de "marcar como actual" (`myCurrentPlanIds`, la estrella) sigue
funcionando igual — es una preferencia del corredor, independiente de
esto; el hero solo cambia lo que muestra por dentro.

**`components/plans/training-plans-screen.jsx`** (catálogo del
entrenador) y **`training-plan-detail-screen.jsx`** (detalle, entrenador):
mismo criterio — se elimina `STATUS_META`, `getPlanStatus`, la línea
"caduca a los N días" (`training-plans-screen.jsx:54`,
`training-plan-detail-screen.jsx:262`) y el badge Activo/Vencido. Queda
solo la info que sigue siendo real: nombre, cantidad de días
(`days.length`), cantidad de sesiones de entrenamiento. En
`training-plan-detail-screen.jsx`, `dayLabel(day.dayOfWeek)` (línea 77)
pasa a `` `Día ${day.sequenceNo}` ``, mismo criterio que el form.

## `docs/BACKEND_TRAINING_PLANS_SPEC.md`

Actualizar §3.4 (`TrainingPlan`) sacando `duration_days` y cualquier
mención a `status`/vigencia derivada. Actualizar §3.5 (`PlanDay`) sacando
`day_of_week` del todo y documentando la restricción nueva: `sequence_no`
1..N sin huecos, `N` entre 2 y 31. Dejar una nota de que esto reemplaza
el modelo anterior (7 días fijos + caducidad 7/14) por decisión de
producto 2026-09-10, ya sin backend real detrás (sigue siendo
`FORCE_MOCKS = true`, gap 4 de `docs/BACKEND_API_GAPS.md`).

## Testing

Lógica pura con test real (convención del repo):
- `__tests__/training-plans-mock.test.js`: reescribir
  `describe('validatePlanDays...')` para los casos nuevos (2-31, límites
  exactos 1 y 32 como inválidos, 2 y 31 como válidos, secuencia con hueco
  inválida) — sacar los casos de "7 días de la semana sin repetir".
  `buildValidDays()` (helper del archivo, línea 10) deja de generar
  `day_of_week`.
- `__tests__/training-plan-store.test.js`: eliminar los `describe` de
  `getPlanStatus`, `getPlanDaysRemaining`, `getTodayDayOfWeek`, y la parte
  de `dayLabel`/`PLAN_DURATION_OPTIONS` dentro de su describe (lo que
  quede de ese describe, si algo, se ajusta). `buildEmptyPlanDays` suma
  un caso nuevo: `buildEmptyPlanDays(10)` da 10 días numerados 1..10, sin
  `dayOfWeek`. Los fixtures de plan en este archivo (línea 58-66 y
  similares) dejan de incluir `duration_days`/`day_of_week`.
- Cualquier test de `services/normalizers.js` si existe (revisar
  `__tests__/normalizers.test.js`) que cubra `toTrainingPlanModel`/
  `toCreateTrainingPlanPayload`/`toPlanDayModel` — ajustar a la forma
  nueva si hay casos que referencian `durationDays`/`dayOfWeek`.

Sin test de componente (convención) — verificación manual en preview:
1. Crear plan: cambiar "Cantidad de días" (probar 2, 31, y un valor fuera
   de rango que se clampea), confirmar que la lista de días se ajusta y
   que dice "Día 1"..."Día N".
2. Guardar y ver el detalle: sin badge de vigencia, días con la
   numeración nueva.
3. Clonar un plan existente: sigue funcionando, clon con "(copia)" y la
   misma cantidad de días.
4. Como corredor (`Mis planes`, si hay un plan asignado en el entorno de
   prueba): fila sin badge de vigencia; hero "sesión de hoy" con el
   mensaje de reemplazo en vez de intentar resolver un día.

`npm test` y `npm run lint` en verde antes de cada commit.
