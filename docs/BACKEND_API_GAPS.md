# Huecos de backend detectados integrando equipos/grupos/invitaciones

Doc de seguimiento interno — un gap por sección, se actualiza a medida que el backend los va cerrando. Versión más narrativa (pensada para pasarle al equipo de backend como insumo de sus propias specs) compartida por fuera del repo el 2026-07-28.

**Actualización 2026-07-30:** re-inspeccionado el swagger real (`/swagger/doc.json`) contra el backend en Render. Gaps 1, 2, 5 y 6 ya tienen endpoint/campo — ver detalle en cada sección. Gaps 3 y 4 siguen abiertos. Gap 7 tiene una hipótesis de fix (a confirmar en preview contra el backend real). Además, el swagger sumó `/groups` (CRUD completo de grupos) y `PATCH /users/{id}/password` (cambio de contraseña autenticado) — ninguno de los dos tenía gap previo asociado: el primero habilita directamente la Etapa 2 de este roadmap, el segundo es una feature nueva sin pantalla todavía en el frontend.

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
- **A qué bloquea:** parte de la Etapa 2 (Grupos) de este roadmap — el resto de la Etapa 2 (CRUD de grupos en sí) ya no está bloqueado, ver nota de 2026-07-30 al pie del documento.
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

## 7. `DELETE /teams/{id}` rechaza al dueño real del equipo

- **Qué pasa:** probado en preview contra el backend real (2026-07-29): un entrenador dueño de un equipo (`team.owner_id === user_id`, confirmado antes de mostrar el botón de eliminar en el frontend) recibe `"el usuario no pertenece a este equipo"` al intentar `DELETE /teams/{id}?user_id={su propio id}`.
- **Hipótesis original:** el endpoint parecía validar pertenencia contra la tabla de membresía (`team_users`) en vez de (o además de) comparar contra `team.owner_id`. Nada en `POST /teams` da de alta al dueño como `team_user` — si el DELETE espera esa fila, un equipo recién creado nunca la tiene.
- **Qué cambió (2026-07-30):** la descripción del endpoint en swagger ahora dice "Solo el entrenador puede hacerlo y no debe tener miembros" — lenguaje distinto al de la hipótesis original (ya no habla de pertenencia al equipo, sino del rol del usuario), lo que sugiere que se corrigió el chequeo. También aparece una regla de negocio nueva/explícita: **el equipo no debe tener miembros** para poder borrarse — no es un bug, pero el frontend hoy no distingue ese error de otros al mostrar el toast de fallo.
- **A qué bloquea:** la feature de "eliminar equipo", ya lista del lado del frontend — falta re-confirmar en preview contra el backend real que el dueño ya puede borrar su equipo.
- **Estado:** posible fix en backend, sin confirmar en vivo. Pendiente: reprobar el flujo de borrado con un usuario dueño real; si sigue fallando, reabrir con el mensaje de error exacto.
