# Design

## Context

Ver `proposal.md` para la motivación. Lo que hace falta fijar acá es el estado actual que
condiciona elapproach.

**Los dos flujos de registro ya duplican la lógica de GPS casi línea por línea.**
`components/session-runtime/training-session-active-screen.jsx:698-730` (asíncrono,
dentro de `SeriesView`) y `hooks/use-live-session-runtime.js:154-187` (presencial) tienen
el mismo `acceptGpsLeg` sobre el mismo `lastPointRef`, el mismo `pointOrderRef`, el mismo
`insertGpsPoint` y el mismo `if (leg > 0)` para sumar. Difieren solo en el gate (el
presencial filtra por fase; el asíncrono por un ref booleano) y en dónde vive el
acumulador (`useRef` escalar vs `Map` por set id). La divergencia real entre ambos no está
en el filtro, que es idéntico, sino en el **ciclo de vida del watcher**:

| | asíncrono | presencial |
|---|---|---|
| Watcher | `useGpsTracker`, instanciado **dentro de `SeriesView`** | `useSessionGpsTracker`, a nivel de sesión |
| Ciclos de vida | uno por serie (montaje/desmontaje de `SeriesView`, key por set id) | uno por sesión |
| Arranque en frío | **cada serie** | solo la primera |

`SeriesView` está keyed por `currentSet.id` (`training-session-active-screen.jsx:1221`) y su
cleanup llama `gps.stop()`. Es la razón por la que el asíncrono seMidió peor y el presencial
no.

**`acceptGpsLeg` filtra el caso equivocado para standing-still.** Rechaza puntos con
`accuracy > 30 m`, que es el caso "bajo techo / arranque en frío". Estar quieto al aire libre
es el caso de `accuracy` **chica** (~3-8 m), así que todos los puntos de jitter pasan el
filtro y se acumulan. El filtro de velocidad (12 m/s) no ayuda: a 1 fix/s los pasos de
jitter de 2-3 m dan 2-3 m/s, muy por debajo del umbral. El comentario de
`utils/distance.js:30-34` describe los dos filtros como la defensa contra el ruido de
standing-still, y no lo son.

**Sobre el sync, tres defectos confirmados leyendo el código** (ninguno depende del
disparador concreto de la corrida del usuario):

1. `services/session-sync.js:62-66` — un 409 marca el set como `synced`, cuenta
   `conflicts` y `continue`: **los datos de esa serie se descartan**. El índice único del
   backend `unique_feedback_per_set` es sobre
   `(assigned_session_id, assigned_exercise_id, athlete_user_id, feedback_owner_user_id,
   set_number)` — **no tiene discriminante de corrida**, así que un 409 es de esperar
   (misma sesión reintentada, sync parcial previo, fila de una versión anterior del
   payload) y el dato nuevo es el bueno. El mismo repo ya resuelve esto bien en otro lugar:
   `hooks/use-session-feedback.js:70-79` hace POST → 409 → buscar la fila → PATCH.
2. `services/session-sync.js:41-44` — si el create del `runner_session` falla, `return`
   **antes** del loop, y no se intenta ninguna serie. En el flujo presencial la primera
   pasada de `syncRun` la dispara justamente la serie 1, así que es la única con esa
   exposición. El `finish` dos líneas más abajo (`:79`) ya tolera 409; el create no.
3. `services/session-sync.js:67-68` — cualquier otro error aborta el resto del loop.

**Restricción de testabilidad.** `services/session-sync.js` importa `services/session-db.js`,
que importa `expo-sqlite`: no es testeable con Jest. La convención del repo ya está
establecida para esto — `utils/session-sync-payload.js:1-3` dice textualmente "sin SQLite ni
fetch a propósito — es lo único del pipeline de sync testeable con Jest". Toda lógica de
decisión nueva va en `utils/`, la orquestación se queda en `services/`.

## Goals / Non-Goals

**Goals:**

- Que quieto dé 0 exacto y que la distancia medida se approxime a la real, en los dos
  flujos.
- Un único watcher por sesión, sin importar cuántas series tenga.
- Que no se pierda ni se descarte el registro de ninguna serie, y que lo que no se pudo
  subir se reporte como tal.
- Dejar el pipeline de sync con lógica de decisión testeable con Jest.

**Non-Goals:**

- No se cambia ningún payload ni contrato con el backend. `set_number` 1-indexado,
  `buildSetPayload` y `buildPointsPayload` quedan como están.
- No se recalcula distancia desde los puntos persistidos (ni en el backend ni en el
  cliente): la distancia se sigue acumulando en vivo y se guarda el total.
- No se agrega `accuracy` a `gps_points` ni al payload de puntos. Sería lindo para
  auditar, pero no es necesario para ninguno de los comportamientos de los specs y
  suma superficie de migración.
- No se toca el filtro de accuracy de 30 m ni el de velocidad de 12 m/s: son correctos
  para lo que filtran, solo les falta el umbral de desplazamiento.
- No se arregla el bloqueo de días cerrados ni se agrega la variable de bypass. Es del
  backend (ver `proposal.md`).
- No se cambia la tasa de muestreo más allá de lo que exija el diseño del umbral.

## Decisions

### D1 — La puerta de ruido se mide contra un ancla, no contra el punto anterior

Este es el cambio de fondo y el que merece la justificación completa.

La forma obvious de filtrar standing-still es un umbral por tramo: si el tramo mide menos de
X metros, se descarta. El problema es que a 1 fix/s el ruido de quietud y el movimiento real
**se solapan**: con `accuracy` ~5 m el jitter por fix es de 2-3 m, y un corredor a 3 m/s
mueve 3 m en el mismo intervalo. Cualquier umbral que mate el ruido se come carrera, y
cualquier umbral que deje correr los 3 m reales deja pasar el jitter. Subir `timeInterval`
para separarlos no resuelve: duplicar el intervalo duplica los dos.

La salida es cambiar **la referencia contra la que se mide el umbral**. En vez de
"este tramo se movió respecto del fix anterior", se evalúa "**este punto se alejó lo
suficiente de la última posición donde confirmamos movimiento real**". Esa referencia —el
ancla— es un punto estable, no una muestra de ruido:

- **Quieto:** el jitter de un receptor con `accuracy` 5 m tiene un radio acotado (~5 m) y
  ninguna muestra se aleja del ancla más que eso. Con umbral ≥ 1.5 × `accuracy` ≈ 7.5 m, el
  ancla **nunca se mueve** y la distancia queda clavada en el valor de la última posición
  confirmada.
- **Corriendo:** el corredor cruza el umbral en 2-3 s, se acepta el tramo **completo**
  ancla→punto y el ancla avanza. Como el tramo aceptado va de la ancla al punto nuevo y no
  entre puntos consecutivos, **no se pierde distancia**: el contador suma el recorrido real
  y solo se saltean los puntos intermedios del camino.

Eso último es lo que hace que la solución sea gratis en precisión, y es la razón para
preferirla sobre un deadband por tramo. El único costo real es la resolución: un movimiento
real menor que el umbral y seguido de quietud no llega a registrarse. Queda acotado por el
propio umbral (decenas de metros como máximo, no cientos) y es un compromiso aceptable para
un registro de carrera.

El umbral es `max(MIN_DISPLACEMENT_METERS, NOISE_FACTOR * accuracy)` con `MIN` como piso
para cuando el receptor no reporta `accuracy`, y `NOISE_FACTOR` alrededor de 1.5. Los
números exactos se ajustan con el test de regresión de standing-still y con la corrida en
dispositivo; lo que fija el diseño es la forma (ancla + umbral escalado), no las constantes.

**Alternativas descartadas:**

- *Deadband por tramo simple.* Rechazada por el solapamiento descrito arriba.
- *Suavizado (media/mediana móvil de las últimas N posiciones).* Rechazada: reduce el ruido
  pero **no produce 0** — una media de posiciones con jitter da un valor pequeño pero no
  cero, y sigue sumando. El spec exige 0 exacto. Además introduce latencia en la lectura.
- *Subir `timeInterval` a 2-3 s como solución principal.* Rechazada como principal porque
  sola no da 0 (reduce la pendiente del error, no la elimina) y cuesta resolución en
  effort corto. Se deja el valor actual: con el ancla, la tasa ya no es el problema.
- *Exigir `accuracy` buena para aceptar en vez de descartar.* Invierte el criterio actual y
  empeora el caso real: con `PRIORITY_HIGH_ACCURACY` muchos fixes.legendarios legítimos
  vienen con `accuracy` de 20-40 m y se perderían.
- *Kalman / modelo de movimiento.* Desproporcionado para el problema y no testeable con el
  harness actual sinisteramente.

### D2 — Un solo watcher, subido a la pantalla, en los dos flujos

Se adopta `useSessionGpsTracker` como tracker único y se borra `hooks/use-gps-tracker.js`
(su único importador es `training-session-active-screen.jsx`, y su `getInitialPoint` ya no
lo usa nadie — está definido y muerto desde antes de este change).

En el flujo asíncrono eso implica que `SeriesView` **deja de ser dueña del GPS**: el hook se
instancia en el componente de pantalla, junto al boot del run, y `SeriesView` recibe los
puntos por prop. El gate por serie (solo acumular mientras esa serie está corriendo) se
mueve a la pantalla, calcando `use-live-session-runtime.js:165`.

El acumulador también se unifica: hoy el asíncrono usa un `useRef` escalar porque cada
`SeriesView` monta una sola vez (el ref es fresco por serie); con el watcher a nivel de
pantalla eso ya no se sostiene y hace falta el `Map<setId, meters>` que ya tiene el
presencial. Los dos flujos quedan con la misma forma de estado, que es la mitad de por qué
se divergieron.

**Consecuencia asumida:** `SeriesView` pierde el control del ciclo de vida del watcher, así
que `handlePause`/`handleFinish` dejan de llamar `gps.stop()` — pasa a ser una decisión de
pantalla. El behavior observable no cambia (el spec de pausa ya exige que los puntos de la
pausa no cuenten, y el gate por fase lo cubre sin cortar el watcher).

### D3 — El ancla se reinicia al cambiar de serie, al pausar y al reanudar

El ancla se descarta en: arranque de serie, fin de serie, serie salteada, ejercicio
salteado, **pausa** y **reanudación**.

La pausa es el hueco que hoy está abierto: ni `pauseSet` ni `resumeSet` limpian
`lastPointRef` en `use-live-session-runtime.js:224-245`, ni `handlePause`/el resume de
`handlePlay` en el asíncrono. Con el ancla, el primer fix tras reanudar supera el umbral y
se cuenta **completo** desde el ancla nueva — el desplazamiento de la pausa no se cuela, y a
la vez no se pierde el movimiento real de después de la pausa. Justamente por el diseño de
D1 el reinicio del ancla sale gratis: no recorta distancia, solo reinicia la referencia.

Con el watcher continuo, este reset es además **innecesario para evitar el arranque en
frío** —la referencia siempre es un fix caliente— pero sigue siendo lo correcto para que
cada serie mida desde 0.

### D4 — `elapsedSeconds <= 0` se descarta en vez de aceptarse

`utils/distance.js:50` hoy saltea el filtro de velocidad completo cuando el Δt no es
positivo y devuelve el tramo sin verificar. Se cambia a `return null`. Con el watcher
continuo el caso es más raro, pero el receptor puede entregar fixes con timestamp repetido
o desordenado y un tramo arbitrariamente grande pasando sin control.

### D5 — La recuperación de 409 se decide en `utils/` y se orquesta en `services/`

El patrón a copiar es `hooks/use-session-feedback.js:70-79`, que ya hace POST → 409 →
buscar por `(session, ejercicio, atleta, owner, set_number)` → PATCH, y que además
serializa los requests de a uno justamente para que el 409 de una serie no compita con el
POST de la siguiente (`use-session-feedback.js:96-101`).

La decisión —qué id buscar y qué payload mandar— se extrae a una función pura en `utils/`
con la forma de un `session-sync-payload.js` nuevo, para que sea testeable con Jest.
`services/session-sync.js` la orquesta: ante 409, pide el listado de feedbacks de la sesión,
resuelve el id y hace el PATCH. Cuenta como serie sincronizada, y en un desglose aparte
para que el reporte pueda distinguirla de un alta limpia.

**Extender `toFeedbackEditPayload`:** hoy (`services/normalizers.js:832-841`) emite solo
tiempos, distancia y anotaciones, y **no emite `completion_status`**. Con la recuperación
por PATCH, una fila que quedó `skipped` en un sync anterior y que ahora el corredor
registró de verdad se actualizaría con los tiempos nuevos pero **seguiría mostrándose
"Saltada"** en la revisión. Se le agrega `completion_status` como campo opcional, emitido
solo cuando lo pasa el llamador, para no alterar el camino de edición manual (donde el
estado no es editable).

**409 en el `create_runner_session`:** se tolera igual que ya se tolera en el `finish`
(`:79`). Es idempotente por diseño; si la fila ya existe, el objetivo —que exista— está
cumplido y lo único que había que hacer era marcar el hito local.

### D6 — El loop no aborta y el resultado se desglosa

`syncRun` pasa a recorrer todas las series,uya sea cual sea el error, y devuelve un
desglose: cuántas se subieron limpias, cuántas se resolvieron por conflicto, y la lista de
las que quedaron pendientes con su error. La serie pendiente sigue con `synced = 0`, así
que el reintento la toma.

Esto cambia la firma de retorno, que hoy es `{ synced, conflicts, errors }`. Los dos
call sites (`training-session-active-screen.jsx:471` y `use-live-session-runtime.js:203`)
se actualizan junto con el reporte.

Para el reporte: un conflicto deja de contar como éxito. Hoy
`training-session-active-screen.jsx:478` muestra `"N registradas, M ya existían"` en un
toast de éxito —justo el dato que habría revelado el problema— y `startedRef` (`:463`,
`:489-494`) se latcha en el primer `visible`, así que si el `runId` todavía no está listo
el `syncRun` no hace nada y el toast reporta éxito con cero subidas. El latch se reinicia
cuando cambia el `runId`.

### D7 — La instrumentación es parte del change, no un extra

Con lo que cuesta distinguir "el POST falló" de "el POST fue bien y los valores venían
vacíos", y con que este change **no** puede confirmar cuál de los defectos confirmados
mordió en la corrida concreta del usuario, la instrumentación es parte del entregable:

- Al finalizar cada serie, un log con `wallMs`, `activeMs`, `distanceMeters` —los valores
  exactos que se van a persistir— y cuántos puntos GPS se aceptaron.
- `DebugLogPanel` montado también en la pantalla presencial: hoy solo existe en la
  asíncrona (`training-session-active-screen.jsx:1208`), y el log `[live] syncRun(...) OK
  synced=… conflicts=…` es la línea que distingue las hipótesis.
- El log por tramo aceptado durante los primeros puntos de una serie, con `leg`, `accuracy`
  y `Δt`. Hoy solo se loguean los **descartados** (`training-session-active-screen.jsx:718`):
  los tramos que causan la inflación no se registran en ningún lado, y `accuracy` no se
  persiste. Con D1 el caso de standing-still debería cair a 0 y el log sirve para ajustar
  `NOISE_FACTOR` con datos en vez de con criterio.

## Risks / Trade-offs

**[El deadband puede comerse movimiento real por debajo del umbral]** → Acotado por diseño
(D1: el tramo aceptado va de ancla a punto, no entre puntos consecutivos, así que no se
pierde distancia durante el movimiento sostenido). El residuo es un burst corto menor que
el umbral seguido de quietud, bounded por el propio umbral. Se ajusta `NOISE_FACTOR` con la
regresión de standing-still + una corrida real.

**[Subir el umbral vuelve la distancia insensible al desplazamiento lento]** → Es el
compromiso explícito del spec ("quieto = 0 exacto"). Un corredor caminando muy despacio
durante toda una serie podría registrar menos de lo real. Aceptable para correr; si aparece
el caso, el ajuste es `NOISE_FACTOR`, no la arquitectura.

**[No se puede confirmar en dispositivo desde el preview web, igual que todos los gestos de
este módulo]** → Por eso D7 es parte del change. La confirmación se hace con (a) la
regresión de standing-still con puntos sintéticos, que es determinista, y (b) una corrida en
Android con los logs, que es la que confirma el caso real. El paso (b) queda explícito en
`tasks.md` y es lo que cierra la pregunta de qué defecto mordió.

**[Puede haber datos viejos en `workout_feedback` que choquen con el índice único y disparen 409 en
las primeras series]** → Es esperado y es justamente el caso que D5 recupera. Con la
recuperación, una fila vieja se **actualiza** con los valores nuevos en lugar de taparse.
Para limpiar el estado actual, la verificación incluye la consulta de las filas del
`session_instance` afectado.

**[El cambio de `getSetsForSync` al no abortar puede subir basura que antes se contenía]**
→ El contenido es el mismo: series `finished`/`skipped` pendientes. Lo que cambia es que un
fallo de una ya no frena a las demás, y que el resultado lo reporta. El Toast de "quedó
guardada en el dispositivo" ya existía.

**[Tocar `toFeedbackEditPayload` afecta al camino de edición manual]** → El campo nuevo es
opcional y solo lo emite el llamador de sync-recovery. La edición manual sigue mandando
exactamente lo mismo; hay test de `normalizers` que lo cubre.

**[Subir el watcher a la pantalla aumenta el radio de acción del refactor en
`training-session-active-screen.jsx`]** → El archivo ya tiene 1200+ líneas y es denso.
Mitigación: el handler de puntos se extrae junto con el `Map` de acumuladores, y la
extracción queda en una función nombrada, no en lógica inline nueva.

## Migration Plan

Sin migración de datos ni de esquema. La base local (`gps_points`, `exercise_sets`) no
cambia; los puntos que el deadband deja de escribir son, por definición, ruido.

Rollback: revertir el commit. El único efecto observable de going back es que la distancia
vuelve a acumular ruido —ningún dato existente se interpreta distinto—, salvo los
`completion_status` que una recuperación por conflicto haya cambiado de `skipped` a
`completed`, que sí son datos corregidos a favor.

## Open Questions

Ninguna que bloquee. Hay una pregunta que se resuelve en `tasks.md` y no cambia specs ni
approach: **cuál de los defectos confirmados del sync fue el que mordió en la corrida
concreta**. El approach no depende de la respuesta —se corrigen todos y se instrumenta— pero
la confirmación en dispositivo sí.
