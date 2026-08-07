# Huecos de backend detectados integrando equipos/grupos/invitaciones

Doc de seguimiento interno — refleja únicamente los gaps de backend **actualmente abiertos y accionables**. El historial completo (gaps ya resueltos, y los excluidos temporalmente) vive en el historial de git de este archivo (`git log -p -- docs/BACKEND_API_GAPS.md`).

**Actualización 2026-08-02:** limpieza de la doc por pedido del usuario, para dejarla enfocada en lo que hay que resolver ahora del lado del backend:
- Se sacaron los gaps ya resueltos (eran 7: sin endpoint "mis equipos", `show_groups_to_runners`, listar invitaciones pendientes de un equipo, aceptar/rechazar invitación, `DELETE /teams/{id}` rechazando al dueño, endpoint de invitaciones propias del invitado, `group_id` al invitar) — quedan documentados en el historial de git, no acá.
- Se excluyen **deliberadamente, hasta que el usuario lo indique**, los gaps referidos a foto de equipo y a plan de entrenamiento en el grupo — no son prioridad de backend por ahora (el equipo prioriza otro trabajo). El frontend ya refleja esa decisión: el selector de plan queda en la UI sin opciones (`TRAINING_PLAN_OPTIONS = []` en `store/team-store.js`), y la foto de equipo sigue sin persistir entre sesiones. Cuando el usuario retome alguno de los dos, se vuelve a documentar acá como gap propio.

**Actualización 2026-08-02 (roster real):** `hooks/use-team-roster.js` arrancó a consumir `GET /teams/{id}/users` + `GET /groups/{id}/users` (reemplaza el roster mock) — ninguno de los dos trae nombre/email, solo `user_id`, así que hace falta un fan-out N+1 contra `GET /auth/user?id=` por cada corredor único (cacheado/dedupeado con TanStack Query, no bloqueante, pero motivó el gap 2 nuevo de abajo).

**Actualización 2026-08-03:** gap 3 (`InvitationResponse` sin quién invita) — **RESUELTO**, el backend sumó `inviter_id`/`inviter_name` directo. Se sacó el workaround de 2 requests (`GET /teams/{id}` → `GET /auth/user?id=`) de `received-invitations-screen.jsx`, ahora usa `invite.inviterName` directo (`services/normalizers.js#toInvitationModel`). Gaps 1 y 2 siguen abiertos — el usuario los está trabajando del lado del backend.

Quedan 2 gaps abiertos y accionables:

## 1. Sin búsqueda de usuarios por nombre/email parcial

- **Qué hace falta:** un endpoint de búsqueda (ej. `GET /users/search?q=`) que devuelva coincidencias parciales por nombre o email.
- **Por qué:** al invitar corredores, sería útil sugerir usuarios ya registrados a medida que se tipea el email (autocompletar). Hoy solo existe `GET /auth/user?id=`/`?email=` — lookup exacto, sin buscar por texto parcial.
- **A qué bloquea:** cualquier UI de autocompletar/sugerir usuarios al invitar — no se puede construir sin este endpoint.
- **Workaround actual:** ninguno — el campo de invitar sigue siendo un input de email libre, sin sugerencias.
- **Estado:** abierto.

## 2. Sin lookup de usuarios en lote (por varios ids a la vez)

- **Qué hace falta:** algo como `GET /users?ids=1,2,3` que devuelva nombre/email de varios usuarios en una sola llamada.
- **Por qué:** `TeamUserResponse`/`GroupUserResponse` (roster de equipo/grupo) solo traen `user_id`, sin nombre ni email — para mostrar el roster real hay que resolver cada corredor único contra `GET /auth/user?id=` (N+1). No bloqueante (TanStack Query cachea/dedupea el resultado entre pantallas), pero un endpoint en lote lo resolvería de raíz en vez de con un workaround de cliente.
- **A qué bloquea:** nada hoy — es una optimización, no un bloqueo funcional.
- **Workaround actual:** `hooks/use-team-roster.js` pide `GET /auth/user?id=` una vez por `user_id` único (vía `useQueries`), cacheado por `queryKey: ['user', userId]`.
- **Estado:** abierto, baja prioridad.
