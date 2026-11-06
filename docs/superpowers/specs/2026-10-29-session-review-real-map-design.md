# Mapa real + layout desktop en la revisión de sesión (session-review-screen.jsx)

**Rama:** `feature/runner-live-session-map` (continuación — el usuario eligió seguir acá en vez de abrir rama nueva)
**Paso 4 del roadmap post-gamificación** (memoria `gamification-branch-post-multiattempt-roadmap`), con alcance recortado respecto a la idea original — ver "Qué cambió respecto a la idea original" abajo.

## Contexto

`components/session-runtime/session-review-screen.jsx` ("Registro de Sesión") es la pantalla multiplataforma (web + nativo, con shell — no es `MobileOnlyRoute`) donde el corredor/entrenador revisa y edita lo registrado de una sesión ya terminada o en carga manual. Al abrir el detalle de una serie (`SetDetailView`), hoy se muestra `TrajectorySketch` — un dibujo SVG abstracto (sin calles, sin mapa real) armado con los puntos GPS de ESA serie.

## Qué cambió respecto a la idea original

La idea registrada en la memoria del roadmap era "silueta de TODA la sesión + resaltar la serie que se revisa". Al explorar el código real se encontró que **hoy no existe ningún fetch que traiga los puntos de más de una serie a la vez** — `TrajectorySketch` pide `GET /workout-feedback/:id/points` por `feedbackId`, una serie por vez, a propósito (comentario explícito en el componente: traer todo de una sería descarga innecesaria). Armar la silueta completa de la sesión necesitaría N requests (uno por serie) sin ningún endpoint agregado del lado backend, y contradice esa decisión ya tomada.

**Esta rama resuelve solo el reemplazo del dibujo abstracto por un mapa real, serie por serie** — mismo dato que ya se pide hoy, mismo patrón de un fetch por serie. La silueta de toda la sesión queda for afuera, documentada como posible trabajo futuro si hiciera falta (ver "Fuera de alcance").

También se encontraron **2 de los 3 pendientes viejos de esta pantalla (memoria `training-session-review-screen-future-improvements`) ya resueltos, sin que nadie los marcara:**
- **Shell:** `app/(tabs)/_layout.jsx` envuelve automáticamente CUALQUIER ruta bajo `(tabs)/` en `AppWebShell`/`AppMobileShell` (sin excepción salvo el landing público) — y `training-session-review.jsx` vive en `app/(tabs)/training-session-review.jsx`. Ya tiene shell, sin código propio.
- **Resiliencia de URL:** `utils/review-slot-nav.js` (`buildReviewSlotNavParams`/`reviewSlotFromNavParams`) ya reconstruye el slot desde query params si el store en memoria está vacío (ej. F5 en web). Implementado, no visto en la memoria vieja.

El único pendiente real que queda: **la pantalla no aprovecha el ancho en desktop** (una sola columna, `max-w-3xl`, sin importar cuán ancha sea la ventana).

## Alcance

1. Reemplazar `TrajectorySketch` por un mapa real, por serie (mismo fetch, mismo momento de carga — bajo demanda al abrir el detalle).
2. Reorganizar `SetDetailView` en dos columnas en ventana ancha (mapa de un lado, campos de datos del otro); se mantiene apilado en angosto/mobile.
3. Pulido visual general en esta pantalla (íconos, tamaños, alguna animación, repaso de `dark:`) — mismo criterio ya aplicado esta rama a las otras 3 pantallas.
4. Verificar de verdad (no solo por lectura de código) que un F5 sobre una revisión abierta no rompe nada — ya documentado como ya resuelto, pero se confirma en preview antes de dar el tema por cerrado.

## Fuera de alcance

- **Silueta de toda la sesión con la serie actual resaltada.** Necesitaría N requests (uno por serie) sin endpoint agregado — se evalúa más adelante si hace falta de verdad, no ahora. `ReviewListView` (el listado de series) no cambia.
- **Cambios al shell** — ya está resuelto, no hay nada que tocar.
- Cualquier cambio a la lógica de guardado/edición de series (`SetDetailView`'s campos editables, `useSaveSetMutation`, etc.) — fuera de alcance, esta rama solo toca la presentación de la trayectoria y el layout.

## Arquitectura

### 1. `SeriesTrajectoryMap` — componente nuevo, reemplaza a `TrajectorySketch`

`components/session-runtime/series-trajectory-map.jsx`. Misma firma de entrada que `TrajectorySketch` (`feedbackId`, `pointsCount`) y mismo mecanismo de fetch bajo demanda (`getWorkoutFeedbackPoints(feedbackId)`, `services/runnerSession.js` — sin cambios ahí, ya devuelve `{latitude, longitude}` por punto, confirmado leyendo `utils/trajectory.js#buildTrajectoryPath`, que ya consume esos mismos campos).

Por dentro usa `LiveTrajectoryMap` directo (no `LiveSessionMapPanel` — el panel trae fullscreen/recentrar, de más para una card de revisión chica):
- `traveledPoints` = los puntos tal cual vienen del fetch.
- `referenceRoute` sintetizado del primer y último punto (mismo patrón que `LiveSessionMapPanel`), con `hideReferenceLine` activo — no hay "ruta planificada" que mostrar acá, solo lo que pasó.
- Marcador de inicio (verde) y de fin (naranja) SIEMPRE presentes (a diferencia del panel en vivo, acá la serie ya terminó, nunca hay un "todavía no se sabe el fin").
- `currentPosition` siempre `null` — no hay avatar de posición en vivo, es historial.
- Altura fija tipo card (~240px, más grande que los 160×160 del sketch viejo — ahora es un mapa real, necesita más espacio para leerse).

Mismos 3 estados que ya maneja `TrajectorySketch` hoy (sin puntos → aviso de "sin GPS"; cargando → spinner; error → aviso) — se preservan, solo cambia qué se dibuja cuando hay datos.

### 2. Layout desktop de `SetDetailView`

`useIsNarrowWeb()` (`hooks/use-is-narrow-web.js`, ya usado en toda la app) decide la estructura: en ventana ancha, dos columnas (`flex-row gap-4`) — mapa de un lado, el bloque de `DataField`s + metadatos del otro; en angosto/mobile, apilado como hoy (sin cambios de código ahí, mismo JSX).

### 3. Pulido visual

Mismo criterio ya aplicado en esta rama a `session-pre-start-screen.jsx`/las 2 pantallas en vivo: íconos donde falten, repaso de `dark:`, alguna animación sutil donde sume. Se resuelve pantalla por pantalla durante la implementación, no hay lista cerrada de antemano.

### 4. Verificación de resiliencia de URL

Paso de verificación manual (no de código): abrir una revisión en el preview, hacer F5, confirmar que el slot se reconstruye desde los query params y la pantalla no manda a home ni pierde el contexto. Si falla, se convierte en un bug a arreglar (no se espera que falle, el mecanismo ya existe, pero no se da por buena sin probarla).

## Testing

- `buildTrajectoryPath`/geometría pura: sin cambios, ya testeada.
- `SeriesTrajectoryMap` es presentacional — sin tests de render (convención del repo). Verificación manual en preview (datos reales de GPS para sesiones normales no están seedeados en los mocks hoy — confirmado revisando `workoutFeedback-mock.js`, solo hay puntos para las 2 competencias de ruta — así que la verificación visual del mapa con datos reales puede necesitar sembrar un mock nuevo o probarse contra backend real).
- Layout desktop: verificación manual en preview, redimensionando la ventana.

## Verificación esperada y límites conocidos

- Multiplataforma (no `MobileOnlyRoute`), alcanzable en preview web — a diferencia del trabajo anterior de esta rama, acá SÍ se puede verificar casi todo en el entorno actual.
- Dato real de GPS para sesiones normales (no competencia) no está en los mocks — puede hacer falta sembrar una fila nueva en `workoutFeedback-mock.js` para ver el mapa con contenido real en vez del estado "sin GPS", a confirmar durante la implementación.
