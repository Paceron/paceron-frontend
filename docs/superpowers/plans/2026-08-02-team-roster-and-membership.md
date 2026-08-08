# Team roster real + acciones de membership — Plan B

> Plan corto, sin ronda de brainstorming — diseño ya cerrado en conversación (branch anterior, PR #62). Ejecución directa por el controller, en commits chicos, sin ceremonia SDD completa salvo que una tarea puntual lo amerite.

**Rama:** `feature/team-roster-membership-actions` (creada desde `develop` post-merge de PR #62).

## Alcance

1. Roster real (reemplaza `generateMockMembers`): `GET /teams/{id}/users` + `GET /groups/{id}/users` por grupo + `GET /auth/user?id=` (N+1, deduplicado) para nombre/email.
2. Primer uso real de TanStack Query (`@tanstack/react-query`, ya instalado, `QueryClientProvider` ya armado) — cachea/dedupea el N+1 de nombres entre grupos/equipos.
3. Entrenador: "Expulsar del equipo" y "Mover de grupo" desde `RunnerActionsMenu` (ya existen como placeholders deshabilitados en `team-detail-screen.jsx:179-190`).
4. Corredor: botón "Salir del grupo" (self-service), mismo spot que "Eliminar equipo" (`team-detail-screen.jsx:913`), gateado `!isTrainerView`.
5. Al borrar un grupo (`deleteGroupReal`), sus miembros pasan al grupo principal (fallback), no al backend, decisión de UI.

## Decisiones ya cerradas (no volver a preguntar)

- Expulsar = sale del equipo enteramente (`DELETE /teams/{id}/users/{user_id}`), no solo del grupo.
- Mover de grupo = `DELETE /groups/{id}/users/{user_id}` (grupo viejo) + `POST /teams/{id}/groups/{group_id}/users` (grupo nuevo) — 2 calls, sin transacción atómica en backend.
- Un corredor está en un solo grupo a la vez (el principal u otro).
- Backend no da nombre/email en `TeamUserResponse`/`GroupUserResponse` — solo `user_id`. No hay endpoint de lookup en lote. N+1 aceptado (gap 2 de esta sesión, no bloqueante).

## Archivos

- `services/groups.js`: agregar `addGroupUser(teamId, groupId, userId)` (`POST /teams/{id}/groups/{group_id}/users`) y `removeGroupUser(groupId, userId)` (`DELETE /groups/{id}/users/{user_id}`), + mocks en `groups-mock.js`.
- `services/normalizers.js`: `toTeamUserModel(dto)`, `toGroupUserModel(dto)` (solo userId/groupId/teamId, sin nombre — ese viene aparte).
- Nuevo `hooks/use-team-roster.js` (o similar): hook con `useQuery` que combina `getTeamUsers` + `getGroupUsers` por cada grupo + `getUser` por cada `user_id` único (con `queryKey: ['user', userId]` propio para que el cache de TanStack Query dedupe automáticamente entre grupos/pantallas).
- `store/team-store.js`: sacar `generateMockMembers`/`MOCK_ROSTER_SIZE`/`RUNNER_FIRST_NAMES`/etc. Las 2 llamadas que hoy generan mock (`createTeam`, `fetchTeam` o equivalente) dejan de poblar `members` sintético — el roster real lo trae el hook de arriba, no el store (separación deliberada: server-state vía Query, no Zustand, per CLAUDE.md).
- `components/team/team-detail-screen.jsx`: reemplazar el consumo de `team.members` por el hook nuevo; cablear `RunnerActionsMenu` (recibe `member`, expone `onExpel`/`onMove`, con confirm modal simple para expulsar); agregar botón "Salir del grupo" corredor; `deleteGroupReal` (o su caller) hace fallback de miembros al grupo principal antes/después del delete real.

## Orden sugerido (retomable si se corta la ventana)

1. Servicios + normalizers + mocks (mecánico, chico).
2. Hook de roster con TanStack Query (el corazón técnico — acá vale la pena pensar bien el cache key y el dedupe).
3. Store: sacar mock roster, pasar a que team-detail-screen use el hook.
4. UI: cablear expulsar + mover (con confirm) en `RunnerActionsMenu`.
5. UI: botón "Salir del grupo" corredor.
6. `deleteGroupReal`: fallback de miembros al grupo principal.
7. Tests + lint + 1 review final antes de pushear (mismo criterio ya acordado: 1 sola review, sonnet, al final).
