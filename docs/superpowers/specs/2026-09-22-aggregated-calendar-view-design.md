# Vista agregada de calendario (pieza 2/3) — diseño

## Contexto

Pieza 1 del sub-proyecto de "gestión avanzada del calendario de grupo"
(menú de día, selección múltiple, evitar pisar, desplazar) ya está
implementada y confirmada funcionando en `feature/group-calendar`. Esa
pieza opera siempre sobre **un grupo puntual**
(`components/team/group-calendar-screen.jsx`), con foco en la
escritura (asignar/editar/cancelar/estampar/desplazar).

Esta pieza (2 de 3) agrega una **vista de solo lectura, agregada entre
TODOS los grupos** del usuario — para el corredor, todos los grupos de
los que es miembro; para el entrenador, todos los grupos que
administra — accesible desde un ítem nuevo en el header de navegación.
Al tocar un día se abre un modal de detalle que soporta **más de una
asignación el mismo día** (el usuario puede pertenecer/administrar
varios grupos con contenido en la misma fecha).

Pieza 3 (banners del home con "próximo entrenamiento") queda fuera del
alcance de este documento — depende del backend de Gap 10, ya resuelto,
pero es una pieza propia con su propio diseño.

## Backend (ya resuelto, Gap 11 — verificado contra código real 2026-09-22)

- `GET /users/{id}/member-calendar?from={date}&to={date}` (corredor):
  array de días de TODOS los grupos de los que es miembro en el rango.
  Cada item = shape de `GroupCalendarDay` (igual al de
  `GET /groups/{id}/calendar`) más `group_id`, `group_name`, `team_id`,
  `team_name` resueltos server-side. `400` si falta `from`/`to`, formato
  inválido, o `from > to`. `403` si `{id}` no es el propio usuario.
- `GET /users/{id}/administered-calendar?from={date}&to={date}`
  (entrenador): mismo shape, de TODOS los grupos que administra
  (`owner_id`). Cada día presencial que colisiona con otro grupo
  administrado en la misma fecha suma
  `presencial_collision: {type: 'same_team'|'cross_team', conflicts: [...]}`
  (`cross_team` gana si hay de ambos tipos; incluye colisiones viejas de
  antes del guard de Gap 9; ausente si no colisiona).
- `GET /users/{id}/calendar-summary` (ya documentado, sin gap): array de
  `{group_id, group_name}` — un ítem por cada grupo del que el usuario
  es miembro. Se usa acá para poblar los chips de filtro del corredor
  (ver más abajo) — es la única fuente de "todos mis grupos" que no
  depende de que el mes visible tenga contenido.

Ver `docs/BACKEND_CALENDAR_ASSIGNMENTS_SPEC.md` (tabla de endpoints) y
`docs/BACKEND_API_GAPS.md` (Gap 11) para el contrato completo.

## Decisión: dos rutas separadas, no una sola pantalla condicional

Precedente ya existente en `routes/catalog.js`: `myPlansRoute`
(`role: 'runner'`) y `trainingPlansRoute` (`role: 'trainer'`) — "son
conceptos distintos, no la misma pantalla con otro título" (comentario
del archivo). El calendario agregado tiene la misma dualidad: el
corredor ve lo que le asignaron (`member-calendar`), el entrenador ve
lo que administra (`administered-calendar`, con colisiones). Se sigue
el mismo patrón en vez de una pantalla condicional por `activeRole`.

## Nav y rutas

`routes/catalog.js` — dos entradas nuevas al final de `navigationRoutes`
(después de `trainingPlansRoute`):

```js
export const myCalendarRoute = {
  name: 'calendar',
  label: 'Mi calendario',
  href: '/calendar',
  icon: 'calendar-month-outline',
  role: 'runner',
};

export const administeredCalendarRoute = {
  name: 'administered-calendar',
  label: 'Calendario',
  href: '/administered-calendar',
  icon: 'calendar-month-outline',
  role: 'trainer',
};
```

Wiring de rutas Expo Router, mismo patrón que `app/(tabs)/notifications.jsx`:

- `app/(tabs)/calendar.jsx` → `<MyCalendarScreen />`
- `app/(tabs)/administered-calendar.jsx` → `<AdministeredCalendarScreen />`

## Capa de datos

**`services/calendar.js`** — 3 funciones nuevas, mismo patrón que las
existentes (`USE_MOCKS` branch + mock correspondiente):

```js
export async function getMemberCalendar(userId, from, to) {
  if (USE_MOCKS) return await mockGetMemberCalendar(userId, from, to);
  const params = new URLSearchParams({ from, to });
  return await api.get(`/users/${userId}/member-calendar?${params.toString()}`);
}

export async function getAdministeredCalendar(userId, from, to) {
  if (USE_MOCKS) return await mockGetAdministeredCalendar(userId, from, to);
  const params = new URLSearchParams({ from, to });
  return await api.get(`/users/${userId}/administered-calendar?${params.toString()}`);
}

export async function getCalendarSummary(userId) {
  if (USE_MOCKS) return await mockGetCalendarSummary(userId);
  return await api.get(`/users/${userId}/calendar-summary`);
}
```

**Mocks (`services/__mocks__/calendar-mock.js`)** — derivan de
`mockCalendarDays` (el mismo store en memoria ya usado por
`mockGetGroupCalendar`), filtrando por membresía/administración. El
mock no modela equipos reales — para `member-calendar`/
`administered-calendar`/`calendar-summary` alcanza con una lista
hardcodeada de grupos por usuario de prueba (mismo criterio que el
resto del archivo, que ya asume `owner_id: 1`/`owner_id: 99` fijos en
los datos semilla de `teams-mock.js`). `presencial_collision` en el
mock de `administered-calendar` queda siempre ausente — igual que
`same_team_warnings` en los mocks de escritura, no vale la pena
replicar el algoritmo de colisión en un mock local.

**`services/normalizers.js`** — un normalizer nuevo, no reemplaza a
`toGroupCalendarDayModel` (que sigue siendo el de un grupo puntual):

```js
export function toAggregatedCalendarDayModel(dto) {
  const base = toGroupCalendarDayModel(dto);
  if (!base) return null;
  return {
    ...base,
    groupName: dto.group_name,
    teamId: String(dto.team_id),
    teamName: dto.team_name,
    presencialCollision: dto.presencial_collision
      ? { type: dto.presencial_collision.type, conflicts: dto.presencial_collision.conflicts }
      : null,
  };
}
```

**`hooks/use-aggregated-calendar.js`** (nuevo) — solo lectura, sin
mutaciones (cualquier escritura sigue pasando por
`group-calendar-day-screen.jsx`, alcanzable desde el detalle del
entrenador vía "Ir a este grupo"):

```js
export function useMemberCalendar(userId, from, to) {
  const query = useQuery({
    queryKey: ['member-calendar', userId, from, to],
    queryFn: () => getMemberCalendar(userId, from, to).then((dtos) => dtos.map(toAggregatedCalendarDayModel)),
    enabled: Boolean(userId && from && to),
  });
  return { days: query.data ?? [], loading: query.isLoading, isFetching: query.isFetching };
}

export function useAdministeredCalendar(userId, from, to) {
  // misma forma que useMemberCalendar, query key ['administered-calendar', ...]
}

export function useCalendarSummary(userId) {
  const query = useQuery({
    queryKey: ['calendar-summary', userId],
    queryFn: () => getCalendarSummary(userId),
    enabled: Boolean(userId),
  });
  return { groups: (query.data ?? []).map((g) => ({ id: String(g.group_id), name: g.group_name })), loading: query.isLoading };
}
```

## Componentes compartidos (`components/calendar/`, carpeta nueva)

**`utils/calendar-kind-colors.js`** (nuevo) — extrae `KIND_DOT_COLORS`
de `group-calendar-screen.jsx` a un lugar compartido:

```js
export const KIND_DOT_COLORS = { rest: '#94a3b8', other: '#f59e0b', training: '#22c55e', cancelled: '#ef4444' };
```

`group-calendar-screen.jsx` pasa a importarlo en vez de declararlo
localmente (único cambio a ese archivo fuera del guard de la sección
siguiente).

**`aggregated-month-view.jsx`** — `<Calendar>` de `react-native-calendars`
con `dayComponent` custom, mismo esqueleto que `CalendarDayCell` de
`group-calendar-screen.jsx` pero para una LISTA de asignaciones por
fecha en vez de una sola:

- Recibe `daysByDate: Record<string, AggregatedCalendarDayModel[]>` (ya
  agrupado por el screen padre), `onDayPress(dateString)`,
  `showCollisions: boolean`.
- Celda: un dot por asignación de esa fecha, hasta 4 — a partir de la
  5ª, el 4º dot se reemplaza por un texto chico `+N` (`N` = asignaciones
  restantes) en vez de seguir agregando dots, mismo criterio de no
  romper el layout fijo de la celda (`h-14`) que ya aplica al resto del
  calendario. Badge de día cerrado (`isCalendarDayClosed`, evaluado
  contra la asignación más relevante — la primera presencial si hay
  alguna, si no la primera del array) reusado tal cual.
- Si `showCollisions` y alguna asignación de esa fecha trae
  `presencialCollision`, badge de alerta adicional — ícono
  `alert-decagram` color ámbar (`same_team`) o rojo (`cross_team`,
  gana si hay de ambos tipos en el día).
- Mismo `key={colorScheme}` en el `<Calendar>` padre (bug de header ya
  resuelto esta sesión, aplica igual acá).

**`day-detail-modal.jsx`** — modal con la lista de asignaciones de la
fecha tocada, prop `variant: 'member' | 'administered'`:

- Cada asignación: `group_name`/`team_name`, `kind`, resumen de sesión
  (`session_instance.name`, ejercicios si aplica), horario+ubicación si
  `is_presencial`.
- `variant="administered"` suma, por asignación: botón "Ir a este
  grupo" (`router.push(/teams/${teamId}/groups/${groupId}/calendar/${date})`,
  reusa `group-calendar-day-screen.jsx` existente sin duplicar lógica
  de escritura) y, si trae `presencialCollision`, el detalle de con
  qué otro grupo/equipo colisiona.
- `variant="member"` es puramente informativo — sin botón de
  navegación (decisión explícita: el acceso directo no tiene sentido
  para el corredor en esta pieza; a futuro habrá un link a "ir al
  entrenamiento" compartido por ambos roles, fuera de alcance acá).
- Backdrop cierra al tocar afuera (regla general de modales, ver
  CLAUDE.md sección "Modales").

## Pantallas de rol

**`my-calendar-screen.jsx`** (corredor):

- Estado de mes visible (mismo patrón `visibleYear`/`visibleMonth` que
  `group-calendar-screen.jsx`).
- `useCalendarSummary(userId)` puebla chips de filtro: "Todos" (default)
  + uno por grupo del que es miembro. Selección de un chip filtra
  client-side los días mostrados por `groupId` — sin re-fetch, el mes ya
  trae todo.
- `useMemberCalendar(userId, from, to)` para los datos del mes.
- Agrupa por fecha (`daysByDate`), pasa a `AggregatedMonthView` con
  `showCollisions={false}`.
- Al tocar un día, `DayDetailModal variant="member"` con las
  asignaciones de esa fecha (ya filtradas por el chip activo, si hay
  uno).

**`administered-calendar-screen.jsx`** (entrenador):

- Mismo esqueleto, sin chips de filtro (alcance no pedido para esta
  pantalla).
- `useAdministeredCalendar(userId, from, to)`, `showCollisions={true}`.
- `DayDetailModal variant="administered"`.

Ambas pantallas responsive-first (regla obligatoria de CLAUDE.md) —
mismo criterio que `group-calendar-screen.jsx` (`max-w-3xl` centrado en
web ancho, ancho completo en mobile/narrow), sin variante angosta
dedicada porque el contenido (calendario + modal) ya es fluido.

## Guard de permiso en `group-calendar-screen.jsx`

Hallazgo durante el diseño: esta pantalla (menú de día, estampar,
desplazar, etc.) no tiene ningún chequeo de permiso hoy más allá de
`RequireAuth` — cualquier usuario autenticado que llegue por URL puede
editar el calendario de cualquier grupo. Hoy nadie lo nota porque el
único botón que lleva ahí (`team-detail-screen.jsx`, `GroupRow`) está
detrás de `canManageTeam`. El detalle de día del entrenador (pieza 2,
"Ir a este grupo") es una nueva forma legítima de llegar ahí — momento
de cerrar el hueco en vez de heredarlo.

Fix: agregar `canManage` a `GroupCalendarScreenContent`, mismo criterio
que `canManageTeam` en `team-detail-screen.jsx` (`hasTrainerRole &&
activeRole === 'trainer'` — se replica el criterio ya usado en el resto
de la app para "puede administrar equipos", no uno más estricto nuevo).
Si `canManage` es `false`: `handlePress` de `CalendarDayCell` no abre
`CalendarDayMenu` (la celda queda de solo lectura, sin popup); el resto
de la pantalla (mes, tinte de días, badges) se sigue mostrando igual.

No se scopea a "administra ESTE grupo en particular" (requeriría
resolver `team.ownerId` contra el grupo puntual, dato no disponible hoy
sin una consulta extra) — se replica el criterio ya existente a nivel
de toda la app, consistente con lo que ya decide si el botón de acceso
se muestra en `team-detail-screen.jsx`.

## Testing

Convención del repo: sin tests de render de componentes. Lógica pura
nueva a cubrir con Jest:

- `toAggregatedCalendarDayModel` (`__tests__/normalizers.test.js`):
  mapea `group_name`/`team_id`/`team_name`/`presencial_collision`
  correctamente, `presencialCollision: null` cuando el campo viene
  ausente.
- Mocks nuevos (`mockGetMemberCalendar`/`mockGetAdministeredCalendar`/
  `mockGetCalendarSummary`, `__tests__/calendar-mock.test.js`): filtran
  por el usuario/grupo correcto, shape de respuesta correcto.

Verificación manual (preview o device, no verificación automática de
componentes): navegar a "Mi calendario"/"Calendario" con cada rol,
confirmar días con múltiples asignaciones muestran varios dots, el
modal de detalle lista todas, el filtro por grupo del corredor
funciona, el badge de colisión aparece solo para el entrenador y solo
en días marcados, "Ir a este grupo" navega correctamente, y que sin
`canManage` la pantalla de grupo puntual no abre el menú de día.
