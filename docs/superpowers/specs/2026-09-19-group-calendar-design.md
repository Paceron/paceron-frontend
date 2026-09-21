# Calendario de grupo — cableado + vista base del entrenador

**Estado:** implementado (9 tasks del plan), con una ronda de pulido post-implementación 2026-09-21 (ver abajo).

**Actualización 2026-09-21 — pulido post-implementación, feedback de uso real:**
- **Perf:** `group-calendar-screen.jsx`/`group-calendar-day-screen.jsx` usaban `useUser(userId)` solo para volver a leer `user.userId` — ese valor ya está disponible sincrónico en `useAuthStore((s) => s.userId)`, sin esperar ningún fetch. Cambiado a leerlo directo — saca una vuelta de red completa antes de poder arrancar `useGroups`/`useSessions`.
- **Bug real — navegar de mes en el calendario volvía siempre al mes actual:** causa, el `<Calendar>` de `react-native-calendars` se desmontaba mientras `loadingDays` era `true` (reemplazado por un `SkeletonBlock`) — al no ser un componente controlado por default, cualquier remount lo hace arrancar de nuevo en el mes de hoy. Fix: nunca desmontar `<Calendar>` por loading (el indicador de carga ahora es un `ActivityIndicator` chico al lado del título, no un reemplazo de toda la grilla), más un `current` controlado por nuestro propio estado como blindaje extra.
- **Tema oscuro/claro no se aplicaba al chrome del calendario** (nombres de mes/día, flechas) — solo el contenido de cada celda (`dayComponent` custom) ya respetaba el tema; el resto lo maneja el prop `theme` de la librería, que no se estaba pasando. Sumado `theme` completo (`calendarBackground`, `textSectionTitleColor`, `monthTextColor`, `arrowColor`, `todayTextColor`, `textDisabledColor`) desde `useThemeColors()`, más un contenedor con fondo/borde temáticos.
- **Días cerrados (pasados, o de hoy ya empezados) — nueva utilidad `utils/calendar-day-closed.js#isCalendarDayClosed`**, réplica exacta del criterio del backend (`calendar_service.go#isCalendarDayClosed`): fecha pasada siempre cerrada; hoy cerrado salvo presencial con horario todavía no arrancado; futuro nunca cerrado. Uso: los días cerrados se ven atenuados (opacidad reducida en el punto/pin) en la vista mensual, y en la pantalla de edición se deshabilitan "Guardar"/"Vaciar día" con un cartel explicativo — "Cancelar esta sesión" sigue siempre disponible (mismo criterio que el backend, que no bloquea esa transición). Es un check *advisory* del lado del cliente — el backend sigue siendo quien realmente lo hace cumplir con `422`.

**Pieza 1 de 3** del sub-proyecto "calendario de asignaciones" (sub-proyecto 2 del bloque grande de calendario — el sub-proyecto 1, `LocationPicker`, ya está terminado y mergeado, ver `docs/superpowers/specs/2026-09-16-location-picker-design.md`). Las otras dos piezas (estampar un plan arrastrándolo, vista del corredor) tienen su propia spec futura y consumen lo construido acá — nada de esto depende de ellas.

## 1. Contexto y motivación

El backend de `GroupCalendarDay` ya está implementado y documentado en `docs/BACKEND_CALENDAR_ASSIGNMENTS_SPEC.md` (10 endpoints, deployado). El frontend está en cero — el modelo viejo de asignación (`RunnerPlanAssignment`/`Group.training_plan_id`/`assignPlanToRunner` en `services/trainingPlans.js`) queda completamente descartado, nunca llegó a producción.

Esta pieza construye: el servicio/hook contra los 3 endpoints que necesita (listar rango, upsert de un día, borrar un día — no `stamp`/`bulk`/`bulk-clear`/`shift`, esos son de la pieza 2), la vista mensual del calendario de un grupo, y la pantalla de edición de un día individual (incluyendo marcar una sesión como presencial, reusando el `LocationPicker` ya construido).

**Gap 6 (`presencial_time` → rango desde/hasta) — RESUELTO.** El backend ya lo implementó y deployó, sin bloqueo. Ver `docs/BACKEND_API_GAPS.md`.

**Cambio de modelo confirmado 2026-09-20 — instanciación de sesiones (`docs/BACKEND_CALENDAR_ASSIGNMENTS_SPEC.md` §3.1bis):** asignar una sesión a un día de calendario ya no guarda una referencia viva al catálogo — el backend **instancia** (copia congelada) la sesión y sus ejercicios en el momento del `PUT`, y la respuesta embebe esa copia bajo `session_instance` (no un `session_id` crudo). El request del `PUT` sigue mandando `session_id` (id de catálogo) igual que antes — la asimetría es real: se escribe con un id de catálogo, se lee un objeto congelado sin vínculo de vuelta.

Dos consecuencias que esta pieza tiene que absorber:
- **Cada guardado de un día `training` reinstancia de cero**, incluso si no se tocó la sesión — el backend no tiene forma de "conservar la instancia actual" hoy (**Gap 7 abierto**, `docs/BACKEND_API_GAPS.md`, pendiente de implementación del lado de ellos). Mientras tanto, la pantalla de edición siempre exige re-elegir una sesión del catálogo al guardar un día `training`, incluso al editar uno ya asignado.
- **No hay forma exacta de saber de qué sesión de catálogo salió una instancia ya creada** (sin referencia de vuelta, mismo Gap 7) — la pantalla de edición no puede preseleccionar con certeza el dropdown al editar; usa un match por nombre contra el catálogo actual como mejor esfuerzo (ver §6), y siempre muestra un bloque de solo lectura con el contenido congelado real, independiente de si el match funcionó.

**Guard de "día cerrado" (`422`, confirmado en código):** el backend bloquea `PUT`/`DELETE` sobre una fecha pasada o un presencial ya empezado — única excepción, cancelar (`kind='cancelled'`). Esta pieza no agrega ninguna lógica cliente para anticipar esto — el error del backend se muestra tal cual en el toast genérico de error, igual que cualquier otro fallo de guardado. Gating proactivo (deshabilitar "Guardar" antes de intentarlo) queda como posible pulido futuro, no es parte de esta pieza.

## 2. Alcance

**Incluido:**
- `services/calendar.js` — `getGroupCalendar(groupId, from, to)`, `upsertCalendarDay(groupId, date, payload)`, `deleteCalendarDay(groupId, date)`, con mock de respaldo (`USE_MOCKS`, mismo patrón que `services/sessions.js`).
- `hooks/use-group-calendar.js` — query por rango de fechas (TanStack Query) + mutations con invalidación.
- Vista mensual del calendario de un grupo (`react-native-calendars`), con marcado visual por día (punto de color por tipo + ícono de pin si es presencial).
- Pantalla de edición de un día: tipo (descanso/otra actividad/entrenamiento), campos condicionales, presencial (hora desde/hasta + `LocationPicker`), acción de cancelar sesión, acción de vaciar día.
- Entrada de navegación: acción "Ver calendario" en `GroupRow` (`components/team/team-detail-screen.jsx`) → ruta nueva.

**Fuera de alcance (piezas futuras o diferido a propósito):**
- Estampar un plan arrastrándolo sobre el calendario (`stamp`) — pieza 2.
- Vista del corredor / reemplazo de `my-plans-screen.jsx` — pieza 3.
- Multi-selección, `bulk-assign`, `bulk-clear`, `shift` de fechas — sin UI todavía, se suman cuando haya un caso de uso concreto que los pida.
- Clonado por divergencia al editar una sesión con asignaciones activas — **eliminado del backend** (`docs/BACKEND_CALENDAR_ASSIGNMENTS_SPEC.md` §5, marcado obsoleto 2026-09-20, ver §3.1bis del mismo doc). No aplica más, ni acá ni en ninguna otra pieza — la instanciación de sesiones lo reemplaza por completo.

## 3. Modelo de datos

```js
// GroupCalendarDay normalizado (services/normalizers.js#toGroupCalendarDayModel)
// sessionInstance viene de la respuesta (session_instance embebido, copia
// congelada — ver docs/BACKEND_CALENDAR_ASSIGNMENTS_SPEC.md §3.1bis), NO
// es el id de catálogo. Nunca se usa para preseleccionar el select de
// sesión — ver §6.
{
  id: string,
  groupId: string,
  date: string,          // 'YYYY-MM-DD'
  kind: 'rest' | 'other' | 'training' | 'cancelled',
  otherName: string | null,
  sessionInstance: {
    id: string,
    name: string,
    description: string | null,
    exercises: Array<{ id: string, name: string, role: string, repeatCount: number, restMinutes: number }>,
  } | null,
  cancelledReason: string | null,
  isPresencial: boolean,
  presencialTimeFrom: string | null,   // 'HH:mm'
  presencialTimeTo: string | null,     // 'HH:mm'
  presencialLocation: { lat: number, lng: number, label: string | null } | null,
  sourcePlanId: string | null,
}
```

Payload de `PUT` (`toCalendarDayPayload`, dirección inversa) es un objeto **distinto**, no la vuelta del modelo — sigue tomando un `sessionId` (id de **catálogo**, elegido en el select de esta sesión de edición) porque eso es lo que el `PUT` sigue esperando (`session_id`, sin cambio del lado del request). Manda exactamente los campos que el backend espera por `kind` — no manda campos que no corresponden (ej. `session_id` en un día `rest`), mismo criterio de "no confiar en que el backend ignore basura" ya aplicado en otros normalizers del proyecto.

## 4. Arquitectura de archivos

```
components/forms/fields.jsx                        # + TimeField (hermano de DateField, mode="time")
services/calendar.js                              # 3 funciones (get/upsert/delete), USE_MOCKS
services/__mocks__/calendar-mock.js                # mock stateful en memoria, mismo patrón que sessions-mock.js
services/normalizers.js                            # + toGroupCalendarDayModel, toCalendarDayPayload
utils/session-instance-match.js                    # findMatchingCatalogSession(sessionInstance, sessions) — match por nombre, función pura testeable
hooks/use-group-calendar.js                        # useGroupCalendar(groupId, from, to) + useGroupCalendarMutations(groupId)
components/team/group-calendar-screen.jsx          # vista mensual
components/team/group-calendar-day-screen.jsx      # edición de un día
app/(tabs)/teams/[teamId]/groups/[groupId]/calendar/index.jsx     # ruta del mes
app/(tabs)/teams/[teamId]/groups/[groupId]/calendar/[date].jsx    # ruta de edición de día
```

`GroupRow` (`components/team/team-detail-screen.jsx`) suma una acción nueva junto a editar/borrar.

## 5. Librería de calendario: `react-native-calendars`

Confirmado 100% JS (sin módulo nativo, sin dependencia de gesture-handler/reanimated — usa `PanResponder` para el swipe entre meses) — cero riesgo de incompatibilidad con Fabric/New Architecture, a diferencia de librerías nativas evaluadas antes en el proyecto. Mantenida activamente.

Uso concreto: componente `Calendar` (vista de un solo mes, no `CalendarList`/`Agenda`), con:
- `markedDates` — un punto de color por día según `kind` (`rest`=gris, `other`=ámbar, `training`=verde, `cancelled`=rojo), más un ícono de pin superpuesto si `isPresencial` (vía `dayComponent` custom en vez del marcado default, para poder combinar punto + ícono en la misma celda).
- `onDayPress` — navega a la pantalla de edición de esa fecha.
- `onMonthChange` — dispara el refetch del rango (mes visible completo, `from`/`to` = primer/último día del mes).
- `LocaleConfig` en español (nombres de mes/día), semana empezando lunes — configuración estándar de la librería, un archivo de config una sola vez (`config/calendarLocale.js`).

## 6. Flujo UX

**Vista mensual** (`group-calendar-screen.jsx`): header con nombre del grupo + back, el `Calendar` de `react-native-calendars` ocupando el ancho disponible (responsive — funciona en cualquier viewport web, ver convención del proyecto), navegación de mes con las flechas nativas del componente. Mientras carga el rango del mes visible: skeleton (mismo patrón `SkeletonBlock` ya usado en el resto del proyecto).

**Edición de un día** (`group-calendar-day-screen.jsx`, pantalla dedicada — no modal, para no anidar el `Modal` de `LocationPicker` dentro de otro `Modal`):
1. Selector de tipo segmentado: Descanso / Otra actividad / Entrenamiento. No incluye "Cancelado" — el backend solo permite pasar a `cancelled` desde `training` (ver §3.1 de la spec de backend), no es una opción de alta.
2. Campos condicionales:
   - Otra actividad → `InputField` de texto libre (nombre).
   - Entrenamiento → **siempre** un `ResponsiveSelectField` con las sesiones del catálogo del entrenador (mismo `useSessions(ownerId)` ya existente) — obligatorio en cada guardado, incluso editando un día que ya tiene una sesión asignada (el backend reinstancia en cada `PUT`, no hay forma de omitirlo hoy, ver §1/Gap 7). Si el día ya tiene una instancia asignada (`existingDay.sessionInstance`), se muestra además, siempre visible arriba del select, un bloque de solo lectura "Sesión asignada actualmente" (nombre + descripción congelados, tal cual los devuelve el backend) — así el entrenador ve qué hay cargado aunque el select no logre preseleccionar nada. El select intenta preseleccionar por **mejor esfuerzo**: busca en el catálogo actual una sesión cuyo `name` coincida exactamente con `existingDay.sessionInstance.name`; si hay match, la preselecciona (aceptando que puede reinstanciar una versión editada de "la misma" sesión); si no hay match (renombrada o borrada del catálogo desde que se asignó), el select queda vacío y el entrenador elige a mano. + toggle "¿Es presencial?".
   - Si presencial: dos `TimeField` (desde/hasta) — componente nuevo en `components/forms/fields.jsx`, mismo split nativo/web que `DateField` ya existente ahí (nativo: `DateTimePicker` con `mode="time"`; web: `<input type="time">`), pero sin `maximumDate` (no aplica a una hora del día) y formateando `HH:mm` en vez de `DD/MM/AAAA`. No se reusa `DateField` tal cual porque está hardcodeado a `mode="date"` y a ese formato — se crea un componente hermano, no se lo sobrecarga con un prop de modo. + `LocationPicker` (`value`/`onChange` con el shape `{lat,lng,label}` ya compatible).
3. Si el día editado ya es `kind: 'training'` (edición sobre un día existente, no alta): botón separado "Cancelar esta sesión" — abre un campo de motivo obligatorio, hace `PUT` con `kind: 'cancelled'` + `cancelled_reason`.
4. Si el día ya tiene contenido (cualquier `kind` distinto de vacío): botón "Vaciar día" (`DELETE`), separado de "Guardar".
5. "Guardar" hace el upsert y vuelve a la vista mensual (`router.back()`).

**Marcado visual del calendario:** punto de color + ícono de pin chico, confirmado con el usuario — no texto dentro de la celda (se trunca feo en mobile angosto) ni solo color de fondo (no distingue presencial de un vistazo).

## 7. Manejo de fechas y fetch por rango

`useGroupCalendar(groupId, from, to)` — query key `['group-calendar', groupId, from, to]`. Cada cambio de mes visible dispara una nueva query con el rango de ese mes (sin prefetch de meses adyacentes en esta pieza — se agrega si en el uso real se nota lag notable al navegar, no antes). Invalidación de mutations: `queryClient.invalidateQueries({ queryKey: ['group-calendar', groupId] })` (prefijo, sin especificar rango — invalida cualquier mes cacheado de ese grupo, mismo criterio que `['sessions', ownerId]` en el resto del proyecto).

## 8. Testing

Sin tests de render (convención del proyecto). `services/normalizers.js#toGroupCalendarDayModel`/`toCalendarDayPayload` sí llevan test unitario en `__tests__/normalizers.test.js` (ya existe ese archivo, se agregan casos) — son mapeos con lógica condicional real (qué campos van según `kind`), no un passthrough trivial. El match por nombre de §6 (preselección por mejor esfuerzo del select de sesión) se extrae como función pura (`findSessionByInstanceName(sessionInstance, sessions)` o similar) para poder testearla igual, en vez de dejarla enterrada como lógica inline del componente.

## 9. Fuera de alcance / diferido (resumen)

- Ver §2. Adicionalmente: sin soporte de `sourcePlanId` en la UI todavía (es informativo, no se muestra "vino del plan X" en esta pieza — se suma si hace falta cuando exista la pieza 2 de estampado).
- **Evitar la reinstanciación en guardados que no tocan la sesión** — depende de Gap 7 (`docs/BACKEND_API_GAPS.md`), sin implementación del lado del backend todavía. Cuando se resuelva, parche chico: sumar "la instancia actual" como opción del select (usando el `session_id` de origen que expondría el backend) en vez de depender del match por nombre.
