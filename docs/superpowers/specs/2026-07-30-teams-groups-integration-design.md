# Equipos: integración real de grupos (Etapa 2 de 3)

## Contexto

Etapa 1 (Equipos) ya cerró — equipos pegan contra el backend real, gaps 1/2/5/6/7 de `docs/BACKEND_API_GAPS.md` resueltos. El backend sumó CRUD completo de `/groups` (confirmado en swagger 2026-07-30): `GET /groups?team_id&user_id`, `POST /groups`, `GET/PUT/DELETE /groups/{id}`, `GET /groups/{id}/users`, `DELETE /groups/{id}/users/{user_id}`, `POST /teams/{id}/groups/{group_id}/users`. Esta etapa conecta grupos (hoy 100% sintéticos en `store/team-store.js`) contra esos endpoints.

**Fuera de alcance, decisión explícita del usuario (2026-07-30):** planes de entrenamiento. El equipo prioriza el módulo de cobros/suscripciones (en desarrollo en paralelo). `TRAINING_PLAN_OPTIONS` sigue siendo un catálogo mock, `trainingPlanId` sigue local-only en el modelo de grupo, se sigue descartando del payload al backend — cero cambios ahí.

**Fuera de alcance, no bloqueante:** membresía real de grupo (`GET /groups/{id}/users`, agregar/sacar corredor). El roster (`team.members`) sigue siendo sintético (`generateMockMembers`, ids `${teamId}-runner-{i}`) — no hay usuarios reales todavía (Etapa 3, invitaciones, sin arrancar). El "Mover de grupo" del menú de corredores (Etapa 1) sigue deshabilitado.

## Decisión de diseño: grupo principal real vía `create_default_group`

Hoy `store/team-store.js#buildDefaultGroup` inventa un grupo "Sin grupo" (`id: '${teamId}-group-default'`, `isDefault: true`) client-side — no existe en el backend. El backend tiene `create_default_group: boolean` en `team.CreateTeamRequest` y `is_main: boolean` en cada grupo.

**Decisión (confirmada con el usuario):** `POST /teams` siempre manda `create_default_group: true`. El backend crea el grupo principal real. Se elimina `buildDefaultGroup`/`DEFAULT_GROUP_NAME` — todo equipo, desde su creación, tiene grupos 100% reales. El campo `isDefault` se mantiene en el modelo de grupo del cliente (todos los call sites existentes que lo usan — `!group.isDefault` para ocultar edición, `groups.find(g => g.isDefault)` para el fallback de invitaciones — siguen funcionando sin tocarse), pero ahora se puebla desde `dto.is_main` real.

No se sabe de antemano qué `name` le pone el backend al grupo automático — se verifica en preview durante Task de verificación, sin bloquear el resto del plan (el nombre es solo cosmético, no afecta lógica).

## Modelo de datos

`services/normalizers.js` — nuevas funciones (mismo estilo que `toTeamModel`/`toCreateTeamPayload`):

```js
export function toGroupModel(dto) {
  if (!dto) return null;
  return {
    id: String(dto.id),
    teamId: String(dto.team_id),
    name: dto.name,
    description: dto.description,
    isDefault: dto.is_main ?? false,
    trainingPlanId: null, // sin campo en el backend, ver docs/BACKEND_API_GAPS.md gap 4
    createdAt: dto.created_at,
    updatedAt: dto.updated_at,
  };
}

export function toCreateGroupPayload(teamId, form) {
  const payload = { team_id: Number(teamId), name: form.name };
  if (form.description && form.description.trim()) payload.description = form.description.trim();
  return payload;
}

export function toUpdateGroupPayload(form) {
  const payload = {};
  if (form.name && form.name.trim()) payload.name = form.name.trim();
  if (form.description !== undefined) payload.description = form.description ? form.description.trim() : null;
  return payload;
}
```

`toCreateTeamPayload` suma `create_default_group: true` siempre (no condicional — no hay caso donde no se quiera).

`trainingPlanId` en `toGroupModel` queda hardcodeado a `null` — cuando exista un grupo recién creado con un plan elegido en el wizard, ese valor sigue viniendo del estado local del store (`decorateTeam`-equivalente), no de `toGroupModel`; ver más abajo.

## `services/groups.js` (nuevo)

Mismo patrón `USE_MOCKS` que `services/teams.js`:

```
listGroups(teamId, userId)              // GET /groups?team_id=&user_id=
getGroup(groupId)                        // GET /groups/{id}
createGroup(payload)                     // POST /groups
updateGroup(groupId, updates)            // PUT /groups/{id}
deleteGroup(groupId)                     // DELETE /groups/{id}
```

`getGroup`/futuros endpoints de membresía (`getGroupUsers`, `addGroupUser`, `removeGroupUser`) se agregan igual que en Etapa 1 aunque sin consumidor todavía — mismo criterio ya usado con `addTeamUser`/`removeTeamUser`.

`services/__mocks__/groups-mock.js` (nuevo) — mismo patrón stateful que `teams-mock.js`. `mockCreateTeam` en `teams-mock.js` debe además, cuando `payload.create_default_group`, crear automáticamente un grupo semilla en `mockGroups` (`is_main: true`, `name: 'General'`) para que el mock se comporte igual que se espera del backend real.

## `store/team-store.js`

**Se elimina:** `buildDefaultGroup`, `DEFAULT_GROUP_NAME`. `generateMockMembers` dejar de invocarse desde `decorateTeam` — se mueve a donde los grupos reales ya se conocen (ver `fetchGroups` abajo), porque ya no hay garantía de tener un grupo sintético instantáneo.

**`decorateTeam`:** ya no arma `groups`/`members` — un equipo recién decorado arranca `groups: []`, `members: []`. Los llena `fetchGroups` (para equipos existentes) o el flujo de `createTeam` (para uno nuevo).

**Nueva acción `fetchGroups(teamId, userId)`:**
```js
fetchGroups: async (teamId, userId) => {
  try {
    const dtos = await listGroupsService(teamId, userId);
    const groups = dtos.map((dto) => {
      const model = toGroupModel(dto);
      const existing = get().teams.find((t) => t.id === teamId)?.groups.find((g) => g.id === model.id);
      return existing ? { ...model, trainingPlanId: existing.trainingPlanId } : model;
    });
    const members = generateMockMembers(teamId, groups);
    set((state) => ({
      teams: state.teams.map((t) => (t.id === teamId ? { ...t, groups, members } : t)),
    }));
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
},
```
(preserva `trainingPlanId` local ya elegido para un grupo que ya estaba en memoria — evita perder la elección del catálogo mock en cada refetch).

**`createTeam(payload)` — reescritura del tramo de grupos:**
1. `POST /teams` con `create_default_group: true` (vía `toCreateTeamPayload`, ya lo agrega siempre).
2. Igual que hoy: si hay dirección, encadenar `updateTeamAddress` (sin cambios, éxito parcial con `addressWarning`).
3. Por cada grupo en `payload.groups` (drafts del wizard, `{id: 'group-draft-...', name, description, trainingPlanId}`): `POST /groups` con `team_id` real. Si alguno falla, no aborta el resto — se seguen creando los que quedan, y el resultado final incluye `groupsWarning: true` (mismo patrón que `addressWarning`: la creación del equipo en sí ya es un éxito, no se revierte).
4. `GET /groups?team_id&user_id` para traer la lista real completa (incluye el principal auto-creado + los recién creados).
5. Mapear `trainingPlanId` de cada draft al grupo real correspondiente por **nombre** (los nombres son únicos dentro del wizard, ver `GroupListEditor#handleAdd`) — no hay otro id en común entre draft y respuesta real.
6. Antes de generar el roster mock, **remapear `payload.invitedEmails[].groupId`** de ids de draft a ids reales (mismo criterio: matchear por nombre del grupo draft). Si un invite no tenía grupo elegido, cae en el grupo `isDefault` real (el principal auto-creado) — mismo comportamiento que hoy, ahora contra un id real en vez de sintético.
7. `members: generateMockMembers(team.id, groups)`.

**`addInvitedEmails`:** sin cambios de firma — sigue usando `team.groups.find(g => g.isDefault)` como fallback, ahora resuelve contra el grupo real.

**Grupos dentro de un equipo ya existente — nuevas acciones:**
```js
createGroupInTeam: async (teamId, form) => { /* POST /groups, agrega a team.groups, sin tocar members (roster no cambia) */ },
updateGroupReal: async (groupId, teamId, form) => { /* PUT /groups/{id}, actualiza el grupo en team.groups, conserva trainingPlanId localmente si no vino en `form` */ },
deleteGroupReal: async (groupId, teamId) => { /* DELETE /groups/{id}, saca el grupo de team.groups; falla explícitamente si el grupo tiene miembros en el roster mock local (mismo mensaje que usaría el backend real) — no se intenta contra el grupo isDefault, la UI no ofrece el botón ahí */ },
```
(nombres finales `createGroupInTeam`/`updateGroupReal`/`deleteGroupReal` para no chocar con la función de servicio homónima importada — ajustar en el plan si el implementador encuentra un nombre más claro, no es una decisión de diseño relevante).

`updateGroup` (la acción síncrona actual, usada hoy por `edit-group-screen.jsx`) se elimina — reemplazada por `updateGroupReal`.

## Pantallas

- **`create-team-screen.jsx`:** sin cambios de UI — `GroupListEditor` sigue siendo el editor de borrador tal cual está. Solo cambia lo que pasa internamente en `createTeam` (arriba).
- **`team-detail-screen.jsx`, pestaña Grupos:** además del fetch-on-mount de equipo ya existente, sumar `fetchGroups(teamId, user.userId)` en el mismo `useEffect` (o uno análogo). Nuevo botón "+ Agregar grupo" en el header de la `SectionCard` de Grupos (mismo patrón visual que el de `GroupListEditor`) — abre un form chico inline o reusa `GroupListEditor` en modo de un solo grupo (a definir por el implementador, UI simple: nombre + descripción, sin plan — el plan ya no se ofrece para grupos creados fuera del wizard, evita la ambigüedad de qué hacer con `trainingPlanId` sin borrador previo). `GroupRow` suma botón de borrar (mismo ícono/lugar que el de `GroupListEditor`, `canEdit && !group.isDefault` también gatea el borrado).
- **`edit-group-screen.jsx`:** `handleSubmit` pasa a async, llama `updateGroupReal`, mismo patrón `submitting`/toast que `edit-team-screen.jsx`. Sigue sin ofrecer edición para `group.isDefault`.
- **`invite-team-members-screen.jsx`:** sin cambios — ya lee `team.groups`, que ahora viene poblado por `fetchGroups` en vez de sintético. Confirmar que su `useEffect` de fetch-on-mount (agregado en Etapa 1) también dispara `fetchGroups`.

## Tests

- `__tests__/normalizers.test.js`: `toGroupModel`, `toCreateGroupPayload`, `toUpdateGroupPayload` — mismo estilo que los de equipo.
- `__tests__/groups-mock.test.js` (nuevo): mismo estilo que `teams-mock.test.js`.
- `__tests__/team-store.test.js`: reescribir tests de `createTeam` que dependían de `buildDefaultGroup`/roster instantáneo (ahora async, después de `fetchGroups`/creación de grupos). Tests nuevos: `fetchGroups` (éxito, preserva `trainingPlanId` local, error), `createGroupInTeam`/`updateGroupReal`/`deleteGroupReal` (éxito/error), remapeo de `invitedEmails` por nombre en `createTeam`, éxito parcial cuando falla la creación de algún grupo extra (`groupsWarning`).
- `npm run lint` y `npm test` en verde en todo momento.

## Verificación

1. Mock end-to-end (`EXPO_PUBLIC_USE_MOCKS=true`): crear equipo con 2 grupos extra + invitar corredores a distintos grupos → confirmar que el equipo queda con 3 grupos reales (principal + 2), invitaciones apuntando a los grupos correctos.
2. Agregar grupo nuevo desde el detalle de un equipo ya existente → aparece en la lista, sobrevive a un reload (fetch real).
3. Editar/borrar un grupo no-principal → refleja el cambio, no ofrece la acción para el principal.
4. Backend real: mismo flujo que 1-3, más confirmar qué `name` le pone el backend al grupo automático (`create_default_group`) y ajustar si hace falta.
