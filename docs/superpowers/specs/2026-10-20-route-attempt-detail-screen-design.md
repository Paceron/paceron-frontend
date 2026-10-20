# Pantalla de detalle de intento (competencias por trayectoria)

> Sub-proyecto B de la descomposición post-Play para competencias de ruta (ver
> `docs/superpowers/specs/2026-10-19-route-attempt-live-screen-design.md`, la pantalla en vivo ya
> construida). Generaliza `route-attempt-result-screen.jsx` (hoy solo "resultado inmediato
> post-intento") en una pantalla de detalle reusable, multiplataforma, reachable por fuera del
> flujo "recién terminado". Sub-proyectos relacionados, explícitamente fuera de este documento:
> intentos configurables 1..N + mejor resultado (depende de backend, "sin reintentos v1" hoy —
> esta pantalla ya busca por `competitionId`+`athleteUserId`, no asume "el único intento", así que
> cuando ese trabajo llegue el cambio de este lado es chico, no una reescritura).

## Motivación

Hoy `route-attempt-result-screen.jsx` solo sabe mostrar el intento que ACABA de terminar —
`MobileOnlyRoute`, params de navegación que solo `route-attempt-live-screen.jsx` manda, lee el
trazado GPS de SQLite local sin fallback remoto. No hay forma de ver un intento viejo (propio o de
otro participante) desde la web, ni desde otro dispositivo, ni una vez que SQLite local ya se
limpió post-sync. Tampoco está dentro del shell de la app (`AppWebShell`/`AppMobileShell`) — es una
pantalla suelta, sin header/nav, pensada solo para el instante posterior al intento.

El ranking de la competencia (`competition-ranking-modal.jsx`) ya muestra el tiempo de **todos**
los participantes — de ahí que el criterio de visibilidad de este detalle sea el mismo: cualquiera
que vea la competencia puede abrir el detalle de cualquier participante, igual que ya puede ver su
tiempo en el ranking.

## Gap de backend que esto depende de

**Gap 35 (`docs/BACKEND_API_GAPS.md`) — resuelto del lado backend, no mergeado a `develop`
todavía.** `GET /teams/{id}/competitions` y `GET /competitions/{id}` van a devolver
`session_instance_id` (la instancia sintética de la competencia, `null` para `type='metric'`). Sin
este campo no hay forma de pedir el detalle de un intento viejo por API — el trabajo de este
documento asume que ya está mergeado antes de implementar la rama remota (ver Riesgos).

## Decisiones ya cerradas en esta conversación

- **Visibilidad: cualquier participante, mismo criterio que el ranking.** No hay restricción
  "solo mis propios intentos".
- **Multi-intento NO entra en este sub-proyecto.** Backend sigue en "sin reintentos v1". La
  pantalla se diseña genérica (busca por identidad, no por "el intento más reciente") para no
  necesitar reescritura cuando llegue, pero no se construye nada de UI de lista-de-intentos ahora.
- **La pantalla va DENTRO del shell, multiplataforma.** Confirmado contra el código: mover el
  archivo de ruta a `app/(tabs)/` alcanza — `TabsLayout` (`app/(tabs)/_layout.jsx`) ya envuelve
  cualquier ruta ahí adentro con `AppWebShell`/`AppWebShellNarrow`/`AppMobileShell` según
  plataforma/ancho, sin que la pantalla tenga que importar nada de shell ella misma (mismo patrón
  ya usado por `app/(tabs)/training-session-review.jsx`, una sola línea delegando al componente).
- **Banner condicional según el origen de la navegación:** si llega `setId` (nativo, intento recién
  terminado/no sincronizado todavía) se muestra un banner de bienvenida/felicitación arriba de
  todo. Si no llega `setId` (abierto desde el ranking, cualquier plataforma) el título es el
  normal de una pantalla de detalle — sin "recién completaste".
- **Corrección a la propuesta anterior, encontrada escribiendo el plan:** `progress.value` es
  **siempre `null` para `type='route'` en v1** (confirmado en el mock,
  `services/__mocks__/competitions-mock.js#computeProgressValue`, y en que
  `competitions-tab.jsx#ParticipantPill` ya solo pinta la medalla del ganador para ruta, nunca un
  valor por corredor — `progressLabel: null` a propósito). El `'—'` de
  `competition-ranking-modal.jsx` para ruta **no es un bug** — no hay tiempo-por-corredor que
  mostrar ahí sin N llamadas extra (`getSessionFeedback` por participante), fuera de alcance de
  este sub-proyecto. **Lo único que cambia en esa modal:** las filas pasan a `Pressable`,
  navegando al detalle (que SÍ pide el tiempo real de ESE corredor puntual, vía
  `getSessionFeedback`). Sin cambio de sort ni de la columna de valor.

## Arquitectura

### Archivos

- **Rename:** `components/session-runtime/route-attempt-result-screen.jsx` →
  `components/session-runtime/route-attempt-detail-screen.jsx` (export `RouteAttemptResultScreen`
  → `RouteAttemptDetailScreen`).
- **Move + rename de ruta:** `app/route-attempt-result.jsx` → `app/(tabs)/route-attempt-detail.jsx`
  (URL pasa de `/route-attempt-result` a `/route-attempt-detail` — actualizar el único caller,
  `route-attempt-live-screen.jsx#goToResult`, y el nuevo caller de la modal de ranking).
- **Nuevo:** `hooks/use-attempt-detail.js` — el hook dual-fuente (ver abajo).
- **Modificado:** `components/team/competition-ranking-modal.jsx` (fix de valor/orden para ruta +
  filas tocables), `services/normalizers.js#toCompetitionModel` (suma `sessionInstanceId`).

### `useAttemptDetail({ competitionId, athleteUserId, setId })`

Devuelve `{ loading, status, distanceMeters, durationMs, startedAt, teamId, traveledPoints,
referenceRoute, expectedMeters, feedbackId }` — el mismo shape sin importar la rama. `status` es
uno de `'local'` (recién terminado, SQLite), `'synced'` (remoto, con stats), `'pending'` (remoto,
`runner_session` existe pero sin feedback todavía — el otro corredor sigue corriendo o no
sincronizó), `'not_found'` (sin `runner_session` para ese atleta en esa competencia).

**Rama local (`setId` presente, nativo únicamente):**
1. `getGpsPoints(setId)` (`services/session-db.js`, ya existe) → `traveledPoints`.
2. `distanceMeters`/`durationMs` vienen de los params de navegación (ya existe hoy,
   `route-attempt-live-screen.jsx#goToResult` los manda).
3. `status: 'local'`.
4. En paralelo, sigue el poll de `getCompetition(competitionId)` que ya existe hoy (para
   match%/ranking vía WS `update:competition_progress`) — sin cambios.

**Rama remota (`setId` ausente, cualquier plataforma):**
1. `useCompetitionDetail(competitionId)` (hook ya existente) → `competition.sessionInstanceId`
   (Gap 35) + `competition.route` (→ `referenceRoute`) + `totalRouteMeters(...)` (ya existe,
   `utils/route-geometry.js`) → `expectedMeters`.
2. Si `sessionInstanceId` es `null` (no debería pasar para `type='route'` una vez mergeado el
   gap) → `status: 'not_found'`.
3. `getRunnerSession(sessionInstanceId, athleteUserId)` (`services/runnerSession.js`, ya existe).
   404 → `status: 'not_found'`. `wip` → seguir al paso 4 igual (puede tener feedback parcial si
   sincronizó a medias, aunque en la práctica un intento de ruta es un solo set).
4. `getSessionFeedback(sessionInstanceId, athleteUserId)` (ya existe). Vacío → `status: 'pending'`.
   Con una fila → `distanceMeters`/`durationMs`/`startedAt` (`startedAt ?? createdAt`)/`teamId`
   (todos ya vienen en el DTO, `toSessionFeedbackModel`) + `feedbackId`.
5. Si `feedback.pointsCount > 0` → `getWorkoutFeedbackPoints(feedbackId)` (ya existe) →
   `traveledPoints`. Si es 0 (ej. se corrió en un dispositivo que no llegó a sincronizar puntos,
   caso raro) → `traveledPoints: []`, la pantalla muestra solo la ruta esperada.
6. `status: 'synced'`.

Las llamadas de la rama remota van con `useQuery` (TanStack Query, convención del repo) — no hace
falta orquestar manualmente, cada paso depende del anterior vía `enabled`.

### Pantalla (`RouteAttemptDetailScreen`)

- Sin `MobileOnlyRoute`, sin `SafeAreaView` propio — root `View`/`ScrollView` con
  `className="flex-1 w-full self-center ${isWeb ? 'max-w-3xl' : ''}"`, mismo patrón que
  `session-review-screen.jsx` (el shell de `(tabs)` ya pone el safe-area/nav).
- **Banner o título** (según `setId`, ver Decisiones): banner verde-ish de bienvenida arriba de
  todo si viene de recién terminar; si no, el título normal "Detalle de intento".
- **Mapa** (`LiveTrajectoryMap`, sin cambios en el componente): ocupa el espacio que antes quedaba
  vacío abajo — contenedor `flex-1` en vez de `h-80` fijo.
- **Stats**, agregando a lo que ya existe (distancia/tiempo logrados):
  - Fecha (`startedAt`, formateada con un helper local chico `DD/MM/AAAA HH:mm`, mismo patrón
    sin exportar que `formatDayTime` en `session-review-screen.jsx:43` — no hay un formatter
    exportado para timestamp completo, solo para fecha sola `YYYY-MM-DD`).
  - Equipo: `useTeam(teamId)` (hook ya existente) → nombre.
  - Distancia esperada (`expectedMeters`, de la ruta) junto a la logrados, para comparar.
  - Estado `'pending'`: mensaje en vez de spinner infinito — "Este intento todavía no terminó o no
    se sincronizó".
  - Estado `'not_found'`: mensaje — "Este participante no tiene un intento registrado en esta
    competencia".
- **Botón "Listo"** solo tiene sentido en el caso banner (recién terminado) — en el caso detalle
  normal (abierto desde ranking) el cierre es el back/nav normal del shell, no un botón propio.

### `competition-ranking-modal.jsx`

- Sin cambios en el cálculo de `direction`/`formatMetricValue` — `progress.value` sigue `null`
  para ruta, la columna de valor sigue mostrando `'—'` (correcto, no hay dato que mostrar ahí).
- Único cambio: cada fila pasa a `Pressable`, `onPress` navega a `/route-attempt-detail` con
  `{ competitionId: competition.id, athleteUserId: entry.userId }` — sin `setId`, rama remota
  siempre desde esta entrada. El tiempo real de ese corredor se ve recién en el detalle (vía
  `getSessionFeedback`, que sí lo tiene).

## Testing

- Sin lógica pura nueva en `competition-ranking-modal.jsx` (el único cambio es agregar
  `Pressable`+navegación) — nada que amerite test unitario ahí.
  vs `metric='pace'`.
- Sin test de render de pantallas (convención del repo).
- Verificación real: web (preview) para la rama remota completa; dispositivo solo para confirmar
  que la rama local (banner post-intento) sigue funcionando igual que hoy.

## Identificadores

`nativeID`/`testID` kebab-case en todo lo nuevo/modificado (regla obligatoria). Los ids existentes
de `route-attempt-result-screen-*` pasan a `route-attempt-detail-screen-*` en el rename.

## Riesgos / decisiones abiertas

- **Depende de que Gap 35 se mergee a `develop` antes de poder probar la rama remota contra el
  backend real.** Contra mocks (`USE_MOCKS=true`) no hace falta agregar nada nuevo — el mock YA
  trackea el id sintético internamente, solo con el nombre de campo viejo
  (`synthetic_session_instance_id` en vez de `session_instance_id`, de antes de que se confirmara
  el contrato real) — se renombra en el mock para que coincida, y ya se puede probar toda la rama
  remota sin el backend real. Bloquea solo la verificación end-to-end contra el backend real hasta
  el merge.
- **`traveledPoints: []` cuando `pointsCount === 0`** — caso no verificado en la práctica (requiere
  un intento real sincronizado sin puntos, poco probable dado que el flujo de hoy siempre graba
  puntos si hubo GPS). Degradación aceptable: mapa muestra solo la ruta esperada.
