# Gamificación — Spec 4c: Competencias por trayectoria (`type='route'`)

> Última spec del módulo de gamificación (`feature/gamification`). Cubre lo que quedó fuera de
> 4a/4b: `type='route'` completo — dibujo de la ruta en el mapa, intento en vivo con GPS real,
> resultado con % de coincidencia. Depende del contrato cerrado en `docs/BACKEND_API_GAPS.md`
> Gap 33, "Actualización 2026-10-14 (4)" y "(5)" (puntos 26-32) — instancia sintética por
> competencia + intake nuevo (`POST /competitions/{id}/attempts`), cierre manual sin `end_at`,
> sin reintentos v1, límites de ruta (500 vértices/100km), radio `[5,500]`m default 50, sin WS en
> vivo mid-intento. Backend construye esto en paralelo (change `competencias-ruta-intake`);
> frontend se construye contra mocks, sin bloquear.

## Alcance

**División web/mobile, a propósito (no es el resto del módulo, que es cross-platform):**
- **Crear** una competencia de ruta (dibujar en el mapa, radio de aceptación, participantes) no
  necesita GPS — anda en web y mobile, mismo criterio que el resto de Competencias.
- **Correr** un intento necesita GPS real → **mobile-only**, mismo patrón ya establecido para todo
  el registro de actividad en vivo (`StartSessionButton` en web muestra un aviso en vez de
  ocultar el botón — ver sección "Entry point" abajo).

Incluye: selector de tipo en la creación (`metric` ya existía, suma `route`), picker de dibujo de
ruta en el mapa (web + mobile, dos variantes de plataforma como `LocationPicker`), campo de radio
de aceptación, botón "Correr esta trayectoria" en la fila de competencia, pre-start de ruta,
extensión de la pantalla en vivo del corredor para modo ruta (mapa real con la trayectoria marcada
+ la recorrida en vivo), pantalla de resultado con % de coincidencia.

**Fuera de alcance, anotado para después:**
- **Trayectoria de la sesión completa** (cualquier entrenamiento asíncrono/presencial, no solo
  competencias de ruta) con tiempo/distancia/velocidad totales agregados — mencionado por el
  usuario como mejora futura ("doc fuente" línea 246). Alcance distinto: necesita coser puntos GPS
  de varias series, no existe ese agregado hoy ni para sesiones normales. El componente de mapa
  de esta spec (`LiveTrajectoryMap`, ver abajo) se diseña genérico a propósito para que esa mejora
  lo reuse en vez de reescribirlo — no se construye la generalización completa ahora.
- Leaderboard en vivo de otros participantes corriendo la misma ruta en simultáneo (Gap 33 punto
  32, backend ya descartó WS para esto en v1).
- Reintentos (Gap 33 punto 28, no existe en v1 — un intento por corredor por ruta).

## Backend (contrato cerrado, Gap 33 puntos 26-32)

- **Creación:** `POST /teams/{id}/competitions` con `type='route'` suma `route` (GeoJSON
  LineString, máx 500 vértices, máx 100km de largo total Haversine, `400` si excede) y
  `acceptance_radius_meters` (entero, rango `[5,500]`, `400` fuera de rango). Sin `metric`/`end_at`
  (la ruta no tiene ventana de cierre por fecha). Ruta **inmutable** una vez creada — para
  cambiarla, cancelar la propuesta (solo posible en `pending_approval`) y crear otra.
- **Intake del intento — pieza nueva:** al crearse la competencia, backend auto-crea **una sola**
  `session_instance` sintética compartida por todos los participantes (sin `group_id`/día de
  calendario, un ejercicio sintético "Corrida"). `POST /competitions/{id}/attempts` (nuevo) valida
  `active` + caller participante + sin intento previo, hace el `POST .../runner` internamente, y
  devuelve el `session_instance_id` sintético (y el resto de los datos de la instancia, para no
  necesitar un segundo `GET`). `400` con mensaje si ya tiene intento o la competencia no está
  `active`.
- **Cierre:** `PATCH /competitions/{id}/close` para ruta exige solo creador-entrenador/owner +
  `status='active'` (sin el chequeo de `end_at`, que no aplica).
- **WS:** se hereda `session:{instanceId}` (mismo canal de siempre) solo para lo que ya existe
  (mensajería si aplicara); sin evento de progreso en vivo cross-participante durante el intento.
  `update:competition_progress` llega recién AL TERMINAR un intento.
- **Progreso del detalle:** `GET /competitions/{id}` → `progress: [{user_id, value}]`, `value` es
  `null` para `route` por ahora (no se consume `progress` en esta spec — no hay vista de detalle
  construida todavía, queda para cuando haga falta).

## Entry point

- `components/team/competitions-tab.jsx` (`CompetitionRow`, Spec 4a): fila de una competencia
  `type='route'`, `status='active'`, el usuario es participante → botón **"Correr esta
  trayectoria"**. En web: mismo patrón que `StartSessionButton` — el botón se reemplaza por un
  aviso ("Correr una trayectoria solo está disponible en la app nativa"), no se oculta.
- **Sin chequeo previo de "¿ya tengo un intento?"** — no hay endpoint/campo barato para eso en
  v1 (el `progress` del detalle no lo distingue, y pedir el detalle solo para esto es una llamada
  de más sin necesidad clara todavía). El botón llama directo a `POST /competitions/{id}/attempts`
  al tocarlo; si el backend devuelve `400` (ya tiene intento), se muestra un toast de error y el
  botón queda deshabilitado localmente por el resto de esta sesión de la app (estado de
  componente, no persistido) — interinidad aceptada, igual criterio que el resto del módulo.
- Al confirmar, la respuesta (`session_instance_id` + datos de la instancia) se guarda en
  `useSessionRuntimeStore` como un `pendingSession` sintético: `{ teamId, date: hoy (ISO),
  sessionInstance: { id, name, exercises: [...] }, routeAttempt: { route, acceptanceRadiusMeters,
  competitionId } }`. Navega a `/training-session` (misma ruta que un entrenamiento normal).
- **`session-pre-start-screen.jsx` NO se toca** — ya degrada bien sin `groupName`/`isPresencial`
  (confirmado leyendo el archivo: el bloque de alcance team/grupo es condicional por campo, y
  "Ejercicios de la sesión (1)" con la única fila "Corrida" renderiza sin cambios). El `routeAttempt`
  del `pendingSession` viaja sin uso en esta pantalla — recién lo lee `training-session-active-screen.jsx`
  al arrancar la serie.

## Creación — picker de dibujo de ruta (web + mobile)

**Archivos nuevos**, mismo split de plataforma que `LocationPicker`/`location-picker.web.jsx`:
- `hooks/use-route-draw-picker.js` — estado compartido, agnóstico de plataforma: array de puntos
  `{lat, lng}`, `addPoint`, `undoLast`, `clear`, `totalMeters` (memo, `haversineMeters` sumado
  tramo a tramo, `utils/distance.js` ya existente — no se duplica), `vertexCount`, flags derivados
  `exceedsLength` (`totalMeters > 100_000`) y `exceedsVertices` (`vertexCount > 500`) para
  deshabilitar "Confirmar" y mostrar aviso ANTES de que el backend lo rechace con `400` (UX, no
  reemplaza la validación real).
- `components/team/route-draw-picker.jsx` (nativo, `@maplibre/maplibre-react-native` — ya
  instalado, sin módulo nuevo, sin rebuild de dev client) — `onPress` del mapa agrega un punto;
  `GeoJSONSource` + `Layer type="line"` dibuja la polilínea en vivo; botones "Deshacer último
  punto" / "Limpiar"; contador de distancia/vértices con aviso ámbar si se acerca a los límites,
  rojo si los excede.
- `components/team/route-draw-picker.web.jsx` — mismo picker con `maplibre-gl` directo (como
  `location-picker.web.jsx`), `onClick` del mapa en vez de `onPress`.
- Props de los dos: `{ value /* GeoJSON LineString | null */, onChange }` — mismo contrato de
  `value`/`onChange` que `LocationPicker`, para que `CreateCompetitionModal` los use igual.

**`components/team/create-competition-modal.jsx` (tocado, Spec 4a):**
- Suma selector de tipo (`metric` | `route`, `ResponsiveSelectField` o un segmented control
  simple — detalle de implementación, no una decisión de spec). Con `route`:
  - Oculta el selector de métrica y el campo "Hasta" (no hay `end_at`).
  - Muestra `RouteDrawPicker` (import sin extensión, split de plataforma automático — mismo
    quirk documentado para `checkout-flow.jsx` en `CLAUDE.md`) + un campo numérico "Radio de
    aceptación (metros)", default `50`, validación cliente `[5, 500]`.
  - Validación de submit: ruta con al menos 2 puntos, dentro de los límites de arriba, radio en
    rango, mínimo 2 participantes (igual que métrica).
- `services/normalizers.js#toCreateCompetitionPayload` suma la rama `route`: `{type: 'route',
  route: <geojson>, acceptance_radius_meters, participant_user_ids, group_id?}` (sin `metric`,
  sin `end_at`).

**Interacción con la Spec 4b (sin conflicto, confirmado):** el `handlePlay` de
`session-pre-start-screen.jsx` ya hace su propio `createRunnerSession` fire-and-forget (Spec 4b,
matchea `type='metric'` únicamente — un intento de ruta nunca matchea ahí, `competitionId` sale
`null` de ese lado). El backend ya creó el `runner_session` real al resolver
`POST /competitions/{id}/attempts` (Gap 33 punto 26). El segundo `create` de `handlePlay` es
redundante pero inofensivo — mismo criterio de idempotencia ya documentado en `runnerSession.js`
("200 si ya existía").

## Intento en vivo — extensión de `training-session-active-screen.jsx`

Se extiende el pipeline existente (SQLite local, `session-sync.js`, `useGpsTracker`,
`useStopwatch`) en vez de duplicarlo — la instancia sintética trae 1 solo ejercicio ("Corrida"),
que ya es exactamente el caso de 1 ejercicio/1 serie que ese pipeline soporta hoy.

- `pendingSession.routeAttempt` (presente solo para intentos de ruta) viaja con `{route
  (GeoJSON), acceptanceRadiusMeters, competitionId}`.
- `TrainingSessionActiveScreenContent`: si `pendingSession.routeAttempt` está presente, salta
  directo a `SeriesView` del único set (sin pasar por `OverviewView`, que no tiene sentido con una
  sola fila).
- `SeriesView` (tocado): suma un prop `routeAttempt` opcional. Cuando está presente:
  - Acumula un array de puntos `{lat, lng}` en estado de React (además de lo que ya persiste en
    SQLite vía `insertGpsPoint`/`updateSetDistance`, sin tocar esa parte) — necesario para
    alimentar el mapa en vivo, que no lee de SQLite directamente.
  - Reemplaza el cronómetro circular/chip actual por `LiveTrajectoryMap` (ver abajo) + una fila
    compacta con distancia/tiempo transcurrido (reusa `formatMeters`/`formatStopwatch` ya
    existentes).
  - `SkipMenuModal` (saltar serie/ejercicio) no se monta — no aplica con una sola serie.
    `HoldToCancelButton`/`DragToFinishButton` se mantienen tal cual (cancelar/terminar el intento
    entero sigue siendo la misma acción que cancelar/terminar la única serie).
- Al terminar (mismo `onAdvance`/finalización ya existente): si `routeAttempt` está presente,
  navega a `/route-attempt-result` en vez de mostrar `SessionCompleteModal` genérico.

### `LiveTrajectoryMap` (nuevo, diseñado para reusarse más adelante)

`components/session-runtime/live-trajectory-map.jsx` — componente de mapa real (MapLibre, split
nativo/web igual que el resto), props: `{ traveledPoints: [{lat,lng}], referenceRoute?: GeoJSON |
null, acceptanceRadiusMeters?: number }`.
- `traveledPoints` dibuja una `Layer type="line"` que crece en vivo.
- `referenceRoute` (si viene) dibuja una segunda línea, estilo visualmente distinto (ej. punteada),
  la ruta marcada — ausente, el componente solo muestra la trayectoria recorrida (es el gancho
  para la mejora futura de "trayectoria de toda la sesión", que no tiene ruta de referencia).
- Cámara: `utils/map-bounds.js#computeBounds` (ya existente) sobre la unión de ambos sets de
  puntos, para que la ruta marcada + lo recorrido entren siempre en el encuadre.
- Nombre y props genéricos a propósito — nada en esta spec le hardcodea el concepto de
  "competencia"; `SeriesView` es quien decide pasarle o no `referenceRoute`/`acceptanceRadiusMeters`.

## Resultado

`components/session-runtime/route-attempt-result-screen.jsx` (nuevo, ruta `/route-attempt-result`,
mobile-only) — mapa estático (`LiveTrajectoryMap` con los dos trazos fijos, sin actualizarse) +
distancia/tiempo propios (del run local, inmediatos) + "Calculando resultado…" para el % de
coincidencia mientras `GET /competitions/{id}` todavía no lo refleja (el cálculo server-side no es
necesariamente instantáneo) — reintenta el `GET` con backoff corto (2-3 intentos, patrón ya usado
en otros lados del repo para esperas cortas) antes de mostrar el resultado final o un mensaje de
"se está procesando, revisá más tarde en la pestaña Competencias" si se agotan los reintentos.

## Mocks

- `services/__mocks__/competitions-mock.js` (tocado, Spec 4a): `mockCreateCompetition` acepta
  `route`/`acceptance_radius_meters` cuando `type==='route'`. Nueva función
  `mockCreateCompetitionAttempt(competitionId, athleteUserId)` — valida `active` + participante +
  sin intento previo (nuevo `Set`/array en memoria de `(competition_id, athlete_user_id)` ya
  intentados), devuelve `{session_instance_id, ...}` usando un id sintético determinístico.
- `services/__mocks__/runner-session-mock.js` (tocado, Spec 4b): el `session_instance_id`
  sintético de arriba tiene que resolver en el resto del pipeline (`createRunnerSession`,
  `getSetsForRun` vía `session-db.js`) igual que cualquier otra instancia — sin cambios de código,
  solo confirmar con un test que el flujo sintético no choca con ningún supuesto de "siempre viene
  de un día de calendario".
- `services/competitions.js` suma `createCompetitionAttempt(competitionId)`.

## Testing

- `utils/route-geometry` (si el cálculo de límites del picker termina siendo más que una línea,
  se extrae a util pura testeada — `totalMeters`/`exceedsLength`/`exceedsVertices` ya son
  candidatas; si quedan triviales dentro de `use-route-draw-picker.js`, un test del hook alcanza,
  decisión de implementación).
- `__tests__/competitions-mock.test.js` (Spec 4a, se extiende): crear `type='route'` con
  `route`/`acceptance_radius_meters`; `mockCreateCompetitionAttempt` — primer intento ok, segundo
  intento del mismo atleta → error; atleta no participante → error; competencia no `active` →
  error.
- Sin tests de render de componentes ni del picker de mapa (convención del repo, y el gesto
  táctil/mouse de dibujo no es simulable de forma confiable en Jest — mismo límite ya documentado
  para el resto del drag-and-drop del catálogo).

## Identificadores

Todo componente visual nuevo lleva `nativeID`/`testID` kebab-case (regla obligatoria).

## Riesgos / decisiones abiertas

- El shape exacto de la respuesta de `POST /competitions/{id}/attempts` (qué tan completos vienen
  los datos de la instancia sintética) es un supuesto del mock hasta que backend lo confirme en
  código real — si el shape real difiere, ajustar el mock y el normalizer que lo consuma, sin
  tocar el resto del flujo.
- El backoff de la pantalla de resultado (cuántos intentos, cuánto esperar) es una elección de
  implementación, no un contrato — ajustar sin volver a esta spec si en la práctica el cálculo
  server-side resulta más rápido o más lento de lo esperado.
