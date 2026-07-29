# Huecos de backend detectados integrando equipos/grupos/invitaciones

Doc de seguimiento interno — un gap por sección, se actualiza a medida que el backend los va cerrando. Versión más narrativa (pensada para pasarle al equipo de backend como insumo de sus propias specs) compartida por fuera del repo el 2026-07-28.

## 1. Sin endpoint "mis equipos" (administrados o donde participo)

- **Qué hace falta:** `GET /users/{id}/teams` (o `?owner_id=`/`?member_id=` en el `GET /teams` existente).
- **Por qué:** `GET /teams` devuelve todo el sistema sin filtro — no hay forma de pedir "los equipos que administro" ni "los equipos donde soy corredor".
- **A qué bloquea:** el menú de equipos del shell (hoy resuelto client-side filtrando por `owner_id`, no escala) y cualquier pantalla futura de "equipos donde participo como corredor" (no resoluble de ningún modo hoy).
- **Workaround actual:** `store/team-store.js#selectAdministeredTeams` filtra `GET /teams` completo por `owner_id === userId`, client-side.
- **Estado:** abierto.

## 2. Sin campo `show_groups_to_runners` en el equipo

- **Qué hace falta:** campo booleano en `team.CreateTeamRequest`/`UpdateTeamRequest`/`TeamResponse`.
- **Por qué:** el entrenador puede decidir si los corredores ven a qué grupo pertenece cada compañero (toggle en Editar equipo).
- **A qué bloquea:** la preferencia no persiste entre sesiones.
- **Workaround actual:** queda interactivo del lado del cliente (`store/team-store.js`, `decorateTeam`), se pierde al recargar. Aviso visible bajo el toggle en `edit-team-screen.jsx`.
- **Estado:** abierto.

## 3. Sin campo de foto de equipo ni mecanismo de upload

- **Qué hace falta:** campo `photo_url` (o similar) en el equipo + algún mecanismo de storage (no hay upload de archivos en ningún recurso del sistema todavía).
- **Por qué:** el wizard de creación/edición ya tiene un selector de foto.
- **A qué bloquea:** la foto elegida no persiste entre sesiones.
- **Workaround actual:** queda interactiva del lado del cliente (`photoUri`), se pierde al recargar. Sin aviso visible (dato menos sensible que el toggle de privacidad).
- **Estado:** abierto — probablemente necesita una decisión de infraestructura (dónde se guardan los archivos) antes que un endpoint puntual de equipos.

## 4. Sin campo de plan de entrenamiento en el grupo

- **Qué hace falta:** campo `training_plan_id` (o similar) en `group.CreateGroupRequest`/`UpdateGroupRequest`/`GroupResponse`.
- **Por qué:** cada grupo puede tener un plan de entrenamiento asociado (hoy un catálogo fijo hardcodeado de 4 planes en el frontend, sin respaldo real).
- **A qué bloquea:** Etapa 2 (Grupos) de este roadmap — no arrancó todavía.
- **Workaround actual:** `TRAINING_PLAN_OPTIONS` en `store/team-store.js`, catálogo fijo sin persistencia real.
- **Estado:** abierto.

## 5. Sin endpoint para listar invitaciones pendientes de un equipo

- **Qué hace falta:** `GET /teams/{id}/invitations` (o similar) con email/fecha/grupo/estado.
- **Por qué:** existe `POST /teams/{id}/invite` (enviar), pero ningún GET de lo ya enviado — la respuesta del POST tampoco devuelve un id de la invitación creada.
- **A qué bloquea:** Etapa 3 (Invitaciones) — la sección "Solicitudes pendientes" queda mockeada indefinidamente sin esto.
- **Workaround actual:** ninguno todavía (Etapa 3 no arrancó).
- **Estado:** abierto.

## 6. Sin mecanismo de aceptar/rechazar invitación

- **Qué hace falta:** la invitación como entidad persistida con id/estado + endpoints de aceptar/rechazar que, al aceptar, den de alta en `team-users`.
- **Por qué:** hoy el flujo es solo "se manda un email y nada más" — no hay forma de que el invitado la vea en la app y decida.
- **A qué bloquea:** Etapa 3 completa — es la pieza central de "sumarse por invitación".
- **Workaround actual:** ninguno todavía (Etapa 3 no arrancó). Es el gap más grande de los 6, probablemente amerita una spec de diseño conjunta con backend antes de implementarse.
- **Estado:** abierto — el más prioritario junto con el gap 1 y 5.

## 7. `DELETE /teams/{id}` rechaza al dueño real del equipo

- **Qué pasa:** probado en preview contra el backend real (2026-07-29): un entrenador dueño de un equipo (`team.owner_id === user_id`, confirmado antes de mostrar el botón de eliminar en el frontend) recibe `"el usuario no pertenece a este equipo"` al intentar `DELETE /teams/{id}?user_id={su propio id}`.
- **Hipótesis:** el endpoint parece validar pertenencia contra la tabla de membresía (`team_users`) en vez de (o además de) comparar contra `team.owner_id`. Nada en `POST /teams` da de alta al dueño como `team_user` — si el DELETE espera esa fila, un equipo recién creado nunca la tiene.
- **Por qué hace falta:** el frontend ya tiene el botón de eliminar equipo wireado (`store/team-store.js#deleteTeam`, `components/team/team-detail-screen.jsx`) — sin este fix, cualquier intento de eliminar un equipo falla para todos los usuarios, incluido el dueño.
- **A qué bloquea:** la feature de "eliminar equipo" completa, ya lista del lado del frontend.
- **Workaround actual:** ninguno posible del lado del cliente — no hay forma de saber qué fila espera el backend sin más contexto de su implementación.
- **Estado:** abierto — a confirmar con el equipo de backend si el chequeo de autorización debería ser por `owner_id` o si falta dar de alta al dueño como `team_user` al crear el equipo.
