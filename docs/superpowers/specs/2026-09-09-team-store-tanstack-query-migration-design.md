# Migración de `team-store.js` a TanStack Query — Diseño

> Primer sub-proyecto de la migración general de estado-de-servidor de Zustand a TanStack Query (ver `CLAUDE.md`, sección Stack). Los otros dos sub-proyectos acordados — `training-plan-store.js`/`session-store.js`/`exercise-store.js`, y el split de `auth-store.js` en sesión (Zustand) + perfil (Query) — quedan fuera de este documento, cada uno con su propia spec cuando se aborden.

## 1. Contexto y motivación

`store/team-store.js` (483 líneas) es hoy el store más grande del repo y el único dominio grande que sigue 100% en Zustand pese a ser, en su mayoría, estado de servidor real (equipos, grupos, invitaciones — CRUD real contra el backend, no mocks). Esto es una decisión heredada ("tomada antes de que hubiera un caso concreto que justificara el cambio", `CLAUDE.md`) — desde entonces, cuatro dominios relacionados (`hooks/use-team-roster.js`, `use-team-search.js`, `use-join-requests.js`, `use-tier-subscription.js`) ya migraron a Query de forma orgánica, sin que `CLAUDE.md` se actualizara para reflejarlo.

Motivación concreta del usuario: hoy, crear un equipo o aceptar una invitación no actualiza el estado local — hace falta recargar la página entera para ver el cambio reflejado. El objetivo es que cada mutación invalide exactamente lo que cambió (ej. aceptar una invitación refresca el roster de ESE equipo, no fuerza un reload general).

## 2. Estado actual — mapeo completo

**Acciones de `team-store.js` que son estado de servidor real** (CRUD contra `services/teams.js`, `services/groups.js`, `services/invitations.js`):

| Acción | Dominio | Call sites |
|---|---|---|
| `fetchTeams`, `fetchMyMemberTeams` | equipos (lista) | `teams-list-screen.jsx`, `team-search-screen.jsx`, `assign-training-plan-screen.jsx` |
| `fetchTeam` | equipos (detalle) | `team-detail-screen.jsx`, `edit-team-screen.jsx`, `edit-group-screen.jsx`, `invite-team-members-screen.jsx` |
| `createTeam`, `updateTeam`, `uploadTeamIcon`, `deleteTeamIcon`, `deleteTeam` | equipos (mutations) | `create-team-screen.jsx`, `edit-team-screen.jsx`, `team-detail-screen.jsx` |
| `fetchGroups` | grupos (lista) | `team-detail-screen.jsx`, `edit-group-screen.jsx`, `invite-team-members-screen.jsx`, `assign-training-plan-screen.jsx` |
| `createGroupInTeam`, `updateGroupReal`, `deleteGroupReal` | grupos (mutations) | `team-detail-screen.jsx`, `edit-group-screen.jsx` |
| `fetchInvitations`, `sendInvite` | invitaciones (equipo → enviadas) | `invite-team-members-screen.jsx`, `create-team-screen.jsx` |
| `fetchMyInvitations` | invitaciones (usuario → recibidas) | `notifications-screen.jsx`, los 3 shells (`app-web-shell.jsx`, `app-web-shell-narrow.jsx`, `app-mobile-shell.jsx` — badge de contador) |
| `acceptMyInvitation`, `rejectMyInvitation` | invitaciones (mutations) | `notifications-screen.jsx` |

**Acciones que quedan fuera de esta migración (no son estado de servidor hoy):**

- **`selectTeam`/`selectedTeamId`** — código muerto, confirmado: ningún componente lee `selectedTeamId` ni llama `selectTeam` fuera del propio store. Se elimina directamente, no migra a nada.
- **`setGroupTrainingPlan`** (`store/team-store.js:479`) — no pega contra ningún endpoint real (gap 4 de `docs/BACKEND_API_GAPS.md` sin implementar todavía). Es estado local simulando un campo (`Group.training_plan_id`) que no existe en el backend hoy. Forzarlo a Query sería fingir una mutation sin fetcher real — queda en Zustand tal cual hasta que el backend implemente el campo, momento en el que sí se vuelve candidato real.

## 3. Diseño propuesto

### 3.1 Estructura de archivos

Tres hooks nuevos en `hooks/`, mismo estilo que `use-join-requests.js` (queries individuales exportadas + un hook `use<Dominio>Mutations()` que agrupa las mutations del dominio):

- **`hooks/use-teams.js`** — `useTeams()` (sin filtro, reemplaza `fetchTeams`), `useMyMemberTeams(userId)` (filtra `member_id` server-side, reemplaza `fetchMyMemberTeams`), `useTeam(teamId)`, `useTeamMutations()` (`createTeam`, `updateTeam`, `uploadTeamIcon`, `deleteTeamIcon`, `deleteTeam`).
- **`hooks/use-groups.js`** — `useGroups(teamId)`, `useGroupMutations(teamId)` (`createGroup`, `updateGroup`, `deleteGroup`).
- **`hooks/use-invitations.js`** — `useTeamInvitations(teamId)` (enviadas), `useMyInvitations()` (recibidas), `useInvitationMutations()` (`sendInvite`, `acceptInvitation`, `rejectInvitation`).

`team-store.js` se reduce a lo que de verdad es estado de cliente — hoy, después de sacar `selectTeam`/`selectedTeamId` (código muerto) y las 17 acciones de servidor, lo único que queda es `setGroupTrainingPlan`/`trainingPlanId` (ver §2). Vale la pena evaluar en el plan de implementación si en ese punto conviene borrar `team-store.js` entero y mover esa única pieza a un store más chico y explícito (ej. `group-plan-draft-store.js`), o dejarlo como está — decisión de detalle, no de diseño.

### 3.2 Query keys

Mismo estilo ya usado (arrays simples, sin librería de query-key-factory):

| Key | Query |
|---|---|
| `['teams']` | `useTeams` — sin filtro server-side (igual que hoy: `fetchTeams()` no manda parámetros, trae todo, y `selectAdministeredTeams(teams, userId)` filtra client-side — esa función se reutiliza tal cual, es pura, no le importa si el dato viene de Zustand o de Query) |
| `['teams-mine', userId]` | `useMyMemberTeams(userId)` — sí filtra server-side (`?member_id=`), reemplaza `fetchMyMemberTeams` |
| `['team', teamId]` | `useTeam` |
| `['groups', teamId]` | `useGroups` |
| `['invitations', teamId]` | `useTeamInvitations` (enviadas por el equipo) |
| `['invitations-mine']` | `useMyInvitations` (recibidas por el usuario) |

### 3.3 Invalidación por mutation

Todas las mutations invalidan de forma específica (no un `invalidateAll` amplio como en `use-join-requests.js` — ahí tiene sentido porque las 4 mutations comparten exactamente el mismo set de queries afectadas; acá los dominios son más heterogéneos):

| Mutation | Invalida |
|---|---|
| `createTeam` | `['teams']` (todas las variantes de filtro) |
| `updateTeam`, `uploadTeamIcon`, `deleteTeamIcon` | `['team', teamId]`, `['teams']` |
| `deleteTeam` | `['teams']` |
| `createGroup`, `updateGroup`, `deleteGroup` | `['groups', teamId]` |
| `sendInvite` | `['invitations', teamId]` |
| `acceptInvitation`, `rejectInvitation` | `['invitations-mine']`, **y** `['team-users', teamId]` (la query key que ya usa `use-team-roster.js`) — este es el caso motivador del usuario: aceptar una invitación agrega al usuario al roster de ese equipo, así que la mutation invalida directo la query del roster, sin código nuevo del lado de `use-team-roster.js`. |

**Nota sobre el badge de contador de invitaciones** (`fetchMyInvitations` en los 3 shells): hoy cada shell llama `fetchMyInvitations` por separado contra el mismo store — con Query, los 3 componentes que monten `useMyInvitations()` comparten la misma entrada de cache (`['invitations-mine']`), así que solo hay una request real aunque los 3 shells (mobile/web/web-narrow) estén "montados" en el sentido de que Expo Router solo renderiza uno a la vez según plataforma — este punto es más una confirmación de que Query dedupea correctamente que un cambio de comportamiento.

## 4. Fuera de alcance (reafirmado)

- `training-plan-store.js`, `session-store.js`, `exercise-store.js` — sub-proyecto 2, spec propia.
- `auth-store.js` (split sesión/perfil) — sub-proyecto 3, spec propia.
- Cualquier cambio de UI/UX en las pantallas tocadas — esta migración es de infraestructura de datos, no toca layout ni estilos. Si alguna pantalla necesita un loading/error state que hoy no tiene (los componentes de Zustand a veces manejaban error de forma implícita), se replica el mismo comportamiento visible de hoy, no se mejora de paso.

## 5. Testing

Mismo criterio que el resto del repo (`CLAUDE.md`, sección Testing): sin tests de render de componentes ni de hooks — se verifica manualmente en preview. Los hooks nuevos son wrappers finos sobre `services/teams.js`/`services/groups.js`/`services/invitations.js`, que ya tienen su propia cobertura de tests (servicios + mocks + normalizers) sin cambios en esta migración — la lógica pura ya testeada no se toca, solo cambia quién la orquesta (Query en vez de Zustand `set`).

## 6. Orden de trabajo sugerido (detalle real en el plan de implementación)

1. `use-teams.js` (queries + mutations) + migrar sus 3 call sites de lista/detalle.
2. `use-groups.js` + migrar sus call sites (comparten pantallas con equipos, conviene hacerlo justo después).
3. `use-invitations.js` + migrar sus call sites, con especial atención al caso de invalidación cruzada hacia el roster (§3.3).
4. Eliminar `selectTeam`/`selectedTeamId` de `team-store.js` (código muerto).
5. Actualizar `CLAUDE.md` (sección Stack) para reflejar el estado real post-migración — hoy ya está desactualizado respecto a los 4 dominios que migraron antes sin que el doc se tocara; esta migración es buena oportunidad para ponerlo al día de una vez.
