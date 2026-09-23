# Calendario de asignaciones — Selección múltiple + acciones en lote (design)

**Status:** aprobado, pendiente de plan de implementación.

**Contexto:** sub-pieza 2 de la serie "gestión avanzada del calendario de
grupo" (ver `docs/superpowers/specs/2026-09-21-calendar-day-menu-design.md`
§1, que fijó el orden: menú de día → **selección múltiple (este
documento)** → evitar pisar selectivo → desplazar). El menú de día
(sub-pieza 1) ya está implementado, probado y confirmado funcionando en
`feature/group-calendar`.

## 1. Qué cambia

Se agrega un modo de selección múltiple sobre la grilla mensual, con dos
acciones en lote: vaciar y editar (mismo contenido para todas las fechas
seleccionadas). Reusa el espíritu del patrón de multi-selección ya
existente en el catálogo de ejercicios (`exercises-catalog-tab.jsx`:
`Set` de ids seleccionados, un `exitSelection()` centralizado) pero con
decisiones propias de entrada y de acciones, tomadas en brainstorming:

- **Entrada:** "Seleccionar" es un ítem nuevo del menú de día
  (`components/team/calendar-day-menu.jsx`, `CalendarDayMenu`) —
  deliberadamente NO un botón en el header (a diferencia del catálogo de
  ejercicios). Tocarlo entra al modo con ese día ya marcado.
- **Acciones como íconos, no dropdown:** el header en modo selección
  muestra un botón-ícono por acción (Vaciar en lote, Editar en lote,
  Salir) en vez del patrón "..." + dropdown que usa el catálogo de
  ejercicios — más directo. (Nota de producto, fuera de esta pieza:
  posible mejora futura aplicar el mismo patrón de íconos al catálogo de
  ejercicios.)
- **Naming:** el botón de salir del modo se llama **"Salir"**, no
  "Cancelar" — para no confundirse con "Cancelar sesión" (acción ya
  existente del menú de día individual, que cancela un entrenamiento con
  motivo). Son conceptos distintos, nombres distintos.

## 2. Header en modo selección

Reemplaza el botón "Estampar plan" (no conviven — no tiene sentido
estampar mientras se arma una selección). Contenido:

- Texto "`N` seleccionados".
- Ícono **Vaciar en lote** (`trash-can-outline`, mismo rojo `#ef4444` ya
  usado en el resto del calendario) — deshabilitado si la selección es
  "de días cerrados" (ver §4).
- Ícono **Editar en lote** (`pencil-outline`) — deshabilitado en el mismo
  caso.
- Ícono **Salir** (`close`) — siempre habilitado, vacía la selección y
  sale del modo.

Fuera de modo selección, el header vuelve a mostrar "Estampar plan" tal
cual está hoy — sin cambios ahí.

## 3. Selección: qué es y cómo se toca

- Estado: `Set<string>` de fechas ISO seleccionadas (mismo criterio que
  `selectedIds` en el catálogo de ejercicios, pero de fechas).
- **Toda la selección es de una sola "clase"**: cerrada o abierta/futura.
  La clase queda fijada por el primer día marcado (al entrar por
  "Seleccionar" desde su menú). Tocar un día de la otra clase mientras el
  modo está activo **no hace nada** — no se pueden mezclar días cerrados
  con futuros en la misma tanda. (Motivo: hoy ninguna acción en lote
  tiene sentido sobre días cerrados — ver §4 — mezclar clases solo
  generaría una selección donde una parte nunca podría ejecutar nada.)
- **En modo selección, tocar CUALQUIER día siempre alterna su
  selección** — nunca abre el menú individual (`CalendarDayMenu`),
  independientemente de si el día tiene contenido o no. El menú
  individual queda inalcanzable hasta salir del modo.
- Días de la clase equivocada se muestran atenuados/no interactivos
  mientras el modo está activo (mismo tratamiento visual que ya usa
  `isCalendarDayClosed` para el tinte, extendido a este caso).

## 4. Acciones en lote

**Selección "de días cerrados":** ninguna acción de esta pieza aplica
todavía (vaciar/editar en lote sobre un día cerrado sería rechazado por
el backend, igual que ya pasa con las acciones individuales) — los
botones de Vaciar/Editar quedan deshabilitados, solo "Salir" funciona.
Esto deja la puerta abierta a una futura acción específica para lotes
cerrados (ej. cancelar en lote) sin comprometerse a nada de eso ahora.

**Vaciar en lote** (solo con selección "abierta"):
- `POST /groups/{id}/calendar/bulk-clear { dates }` → `204`.
- Confirmación simple antes de ejecutar (mismo criterio que vaciar
  individual, sin modal de motivo — a diferencia de cancelar).
- Éxito: toast + `exitSelection()` + invalidar el calendario.

**Editar en lote** (solo con selección "abierta"):
- Abre un modal que reusa `CalendarDayFields` (mismo componente que ya
  usa la pantalla de día individual y el preview de estampado) para
  definir UN kind/contenido — se aplica igual a TODAS las fechas
  seleccionadas.
- Al confirmar: `POST /groups/{id}/calendar/bulk { dates, kind, ... }`
  (mismo payload por-día que ya arma `toCalendarDayPayload`, pero un solo
  objeto de contenido en vez de uno por fecha — el mapeo exacto se
  resuelve en el plan de implementación, ver nota de campos en §6).
- Guard de día cerrado: todo-o-nada del lado del backend (ya cubierto
  por la restricción de clase de §3 — si la selección es "abierta", en
  principio ningún día está cerrado, pero el tiempo pudo pasar entre que
  se armó la selección y se confirma el modal — el mismo riesgo ya
  aceptado en `stamp-plan-modal.jsx`, se maneja igual: si el backend
  rechaza, se muestra el error y no se aplica nada, sin reintento
  automático).
- Éxito: toast + `exitSelection()` + invalidar el calendario.

## 5. Componentes y archivos

- **`components/team/calendar-day-menu.jsx`** (modificado) — suma el
  ítem "Seleccionar" (siempre presente, sin condición de `hasContent`/
  `closed`/`isTraining` — cualquier día puede iniciar una selección).
- **`components/team/group-calendar-screen.jsx`** (modificado) —
  estado de modo selección (`selectionMode: boolean` — en verdad
  redundante con `selectedDates.size > 0` dado que la entrada siempre
  pre-selecciona un día, pero se mantiene explícito por claridad, mismo
  criterio que el catálogo de ejercicios distingue "modo activo, nada
  seleccionado" de "modo inactivo"; acá con la entrada nueva ese estado
  intermedio no debería darse nunca en la práctica — decidir en el plan
  si vale la pena la variable separada o alcanza con `size > 0`),
  `selectedDates: Set<string>`, `selectionClosedClass: boolean | null`
  (clase fijada por el primer día); handlers de toggle/salir; el header
  condicional; `CalendarDayCell` gana lógica de "atenuado si es de la
  otra clase, en modo selección".
- **`components/team/bulk-edit-days-modal.jsx`** (nuevo) — el modal de
  "Editar en lote", envolviendo `CalendarDayFields` con su propio estado
  local (sin acumulado tipo estampado, un solo submit).
- **`hooks/use-group-calendar.js`** (modificado) — suma `bulkClear`/
  `isBulkClearing` y `bulkAssign`/`isBulkAssigning` a
  `useGroupCalendarMutations`.
- **`services/calendar.js`** (modificado) — `bulkClearDays(groupId,
  dates)` y `bulkAssignDays(groupId, payload)`.
- **`services/__mocks__/calendar-mock.js`** (modificado) — mocks de
  ambos, reusando la lógica ya existente de `mockUpsertCalendarDay`/
  `mockDeleteCalendarDay` por fecha (un `for` sobre `dates`, mismo
  criterio que `mockStampPlan`).
- **`utils/calendar-day-closed.js`** o un nuevo archivo puro (a decidir
  en el plan) — función `canAddToSelection(currentClosedClass,
  candidateClosed)` — pura, testeable, encapsula la regla de §3 (si
  `currentClosedClass` es `null` (selección vacía) siempre `true`; si no,
  `candidateClosed === currentClosedClass`).

## 6. Testing

Lógica pura testeable con Jest: `canAddToSelection` (regla de clase) y
el mock de `bulkAssignDays`/`bulkClearDays` (mismo criterio que los
mocks de piezas anteriores, con sus propios tests en
`__tests__/calendar-mock.test.js`). El resto (modo selección, header
condicional, modal de edición en lote) se verifica manual, mismo
criterio que toda esta serie — sin tests de render de componentes.

## 7. Explícitamente fuera de esta pieza

- Cualquier acción en lote sobre selecciones "cerradas" (ej. cancelar en
  lote) — no se diseña ni se implementa acá.
- "Evitar pisar" selectivo del estampado y "desplazar" (`shift`) —
  siguientes sub-piezas de la serie, sin tocar en este documento.
- Mejorar el catálogo de ejercicios para usar el mismo patrón de íconos
  en vez de dropdown — nota de producto para más adelante, no forma
  parte de esta pieza.
