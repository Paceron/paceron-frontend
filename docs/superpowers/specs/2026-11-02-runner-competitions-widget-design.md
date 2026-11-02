# Widget de competencias en el home del corredor

**Rama:** `feature/runner-competitions-widget`

## Contexto

Pedido con 3 partes, bundleadas en la misma rama a pedido del usuario:

1. **Componente nuevo** en el home del corredor: hasta 3 competencias activas en las
   que participa (cualquier equipo), con una pestaña nueva en el hub de gamificación
   para ver todas.
2. **Fix de bug real, confirmado**: el calendario (`react-native-calendars`) marca la
   celda equivocada como "hoy" durante las últimas ~3 horas del día (GMT-3).
3. **Documentación de un gap de backend** (política de asignación same-day) — decidido
   previamente con el usuario, sin trabajo de frontend hasta que el backend lo
   implemente.

## Alcance

Frontend: home del corredor, hub de gamificación, 2 archivos de calendario. Backend:
solo una entrada nueva en `docs/BACKEND_API_GAPS.md`, sin tocar el otro repo.

**Fuera de alcance:** cualquier endpoint cross-team nuevo (confirmado innecesario, ver
abajo), sub-filtros por estado dentro de la pestaña nueva, badge/punto rojo propio para
esa pestaña (el hub hoy no le pone punto individual a ninguna de sus 3 pestañas
existentes — no se introduce el patrón solo para esta).

## A. Widget en el home — `CompetitionsPreviewCard`

**Archivo nuevo:** `components/home/competitions-preview-card.jsx`.

**Dato — sin endpoint nuevo.** Mismo patrón de fan-out que ya usa el punto rojo
global de Gap 34 (`docs/BACKEND_API_GAPS.md`, confirmado: "el frontend hace el OR...
sobre la lista de equipos que el usuario ya tiene cargada"):

1. `useMyMemberTeams(userId)` (`hooks/use-teams.js`) → lista de equipos donde el
   usuario es corredor.
2. N queries en paralelo con `useQueries` (TanStack Query), mismo mecanismo exacto que
   ya usa `hooks/use-team-fees.js` para N equipos (`teamQueryOptions` + `useQueries`) —
   no un loop de hooks custom (rompería las Rules of Hooks si la cantidad de equipos
   cambia entre renders). Requiere extraer `competitionsQueryOptions(teamId, { status,
   groupId })` de `hooks/use-competitions.js` (hoy la lógica de `queryKey`/`queryFn`
   vive inline dentro de `useCompetitions`; se factoriza a una función exportada,
   mismo refactor sin cambio de comportamiento que ya tiene `teamQueryOptions` en
   `use-teams.js`) — `useCompetitions` pasa a consumir esa función internamente, cero
   cambio para sus call sites actuales. El widget/pestaña nueva llama
   `useQueries({ queries: teamIds.map((id) => competitionsQueryOptions(id, { status:
   'active' })) })`.
3. De cada resultado, filtrar `competition.participantUserIds.includes(String(userId))`
   — campo real, ya normalizado (`services/normalizers.js#toCompetitionModel`), no hace
   falta nada del backend para esto.
4. Juntar todas, ordenar:
   - `type === 'metric'` primero, por `endAt` ascendente (las que antes vencen,
     primero).
   - `type === 'route'` al final (no tienen `endAt`), ordenadas por `startAt`
     descendente (más recientemente creadas primero).
5. Cortar en los primeros 3. Si el resultado final es `[]`, el componente no renderiza
   nada (`return null`) — sin estado vacío en el home, mismo criterio que sus hermanos
   (`StreakBanner`, `AchievementHighlightCard`).

**Contenido de cada box** (sin pedir detalle de la competencia — todo sale del modelo
ya liviano del listado):
- Nombre: `buildCompetitionTitle(competition)` (`utils/competition-title.js`).
- Nombre del equipo dueño (ya resuelto al armar la lista, uno por equipo iterado).
- Ícono por `type`: `flag-checkered` (route) / `trophy-variant` (metric) — mismos
  íconos que ya usa `competitions-tab.jsx` para no inventar un segundo set.
- Texto de estado, calculado localmente (sin pedir nada nuevo):
  - `metric` con `endAt` en el futuro: "Cierra en N días" (días enteros redondeados
    hacia arriba, `Math.ceil`).
  - `route`: "Abierta" (fijo, no tiene fecha de cierre).
- CTA "Ver" → `router.push(\`/teams/${competition.teamId}?tab=competencias\`)` — mismo
  deep-link que ya usa `notifications-screen.jsx:209`, `team-detail-screen.jsx` ya lee
  `params.tab` al montar.

**Responsive — regla estricta del repo, no un caso web/mobile fijo:**
- `isWeb && !useIsNarrowWeb()`: `flex-row gap-3`, los 3 boxes en la misma fila,
  `flex-1` cada uno.
- Cualquier otro caso (web angosto O nativo): `gap-3` en columna, 3 cards apiladas.

**Dónde se monta:** `components/home/authenticated-home-screen.jsx`, dentro del bloque
`{activeRole === 'runner' && (...)}`, como último hijo (después de `<RunnerKpisCard />`)
— "debajo de todo lo que hay hoy", pedido textual.

## B. Pestaña nueva "Competencias" en el hub de gamificación

**`components/achievements/achievements-screen.jsx`:** `TABS` pasa a:

```js
const TABS = [
  { id: 'streaks', label: 'Rachas', icon: 'fire' },
  { id: 'achievements', label: 'Logros', icon: 'medal-outline' },
  { id: 'competitions', label: 'Competencias', icon: 'sword-cross' },
  { id: 'trophies', label: 'Vitrina', icon: 'trophy' },
];
```

(ícono `sword-cross`, el mismo que ya usa `competitions-tab.jsx` para la pestaña de
equipo — consistencia entre las dos vistas de "competencias" de la app). Render:
`{activeTab === 'competitions' && <MyCompetitionsTab />}`, insertado entre `achievements`
y `trophies` en el bloque de renders condicionales.

El `useEffect` de ack (líneas 45-52 del archivo, el que llama `ackSection`) ya resuelve
`section` con un ternario `activeTab === 'streaks' ? 'streaks' : 'achievements'` —
pasa a:

```js
const section = activeTab === 'streaks' ? 'streaks' : activeTab === 'competitions' ? 'competitions' : 'achievements';
```

(`ackSection('competitions')` sin `teamId` — `hooks/use-gamification-badge.js` ya
acepta `teamId` opcional).

**Archivo nuevo:** `components/achievements/my-competitions-tab.jsx`. Solo lectura,
cross-team, SIN recorte a 3 y SIN filtrar por `status` (a diferencia del widget del
home — acá "todas", cualquier estado, pedido textual). Mismo fan-out de la sección A
(`useMyMemberTeams` + `useCompetitions` por equipo), sin el filtro `status: 'active'`
en la query (se pide sin el param, el hook ya soporta `status` opcional). Filtro por
`participantUserIds` igual que A.

Orden: activas primero, luego `pending_approval`, luego `finished`/`rejected` al final;
dentro de cada grupo, igual criterio de fecha que la sección A.

Fila por competencia (sin botones de acción — a diferencia de `CompetitionRow` de
`competitions-tab.jsx`, que sí tiene correr/aprobar/cerrar): nombre
(`buildCompetitionTitle`), nombre del equipo, badge de estado (reusar
`compliance-badge.jsx` o el mismo patrón de tono fijo por color ya establecido:
`active` → verde, `pending_approval` → ámbar, `finished`/`rejected` → gris), botón
"Ver en el equipo" → mismo deep-link de la sección A. Si la lista completa (todos los
equipos, cualquier estado) es `[]`: mensaje de estado vacío ("Todavía no participás de
ninguna competencia.") — a diferencia del widget del home, esta pantalla SÍ necesita
mensaje vacío porque es su único contenido (no es un extra debajo de otras cards).

## C. Fix — celda "hoy" del calendario se corre un día en las últimas horas

**Root cause confirmado** (no es hipótesis): `react-native-calendars` arma la celda de
cada día parseando `date.dateString` ('YYYY-MM-DD') con el constructor `new Date(string)`
de JS, que interpreta un string fecha-sola como **medianoche UTC**. Con GMT-3
(Argentina), esa celda vale, en hora LOCAL, las 21:00 del día anterior. La librería
decide `state === 'today'` comparando esa celda contra `XDate.today()` (que sí es local)
usando getters locales (`getFullYear/getMonth/getDate`) — así que la celda rotulada
"mañana" es la que localmente cae en el mismo año/mes/día que "hoy" durante las últimas
~3 horas de hoy (el tamaño exacto del offset GMT-3). Confirmado leyendo
`node_modules/react-native-calendars/src/dateutils.js` (`isToday`/`sameDate`) — no es
un bug nuestro de lógica, es una interacción conocida de parsing-UTC-vs-getters-locales,
pero el fix es nuestro (no se parchea la librería).

**Afecta exactamente 2 archivos** (grep confirmado, son los únicos 2 que usan
`dayComponent` de esta librería):
- `components/calendar/aggregated-month-view.jsx` (usado por `my-calendar-screen.jsx` y
  `administered-calendar-screen.jsx`).
- `components/team/group-calendar-screen.jsx`.

**Fix, idéntico en los 2 archivos:** dejar de confiar en el `state` que entrega la
librería para decidir `'today'` (seguir usándolo tal cual para `'disabled'`, que
depende del mes visible, no de la hora — sin ese bug). Calcular `isToday` con el mismo
criterio ya correcto de `utils/session-start-window.js` (constructor `new Date(y, m, d)`
+ getters locales, nunca `toISOString()`), comparado contra `date.dateString` (el
string 'YYYY-MM-DD' que la librería entrega sin tocar, ese sí es confiable como
etiqueta):

```js
function computeTodayIso(now = new Date()) {
  return `${now.getFullYear()}-${pad2(now.getMonth() + 1)}-${pad2(now.getDate())}`;
}
```

(`pad2` ya existe e importado en `group-calendar-screen.jsx` desde
`utils/calendar-month-range.js`; `aggregated-month-view.jsx` necesita importarlo
también). `CalendarDayCell` pasa a recibir `isToday` (booleano ya resuelto por el padre,
comparando `date.dateString === todayIso`) en vez de inferirlo de `state === 'today'`
— `todayIso` se calcula una sola vez por render de la pantalla (no por celda), con
`useMemo` o directo en el cuerpo del componente (se recalcula solo en cada render de
la pantalla completa, que ya ocurre por otros motivos — no hace falta un timer).

## D. Gap de backend — política de asignación same-day

Solo documentación, nueva sección en `docs/BACKEND_API_GAPS.md` (numerada como el
próximo Gap libre del archivo). Contenido:

- **Estado actual, confirmado** (`calendar_service.go#isCalendarDayClosed`, otro repo):
  una sesión asíncrona del día de HOY está cerrada para asignar, exactamente igual que
  un día ya pasado. Una sesión presencial de hoy sigue abierta hasta que pasa su
  horario planificado (sin cambios pedidos ahí).
- **Pedido:** que async-hoy sea asignable, a discreción del entrenador — sin un
  bloqueo duro nuestro. "Muy tarde en el día" (ej. faltan 10 minutos) no lo decide una
  regla del sistema, lo decide el entrenador al elegir asignarla o no.
- **Alcance:** cambio de backend únicamente (el gate vive en `calendar_service.go`).
  Confirmado que el frontend no necesita ningún cambio de código una vez que el
  backend lo habilite — la pantalla de asignación ya intenta la request tal cual, el
  bloqueo hoy es 100% del lado backend.
- Sin trabajo de frontend en esta rama más allá de esta entrada de documentación.

## Testing

- **C (fix de calendario):** testeable con Jest puro — `computeTodayIso` y la
  comparación de `isToday` no dependen de React Native ni de la librería de
  calendario, se extraen a una función pura en `utils/calendar-today.js` (nuevo,
  mismo criterio que `session-start-window.js`: lógica de fecha aislada y
  testeada, el componente solo la consume). Test con horas inyectadas (tarde en el
  día, antes de medianoche, día normal) confirmando que la celda correcta es
  "hoy" sin importar la hora del reloj.
- **A/B (widget + pestaña):** sin tests de render (convención del repo) — verificación
  manual en preview, con mocks ajustados si hace falta un corredor con competencias en
  más de un equipo para probar el merge/orden de la sección A.
- `npm test`/`npm run lint` en verde en cada paso, como siempre.
