# Huecos de backend detectados integrando equipos/grupos/invitaciones

Doc de seguimiento interno — un gap por sección, se actualiza a medida que el backend los va cerrando. Versión más narrativa (pensada para pasarle al equipo de backend como insumo de sus propias specs) compartida por fuera del repo el 2026-07-28.

**Actualización 2026-07-30:** re-inspeccionado el swagger real (`/swagger/doc.json`) contra el backend en Render. Gaps 1, 2, 5, 6 y 7 resueltos — ver detalle en cada sección. Gaps 3 y 4 siguen abiertos (4 además queda de baja prioridad: el equipo prioriza el módulo de cobros/suscripciones antes que planes de entrenamiento). Además, el swagger sumó `/groups` (CRUD completo de grupos) y `PATCH /users/{id}/password` (cambio de contraseña autenticado) — ninguno de los dos tenía gap previo asociado: el primero habilita directamente la Etapa 2 de este roadmap, el segundo es una feature nueva sin pantalla todavía en el frontend.

**Actualización 2026-07-31:** arrancando Etapa 3 (Invitaciones), diseñando la integración real contra `GET /teams/{id}/invitations` y `POST /invitations/{id}/accept`/`reject`, aparecieron 2 gaps nuevos (8 y 9) — ninguno bloquea el lado dueño-de-equipo de la etapa, pero sí acotan su alcance (ver gap 9 para la decisión de sacar la selección de grupo del flujo de invitar).

## 1. Sin endpoint "mis equipos" (administrados o donde participo) — RESUELTO EN BACKEND

- **Qué hacía falta:** `GET /users/{id}/teams` (o `?owner_id=`/`?member_id=` en el `GET /teams` existente).
- **Qué cambió (2026-07-30):** `GET /teams` ahora acepta `owner_id` (equipos administrados) y `member_id` (equipos donde el usuario es corredor) como query params opcionales.
- **Workaround actual (todavía en pie):** `store/team-store.js#selectAdministeredTeams` sigue filtrando client-side sobre `GET /teams` sin filtro — el frontend no migró todavía a pasar `owner_id`/`member_id` en la llamada. Migrar es una optimización (menos datos por request, y desbloquea "equipos donde soy corredor" a futuro), no una corrección de bug — queda pendiente, no urgente.
- **Estado:** resuelto en backend, pendiente de aprovechar del lado del frontend.

## 2. Sin campo `show_groups_to_runners` en el equipo — RESUELTO

- **Qué hacía falta:** campo booleano en `team.CreateTeamRequest`/`UpdateTeamRequest`/`TeamResponse`.
- **Qué cambió (2026-07-30):** el campo existe en los 3 (confirmado en swagger). Frontend actualizado en la misma fecha (`services/normalizers.js#toTeamModel`/`toUpdateTeamPayload`, `store/team-store.js`) — ya persiste de verdad, se sacó el aviso de "no se guarda entre sesiones" de `edit-team-screen.jsx`. Sigue sin exponerse en el wizard de creación (decisión ya tomada, no cambia).
- **Estado:** resuelto.

## 3. Sin campo de foto de equipo ni mecanismo de upload

- **Qué hace falta:** campo `photo_url` (o similar) en el equipo + algún mecanismo de storage (no hay upload de archivos en ningún recurso del sistema todavía).
- **Por qué:** el wizard de creación/edición ya tiene un selector de foto.
- **A qué bloquea:** la foto elegida no persiste entre sesiones.
- **Workaround actual:** queda interactiva del lado del cliente (`photoUri`), se pierde al recargar. Sin aviso visible (dato menos sensible que el toggle de privacidad).
- **Estado:** abierto — probablemente necesita una decisión de infraestructura (dónde se guardan los archivos) antes que un endpoint puntual de equipos. Sin cambios al 2026-07-30.

## 4. Sin campo de plan de entrenamiento en el grupo

- **Qué hace falta:** campo `training_plan_id` (o similar) en `group.CreateGroupRequest`/`UpdateGroupRequest`/`GroupResponse`.
- **Por qué:** cada grupo puede tener un plan de entrenamiento asociado (hoy un catálogo fijo hardcodeado de 4 planes en el frontend, sin respaldo real).
- **A qué bloquea:** nada por ahora — el resto de la Etapa 2 (CRUD de grupos en sí) ya no está bloqueado. Planes de entrenamiento queda deliberadamente para después: el equipo prioriza primero el módulo de cobros/suscripciones (en desarrollo en paralelo por otro miembro del equipo). La Etapa 2 de este roadmap se implementa sin tocar `trainingPlanId` — el catálogo mock queda como está, sin wiring nuevo.
- **Workaround actual:** `TRAINING_PLAN_OPTIONS` en `store/team-store.js`, catálogo fijo sin persistencia real.
- **Estado:** abierto. Sin cambios al 2026-07-30 — `group.CreateGroupRequest`/`GroupResponse` solo tienen `name`/`description`/`is_main`/`team_id`.

## 5. Sin endpoint para listar invitaciones pendientes de un equipo — RESUELTO

- **Qué hacía falta:** `GET /teams/{id}/invitations` (o similar) con email/fecha/grupo/estado.
- **Qué cambió (2026-07-30):** `GET /teams/{id}/invitations` existe, devuelve las invitaciones pendientes (no vencidas) del equipo (`invitation.InvitationResponse`: id, invitee_email, invitee_id, invitee_name, status, expires_at, created_at, team_id).
- **A qué desbloquea:** la sección "Solicitudes pendientes" de la Etapa 3 (Invitaciones) — todavía no implementada en el frontend, sigue mockeada hasta que arranque esa etapa.
- **Estado:** resuelto en backend, sin consumir todavía del lado del frontend (Etapa 3 no arrancó).

## 6. Sin mecanismo de aceptar/rechazar invitación — RESUELTO

- **Qué hacía falta:** la invitación como entidad persistida con id/estado + endpoints de aceptar/rechazar que, al aceptar, den de alta en `team-users`.
- **Qué cambió (2026-07-30):** `POST /invitations/{id}/accept` y `POST /invitations/{id}/reject` existen (body: `{ user_id }`). Según la descripción del swagger, aceptar deja al usuario "como corredor del equipo" — sugiere que sí da de alta en `team_users` internamente.
- **A qué desbloquea:** la Etapa 3 (Invitaciones) completa, antes bloqueada por este gap — ya no hay motivo backend para no arrancarla.
- **Estado:** resuelto en backend, sin consumir todavía del lado del frontend (Etapa 3 no arrancó).

## 7. `DELETE /teams/{id}` rechaza al dueño real del equipo — RESUELTO

- **Qué pasaba:** un entrenador dueño de un equipo recibía `"el usuario no pertenece a este equipo"` al intentar `DELETE /teams/{id}?user_id={su propio id}`.
- **Qué cambió:** confirmado en vivo por el usuario (2026-07-30) — crear y eliminar equipo desde el front ya funciona contra el backend real.
- **Regla de negocio a tener en cuenta:** el equipo no debe tener miembros para poder borrarse (según descripción del endpoint) — el frontend hoy no distingue ese error de otros al mostrar el toast de fallo. No bloqueante, anotado para si aparece como bug reportado.
- **Estado:** resuelto.

## 8. Sin endpoint para que el invitado consulte sus propias invitaciones

- **Qué hace falta:** `GET /invitations?user_id=` (o similar) para listar las invitaciones pendientes de un usuario, y/o `GET /invitations/{id}` para consultar una puntual.
- **Por qué:** hoy solo existe `GET /teams/{id}/invitations` (lado dueño de equipo) — el invitado no tiene forma de ver qué invitaciones tiene pendientes en ningún lado de la app, ni la app tiene cómo mostrarle detalle de una invitación puntual antes de aceptar/rechazar.
- **A qué bloquea:** la pantalla de "invitaciones recibidas" (Etapa 3) — diferida hasta que exista este endpoint.
- **Workaround actual:** ninguno posible del lado del cliente.
- **Estado:** abierto.

## 9. `POST /teams/{id}/invite` no acepta grupo

- **Qué hace falta:** campo `group_id` (opcional) en `invitation.InviteRunnerRequest` (hoy solo `email`).
- **Por qué:** el entrenador debería poder elegir a qué grupo va un corredor invitado al mandarle la invitación — hoy no hay forma de comunicarle esa elección al backend, y `InvitationResponse` tampoco devuelve `group_id`, así que ni siquiera se puede mostrar a qué grupo iba dirigida una invitación ya enviada.
- **Comportamiento esperado una vez resuelto (confirmado con el usuario 2026-07-31):** sin `group_id`, el corredor que acepta cae en el grupo principal/default del equipo (comportamiento actual). Con `group_id` provisto, al aceptar debería ir directo a ese grupo en lugar del default.
- **A qué bloquea:** por este gap, la Etapa 3 (Invitaciones) del frontend saca por completo la selección de grupo del flujo de invitar (wizard y pantalla dedicada) — mantenerla sin efecto real sería UI engañosa. Se puede reintroducir en cuanto este campo exista.
- **Workaround actual:** ninguno — toda invitación cae en el grupo default hasta que este campo exista.
- **Estado:** abierto — el usuario planea trabajar esto del lado del backend él mismo más adelante.
