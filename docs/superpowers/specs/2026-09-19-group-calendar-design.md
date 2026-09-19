# Calendario de grupo — cableado + vista base del entrenador

**Estado:** aprobado, pendiente de plan de implementación.

**Pieza 1 de 3** del sub-proyecto "calendario de asignaciones" (sub-proyecto 2 del bloque grande de calendario — el sub-proyecto 1, `LocationPicker`, ya está terminado y mergeado, ver `docs/superpowers/specs/2026-09-16-location-picker-design.md`). Las otras dos piezas (estampar un plan arrastrándolo, vista del corredor) tienen su propia spec futura y consumen lo construido acá — nada de esto depende de ellas.

## 1. Contexto y motivación

El backend de `GroupCalendarDay` ya está implementado y documentado en `docs/BACKEND_CALENDAR_ASSIGNMENTS_SPEC.md` (10 endpoints, deployado). El frontend está en cero — el modelo viejo de asignación (`RunnerPlanAssignment`/`Group.training_plan_id`/`assignPlanToRunner` en `services/trainingPlans.js`) queda completamente descartado, nunca llegó a producción.

Esta pieza construye: el servicio/hook contra los 3 endpoints que necesita (listar rango, upsert de un día, borrar un día — no `stamp`/`bulk`/`bulk-clear`/`shift`, esos son de la pieza 2), la vista mensual del calendario de un grupo, y la pantalla de edición de un día individual (incluyendo marcar una sesión como presencial, reusando el `LocationPicker` ya construido).

**Bloqueo parcial de backend (gap 6, ver `docs/BACKEND_API_GAPS.md`):** `presencial_time` pasa a `presencial_time_from`/`presencial_time_to` — cambio de schema que el backend todavía no implementó. Esta pieza se construye igual, contra el modelo nuevo — guardar un día **no presencial** funciona real de punta a punta; guardar un día **presencial** va a fallar con un error real del backend (`422`) hasta que se aplique el cambio del lado de ellos. No es mockeado ni ocultado — el usuario ve el error tal cual, sabe que es un bloqueo de backend conocido.

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
- Clonado por divergencia al editar una sesión con asignaciones activas (`docs/BACKEND_CALENDAR_ASSIGNMENTS_SPEC.md` §5) — toca `create-session-screen.jsx`/`edit-session-screen.jsx` del catálogo, no esta pieza.

## 3. Modelo de datos

```js
// GroupCalendarDay normalizado (services/normalizers.js#toGroupCalendarDayModel)
{
  id: number,
  groupId: number,
  date: string,          // 'YYYY-MM-DD'
  kind: 'rest' | 'other' | 'training' | 'cancelled',
  otherName: string | null,
  sessionId: number | null,
  cancelledReason: string | null,
  isPresencial: boolean,
  presencialTimeFrom: string | null,   // 'HH:mm'
  presencialTimeTo: string | null,     // 'HH:mm'
  presencialLocation: { lat: number, lng: number, label: string | null } | null,
  sourcePlanId: number | null,
}
```

Payload de `PUT` (`toCalendarDayPayload`, dirección inversa) manda exactamente los campos que el backend espera por `kind` — no manda campos que no corresponden (ej. `session_id` en un día `rest`), mismo criterio de "no confiar en que el backend ignore basura" ya aplicado en otros normalizers del proyecto.

## 4. Arquitectura de archivos

```
components/forms/fields.jsx                        # + TimeField (hermano de DateField, mode="time")
services/calendar.js                              # 3 funciones (get/upsert/delete), USE_MOCKS
services/__mocks__/calendar-mock.js                # mock stateful en memoria, mismo patrón que sessions-mock.js
services/normalizers.js                            # + toGroupCalendarDayModel, toCalendarDayPayload
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
   - Entrenamiento → `ResponsiveSelectField` con las sesiones del catálogo del entrenador (mismo `useSessions(ownerId)` ya existente) + toggle "¿Es presencial?".
   - Si presencial: dos `TimeField` (desde/hasta) — componente nuevo en `components/forms/fields.jsx`, mismo split nativo/web que `DateField` ya existente ahí (nativo: `DateTimePicker` con `mode="time"`; web: `<input type="time">`), pero sin `maximumDate` (no aplica a una hora del día) y formateando `HH:mm` en vez de `DD/MM/AAAA`. No se reusa `DateField` tal cual porque está hardcodeado a `mode="date"` y a ese formato — se crea un componente hermano, no se lo sobrecarga con un prop de modo. + `LocationPicker` (`value`/`onChange` con el shape `{lat,lng,label}` ya compatible).
3. Si el día editado ya es `kind: 'training'` (edición sobre un día existente, no alta): botón separado "Cancelar esta sesión" — abre un campo de motivo obligatorio, hace `PUT` con `kind: 'cancelled'` + `cancelled_reason`.
4. Si el día ya tiene contenido (cualquier `kind` distinto de vacío): botón "Vaciar día" (`DELETE`), separado de "Guardar".
5. "Guardar" hace el upsert y vuelve a la vista mensual (`router.back()`).

**Marcado visual del calendario:** punto de color + ícono de pin chico, confirmado con el usuario — no texto dentro de la celda (se trunca feo en mobile angosto) ni solo color de fondo (no distingue presencial de un vistazo).

## 7. Manejo de fechas y fetch por rango

`useGroupCalendar(groupId, from, to)` — query key `['group-calendar', groupId, from, to]`. Cada cambio de mes visible dispara una nueva query con el rango de ese mes (sin prefetch de meses adyacentes en esta pieza — se agrega si en el uso real se nota lag notable al navegar, no antes). Invalidación de mutations: `queryClient.invalidateQueries({ queryKey: ['group-calendar', groupId] })` (prefijo, sin especificar rango — invalida cualquier mes cacheado de ese grupo, mismo criterio que `['sessions', ownerId]` en el resto del proyecto).

## 8. Testing

Sin tests de render (convención del proyecto). `services/normalizers.js#toGroupCalendarDayModel`/`toCalendarDayPayload` sí llevan test unitario en `__tests__/normalizers.test.js` (ya existe ese archivo, se agregan casos) — son mapeos con lógica condicional real (qué campos van según `kind`), no un passthrough trivial.

## 9. Fuera de alcance / diferido (resumen)

- Ver §2. Adicionalmente: sin soporte de `sourcePlanId` en la UI todavía (es informativo, no se muestra "vino del plan X" en esta pieza — se suma si hace falta cuando exista la pieza 2 de estampado).
