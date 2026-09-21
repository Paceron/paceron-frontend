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

## Gap 5 — sin endpoint para listar los permisos de un tier ajeno

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

## Gap 8 — `stamp` no permite excluir fechas puntuales del rango

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
