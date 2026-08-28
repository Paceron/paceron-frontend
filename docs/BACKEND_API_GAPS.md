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

## Gap 4 — planes de entrenamiento: sin dominio en el backend real

No existe ningún endpoint de planes de entrenamiento en el backend real
(ni el plan en sí, ni su asignación a un grupo o a un corredor). El
módulo completo (`store/training-plan-store.js`,
`services/trainingPlans.js`) corre 100% contra
`services/__mocks__/training-plans-mock.js` — `services/trainingPlans.js`
ya tiene las rutas REST esperadas comentadas (`/training-plans`, mismo
estilo que `services/teams.js`) para cuando el backend las implemente,
pero hoy son inalcanzables (`USE_MOCKS` siempre gana acá, no hay branch
real que probar). La asignación a un **grupo** reusa el campo
`trainingPlanId` que ya existía en `toGroupModel` (`store/team-store.js`)
y que hasta ahora quedaba siempre `null` por este mismo motivo — sigue
sin campo real en `group`. La asignación a un **corredor individual** es
relación nueva, sin ningún equivalente en el backend hoy.

Sin gap abierto de foto de equipo — sigue deliberadamente excluido hasta que el usuario lo retome (ver actualización 2026-08-02 arriba).
