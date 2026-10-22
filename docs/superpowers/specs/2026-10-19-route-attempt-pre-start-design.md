# Pre-start dedicado para intentos de competencia por trayectoria

> Spec chica (CLAUDE.md: feature con flujo real + ~7 archivos, plan de implementación no
> necesario -- pasos mecánicos, sin secuencia frágil). Pertenece a la misma rama
> `feature/route-competitions-polish` (Spec 4c, `docs/superpowers/specs/2026-10-14-gamification-competitions-route-design.md`),
> no es una nueva feature de gamificación.

## Motivación

La Spec 4c decidió explícitamente no tocar `session-pre-start-screen.jsx` para los intentos de
ruta ("ya degrada bien sin `groupName`/`isPresencial`"). Probado en dispositivo real
(2026-10-19), el resultado funciona pero no sirve para lo que un intento de ruta necesita:
confirmar que el corredor está parado en el punto de inicio antes de arrancar, y ver la
trayectoria real en vez de una lista de "ejercicios" con una sola fila ("Corrida") sin
información útil.

## Alcance

Solo el pre-start. Nada de esto toca la pantalla en vivo (`training-session-active-screen.jsx`,
`LiveTrajectoryMap`) ni el resultado (`route-attempt-result-screen.jsx`, ya construido) -- ambos
quedan para una ronda de pruebas posterior, ya mencionada explícitamente por el usuario como
trabajo aparte.

`session-pre-start-screen.jsx` **sigue sin tocarse** -- entrenamientos normales y competencias
`type='metric'` (que no generan `routeAttempt`) siguen por ese camino, sin cambios.

## Entry point

`components/team/competitions-tab.jsx#handleRun`: al crear el intento con éxito, en vez de
`setPendingSession(...) + router.push('/training-session')`, navega a una ruta nueva
`/route-attempt-pre-start`. El `pendingSession` que guarda en el store suma un campo que hoy no
tiene: `teamName` (lo necesita el header de la pantalla nueva). `CompetitionsTab` no recibe
`teamName` como prop hoy -- se agrega, pasado desde `team-detail-screen.jsx` (`team.name`, ya
disponible ahí vía `useTeam(teamId)`).

## Pantalla nueva

`components/session-runtime/route-attempt-pre-start-screen.jsx` (ruta `app/route-attempt-pre-start.jsx`),
mobile-only (mismo criterio que el resto de "correr una trayectoria", Spec 4c -- en web el botón
de competitions-tab ya es un aviso, nunca llega a navegar acá).

**Header:** botón atrás + botón de ranking (ícono `podium`, mismo que `competitions-tab.jsx`) que
abre `CompetitionRankingModal` -- sin componente nuevo, se reusa tal cual. Trae la `competition`
completa vía `useCompetitionDetail(pendingSession.routeAttempt.competitionId)` (superset de
`toCompetitionModel` + `progress`, confirmado en `services/normalizers.js` -- sirve directo como
prop `competition` del modal) y los `members` vía `useTeamRoster(pendingSession.teamId)` (mismo
shape `{userId, name}` que ya consume el modal).

**Título:** fecha (hoy, `pendingSession.date`) + nombre del equipo con ícono `shield-account-outline`
(mismo patrón visual que `session-pre-start-screen.jsx`, sin grupo -- un intento de ruta nunca
tiene `groupName`). Sin lista de ejercicios.

**Mapa:** ocupa el área grande restante (`flex-1`, reemplaza el `ScrollView` de ejercicios de la
pantalla genérica). `RouteMapPreview` (`components/team/route-map-preview.jsx`) suma un prop nuevo
`interactive` (default `false` -- los callers existentes, `competitions-tab.jsx`, no cambian de
comportamiento):
- `dragPan`/`touchZoom`/`touchRotate`/`doubleTapZoom` pasan a `true` (hoy hardcodeados `false`).
- La `Camera` suma `maxBounds` (bbox de la ruta, `utils/map-bounds.js#computeBounds`, expandido un
  50% de su propio ancho/alto por lado, con un piso mínimo para rutas muy cortas) + `minZoomLevel`/
  `maxZoomLevel` -- prop real de la librería (`CameraProps.maxBounds: LngLatBounds`, confirmado en
  `node_modules/@maplibre/maplibre-react-native/.../Camera.d.ts`), no hace falta matemática propia
  de clamping.
- El tooltip de cada marcador (ya arreglado en este mismo branch, ver `RouteMarker`) suma una
  segunda línea cuando `interactive` es `true`: dirección resuelta vía `useReverseGeocode` (suma
  un 3er parámetro `enabled`, default `true`, para que el único call site existente
  -- `competitions-tab.jsx`, no interactivo -- no cambie; acá se llama con `enabled: interactive`),
  tappable, abre Google Maps vía `openLocationInMaps` (igual patrón que
  `RouteDetailSection` en `competitions-tab.jsx`).

**Gate de GPS (lo más importante, pedido explícito del usuario -- tiene que ser en vivo, sin
refresh manual):**
- Al montar, pide permiso de ubicación (`Location.requestForegroundPermissionsAsync`) -- se
  extrae a un util nuevo compartido, `utils/session-gps-permission.js#requestSessionGpsPermission()`
  (hoy esa misma lógica, con su logging y su guard de error, vive inline y duplicada en potencia
  dentro de `session-pre-start-screen.jsx#handlePlay`; con este 2do caller real la duplicación deja
  de ser hipotética). `session-pre-start-screen.jsx` pasa a llamar el mismo util, sin cambio de
  comportamiento.
- Una vez concedido, usa `useGpsTracker(true)` (ya existe, construido para el tracking en vivo de
  la sesión -- `watchPositionAsync` con `Accuracy.High`/1s/1m, mismo hook, sin modificar) con
  `start({ onPoint })`: cada punto nuevo recalcula `haversineMeters(point, route.coordinates[0])`
  y lo guarda en estado de React -- **esto es lo que hace que el botón se habilite solo, sin
  refresh manual**: cada fix de GPS (aprox. 1/seg mientras el corredor se mueve) dispara un
  re-render con la distancia actualizada, re-evaluando la condición del botón en cada toma. `stop()`
  al desmontar.
- Play (`h-24 w-24`, mismo círculo que la pantalla genérica) deshabilitado mientras
  `distanceToStart == null || distanceToStart > acceptanceRadiusMeters`. Texto de ayuda debajo:
  "Buscando tu ubicación…" (sin fix todavía), "Activá la ubicación para poder arrancar" (permiso
  denegado), o "Estás a {formatMeters(distanceToStart)} del punto de inicio (necesitás estar a
  {acceptanceRadiusMeters} m o menos)" -- `utils/distance.js#formatMeters`, ya existe.
- Al tocar Play (ya habilitado, por definición de la condición de arriba): `setGpsEnabled(true)` +
  `router.push('/training-session-active')`. Sin el matching de competencias `metric`
  (`findActiveMetricCompetitionId`) que sí hace la pantalla genérica -- no aplica a un intento de
  ruta, y el `runner_session` real ya lo crea el backend al resolver
  `POST /competitions/{id}/attempts` (Spec 4c, ya documentado como redundante-pero-inofensivo si
  se duplicara).

## Testing

- `utils/session-gps-permission.js` y el cálculo de bbox expandido (si termina siendo más que una
  línea dentro del componente, se extrae a `utils/map-bounds.js` y se testea igual que
  `computeBounds`) -- lógica pura, testeable.
- Sin test de render de la pantalla nueva ni del mapa interactivo (convención del repo, gesto de
  mapa no simulable de forma confiable en Jest, mismo límite ya documentado para el resto del
  módulo).
- Verificación real: solo dispositivo (GPS real, mapa nativo) -- igual que el resto de esta rama.

## Identificadores

`nativeID`/`testID` kebab-case en todo lo nuevo (regla obligatoria).

## Riesgos / decisiones abiertas

- El factor de expansión del `maxBounds` (50%) y los límites de zoom son una elección de
  implementación, ajustable sin volver a esta spec si en la práctica se sienten muy ajustados o
  muy holgados en dispositivo real.
- `useGpsTracker`'s `getInitialPoint()` no se usa acá (da un punto único, no continuo) -- se
  prefirió `start()` directamente porque el gate necesita actualizarse solo con el tiempo, no una
  sola lectura al montar.
