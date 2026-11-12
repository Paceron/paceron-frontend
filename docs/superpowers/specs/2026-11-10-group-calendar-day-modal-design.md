# Modal de contenido de día — calendario de grupo

## Intención

Hoy, tocar un día en el calendario de un grupo específico
(`group-calendar-screen.jsx`) abre `CalendarDayMenu`: una lista de acciones
(Editar, Vaciar, Estampar, Cancelar, Desplazar, Seleccionar) sin mostrar
nada de lo que ya hay asignado ese día. Para saber qué sesión/horario tiene
un día, el entrenador tiene que entrar a "Editar" a ciegas.

Esto agrega una vista previa del contenido del día (de un vistazo al pasar
el mouse, y completa en un modal al tocar) con las acciones más usadas al
costado, para no tener que entrar a edición solo para mirar.

## Alcance

- Pantallas: `components/team/group-calendar-screen.jsx` (celda del mes) y
  un modal nuevo (ver "Componentes").
- **No** toca `components/calendar/day-detail-modal.jsx` (modal de la vista
  agregada entre equipos/grupos, `administered-calendar-screen.jsx`/
  `my-calendar-screen.jsx`) ni `group-calendar-day-screen.jsx` (pantalla de
  edición completa, sigue siendo el destino de "Editar").

## No-objetivos

- No cambia el mecanismo de selección múltiple ni el de estampado de plan
  en sí — el modal nuevo solo ofrece accesos a esos flujos ya existentes.
- No agrega colisión presencial entre grupos (`presencialCollision`) acá —
  ese dato es exclusivo de la vista agregada, esta pantalla ya está
  acotada a un solo grupo.

## Estado actual (para quien no lo tenga fresco)

- `CalendarDayCell` (`group-calendar-screen.jsx`): celda del mes, ya
  colorea según `marking.kind` (`feat(group-calendar): solid kind colors`,
  2026-11-09). Al tocar, si `canManage` y no es de otro mes, mide su
  posición y llama `onOpenMenu(dateString, {x,y,width,height})`.
- El caller abre `CalendarDayMenu` en un `AnimatedDropdown` anclado a esas
  coordenadas. El panel es solo una lista de `Pressable` con texto — nunca
  muestra `kind`/horario/sesión del día.
- `group-calendar-day-screen.jsx` ya tiene todos los campos del día
  (`existingDay.kind`, `.otherName`, `.sessionInstance`, `.isPresencial`,
  `.presencialTimeFrom/To`, `.presencialLocation`) vía `useGroupCalendar`.
- `components/calendar/start-session-button.jsx` ya resuelve qué pill
  mostrar (Iniciar entrenamiento / Registro de Sesión / Ver sesión / Ver
  registros) según fecha, rol y estado de la sesión — se reusa tal cual,
  sin lógica nueva. `useGroupCalendar` (a diferencia del hook de la vista
  agregada) no trae `teamId`/`teamName`/`groupName` en el día — mismo caso
  ya resuelto en `group-calendar-day-screen.jsx`, que le pasa `teamId`
  como prop APARTE de `assignment` (`StartSessionButton` ya tiene el
  fallback `assignment.teamId ?? teamId ?? null`) y no completa
  `teamName`/`groupName` (quedan `null`, solo afectan un label en la
  pantalla de revisión, no rompen nada). El modal nuevo sigue el mismo
  patrón ya en uso, no hay nada nuevo que resolver acá.
- `components/shared/icon-tooltip.jsx` (`IconTooltip`) ya resuelve
  hover-solo-web con portal a `document.body` — envuelve un único
  `Pressable` y le inyecta `onHoverIn`/`onHoverOut`; en nativo devuelve
  los children sin cambios (no hay hover táctil). Se reusa, no se
  reinventa.

## Diseño

### 1. Celda con contenido: hover muestra un tooltip chico

`CalendarDayCell` envuelve su `Pressable` existente con `IconTooltip`
**solo si `marking` existe y `marking.kind !== 'rest'`** (ver punto 4 —
descanso no es "contenido" a estos fines). Label armado en una función
pura nueva (`utils/calendar-day-tooltip.js`, testeable): `"Entrenamiento ·
18:00–19:30"` si `isPresencial`, si no `kindLabel` solo (`"Entrenamiento"`
/ `"Otra actividad"` / `"Cancelado"`). Nada de sesión/ejercicios en el
tooltip — eso es lo que separa "pequeña información" del modal completo.

### 2. Celda con contenido: click abre el modal nuevo

`GroupDayContentModal` (nuevo, `components/team/group-day-content-modal.jsx`).
Reemplaza `CalendarDayMenu` **solo cuando el día tocado tiene `marking` y
no es `rest`** — un día vacío o de descanso sigue abriendo
`CalendarDayMenu` exactamente como hoy (mismo componente, mismo
`AnimatedDropdown`, sin tocar esa rama).

Layout (opción B elegida en la sesión de brainstorming, ver capturas en
`.superpowers/brainstorm/` de esta sesión si hace falta repasarlas):
modal centrado (no un dropdown pegado a la celda, a diferencia de
`CalendarDayMenu`), dos columnas en web ancha, apilado en mobile/web
angosta (mismo criterio `isDesktopWeb` que el resto de la app) —
**contenido a la izquierda, acciones a la derecha**.

**Columna de contenido** (tarjeta con fondo del color del `kind`, mismo
mapeo `KIND_FILLED_CLASS`/`KIND_DOT_COLORS` que ya usa la celda —
inspirada en el hero de `next-training-banner.jsx`: kicker chico +
nombre/tipo grande + metadata):
- Kicker: día de semana + fecha (`formatWeekdayLabel`/`formatDisplayDate`).
- Nombre de sesión (si `sessionInstance`) + cantidad de ejercicios, mismo
  formato que `AssignmentRow` de `day-detail-modal.jsx` (`"{name} · N
  ejercicios"`).
- Si `isPresencial`: horario + ubicación (ícono `map-marker-outline`,
  mismo patrón que ya existe).
- Si `kind === 'other'`: `otherName`.
- Si `kind === 'cancelled'`: label "Sesión cancelada", sin mostrar
  ejercicios (ya cancelada, no aporta).

**Columna de acciones** (pills, mismo lenguaje visual que
`StartSessionButton` — ícono + texto mayúscula, no el botón bordeado
blanco que tenía "Ir a este día" en el modal agregado, que acá ni existe):
- `StartSessionButton` tal cual (ya decide solo, incluido no-renderizar si
  no corresponde ninguna de sus variantes).
- "Editar" → navega a `group-calendar-day-screen.jsx` (mismo destino que
  hoy desde `CalendarDayMenu`).
- "Estampar plan" → abre `StampPlanModal` con `startDate` = este día
  (mismo flujo que hoy).
- Un disparador "⋯" chico al pie de la columna abre un menú flotante
  acotado con las 4 acciones menos frecuentes de `CalendarDayMenu`
  (Vaciar día, Cancelar sesión si `isTraining`, Seleccionar, Desplazar
  desde acá), **reusando ese contenido ya escrito** en vez de duplicar
  JSX — extraer esas 4 filas de `CalendarDayMenu` a un sub-componente si
  hace falta compartirlas limpio entre los dos paneles. Ninguna de las 4
  desaparece de este flujo, solo se reacomoda.

### 3. Celda vacía: sin cambios

Ni tooltip ni modal nuevo. `handlePress` sigue abriendo `CalendarDayMenu`
exactamente como hoy.

### 4. Día de descanso = tratado como vacío visualmente

En `CalendarDayCell`: sacar `rest` de `KIND_FILLED_CLASS` (cae al branch
`default`, borde/relleno claro de "vacío") y de la lógica de punto/ícono
(sin punto propio). El día SIGUE teniendo `marking` real en los datos
(el backend sabe que hay un descanso asignado) — el cambio es solo
visual, en la celda. Consecuencia directa de los puntos 1 y 2: con
`marking.kind === 'rest'` excluido de "contenido" a esos fines, un día de
descanso no dispara tooltip ni abre el modal nuevo — abre
`CalendarDayMenu` igual que un día vacío, con "Editar" en vez de
"Asignar" (`hasContent` sigue siendo true para el menú, que no cambia).

## Fuera de este diseño, pero en la misma rama

Bug ya diagnosticado y resuelto en esta rama, sin relación de diseño con
lo de arriba: `stamp-plan-modal.jsx` mostraba "Se pisa" en los días recién
estampados por la propia operación en curso, porque `existingByDate` leía
una query en vivo que se actualizaba a mitad del guardado. Fix: congelar
esa lista al arrancar el guardado.

## Lo que queda a criterio de quien implemente

- Nombre/ícono exacto del disparador "⋯" (ej. `dots-horizontal`, sigue el
  lenguaje ya usado en otros menús secundarios del repo).
- Tamaño exacto de la tarjeta de contenido y breakpoint de apilado (mismo
  criterio `isDesktopWeb`/`useIsNarrowWeb()` ya usado en todo el repo, sin
  valor nuevo que inventar).
- Si extraer las 3 acciones menos frecuentes a un sub-componente compartido
  entre `CalendarDayMenu` y el menú "⋯" del modal nuevo, o duplicar las 3
  filas (son cortas) — preferir compartir si no complica las props.
