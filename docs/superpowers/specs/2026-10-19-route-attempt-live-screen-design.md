# Pantalla dedicada del intento en vivo (competencias por trayectoria)

> Sub-proyecto A de la descomposición post-Play para competencias de ruta (ver
> `docs/superpowers/specs/2026-10-19-route-attempt-pre-start-design.md`, el pre-start ya
> construido). Sub-proyectos relacionados, explícitamente fuera de este documento: **B**
> (bug del mapa en `route-attempt-result-screen.jsx` — bundleado acá porque comparte
> componente, no porque sea el mismo diseño), **C** (intentos configurables 1..N + mejor
> resultado, depende de backend, "sin reintentos v1" hoy), **D** (meter result/review
> screens dentro del shell — pendiente de confirmar si sigue bloqueado por trabajo en
> paralelo de un compañero, no decidido todavía), vista de intentos (futuro, atada a C).

## Motivación

Hoy, al tocar Play en `route-attempt-pre-start-screen.jsx`, se navega a `/training-session-
active` (`TrainingSessionActiveScreenContent` → `SeriesView`), la misma pantalla que un
entrenamiento normal usa para CUALQUIER serie de CUALQUIER ejercicio. Spec 4c ya la hizo
"route-aware" en varios puntos (salta directo a `mode='series'` con 1 sola fila, oculta el
botón de saltear, muestra `LiveTrajectoryMap` si `routeAttempt` está presente) — pero sigue
siendo, estructuralmente, la vista de "una serie": copy de "Serie 1 de 1"/"Iniciar serie",
un `OverviewView` real todavía alcanzable por el botón atrás (que para una competencia de
ruta no tiene sentido — no hay otras series para ver), y el mapa compite por espacio con un
cronómetro gigante pensado para una serie de entrenamiento, no para la pieza más valiosa de
un intento de ruta: el mapa en sí.

## Decisiones ya cerradas en esta conversación

- **Radio de alejamiento** (para el trigger de "se fue de la ruta"): 3× el
  `acceptance_radius_meters` configurado en la competencia, derivado, sin campo nuevo. El
  radio original queda intacto para su propósito real (medir % de cumplimiento al cierre,
  server-side) — no se reusa para esto, se multiplica.
- **Timeout por tiempo:** derivado del largo total de la ruta (pace lento de referencia +
  margen), no un tope fijo — una ruta de 500m y una de 20km no deberían compartir número.
- **"Corte del entrenador":** NO es un control en vivo vía WebSocket — es que el entrenador
  cierre la competencia (`PATCH /competitions/{id}/close`, ya existe). Se resuelve con un
  poll del status de la competencia, sin backend nuevo.
- **Hold-to-cancel:** se mantiene (recomendación), menos protagonista visualmente. Con un
  solo intento permitido todavía, cancelar es la única salida deliberada que tiene el
  corredor — sacarlo deja alejarse de la ruta a propósito como única forma de parar antes.

## Arquitectura

**Pantalla y ruta nuevas**, no se toca `training-session-active-screen.jsx` para generalizar
más de lo que ya está (en la dirección contraria: se LE QUITA el camino `routeAttempt`, ver
abajo):

- `app/route-attempt-live.jsx` → `components/session-runtime/route-attempt-live-screen.jsx`
  (`RouteAttemptLiveScreen`, mobile-only vía `MobileOnlyRoute` + `RequireAuth`, mismo patrón
  que `route-attempt-pre-start-screen.jsx`).
- `route-attempt-pre-start-screen.jsx#handlePlay`: `router.push('/training-session-active')`
  → `router.push('/route-attempt-live')`.

**Qué se reusa tal cual (funciones/hooks ya genéricos, viven fuera de `SeriesView`, cero
duplicación):** `initSessionDb`, `getRun`, `createRun`, `getActiveRun`, `getSetsForRun`,
`markSetStarted`, `insertGpsPoint`, `updateSetDistance`, `updateSetTimings`, `finishSet`,
`markSetInterrupted`, `cancelRun`, `interruptStartedSets`, `getLatestRun`, `RUN_STATUS`
(`services/session-db.js`); `syncRun` (`services/session-sync.js`); `useStopwatch`,
`useGpsTracker`, `acceptGpsLeg` (`utils/distance.js`), `toIsoUtc`; `setSessionStarted`/
`clearLiveSession` (`store/live-session-store.js`); `LiveTrajectoryMap` (con los fixes de la
sección Bug B).

**Qué NO se reusa (se reescribe, más chico):** la máquina de fases de `SeriesView` y el
bootstrap de `TrainingSessionActiveScreenContent`. Motivo: ambos cargan con complejidad que
una competencia de ruta nunca necesita (múltiples sets/ejercicios, saltear serie/ejercicio,
`mode='overview'` con lista de ejercicios, reordenamiento). La instancia sintética de una
ruta SIEMPRE tiene 1 ejercicio/1 set — la nueva pantalla bootstrapea directo a "el único
set" sin pasar por ningún concepto de overview. Fases: `ready → countdown → running ⇄
paused → finishing`, igual nomenclatura que hoy, sin `skipVisible`/multi-set.

**Limpieza de paso:** las ramas `if (pendingSession.routeAttempt)` dentro de
`training-session-active-screen.jsx` (bootstrap línea ~1115, `handleAdvance` línea ~1159, el
prop `routeAttempt` de `SeriesView` y sus usos internos — ocultar skip, mostrar
`LiveTrajectoryMap`, mapeo del label) se eliminan: una vez que el Play del pre-start apunta a
la pantalla nueva, ningún intento de ruta vuelve a pasar por `/training-session-active`, así
que ese código queda muerto.

**Controles compartidos (`HoldToCancelButton`/`DragToFinishButton`/`CountdownOverlay`) —
hallazgo durante el diseño:** hoy están duplicados 3 veces, con diferencias menores entre
copias (`training-session-active-screen.jsx`, `training-session-live-screen.jsx`,
`trainer-session-live-screen.jsx` — esta última con `forwardRef` para un trigger externo que
las otras dos no tienen). **Decisión: no consolidar en este sub-proyecto.** Unificarlas es
una mejora real pero es su propio trabajo de refactor sobre 3 pantallas ya en producción —
mezclarlo acá infla el riesgo de esta rama sin necesidad. La pantalla nueva suma una 4ta
copia propia (mismo patrón, nueva). El fix de fondo transparente (ver abajo) se aplica a las
4 copias por separado — mecánico, bajo riesgo, no requiere tocar su lógica. La consolidación
de las 4 en un componente compartido queda anotada como mejora futura (va a la lista de
polish de UX ya pendiente).

## Layout

Mapa (`LiveTrajectoryMap`) ocupando la mayor parte del espacio disponible — hoy fuerza una
altura fija (`h-64`, 256px) pensada para convivir con un cronómetro gigante; pasa a llenar su
contenedor (`h-full w-full` + `Map` con `flex: 1`, mismo patrón que `RouteMapPreview`), y el
contenedor en la pantalla nueva es `flex-1` (la mayoría del alto disponible). Debajo del
mapa, una fila compacta con tiempo transcurrido + distancia recorrida (reusa
`formatStopwatch`/`formatMeters`, ya existentes) — sin el dígito gigante de hoy, sin copy de
"Serie X de Y" ni "Toque Play para arrancar — se arma en 3 segundos" (se reemplaza por algo
genérico de competencia, ej. "Tocá play para arrancar tu intento").

## Controles

- **Pausa/reanudar:** slider, igual mecánica que hoy (`DragToFinishButton` variante
  `neutral`, icon `pause`, label "Deslizá para pausar" / botón "Reanudar").
- **Finalizar:** slider (`DragToFinishButton` variante `finish`), dispara el mismo
  `finishSet` + navegación a `/route-attempt-result` que ya existe (ver Bug B para los
  params nuevos que suma).
- **Cancelar:** `HoldToCancelButton`, se mantiene — mismo modal de confirmación
  (`CancelSessionModal`-equivalente ya usado hoy) antes de disparar `markSetInterrupted` +
  `cancelRun` + `syncRun`. Menos prominente visualmente (más chico / más abajo en la
  jerarquía) que los dos sliders de arriba.

## Finalización automática

Tres triggers nuevos, ninguno existe hoy para ningún tipo de sesión. Todos corren en
`useEffect`s de la pantalla nueva mientras `phase === 'running'` (no mientras `paused` — no
tiene sentido medir alejamiento/tiempo de algo detenido a propósito):

1. **Alejamiento de la ruta:** en cada punto GPS nuevo (mismo `handleGpsPoint` ya existente),
   calcular la distancia mínima del punto actual a la polilínea de la ruta esperada (no solo
   al punto de inicio — un helper nuevo, `utils/route-geometry.js` es el lugar natural dado
   que ya tiene `totalRouteMeters`/límites de ruta). Si supera 3× `acceptance_radius_meters`
   de forma sostenida (ver "Riesgos" sobre anti-flapping), dispara el camino de **cancelar**
   (`markSetInterrupted`, mismo que el slider de cancelar hoy).
2. **Timeout:** al arrancar el set (`beginSet`), calcular
   `timeoutMs = max(30 * 60_000, (totalRouteMeters / 1000) * 12 * 60_000 * 2)` (pace de
   referencia 12 min/km, margen ×2, piso de 30 min para rutas muy cortas) y armar un
   `setTimeout`. Al disparar, dispara el camino de **finalizar** (`finishSet`, mismo que el
   slider de finalizar) — se asume que probablemente completó el recorrido, solo tardó.
3. **Competencia cerrada:** poll liviano de `GET /competitions/{id}` (`useCompetitionDetail`,
   mismo hook ya usado en el pre-start, con `refetchInterval` mientras `phase==='running' ||
   'paused'`) — si `status !== 'active'`, dispara el camino de **cancelar**.
4. **Slider de finalizar (manual):** sin cambios, ya es el camino de finalizar de hoy.

| Trigger | Camino | Motivo |
|---|---|---|
| Slider finalizar | finalizar | Acción explícita del usuario |
| Timeout por tiempo | finalizar | Asume que completó, solo tardó |
| Alejamiento sostenido | cancelar (interrumpido) | No completó la ruta de verdad |
| Competencia cerrada | cancelar (interrumpido) | Se le acabó la ventana, no por su propia acción |
| Hold-to-cancel | cancelar (interrumpido) | Acción explícita del usuario |

## Fix visual: fondo transparente de los pills

`HoldToCancelButton`/`DragToFinishButton` no tienen ningún `bg-*` en su track/botón hoy,
solo borde — se ven transparentes contra lo que haya detrás (pedido real, aplica a las 3
copias existentes + la nueva). Fix: `bg-white dark:bg-surface` (mismo fondo que las cards del
resto de la app, ej. `SectionCard`) en el track de `DragToFinishButton` y en el `Pressable`
de `HoldToCancelButton`, en las 4 copias (3 existentes, sin tocar su lógica — solo la
className — + la nueva).

## Bug B — `route-attempt-result-screen.jsx`

Bundleado acá porque comparte `LiveTrajectoryMap` y los fixes son chicos:

- **Causa real de "no se ve el trayecto recorrido":** `traveledPoints={[]}` está
  **hardcodeado** en la pantalla de resultado — nunca se leyó nada real. Los puntos GPS de la
  corrida SÍ se guardan localmente (`gps_points` en SQLite, por `set_id`,
  `services/session-db.js#getGpsPoints(setId)`, ya existe). Fix: `handleFinish`/el trigger de
  timeout de la pantalla nueva suman `setId: String(set.id)` a los params de navegación a
  `/route-attempt-result`; esa pantalla llama `getGpsPoints(setId)` y pasa el resultado real.
- **Mapa no llena el espacio:** mismo fix de tamaño que en la sección Layout (`h-full w-full`
  en vez de `h-64` fijo) — un solo cambio en `LiveTrajectoryMap` resuelve esto para las dos
  pantallas (la nueva en vivo y el resultado).
- **Sin markers de inicio/fin:** suma dos `Marker` simples (dot rojo/azul, sin tooltip —
  esto es un resumen estático, no necesita tap-to-toggle) sobre el inicio/fin de
  `referenceRoute`, mismo lenguaje visual que `RouteMapPreview`.
- **Estilo del mapa:** `OPENFREEMAP_STYLE_URL` → `OPENFREEMAP_MINIMAL_STYLE_URL` (el estilo
  "limpio" que ya usan `RouteMapPreview`/`route-draw-picker.jsx`).
- **Zoom-out:** el `fitBounds`/padding ya cubre esto en la práctica (muestra ambas líneas
  completas) — no se agrega pan/zoom interactivo (esta pantalla sigue siendo un resumen
  estático de lectura, no una herramienta de exploración), solo se asegura que el padding del
  fit deje margen cómodo.

## Testing

- `utils/route-geometry.js` suma la función de distancia-mínima-a-polilínea (pura, testeable
  — caso ya establecido en ese archivo).
- El cálculo de `timeoutMs` (pura, testeable) puede vivir ahí también o en
  `utils/distance.js`.
- Sin test de render de las pantallas nuevas (convención del repo, mismo límite ya aplicado
  al resto de este módulo).
- Verificación real: solo dispositivo — GPS, mapa nativo, no simulable de forma confiable.

## Identificadores

`nativeID`/`testID` kebab-case en todo lo nuevo (regla obligatoria).

## Riesgos / decisiones abiertas

- **Anti-flapping del trigger de alejamiento:** un solo punto GPS ruidoso a más de 3×
  `acceptance_radius_meters` no debería cancelar un intento entero por un salto de GPS. Antes
  de disparar cancelar, exigir un par de puntos consecutivos fuera de rango (ej. 2-3,
  separados por el intervalo normal de muestreo ~1s) en vez de uno solo — detalle de
  implementación, ajustable sin volver a esta spec.
- **`LiveTrajectoryMap` con `bounds` declarativo reactivo (no `fitBounds` imperativo):** este
  componente nunca se probó en vivo con puntos creciendo cada ~1s (el comentario del propio
  archivo dice "nunca antes probado acá"). Si el re-fit en cada punto nuevo se siente
  entrecortado/molesto en dispositivo real, el fallback es migrar a `fitBounds` imperativo vía
  ref con un throttle (ej. cada 3-5s), mismo patrón ya probado en `route-map-preview.jsx`.
- **Consolidación de `HoldToCancelButton`/`DragToFinishButton`/`CountdownOverlay` en un
  componente compartido:** identificada, no abordada en este sub-proyecto (ver sección
  Arquitectura) — candidata para la ronda de polish de UX ya anotada como pendiente.
- El número exacto de pace de referencia (12 min/km) y el margen (×2) del timeout son
  elección de implementación — ajustables sin volver a esta spec si en la práctica se sienten
  muy cortos/largos.
