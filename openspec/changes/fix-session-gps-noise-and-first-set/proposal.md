# Proposal

## Why

Probando el registro de sesión en vivo (botón Play, Android) aparecieron dos problemas
separados, ninguno de los dos visible en el código en la forma en que se manifiesta.

**1. La distancia sube estando quieto.** El usuariomeasured 35 m recorridos sin moverse del
lugar. El filtro de calidad existente (`acceptGpsLeg`) rechaza puntos con radio de error
grande, pero no tiene un umbral de desplazamiento mínimo: standing still con buena señal
(es decir, con `accuracy` chica) es justamente el caso en que **todos** los puntos pasan el
filtro y todo su jitter se acumula. Y la longitud de un random walk crece linealmente con
el número de muestras, no con su raíz — por eso 35 m es exactamente lo que acumulan ~12
segundos quieto a 1 fix/segundo. El filtro de accuracy resuelve el caso "bajo techo /
arranque en frío", no el caso "quieto con cielo abierto", y el comentario del código
(`utils/distance.js:30-34`) los confunde.

**2. La primera serie no llega a la revisión con sus valores** (tiempos/distancia en 0 o
vacíos), mientras las siguientes sí.

Sobre el punto 2 hay que ser preciso con lo que sabemos y lo que no: los defectos que van a
corregirse están confirmados leyendo el código, pero **cuál de ellos fue el que mordió en
esa corrida concreta no está confirmado** — depende de una corrida en dispositivo con los
logs. El change por lo tanto corrige todos los defectos confirmados (que son bugs reales
sea cual haya sido el disparador) y agrega la instrumentación que falta para que la
próxima vez se vea en el log y no haya que inferirlo.

## What Changes

### Medición de distancia (ambos flujos)

- **Un solo watcher de GPS por sesión en el flujo asíncrono.** Hoy el asíncrono crea y
  destruye `watchPositionAsync` en cada serie (`SeriesView` está keyed por set id y su
  cleanup llama `gps.stop()`), así que **cada** serie paga un arranque en frío con el peor
  fix como primer punto. El presencial ya mantiene el watcher vivo de punta a punta
  (`useSessionGpsTracker`) y por eso seMidió bien. Se unifica el asíncrono con ese criterio:
  un `useSessionGpsTracker` para toda la sesión, con el mismo gate por fase.
- **Umbral mínimo de desplazamiento (deadband) escalado por `accuracy`.** Un tramo menor a
  `max(MIN, accuracy * factor)` se trata como ruido: no suma distancia. Con el teléfono
  quieto la distancia queda en 0 exacto. Aplica a los dos flujos por igual.
- **El punto de referencia de cada serie se valida antes de aceptarse.** Hoy el primer
  punto de cada serie se guarda como referencia sin mirar `accuracy`, y es el peor fix de
  la serie. Si no pasa el filtro, se sigue esperando uno válido.
- **Un tramo por debajo del deadband no avanza la referencia ni persiste el punto.** Hoy
  cualquier `leg > 0` avanza `lastPointRef`, incrementa `point_order` y escribe en SQLite
  (una escritura por segundo), lo que amplifica el ruido en vez de reducirlo.
- **Cerrar el hueco de pausa/reanudación.** `pauseSet`/`resumeSet` no limpian
  `lastPointRef`, así que el primer tramo tras reanudar mide contra la posición de antes
  de la pausa — y al dividir por un Δt grande, el filtro de velocidad lo da por plausible y
  suma la re-localización completa de una sola vez.
- **Cerrar el hueco de `elapsedSeconds <= 0`** en `acceptGpsLeg`: hoy saltea el filtro de
  velocidad por completo y devuelve el tramo sin verificar.

### Persistencia y sync de las series

- **Un 409 ya no descarta los datos de la serie.** `syncRun` marca el set como `synced` y
  sigue, tirando el payload. El índice único `unique_feedback_per_set` del backend no
  tiene discriminante de corrida, así que un 409 es esperable (mismo
  `session_instance` reintentado, sesión partial sincronizada, fila vieja de una versión
  anterior) y **el dato nuevo es el bueno**. Se recupera con el patrón que ya existe y
  funciona en `useSaveSetMutation`: buscar la fila por
  `(session, ejercicio, atleta, owner, set_number)` y `PATCH`earla.
- **Un 409 en el create del `runner_session` no aborta toda la pasada.** `syncRun` corta el
  loop antes de intentar las series si el create falla, y la serie 1finished es lo que
  dispara esa primera pasada — la única con esa exposición. (El `finish` ya tolera 409 dos
  líneas más abajo; el create no.)
- **Dejar de abortar el resto de las series ante un error no-409**, y distinguir en el
  resultado lo que se subió de lo que quedó para reintentar.
- **El reporte de salida deja de mentir.** Hoy los conflictos se cuentan dentro de un toast
  de éxito ("N registradas, M ya existían") y un `syncRun` con `runId` null reporta éxito
  con 0 subidas. Un conflicto pasa a ser advertencia.

### Instrumentación

- Log por serie al finalizar, con los valores que se van a persistir (`wallMs`,
  `activeMs`, `distanceMeters`) y si hubo puntos GPS aceptados.
- Log del resultado del sync por serie en el flujo presencial, con el desglose.
- `DebugLogPanel` montado también en la pantalla presencial (hoy solo está en la asíncrona).

Sin cambios de contrato con el backend: los payloads de sync y de revisión no cambian.

## Capabilities

### New Capabilities

- `session-gps-measurement`: calidad de la medición de distancia por serie durante el
  registro en vivo —ciclo de vida del watcher, filtrado de ruido, tratamiento del punto de
  referencia y de los reinicios de fase— para los dos flujos (asíncrono y presencial).
- `session-set-sync`: garantía de que lo que se registra en cada serie llega al backend con
  sus valores —persistencia local, recuperación de conflictos y reporte del resultado del
  sync.

Ambas son nuevas: el frontend no tiene todavía ningún spec en `openspec/specs/`, y estas
piezas vivían hasta ahora solo como spec de `docs/superpowers/` y comentarios en el código.

### Modified Capabilities

Ninguna.

## Impact

**Archivos del frontend que cambian**

- `utils/distance.js` — deadband, validación del punto de referencia, cierre del hueco de
  `elapsedSeconds <= 0`.
- `hooks/use-gps-tracker.js` — se retira el watcher por-serie a favor del de sesión
  (`getInitialPoint` queda sin uso: está definido y nadie lo llama hoy).
- `hooks/use-session-gps-tracker.js` — pasa a ser el tracker único de los dos flujos.
- `components/session-runtime/training-session-active-screen.jsx` — el `SeriesView` deja de
  crear/destruir el watcher por serie; logs por serie; reporte del sync.
- `hooks/use-live-session-runtime.js` — mismo tratamiento de la referencia en pausa;
  limpieza de `lastPointRef`; logs.
- `services/session-sync.js` — recuperación de 409 por `PATCH`, tolerancia de 409 en el
  create del `runner_session`, no-abort del loop, desglose del resultado.
- `__tests__/distance.test.js` — regresión de standing-still.
- `CLAUDE.md` — la nota de `acceptGpsLeg` describe hoy los filtros de 30 m / 12 m/s como
  suficientes; deja de ser cierto.

**Fuera de alcance, en otro repo**

El bloqueo de días cerrados que impide editar la sesión de hoy y la de mañana **no se
arregla acá**: el guard real es `isCalendarDayClosed` del backend
(`cmd/api/services/calendar_service.go:380`), que calcula "hoy" con `now.Location()` —la
zona del server, UTC en Render—, y devuelve 422. Va en un change aparte del repo del
backend, junto con la variable de bypass.
