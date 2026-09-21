# Calendario de asignaciones — Menú de acciones por día (design)

**Status:** aprobado, pendiente de plan de implementación.

**Contexto:** piezas 1 (vista mensual + edición de día) y 2 (estampado de
plan) del calendario de asignaciones ya están implementadas y
commiteadas en `feature/group-calendar` — ver
`docs/superpowers/specs/2026-09-19-group-calendar-design.md` y
`docs/superpowers/specs/2026-09-21-calendar-plan-stamping-design.md`.

Tras probar ambas piezas, el usuario pidió gestión más avanzada del
calendario: menú de acciones por día, selección múltiple con acciones en
lote, evitar pisar selectivo al estampar, y desplazar asignación
(`shift`). Es demasiado para un solo spec — se decidió partirlo en
sub-piezas propias, en este orden:

1. **Menú de acciones por día — este documento.**
2. Selección múltiple + acciones en lote (`bulk`/`bulk-clear`).
3. Evitar pisar selectivo dentro del estampado.
4. Desplazar asignación (`shift`).

Las piezas 2-4 quedan sin especificar todavía — no asumir nada de su
diseño desde este documento, cada una se brainstorming por separado
cuando llegue su turno.

## 1. Qué cambia

Hoy, tocar un día en `group-calendar-screen.jsx` (`handleDayPress`)
navega directo a `group-calendar-day-screen.jsx`. Pasa a abrir un menú
contextual con las acciones disponibles para ESE día — la navegación a
la pantalla de edición queda como una de las opciones del menú, no el
único resultado posible del tap.

**Decisiones tomadas en brainstorming, no reabrir sin motivo nuevo:**

- **El tap simple abre el menú** (no un ícono aparte ni un
  mantener-presionado) — reemplaza la navegación directa por completo.
- **"Asignar" y "Editar" son la MISMA pantalla** (`group-calendar-day-screen.jsx`,
  sin cambios de comportamiento ahí) — el menú solo cambia la etiqueta
  según si el día ya tiene contenido guardado o no. No hay una pantalla
  de "asignación" separada.
- **"Seleccionar" (entrada a modo multi-selección) queda deliberadamente
  fuera de esta pieza** — se suma recién en la sub-pieza 2, junto con la
  barra de acciones en lote que le da sentido. Un ítem de menú que activa
  un modo sin ninguna acción de lote todavía sería un ítem "muerto" al
  probar esta pieza sola — cada sub-pieza debe quedar funcionando de
  punta a punta por separado (mismo criterio que ya rigió las piezas 1 y
  2 de este sub-proyecto).

## 2. Contenido del menú

Calculado con datos que `group-calendar-screen.jsx` YA tiene disponibles
por día (`markingsByDate[date]`, alimentado por `useGroupCalendar`) más
`isCalendarDayClosed` (`utils/calendar-day-closed.js`, ya usado para el
tinte de la celda) — no hace falta ningún fetch nuevo para decidir qué
mostrar:

| Ítem | Condición para mostrarse | Acción |
|---|---|---|
| **"Asignar"** | el día NO tiene fila guardada (`markingsByDate[date]` es `undefined`) | navega a `group-calendar-day-screen.jsx` para esa fecha |
| **"Editar"** | el día SÍ tiene fila guardada | navega a `group-calendar-day-screen.jsx` para esa fecha (mismo destino que "Asignar", solo cambia la etiqueta) |
| **"Vaciar día"** | tiene fila guardada Y no está cerrado (`!isCalendarDayClosed(...)`) | `deleteDay({ date })` de `useGroupCalendarMutations`, directo desde el menú, sin pasar por la pantalla completa |
| **"Cancelar sesión"** | `kind === 'training'` (sin importar si está cerrado — misma excepción que ya aplica en `group-calendar-day-screen.jsx`) | abre el mismo prompt de motivo de cancelación que ya existe en la pantalla de día — ver §4 sobre cómo se reusa sin duplicar |

"Asignar"/"Editar" es siempre el primer ítem, mutuamente excluyente con
el otro (nunca se muestran los dos). "Vaciar día" y "Cancelar sesión"
son independientes entre sí y pueden coexistir (un día `training` con
contenido y no cerrado muestra los 4 — bueno, los 3: Editar + Vaciar +
Cancelar).

Un día completamente vacío (sin fila) solo muestra "Asignar" — no hay
nada que vaciar ni cancelar.

## 3. Posicionamiento del menú

Mismo patrón ya establecido en el proyecto para dropdowns anidados
dentro de una lista (`exercises-catalog-tab.jsx`, `ExerciseMenuButton`/
`containerRef`, documentado en CLAUDE.md sección "Selects" — aplica
igual acá aunque no sea un select, es el mismo problema de
posicionamiento de `AnimatedDropdown`): **NUNCA** montar un
`AnimatedDropdown` por celda con `measureInWindow` crudo — se monta
**una sola vez** en `group-calendar-screen.jsx`, anclado a un contenedor
de referencia estable.

- `group-calendar-month-view` (el `View` que envuelve el `<Calendar>`)
  pasa a tener `position: 'relative'` explícito (hoy no lo tiene) y un
  `ref` (`monthViewRef`).
- Cada `CalendarDayCell`, al tocarse, mide su propia posición
  (`measureInWindow`) y la del `monthViewRef`, resta ambas coordenadas
  (igual que `ExerciseMenuButton`, líneas 44-51 de
  `exercises-catalog-tab.jsx`), y reporta `{ x, y, width, height }` hacia
  `group-calendar-screen.jsx` vía un callback `onOpenMenu(date, anchor)`.
- `group-calendar-screen.jsx` guarda `{ date, anchor }` en un solo
  `useState` (`openDayMenu`) y monta el `AnimatedDropdown` una vez,
  `anchorStyle={{ left: anchor.x, top: anchor.y + anchor.height + 4 }}`
  (mismo offset que ya usa `exercises-catalog-tab.jsx`).

## 4. Reuso del prompt de cancelación

`group-calendar-day-screen.jsx` ya tiene el modal de "Cancelar sesión"
(motivo + confirmar) completo, con su propio estado
(`cancelPromptVisible`, `cancelReason`, `cancelling`) y su mutación
(`upsertDay({ date, day: { kind: 'cancelled', cancelledReason } })`).
Para no duplicar ese modal, la opción "Cancelar sesión" del menú de día
NO abre un modal propio — navega a `group-calendar-day-screen.jsx` con
un parámetro de query (`?action=cancel`) que la pantalla lee al montar
para abrir el prompt de cancelación automáticamente (`cancelPromptVisible`
arranca en `true` en vez de `false` si el parámetro está presente). Es
el único cambio de comportamiento que toca `group-calendar-day-screen.jsx`
en esta pieza — todo lo demás de esa pantalla queda intacto.

"Vaciar día", en cambio, SÍ se resuelve completo desde el menú sin
navegar — ya existe `deleteDay` en `useGroupCalendarMutations(groupId)`,
reusable tal cual desde `group-calendar-screen.jsx` sin pasar por la
pantalla de día. Éxito/error se muestran con el mismo patrón de
`Toast`/haptics que ya usa esa pantalla (`notifySuccess`/`notifyError`
de `utils/haptics.js`).

## 5. Archivos

- **`components/team/calendar-day-menu.jsx`** (nuevo) — el panel del
  menú (`CalendarDayMenu`, la lista de ítems condicional de §2) y el
  wrapper de medición por celda (`CalendarDayMenuTrigger` o
  equivalente, reemplaza el `Pressable` de tap directo que hoy tiene
  `CalendarDayCell`).
- **`components/team/group-calendar-screen.jsx`** (modificado):
  - `CalendarDayCell` deja de recibir `onPress` como "navegar" — pasa a
    reportar `{ date, anchor }` hacia arriba.
  - `handleDayPress` se reemplaza por `handleOpenDayMenu(date, anchor)`
    que solo guarda el estado del menú abierto.
  - Nuevos handlers `handleAssignOrEdit(date)` (navega),
    `handleClearDay(date)` (llama `deleteDay`), `handleCancelSession(date)`
    (navega con `?action=cancel`) — cada uno cierra el menú al terminar.
  - `group-calendar-month-view` suma `relative` a su className y un
    `ref`.
  - Monta `<CalendarDayMenu />` una vez, controlado por `openDayMenu`.
- **`components/team/group-calendar-day-screen.jsx`** (modificado,
  mínimo): lee `action` de `useLocalSearchParams()` (Expo Router, ya se
  usa en otras pantallas del proyecto) — si `action === 'cancel'` y
  `canCancelSession`, `cancelPromptVisible` arranca en `true` en vez de
  `false`.
- **Ruta** `app/(tabs)/teams/[teamId]/groups/[groupId]/calendar/[date].jsx`
  (confirmada, ya existe de la pieza 1) no necesita cambios — Expo
  Router pasa query params extra automáticamente sin declararlos en el
  archivo de ruta.

## 6. Testing

Sin lógica pura nueva que testear con Jest — este cambio es
enteramente de interacción/UI (menú, medición, navegación con query
param), mismo criterio que la pieza 1 (sin tests de render de
componentes, convención del proyecto). Se verifica manual — el plan de
implementación cierra con un script de test manual, mismo formato que
las piezas 1 y 2.

## 7. Riesgo conocido, a vigilar en la implementación

El patrón de medición (`measureInWindow` relativo a un contenedor) ya
se usó en `exercises-catalog-tab.jsx` sin problemas — pero ahí las
`ExerciseRow` son elementos de una lista simple. Acá `CalendarDayCell`
es el `dayComponent` de `react-native-calendars`, una librería de
terceros que controla su propio ciclo de montaje/desmontaje al navegar
entre meses (ver la extensa historia de bugs de esa librería ya
documentada en la pieza 1 — remount-pierde-mes, etc.). No debería haber
interacción entre ese historial y este cambio (el menú no toca el
montaje del `<Calendar>` en sí, solo lo que pasa al tocar una celda),
pero es la única superficie de riesgo real de esta pieza — confirmar en
el test manual que abrir el menú, cerrarlo, y navegar de mes no rompe
nada de lo ya andando.
