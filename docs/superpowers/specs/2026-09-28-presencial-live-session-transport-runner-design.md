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
- `services/session-db.js` / `services/session-sync.js` — persistencia local SQLite + sync al
  finalizar (modelo async). Esta spec generaliza el patrón "cola local + reintento" a nivel de
  evento suelto, no lo reemplaza.
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
- Envío incremental (no batch) de GPS y eventos de serie por REST, reusando los endpoints de Gap 12,
  con cola local de reintento generalizada (mismo espíritu que `session-sync.js`, ahora por evento
  suelto).
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

**Cola de salida genérica (fallback offline):** nueva tabla SQLite (extiende
`services/session-db.js` o archivo propio — se decide en el plan) con forma
`{ id, endpoint, method, payload, created_at, sent }`. Cada llamada REST incremental (ver abajo) se
intenta enviar de inmediato si hay conexión; si falla o no hay conexión, queda en esta cola y se
reintenta con backoff, drenándose en orden al reconectar/volver a foreground. Generaliza
`services/session-sync.js#syncRun` (que hoy sincroniza todo el run junto al finalizar) a nivel de
evento individual.

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
  (`insertGpsPoint`, igual que siempre). Recién cuando la serie **termina** (`finishSet`) se sube por
  REST el conjunto completo de esa serie: `POST /workout-feedback` (vía `createWorkoutFeedback`,
  mismo payload que ya arma `utils/session-sync-payload.js#buildSetPayload`) y, si tiene distancia,
  `POST /workout-feedback/:id/points` con el `feedback_id` recién devuelto (mismo
  `buildPointsPayload`). Motivo de este timing, no antes: el endpoint de puntos necesita un
  `feedback_id`, que el backend solo entrega cuando ya sabe el resultado final de la serie (Gap 12
  no soporta un estado "en curso") — no se puede subir durable algo que todavía no tiene dueño.

**Eventos de serie:** `markSetStarted`/`finishSet`/`markSetSkipped`/`markSetInterrupted` se llaman
exactamente igual que en el flujo async (mismas funciones de `services/session-db.js`, sin cambios
ahí). La diferencia es que, en esta pantalla, **cada una que sea terminal** (`finishSet`,
`markSetSkipped`, `markSetInterrupted` — no `markSetStarted`, que no tiene resultado final todavía)
encola de inmediato la subida REST de esa serie (feedback + puntos si aplica), en vez de esperar a
que termine toda la sesión — resuelto ya si hay conexión, o desde la cola de salida si no. Cada
subida exitosa dispara además el `update:set_event` que el backend reenvía al canal (ver Gap 18),
para que el feed de registros del entrenador (spec 2) se actualice casi en vivo.

**Canal de sesión:** al montar, `useRealtimeChannel('session:{sessionInstanceId}', { onMessage })`
— manda `presence joined`; al desmontar/finalizar/cancelar, `presence left`. Escucha `control`:
`session_paused` pausa (reusa el mismo código de pausa que ya existe en la pantalla async, sin
duplicar), `session_finished` dispara el mismo flujo de finalización que el slide-para-finalizar
local, `announcement` muestra un `Toast`.

**Banner de estado:** pill no bloqueante con 3 estados — "En vivo" (verde), "Reconectando…" (ámbar),
"Sin conexión — guardando localmente" (gris). El entrenamiento sigue sin importar el estado de la
conexión — la cola local absorbe cualquier corte, igual que ya garantiza el modelo async hoy.

## Bordes

- **App en background:** el WS se corta solo (el sistema operativo suspende red en background). Al
  volver a foreground, reconecta + resuscribe + drena la cola REST automáticamente. El tracking
  local (GPS, estados de serie) sigue sin depender de la red, igual que en el modelo async hoy — no
  se introduce ningún riesgo nuevo de pérdida de datos.
- **Multi-dispositivo:** fuera de alcance — se asume un dispositivo activo por corredor por sesión,
  misma asunción implícita que ya tiene `runner_session` (una sesión activa por atleta).
- **El entrenador nunca da Play:** no afecta al corredor — su sesión presencial vive en su propia
  ventana horaria (`canStartPresencialSession`) independiente de si el entrenador se unió o no; solo
  deja de recibir mensajes de `control` mientras tanto.
- **Falla real de REST (no solo offline):** el ítem de la cola se reintenta con backoff igual que el
  resto de los patrones de reintento del repo; si nunca resuelve durante la sesión, se refleja en un
  estado de sincronización al finalizar (mismo patrón visual que `SessionCompleteModal` en el flujo
  async, sin duplicar diseño).

## Testing

Por convención del proyecto (sin tests de render de componentes), Jest cubre solo lógica pura:
- Armado/parseo del sobre de mensaje (`realtime-client.js`).
- Orden de drenado de la cola de salida (FIFO, no se saltea ni duplica ítems).
- Cálculo de backoff de reconexión (exponencial + jitter, con tope).

El gesto de conexión en sí (reconexión real, heartbeat, comportamiento de background) no es
simulable de forma confiable en el preview — verificación de eso queda para dispositivo/backend
real levantado, mismo límite ya documentado en este repo para otros mecanismos de timing (ver
CLAUDE.md, sección de drag-and-drop).

## Archivos

**Nuevos:**
- `services/realtime-client.js`
- `hooks/use-realtime-channel.js`
- Cola de salida genérica (extensión de `services/session-db.js` o archivo propio — a definir en el
  plan según cuánto crezca `session-db.js`)
- `hooks/use-session-gps-tracker.js`
- `components/session-runtime/training-session-live-screen.jsx`
- Ruta `app/training-session-live.jsx` (o el nombre de archivo que siga la convención de
  Expo Router ya usada por `app/training-session.jsx`)

**Modificados:**
- `components/session-runtime/session-pre-start-screen.jsx` — ruteo del Play según `isPresencial`
- `docs/BACKEND_API_GAPS.md` — nuevo Gap 18

**Sin tocar:** `training-session-active-screen.jsx`, `hooks/use-gps-tracker.js`,
`services/session-sync.js`, `utils/session-start-window.js` (se reusa, no se modifica).
