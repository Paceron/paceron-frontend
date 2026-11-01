# Mapa en vivo + pulido visual — pre-start y sesión en vivo del corredor

**Rama:** `feature/runner-live-session-map`
**Paso 3 del roadmap post-gamificación** (ver memoria `gamification-branch-post-multiattempt-roadmap`): el corredor debería poder ver permanentemente el mapa con el recorrido de la sesión, no solo al final. El paso 4 (trayectoria real en `session-review-screen.jsx`) queda para después y reusa datos que esta rama no necesita crear — ya existen (ver sección "Qué ya está resuelto" más abajo).

## Alcance

Tres pantallas del corredor, las dos modalidades de entrenamiento NORMAL (no competencia — esas ya tienen su propio mapa, construido en `feature/route-competitions-polish`):

- `components/session-runtime/session-pre-start-screen.jsx` — pulido visual únicamente, sin mapa.
- `components/session-runtime/training-session-active-screen.jsx` — async. GPS pasa de por-serie a continuo + panel de mapa.
- `components/session-runtime/training-session-live-screen.jsx` — presencial. Ya tiene GPS continuo (solo para transmitir por WS); se le agrega capturar un trazo local + panel de mapa.

Nuevo componente compartido: `components/session-runtime/live-session-map-panel.jsx`.

Dos props nuevas, aditivas, en `components/session-runtime/live-trajectory-map.jsx`/`.web.jsx` (el mapa ya construido para competencias de ruta — ver sección siguiente).

## Fuera de alcance (deferred a propósito)

- **AppMobileShell / navegación inferior en estas pantallas.** Quedan full-bleed, igual que hoy y que `route-attempt-pre-start/live-screen.jsx`. El usuario lo marcó explícitamente como una decisión grupal futura, no de esta rama.
- **Distinguir el fragmento de cada serie DENTRO del mapa en vivo.** Esta rama dibuja un solo trazo continuo de toda la sesión, sin segmentar por serie. Ver trayectoria de cada serie es un pedido real, pero para el **post-entrenamiento** (`session-review-screen.jsx`, paso 4 del roadmap, spec propia más adelante).
- **Ver al entrenador u otros corredores en el mapa del corredor** (presencial). El mapa de esta rama muestra solo la posición y el trazo propios — el mapa colectivo ya existe del lado del entrenador (`trainer-session-live-screen.jsx`).

## Qué ya está resuelto, sin tocar nada de esta rama

Cada punto GPS que se registra durante una serie ya se persiste en SQLite con su `set_id` (`insertGpsPoint(set.id, ...)` en `training-session-active-screen.jsx`, `insertGpsPoint(setId, ...)` en `use-live-session-runtime.js`) — esto no cambia. El día que se aborde el paso 4 del roadmap (trayectoria por serie en la revisión post-entrenamiento), esos datos ya están ahí, segmentados por serie; ese trabajo es una pantalla/query nueva, no depende de nada de esta rama.

## Arquitectura

### 1. GPS continuo en async (convergencia con presencial)

Hoy `training-session-active-screen.jsx` arranca/para el GPS (`useGpsTracker`) dentro de `SeriesView`, en cada play/pausa/fin de serie — no hay tracking entre series. `training-session-live-screen.jsx` (presencial) ya resuelve esto distinto: un solo `useSessionGpsTracker` continuo, vive en `use-live-session-runtime.js`, arranca una vez al boot (`useEffect` gateado solo por `booted`) y nunca se detiene durante toda la sesión. La medición de distancia por serie se gatea aparte (`activePhaseRef.current === 'running'`), sin relación con si el watcher de GPS está corriendo o no.

Async migra a ese mismo modelo:
- El `useGpsTracker` sube de `SeriesView` al componente padre (`TrainingSessionActiveScreenContent`), arranca una vez cuando `booted` es true (igual que presencial), nunca se detiene por pausar/cambiar de serie.
- La lógica de distancia por serie (gate a "hay una serie activa y está corriendo", reset de `lastPointRef` en cada cambio de serie) se mantiene EXACTAMENTE igual que hoy — se mueve de lugar, no de comportamiento. El pill verde de distancia, el aviso de "sin señal GPS", todo sigue funcionando igual.
- Intervalo del tracker: mismo ajuste que ya se aplicó esta rama anterior a `use-gps-tracker.js` (500ms) — aplicar también a `use-session-gps-tracker.js` (hoy en 1000ms) para que las dos modalidades midan con la misma frecuencia.

### 2. Trazo de la sesión (un solo trazo, sin segmentar)

Un estado nuevo `tracePoints` (array, append-only) en cada pantalla — se le agrega un punto por cada fix de GPS que llega, sin gatear por fase/serie (a diferencia de la distancia, que sí se gatea). Mismo patrón ya usado en `route-attempt-live-screen.jsx`: cada punto nuevo se suaviza con `smoothGpsPoint` (ponderado por precisión, **nunca** toca el cálculo de distancia, que sigue sobre puntos crudos) antes de agregarse al trazo.

- **Inicio de sesión**: primer punto del trazo, marcado siempre (ícono verde, `ROUTE_MARKER_META.start`).
- **Fin de sesión**: último punto del trazo, marcado recién cuando la sesión termina (ícono naranja, `ROUTE_MARKER_META.end`) — mientras está corriendo no hay "fin" todavía, lo que se ve ahí es el avatar de posición en vivo (ya construido, `CurrentPositionMarker`). El prop `finished` del panel se ata al mismo flag que ya dispara el modal de sesión completada en cada pantalla (`sessionCompleteVisible` en async, `sessionComplete` en presencial) — no hace falta ningún estado nuevo para saber "cuándo termina".

### 3. Dos props nuevas en `LiveTrajectoryMap` (aditivas, sin tocar comportamiento existente)

- **`hideReferenceLine`** (bool, default `false`): si viene `true`, no dibuja la línea punteada gris entre el primer y el último punto de `referenceRoute` — esa línea significa "ruta planificada", y una sesión normal no tiene una. Los markers de inicio/fin de `referenceRoute` se siguen dibujando igual, con o sin esta prop. Sin esta prop, nada cambia para los callers actuales (competencias, que SÍ quieren la línea de referencia).
- **`recenterSignal`** (cualquier valor que cambie, ej. un contador): dispara internamente `cameraRef.current?.flyTo({ center: currentPositionLngLat ?? initialCenter, duration: 500 })` vía un `useEffect`. Mismo efecto que el botón de recentrar del entrenador, pero gatillado por cambio de prop en vez de un ref expuesto hacia afuera del componente — este componente sigue sin exponer su cámara a quien lo usa, mismo criterio que hoy.

Se aplican los mismos a `live-trajectory-map.web.jsx` (contraparte web — hoy sin alcance real en ninguna de las 3 pantallas de esta rama, todas `MobileOnlyRoute`, pero el componente ya es dual-plataforma por diseño y se mantiene así, pensando en el futuro módulo de entrenamiento individual sin equipo mencionado en sesiones anteriores).

### 4. `LiveSessionMapPanel` — componente nuevo

`components/session-runtime/live-session-map-panel.jsx`:

```
<LiveSessionMapPanel
  tracePoints={tracePoints}
  currentUserPhotoUrl={user?.photoUrl ?? null}
  currentUserInitials={getUserInitials(user)}
  finished={bool}
  fullscreen={bool}
  onToggleFullscreen={() => setFullscreen((v) => !v)}
/>
```

Adentro:
- Deriva `startPoint = tracePoints[0]`, `endPoint = finished ? tracePoints[tracePoints.length - 1] : null`.
- Arma `referenceRoute = { type: 'LineString', coordinates: startPoint ? [[startPoint.longitude, startPoint.latitude], ...(endPoint ? [[endPoint.longitude, endPoint.latitude]] : [])] : [] }`.
- Llama a `<LiveTrajectoryMap traveledPoints={tracePoints} referenceRoute={referenceRoute} hideReferenceLine currentPosition={finished ? null : tracePoints[tracePoints.length - 1] ?? null} currentUserPhotoUrl={...} currentUserInitials={...} recenterSignal={recenterCount} />`.
- Encima del mapa, 2 botones flotantes (`absolute right-3 top-3`, columna, círculo blanco con sombra — mismo estilo que los 3 botones de `trainer-session-live-screen.jsx`): fullscreen (ícono `fullscreen`/`fullscreen-exit`, llama a `onToggleFullscreen`) y recentrar (ícono `map-marker-radius-outline`, incrementa `recenterCount` local).

### 5. Layout 50/50 + fullscreen

`fullscreen` vive en la pantalla (estado levantado, no en el panel) — mismo patrón que `trainer-session-live-screen.jsx`'s `fullscreenMap`. Sin fullscreen, el contenedor principal de cada pantalla pasa a tener dos hermanos `flex-1`: el panel de mapa y el contenido actual (la card de `SeriesView`/`LiveSeriesView`, o la lista de `OverviewView`/`LiveOverviewView`) — reparto 50/50 real vía flexbox, no un mapa que "crece lo que sobra". Con fullscreen activo, el hermano de contenido deja de renderizarse (`{!fullscreen && (...)}`) y el panel de mapa pasa a ocupar toda la pantalla.

El mapa se muestra en los dos modos de cada pantalla en vivo (Overview Y Serie) — nunca desaparece durante la sesión, dado que el GPS ya corre continuo.

## Pulido visual (las 3 pantallas)

Mismo criterio en las 3, usando `route-attempt-pre-start/live-screen.jsx` (lo más nuevo del repo en este subsistema) como referencia de estilo:

- Tamaños/jerarquía de texto consistentes entre las 3 pantallas y con el resto de la app.
- Repaso de clases `dark:` faltantes (ya se encontró un caso real roto esta rama — cronómetro sin color de texto en `route-attempt-live-screen.jsx` — vale la pena barrer estas 3 por el mismo problema).
- Íconos donde falten en datos que hoy son solo texto/color.
- Animaciones sutiles donde falte (ej. los 2 botones flotantes nuevos del mapa).
- Unificar tipos de botón donde haya inconsistencia con el resto de la app.
- `accessibilityLabel`/`accessibilityHint` en controles no obvios (los 2 botones flotantes nuevos, principalmente).
- Achicar la card de `SeriesView`/`LiveSeriesView` (tamaño de cronómetro, paddings) para que entre cómoda en la mitad de pantalla que le queda tras sumar el mapa.

Sin lista cerrada de cambios puntuales — se resuelve pantalla por pantalla durante la implementación, mismo criterio ya aplicado esta rama a las pantallas de competencia.

## Testing

- `smoothGpsPoint`, `acceptGpsLeg`, `useGpsTracker`/`useSessionGpsTracker` ya están testeados — sin cambios de comportamiento ahí (solo de lugar/intervalo), no necesitan tests nuevos.
- `LiveSessionMapPanel` y los cambios a `LiveTrajectoryMap` son presentacionales — sin tests de render (convención del repo, ver `CLAUDE.md` sección Testing). Verificación manual en preview donde sea posible.
- Si surge alguna función pura nueva (ej. derivar `referenceRoute` sintético, o la migración del estado de distancia por serie al padre), se testea igual que cualquier util existente.

## Verificación esperada y límites conocidos

- Mobile-only (`MobileOnlyRoute`), sin fallback web — igual que hoy. El mapa en web (`live-trajectory-map.web.jsx`) seguirá sin alcance real en preview para estas 3 pantallas específicamente, mismo límite ya documentado para el trabajo de competencias de esta misma rama base.
- GPS real, continuo, en movimiento — no verificable en este entorno (sin dispositivo). Se prueba con mocks/preview donde el layout/estado lo permita (fullscreen toggle, recentrar con posición simulada si hace falta), y queda pendiente de confirmación en dispositivo real, mismo criterio que el resto de este subsistema.
