# Huecos de backend detectados integrando equipos/grupos/invitaciones

Doc de seguimiento interno — refleja únicamente los gaps de backend **actualmente abiertos y accionables**. El historial completo (gaps ya resueltos, y los excluidos temporalmente) vive en el historial de git de este archivo (`git log -p -- docs/BACKEND_API_GAPS.md`).

**Actualización 2026-08-02:** limpieza de la doc por pedido del usuario, para dejarla enfocada en lo que hay que resolver ahora del lado del backend:
- Se sacaron los gaps ya resueltos (eran 7: sin endpoint "mis equipos", `show_groups_to_runners`, listar invitaciones pendientes de un equipo, aceptar/rechazar invitación, `DELETE /teams/{id}` rechazando al dueño, endpoint de invitaciones propias del invitado, `group_id` al invitar) — quedan documentados en el historial de git, no acá.
- Se excluyen **deliberadamente, hasta que el usuario lo indique**, los gaps referidos a foto de equipo y a plan de entrenamiento en el grupo — no son prioridad de backend por ahora (el equipo prioriza otro trabajo). El frontend ya refleja esa decisión: el selector de plan queda en la UI sin opciones (`TRAINING_PLAN_OPTIONS = []` en `store/team-store.js`), y la foto de equipo sigue sin persistir entre sesiones. Cuando el usuario retome alguno de los dos, se vuelve a documentar acá como gap propio.

**Actualización 2026-08-02 (roster real):** `hooks/use-team-roster.js` arrancó a consumir `GET /teams/{id}/users` + `GET /groups/{id}/users` (reemplaza el roster mock) — ninguno de los dos trae nombre/email, solo `user_id`, así que hace falta un fan-out N+1 contra `GET /auth/user?id=` por cada corredor único (cacheado/dedupeado con TanStack Query, no bloqueante, pero motivó el gap 2 nuevo de abajo).

**Actualización 2026-08-03:** gap 3 (`InvitationResponse` sin quién invita) — **RESUELTO**, el backend sumó `inviter_id`/`inviter_name` directo. Se sacó el workaround de 2 requests (`GET /teams/{id}` → `GET /auth/user?id=`) de `received-invitations-screen.jsx`, ahora usa `invite.inviterName` directo (`services/normalizers.js#toInvitationModel`).

**Actualización 2026-08-07:** gap 1 (búsqueda de usuarios) — **RESUELTO**, `GET /users/search?q=` existe (mínimo 3 caracteres, hasta 5 resultados). Implementado el autocomplete al invitar (`services/user.js#searchUsers`, dropdown de sugerencias en `components/forms/fields.jsx#EmailInviteForm`, debounced 300ms).

**Actualización 2026-08-08:** gap 2 (lookup de usuarios en lote) — **RESUELTO**, `GET /users?ids=1,2,3` existe (hasta 50 ids). `hooks/use-team-roster.js` dejó el fan-out N+1 contra `GET /auth/user?id=` y pasa a resolver todo el roster en una sola llamada (`services/user.js#batchLookupUsers`).

**Actualización 2026-08-26:** el usuario retomó plan de entrenamiento (ver
`docs/superpowers/specs/2026-08-26-training-plans-design.md`) — se abre
como gap propio:

**Actualización 2026-09-12: Gap 4 — RESUELTO del lado del backend.** El
backend implementó catálogo (`Exercise`/`Session`/`TrainingPlan`, 18
endpoints) y calendario por grupo (`GroupCalendarDay`, 10 endpoints) —
rama `feature/planes-entrenamiento-y-calendario`, mergeada a `develop`
del backend, desplegada en Render. Specs completas en
`docs/BACKEND_TRAINING_PLANS_SPEC.md` y
`docs/BACKEND_CALENDAR_ASSIGNMENTS_SPEC.md`.

Del lado del frontend, cableado en 2 etapas:
- **Catálogo — hecho** (esta misma actualización): `services/exercises.js`,
  `services/sessions.js`, `services/trainingPlans.js` (solo las 6
  funciones de plan/día, no las de asignación) sacaron `FORCE_MOCKS` y
  pegan contra el backend real vía `USE_MOCKS` estándar.
- **Calendario/asignación — pendiente**, sub-proyecto propio a futuro.
  Las funciones de asignación individual (`assignPlanToRunner`,
  `markPlanAsCurrent`, etc. en `services/trainingPlans.js`) siguen
  mockeadas — no es un gap de backend (esas rutas nunca se
  implementaron, quedaron descartadas antes de llegar a producción, ver
  `docs/BACKEND_TRAINING_PLANS_SPEC.md` §3.6), es reescritura de
  frontend pendiente contra el calendario nuevo. El campo
  `trainingPlanId` en `toGroupModel` (`store/team-store.js`), siempre
  `null` hasta hoy, tampoco tiene reemplazo directo en el modelo nuevo —
  se revisa cuando arranque esa reescritura.

Sin gap abierto de foto de equipo — sigue deliberadamente excluido hasta que el usuario lo retome (ver actualización 2026-08-02 arriba).

**Actualización 2026-09-02:** arrancó el trabajo de Fase 0 de pagos (ver
`docs/superpowers/specs/2026-09-02-payments-fase0-frontend-design.md`) —
se abre un gap propio detectado en el camino:

## Gap 5 — sin endpoint para listar los permisos de un tier ajeno [RESUELTO]

**Actualización 2026-10-09 — RESUELTO, mergeado a `develop` del backend y corriendo en stage
local.** `GET /api/v1/tiers/{id}/permissions` — autenticado, sin ownership. `200
{"permissions":[{"permission_id","permission_name"}]}` ordenado ASC; `200 []` si el tier no tiene
permisos activos (los soft-deleted se omiten); `404` tier inexistente. Sin acción de frontend
pendiente todavía — integrarlo a la pantalla "Mejorar tier" (reemplazar/enriquecer el
`description` de texto libre) queda como mejora futura, no bloqueante.

`POST /api/v1/tiers/{id}/permissions` (asignar un permiso a un tier)
existe, pero no hay `GET /api/v1/tiers/{id}/permissions` (listar). El
único lugar donde se resuelven permisos por tier es
`GET /auth/permissions`, y solo trae los del tier **actual** del usuario
autenticado. Impacto: la pantalla "Mejorar tier" no puede mostrar la
lista de beneficios/permisos de un tier al que el usuario todavía no
accedió — usa el `description` de texto libre del tier como único
contenido de "beneficios". No bloqueante (la pantalla funciona con
`description`), pero limita qué tan rica puede ser esa lista sin este
endpoint.

**Actualización 2026-09-19:** arrancó el frontend del calendario de
asignaciones (sub-proyecto 2 de `docs/BACKEND_CALENDAR_ASSIGNMENTS_SPEC.md`,
ver también `docs/superpowers/specs/`) — se abre un gap propio detectado
en el diseño, sobre un campo que el backend **ya tiene deployado** (no es
un endpoint faltante, es un cambio de schema sobre algo que ya existe):

**Actualización 2026-09-20: Gap 6 — RESUELTO.** El backend implementó
`presencial_time_from`/`presencial_time_to` (`GroupCalendarDay`) y
`default_time_from`/`default_time_to` (`PlanDay`), con validación
`*_to > *_from` y las columnas viejas ya dropeadas — confirmado en
`docs/BACKEND_CALENDAR_ASSIGNMENTS_SPEC.md` (nota de actualización) y en
`FRONTEND_IMPACTO_INSTANCIACION.md` del repo backend ("los horarios
viajan HH:MM (UTC) como siempre — sin cambio"). Sin acción pendiente.

## Gap 6 — `presencial_time` necesita ser rango (desde/hasta), no un horario único [RESUELTO]

Toda sesión presencial necesita horario de **inicio y fin**, no un solo
horario puntual — decisión del usuario al diseñar la pantalla de edición
de días del calendario. Afecta dos campos ya deployados:

- `GroupCalendarDay.presencial_time` → `presencial_time_from` +
  `presencial_time_to` (`docs/BACKEND_CALENDAR_ASSIGNMENTS_SPEC.md` §3.1,
  ya actualizado con el modelo nuevo).
- `PlanDay.default_time` → `default_time_from` + `default_time_to`
  (`docs/BACKEND_TRAINING_PLANS_SPEC.md` §3.5, ídem — se copia al
  `GroupCalendarDay` correspondiente al estampar un plan, mismo cambio
  necesario ahí por consistencia).

Validación nueva en ambos: `*_time_to` posterior a `*_time_from`,
obligatorio *solo* si `is_presencial`/`default_presencial = true` (mismo
criterio que ya aplicaba al campo único). El resto de `GroupCalendarDay`
(días sin presencial, `kind`/`session_id`/`cancelled_reason`) ya funciona
real contra el backend deployado, sin mocks — el frontend nuevo pega
directo contra los 10 endpoints reales. Guardar específicamente un día
**presencial** va a fallar (`422`, `presencial_time` sigue siendo el
campo viejo del lado del backend) hasta que se aplique este cambio —
error real y visible, no un mock que tape el gap.

**Actualización 2026-09-20:** el backend implementó instanciación de
sesiones en el calendario (rama `feature/asignacion-por-instanciacion`,
ver `FRONTEND_IMPACTO_INSTANCIACION.md` del repo backend y
`docs/BACKEND_CALENDAR_ASSIGNMENTS_SPEC.md` §3.1bis, ya actualizado). No
es un gap — es un cambio de contrato ya deployado que el frontend tiene
que adaptar. En el camino se detectaron 2 mejoras deseables que sí son
gaps propios, pedidas por el usuario al revisar el impacto:

## Gap 7 — instancias de sesión sin referencia al catálogo de origen, y reinstanciación obligatoria en cada guardado [RESUELTO]

**Actualización 2026-09-21: RESUELTO.** El backend cerró los dos puntos,
ambos aditivos: (1) `session_instance.session_id`/`exercises[].exercise_id`
ya vienen en la respuesta (`null` en instancias creadas antes del cambio,
sin backfill — poblado siempre en instancias nuevas); (2) `PUT`/`bulk` con
`kind=training` ya no requieren `session_id` si el día ya tiene instancia
— omitirlo la conserva sin reinstanciar. `stamp` no cambia, ahí sigue
siendo requerido. Frontend adaptado: `services/normalizers.js` exporta
`KEEP_CURRENT_SESSION` (sentinel `'__keep__'`), el select de sesión de
`group-calendar-day-screen.jsx` lo ofrece como opción por default cuando
el día ya tiene una instancia — reemplaza por completo el match-por-nombre
que se había armado como mejor esfuerzo mientras esto no existía
(`utils/session-instance-match.js`, ya eliminado). Detalle original del
pedido, dejado como referencia histórica abajo.

Confirmado en código (`cmd/api/services/calendar_service.go`,
`cmd/api/domains/instance/instance_response.go`, repo backend):

1. **`SessionInstanceResponse`/`InstanceExerciseResponse` no tienen
   ninguna referencia de vuelta al catálogo.** Una vez creada una
   instancia (al asignar una sesión a un día), no hay forma de saber de
   qué `Session`/`Exercise` de catálogo salió — ni para mostrarlo en la
   UI, ni para preseleccionar con certeza "la sesión que ya tenía este
   día" en un selector. Pedido: agregar `session_id` nullable a
   `SessionInstanceResponse` y `exercise_id` nullable a
   `InstanceExerciseResponse`, apuntando a la `Session`/`Exercise` de
   catálogo que las originó, `ON DELETE SET NULL` — mismo patrón ya
   usado en `GroupCalendarDay.source_plan_id`.

2. **`validateDayFields` exige `session_id` en every `PUT` con
   `kind=training`** (`calendar_service.go:191-194`), y `UpsertDay`
   **siempre reinstancia** cuando `kind=training`
   (`calendar_service.go:488-503`) — no hay forma de guardar un día ya
   asignado sin volver a elegir sesión, ni siquiera para tocar solo el
   horario presencial. Pedido: si `session_id` viene `nil` en el `PUT` y
   el día ya tiene `SessionInstanceID` cargado, **conservar la instancia
   actual sin reinstanciar** — mismo mecanismo que ya existe para
   `kind=cancelled` (línea 494-496, preserva
   `txExisting.SessionInstanceID`), extendido a `kind=training`. Solo
   debería fallar (`ErrCalendarFieldMismatch`) si `session_id` viene
   `nil` y no hay ninguna instancia previa que conservar (alta nueva sin
   elegir sesión).

**Impacto en frontend (histórico, ya no vigente):** mientras este gap
estuvo abierto, el selector de sesión de la pantalla de edición de un día
no podía sumar "la instancia actual" como opción — se construyó con
match-por-nombre como mejor esfuerzo. Ver actualización 2026-09-21 arriba
para el estado real ya resuelto.

**Actualización 2026-09-21:** al encarar "evitar pisar selectivo" dentro
del flujo de estampado (sub-pieza 3 de la serie de gestión avanzada del
calendario — menú de día y selección múltiple ya implementados y
probados), se abre un gap propio:

## Gap 8 — `stamp` no permite excluir fechas puntuales del rango [RESUELTO]

**Actualización 2026-10-09 — RESUELTO, confirmado por backend.** `exclude_dates` (array de fechas
`YYYY-MM-DD`) ya existe en el body de `POST /groups/{id}/calendar/stamp` -- formato inválido da
`422`; fechas fuera del rango se ignoran; un rango totalmente excluido devuelve `201 {"days":[]}`.
Semántica tal cual se pidió originalmente (ver detalle abajo). Sin acción de frontend pendiente más
allá de integrar el campo en `stamp-plan-modal.jsx` cuando se retome "evitar pisar selectivo".


Hoy `POST /groups/{id}/calendar/stamp {plan_id, start_date, force}` es
atómico y todo-o-nada sobre el rango completo del plan: si `force` es
`true`, pisa TODOS los días del rango que ya tengan contenido: no hay
forma de decirle "estampá este rango, pero dejá estos días puntuales tal
como están".

Caso de uso real: el entrenador arma el preview de estampado (ya
implementado en el frontend, `stamp-plan-modal.jsx`), ve que algunos días
del rango ya tienen contenido, y quiere estampar el resto del plan igual
pero conservando esos días puntuales sin tocar — hoy la única opción es
pisar todo el rango o no estampar nada.

**Pedido:** sumar un campo opcional `exclude_dates` (array de fechas
`YYYY-MM-DD`) al body de `POST /groups/{id}/calendar/stamp`:

```json
{ "plan_id": 5, "start_date": "2026-10-05", "force": true, "exclude_dates": ["2026-10-07", "2026-10-09"] }
```

Semántica propuesta:
- Toda fecha en `exclude_dates` se salta por completo — no se crea, no
  se modifica, sin importar si tenía contenido previo o no. Si esa fecha
  ya tenía una fila, queda exactamente como estaba.
- `force` sigue aplicando igual que hoy para el resto del rango (las
  fechas NO excluidas) — si alguna de esas tiene conflicto y `force` no
  es `true`, sigue rechazando con `409` y la lista de conflictos, mismo
  comportamiento actual.
- Una fecha en `exclude_dates` no debería contarse ni para el `409` de
  conflictos ni para el guard de día cerrado (`422`) — se ignora por
  completo, es exactamente "no tocar este día".
- La respuesta (`201`, array de `GroupCalendarDay`) simplemente no
  incluye las fechas excluidas (no se tocaron, no hay nada nuevo que
  devolver de ellas).
- Campo opcional, aditivo — omitirlo mantiene el comportamiento actual
  exacto (compatible con lo que ya usa el frontend hoy).

**Impacto en frontend:** hasta que este campo exista, el frontend no
puede implementar "evitar pisar selectivo" sin recurrir a un rodeo (2
escrituras: `force=true` + restaurar después con `PUT` individual los
días excluidos) — descartado como solución definitiva a pedido del
usuario, se prefiere esperar este campo. Sin acción de frontend
pendiente mientras este gap sigue abierto.

## Gap 9 — sin validación de colisión presencial entre grupos/equipos de un mismo entrenador [RESUELTO]

> **Actualización 2026-09-22 — RESUELTO, confirmado en código real del
> backend (`cmd/api/services/calendar_service.go`,
> `cmd/api/domains/calendar/presencial_{conflict,collision}.go`,
> `cmd/api/controllers/calendar_controller.go`).** Implementado tal cual
> se pidió: `409 {message, conflicts: [...]}` sin `force` posible para
> colisión cross-equipo; `same_team_warnings` (mismo shape) no bloqueante
> para colisión dentro del mismo equipo. Overlap medio-abierto (bordes que
> se tocan no colisionan) y `cancelled` excluido de la detección en ambos
> lados, ninguno de los dos pedido explícitamente pero consistente con el
> resto del guard. **Breaking real para el frontend:** `stamp`/`bulk`/
> `shift` ahora devuelven `{days: [...], same_team_warnings: [...]}` en
> vez del array crudo (`PUT` individual se mantuvo plano, con
> `same_team_warnings` opcional agregado) — pendiente de adaptar
> `services/calendar.js`/`hooks/use-group-calendar.js`/
> `stamp-plan-modal.jsx`/`bulk-edit-days-modal.jsx`/`shift-day-modal.jsx`.

Un entrenador puede administrar varios equipos, cada uno con varios
grupos. Hoy nada impide cargar dos días presenciales en la misma fecha
con horario superpuesto en dos grupos distintos — ni `PUT`/`stamp`/
`bulk`/`shift` lo detectan. Si son grupos de equipos DISTINTOS, el
entrenador termina con dos compromisos físicos simultáneos que no puede
cumplir — un problema real, no solo de datos.

**Pedido:** antes de confirmar una escritura que deja un día con
`is_presencial=true` (en cualquiera de los 4 endpoints de escritura:
`PUT /groups/{id}/calendar/{date}`, `POST /groups/{id}/calendar/stamp`,
`POST /groups/{id}/calendar/bulk`, `POST /groups/{id}/calendar/shift`),
el backend busca, entre TODOS los grupos que administra el mismo
`owner_id` (no solo el grupo de este request), si existe otro día
presencial en la misma fecha con rango horario superpuesto
(`presencial_time_from`/`presencial_time_to` cruzados).

Semántica según a quién pertenece el grupo colisionante:

- **Equipo distinto al del grupo que se está escribiendo:** rechazar
  con `409`, sin ningún `force` que lo salve (a diferencia del conflicto
  de `stamp`, acá no existe forma de forzar el guardado) —
  ```json
  HTTP 409
  {
    "message": "colisión presencial con otro equipo",
    "conflicts": [
      { "group_id": 7, "group_name": "Elite AM", "team_id": 3, "team_name": "Runners Norte",
        "date": "2026-10-05", "presencial_time_from": "08:00", "presencial_time_to": "09:30" }
    ]
  }
  ```
- **Mismo equipo que el grupo que se está escribiendo:** la escritura
  se guarda igual (no bloquea — puede ser intencional, el entrenador
  reparte su tiempo entre grupos del mismo cliente), pero la respuesta
  exitosa suma un campo opcional `same_team_warnings` con la misma forma
  que `conflicts` de arriba, para que el frontend muestre un aviso no
  bloqueante. Campo ausente u array vacío si no hay superposición.
- Aplica únicamente cuando el día escrito (o movido, en el caso de
  `shift`) queda con `is_presencial=true` — un día no presencial nunca
  puede colisionar en este sentido.
- `bulk`/`shift` corren la validación por cada fecha afectada, todo-o-
  nada igual que el guard de día cerrado existente: si CUALQUIER fecha
  del lote colisiona con un equipo distinto, se rechaza el lote entero
  con `409` listando todas las fechas conflictivas (no solo la primera).

**Impacto en frontend:** sin acción pendiente mientras este gap sigue
abierto — es la base necesaria antes de integrar cualquier manejo de
este `409`/`same_team_warnings` en los flujos de escritura existentes
(`group-calendar-day-screen.jsx`, `stamp-plan-modal.jsx`,
`bulk-edit-days-modal.jsx`, `shift-day-modal.jsx`).

## Gap 10 — endpoints livianos de "próximo entrenamiento" para los banners del home (corredor y entrenador) [RESUELTO]

> **Actualización 2026-09-22 — RESUELTO, confirmado en código real
> (`cmd/api/domains/calendar/next_session_response.go`,
> `cmd/api/services/calendar_service.go`).** Implementado tal cual el
> shape pedido: `GET /users/{id}/next-session` siempre `200`, ambos
> campos (`next_cancelled`/`next_training`) nullable de forma
> independiente; `GET /users/{id}/next-presencial-session` nuevo, `200`
> con el shape pedido o `204` si no hay ninguna. Único detalle: el
> ejemplo JSON que relayó el backend para `presencial_location` usaba
> `latitud`/`longitud`/`texto` — typo del mensaje, el campo real (y el
> que ya usa el frontend) sigue siendo `{lat, lng, label}`
> (`trainingplan.Location`, sin cambios). Sin acción de frontend
> pendiente más allá de consumir estos dos endpoints cuando se implemente
> la pieza 3 (banners del home).

Sub-proyecto de vista agregada de calendario (pieza 3, banners del
home): tanto el corredor como el entrenador necesitan un endpoint
liviano que resuma su "próximo compromiso" sin traer el detalle
completo (ejercicios, etc.) — el banner solo necesita lo justo para
mostrarse y linkear a la vista de detalle (que sí trae todo, vía
`GET /groups/{id}/calendar`). `next-session`/`calendar-summary` ya
estaban documentados en `BACKEND_CALENDAR_ASSIGNMENTS_SPEC.md` §4 pero
nunca implementados — este gap termina de cerrar su shape antes de
pedir la implementación.

**Corredor — `GET /users/{id}/next-session`, shape final:**

Un corredor puede pertenecer a varios grupos/equipos, y a diferencia
del entrenador, una colisión de horario en su calendario NO es un
problema a resolver por el backend — es su decisión a cuál sesión
asistir. Por eso este endpoint no valida nada, solo informa.

```json
200
{
  "next_cancelled": {
    "group_id": 4, "group_name": "Elite AM", "date": "2026-10-06",
    "session_name": "Fondo suave"
  },
  "next_training": {
    "group_id": 7, "group_name": "Trote libre", "date": "2026-10-09",
    "session_name": "Series de velocidad", "is_presencial": true,
    "presencial_time_from": "08:00", "presencial_time_to": "09:30",
    "presencial_location": { "lat": -34.6, "lng": -58.4, "label": "Plaza" }
  }
}
```

- `next_cancelled` y `next_training` son **independientes** — cada uno
  es el más próximo cronológicamente de su propio `kind` (`cancelled`/
  `training`) entre TODOS los grupos de los que el usuario es miembro,
  o `null` si no hay ninguno. No hace falta que uno exista para que el
  otro aparezca — pueden venir los dos, uno solo, o ninguno (los dos en
  `null`, siempre `200`, nunca `204`, para no tener que distinguir "no
  hay nada" de "hay uno de los dos" con dos códigos de status distintos).
  Motivo: un corredor puede tener su próxima sesión cancelada Y, aparte,
  una sesión real más adelante — el home debería poder mostrar ambas
  cosas (un aviso chico de "cancelado" + el banner principal del
  próximo entrenamiento real), no una sola.
- `date >= hoy`, mismo criterio de "día cerrado" ya usado en el resto
  del calendario: si `date` es hoy y es presencial, solo cuenta si
  `presencial_time_from` todavía no pasó.
- `is_presencial`/`presencial_time_from`/`presencial_time_to`/
  `presencial_location` solo aplican a `next_training` (un `training`
  asincrónico los omite/null). `next_cancelled` no los necesita — es
  solo el aviso de que había algo y se canceló.
- `session_name` en ambos, para mostrar el banner sin una segunda
  consulta.

**Entrenador — `GET /users/{id}/next-presencial-session`, endpoint nuevo:**

A diferencia del corredor, el entrenador es quien decide cancelar — no
necesita que el banner le recuerde sus propias cancelaciones. Un solo
campo alcanza: la próxima sesión presencial activa entre TODOS los
grupos que administra (`owner_id`), sin importar de qué equipo.

```json
200
{
  "group_id": 7, "group_name": "Elite AM", "team_id": 3, "team_name": "Runners Norte",
  "date": "2026-10-05", "session_name": "Fondo suave",
  "presencial_time_from": "08:00", "presencial_time_to": "09:30",
  "presencial_location": { "lat": -34.6, "lng": -58.4, "label": "Plaza" }
}
```
`204` si no hay ninguna (`kind='training'`, `is_presencial=true`,
`date >= hoy` con el mismo criterio de día cerrado de arriba) entre los
grupos que administra. `team_id`/`team_name` para poder mostrar con qué
equipo es el compromiso, dado que el entrenador puede tener varios.

**Impacto en frontend:** sin acción pendiente mientras este gap sigue
abierto — bloquea el armado de los banners del home de ambos roles
(pieza 3 del sub-proyecto de calendario agregado, todavía sin
implementar).

## Gap 11 — endpoints agregados de calendario cross-grupo (pieza 2, vista mensual de corredor/entrenador) [RESUELTO]

> **Actualización 2026-09-22 — RESUELTO, confirmado en código real
> (`cmd/api/domains/calendar/aggregate_calendar_day_response.go`,
> `cmd/api/controllers/calendar_controller.go`).** `GET
> /users/{id}/member-calendar`/`administered-calendar` implementados tal
> cual pedido — `AggregateCalendarDayResponse` embebe `CalendarDayResponse`
> completo más `group_id`/`group_name`/`team_id`/`team_name` planos.
> `administered-calendar` suma `presencial_collision` (`type`
> `same_team`/`cross_team`, `cross_team` gana si hay de ambos tipos;
> incluye colisiones viejas de antes del guard) — ausente si el día no
> colisiona. `from`/`to` obligatorios, `400` si faltan/formato
> inválido/`from > to`, `403` si `{id}` no es el propio usuario. Sin
> acción de frontend pendiente más allá de consumir estos dos endpoints
> cuando se implemente la pieza 2 (vista agregada + detalle de día).

Sub-proyecto de vista agregada de calendario (pieza 2, sección nueva
"Calendario" en el header + modal de detalle de día). Un corredor
puede ser miembro de varios grupos/equipos, y un entrenador puede
administrar varios — armar una vista mensual con TODOS sus días,
sin este endpoint, implicaría 1 `GET /groups/{id}/calendar` por cada
grupo (N+1) y mergear client-side. Se pide un endpoint agregado por
rol que devuelva todo en una sola consulta.

**Corredor — `GET /users/{id}/member-calendar?from={date}&to={date}`:**
array de `GroupCalendarDay` (mismo shape que el endpoint por grupo) de
TODOS los grupos de los que es miembro en el rango, cada item con
`group_id`/`group_name`/`team_id`/`team_name` sumados (el endpoint por
grupo no los necesita porque el caller ya sabe de qué grupo pide, este
sí — es la fuente de la vista agregada y del modal de detalle de día,
que puede tener que mostrar más de una asignación el mismo día si dos
grupos coinciden en fecha).

**Entrenador — `GET /users/{id}/administered-calendar?from={date}&to={date}`:**
mismo shape, pero de TODOS los grupos que administra (`owner_id`,
sin importar de qué equipo). Además, cada día con `is_presencial=true`
viene marcado si colisiona en horario con otro día presencial de otro
grupo administrado en la misma fecha — no solo las que el guard de
Gap 9 bloquearía (cross-equipo), sino también las de mismo equipo
(permitidas por el guard) y cualquier colisión vieja guardada antes de
que el guard existiera:

```json
{
  ...campos normales de GroupCalendarDay...,
  "group_id": 7, "group_name": "Elite AM", "team_id": 3, "team_name": "Runners Norte",
  "presencial_collision": {
    "type": "same_team",
    "conflicts": [
      { "group_id": 9, "group_name": "Elite PM", "team_id": 3, "team_name": "Runners Norte",
        "presencial_time_from": "08:30", "presencial_time_to": "10:00" }
    ]
  }
}
```
`presencial_collision` ausente/`null` si no colisiona con nada. `type`
es `"same_team"` o `"cross_team"` (este último no debería aparecer en
datos nuevos gracias al guard de Gap 9, pero sí puede aparecer en datos
viejos ya guardados antes de que el guard existiera — la vista agregada
es también la forma de detectar y limpiar esos casos).

**Impacto en frontend:** sin acción pendiente mientras este gap sigue
abierto — bloquea la vista agregada de calendario (pieza 2) para ambos
roles, todavía sin implementar.

## Gap 12 — persistencia de la actividad realizada + historial (registro en vivo)

Sin resolver, sin endpoints todavía. El nuevo módulo de registro de actividad en vivo (ver
`docs/superpowers/specs/2026-09-23-live-session-base-design.md`) va a necesitar, cuando se
construya la interfaz real (fuera del alcance de esa spec, que solo cubre la navegación hasta la
pantalla previa al inicio):

- Un endpoint para persistir la actividad finalizada de un `GroupCalendarDay`: por ejercicio y por
  serie, estado (`completado`/`skippeado`/`terminado`), tiempos, y puntos GPS tomados en background
  (para reconstruir el recorrido). El registro se arma primero en almacenamiento local nativo
  durante la sesión (para no depender de conectividad mientras corre) y se sube recién al
  finalizar.
- Endpoints de historial multiplataforma: listar actividades finalizadas, ver el detalle de una,
  editar valores puntuales (tiempos, distancias), eliminar una actividad.

**Impacto en frontend:** sin acción pendiente mientras este gap sigue abierto — bloquea el guardado
real y el historial del módulo de registro en vivo, todavía sin implementar (la base de navegación
sí está resuelta, ver spec citada arriba).

> **Actualización 2026-09-27 — primer bullet RESUELTO, distinto de lo previsto.** El compañero que
> encaró el registro de actividad en vivo implementó la persistencia con un modelo normalizado
> (`workout_feedback` — una fila por serie/set, no un blob por actividad como se había anotado
> arriba): `POST /workout-feedback` (crear), `PUT /workout-feedback/:id` (editar tiempos/distancia),
> `POST /workout-feedback/:id/points` + `GET /workout-feedback/:id/points` (puntos GPS de una
> serie), `GET /session-instances/:id/feedback?athlete_user_id=` (feedback de una sesión puntual).
> Ver `services/workoutFeedback.js`, `services/runnerSession.js`,
> `services/normalizers.js#toSessionFeedbackModel` para el shape exacto ya consumido por el
> frontend. El segundo bullet (historial multiplataforma: listar/filtrar/paginar) sigue sin
> resolver — el endpoint de sesión puntual de arriba no alcanza para eso (no cruza equipos/grupos,
> no filtra por rango de fechas ni por corredor/ejercicio, no pagina). Se abre como Gap 13 propio,
> con el contrato concreto que hace falta.

## Gap 13 — endpoints de historial de entrenamientos realizados (piezas 2/3 del sub-proyecto de calendario)

**[RESUELTO 2026-09-27, PR #84 del backend hacia `develop`].** Contrato final, confirmado contra
el swagger real (`docs/FRONTEND_IMPACTO_INSTANCIACION.md` §9 del repo backend) — reemplaza el
borrador de abajo en los puntos donde difiere:

- **`exercise_id` (filtro) y `available_exercises` matchean por FAMILIA de catálogo, no por
  instancia** — este es el único punto donde el contrato final difiere del borrador original (se
  pidió el ajuste tras revisar que, sin esto, la misma "Trote" hecha en sesiones distintas
  aparecía duplicada N veces en el dropdown de segundo nivel). `available_exercises[].id` =
  `catalog_exercise_id` (fallback al id de instancia solo para instancias legado sin origen de
  catálogo). Al filtrar con ese `id`, el backend matchea TODAS las instancias de ese ejercicio de
  catálogo — sigue siendo grid granular (una fila por serie), sin sumarizar nada; el filtro
  simplemente amplía el `WHERE`. Cada ítem de `items` sigue trayendo `exercise_id` (id de
  instancia, por fila) y además `catalog_exercise_id` (nullable, para agrupar client-side si hace
  falta).
- Huérfanos (día de calendario borrado, instancia sin equipo, sesión/ejercicio ya no existente):
  se conservan las filas con `group_id`/`team_id`/`session_name`/`exercise_name`/
  `catalog_exercise_id` en `null`, nunca se excluyen.
- Todos los campos de cada ítem del contrato de abajo se devuelven siempre (nunca omitidos,
  nullable cuando corresponde) — sin cambios respecto al borrador en esto.
- Validaciones de error (`400`/`403`/`404`) confirmadas tal cual el borrador de abajo las pedía.
- `GET /workout-feedback/search` (endpoint de una sesión puntual, Gap 12) sigue vivo sin cambios —
  no hace falta migrarlo.
- Sumarización sigue sin existir del lado del servidor (decisión ya tomada, ver abajo) — queda
  100% client-side sobre `items`, sin agregados reales por ahora.

Resto del contrato (query params, shape de response, semántica de `available_athletes`/
`available_exercises` sobre filtros de primer nivel únicamente) queda tal cual el borrador
original documentado abajo.

**Adenda 2026-09-27 — acción de fila (menú de 3 puntitos, eliminar + ir a revisión):** al diseñar
esta parte surgieron dos necesidades más, no cubiertas por el contrato de arriba:

1. **`session_instance_id` por ítem — RESUELTO 2026-09-27.** Presente en ambos endpoints (int64,
   siempre >0). Para la pantalla de revisión: `GET /session-instances/{session_instance_id}/feedback`
   con el `athlete_user_id` del ítem. Si la instancia fue borrada físicamente (día reasignado
   después), el id sigue viniendo pero esa request da `404` — esperado, el feedback se conserva
   por diseño aunque la instancia no.
2. **`DELETE /workout-feedback/{id}` — YA EXISTÍA, confirmado 2026-09-27.** Ruta real
   `DELETE /api/v1/workout-feedback/:id` (`url_mappings.go:209`), autorización en `SoftDelete`
   (atleta dueño, o reportante, o owner del team del feedback → exactamente el criterio que pide
   el frontend), 403/404 correctos, baja lógica (no física). Sin acción pendiente acá.

**Adenda 2026-09-27 (2) — rango de fechas abierto: DESCARTADO por ahora, mejora futura.** Se
había pedido aceptar `date_from`/`date_to` de forma independiente (uno solo = rango abierto).
Decisión del usuario: mantener el comportamiento actual (ambos campos de a par, `400` si viene
uno solo) — mantener simple, backend ya estable con Gap 13. Sin acción pendiente sobre el
backend. Queda anotado junto a otras mejoras futuras del historial (sumarización, agrupación
visual) para una eventual ronda conjunta más adelante.

Backend real de `workout_feedback` ya existe (Gap 12, resuelto) pero solo permite
consultar **una sesión puntual a la vez** (`GET /session-instances/:id/feedback`). El historial
(corredor y entrenador, ver `docs/superpowers/specs/2026-09-26-trainings-tabs-shell-design.md` y
la pestaña "Historial" que quedó en stub) necesita una consulta **cruzada** (todas las
sesiones/equipos/grupos en un rango) con filtros, orden y paginación — mismo tipo de brecha que
ya resolvió Gap 11 para el calendario agregado (`member-calendar`/`administered-calendar`), acá
aplicado a `workout_feedback` en vez de `GroupCalendarDay`.

**Decisión ya tomada con el usuario:** sin sumarización server-side por ahora (ni client-side
real tampoco) — se anota como mejora futura, no bloquea esta pieza. El frontend puede como mucho
agrupar visualmente filas ya traídas (por ejercicio o por corredor) sin calcular agregados
(promedios/sumas), pero eso no requiere nada del backend.

**Corredor — `GET /users/{id}/workout-feedback-history`**, `{id}` = propio usuario autenticado
(403 si no coincide, mismo criterio que `member-calendar`).

Query params:
- `team_id`, `group_id` (opcionales, `group_id` requiere `team_id`).
- `date_from`, `date_to` (opcionales, iguales = un solo día).
- `exercise_id`, `set_number` (opcionales — segundo nivel de filtro).
- `sort` (`feedback_date` | `set_number` | `exercise_name`, default `feedback_date`), `order`
  (`asc`|`desc`, default `desc` — más recientes primero).
- `page` (default 1), `page_size` (default 20, tope sugerido 100).

Sin filtros: los N más recientes del corredor en TODOS sus equipos/grupos (mismo criterio que
"fetchear N datos más recientes" del pedido original).

**Entrenador — `GET /users/{id}/administered-workout-feedback-history`**, `{id}` = propio usuario
autenticado, **`team_id` obligatorio** (403 si el `id` no administra ese equipo) — sin team_id,
`400`.

Query params: mismos que arriba (`group_id`, `date_from`/`date_to`, `exercise_id`/`set_number`,
`sort`/`order`, `page`/`page_size`) más `athlete_user_id` (segundo nivel de filtro, opcional).

**Response, ambos endpoints:**

```json
200
{
  "items": [
    {
      "id": 501, "athlete_user_id": 12, "athlete_name": "Juan Pérez",
      "team_id": 3, "team_name": "Runners Norte", "group_id": 7, "group_name": "Elite AM",
      "date": "2026-09-25", "session_name": "Series de velocidad",
      "exercise_id": 44, "exercise_name": "Series 400m", "set_number": 2,
      "completion_status": "completed", "duration_ms": 95000, "active_duration_ms": 90000,
      "distance_meters": 412.5, "started_at": "2026-09-25T08:15:00Z", "ended_at": "2026-09-25T08:16:35Z"
    }
  ],
  "total": 137,
  "page": 1,
  "page_size": 20,
  "available_athletes": [{ "id": 12, "name": "Juan Pérez" }],
  "available_exercises": [{ "id": 44, "name": "Series 400m" }]
}
```

- `athlete_name`/`athlete_user_id` en la respuesta del corredor son redundantes (siempre el mismo
  usuario) pero se devuelven igual — mismo shape para las dos vistas, sin ternarios de campos
  opcionales en el frontend.
- `available_athletes`/`available_exercises`: **distinct** de TODO el resultado que matchea los
  filtros de primer nivel (equipo/grupo/rango de fechas), **sin** aplicar todavía el filtro de
  segundo nivel (corredor/ejercicio) ni la paginación — así el dropdown de segundo nivel no pierde
  opciones a medida que el usuario lo va usando. Esto es lo que resuelve "pool de corredores/
  ejercicios según los resultados a priori" del pedido original sin depender de qué página esté
  cargada en el cliente.
- `400` si falta `date_from`/`date_to` cuando se manda solo uno de los dos, o si `date_from >
  date_to`. `group_id` sin `team_id` → `400` (aplica a ambos endpoints, aunque en el de entrenador
  `team_id` ya es obligatorio de por sí).

**Impacto en frontend:** sin acción pendiente mientras este gap sigue abierto — bloquea el
contenido real de la pestaña "Historial" en ambos roles (hoy stub, `trainings-history-tab.jsx`).

## Gap 14 — GET /session-instances/{id} standalone (hand-off historial → pantalla de revisión)

**[RESUELTO 2026-09-27].** Surgió al construir el menú "Ver/editar registro" del historial (Gap
13): la pantalla de revisión existente (`session-review-screen.jsx`) necesita el objeto completo
de la instancia de sesión (`sessionInstance.exercises`) para renderizar, pero una fila del
historial solo trae `session_instance_id` — los demás puntos de entrada a esa pantalla (calendario,
pre-start) ya traían el objeto completo en memoria desde los datos del día.

`GET /api/v1/session-instances/{id}` — mismo shape que ya embebe el calendario (Gap 9/11):
`{ id, session_id, name, description, created_at, exercises: [{ id, name, role, repeat_count,
rest_minutes, exercise_id }] }`. Autorización dual: miembro activo del grupo del día con esa
instancia u owner del equipo, O feedback activo sobre la instancia como atleta/reportante/owner
del equipo. `403` en otro caso, `404` si la instancia fue borrada físicamente.

Frontend: `services/sessionInstances.js#getSessionInstance`, `hooks/use-session-instance.js`,
consumido por `session-review-screen.jsx#ReviewFlow` (fetch solo si `slot.sessionInstance` no vino
ya en memoria — el resto de los flujos existentes no cambia).

## Gap 15 — `membership_fee` no viene en el listado de búsqueda ni en las invitaciones [RESUELTO]

**Actualización 2026-10-09 — RESUELTO, mergeado a `develop` del backend y corriendo en stage
local.** `membership_fee` agregado a `TeamSearchResult` (`GET /teams/search`) y a las respuestas
de invitación — es la fee VIGENTE del equipo (puede cambiar después; lo único congelado sigue
siendo `init_amount` al momento de pagar, sin cambios ahí). **Pendiente de frontend:** borrar
`hooks/use-team-fees.js` y leer el precio directo del listado/invitación, sin el fan-out de
`useQueries` contra `['team', id]` por equipo.

Detectado al cablear el pago de membresía de equipo
(`docs/superpowers/specs/2026-09-26-team-subscription-join-payment-design.md`). El requisito de
producto es que el corredor vea la cuota **justo donde decide unirse**: en la tarjeta de la búsqueda
pública, al lado del botón de unirse, y en la invitación dentro de la app. Pero:

- `TeamSearchResult` (`GET /teams/search`) devuelve `level`/`location`/`member_count`/`max_members`/
  `owner_name`/`icon_url`/`is_public` — **sin `membership_fee`**.
- `InvitationResponse` (`GET /invitations`) devuelve `team_id`/`team_name` — **sin `membership_fee`**
  (mismo tipo de hueco que el `group_name` del Gap 9).

`GET /teams/{id}` sí lo devuelve y lo puede leer cualquier autenticado, así que el frontend resuelve
el precio con un fetch por equipo (`hooks/use-team-fees.js`, `useQueries` sobre la key `['team', id]`
que ya usa `useTeam`, así el fetch se comparte y se cachea). Funciona, pero son hasta 20 requests
extra por página de búsqueda.

**Pedido:** agregar `membership_fee` a los dos DTOs. **Impacto en frontend cuando exista:** se borra
`hooks/use-team-fees.js` y el precio sale del listado directo, sin fan-out.

## Gap 16 — `POST /payments/preference` colapsa todos sus errores a 500 [RESUELTO]

**Actualización 2026-10-09 — RESUELTO, mergeado a `develop` del backend y corriendo en stage
local.** Ahora devuelve errores reales: `409` con `code: "SELLER_NOT_CONNECTED"` en el body JSON
(mismo patrón de `error.data` que ya usamos con `utils/mp-connect-messages.js`; incluye también el
caso "trainer conectado pero sin public key", mensaje de reconectar), `404` equipo/cuota
inexistente, `400` datos inválidos; cualquier otro error sigue `500` genérico (se descartó un 502
explícito, no aporta nada distinto del lado UI). **Pendiente de frontend:** reemplazar el mensaje
vago fijo de `team-subscription-screen.jsx` (`components/team/team-subscription-screen.jsx:106-117`)
por un branch sobre `error.status`/`error.data?.code`, mapeando `SELLER_NOT_CONNECTED` a un mensaje
concreto en vez del genérico "puede que el equipo todavía no esté listo para cobrar".

`payment_controller.go` respondía `500 "Error al crear la preferencia"` para **cualquier** fallo del
service. En particular, cuando el entrenador del equipo no conectó su cuenta de Mercado Pago, el
service devuelve `SELLER_NOT_CONNECTED` (`"el entrenador debe conectar su cuenta de Mercado Pago"`)
y su propia documentación (`docs/CU/02-pago-participacion-equipo.md`) promete un **409** — pero el
409 nunca llega al cliente. Confirmado en la práctica contra el backend local el 2026-09-26: con un
entrenador sin MP conectado, `POST /payments/preference` responde 500 con el mensaje genérico.

**Impacto en frontend:** no se puede decirle al corredor por qué falló. La pantalla de pago muestra
un mensaje deliberadamente vago ("puede que el equipo todavía no esté listo para cobrar") en vez de
afirmar una causa que no podemos verificar. **Pedido:** propagar el código/status real.

## Gap 17 — no hay forma de saber si un entrenador *ajeno* tiene Mercado Pago conectado [RESUELTO]

**Actualización 2026-10-09 — RESUELTO, mergeado a `develop` del backend y corriendo en stage
local.** `can_receive_payments` (bool) agregado a TODAS las respuestas de equipo (`GET
/teams/search`, el GetAll de pantalla, `GetByID`, `Create`, `Update`, `UpdateAddress`) y también a
`InvitationResponse` (pedido explícitamente para simetría con `membership_fee` del Gap 15 — unirse
por invitación es la otra vía de entrar a un equipo, misma necesidad de avisar antes). Derivado
server-side; si el lookup de MP falla devuelve `false` honesto, nunca bloquea la respuesta.
**Pendiente de frontend:** mostrar el aviso antes de unirse/pagar — todavía sin UI que lo consuma
(ni en `team-search-screen.jsx`, ni en la pantalla de invitaciones), queda para cuando se retome
esta pantalla.

`GET /mercadopago/connect/status` es self-only: saca el usuario del JWT y no acepta `user_id` ni
`team_id`. `TeamResponse`/`TeamSearchResult` tampoco exponen nada sobre la conexión del dueño.

Así que un corredor no puede saber, antes de intentar pagar, si el equipo al que se unió puede
cobrarle — se entera cuando falla la creación de la preferencia (y encima sin poder distinguir la
causa, ver Gap 16). Agrava que el requisito de MP conectado para activar el rol entrenador es
**enforcement solo de UI**: un cliente viejo o una llamada directa a la API pueden dejar un
entrenador activo sin MP, así que el caso es real, no teórico.

**Pedido:** un flag de "puede recibir pagos" en el payload del equipo (o en el de búsqueda), para
poder avisar antes de que el corredor se una a un equipo que no va a poder cobrarle.

## Gap 18 — gateway WebSocket genérico + broadcast de eventos de sesión

Pedido de infraestructura de tiempo real, mismo patrón que Gap 13/14 (contrato deseado, backend
confirma o ajusta) — ver
`docs/superpowers/specs/2026-09-28-presencial-live-session-transport-runner-design.md` para el
diseño completo del lado frontend.

- Gateway WebSocket genérico (`/ws`), autenticado por JWT en query param (`?token=`), con soporte
  de `subscribe`/`unsubscribe` por canal string arbitrario y reenvío de mensajes `presence`/
  `control` a los demás suscriptores del mismo canal, aplicando la autorización que ya existe para
  el recurso que el canal nombra (para `session:{id}`, la misma regla de "atleta asignado o
  entrenador/owner del equipo" que ya protege los endpoints REST de esa sesión).
- Al persistir vía `POST /workout-feedback` (creación de una serie ya terminada/salteada/
  interrumpida), backend emite además un mensaje `update:set_event` al canal
  `session:{sessionInstanceId}` correspondiente con el mismo payload persistido +
  `athleteUserId` — puramente informativo, no cambia la respuesta HTTP existente.
  `POST /workout-feedback/:id/points` no necesita broadcast propio.
- Heartbeat: servidor espera `ping` cada 20-30s, cierra conexiones inactivas más allá de eso (a
  confirmar el valor exacto con backend según límites de Render).

**Impacto en frontend:** sin acción pendiente mientras este gap sigue abierto — bloquea la
posición en vivo y el feed casi-en-vivo de registros de la spec 2 (pantalla del entrenador). El
cliente corredor de esta spec (piezas transporte + corredor) funciona igual sin este gap resuelto,
salvo que sus mensajes `presence`/`control` no llegan a ningún destinatario real todavía.

## Gap 19 — `runner_session` necesita un tercer estado `interrupted` (cancelar ≠ nunca empezó)

Detectado probando cancelación en la sesión presencial en vivo (2026-09-30), pero el problema es
preexistente y compartido con la sesión asíncrona — `cancelRun` (`services/session-db.js`) ya
existe y se usa igual en ambas pantallas.

Hoy `runner_session` solo tiene dos estados (`wip`/`finished`, ver `POST`/`PATCH
/session-instances/:id/runner`). Cancelar una sesión a mitad de camino (botón "mantener para
cancelar") marca el run **local** como `cancelled` (con su `ended_at`), pero no tiene ningún
reflejo remoto — el `runner_session` del atleta se queda en `wip` para siempre. Consecuencias:

- Desde otro dispositivo (o tras reinstalar la app / perder la DB local), la sesión cancelada
  sigue apareciendo como si nunca se hubiera empezado — Play vuelve a estar disponible y se puede
  rejugar desde cero, aunque ya haya series completadas y sincronizadas.
- El entrenador (pantalla de la spec 2) no tiene forma de distinguir "todavía no empezó" de
  "empezó y la cortó a mitad de camino" — ambos casos se ven como `wip` sin más contexto.

**Concepto correcto (confirmado con el usuario, 2026-09-30):** cancelar una sesión en curso es
**terminarla de forma temprana**, no "deshacerla" — el feedback de las series ya hechas hasta ese
punto debe quedar guardado tal cual (esto YA funciona: `syncRun` sube lo que llegó a
completarse/saltearse antes de la cancelación), y el estado final de la sesión debe reflejar que
se cortó antes de tiempo, en qué momento, y que NO está disponible para volver a intentarse.

**Pedido:** un tercer valor de `status` para `runner_session`, `interrupted` (o el nombre que el
backend prefiera), aceptado por el mismo `PATCH /session-instances/:id/runner` que ya recibe
`{status: 'finished'}` — idealmente con la misma idempotencia y con un guard de transición
análogo al que ya existe para `finished` (nunca debería poder "bajarse" de `finished` a
`interrupted`, y una vez `interrupted` tampoco debería poder pasar a `finished` sin una acción
explícita nueva). El `end_date` que ya maneja el servidor para `finished` aplicaría igual acá.

**Impacto en frontend, una vez resuelto:** el frontend ya calcula el momento de cancelación
localmente (`cancelRun` guarda `ended_at`) — solo falta que `cancelSession()`
(`hooks/use-live-session-runtime.js`) y el `handleCancelConfirmed` de la sesión asíncrona llamen a
este nuevo status en vez de dejar el `runner_session` remoto en `wip`, y que el pre-start trate
`interrupted` igual que `finished` para el gate de Play/Registro (ambas pantallas comparten esa
lógica en `session-pre-start-screen.jsx`). Sin este gap resuelto, el frontend puede en el
mientras tanto aplicar un bloqueo solo-local (mismo dispositivo) sin esperar al backend, pero
queda fuera de esta rama a pedido del usuario -- por ahora cancelar sigue permitiendo rejugar la
sesión, igual que ya pasa hoy en la asíncrona.

## Gap 20 — RESUELTO (2026-10-01): contrato real del bus de tiempo real para el cliente entrenador

Las 3 asunciones de este gap se confirmaron leyendo el backend local
(`cmd/api/realtime/protocol.go`, `notifier.go`, `docs/REALTIME_WS.md`) durante una ronda de
bugfixing en dispositivo real — **dos de las tres asunciones originales eran incorrectas**, y el
código del entrenador (Task 7) las tenía mal, en silencio (sin error, sin romper nada, pero sin
atribuir ningún mensaje a nadie). Ya corregido en frontend:

1. **`from` es un número plano (`"from":12`), NUNCA un objeto `{userId, role}`.** Confirmado contra
   `outboundMessage.From int64` y el ejemplo de `docs/REALTIME_WS.md`
   (`{"type":"presence","from":12,"payload":{...}}`). `utils/trainer-participant-state.js` leía
   `msg.from?.userId`, que para un número siempre da `undefined` -- el reducer ignoraba el 100% de
   los mensajes `presence` de cualquier corredor. Corregido a `String(msg.from)`.
2. **El tipo de `update:set_event` es el STRING LITERAL `"update:set_event"`**, no `type:"update"` +
   un campo `event:"set_event"` separados. Confirmado contra `UpdateSetEventType = TypeUpdate + ":"
   + EventSetEvent` y el ejemplo de la doc. `hooks/use-trainer-session-runtime.js` chequeaba
   `msg.type === 'update' && msg.event === 'set_event'`, que nunca matcheaba -- los registros de
   series de un corredor nunca llegaban al feed en vivo del entrenador.
3. **El feedback real viaja en `data.data`, no en `payload`.** El campo del frame es `data` (no
   `payload`) y contiene el `MutationResponse` completo del endpoint HTTP (`{message, data}`) --
   `data.data` es el DTO de feedback (`athlete_user_id`, etc.), confirmado contra
   `MarshalUpdateSetEvent`/`workout_feedback_controller.go` y el ejemplo de la doc. Casing es
   siempre snake_case (nunca camelCase) -- el fallback defensivo de leer ambas variantes se
   eliminó, ya no hace falta.

**`GET /session-instances/:id/feedback` sin `?athlete_user_id=` (si devuelve todos los atletas)
sigue sin confirmar** -- el fan-out de `useQueries` (Task 7) sigue siendo el camino, sin cambios.

## Gap 21 — RESUELTO en frontend (2026-10-02): `event` y `channel` no sobreviven el relay de presence/control

Encontrado con logs reales de dispositivo (bloques `[realtime] recibido canal=undefined
type=presence event=undefined from=N` de ambos lados, corredor y entrenador) tras el fix del Gap
20 -- `from` ya se parseaba bien, pero `presence`/`control` seguían sin atribuirse a nadie.
Confirmado leyendo `cmd/api/realtime/protocol.go` y `connection.go`:

1. **`clientMessage` (decode de lo que manda el cliente) solo tiene `Type`/`Channel`/`Payload`.**
   Cualquier otro campo de nivel raíz que el frontend mande (`event`, `to`, `ts`) lo descarta el
   propio `json.Unmarshal` de Go al no existir ese campo en el struct -- se pierde ANTES de llegar
   siquiera al Hub.
2. **El relay server→cliente arma el frame saliente con solo `{type, from, payload}`**
   (`connection.go#apply`: `&outboundMessage{Type: msg.Type, From: sc.userID, Payload: msg.Payload}`)
   -- nunca incluye `channel` (a diferencia de `update:set_event`, que sí lo trae). Confirma el
   ejemplo de `docs/REALTIME_WS.md` (`{"type":"presence","from":12,"payload":{...}}`, sin
   `channel` ahí tampoco).

**Consecuencia:** el diseño original del frontend (spec 2026-09-28) ponía `event` como hermano de
`payload` a nivel raíz del frame (`{type, channel, event, payload}`) -- ese campo nunca sobrevivía
ni la ida (se descarta al decodificar en el servidor) ni la vuelta (el relay no lo reconstruye).
`presence`/`control` llegaban con type/from intactos pero sin ninguna otra información útil --
"No se unió" para TODOS los corredores en TODAS las condiciones, sin importar los fixes de `from`.

**Fix en frontend, sin tocar el backend** (`services/realtime-client.js`):
- `send()` ahora pliega `event` DENTRO de `payload` antes de mandar (`{event, ...payloadReal}`) --
  `payload` es el único campo que el backend retransmite intacto (opaco, nunca lo toca).
- `dispatchMessage()` deshace el pliegue al recibir (saca `event` de `payload`, lo vuelve a exponer
  como `msg.event` de nivel raíz) para que el resto del código (reducers) no tenga que saber de
  este detalle del wire format.
- Cuando el servidor no manda `channel` (presence/control), se resuelve a la única suscripción
  activa de la conexión (`subscribedChannels`, tamaño 1 -- el caso real de esta app hoy, una sesión
  en vivo a la vez). Con más de un canal activo simultáneo el mensaje queda sin destino resoluble y
  se descarta (no se adivina a cuál pertenece) -- documentado para cuando se agregue multi-canal
  real a futuro.

**Posible mejora futura del lado backend** (no urgente, no bloquea nada hoy): si el gateway alguna
vez necesita soportar más de un canal activo simultáneo por conexión, el relay de presence/control
va a necesitar empezar a incluir `channel` en el frame saliente (mismo criterio que ya usa
`update:set_event`) -- la resolución por "única suscripción" deja de alcanzar ahí.

## Gap 22 — un 409 en `POST /workout-feedback` nunca dispara `update:set_event` (ni aunque el valor cambie)

No es un bug, es consecuencia directa de "Solo Create emite" (`docs/REALTIME_WS.md` §5) + el índice
único `unique_feedback_per_set` -- documentado acá porque generó confusión real probando en vivo:
repetir la MISMA sesión/atleta/ejercicio/serie entre varios intentos de prueba (cada uno con un
`run` local nuevo, ya que el `run` es puramente local a SQLite) siempre pega contra la fila que ya
existe del lado del backend (la unicidad es por `assigned_session_id` + `exercise_instance_id` +
`athlete_user_id` + `set_number`, ninguno de los cuales depende del `run` local) → 409 → `syncRun`
lo marca `synced` y sigue (`services/session-sync.js`, sin PATCH de respaldo acá, a diferencia del
flujo manual de la pantalla de revisión) → ningún evento en vivo para el entrenador, aunque el
corredor haya "completado la serie" en su pantalla. **No hay nada que arreglar en el cliente** --
para probar el feed en vivo de punta a punta hace falta una sesión/atleta/ejercicio que nunca se
haya sincronizado antes contra ese backend, o resetear la base entre pruebas. Si a futuro se
quisiera que una actualización (PATCH) también notifique en vivo, es un cambio de backend (el
`Notifier.Emit` del controller solo se dispara en el branch de `Create`).

## Gap 23 — `GET /users?ids=` (batch lookup) no trae `photo_url` [RESUELTO]

**Actualización 2026-10-09 — RESUELTO, confirmado por backend contra swagger actual.** `GET
/users?ids=` y `GET /users/search` ya incluyen `photo_url` (nullable). Si en la práctica algún
corredor sigue viéndose con iniciales en el mapa/listas del entrenador, ya no es por falta del
campo -- revisar el fallback de imagen solo para 404s reales (URL rota), no asumir que el dato no
llega. Sin acción de frontend pendiente -- `hooks/use-team-roster.js` ya estaba listo para
consumirlo sin cambios.


El roster de equipo/grupo (`hooks/use-team-roster.js`, usado por la pantalla en vivo del
entrenador para los marcadores/listas con foto+color) resuelve nombre vía
`batchLookupUsers`/`GET /users?ids=1,2,3`. Confirmado leyendo el backend
(`cmd/api/domains/user/batch_lookup_response.go` + `search_response.go`): `BatchLookupResponse`
tiene el mismo shape que `SearchResultItem` --

```go
type SearchResultItem struct {
	UserID  int64  `json:"user_id"`
	Name    string `json:"name"`
	Surname string `json:"surname"`
	Email   string `json:"email"`
}
```

-- **sin `photo_url`**, a propósito (el propio comentario del endpoint dice "resuelve nombre/
apellido/email", nunca mencionó foto). No es un bug ni un problema de permisos del lado del
frontend -- el dato simplemente no está en esta respuesta. Por eso un corredor con foto de perfil
real sigue viéndose con iniciales en el mapa/listas del entrenador: `photoUrl` cae a `null` siempre
para cualquier roster resuelto por este camino.

**Pedido concreto para backend:** agregar `photo_url` (puede ser `""`/`null` si no tiene) a
`SearchResultItem`/`BatchLookupResponse`. Es un campo más en un struct ya existente, sin impacto en
otros consumidores de `GET /users?ids=` que ya ignoran campos nuevos. Frontend ya está listo para
consumirlo apenas aparezca (`photoUrl: user.photo_url ?? null` en `hooks/use-team-roster.js`, sin
cambios necesarios ahí).

## Gap 24 — `WorkoutFeedbackResponse` tampoco trae `exercise_name` (ya resuelto client-side)

Mismo tipo de ausencia que el Gap 23 pero sin pedido de cambio -- el feedback de una serie
(`POST`/`GET /workout-feedback`) solo trae `assigned_exercise_id`, nunca un nombre. El feed en vivo
del entrenador (`hooks/use-trainer-session-runtime.js`) lo resuelve contra la lista de ejercicios
de la sesión (`utils/trainer-participant-progress.js#exerciseNameById`, ya disponible en memoria,
sin request extra) -- documentado acá solo para que quien toque este código de nuevo no asuma que
`exercise_name` puede llegar algún día del lado de `workout_feedback` y lo lea directo del DTO.

## Gap 25 — asistencia en vivo (`GET /attendance/session/{id}`) no refleja a todos los corredores sin confirmar [RESUELTO]

**Actualización 2026-10-09 — RESUELTO, confirmado por backend.** Era la hipótesis 1: la ventana de
membresía ahora compara por FECHA (no por timestamp) -- corredores con alta el mismo día de la
sesión ya aparecen en el roster y son elegibles para registrar asistencia. Mergeado en PR #93 del
backend. Sin acción de frontend pendiente.

Detectado probando la asistencia durante una sesión presencial en vivo (2026-10-03): con 3
corredores del grupo, el modal mostró "1 confirmada, 0 sin confirmar" cuando en realidad faltaban
2 por confirmar (deberían haber aparecido como `not_confirmed`).

**Confirmado del lado frontend (no es diffing ni filtro local):** `useSessionAttendance`
(`hooks/use-attendance.js`) y `AttendanceSessionModal` (consumidor durante la sesión en vivo, vía
`trainer-session-live-screen.jsx`) muestran `summary.attended`/`summary.not_confirmed` y la lista
`roster` **tal cual los devuelve el backend**, sin ningún cálculo ni reconciliación contra el
roster del equipo/grupo (`use-team-roster.js`) de por medio -- `AttendanceMetricCards` solo hace
`toCount(summary?.attended)`/`toCount(summary?.not_confirmed)`, sin aritmética propia. Si faltan
corredores en "sin confirmar", es porque `roster`/`summary` del response ya vienen así.

**Dos hipótesis, ninguna descartada todavía:**
1. **Backend:** la resolución de "miembros con membresía activa en la fecha de la sesión"
   (comentario propio del endpoint, `services/attendance.js`) no está trayendo bien a esos 2
   corredores -- posible bug de join/rango de fechas en el query real.
2. **Frontend, a verificar antes de pedir cambio de backend:** confirmar que
   `AttendanceSessionModal` le pasa a `useSessionAttendance` el `teamId`/`groupId`/
   `sessionInstanceId` correctos de la sesión en vivo (no un id resuelto mal desde
   `pendingSession`/`sessionInstanceId`) -- un id equivocado también produciría un roster
   incompleto sin que sea un bug de backend.

**Pedido concreto para backend (si la hipótesis 1 se confirma):** revisar la query de
`GET /attendance/session/{session_instance_id}` que arma `roster`/`summary.not_confirmed` --
debería incluir TODOS los miembros con membresía activa en la fecha de la sesión, no solo los que
ya tienen alguna fila de asistencia. Antes de encarar el fix, reproducir contra el backend local
con un caso controlado (grupo con N miembros, 1 solo confirmado) y loguear el response crudo para
confirmar cuál de las dos hipótesis es la real.

## Gap 26 — sesión presencial controlada por el entrenador (apertura/cierre), no solo por franja horaria [RESUELTO]

Mejora futura (roadmap, no se empieza sin confirmación explícita, ver conversación 2026-10-03) --
documentada ahora para que el backend pueda ir evaluando el alcance en paralelo.

**Idea:** hoy la sesión presencial "vive" dentro de su franja horaria (`presencial_time_from`/
`presencial_time_to`) sin importar si el entrenador presionó Play -- cada corredor se une de forma
independiente con su propio Play. El cambio propuesto da control real al entrenador: los
corredores llegan al pre-start (que pasa a actuar como sala de espera) pero solo pueden unirse
**entre** el momento en que el entrenador abre la sesión (su Play) y el momento en que la cierra
(su slide-to-finish) -- el entrenador puede abrir/cerrar antes o después de la franja planificada,
la franja queda como guía, no como regla dura.

**Piezas que tocarían backend:**
- Un concepto de "sesión abierta/cerrada" del lado del servidor (hoy el `control:session_finished`
  que ya manda el entrenador es solo un mensaje de WebSocket efímero, sin persistencia -- si un
  corredor se conecta después de que el entrenador cerró, hoy no hay forma de que el backend se lo
  diga de entrada, sin depender de que el WS siga vivo).
- Posiblemente un campo de estado en `session_instance` o similar (`open`/`closed`,
  `opened_at`/`closed_at`) para que un corredor que recién abre el pre-start sepa si puede unirse
  sin depender de haber estado conectado por WS en el momento exacto en que el entrenador abrió.
- Validaciones de advertencia (no bloqueantes) ya resueltas 100% client-side: avisar al entrenador
  si abre/cierra con más de 15 minutos de diferencia respecto a la franja planificada, y si cierra
  habiendo corredores en vivo sin completar todo -- no requieren nada nuevo de backend, se resuelven
  con los datos que el entrenador ya tiene en pantalla (franja del día + estado de participantes).

**Impacto en frontend:** sin acción pendiente -- esto es roadmap, no entra en esta rama todavía.
Documentado para que el backend pueda pensar el modelo de "sesión abierta/cerrada" mientras se
cierran primero los gaps de WS ya abiertos (26-28) y la base de la versión actual.

**Actualización 2026-10-04 -- backend implementó el gate ANTES de que el frontend hiciera el resto
del roadmap, y eso rompió el flujo existente (regresión real, no un gap nuevo).** El backend
resolvió Gap 26 completo del lado servidor (apertura/cierre persistido en `group_calendar_day`,
`presencial_open`/`opened_at`/`closed_at` en `GET /session-instances/:id`, 409
`session_not_opened`/`session_closed` en `POST .../runner` del no-owner, `update:session_state` por
WS) -- pero el frontend nunca llegó a construir la sala de espera ni ningún aviso para el corredor,
porque esa parte quedó marcada "roadmap, no entra en esta rama todavía" más arriba. El gate del
backend aplica igual, sin que el frontend lo supiera: el Play del ENTRENADOR nunca llamaba a
`POST /session-instances/:id/runner` (no tiene SQLite propio, nunca necesitó ese endpoint antes de
Gap 26) -- o sea que ninguna sesión presencial se "abría" nunca, y el primer `POST .../runner` de
CUALQUIER corredor (su propio Play) caía siempre en 409 `session_not_opened`. Sin esa apertura,
`syncRun` corta en el primer paso (`create_runner_session`) y nunca llega a mandar ni una sola
serie -- esto rompía el registro completo del corredor (ni feed en vivo del entrenador, ni
"Registro de Sesión" con datos al revisar después), no solo el caso de cancelación que se estaba
probando cuando se encontró.

**Fix ya aplicado en frontend (sin esperar el resto del roadmap):** el Play del entrenador
(`trainer-session-pre-start-screen.jsx`) ahora llama `createRunnerSession(sessionInstanceId)` (self,
sin `athleteUserId` -- el owner autenticado) antes de navegar, abriendo la sesión igual que
describía la opción (a) ya acordada. El slide-to-finish (`finalize()` en
`hooks/use-trainer-session-runtime.js`) ahora también llama `finishRunnerSession(sessionInstanceId)`
(self) además del `control:session_finished` por WS que ya mandaba, para que `closed_at` quede
seteado. Ninguna de las dos espera su resultado para bloquear la navegación (el entrenador no tiene
cola de reintento local si falla, así que solo se loguea).

**Actualización 2026-10-04 (2) -- Gap 26 completo, incluida la sala de espera del corredor y la
confirmación del entrenador.** Ya no queda roadmap pendiente de este gap:

- **Sala de espera (`session-pre-start-screen.jsx`):** mientras el corredor no arrancó nada (ni
  `runner_session` remoto `wip`, ni un run local `in_progress` -- alguien que ya estaba corriendo
  antes de un cierre queda exento, es resumir, no un ingreso nuevo), se hace polling cada 5s a
  `GET /session-instances/:id` (`hooks/use-session-instance.js`, nuevo parámetro opcional
  `refetchInterval`, mismo criterio que `AttendanceSessionModal`) para leer `openedAt`/`closedAt`
  (`services/normalizers.js#toSessionInstanceModel`, 3 campos nuevos). `openedAt` null → "Sala de
  espera"; `closedAt` seteado sin haber arrancado nunca → mensaje de sesión ya cerrada sin Play (caso
  límite, sin alternativa de carga manual por ahora); ninguno de los dos → Play normal. Sin WS acá
  todavía (mismo tipo de mejora futura que Gap 28 para asistencia -- `update:session_state` ya existe
  del lado del backend, el polling es la versión simple antes de cablear el evento).
- **Confirmación al finalizar (`trainer-session-live-screen.jsx`):** el slide-to-finish ya no cierra
  directo -- `utils/trainer-participant-state.js#unfinishedParticipants` calcula quién se presentó
  (`status !== NOT_JOINED`) y no quedó en un estado terminal (ni `COMPLETED` ni `INTERRUPTED`,
  incluye conectado/en curso/pausado/desconectado-sin-terminar). Si hay alguno, un modal
  (`ConfirmDestructiveModal` reusado) lista los nombres antes de confirmar; cancelar devuelve el
  thumb del slider a su posición inicial (`DragToFinishButton` pasó a `forwardRef` con un `reset()`
  imperativo).

## Gap 27 — mensajería en sesión en vivo: persistencia + evento liviano de aviso [RESUELTO]

**Actualización 2026-10-09 (2) — RESUELTO, mergeado a `develop` del backend y corriendo en stage
local.** Contrato final confirmado (rama backend `feature/tiers-fees-pagos-y-mensajeria`):

- `POST /api/v1/session-instances/{id}/messages` → `201` con el mensaje creado completo: `{id,
  session_instance_id, sender_user_id, sender_role, type, recipient_mode, recipient_user_ids,
  body, reply_to_message_id, created_at}` (`recipient_user_ids: []` cuando `recipient_mode: all`).
  `body` trim no vacío, tope 2000 caracteres. `reply_to_message_id`, si viene, debe ser `>0`, existir,
  ser de la misma sesión y visible para el emisor — cualquiera de las 4 violaciones (inexistente,
  otra sesión, no visible, `<=0`) da `400` (`ErrSessionMessageInvalid`, body `{code:"Bad request",
  message:"..."}`, mensaje específico por caso). Destinatarios duplicados en `recipient_user_ids` →
  `400`. Destinatario que no es participante de la sesión → `400` (distinto del 403 de abajo: este
  es "tenés acceso pero nombraste a alguien que no está en la tabla").
- `GET /api/v1/session-instances/{id}/messages?since=<messageId>` → `{"messages": [...]}` (objeto
  envolvente, no array crudo — ojo al normalizar), id ASC, sin paginación (`since` omitido o `0` =
  desde el primero). Visibilidad aplicada server-side: ves lo tuyo, lo `all`, y lo que tengas en
  `recipient_user_ids` — un DM corredor-corredor no lo ve el entrenador, sin caso especial.
- **Autorización (POST y GET, idéntica para los dos):** `404` primero si `session_instance_id` no
  existe. `403` (`code:"Forbidden"`, message `"no autorizado"`) si la instancia existe pero el
  usuario autenticado no tiene acceso a ELLA — mismo guard dual que ya protege `POST
  /workout-feedback` y `GET /session-instances/{id}` (miembro activo del grupo, owner del team, o
  atleta/reportante con feedback activo). El `sender_user_id` siempre sale del token — nunca hay un
  403 por "intentar mandar siendo otro", eso no es un vector posible acá. Con acceso confirmado, el
  usuario SIEMPRE puede escribir; todo lo de contenido/destinatarios/reply cae en `400`, nunca `403`.
- Al persistir, el backend emite al canal `session:{id}`: `{"type":"control:message_created",
  "channel":"session:{id}","payload":{"sessionMessageId":N}}` — literal único (no `type:"control"`
  + `event` separado), igual que `update:set_event`. Sin contenido, confirma la nota de privacidad
  de abajo.
- Sin edición ni borrado (fuera de alcance, ver spec).

**Pendiente de frontend:** arrancar la implementación en `feature/live-session-messaging` sobre la
spec ya aprobada (`docs/superpowers/specs/2026-10-09-live-session-messaging-design.md`) — era lo
único que bloqueaba este gap, ya resuelto.

---

**Actualización 2026-10-09 (1) — de roadmap a pedido concreto (histórico, superado por la
actualización de arriba).** Spec de frontend ya escrita:
`docs/superpowers/specs/2026-10-09-live-session-messaging-design.md` (branch
`feature/live-session-messaging`, implementación todavía no arrancada). El diseño descartó
resolver esto ampliando el relay de WS genérico (lo que pedía la versión anterior de este gap,
abajo como referencia histórica) -- en cambio el WS no lleva contenido, solo avisa "hay algo
nuevo, pedilo por REST". Esto evita pedirle al backend un cambio de alcance mayor al gateway
genérico (filtrado por destinatario a nivel de conexión), aprovechando que la privacidad de un
mensaje dirigido ya la puede aplicar el backend en el mismo lugar que aplica cualquier filtro de
autorización: una query REST autenticada.

**Pedido concreto:**

1. Tabla nueva `session_messages` (nombre sugerido, backend ajusta si prefiere): `id`,
   `session_instance_id`, `sender_user_id`, `sender_role` (`trainer`|`runner`), `type`
   (`info`|`aviso`|`alerta`), `recipient_mode` (`all`|`multiple`|`direct`), `recipient_user_ids`
   (array o tabla join -- decisión interna de backend, no cambia el contrato que ve el frontend),
   `body`, `reply_to_message_id` (nullable, FK a otro `session_messages.id`), `created_at`.
2. `POST /session-instances/:id/messages` -- body `{type, recipient_mode, recipient_user_ids,
   body, reply_to_message_id}`. `403` si el emisor no es participante de esa sesión (misma regla
   de autorización que ya protege el resto de los endpoints de la sesión).
3. `GET /session-instances/:id/messages?since=<id>` -- devuelve los mensajes visibles para el
   usuario autenticado posteriores a `since` (omitido o `0` = todo el historial). Visibilidad: un
   usuario ve un mensaje si es el emisor, O `recipient_mode = 'all'`, O su `userId` está en
   `recipient_user_ids` -- el backend filtra, el frontend no vuelve a filtrar nada.
4. Al persistir un `POST` exitoso, el backend reenvía por el canal `session:{id}` (ya existente,
   Gap 18) un `control: message_created` con payload mínimo `{sessionMessageId}` -- SIN contenido,
   a propósito (ver nota de privacidad abajo). Mismo patrón ya usado para `update:set_event`.

**Nota de privacidad, por qué el aviso de WS no lleva contenido:** confirmado en Gap 21, el relay
actual reenvía `presence`/`control` a TODOS los suscriptores del canal sin filtrar por
destinatario. Mandar el cuerpo de un mensaje privado (ej. un DM corredor-a-corredor) por ese canal
rompería su privacidad apenas hubiera un tercer suscriptor conectado. Por eso el WS solo avisa
"revisá" -- el contenido siempre sale del `GET` autenticado del punto 3, que es el único lugar que
aplica el filtro de verdad.

**Impacto en frontend (histórico, ya resuelto — ver actualización 2026-10-09 (2) arriba):** este
bloqueo ya no aplica.

---

<details>
<summary>Versión anterior de este gap (roadmap, antes de la spec de 2026-10-09) -- dejada como referencia histórica, ya no vigente</summary>

Mejora futura (roadmap, no se empieza sin confirmación explícita) -- necesaria para el próximo
feature de "el entrenador manda mensajes (info/advertencia/alerta/crítico) a todos los corredores
de la sesión o a uno puntual."

El gateway actual (Gap 18, ya implementado) retransmite `presence`/`control` a **todos** los
suscriptores del canal -- no hay forma de dirigir un mensaje a un `userId` puntual. Además,
confirmado en Gap 21: ningún campo fuera de `type`/`channel`/`payload` sobrevive el relay (ni
`to`, aunque el frontend ya lo manda hoy para `control:session_finished` con `to:'all'` -- ese
valor nunca se usa realmente del lado servidor, es decorativo). Para mensajería dirigida hace
falta:

- Que el relay del backend respete un `to` (userId) dentro de `payload` (mismo patrón que ya usa
  `event`, plegado adentro del payload opaco) y entregue el mensaje SOLO a esa conexión, en vez de
  a todos los suscriptores del canal.
- Definir si un mensaje de severidad alta (`crítico`/`alerta`) necesita persistencia -- hoy todo el
  bus es fire-and-forget (si el corredor no está conectado en ese instante, el mensaje se pierde
  para siempre, sin reintentos ni cola). Si un mensaje crítico necesita llegar aunque el corredor
  esté momentáneamente desconectado, hace falta algún mecanismo de persistencia/entrega diferida
  (ej. guardar el mensaje y reenviarlo si el corredor se reconecta durante la sesión, o degradar a
  una notificación push si ya existe infraestructura de push -- a definir con backend).

Resuelto en el diseño final (ver pedido concreto arriba): no se necesita tocar el relay genérico ni
decidir persistencia especial por severidad -- todo mensaje persiste igual en `session_messages`
(no solo los críticos), y el WS nunca lleva contenido, así que el problema de "filtrar por
destinatario en el relay" no llega a existir.

</details>

## Gap 28 — sin evento de WebSocket para asistencia registrada (QR o manual) [RESUELTO del lado backend, pendiente de cablear en frontend]

**Actualización 2026-10-09 — backend RESUELTO, confirmado.** El backend emite
`update:attendance_event` al canal `session:{id}` en los 3 casos: alta por QR (`source:"qr"`, SOLO
si se creó -- el `200` idempotente de un QR repetido no emite nada), carga manual (UN evento por
corredor creado O actualizado, `source:"manual"`), y borrado (fila de baja: `status:"not_confirmed"`,
resto de campos `null`). El payload es exactamente la fila de la grilla: `{user_id, status, source,
registered_at, attendance_id}`. No excluye al emisor (si el propio entrenador carga manualmente,
también le llega su propio evento).

**Pendiente en frontend:** reemplazar el `refetchInterval: 6000` de `AttendanceSessionModal` (vía
`useSessionAttendance`) por un listener del evento en el canal de la sesión ya suscripto (mismo
patrón que `update:set_event`, Gap 18) -- al recibirlo, invalidar/refetchear la query de asistencia
en vez de esperar el próximo tick del polling. Mapa de resolución entre backend-dicho (`Gap
28`) y cómo cablearlo: ver `hooks/use-trainer-session-runtime.js`'s `handleChannelMessage` existente
como referencia del dispatch pattern ya usado para `update:set_event`.

## Gap 29 — reemplazar los selects anidados de país/provincia/localidad por `LocationPicker` en registro y equipos: guardar lat/lng, definir representación de país/provincia [RESUELTO]

**Contexto.** Hoy registro de usuario (`register-screen.jsx`), edición de perfil
(`edit-profile-screen.jsx`) y creación/edición de equipo (`create-team-screen.jsx`/
`edit-team-screen.jsx`) capturan la dirección con 3 `<select>` en cascada (país → provincia →
localidad, `hooks/use-address-cascade.js`) sobre un dataset hardcodeado en el frontend
(`data/locations.js`) + inputs de texto libre para calle/altura (solo usuario, equipos no los
tiene). El usuario pidió reemplazar esto por `LocationPicker` (mapa + buscador de dirección, ya
usado para la ubicación de sesiones presenciales) en los 4 forms — más preciso, y en su defecto
(cuando el geocoder no resuelve bien) se puede buscar por dirección en el picker en vez de tipear a
mano. `LocationPicker` ya devuelve, además de `lat`/`lng`, un desglose de Nominatim (calle, altura,
localidad, provincia, país — ver `services/geocoding.js`, agregado en esta misma rama para mejorar
el resumen visual del picker).

**Lo que falta para que esto sea sostenible, no solo un cambio de UI:**

1. **Guardar `lat`/`lng`.** Ni `users` ni `teams` tienen columnas para esto hoy — el frontend
   calcula el pin pero no hay dónde persistirlo. Sin esto, cada vez que se necesite el punto exacto
   (mapas, "equipos cerca de mí" a futuro) hay que re-geocodificar la dirección guardada, con el
   riesgo de que no dé el mismo punto. Propuesta: `lat double precision null`, `lng double
   precision null` en ambas tablas, devueltos en `GET`/aceptados en `POST`/`PUT` igual que
   `country`/`province`/`city` hoy.

2. **Decidir qué pasa con `country`/`province` — esto es lo que más importa confirmar antes de
   tocar la UI de los 4 forms.** Revisando el código: hoy esos campos NO son texto libre del lado
   del frontend — `country` manda el código ISO-3 interno (`"ARG"`, de `data/locations.js`, no el
   nombre) y `province` manda un id interno de 2-3 letras (`"BA"`, `"CABA"`, etc.), ambos de un
   dataset hardcodeado en el cliente. `city` sí es más libre (nombre desde un dataset por
   provincia). El picker nuevo, en cambio, resuelve estos 3 campos desde Nominatim como **nombre
   legible** (`"Argentina"`, `"Buenos Aires"`, no códigos) — un formato distinto al que hoy vive en
   la base.

   **Decidido (2026-10-11) — opción (a), confirmado contra backend.** El backend no valida
   `country`/`province` contra ningún enum (acepta cualquier string) — el único acoplamiento real
   es el filtro exacto de `GET /teams/search` (`teams.country = ?`). Con eso confirmado: **el
   frontend sigue mandando los códigos internos de `data/locations.js`** (resueltos a partir del
   nombre que devuelve Nominatim), **el backend solo suma `lat`/`lng`** — sin backfill, cero riesgo
   para el search existente. Se descarta la opción (b) (migrar todo a nombre legible) por ahora:
   suma backfill + mapa de traducción server-side + tocar el buscador, sin beneficio claro hoy.
   Caso borde aceptado: si el nombre de Nominatim no matchea ninguna fila del dataset interno (ej.
   variante de escritura), esa fila puntual queda con el nombre crudo en vez del código — formato
   mixto aislado, no afecta al resto.

   Con esto resuelto, el reemplazo de los 4 forms queda habilitado para arrancar: cada confirmación
   del picker necesita, además de `lat`/`lng`/`label`, resolver `addressLines`/`province`/`country`
   (ya vienen como nombre de `services/geocoding.js`) contra `COUNTRIES`/`PROVINCES` de
   `data/locations.js` para obtener el código a mandar — función nueva a sumar ahí mismo (algo como
   `resolveCountryCode(name)`/`resolveProvinceCode(countryCode, name)`, con fallback al nombre crudo
   si no hay match, según lo aceptado arriba).

3. **Equipos no tienen `street`/`number` hoy** (solo usuarios) — se decidió NO sumarlos junto con
   esto (el backend no los mencionó al cerrar el punto 1, y el picker ya resuelve calle/altura solo
   para usuarios sin que haga falta tocar equipos). Queda abierto para una decisión futura aparte si
   hace falta.

**Resuelto (2026-10-11).** Backend entregó el punto 1 (`lat`/`lng` aditivo y nullable en
usuario/equipo, charset de dirección relajado para nombres de Nominatim) en la rama
`latlng-optimizaciones-y-endurecimiento`. Con eso, se completó el swap de los 4 forms
(`register-screen.jsx`, `edit-profile-screen.jsx`, `create-team-screen.jsx`/`edit-team-screen.jsx`
vía `team-general-info-fields.jsx` compartido) de los selects en cascada a `LocationPicker`
(variante `card`). Piezas nuevas: `utils/location-to-address-fields.js` (picker → payload, resuelve
nombre→código vía `resolveCountryCode`/`resolveProvinceCode` de `data/locations.js`),
`utils/address-fields-to-location.js` (inverso, para precargar el picker al editar) +
`hasLegacyAddressWithoutCoordinates`/`formatLegacyAddressLabel` para las filas existentes sin
`lat`/`lng` (sin backfill) — no se inventa un punto en el mapa para esas filas: se muestra la
dirección guardada como texto informativo y el picker arranca vacío, listo para precisarla la
próxima vez que se edite. `edit-profile-screen.jsx` necesitó un flag `locationTouched` aparte (no
alcanza con `locationValue === null`, que también es el resultado de un "Quitar ubicación"
deliberado) porque `toUpdatePayload` manda el set completo y sin eso un simple cambio de nombre
hubiera borrado la dirección existente; `toAddressPayload` (equipos) ya omite campos vacíos por su
cuenta, así que ese caso no necesitó el mismo tracking.

## Gap 30 — módulo de gamificación: rachas del corredor (cálculo server-side, dos métricas independientes)

**Contexto.** Primer bloque del módulo de gamificación (rachas, logros/trofeos, leaderboards,
competencias — doc fuente: prompt maestro de gamificación compartido por el usuario, 2026-10-12).
Dos rachas por usuario (no por equipo), suman entrenamientos en **todos** sus equipos, calculadas
sobre `runner_session`/calendario ya existentes. El frontend nunca recalcula ni lleva contador
local — solo consulta y muestra.

- **Racha A (constancia estricta):** días de calendario consecutivos donde **todas** las sesiones
  asignadas (`GroupCalendarDay.kind='training'`) de ese día terminaron con `runner_session.status
  = 'finished'` (series salteadas no importan — alivianado a propósito, decisión del usuario
  2026-10-12: la racha premia terminar, no la perfección). Días `rest`/`other`/`cancelled`, o sin
  fila asignada, se **saltan** (no cuentan ni cortan). Cualquier día con sesión training que no
  haya quedado `finished` (incluye `interrupted`, Gap 19, o nunca iniciada) corta la racha a 0.
- **Racha B (constancia flexible):** días consecutivos con **al menos una** sesión `finished` ese
  día. Cualquier día sin ninguna completada (incluye `rest`/`other`/`cancelled`/sin sesión/hoy sin
  entrenar todavía) corta a 0.
- Ambas devuelven: racha actual, mejor racha histórica (récord personal), e historial de estado
  por día (`completed`/`failed`/`skipped`) para los últimos N días.

**Pedido concreto** (shapes en snake_case, como el resto de los DTOs del backend — ver
`services/normalizers.js`, que ya convierte todo a camelCase del lado cliente):

1. `GET /users/{id}/streaks` (nombre a criterio de backend) → `{strict: {current, best},
   flexible: {current, best}, days: [{date, strict_status, flexible_status}, ...]}`, con `days`
   parametrizable (`?days=42`, default a definir) y "día" = fecha date-only del
   `GroupCalendarDay`, agnóstico a zona horaria (no una ventana relativa de 24h). `strict_status`/
   `flexible_status` son un enum nuevo (`completed`/`failed`/`skipped`) — no existen hoy, los
   introduce este gap.
2. Cálculo y persistencia 100% server-side, recalculado en cada mutación relevante:
   `runner_session.status` pasa a `finished`/`interrupted` (únicos 3 valores reales hoy, junto con
   el implícito `wip` inicial — ver `services/runnerSession.js`), un día de calendario se cancela
   (`kind='cancelled'`), o cambia de `kind` (`training`/`rest`/`other`/`cancelled`, enum ya
   existente en `GroupCalendarDay`, sin variantes) estando ya en el pasado.
3. El logro con nivel "Entrenamientos Consecutivos" (Gap 31) comparte la misma noción de racha A —
   backend decide si reusa este mismo cálculo internamente o lo deriva aparte.

**Actualización 2026-10-13 — consenso con backend, habilita trabajo en paralelo:**

1. **"Hoy" en la racha actual — confirmado (a):** el cálculo corre hasta **ayer** inclusive; hoy
   nunca corta por sí solo. El día de hoy aparece en `days` con un cuarto estado, `pending` (no
   `completed`/`failed`/`skipped`), hasta que termine. La racha recién se corta si el día ya
   cerrado no se cumplió — evita el falso positivo de "racha rota" mientras el corredor todavía
   tiene el día por delante. `?days=42` confirmado como default.
2. **Persistencia — confirmado cálculo bajo demanda en cada `GET`,** sin tabla de rachas ni
   recálculo disparado por mutación. El resultado observable es idéntico (lectura exacta por
   construcción) y evita el riesgo de deriva entre una tabla cacheada y la realidad — se retira el
   punto 2 original de este gap ("recalculado en cada mutación") como requisito; no lo era.

## Gap 31 — módulo de gamificación: logros con niveles, logros únicos, logros contador y vitrina de estampas/trofeos

**Contexto.** Catálogo 100% server-side — el frontend no hardcodea logros ni progreso. Tres
familias excluyentes: **únicos** (se desbloquean una vez, sin nivel), **con niveles** (5 niveles
fijos con nombre propio — Chispa/Fuego/Imparable/Máquina/Leyenda — que no se pierden al dejar de
cumplirse la condición), y **contador** (cada ocurrencia suma una estampa, sin nivel). Post-Leyenda
el contador sigue creciendo y cada N ocurrencias extra por encima del umbral máximo otorga un
**trofeo acumulable**. Los umbrales de cada nivel ya están confirmados por el usuario (tabla
completa en el doc fuente — ej. "Entrenamientos Consecutivos": 5/10/20/40/100) pero tienen que
vivir como config/seed en backend, no en el cliente.

**Pedido concreto** (shapes en snake_case):

1. `GET /achievements/catalog` → config, no cambia por usuario: `{id, family:
   'once'|'leveled'|'counter', name, description, icon_key, once_threshold? (family=once), levels?:
   [{level, name, threshold}] (family=leveled, 5 niveles con nombre), counter_trophy_every? (N de
   ocurrencias extra por encima del umbral máximo, o N del contador si la familia es counter sin
   nivel)}`.
2. `GET /users/{id}/achievements` → progreso real: `{achievement_id, current_level? (leveled),
   count, unlocked_at, last_unlocked_at}` — **corrección 2026-10-14, antes de empezar el frontend
   de este gap:** `count` tiene que viajar SIEMPRE, también para `family=leveled`, no solo para
   `counter`. El doc fuente pide una barra de progreso al siguiente nivel ("barra/porcentaje de
   progreso al siguiente nivel si aplica") — sin el contador crudo detrás del nivel actual, el
   frontend no tiene con qué calcular ese porcentaje (`count / levels[nextLevel].threshold`), solo
   podría mostrar el nivel ya alcanzado. Es el mismo contador interno que ya hace subir de nivel,
   así que no debería ser trabajo nuevo del lado backend, solo no omitirlo cuando la familia es
   `leveled`.
3. `GET /users/{id}/stamps` → estampas y trofeos emitidos, entidad transversal (sección "estampas y
   trofeos" del doc fuente): `{id, type: 'achievement_counter'|'post_legend'|'competition',
   source_id, source_name, icon_key, granted_at, count}` — ver punto 4 de la actualización de abajo
   sobre por qué `icon_key` y no `logo_url`.
4. Marcador de "novedad por ver" → mecanismo transversal, ver Gap 34 (no uno aparte por logro).
5. Recalculado en cada mutación relevante (sesión finalizada, racha actualizada — Gap 30 —,
   competencia ganada — Gap 33). Depende de datos que ya existen: `runner_session`,
   `workout_feedback` (`distance_meters`/`duration_ms`/`active_duration_ms` — confirmado que hoy no
   persiste pace/velocidad, solo distancia y duración), asistencia, rachas.
6. **Push notifications:** el payload de push ya viaja con `data.route` para deep-link
   (`hooks/use-push-notifications.js`) — si el backend ya dispara pushes, confirmar que pueda
   emitir uno al desbloquear un logro/trofeo con `data.route` apuntando a la sección de Logros
   (el frontend ya sabe navegar con ese campo, no hace falta infraestructura nueva de ese lado).

**Actualización 2026-10-13 — consenso con backend, habilita trabajo en paralelo:**

3. Catálogo como constants seeded en Go vs. tabla + seed idempotente: decisión 100% backend, sin
   impacto en el contrato que consume el frontend — sin objeción.
4. **`icon_key` en vez de `logo_url` — confirmado.** Las vitrinas las dibuja la app (assets del
   bundle, mismo patrón que `components/plans/exercise-kind-meta.js`); no hace falta URL de
   storage. El shape de `GET /users/{id}/stamps` del punto 3 arriba queda con `icon_key` en vez de
   `logo_url` (ya corregido ahí). Si una estampa de competencia en el futuro quisiera mostrar el
   ícono del equipo en vez de uno genérico, el frontend ya tiene el `team_id` por otro lado — no
   hace falta un campo de imagen en la estampa para eso.
5. **Push confirmado** para: logro desbloqueado, trofeo otorgado, y (ver Gap 33) competencia
   aprobada/rechazada/ganada. `data.route` propuesto — **a confirmar con el valor real recién
   cuando la ruta exista** (las pantallas de este módulo todavía no están construidas), pero como
   referencia de formato esperado: `/achievements` para logros/trofeos/rachas (hub único con
   pestañas internas), `/teams/{team_id}/competitions/{competition_id}` para eventos de una
   competencia puntual. Si el backend necesita el valor antes de que el frontend tenga las rutas
   listas, usar un placeholder (`/achievements`, sin query) — es un string libre, de bajo costo
   ajustar después.

## Gap 32 — módulo de gamificación: leaderboards por equipo (métricas, períodos, récords históricos)

**Contexto.** Ranking por equipo (alcanza a corredores de cualquier grupo + entrenador viendo sin
fila propia), server-side, recalculado bajo demanda (no tiempo real). Sin esto no es viable
agregar client-side el historial completo de un equipo por período.

**Pedido concreto** (shapes en snake_case):

1. `GET /teams/{id}/leaderboard?metric=distance|duration|pace|peak_speed|sessions_count|attendance_count&period=week|month|year|custom|all&from=&to=`
   → `{rows: [{user_id, name, avatar_url, value, rank}], viewer_rank: {user_id, value, rank} |
   null, record?: {user_id, name, value, achieved_at}}`. `rows` = top 5. `viewer_rank` = posición
   del usuario autenticado aunque no esté en el top 5 (`null` si el viewer es entrenador, que no
   participa). `record` solo con `period=all` (histórico = récord del equipo para esa métrica).
2. **Desempate:** a igual valor, gana quien usó **menos entrenamientos** para alcanzarlo — se
   resuelve server-side, el frontend no reimplementa el criterio.
3. Métricas dependientes de GPS (`pace`, `peak_speed`) solo tienen datos reales en sesiones con
   tracking real (presenciales en vivo, Gap 20 — `utils/distance.js#acceptGpsLeg` calcula
   velocidad instantánea solo para filtrar ruido, hoy no la persiste como métrica). **Pregunta
   para backend:** ¿las sesiones asíncronas también generan puntos GPS utilizables para estas dos
   métricas, o quedan `null`/excluidas de esas dos métricas para ese tipo de sesión? Si la
   respuesta es sí, confirmar también si `pace`/`peak_speed` se van a empezar a persistir en
   `workout_feedback` (hoy solo tiene `distance_meters`) o se calculan aparte para el leaderboard.

**Actualización 2026-10-13 — consenso con backend, habilita trabajo en paralelo:**

6. **Confirmado desde el frontend:** hoy las sesiones asíncronas **no suben puntos GPS** — el
   tracking en vivo (`acceptGpsLeg`, `training-session-active-screen.jsx`) solo corre en
   presenciales en vivo (Gap 20); una sesión asíncrona se completa con feedback manual/editado,
   sin captura de GPS. Esto es comportamiento actual de frontend, no una limitación de la tabla de
   `workout_feedback_point` del lado backend (que sí la soporta por feedback sin importar el tipo
   de sesión, según confirma backend). Conclusión: `pace`/`peak_speed` quedan **excluidas para
   sesiones asíncronas** por ahora (el usuario que solo entrena async ve esas dos métricas sin
   datos, nunca en 0) — reabrir si alguna vez se suma tracking a sesiones asíncronas.
7. **Definiciones confirmadas:**
   - `distance` = suma de `distance_meters` del período.
   - `duration` = suma de `duration_ms` (reloj total de la sesión, **no** `active_duration_ms`) —
     elegido porque es lo que el corredor ya ve en su propio historial; tiempo pausado incluido,
     sin segunda definición de "duración" compitiendo en la UI.
   - `pace` = ritmo agregado del período en **min/km**, calculado como
     `suma(duration_ms) / suma(distance_meters)` del período completo — **no** el promedio de los
     ritmos por sesión, para no desvirtuar el resultado con sesiones muy cortas. Menor valor =
     mejor ritmo.
   - `peak_speed` = velocidad máxima en km/h, el máximo entre los máximos por sesión del período
     (de ahí la sugerencia del punto 8 de persistir un máximo por sesión en vez de rebarrer puntos
     crudos en cada consulta).
   - `sessions_count` = cantidad de `runner_session` en `finished`, acotadas a sesiones de grupos
     de ese equipo, en el período.
   - `attendance_count` = filas de asistencia confirmadas (QR o manual) de ese equipo, en el
     período.
   - Ninguna métrica adicional por ahora — "mejor racha del período"/"constancia" quedan como
     futuro explícito, ya señalado así en el doc fuente, no hace falta agregarlas a esta primera
     versión.
8. **Persistir `pace`/`peak_speed` en `workout_feedback`** (2 columnas nullable, calculadas al
   recibir los points): sin objeción — es decisión interna de backend, no cambia el contrato de
   `GET /teams/{id}/leaderboard`.
9. **Desempate — criterio confirmado:** cantidad de entrenamientos **que contribuyeron al valor**
   de esa métrica en el período (ej. para `distance`/`duration`/`pace`/`peak_speed`: sesiones
   `finished` con `workout_feedback` registrado; para `sessions_count` el desempate no aplica —
   mismo valor implica mismo conteo). Para `attendance_count`, al no ser "entrenamientos" sino
   filas de asistencia, el criterio análogo queda a elección de backend entre "menos asistencias
   usadas para llegar al valor" o "quién llegó primero a ese valor" — el frontend no tiene
   preferencia fuerte ahí, cualquiera de las dos es un desempate razonable.
10. **Corrección 2026-10-14, antes de empezar el frontend de este gap — encoding exacto de
    `value`.** El punto 7 fija la unidad de cada métrica en prosa (min/km, km/h) pero no el
    encoding JSON — necesario para que el frontend formatee sin adivinar. `value` (en `rows[]`,
    `viewer_rank` y `record`) es siempre un **número plano**, nunca un string formateado, en la
    unidad que corresponda: `distance` → metros (entero), `duration` → milisegundos (entero,
    mismo criterio que `duration_ms` en el resto de la API), `pace` → **minutos por km, decimal**
    (ej. `5.4167` para un ritmo de 5:25/km — `(duration_ms/60000) / (distance_meters/1000)`),
    `peak_speed` → km/h (decimal), `sessions_count`/`attendance_count` → entero. El frontend
    formatea cada unidad a texto legible (`mm:ss/km` para `pace`, etc.) — el backend nunca manda
    el string ya formateado.

## Gap 33 — módulo de gamificación: competencias entre corredores (CRUD, aprobación, cierre automático, trayectoria en mapa)

**Contexto.** Desafíos dentro de un equipo (todos-contra-todos por defecto, 1v1 o N,
cross-grupo o acotado a un grupo). El entrenador crea directo; el corredor propone y queda
pendiente de aprobación del entrenador. El entrenador nunca participa. Dos tipos: **por métrica**
en una ventana de tiempo, o **por trayectoria** dibujada en el mapa (el que la corre pasa por
pre-start → en vivo → resultado, igual que un entrenamiento). Gana quien maximice la métrica o
complete mejor la trayectoria; el ganador se calcula automático y recibe un trofeo (Gap 31).

**Pedido concreto** (shapes en snake_case):

1. **Modelo** `competition`: `{id, name, team_id, group_id?, type: 'metric'|'route', metric?
   (type=metric), start_at, end_at? (type=metric), route? (GeoJSON LineString, type=route),
   acceptance_radius_meters? (type=route), participant_user_ids: [], created_by_user_id,
   created_by_role: 'trainer'|'runner', status:
   'pending_approval'|'active'|'finished'|'rejected'|'cancelled', approved_by_user_id?,
   rejection_reason?, winner_user_id?, finished_at?}`. Definido 100% por backend — el frontend
   consume este shape, no lo diseña. (`status='cancelled'` sumado en la actualización de abajo —
   ver punto 13. `name` sumado en la corrección del punto 16, abajo.)
2. `POST /teams/{id}/competitions` → crea. `created_by_role='runner'` → `status='pending_approval'`;
   `trainer` → `status='active'` directo.
3. `PATCH /competitions/{id}/approve` / `/reject` (solo entrenador del equipo) — `reject` con body
   `{reason?}`. Notifica al creador el resultado.
4. `GET /teams/{id}/competitions?status=&group_id=` → listado (filtro por grupo para "iniciar desde
   las opciones de un grupo").
5. `GET /competitions/{id}` → detalle + progreso en vivo por participante (valor actual de la
   métrica, o % de trayectoria completada).
6. **Cierre automático:** backend decide si usa job programado por fecha o evaluación a demanda al
   consultar — el frontend es agnóstico, solo necesita que `status`/`winner_user_id` reflejen el
   estado real al pedirlo.
7. **Verificación de ruta** (`type='route'`): matching de los puntos GPS del intento contra la
   polilínea, con `acceptance_radius_meters`, resultado = `% de coincidencia` + métrica lograda
   (tiempo/velocidad). **Pregunta para backend:** ¿se resuelve server-side (recomendado — mismo
   criterio que leaderboards: no es viable mandar el historial completo a comparar client-side) o
   el frontend manda los puntos crudos y el backend hace el match bajo demanda?
8. Al cerrar con ganador: emite trofeo (`stamps` del Gap 31, `type='competition'`) + dispara los
   logros relacionados (participar/ganar, general y por tipo).
9. **WS:** si la trayectoria se corre como una `runner_session` normal, reusar el canal
   `session:{id}` ya existente (Gap 18/20) para el progreso en vivo, con el mismo formato de
   envelope `{type, channel, payload}` y `type` en el estilo colon-separado ya usado
   (`update:set_event`, `control:message_created`) — ej. `update:competition_progress` /
   `control:competition_finished`, payload mínimo (solo IDs, no contenido — mismo criterio de
   privacidad del Gap 27). No se pide canal nuevo.
10. Los intentos cuentan solo entrenamientos completados **dentro de la app** (mismo criterio que
    rachas/logros). **Pregunta para backend:** ¿la asociación entrenamiento↔competencia se hace
    con un `competition_id` explícito en `runner_session`, o se infiere por rango de fecha +
    participante + equipo/grupo?
11. **Push notifications:** igual que Gap 31 — si el backend ya dispara pushes, que "competencia
    ganada"/"competencia aprobada" use `data.route` para que el frontend navegue directo al
    detalle de la competencia sin infraestructura nueva.

**Actualización 2026-10-13 — consenso con backend, habilita trabajo en paralelo:**

10. **Confirmado — `competition_id` explícito.** Campo nullable en `runner_session`, mandado por
    el frontend en `POST /session-instances/{id}/runner` cuando el Play arranca desde una
    competencia (si no viene, es una sesión normal). Evita la inferencia frágil por rango de
    fecha + participante cuando dos competencias se solapan en el tiempo para el mismo corredor.
11. **Confirmado — verificación de ruta 100% server-side:** matching Haversine de los puntos del
    intento contra el `route` (GeoJSON LineString) + `acceptance_radius_meters`, resultado
    `% de coincidencia` + tiempo/velocidad lograda. El frontend solo manda la ruta objetivo una
    vez, al crear la competencia, y sube los puntos GPS del intento con el mecanismo ya existente
    (sesión en vivo normal, con `competition_id` seteado).
12. **Tie-break y umbral mínimo de ruta — decidido:** a igual `% de coincidencia`, gana menor
    tiempo (confirmado). **Sin umbral mínimo de coincidencia** — se descarta un piso tipo "70%"
    porque no estaba en el diseño original y agrega un parámetro configurable sin necesidad clara:
    gana quien tenga el `%` más alto entre los que completaron un intento, sea alto o bajo. Único
    caso sin ganador: **cero intentos finalizados** contra esa competencia → `status='finished'`,
    `winner_user_id=null`.
13. **Cancelación — confirmado por backend, se suma al contrato:** el corredor puede cancelar su
    propia propuesta en `pending_approval`, y el creador de una competencia (cualquier rol) puede
    cancelar la suya ya activa. Nuevo endpoint `PATCH /competitions/{id}/cancel` → `status=
    'cancelled'` (agregado al enum del modelo, punto 1 arriba). Además, confirmado: quien crea una
    competencia puede excluirse a sí mismo de la lista de participantes al crearla (relevante para
    un entrenador que arranque el flujo — aunque nunca participa, esto cubre también al corredor
    creador que quiera armar el desafío sin anotarse).
14. **Push de propuesta pendiente — confirmado por backend:** al crear una competencia con
    `created_by_role='runner'` (queda `pending_approval`), el entrenador del equipo recibe push
    además del punto rojo/inbox — mismo `data.route` del punto 11 de la sección anterior.
15. **Corrección 2026-10-14, antes de empezar el frontend de este gap — forma exacta de listado
    vs. detalle.** El punto 4/5 no distinguían qué trae cada uno:
    - `GET /teams/{id}/competitions?status=&group_id=` → lista de competencias con **todos los
      campos del modelo del punto 1, sin progreso por participante** (liviano — el frontend solo
      necesita id/tipo/métrica/ventana/estado/ganador para la lista, no recalcular progreso de
      cada una en cada fetch).
    - `GET /competitions/{id}` → los mismos campos del modelo **más** `participants:
      [{user_id, name, avatar_url, value, rank}]` — mismo shape de fila que usa el leaderboard
      (Gap 32), con `value` en la unidad de la `metric` de la competencia (mismo encoding del Gap
      32, corrección 2026-10-14: número plano, nunca string formateado). Para `type='route'`
      este shape de `participants` queda pendiente de definir en el gap de la Spec 4b (trayectoria
      en mapa) — no bloquea el tipo `metric`, que es autosuficiente con esto.
    - Autorización de `GET /competitions/{id}`: mismo criterio dual ya usado en el resto de
      endpoints de equipo (miembro activo del roster, u owner del team) — no solo el creador.
16. **Corrección 2026-10-14 — falta `name` en el modelo.** El punto 1 no incluía un campo de
    nombre, pero una estampa de trofeo de competencia (Gap 31, `type='competition'`) necesita un
    `source_name` mostrable en la vitrina, y la lista/detalle de competencias necesitan un título
    para cada fila — no alcanza con "competencia de distancia del 1 al 7 de octubre" armado del
    lado cliente, el creador tiene que poder titularla (ej. "Desafío de octubre", mencionado como
    ejemplo en el doc fuente). Se agrega `name` (string, obligatorio) al modelo del punto 1 y a
    `POST /teams/{id}/competitions` del punto 2 — el frontend lo pide en el formulario de
    creación, no lo infiere.

**Actualización 2026-10-14 (2) — implementación real reportada por backend, confirmaciones y
correcciones antes de construir el frontend de este gap:**

**Confirmado sin cambios:** creación (`trainer`→`active` directo, `runner`→`pending_approval`),
`PATCH /approve`/`/reject` con `{reason?}`, verificación de ruta 100% server-side sin umbral
mínimo (Haversine + `acceptance_radius_meters`), `competition_id` opcional en `POST
/session-instances/:id/runner` (400 con mensaje específico si la competencia no está `active`, el
caller no es participante, o el instante cae fuera de `[start_at, end_at]`), trofeo + logros al
cerrar con ganador, `has_unseen` embebido en `GET /teams/{id}/competitions` (por `team_id`, el OR
entre equipos lo sigue haciendo el frontend — Gap 34).

**Correcciones al contrato de arriba:**

17. **Cancelación — el punto 13 estaba mal.** No es `PATCH .../cancel` con status `'cancelled'`,
    ni "cualquier rol, también activa". La implementación real: **`DELETE /competitions/{id}/cancel`**,
    **solo el corredor que propuso** la competencia, **solo mientras está `pending_approval`** —
    borrado físico, sin fila que quede en `'cancelled'`. **Una competencia `active` NO tiene forma
    de cancelarse, para ningún rol.** El único camino para terminarla antes de tiempo es que el
    entrenador la cierre (punto 18) — y el cierre exige que `end_at` ya haya pasado. Se retira
    `status='cancelled'` del enum del modelo (punto 1) — no existe en la práctica, al cancelar la
    fila se borra. **Impacto en frontend:** el botón "Cancelar" solo aparece en filas
    `pending_approval` del propio proponente corredor; no hay ninguna acción de cancelación para
    una competencia `active`, sea quien sea.
18. **Cierre — pieza nueva, no estaba en el pedido original.** `PATCH /competitions/{id}/close`
    — solo el entrenador creador o el owner, solo con `status='active'`, y **solo si `end_at` ya
    pasó** (400 si no). Es el único mecanismo de cierre — no hay job automático (deuda conocida,
    aceptada). Al cerrar: `status='finished'`, `finished_at`, y se calculan los ganadores.
    **Impacto en frontend:** agregar un botón "Cerrar" visible para el entrenador en filas
    `active` cuya `end_at` ya pasó.
19. **`winner_user_id` (singular) está mal — es `winner_user_ids: []` (array).** Empate exacto en
    el valor ganador (métrica) o en el `%` de coincidencia + tiempo (ruta) → **todos los que
    empataron ganan**, no se desempata más allá de lo ya descripto en los puntos 9 (leaderboard) y
    12 (ruta) de arriba. Sin intentos finalizados contra la competencia → `finished` con
    `winner_user_ids: []` (vacío, no `null`). Se corrige el modelo del punto 1:
    `winner_user_id?` → `winner_user_ids: []`. Cada ganador recibe su propia estampa (plural
    también en la emisión de trofeos del punto 8).
20. **WS — casing mixto entre los dos eventos, documentado para no asumir uniformidad.**
    `update:competition_progress` (al terminar un intento con `competition_id`) → payload
    `{competition_id, user_id}` **snake_case**. `control:competition_finished` (al cerrarse con
    ganador) → payload `{competitionId}` **camelCase**. No es un error — es así como quedó
    implementado — pero quien cablee el listener (Spec 4b, ya que el WS solo importa para
    `type='route'` corrido como sesión en vivo) tiene que leer cada payload con el casing que le
    corresponde, no asumir que los dos son iguales.
21. **Preguntas abiertas, pendientes de confirmar antes de construir la Spec 4b (no bloquean la
    4a, que es CRUD/moderación sin progreso en vivo):**
    - El campo de detalle (punto 15 arriba) se llama `progress`, no `participants` como se había
      pedido — ¿trae el mismo shape de fila que el leaderboard (`user_id, name, avatar_url, value,
      rank`), o es distinto? El reporte solo confirma el *contenido* (acumulado de la métrica, o
      % de coincidencia) sin confirmar la forma exacta del array.
    - ¿El campo `name` (punto 16) ya se implementó, o el backend sigue generando
      `"Competencia N"` automático para la estampa? El reporte de implementación no lo menciona
      en la validación de `POST /teams/{id}/competitions`, así que probablemente todavía no —
      confirmar antes de que el formulario de creación dependa de mandarlo.
    - ¿`GET /teams/{id}/competitions` envuelve la lista en `{data: [...], has_unseen}`, o
      `has_unseen` es un campo sibling a otra forma de respuesta? (mismo patrón de envoltura que
      ya confirmó el Gap 31 para catálogo/estampas — confirmar que acá es igual).
22. **Alcance de frontend dividido en Spec 4a/4b a partir de este hallazgo:** `competition_id`
    aplica igual para `type='metric'` que para `type='route']` (punto 10/confirmado arriba) — una
    competencia por métrica **tampoco** suma progreso sin que el corredor arranque su
    entrenamiento marcado con ese `competition_id`, y eso requiere tocar el flujo de
    pre-start/Play del corredor (`session-pre-start-screen.jsx` o equivalente). Por eso esa pieza
    se mueve entera a la Spec 4b (que ya iba a tocar session-runtime para el tipo ruta) — la Spec
    4a construye CRUD + aprobación + cancelación + cierre + listado/detalle sin esa integración:
    una competencia de tipo métrica se puede crear/aprobar/ver en 4a, pero su progreso queda en
    cero hasta que 4b cablee el intake de sesión. Interinidad aceptada a propósito, no es un bug.

**Actualización 2026-10-14 (3) — respuestas de backend a las 3 preguntas del punto 21, verificadas
contra código (`cmd/api/domains/competition/competition.go`):**

23. **`progress` (detalle) confirmado MÁS CHICO que una fila de leaderboard:** `[{user_id,
    value}]` únicamente — sin `name`/`avatar_url`/`rank`. `value` es `null` para `type='route'`
    por ahora. El frontend tiene que resolver `name`/`avatar_url` contra el roster ya cargado
    (mismo patrón ya usado en la Spec 4a para la lista de participantes — `memberName(members,
    userId)` en `components/team/competitions-tab.jsx`), no esperar que el backend los mande. Si
    la Spec 4b necesitara el shape completo (con rank, por ejemplo para ordenar a los
    participantes por progreso), backend ofreció sumarlo como cambio acotado al builder del
    detalle — pedirlo en el momento si hace falta, no está prometido de antemano.
24. **`name` confirmado SIN implementar — no es una omisión del reporte, es una decisión real
    (D8):** el modelo no tiene columna `title`/`name`, no entra por `POST`, y el único nombre que
    existe hoy es el `source_name: "Competencia N"` autogenerado de la estampa (Gap 31). El
    frontend (Spec 4a, ya corregido 2026-10-14) dejó de mandarlo y arma un título client-side
    (métrica + ventana, `utils/competition-title.js#buildCompetitionTitle`) para cada fila.
    Backend ofreció sumar el campo real (columna + `POST`/DTO + título en el push) "en la próxima
    ronda" si se pide — no está en el roadmap sin pedirlo explícitamente.
25. **Envoltura confirmada — coincide con lo ya implementado en el frontend, sin cambios:**
    `GET /teams/{id}/competitions` → `{data: [...], has_unseen}` (mismo patrón `{data}` que
    catálogo/estampas del Gap 31). `GET /competitions/{id}` → `{data: {...}}` (objeto único, no
    lista) — relevante recién para la Spec 4b, que todavía no construye esa llamada.

**Actualización 2026-10-14 (4) — hueco de arquitectura encontrado al arrancar el diseño de la
Spec 4b (`type='route'`), antes de escribir una sola línea de UI. Preguntas nuevas, no bloquean
`type='metric'` (ver punto 29):**

26. **No existe hoy ningún `session_instance` "libre"/ad-hoc.** Todo `session_instance` nace de un
    día de calendario de grupo (`PUT /groups/{id}/calendar/{date}`, ver
    `docs/BACKEND_CALENDAR_ASSIGNMENTS_SPEC.md`) — atado a un plan/grupo, con fecha fija. El
    contrato confirmado (punto 10/22 arriba) dice que `competition_id` viaja en
    `POST /session-instances/{id}/runner`, es decir el intento de una competencia **usa ese mismo
    mecanismo** — para `type='metric'` esto encaja perfecto (cualquier entrenamiento programado
    normal, dentro de la ventana, cuenta). Para `type='route'` no hay ningún día de calendario al
    que atar el intento — una competencia por trayectoria no vive en el calendario de ningún
    grupo. **Pregunta para backend:** ¿cómo arranca un intento de ruta? Tres hipótesis, a elegir o
    corregir:
    - (a) Backend suma un endpoint nuevo para crear un `session_instance` ad-hoc/standalone (sin
      `group_id`/`plan_day_id`), pensado para este caso — el frontend lo crea al tocar "Correr
      esta trayectoria" y recién ahí hace el `POST .../runner` con `competition_id`.
    - (b) El intento de ruta NO pasa por `session_instance`/`runner_session` en absoluto — tiene su
      propio endpoint de intake (ej. `POST /competitions/{id}/attempts`) con su propio ciclo de
      vida, y el frontend solo reusa la UI de pre-start/en vivo/resultado, no el backend de
      sesiones.
    - (c) Otra idea del lado backend que no contemplamos.
27. **Competencias `type='route'` no tienen `end_at` (confirmado, Gap 34 punto 15) — ¿entonces
    cómo se cierran?** `PATCH /competitions/{id}/close` (punto 18 arriba) exige `end_at` ya pasado,
    así que tal como está no aplica a ruta. **Pregunta para backend:** ¿el cierre de una
    competencia de ruta es manual sin ese requisito (el entrenador cierra cuando quiere, sin
    validar fecha), automático al primer intento finalizado (le ganás a quien sea que compita
    después), o algún otro criterio? Afecta directo si la pestaña de Competencias necesita un
    botón de cierre distinto para ruta.
28. **¿Un corredor puede reintentar una ruta más de una vez?** Si sí, ¿el resultado final usa el
    mejor intento (mayor % de coincidencia, o menor tiempo entre los que llegaron al mismo %) o
    solo el primero/último? Afecta el copy de la pantalla de resultado ("tu mejor intento" vs "tu
    intento") y si hace falta mostrar historial de intentos en el detalle.
29. **Alcance de la Spec 4b dividido en dos a partir de este hallazgo (26-28 no bloquean esto):**
    el wiring de `competition_id` en el Play/pre-start del corredor (`session-pre-start-screen.jsx`
    o equivalente) para que una competencia `type='metric'` ya activa sume progreso real **no
    depende de ninguna de las preguntas de arriba** — usa el mismo `session_instance` de siempre,
    solo había que agregar el campo al body. Esa pieza puede construirse ya, en paralelo mientras
    se espera la respuesta de 26-28. El dibujo de ruta en el mapa + el flujo de "correr una
    trayectoria" + la verificación/cierre de ruta quedan en una Spec 4c separada, bloqueada hasta
    tener respuesta.
30. **Dibujo de ruta — límites a confirmar antes de construir el picker de mapa (no bloquea nada
    de arriba, pero hace falta antes de la 4c):** ¿hay un máximo de puntos/vértices que acepta el
    `route` (GeoJSON LineString), o longitud máxima de la ruta? ¿El creador puede editar la ruta de
    una competencia ya creada, o es inmutable una vez creada (como el resto de los campos del
    modelo)?
31. **`acceptance_radius_meters` — rango/default.** ¿Hay un mínimo/máximo que el backend valide, o
    el frontend puede mandar cualquier entero positivo? ¿Hay un valor sugerido por default en el
    formulario, o el backend no opina?
32. **WS en vivo durante un intento de ruta — ¿progreso de OTROS participantes llega en tiempo
    real, o solo al finalizar?** `update:competition_progress` (punto 20 arriba) se dispara "al
    terminar un intento" — confirmar si eso significa que mientras un corredor corre la ruta, el
    resto NO ve su avance hasta que termina (ningún leaderboard en vivo durante la ventana de
    intentos), o si hay algún evento intermedio. Afecta si la pantalla en vivo de ruta muestra solo
    la trayectoria propia, o también la de otros corriendo en simultáneo.

**Actualización 2026-10-14 (5) — resueltos los 7 puntos de arriba, consenso con backend, confirmado
desde frontend. Ronda backend `competencias-ruta-intake` (3-4 tasks) en curso, frontend construye
en paralelo contra mocks mientras tanto — no bloquea:**

26. **Resuelto — instancia sintética por competencia (hipótesis a, ganó por reuso).** Al crear una
    competencia `type='route'`, backend auto-crea **una sola** `session_instance` sintética
    (sin `group_id`/día de calendario, no aparece en ningún listado de calendario existente),
    con **un ejercicio sintético** ("Corrida"). Todos los participantes comparten esa instancia.
    **Intake nuevo: `POST /competitions/{id}/attempts`** — valida `active` + caller participante +
    sin intento previo, y hace el `POST .../runner` internamente. **Impacto en frontend:** el
    botón "Correr esta trayectoria" de la pestaña Competencias llama a este único endpoint nuevo;
    de ahí en adelante reusa el flujo de pre-start/en vivo/resultado **tal cual existe hoy**, sin
    tocar nada de `session-runtime` salvo el punto de entrada. Canal WS se hereda
    (`session:{instanceId}`, nueva rama de autorización del lado backend).
27. **Resuelto — cierre manual sin `end_at`.** Para `type='route'`, `PATCH /competitions/{id}/close`
    exige solo creador-entrenador/owner + `status=active` (sin el chequeo de fecha que sí aplica a
    `type='metric'`).
28. **Resuelto — sin reintentos en v1.** Un intento por corredor por ruta (índice único
    `(session_instance_id, athlete_user_id)` en `runner_session`), un segundo intento devuelve
    `400`. **Impacto en frontend:** copy de resultado es "tu intento" (no "tu mejor intento"); el
    botón "Correr esta trayectoria" desaparece/deshabilita una vez que el corredor ya tiene un
    intento registrado contra esa competencia. El tie-break por tiempo (punto 12 arriba) sigue
    vivo entre corredores distintos — solo el caso "mismo corredor, dos intentos" queda sin efecto.
29. (ya resuelto arriba, sin cambios)
30. **Resuelto — límites de ruta:** máx **500 vértices** por LineString, máx **100 km** de largo
    total (Haversine sumado), validados en `Create` → `400` si excede. **Ruta inmutable** una vez
    creada la competencia — para cambiarla, cancelar la propuesta (solo posible en
    `pending_approval`, punto 17) y crear otra. **Impacto en frontend:** el picker de mapa de la
    Spec 4c valida estos dos límites client-side antes de permitir enviar (UX, no reemplaza la
    validación real del backend).
31. **Resuelto — radio de aceptación:** rango válido `[5, 500]` metros (`400` fuera de rango).
    **Default sugerido del formulario: 50m** (decisión de frontend, el backend solo acota el
    rango).
32. **Resuelto — sin WS en vivo durante el intento, v1.** Único evento en vivo es
    `update:competition_progress` al TERMINAR el intento + `control:competition_finished` al
    cierre. Mientras un corredor corre, el resto no ve su avance (sin leaderboard en vivo
    intermedio por ruta) — **impacto en frontend:** la pantalla en vivo de un intento de ruta
    (Spec 4c) muestra solo la trayectoria propia superpuesta a la ruta marcada, no la de otros
    participantes corriendo en simultáneo. Queda anotado como mejora futura, no se construye ahora.

## Gap 34 — módulo de gamificación: mecanismo transversal de "novedad por ver" (punto rojo)

**Contexto.** Rachas, logros/trofeos y competencias necesitan un **mismo** mecanismo de "hay algo
nuevo" para alimentar el punto rojo del header/sidebar/home — no 3 implementaciones ad hoc por
sección. No existe hoy un precedente genérico: el único mecanismo de "novedad" parecido en el repo
es `usePendingRequestsCount`/`useTeamsJoinRequestsMap` (`hooks/use-join-requests.js`), que es
específico de solicitudes de ingreso, no transversal.

**Pedido concreto — preferir embeber el flag en los 3 endpoints existentes antes que sumar un
endpoint umbrella nuevo** (menos superficie nueva, mismo espíritu que el precedente de arriba: el
dato de "novedad" vive junto al recurso que la genera, no en un servicio aparte):

1. `GET /users/{id}/streaks` (Gap 30), `GET /users/{id}/achievements` (Gap 31) y la futura consulta
   de competencias del usuario (Gap 33) devuelven, cada uno, su propio `has_unseen: boolean` —
   el frontend hace el OR de los 3 para pintar el punto rojo del header/sidebar/home, y cada
   sección interna (pestaña Rachas/Logros/Competencias) puede mostrar su propio punto individual
   con el mismo campo.
2. Un único `POST /users/{id}/gamification/seen` — body `{section: 'streaks'|'achievements'|
   'competitions'}` — marca como visto al abrir esa sección (este sí conviene compartido: es
   un simple "update timestamp", no necesita vivir en 3 endpoints distintos).
3. Dispara con: racha rota, racha que cruza un hito (10/20/50/100...), logro nuevo, trofeo nuevo,
   competencia próxima a cerrar.
4. Si el backend prefiere el endpoint umbrella (`GET /users/{id}/gamification/unseen` →
   `{streaks, achievements, competitions}`) en vez de embeber el flag en cada recurso, también
   sirve — es una decisión de ergonomía de API del lado backend, el frontend se adapta a
   cualquiera de las dos.

**Actualización 2026-10-13 — consenso con backend, habilita trabajo en paralelo:**

15. **Triggers confirmados y corregidos:**
    - **"Competencia próxima a cerrar"** = dentro de las **24hs** antes de `end_at`. Solo aplica a
      competencias `type='metric'` (las únicas con `end_at`) — las de `type='route'` no tienen
      ventana de cierre por fecha, así que no disparan este trigger puntual (sí disparan por
      "trofeo nuevo" al cerrarse con ganador, eso ya está cubierto).
    - **Rachas — corrección respecto al doc fuente original: solo 2 triggers, no 3.** El doc
      original mencionaba también "día marcado nuevo" como disparador — se retira acá: marcaría
      el punto rojo casi todos los días (progreso normal, no una novedad real) y le quita sentido
      a la señal. Quedan **racha rota** y **racha que cruza un hito** (10/20/50/100...) únicamente.
16. **Punto rojo de Competencias — confirmado: no hace falta endpoint nuevo.** El punto rojo
    GLOBAL (header/sidebar/home, que combina rachas+logros+competencias según el doc fuente) lo
    resuelve el frontend haciendo el OR del `has_unseen` que ya devuelve `GET
    /teams/{id}/competitions` (punto 1 de este gap) sobre la lista de equipos que el usuario ya
    tiene cargada (`useTeams`/`useMyMemberTeams`, hooks existentes) — sin pedir un endpoint
    cross-team aparte. El punto rojo de la pestaña Competencias DENTRO de un equipo puntual usa
    directamente el `has_unseen` de ESE equipo, sin agregación.

## Gap 35 — `/dashboard/comparisons/periods` restringido al dueño del equipo (bloquea la comparación por período del corredor)

**Contexto.** La card "Frente al período anterior" de la pantalla de rendimiento
(`components/dashboard/comparison-strip.jsx`) consume `POST /dashboard/comparisons/periods`.
El endpoint responde **403** cuando el llamador no es el dueño del equipo — mismo criterio que
`/dashboard/leaderboard` y `/dashboard/comparisons`, que sí exponen datos de **otros** corredores.

La diferencia es que éste *no necesita* exponer a nadie más: es el mismo scope de
`/summary`/`/timeseries`, agregado por período. Si el backend lo recorta al usuario que pregunta
(el mismo `athleteIdsFor` que ya usan esas tres), el resultado para un corredor sería "mis series
ahora contra mis series antes" — datos propios, sin riesgo de privacidad. Da la impresión de que
quedó owner-only por arrastre de los otros dos, no por decisión de datos. **Hoy no está recortado
por usuario**: en el mock espejo (`services/__mocks__/dashboard-mock.js#mockPostDashboardPeriods`)
las dos ventanas se seleccionan con `athleteIds: null`, o sea todas las series del team — abrir el
endpoint sin ese recorte le mostraría a un corredor los números del equipo entero.

**Pedido concreto.** (1) Abrir `POST /dashboard/comparisons/periods` a **miembros** del equipo y
(2) scoping por usuario cuando el llamador no es el dueño, igual que `/summary`, `/timeseries` y
`/distribution`. `/leaderboard` y `/comparisons` quedan como están (owner-only: esos sí muestran a
otros corredores).

**Estado del frontend — listo para cuando abra.** La decisión está aislada en un interruptor:
`MEMBER_PERIOD_COMPARISON_ENABLED` (`utils/dashboard-capabilities.js`, hoy `false`). La sección
(`PeriodComparisonSection` en `components/dashboard/dashboard-screen.jsx`) ya se monta sola cuando
la capacidad devuelve `true`; el cambio pendiente es ese flag + el caso del test
`__tests__/dashboard-capabilities.test.js` que lo fija. No hay que tocar la pantalla.

**Estado del frontend — listo para cuando abra.** La decisión está aislada en un interruptor:
`MEMBER_PERIOD_COMPARISON_ENABLED` (`utils/dashboard-capabilities.js`, hoy `false`). La sección
(`PeriodComparisonSection` en `components/dashboard/dashboard-screen.jsx`) ya se monta sola cuando
la capacidad devuelve `true`; el cambio pendiente es ese flag + el caso del test
`__tests__/dashboard-capabilities.test.js` que lo fija. No hay que tocar la pantalla.
