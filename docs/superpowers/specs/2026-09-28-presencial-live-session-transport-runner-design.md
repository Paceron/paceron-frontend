# Sesión presencial (1/2): infraestructura de tiempo real + cliente corredor

## Contexto

Primer sub-proyecto de "Registro de sesiones presenciales" — módulo donde corredor y entrenador
interactúan durante una misma sesión en vivo (a diferencia del registro asíncrono ya construido,
donde cada corredor entrena solo y sincroniza al finalizar). Esta spec cubre las dos piezas que
bloquean todo lo demás:

1. Una infraestructura de tiempo real **genérica y reusable** (no acoplada a esta sola feature),
   pensada para servir después a notificaciones en vivo (mobile y web, donde no existe push nativo)
   y a cualquier otra necesidad de tiempo real de la app.
2. El cliente **corredor** de la sesión presencial: unirse en vivo, transmitir GPS y avance de
   ejercicios/series en vivo (no en batch al final), con persistencia local como fallback.

La pantalla del **entrenador** (mapa en vivo, participantes, asistencia, feed de registros) es la
spec 2, a construir después, sobre la base de transporte que define esta spec.

Existente que esta spec extiende, no reemplaza:
- `session-pre-start-screen.jsx` — pre-start actual del corredor, mismo look para presencial.
- `training-session-active-screen.jsx` — pantalla de sesión asíncrona (queda intacta, sin tocar).
- `utils/session-start-window.js` — ya tiene `canStartPresencialSession` (ventana ±30min),
  independiente de `canStartAsyncSession`. Se reusa tal cual.
- `services/session-db.js` / `services/session-sync.js` — persistencia local SQLite +
  `syncRun(runId)` (sube todo lo pendiente del run, tolera fallos parciales). Esta spec **no
  modifica `syncRun`** — solo lo llama más seguido (por serie terminada, no solo al finalizar la
  sesión), reusando su reintento ya existente.
- Gap 12 (`docs/BACKEND_API_GAPS.md`) — ya resuelto en su primer punto: `POST /workout-feedback`,
  `PUT /workout-feedback/:id`, `POST/GET /workout-feedback/:id/points`,
  `GET /session-instances/:id/feedback`. Esta spec **reusa estos endpoints tal cual**, llamados
  incrementalmente en vez de en batch — no se pide persistencia nueva a backend.

## Alcance

**Sí:**
- Cliente WebSocket genérico, singleton por sesión de app, multiplexado por canales
  (`services/realtime-client.js` + `hooks/use-realtime-channel.js`).
- Contrato de canal/mensaje documentado como Gap 18 nuevo en `docs/BACKEND_API_GAPS.md`.
- Canal por sesión presencial (`session:{sessionInstanceId}`): presencia (`joined`/`left`), control
  (`session_paused`/`session_finished`/`announcement`, del entrenador hacia uno o todos los
  corredores), y updates server-originados (para que la spec 2 del entrenador reciba casi en vivo
  los cambios que el REST de abajo persiste).
- Pantalla nueva `training-session-live-screen.jsx` (ruta `/training-session-live`) para el corredor
  en sesión presencial — reusa piezas de la pantalla async donde tenga sentido, pero es un archivo
  propio, sin tocar el flujo asíncrono existente.
- GPS continuo durante toda la sesión presencial (desde el Play hasta finalizar, incluye
  transiciones/descansos entre series) — a diferencia del modelo async, que solo trackea durante
  cada serie en curso.
- Envío incremental (no batch al final de la sesión) del resultado de cada serie por REST, reusando
  los endpoints de Gap 12 y `syncRun(runId)` tal cual existe hoy — llamado por serie terminada en
  vez de solo al finalizar.
- `session-pre-start-screen.jsx` rutea el Play a la pantalla presencial cuando
  `assignment.isPresencial`, sin cambiar su interfaz.
- Banner de estado de conexión no bloqueante (en vivo / reconectando / sin conexión).

**No** (fuera de alcance, queda para spec 2 o después):
- Pantalla del entrenador (mapa, participantes, asistencia, feed de registros, slide-para-finalizar).
- Botón + popup de asistencia (QR/manual) — spec 2, con alcance acotado a botón+shell (el interior lo
  construye el compañero).
- Trazado de ruta ideal y detección de desvíos — anotado como extensión futura sobre el mismo canal
  de sesión (`control`/`update` ya soporta agregar un tipo de mensaje nuevo sin rediseñar), sin
  diseño propio todavía.
- **Reconstruir la trayectoria completa de la sesión (Play a Finalizar) a posteriori.** Con este
  diseño, solo los tramos con serie activa quedan durables (vía `workout_feedback` points) — los
  tramos de descanso/transición viajan como `presence:position` y no se guardan. Alcanza para el
  requisito de hoy (ver la posición en vivo), pero **no** para graficar después una única trayectoria
  de punta a punta. Si eso se pide a futuro, va a hacer falta persistir también los tramos sin serie
  activa — probablemente un endpoint/tabla nuevo del lado backend (no el de `workout_feedback`, que
  está atado a una serie puntual), a diseñar cuando surja el requisito real, no ahora.
- Cualquier feature de notificaciones que reuse este bus — el diseño lo deja posible (canales
  genéricos), pero no se construye ninguna notificación nueva en esta spec.
- Agente de IA autónomo (mencionado como visión a largo plazo) — no impacta este diseño más que
  confirmar que un publicador/suscriptor nuevo podría sumarse al bus sin romper nada existente.

## Arquitectura de tiempo real

**Separación de responsabilidades — por qué dos transportes, no uno:**
- **Resultado final de cada serie (completada/salteada/interrumpida) → REST.** Es el dato "de
  verdad": necesita sobrevivir cortes de conexión y no perderse. Reusa los endpoints de Gap 12 tal
  cual, ya construidos y probados por el flujo async — la única diferencia es que se sube apenas esa
  serie puntual termina, no en un batch al finalizar toda la sesión.
- **Posición en vivo + señalización/control → WebSocket.** Ambas son efímeras por naturaleza: si se
  pierde un punto de posición no pasa nada (llega el siguiente en un segundo), y si se pierde un
  mensaje de control tampoco (el estado real vive en REST) — así que van por un canal más liviano y
  de baja latencia sin cargar con la responsabilidad de no perder datos. Importante: esto **no
  depende de si hay una serie corriendo o no** — todo punto GPS aceptado viaja por WS igual, haya o
  no serie activa (ver "GPS continuo" más abajo para el porqué).

Esta separación evita pedirle a backend que mueva persistencia crítica a un gateway nuevo — el WS
solo necesita un hook de "avisá cuando se escribió algo" más un canal de control chico, no
reimplementar lo que Gap 12 ya resolvió.

**Cliente WebSocket genérico:**
- `services/realtime-client.js` — wrapper delgado sobre el `WebSocket` global (disponible tanto en
  browser como en el entorno JS de React Native/Expo sin módulo nativo — a diferencia de GPS o
  maplibre, esto corre igual en mobile y web, lo que deja la puerta abierta a reusar el mismo
  cliente para notificaciones en vivo en web más adelante). Un solo socket físico por sesión de app
  (singleton a nivel módulo), multiplexado por canales vía el sobre de mensaje.
  - `connect()` — abre el socket autenticado, arranca heartbeat.
  - `reconnect` — backoff exponencial + jitter, automático ante cierre inesperado.
  - `subscribe(channel)` / `unsubscribe(channel)`.
  - `send(channel, type, payload)`.
  - `on(channel, callback)` / `off(channel, callback)` — suscripción de listeners locales.
- `hooks/use-realtime-channel.js` — `useRealtimeChannel(channel, { onMessage, enabled })` →
  `{ status, send }`. `status` es `'connecting' | 'open' | 'reconnecting' | 'closed'`. Suscribe al
  montar (si `enabled`), desuscribe al desmontar. Componentes distintos pueden usar el hook con
  canales distintos sin abrir sockets nuevos — todos comparten la única conexión del singleton.

**Sobre de mensaje (ambas direcciones):**

```js
{
  channel: string,        // ej. "session:42"
  type: 'presence' | 'control' | 'update' | 'subscribe' | 'unsubscribe' | 'ping' | 'pong',
  event?: string,         // sub-tipo dentro de presence/control/update
  from?: { userId, role }, // identidad del emisor — la pisa el SERVIDOR, nunca se confía en lo que mande el cliente
  to?: { userId: number } | 'all', // solo en control, define el destinatario
  payload?: object,
  ts: number,             // epoch ms
}
```

Tipos y quién los emite:

| type | event | emisor | uso |
|---|---|---|---|
| `presence` | `joined` / `left` | corredor (al montar/desmontar la pantalla en vivo) | el servidor pisa `from`, reenvía al canal para que cualquier suscriptor (spec 2: el entrenador) sepa quién está en la sesión |
| `presence` | `position` | corredor, en **cada** punto GPS aceptado — siempre, haya o no serie corriendo | posición en vivo efímera, sin throttle artificial — misma cadencia que el listener de GPS (ver "GPS continuo" abajo), solo para el mapa del entrenador (spec 2), nunca se persiste |
| `control` | `session_paused` / `session_finished` / `announcement` | entrenador | servidor valida que el emisor sea el entrenador de esa sesión (misma autorización que ya aplica en REST, no se reinventa), reenvía a `to` (un `athleteUserId`) o a todo el canal (`to: 'all'`) |
| `update` | `set_event` | **solo servidor**, nunca un cliente | disparado apenas el REST de Gap 12 persiste el resultado final de una serie (`finished`/`skipped`/`interrupted`) — payload incluye los mismos campos persistidos + `athleteUserId`, para el feed de registros del entrenador (spec 2) |
| `subscribe` / `unsubscribe` | — | cliente | unirse/salir de un canal |
| `ping` / `pong` | — | ambos | heartbeat, sin `channel` |

**Por qué no hay `update:gps_point`:** el REST de Gap 12 solo persiste los puntos de una serie cuando esa serie ya terminó (necesita un `feedback_id`, que no existe hasta conocer el resultado final — ver "GPS continuo" abajo) — para entonces el movimiento en vivo de esos puntos ya no importa, la serie dejó de correr. El movimiento en vivo lo cubre `presence:position` por sí solo, sin depender de si/cuándo se persiste.

**Handshake y autenticación:** `wss://<host>/ws?token=<jwt>` — token como query param, no header
(ni el navegador ni React Native permiten headers custom en el handshake WS). Backend valida el JWT
igual que en REST. La autorización por canal (quién puede suscribirse/publicar en
`session:{id}`) replica las reglas que el backend ya aplica a los endpoints REST de esa sesión
(atleta asignado, o entrenador/owner del equipo) — no son reglas nuevas, son las mismas aplicadas a
un transporte distinto.

**Fallback offline: se reusa `services/session-sync.js#syncRun(runId)` tal cual, sin tocarlo.** Esta
función ya sincroniza TODAS las series del run que todavía no subieron (`getSetsForSync` filtra por
`synced = 0`), y ya tolera fallos parciales (una serie que falla no rompe las demás, queda pendiente
para el próximo llamado). Hoy async la llama una sola vez, al finalizar la sesión entera. Para el
envío incremental de esta spec alcanza con llamarla más seguido — después de cada serie que termina,
no solo al final —, sin inventar ninguna cola/tabla nueva: cada llamada ya reintenta lo que quedó
pendiente de una llamada anterior que falló por estar offline, así que el comportamiento de
"mandar apenas termina cada serie, reintentar en la próxima oportunidad si falló" sale gratis,
reusando código ya probado por el flujo async en vez de una cola genérica nueva.

## Gap 18 (a documentar en `docs/BACKEND_API_GAPS.md`)

Pedido concreto a backend, mismo patrón que Gap 13/14 (spec del contrato deseado, backend confirma
o ajusta):

- Gateway WebSocket genérico (`/ws`), autenticado por JWT en query param, con soporte de
  `subscribe`/`unsubscribe` por canal string arbitrario y reenvío de mensajes `presence`/`control`
  a los demás suscriptores del mismo canal, aplicando la autorización que ya existe para el recurso
  que el canal nombra (para `session:{id}`, la misma regla de "atleta asignado o entrenador/owner
  del equipo" que ya protege los endpoints REST de esa sesión).
- Al persistir vía `POST /workout-feedback` (creación de una serie ya terminada/salteada/
  interrumpida), backend emite además un mensaje `update:set_event` al canal
  `session:{sessionInstanceId}` correspondiente con el mismo payload persistido + `athleteUserId` —
  puramente informativo, no cambia la respuesta HTTP existente. `POST /workout-feedback/:id/points`
  no necesita broadcast propio (los puntos de una serie ya terminada no aportan a un mapa en vivo).
- Heartbeat: servidor espera `ping` cada 20-30s, cierra conexiones inactivas más allá de eso
  (a confirmar el valor exacto con backend según límites de Render).

## Cliente corredor — pantalla en vivo

**Nueva pantalla:** `components/session-runtime/training-session-live-screen.jsx`, ruta
`/training-session-live`. Motivo de ser archivo separado (no una rama dentro de
`training-session-active-screen.jsx`): el comportamiento difiere en varios puntos a la vez
(conexión persistente, GPS continuo en vez de por-serie, banner de estado) — separar evita arriesgar
regresiones en el flujo asíncrono ya estable y probado.

**Ruteo:** `session-pre-start-screen.jsx` no cambia de interfaz — solo el Play navega a
`/training-session-live` en vez de `/training-session` cuando `assignment.isPresencial` es true.
`canStartPresencialSession` (`utils/session-start-window.js`, ya existe) sigue gateando la ventana
de inicio sin cambios.

**GPS continuo — dos funciones separadas, nunca mezcladas:** hook nuevo
`hooks/use-session-gps-tracker.js` — arranca al dar Play, corre durante toda la sesión (incluye
transiciones y descansos entre series), se detiene al finalizar/cancelar. Reemplaza, para esta
pantalla únicamente, el uso por-serie de `hooks/use-gps-tracker.js` que sigue intacto en la pantalla
async. Reusa el mismo filtro de calidad `acceptGpsLeg` (`utils/distance.js`) sin cambios.

- **Movimiento en vivo (mapa del entrenador):** CADA punto aceptado, sin importar si hay serie
  activa o no, se manda de inmediato como `presence: position` por WS — sin pasar por SQLite ni por
  ninguna cola. Es una señal efímera; si se pierde un mensaje de estos no pasa nada, el próximo llega
  en el siguiente punto (~1/seg). No hay throttle artificial — la cadencia real ya la fija el
  listener de ubicación (`Accuracy.High`, `timeInterval: 1000`, ver `utils/distance.js`/CLAUDE.md)
  más el filtro `acceptGpsLeg`, nada se agrega encima.
- **Persistencia durable (historial/distancia de la serie):** sigue el mismo timing de hoy en
  async, sin cambios — mientras la serie está corriendo, los puntos se guardan solo local
  (`insertGpsPoint`, igual que siempre). El envío REST (feedback + puntos) sale a través de
  `syncRun(runId)`, sin cambios en esa función — ver más abajo cuándo se llama.

**Eventos de serie:** `markSetStarted`/`finishSet`/`markSetSkipped`/`markSetInterrupted` se llaman
exactamente igual que en el flujo async (mismas funciones de `services/session-db.js`, sin cambios
ahí). La diferencia es que, en esta pantalla, **cada una que sea terminal** (`finishSet`,
`markSetSkipped`, `markSetInterrupted` — no `markSetStarted`, que no tiene resultado final todavía)
dispara un llamado a `syncRun(runId)` (fire-and-forget, mismo patrón ya usado para
`createRunnerSession` en `session-pre-start-screen.jsx`) apenas pasa, en vez de esperar a que termine
toda la sesión. Como `syncRun` ya sincroniza TODO lo pendiente del run (no solo la serie recién
terminada), cada llamada también reintenta cualquier serie anterior que hubiera fallado por estar
offline — sin necesidad de ninguna cola nueva. Cada subida exitosa dispara además el
`update:set_event` que el backend reenvía al canal (ver Gap 18), para que el feed de registros del
entrenador (spec 2) se actualice casi en vivo.

**Canal de sesión:** al montar, `useRealtimeChannel('session:{sessionInstanceId}', { onMessage })`
— manda `presence joined`; al desmontar/finalizar/cancelar, `presence left`. Escucha `control`:
`session_paused` pausa (reusa el mismo código de pausa que ya existe en la pantalla async, sin
duplicar), `session_finished` dispara el mismo flujo de finalización que el slide-para-finalizar
local, `announcement` muestra un `Toast`.

**Banner de estado:** pill no bloqueante con 3 estados — "En vivo" (verde), "Reconectando…" (ámbar),
"Sin conexión — guardando localmente" (gris). El entrenamiento sigue sin importar el estado de la
conexión — el tracking local y `syncRun` absorben cualquier corte, igual que ya garantiza el modelo
async hoy.

## Bordes

- **App en background:** el WS se corta solo (el sistema operativo suspende red en background). Al
  volver a foreground, reconecta + resuscribe. El tracking local (GPS, estados de serie) sigue sin
  depender de la red, igual que en el modelo async hoy — no se introduce ningún riesgo nuevo de
  pérdida de datos.
- **Multi-dispositivo:** fuera de alcance — se asume un dispositivo activo por corredor por sesión,
  misma asunción implícita que ya tiene `runner_session` (una sesión activa por atleta).
- **El entrenador nunca da Play:** no afecta al corredor — su sesión presencial vive en su propia
  ventana horaria (`canStartPresencialSession`) independiente de si el entrenador se unió o no; solo
  deja de recibir mensajes de `control` mientras tanto.
- **Falla real de REST (no solo offline):** `syncRun` corta ese llamado puntual y deja la serie sin
  `synced` — la próxima serie terminada (o el sync final al cerrar sesión) vuelve a intentarlo,
  mismo comportamiento que ya tiene el flujo async hoy, sin cambios.

## Testing

Por convención del proyecto (sin tests de render de componentes), Jest cubre solo lógica pura:
- Armado/parseo del sobre de mensaje y `buildWsUrl` (`utils/realtime-message.js`).
- Cálculo de backoff de reconexión (exponencial + jitter, con tope) (`utils/realtime-backoff.js`).
- Conexión/reconexión/heartbeat/subscribe/send de `services/realtime-client.js`, mockeando el
  global `WebSocket` (mismo espíritu que el mock de `global.fetch` en
  `__tests__/api-client.test.js`).

El gesto de conexión real (timing de reconexión en dispositivo, heartbeat contra un servidor real,
comportamiento de background) no es simulable de forma confiable en el preview — verificación de
eso queda para dispositivo/backend real levantado, mismo límite ya documentado en este repo para
otros mecanismos de timing (ver CLAUDE.md, sección de drag-and-drop).

## Archivos

**Nuevos:**
- `utils/realtime-message.js` — construcción/parseo del sobre de mensaje + `buildWsUrl`.
- `utils/realtime-backoff.js` — cálculo de backoff exponencial + jitter.
- `services/realtime-client.js` — singleton WS.
- `hooks/use-realtime-channel.js`.
- `hooks/use-session-gps-tracker.js`.
- `components/session-runtime/training-session-live-screen.jsx`.
- `app/training-session-live.jsx` — ruta nueva, mismo patrón de wrapper delgado que
  `app/training-session-active.jsx`.

**Modificados:**
- `components/session-runtime/session-pre-start-screen.jsx` — ruteo del Play según `isPresencial`.
- `components/calendar/start-session-button.jsx` — `inWindow` del corredor hoy siempre usa
  `canStartAsyncSession`, incluso para una sesión presencial; pasa a elegir según
  `assignment.isPresencial`.
- `docs/BACKEND_API_GAPS.md` — nuevo Gap 18.

**Sin tocar:** `training-session-active-screen.jsx`, `hooks/use-gps-tracker.js`,
`services/session-db.js`, `services/session-sync.js`, `utils/session-start-window.js` (se reusan,
no se modifican).
