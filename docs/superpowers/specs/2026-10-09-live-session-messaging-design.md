# Mensajería en sesión presencial en vivo

## Contexto

El canal de tiempo real de la sesión presencial (`session:{sessionInstanceId}`, ver
`2026-09-28-presencial-live-session-transport-runner-design.md`) ya tiene un mensaje `control:
announcement` — hoy solo de **entrenador hacia corredores**, de un solo sentido (el corredor lo
recibe como `Toast`, no hay UI para que el entrenador lo mande ni para que nadie responda). Esta
spec resuelve `Gap 27` (`docs/BACKEND_API_GAPS.md`, anotado como roadmap desde el diseño de la
sesión en vivo del entrenador): mensajería real, en los dos sentidos, entre cualquier combinación
de entrenador/corredores de una misma sesión presencial.

Existente que esta spec extiende, no reemplaza:
- `services/realtime-client.js` / `hooks/use-realtime-channel.js` — mismo canal de sesión, mismo
  sobre de mensaje (`utils/realtime-message.js`). Sin cambios al cliente WS genérico.
- `control:announcement` actual (solo toast, sin historial) — queda reemplazado en la práctica por
  el mensaje `type: 'info'` de esta spec (mismo caso de uso, ahora con historial y origen real).
- `utils/haptics.js` — se extiende con 2 funciones nuevas (aviso/alerta), no se reescribe.
- `trainer-session-live-screen.jsx` / `training-session-live-screen.jsx` (corredor) — ya tienen su
  fila de botones de control; se suma uno más ("Mensajes"), mismo patrón visual que
  "Participantes"/"Ver registros".

**Confirmado en Gap 21, relevante para el diseño de abajo:** el relay actual del backend reenvía
`presence`/`control` a **todos** los suscriptores del canal — ningún campo (ni `to`) filtra por
destinatario del lado servidor hoy. Esto descarta mandar el CONTENIDO de un mensaje privado por WS
tal cual (cualquier corredor conectado lo vería en el payload crudo, aunque la UI no se lo muestre).
Ver "Arquitectura" para cómo se evita esto sin pedirle al backend que reescriba el gateway genérico.

## Alcance

**Sí:**
- Entrenador manda un mensaje a un corredor, a varios, o a todos los conectados a la sesión.
- Corredor manda un mensaje al entrenador o a un compañero puntual (no a "varios" — ese selector
  múltiple queda exclusivo del lado entrenador).
- Un mensaje de corredor a corredor es **privado** entre esos dos — ni el entrenador ni otros
  corredores lo ven (se cumple con la misma regla de visibilidad que filtra cualquier mensaje
  dirigido, sin caso especial).
- 3 tipos con escalado de intensidad: `info` (toast simple), `aviso` (modal a cerrar a mano +
  haptics medio), `alerta` (modal + haptics fuerte + sonido).
- Respuesta rápida: chips de texto fijo + campo de texto libre, debajo de un mensaje recibido —
  responde dirigido a quien lo mandó.
- Historial scrolleable por sesión, persistido en backend — sobrevive una reconexión o recarga de
  pantalla (alguien que estuvo desconectado ve lo que se perdió al volver a pedir la lista).

**No** (fuera de alcance):
- Mensajería fuera de una sesión presencial en vivo (no aplica a sesiones async, ni fuera de una
  sesión activa).
- Push notification si el destinatario no tiene la app abierta — un mensaje mandado mientras el
  destinatario no está conectado al canal queda en el historial (lo ve al reconectarse/entrar), pero
  no dispara ninguna notificación del sistema operativo. Posible extensión futura, no en esta spec.
- Edición o borrado de un mensaje ya mandado.
- Cualquier UI de "está escribiendo…" o de lectura confirmada (visto/no visto).

## Arquitectura

**Por qué REST para el contenido y WS solo como aviso — no al revés:**

El patrón ya establecido en este módulo (ver spec de transporte, sección "por qué dos
transportes") separa "dato que tiene que sobrevivir y no perderse" (REST) de "señal efímera, no
pasa nada si se pierde una" (WS). Un mensaje de chat encaja en la primera categoría — tiene que
persistir para el requisito de historial-tras-reconexión ya confirmado — pero además, por la
limitación de Gap 21 (el relay reenvía a TODOS los suscriptores sin filtrar), mandar el cuerpo del
mensaje por WS tal cual rompería la privacidad de un DM apenas hubiera un tercer suscriptor
conectado al mismo canal. La solución: el WS no lleva contenido, solo un aviso liviano de "hay
algo nuevo, pedilo por REST" — la privacidad la aplica el backend en el único lugar que ya la
aplica bien hoy (el filtro de visibilidad de una query autenticada), no un gateway genérico que no
está diseñado para eso.

**Flujo de un mensaje:**
1. El que escribe llama `POST /session-instances/:id/messages` (nuevo, backend) con el cuerpo, el
   tipo, y los destinatarios.
2. El backend persiste la fila y responde con el mensaje creado (igual que cualquier POST del
   resto de la app).
3. El backend reenvía por el canal `session:{id}` un `control: message_created` con el `payload`
   mínimo `{ sessionMessageId }` — ningún otro campo, a propósito.
4. Cualquier cliente conectado que reciba ese aviso hace un refetch dirigido de
   `GET /session-instances/:id/messages?since=<cursor>` — el backend filtra ahí qué mensajes le
   corresponden a ESE usuario (ver "Visibilidad" abajo), así que un destinatario que no corresponde
   nunca llega a ver el contenido, ni aunque reciba el aviso de WS (que no dice nada del contenido,
   solo "revisá").
5. Quien no estaba conectado en el momento del envío ve el mensaje igual la próxima vez que pida la
   lista (al entrar a la pantalla, o al reconectar) — sin necesitar el aviso de WS para nada, ese es
   solo el atajo para "casi en vivo" mientras se está conectado.

**Visibilidad (aplica tanto al filtro del `GET` como, implícitamente, a la privacidad del DM):** un
usuario ve un mensaje si — es el emisor, O `recipient_mode = 'all'`, O su `userId` está en
`recipient_user_ids`. Un DM corredor-corredor (`recipient_mode: 'direct'`, `recipient_user_ids:
[peerId]`) no incluye al entrenador en ninguna de las tres condiciones, así que queda privado sin
ningún caso especial en la regla.

**Dato aceptado conscientemente:** el aviso de WS (`message_created`) llega a TODOS los
suscriptores del canal, incluidos los que no son destinatarios del mensaje nuevo — revela que
"algo pasó" (sin contenido, sin saber de o para quién) a cualquiera conectado. Riesgo mínimo
(mismo tipo de fuga que un indicador de "alguien está escribiendo"), aceptado para no pedirle al
backend que resuelva filtrado real por conexión en el gateway genérico (eso sí sería un cambio de
alcance mayor — ver Gap 27 actualizado, abajo).

## Modelo de datos (pedido a backend)

Tabla nueva `session_messages` (nombre sugerido, backend puede ajustar):

| columna | tipo | notas |
|---|---|---|
| `id` | bigint/serial | |
| `session_instance_id` | bigint | FK |
| `sender_user_id` | bigint | FK |
| `sender_role` | text | `'trainer' \| 'runner'` — quién lo mandó, no de qué rol es el destinatario |
| `type` | text | `'info' \| 'aviso' \| 'alerta'` |
| `recipient_mode` | text | `'all' \| 'multiple' \| 'direct'` |
| `recipient_user_ids` | int[] (o tabla join `session_message_recipients`) | vacío/null si `recipient_mode = 'all'` |
| `body` | text | |
| `reply_to_message_id` | bigint nullable | FK a otro `session_messages.id`, para el hilo de una respuesta rápida |
| `created_at` | timestamptz | |

**Endpoints:**
- `POST /session-instances/:id/messages` — body `{ type, recipient_mode, recipient_user_ids,
  body, reply_to_message_id }`. 403 si el emisor no es participante de esa sesión (misma regla de
  autorización que ya protege el resto de los endpoints de la sesión).
- `GET /session-instances/:id/messages?since=<id>` — devuelve los mensajes visibles para el
  usuario autenticado, posteriores a `since` (omitido o `0` → todo el historial de la sesión).
  Filtra por la regla de visibilidad de arriba — el frontend no vuelve a filtrar nada, confía en lo
  que el backend ya devuelve.

## Frontend

**`hooks/use-session-messages.js` (nuevo):**
- `useSessionMessages(sessionInstanceId)` → TanStack Query sobre `GET .../messages`, clave
  `['session-messages', sessionInstanceId]`. `staleTime: 0` (mismo criterio que
  `use-runner-session.js`/`use-session-feedback.js` de la rama de fixes reciente — este dato
  también puede cambiar por fuera de la propia acción del usuario).
- El `control: message_created` recibido por el canal de la sesión (ya suscripto en
  `use-live-session-runtime.js`/`use-trainer-session-runtime.js`) llama
  `queryClient.invalidateQueries(['session-messages', sessionInstanceId])` — no hace falta un hook
  nuevo de WS, se cuelga del `handleChannelMessage` que cada una de esas dos ya tiene.
- `useSendSessionMessage(sessionInstanceId)` → mutation sobre el `POST`, invalida la misma query al
  completar (cubre el caso del propio emisor, que no se manda el aviso de WS a sí mismo).

**`components/session-runtime/session-messages-modal.jsx` (nuevo, compartido por los dos roles):**
- Un solo componente, con prop `role` (`'trainer' | 'runner'`) que decide SOLO el selector de
  destinatarios interno — todo lo demás (lista, compose, respuesta rápida) es igual para los dos,
  evita duplicar la UI de historial/chat entre las dos pantallas de sesión en vivo.
- Lista scrolleable de mensajes visibles para el usuario actual (orden cronológico), cada fila con
  emisor + tipo (ícono/color por severidad) + cuerpo + hora.
- Debajo de un mensaje RECIBIDO (no de uno propio): chips de respuesta fija (ej. "Recibido",
  "Necesito ayuda", "Dale, ahí voy" — a definir el copy exacto al implementar, no bloqueante para la
  spec) + un campo de texto libre — cualquiera de los dos manda un mensaje nuevo con
  `recipient_mode: 'direct'` hacia el `sender_user_id` del mensaje original y
  `reply_to_message_id` apuntando a ese mensaje.
- Compose principal (para iniciar, no para responder): selector de tipo (3 opciones) + cuerpo +
  selector de destinatario(s):
  - `role === 'trainer'`: reusa la lista de `ParticipantsListModal` (ya existe en
    `trainer-session-live-screen.jsx`) con checkboxes + atajo "Todos" → decide `recipient_mode`
    (`all` si tocó el atajo, `multiple` si marcó 2+, `direct` si marcó exactamente 1).
  - `role === 'runner'`: selector simple de UN destinatario — "Entrenador" o un compañero de la
    lista de participantes conectados — siempre `recipient_mode: 'direct'`.

**Entrega por severidad (dentro del mismo modal/listener, no un componente nuevo aparte):**
- `info` → `Toast.show` (igual que el `announcement` actual) además de quedar en el historial.
- `aviso` → modal de alerta (reusa `ConfirmDestructiveModal` o un modal simple nuevo, a definir el
  componente exacto al implementar) que hay que cerrar a mano + `notifyAviso()` (nueva función en
  `utils/haptics.js`, impacto medio).
- `alerta` → mismo modal + `notifyAlerta()` (impacto fuerte, posiblemente repetido 2-3 veces) +
  reproducir un sonido corto (`expo-audio`, nuevo — ver "Dependencia nueva" abajo).
- Esta lógica de "qué tipo dispara qué" vive en una función pura y testeable,
  `utils/session-message-delivery.js` (`deliveryFor(type) → { toast: bool, modal: bool, haptics:
  'medium' | 'heavy' | null, sound: bool }`), consumida por el componente — no hardcodeada inline
  en el JSX, para poder testearla sin montar nada.

**Dependencia nueva — `expo-audio`:** este proyecto no tiene ninguna librería de audio hoy (solo
`expo-haptics`). `expo-av` está deprecado en la versión de Expo de este proyecto — `expo-audio` es
la reemplazante vigente. Es un módulo nativo: **hace falta regenerar el dev client**
(`npm run android:run`) antes de que el sonido de `alerta` funcione en dispositivo — no alcanza con
un reload de Metro, mismo patrón ya documentado en CLAUDE.md para cada dependencia nativa agregada
hasta ahora. El asset de sonido va en `assets/sounds/`, lo más chico posible (mismo criterio que el
GIF de espera del check-in — nada de archivos pesados para un sonido de alerta de menos de 2
segundos).

## Bordes

- **Destinatario desconectado al momento del envío:** el mensaje queda en el historial igual (vía
  REST), lo ve la próxima vez que pida la lista — no se pierde, solo no le llega "en vivo".
- **El propio emisor:** no recibe su propio aviso de WS (el backend no tiene por qué reenviárselo a
  sí mismo), pero la mutation de envío ya invalida localmente su propia query — su UI se actualiza
  igual, sin depender del WS para verse a sí mismo.
- **Mensaje de severidad alta mientras la app está en background:** fuera de alcance (ver "No" más
  arriba) — sin push nativo todavía, un `alerta` mandado mientras la app no está en foreground no se
  nota hasta que se vuelve a abrir y se consulta el historial.
- **Reconexión del WS (banner "Reconectando…"):** al reconectar, el canal ya se re-suscribe
  (comportamiento existente, sin cambios) — esta spec no agrega ningún catch-up automático
  disparado por la reconexión en sí; el catch-up real pasa por el `GET` con `since`, llamado al
  montar la pantalla/modal, no por un evento especial de reconexión.

## Gap 27 (actualizar en `docs/BACKEND_API_GAPS.md`, ya existe como roadmap)

Pasa de "roadmap sin definición concreta" a pedido concreto:
- Tabla `session_messages` + los 2 endpoints de la sección "Modelo de datos" arriba.
- El backend reenvía `control: message_created` (payload `{ sessionMessageId }`, sin contenido) al
  canal `session:{id}` correspondiente apenas persiste un `POST` exitoso — mismo patrón ya usado
  para `update: set_event` (Gap 18), reenvío informativo sin cambiar la respuesta HTTP del POST.
- Confirmar con backend si prefieren `recipient_user_ids` como columna array (Postgres) o una tabla
  join — no cambia el contrato que ve el frontend (`recipient_user_ids: number[]` en el body/
  response), es implementación interna de backend.

## Testing

Por convención del proyecto (sin tests de render), Jest cubre:
- `utils/session-message-delivery.js#deliveryFor` — las 3 combinaciones tipo→entrega.
- Armado del payload del `POST` (`recipient_mode` derivado de cuántos destinatarios se marcaron, en
  el selector del entrenador).
- `utils/haptics.js` — las 2 funciones nuevas, mismo criterio de test que las 3 ya existentes
  (mockean `expo-haptics`, confirman que no-opean fuera de mobile).

## Archivos

**Nuevos:**
- `hooks/use-session-messages.js`
- `components/session-runtime/session-messages-modal.jsx`
- `utils/session-message-delivery.js`
- `assets/sounds/session-alert.<ext>` (formato a decidir al implementar, el más chico posible)

**Modificados:**
- `trainer-session-live-screen.jsx` — botón "Mensajes" en la fila de controles, monta el modal con
  `role="trainer"`, escucha `message_created` en su `handleChannelMessage` existente.
- `training-session-live-screen.jsx` (corredor) — mismo botón, `role="runner"`, mismo listener.
- `utils/haptics.js` — `notifyAviso()`/`notifyAlerta()` nuevas.
- `package.json` — agrega `expo-audio`.
- `docs/BACKEND_API_GAPS.md` — Gap 27, de roadmap a pedido concreto.

**Sin tocar:** `services/realtime-client.js`, `hooks/use-realtime-channel.js`,
`utils/realtime-message.js` — el sobre de mensaje y el cliente WS genérico no cambian, esta spec
solo agrega un `event` nuevo dentro de `control`, mismo mecanismo que `announcement`/
`session_finished` ya usan.
