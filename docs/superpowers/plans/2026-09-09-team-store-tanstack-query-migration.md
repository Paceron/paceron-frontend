# Migración de team-store.js a TanStack Query — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrar los 17 métodos de `store/team-store.js` que son estado de servidor real (equipos, grupos, invitaciones) a TanStack Query, en 3 hooks nuevos, de forma que las mutations invaliden exactamente lo que cambió — sin recargar la página. `team-store.js` queda reducido a `setGroupTrainingPlan`/`trainingPlanId`, la única pieza que sigue siendo genuinamente estado local (sin endpoint real todavía).

**Architecture:** 3 hooks nuevos (`use-teams.js`, `use-groups.js`, `use-invitations.js`), mismo estilo que `hooks/use-join-requests.js` (queries individuales + un `use<Dominio>Mutations()` que agrupa las mutations del dominio). Cada mutationFn conserva EXACTO el mismo try/catch y el mismo shape de retorno (`{success, error?, ...}`) que tiene hoy en `team-store.js` — los 11 componentes consumidores no cambian su lógica de manejo de éxito/error, solo de dónde viene el dato y cómo se refresca. Un cambio de forma sí ocurre: `team.groups` deja de venir embebido en el objeto equipo (hoy `fetchGroups` lo mutaba ahí adentro) — pasa a ser el resultado independiente de `useGroups(teamId, userId)`. Todo consumidor que hoy lee `team.groups` pasa a leer `groups` de ese hook aparte.

**Tech Stack:** `@tanstack/react-query` (ya instalado, `QueryClientProvider` ya armado en `providers/app-providers.jsx`), Zustand (queda solo para lo que de verdad es cliente).

**Spec:** `docs/superpowers/specs/2026-09-09-team-store-tanstack-query-migration-design.md`

## Global Constraints

- Cada mutationFn mantiene el mismo try/catch y el mismo shape `{success, error?, ...extra}` que su acción equivalente en `team-store.js` hoy — nunca debe lanzar (`throw`) en el camino de error de negocio, los 11 consumidores siguen chequeando `if (!result.success)`.
- `onSuccess` de cada mutation solo invalida queries si `result.success === true` — Query llama `onSuccess` en cuanto el mutationFn resuelve sin excepción, sin importar el valor de `.success` adentro; hay que chequearlo a mano.
- `team.groups` deja de existir como campo embebido — cualquier lectura de `team.groups`/`team?.groups` en los consumidores pasa a ser `groups` de `useGroups(teamId, userId)`, llamado aparte.
- Ningún cambio de layout, estilos, ni de mensajes de Toast/error visibles al usuario — esta migración es de infraestructura de datos únicamente (ver spec §4).
- `npm test` y `npm run lint` en verde antes de cada commit (convención del repo, `CLAUDE.md`).
- Idioma: commits/PR en inglés el subject, español el cuerpo — mismo formato ya usado en todo el repo.

---

### Task 1: `hooks/use-teams.js`

**Files:**
- Create: `hooks/use-teams.js`

**Interfaces:**
- Consumes: `services/teams.js` (`createTeam`, `getTeam`, `listTeams`, `updateTeam`, `updateTeamAddress`, `deleteTeam`, `uploadTeamIcon`, `deleteTeamIcon`), `services/groups.js` (`createGroup`, `listGroups`), `services/normalizers.js` (`toTeamModel`, `toCreateTeamPayload`, `toUpdateTeamPayload`, `toAddressPayload`, `toGroupModel`, `toCreateGroupPayload`).
- Produces: `useTeams()` → `{ teams, loading, error }`. `useMyMemberTeams(userId)` → `{ teams, loading, error }`. `useTeam(teamId)` → `{ team, loading, error }`. `useTeamMutations()` → `{ createTeam, isCreating, updateTeam, isUpdating, uploadTeamIcon, isUploadingIcon, deleteTeamIcon, isDeletingIcon, deleteTeam, isDeleting }`, donde cada uno de esos 5 es una función `(args) => Promise<{success, ...}>` (el `mutateAsync` de su mutation).

- [ ] **Step 1: Crear el archivo con las 3 queries de lectura**

```js
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  createTeam as createTeamService,
  getTeam as getTeamService,
  listTeams as listTeamsService,
  updateTeam as updateTeamService,
  updateTeamAddress as updateTeamAddressService,
  deleteTeam as deleteTeamService,
  uploadTeamIcon as uploadTeamIconService,
  deleteTeamIcon as deleteTeamIconService,
} from '../services/teams.js';
import { createGroup as createGroupService, listGroups as listGroupsService } from '../services/groups.js';
import { toTeamModel, toCreateTeamPayload, toUpdateTeamPayload, toAddressPayload, toGroupModel, toCreateGroupPayload } from '../services/normalizers.js';

// Estado de servidor del dominio de equipos — TanStack Query, no Zustand
// (ver CLAUDE.md), mismo criterio que hooks/use-join-requests.js. Completa
// un equipo real con los campos que no vienen en la respuesta base de
// GET/POST /teams, mismo shape que decorateTeam tenía en store/team-store.js
// (ahora eliminado) — groups/members/invitations arrancan vacíos, cada uno
// se trae con su propio hook (useGroups acá, useTeamRoster para members,
// useTeamInvitations en use-invitations.js).
function decorateTeam(team) {
  return {
    ...team,
    status: team.status ?? 'activo',
    showGroupsToRunners: team.showGroupsToRunners ?? false,
  };
}

// Trae todos los equipos del sistema (GET /teams, sin filtro) — el filtro
// de "mis equipos como entrenador" sigue viviendo en selectAdministeredTeams
// (store/team-store.js, no se toca en esta migración: es una función pura,
// no le importa si `teams` viene de Zustand o de Query).
export function useTeams() {
  const query = useQuery({
    queryKey: ['teams'],
    queryFn: () => listTeamsService().then((dtos) => dtos.map((dto) => decorateTeam(toTeamModel(dto)))),
  });
  return { teams: query.data ?? [], loading: query.isLoading, error: query.error };
}

// Equipos donde el usuario es corredor (?member_id=, resuelto en backend).
// El backend agrega al dueño como team_user de su propio equipo — se
// filtra acá para que la vista de corredor no muestre equipos propios
// (mismo comentario que tenía fetchMyMemberTeams en team-store.js).
export function useMyMemberTeams(userId) {
  const query = useQuery({
    queryKey: ['teams-mine', userId],
    queryFn: () => listTeamsService({ memberId: userId }).then((dtos) =>
      dtos.map((dto) => toTeamModel(dto)).filter((team) => team.ownerId !== Number(userId))),
    enabled: Boolean(userId),
  });
  return { teams: query.data ?? [], loading: query.isLoading, error: query.error };
}

// Trae un equipo puntual (GET /teams/{id}) — para deep-link directo a
// detalle/edición de un equipo.
export function useTeam(teamId) {
  const query = useQuery({
    queryKey: ['team', teamId],
    queryFn: () => getTeamService(teamId).then((dto) => decorateTeam(toTeamModel(dto))),
    enabled: Boolean(teamId),
  });
  return { team: query.data ?? null, loading: query.isLoading, error: query.error };
}
```

- [ ] **Step 2: Agregar `useTeamMutations()` con las 5 mutations**

```js
// Las 5 mutations del dominio. createTeam replica exacto el flujo de 3
// pasos que tenía team-store.js#createTeam (crear equipo → dirección
// opcional → grupos extra del wizard opcionales → refetch de grupos
// reales) — sin los `set()` intermedios que tenía Zustand, porque nada
// lee ese estado a mitad de camino (create-team-screen.jsx solo muestra
// un spinner de `submitting` mientras corre, no un valor parcial).
export function useTeamMutations() {
  const queryClient = useQueryClient();

  const createTeamMutation = useMutation({
    mutationFn: async (payload) => {
      try {
        const created = await createTeamService(toCreateTeamPayload(payload));
        const teamId = String(created.id);
        let team = decorateTeam(toTeamModel(created));

        const hasAddress = Boolean(payload.country || payload.province || payload.city);
        let addressWarning;
        if (hasAddress) {
          try {
            await updateTeamAddressService(teamId, toAddressPayload(payload));
            team = { ...team, country: payload.country || null, province: payload.province || null, city: payload.city || null };
          } catch {
            addressWarning = true;
          }
        }

        const draftGroups = payload.groups ?? [];
        let groupsWarning;
        for (const draft of draftGroups) {
          try {
            await createGroupService(toCreateGroupPayload(teamId, draft));
          } catch {
            groupsWarning = true;
          }
        }

        const groupDtos = await listGroupsService(teamId, team.ownerId ?? payload.ownerId);
        const groups = groupDtos.map((dto) => {
          const model = toGroupModel(dto);
          const draft = draftGroups.find((d) => d.name === model.name);
          return draft ? { ...model, trainingPlanId: draft.trainingPlanId ?? null } : model;
        });

        return { success: true, team: { ...team, groups }, ...(addressWarning ? { addressWarning } : {}), ...(groupsWarning ? { groupsWarning } : {}) };
      } catch (error) {
        return { success: false, error: error.message };
      }
    },
    onSuccess: (result) => {
      if (result.success) queryClient.invalidateQueries({ queryKey: ['teams'] });
    },
  });

  const updateTeamMutation = useMutation({
    mutationFn: async ({ teamId, updates }) => {
      const { country: _country, province: _province, city: _city, ...clientOnlyAndGeneralUpdates } = updates;
      try {
        const updated = await updateTeamService(teamId, toUpdateTeamPayload(updates));
        const generalModel = toTeamModel(updated);
        let merged = {
          ...clientOnlyAndGeneralUpdates,
          name: generalModel.name,
          description: generalModel.description,
          level: generalModel.level,
          maxMembers: generalModel.maxMembers,
          requirements: generalModel.requirements,
          showGroupsToRunners: generalModel.showGroupsToRunners,
          status: generalModel.status,
          updatedAt: generalModel.updatedAt,
        };

        const hasAddress = Boolean(updates.country || updates.province || updates.city);
        if (!hasAddress) return { success: true, team: merged };

        try {
          await updateTeamAddressService(teamId, toAddressPayload(updates));
          merged = { ...merged, country: updates.country || null, province: updates.province || null, city: updates.city || null };
          return { success: true, team: merged };
        } catch {
          return { success: true, team: merged, addressWarning: true };
        }
      } catch (error) {
        return { success: false, error: error.message };
      }
    },
    onSuccess: (result, variables) => {
      if (result.success) {
        queryClient.invalidateQueries({ queryKey: ['team', variables.teamId] });
        queryClient.invalidateQueries({ queryKey: ['teams'] });
      }
    },
  });

  const uploadTeamIconMutation = useMutation({
    mutationFn: async ({ teamId, uri, mimeType }) => {
      try {
        const { icon_url: iconUrl } = await uploadTeamIconService(teamId, uri, mimeType);
        return { success: true, iconUrl };
      } catch (error) {
        return { success: false, error: error.message };
      }
    },
    onSuccess: (result, variables) => {
      if (result.success) {
        queryClient.invalidateQueries({ queryKey: ['team', variables.teamId] });
        queryClient.invalidateQueries({ queryKey: ['teams'] });
      }
    },
  });

  const deleteTeamIconMutation = useMutation({
    mutationFn: async (teamId) => {
      try {
        await deleteTeamIconService(teamId);
        return { success: true };
      } catch (error) {
        return { success: false, error: error.message };
      }
    },
    onSuccess: (result, teamId) => {
      if (result.success) {
        queryClient.invalidateQueries({ queryKey: ['team', teamId] });
        queryClient.invalidateQueries({ queryKey: ['teams'] });
      }
    },
  });

  const deleteTeamMutation = useMutation({
    mutationFn: async ({ teamId, userId }) => {
      try {
        await deleteTeamService(teamId, userId);
        return { success: true };
      } catch (error) {
        return { success: false, error: error.message };
      }
    },
    onSuccess: (result) => {
      if (result.success) queryClient.invalidateQueries({ queryKey: ['teams'] });
    },
  });

  return {
    createTeam: createTeamMutation.mutateAsync,
    isCreating: createTeamMutation.isPending,
    updateTeam: updateTeamMutation.mutateAsync,
    isUpdating: updateTeamMutation.isPending,
    uploadTeamIcon: uploadTeamIconMutation.mutateAsync,
    isUploadingIcon: uploadTeamIconMutation.isPending,
    deleteTeamIcon: deleteTeamIconMutation.mutateAsync,
    isDeletingIcon: deleteTeamIconMutation.isPending,
    deleteTeam: deleteTeamMutation.mutateAsync,
    isDeleting: deleteTeamMutation.isPending,
  };
}
```

- [ ] **Step 3: Verificar que no rompió nada**

Run: `npm run lint && npm test`
Expected: ambos en verde — este archivo es nuevo, sin consumidores todavía, no debería cambiar ningún resultado existente.

- [ ] **Step 4: Commit**

```bash
git add hooks/use-teams.js
git commit -m "feat(teams): add use-teams.js TanStack Query hooks"
```

---

### Task 2: Migrar `teams-list-screen.jsx` + `team-search-screen.jsx`

**Files:**
- Modify: `components/team/teams-list-screen.jsx:1-79`
- Modify: `components/team/team-search-screen.jsx` (líneas con `useTeamStore`, ver Step 2)

**Interfaces:**
- Consumes: `useTeams()`, `useMyMemberTeams(userId)` (Task 1).

- [ ] **Step 1: `teams-list-screen.jsx` — reemplazar el bloque de fetch manual por los hooks**

Reemplazar (líneas 1-79 del archivo actual):

```js
import { useEffect, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useThemeColors } from '../../theme/colors.js';
import { isWeb, isMobile } from '../../utils/platform.js';
import { useAuthStore } from '../../store/auth-store.js';
import { selectAdministeredTeams } from '../../store/team-store.js';
import { useTeams, useMyMemberTeams } from '../../hooks/use-teams.js';
import { useTeamsJoinRequestsMap } from '../../hooks/use-join-requests.js';
import { usePullToRefresh } from '../../hooks/use-pull-to-refresh.js';
import { SectionCard } from '../forms/section-card.jsx';
import { SkeletonBlock, SkeletonCircle } from '../shared/skeleton.jsx';
import { AvatarPicker } from '../shared/avatar-picker.jsx';
import { RequireAuth } from '../guards/require-auth.jsx';

function TeamRow({ team, onPress, hasPendingRequests }) {
  const colors = useThemeColors();
  return (
    <Pressable
      className="flex-row items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3.5 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:hover:bg-slate-800"
      nativeID={`teams-list-team-${team.id}`}
      onPress={onPress}
      testID={`teams-list-team-${team.id}`}
    >
      <View className="relative" nativeID={`teams-list-team-${team.id}-icon`} testID={`teams-list-team-${team.id}-icon`}>
        <AvatarPicker idPrefix={`teams-list-team-${team.id}-avatar`} placeholder="team" size={36} uri={team.iconUrl} />
        {hasPendingRequests && (
          <View className="absolute -right-1 -top-1 h-2 w-2 rounded-full bg-red-500" nativeID={`teams-list-team-${team.id}-pending-dot`} testID={`teams-list-team-${team.id}-pending-dot`} />
        )}
      </View>
      <Text className="flex-1 text-sm font-semibold text-slate-900 dark:text-white" nativeID={`teams-list-team-${team.id}-name`} testID={`teams-list-team-${team.id}-name`}>
        {team.name}
      </Text>
      <MaterialCommunityIcons color={colors.onSurfaceVariant} name="chevron-right" size={18} />
    </Pressable>
  );
}

function TeamsListScreenContent() {
  const router = useRouter();
  const colors = useThemeColors();
  const user = useAuthStore((s) => s.user);
  const hasTrainerRole = useAuthStore((s) => s.roles.some((r) => r.name === 'entrenador'));
  const activeRole = useAuthStore((s) => s.activeRole);
  const canCreateTeam = hasTrainerRole && activeRole === 'trainer';
  const { teams, loading: loadingTeams } = useTeams();
  const { teams: myMemberTeams, loading: loadingMyMemberTeams } = useMyMemberTeams(activeRole === 'runner' ? user?.userId : null);
  const administeredTeams = selectAdministeredTeams(teams, user?.userId);
  // Como entrenador ve los equipos que administra; como corredor, los que
  // integra — dos fuentes distintas (ver hooks/use-teams.js#useMyMemberTeams).
  const myTeams = activeRole === 'trainer' ? administeredTeams : myMemberTeams;
  const { byTeamId: pendingRequestsByTeamId } = useTeamsJoinRequestsMap(activeRole === 'trainer' ? administeredTeams.map((t) => t.id) : []);
  const loading = activeRole === 'trainer' ? loadingTeams : loadingMyMemberTeams;

  const queryClient = useQueryClient();
  const { refreshing, onRefresh } = usePullToRefresh(() => Promise.all([
    queryClient.invalidateQueries({ queryKey: activeRole === 'trainer' ? ['teams'] : ['teams-mine', user?.userId] }),
    queryClient.invalidateQueries({ queryKey: ['join-requests-team'] }),
  ]));
```

`enabled: Boolean(userId)` en `useMyMemberTeams` ya hace que la query no dispare cuando `activeRole === 'trainer'` (se le pasa `null`) — reemplaza el `useEffect` condicional que tenía antes.

- [ ] **Step 2: `team-search-screen.jsx` — mismo reemplazo**

Ubicar las líneas equivalentes (import de `team-store.js` en la línea 10, y las 4 líneas `useTeamStore((s) => s.X)` en 97-100 del archivo actual) y aplicar el mismo cambio: importar `useTeams`/`useMyMemberTeams` de `../../hooks/use-teams.js` en vez de `useTeamStore`/`fetchTeams`/`fetchMyMemberTeams` de `team-store.js` (mantener `selectAdministeredTeams`, que sigue viniendo de `team-store.js`). Reemplazar los `useEffect` que llamaban `fetchTeams()`/`fetchMyMemberTeams(user.userId)` — ya no hacen falta, los hooks fetchean solos.

- [ ] **Step 3: Verificar en preview**

Levantar `expo-web` (`preview_start`), loguear como corredor y como entrenador, confirmar que `/teams` y `/teams/search` listan igual que antes, sin loading infinito ni error en consola.

- [ ] **Step 4: Correr suite y commitear**

Run: `npm run lint && npm test`
Expected: ambos en verde.

```bash
git add components/team/teams-list-screen.jsx components/team/team-search-screen.jsx
git commit -m "feat(teams): migrate teams-list and team-search screens to use-teams.js"
```

---

### Task 3: `hooks/use-groups.js`

**Files:**
- Create: `hooks/use-groups.js`

**Interfaces:**
- Consumes: `services/groups.js` (`listGroups`, `createGroup`, `updateGroup`, `deleteGroup`, `getGroupUsers`, `addGroupUser`, `removeGroupUser`), `services/normalizers.js` (`toGroupModel`, `toCreateGroupPayload`, `toUpdateGroupPayload`).
- Produces: `useGroups(teamId, userId)` → `{ groups, loading, error }`. `useGroupMutations(teamId)` → `{ createGroup, isCreating, updateGroup, isUpdating, deleteGroup, isDeleting }`.

- [ ] **Step 1: Crear el archivo**

```js
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { listGroups as listGroupsService, createGroup as createGroupService, updateGroup as updateGroupService, deleteGroup as deleteGroupService, getGroupUsers as getGroupUsersService, addGroupUser as addGroupUserService, removeGroupUser as removeGroupUserService } from '../services/groups.js';
import { toGroupModel, toCreateGroupPayload, toUpdateGroupPayload } from '../services/normalizers.js';

// Estado de servidor del dominio de grupos — TanStack Query, no Zustand
// (ver CLAUDE.md). trainingPlanId sigue siendo local-only (sin campo en
// el backend, ver docs/BACKEND_API_GAPS.md gap 4) — este hook no lo toca,
// solo lo devuelve tal cual viene del catálogo mock ahora en
// store/team-store.js#TRAINING_PLAN_OPTIONS (fuera de esta migración).
export function useGroups(teamId, userId) {
  const query = useQuery({
    queryKey: ['groups', teamId],
    queryFn: () => listGroupsService(teamId, userId).then((dtos) => dtos.map((dto) => toGroupModel(dto))),
    enabled: Boolean(teamId && userId),
  });
  return { groups: query.data ?? [], loading: query.isLoading, error: query.error };
}

export function useGroupMutations(teamId) {
  const queryClient = useQueryClient();

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['groups', teamId] });

  const createGroupMutation = useMutation({
    mutationFn: async (form) => {
      try {
        const created = await createGroupService(toCreateGroupPayload(teamId, form));
        return { success: true, group: toGroupModel(created) };
      } catch (error) {
        return { success: false, error: error.message };
      }
    },
    onSuccess: (result) => { if (result.success) invalidate(); },
  });

  const updateGroupMutation = useMutation({
    mutationFn: async ({ groupId, form }) => {
      try {
        const updated = await updateGroupService(groupId, toUpdateGroupPayload(form));
        return { success: true, group: toGroupModel(updated) };
      } catch (error) {
        return { success: false, error: error.message };
      }
    },
    onSuccess: (result) => { if (result.success) invalidate(); },
  });

  // Antes de borrar, reasigna a sus miembros (si tiene) al grupo principal
  // del equipo — nadie queda "sin grupo" solo porque su grupo se borró.
  // Best-effort por miembro: si uno falla, sigue con el resto y borra el
  // grupo igual. El caller (team-detail-screen.jsx) le pasa el id del
  // grupo principal — este hook no necesita conocer la lista completa de
  // grupos para encontrarlo.
  const deleteGroupMutation = useMutation({
    mutationFn: async ({ groupId, defaultGroupId }) => {
      try {
        if (defaultGroupId && defaultGroupId !== groupId) {
          const groupUserDtos = await getGroupUsersService(groupId);
          for (const dto of groupUserDtos) {
            try {
              await removeGroupUserService(groupId, dto.user_id);
              await addGroupUserService(teamId, defaultGroupId, dto.user_id);
            } catch {
              // best-effort — ver comentario de arriba
            }
          }
        }
        await deleteGroupService(groupId);
        return { success: true };
      } catch (error) {
        return { success: false, error: error.message };
      }
    },
    onSuccess: (result) => { if (result.success) invalidate(); },
  });

  return {
    createGroup: createGroupMutation.mutateAsync,
    isCreating: createGroupMutation.isPending,
    updateGroup: updateGroupMutation.mutateAsync,
    isUpdating: updateGroupMutation.isPending,
    deleteGroup: deleteGroupMutation.mutateAsync,
    isDeleting: deleteGroupMutation.isPending,
  };
}
```

- [ ] **Step 2: Verificar**

Run: `npm run lint && npm test`
Expected: ambos en verde.

- [ ] **Step 3: Commit**

```bash
git add hooks/use-groups.js
git commit -m "feat(teams): add use-groups.js TanStack Query hooks"
```

---

### Task 4: `hooks/use-invitations.js`

**Files:**
- Create: `hooks/use-invitations.js`

**Interfaces:**
- Consumes: `services/invitations.js` (`inviteToTeam`, `listTeamInvitations`, `listMyInvitations`, `acceptInvitation`, `rejectInvitation`), `services/normalizers.js` (`toInvitationModel`, `toInvitePayload`).
- Produces: `useTeamInvitations(teamId)` → `{ invitations, loading, error }`. `useMyInvitations(userId, email)` → `{ invitations, loading, error }`. `useInvitationMutations()` → `{ sendInvite, isSending, acceptInvitation, isAccepting, rejectInvitation, isRejecting }`.

- [ ] **Step 1: Crear el archivo**

```js
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { inviteToTeam as inviteToTeamService, listTeamInvitations as listTeamInvitationsService, listMyInvitations as listMyInvitationsService, acceptInvitation as acceptInvitationService, rejectInvitation as rejectInvitationService } from '../services/invitations.js';
import { toInvitationModel, toInvitePayload } from '../services/normalizers.js';

// Estado de servidor del dominio de invitaciones — TanStack Query, no
// Zustand (ver CLAUDE.md).

// Invitaciones pendientes de un equipo (lado dueño).
export function useTeamInvitations(teamId) {
  const query = useQuery({
    queryKey: ['invitations', teamId],
    queryFn: () => listTeamInvitationsService(teamId).then((dtos) => dtos.map((dto) => toInvitationModel(dto))),
    enabled: Boolean(teamId),
  });
  return { invitations: query.data ?? [], loading: query.isLoading, error: query.error };
}

// Invitaciones pendientes del usuario actual (lado invitado). `email`
// solo lo usa el mock — el backend real ignora ese parámetro.
export function useMyInvitations(userId, email) {
  const query = useQuery({
    queryKey: ['invitations-mine'],
    queryFn: () => listMyInvitationsService(userId, email).then((dtos) => dtos.map((dto) => toInvitationModel(dto))),
    enabled: Boolean(userId),
  });
  return { invitations: query.data ?? [], loading: query.isLoading, error: query.error };
}

export function useInvitationMutations() {
  const queryClient = useQueryClient();

  const sendInviteMutation = useMutation({
    mutationFn: async ({ teamId, email, groupId }) => {
      try {
        await inviteToTeamService(teamId, toInvitePayload(email, groupId));
        return { success: true };
      } catch (error) {
        return { success: false, error: error.message };
      }
    },
    onSuccess: (result, variables) => {
      if (result.success) queryClient.invalidateQueries({ queryKey: ['invitations', variables.teamId] });
    },
  });

  // teamId acá no es parte del payload real (services/invitations.js#acceptInvitation
  // solo necesita invitationId + userId) — viaja en las variables de la
  // mutation únicamente para que onSuccess sepa qué roster invalidar. El
  // roster (useTeamRoster, TanStack Query) no se entera solo de que un
  // corredor nuevo se unió — sin esto, si el entrenador ya tiene el
  // equipo abierto, no lo ve aparecer hasta un refresh manual (caso
  // motivador de esta migración, ver spec §1).
  const acceptInvitationMutation = useMutation({
    mutationFn: async ({ invitationId, userId }) => {
      try {
        await acceptInvitationService(invitationId, userId);
        return { success: true };
      } catch (error) {
        return { success: false, error: error.message };
      }
    },
    onSuccess: (result, variables) => {
      if (!result.success) return;
      queryClient.invalidateQueries({ queryKey: ['invitations-mine'] });
      if (variables.teamId) queryClient.invalidateQueries({ queryKey: ['team-users', variables.teamId] });
      queryClient.invalidateQueries({ queryKey: ['group-users'] });
    },
  });

  const rejectInvitationMutation = useMutation({
    mutationFn: async ({ invitationId, userId }) => {
      try {
        await rejectInvitationService(invitationId, userId);
        return { success: true };
      } catch (error) {
        return { success: false, error: error.message };
      }
    },
    onSuccess: (result) => {
      if (result.success) queryClient.invalidateQueries({ queryKey: ['invitations-mine'] });
    },
  });

  return {
    sendInvite: sendInviteMutation.mutateAsync,
    isSending: sendInviteMutation.isPending,
    acceptInvitation: acceptInvitationMutation.mutateAsync,
    isAccepting: acceptInvitationMutation.isPending,
    rejectInvitation: rejectInvitationMutation.mutateAsync,
    isRejecting: rejectInvitationMutation.isPending,
  };
}
```

- [ ] **Step 2: Verificar**

Run: `npm run lint && npm test`
Expected: ambos en verde.

- [ ] **Step 3: Commit**

```bash
git add hooks/use-invitations.js
git commit -m "feat(teams): add use-invitations.js TanStack Query hooks"
```

---

### Task 5: Migrar `create-team-screen.jsx`

**Files:**
- Modify: `components/team/create-team-screen.jsx:9`, `:75-76`, `:127-168` (aprox., ver `handleSubmit`)

**Interfaces:**
- Consumes: `useTeamMutations()` (Task 1), `useInvitationMutations()` (Task 4).

- [ ] **Step 1: Reemplazar el import y las dos líneas de store**

Reemplazar:
```js
import { useTeamStore, getTeamMemberLimit, TRAINING_PLAN_OPTIONS } from '../../store/team-store.js';
```
por:
```js
import { getTeamMemberLimit, TRAINING_PLAN_OPTIONS } from '../../store/team-store.js';
import { useTeamMutations } from '../../hooks/use-teams.js';
import { useInvitationMutations } from '../../hooks/use-invitations.js';
```

Reemplazar (línea 75-76 actual):
```js
  const createTeam = useTeamStore((s) => s.createTeam);
  const sendInvite = useTeamStore((s) => s.sendInvite);
```
por:
```js
  const { createTeam } = useTeamMutations();
  const { sendInvite } = useInvitationMutations();
```

- [ ] **Step 2: Actualizar `handleSubmit` — `sendInvite` ahora toma un objeto**

En el loop de invitaciones (dentro de `handleSubmit`), cambiar:
```js
      const inviteResult = await sendInvite(result.team.id, invite.email, realGroup?.id);
```
por:
```js
      const inviteResult = await sendInvite({ teamId: result.team.id, email: invite.email, groupId: realGroup?.id });
```
`createTeam({...})` no cambia de firma — sigue tomando el mismo objeto payload de siempre, solo que ahora es `mutateAsync` de la mutation en vez de la acción de Zustand.

- [ ] **Step 3: Verificar en preview**

Crear un equipo nuevo (con al menos un grupo extra y una invitación) desde `/teams/create`, confirmar que redirige al detalle del equipo recién creado con el mismo comportamiento de siempre (toast de éxito, warnings de dirección/grupos si corresponde).

- [ ] **Step 4: Correr suite y commitear**

Run: `npm run lint && npm test`

```bash
git add components/team/create-team-screen.jsx
git commit -m "feat(teams): migrate create-team-screen to use-teams/use-invitations mutations"
```

---

### Task 6: Migrar `edit-team-screen.jsx`

**Files:**
- Modify: `components/team/edit-team-screen.jsx:9`, `:35-51`, `:86-100` (aprox.)

**Interfaces:**
- Consumes: `useTeam(teamId)`, `useTeamMutations()` (Task 1).

- [ ] **Step 1: `EditTeamScreenContent` — reemplazar `team`/`fetchTeam`/loading manual por `useTeam`**

Reemplazar:
```js
import { useTeamStore, getTeamMemberLimit } from '../../store/team-store.js';
```
por:
```js
import { getTeamMemberLimit } from '../../store/team-store.js';
import { useTeam, useTeamMutations } from '../../hooks/use-teams.js';
```

Reemplazar el cuerpo de `EditTeamScreenContent` (desde `const team = useTeamStore(...)` hasta el `useEffect` de `fetchTeam`, líneas 35-49 actuales):
```js
  const { team, loading } = useTeam(teamId);
```
(el `if (loading)`/`if (!team)` de más abajo quedan igual, ya no hace falta el `useState`/`useEffect` manual — `useTeam` ya expone `loading` resuelto).

- [ ] **Step 2: `EditTeamForm` — reemplazar `updateTeam`/`fetchTeam`**

Reemplazar:
```js
  const updateTeam = useTeamStore((s) => s.updateTeam);
  const fetchTeam = useTeamStore((s) => s.fetchTeam);

  const { refreshing, onRefresh } = usePullToRefresh(() => fetchTeam(teamId));
```
por:
```js
  const { updateTeam } = useTeamMutations();
  const queryClient = useQueryClient();

  const { refreshing, onRefresh } = usePullToRefresh(() => queryClient.invalidateQueries({ queryKey: ['team', teamId] }));
```
(agregar `import { useQueryClient } from '@tanstack/react-query';` si no está ya importado en el archivo).

- [ ] **Step 3: Actualizar el call site de `updateTeam` en el submit handler**

Buscar la llamada a `updateTeam(teamId, updates)` en el `handleSubmit` de `EditTeamForm` y cambiarla a:
```js
    const result = await updateTeam({ teamId, updates });
```

- [ ] **Step 4: Verificar en preview**

Editar nombre/descripción/dirección de un equipo desde `/teams/{id}/edit`, confirmar que persiste y que el detalle del equipo se actualiza al volver (sin recargar).

- [ ] **Step 5: Correr suite y commitear**

Run: `npm run lint && npm test`

```bash
git add components/team/edit-team-screen.jsx
git commit -m "feat(teams): migrate edit-team-screen to use-teams.js"
```

---

### Task 7: Migrar `edit-group-screen.jsx`

**Files:**
- Modify: `components/team/edit-group-screen.jsx:9`, `:31-34`, `:47-73` (efectos de carga), `:127` (submit)

**Interfaces:**
- Consumes: `useTeam(teamId)` (Task 1), `useGroups(teamId, userId)`, `useGroupMutations(teamId)` (Task 3).

- [ ] **Step 1: Reemplazar import y las 4 líneas de store**

Reemplazar:
```js
import { useTeamStore, TRAINING_PLAN_OPTIONS } from '../../store/team-store.js';
```
por:
```js
import { TRAINING_PLAN_OPTIONS } from '../../store/team-store.js';
import { useTeam } from '../../hooks/use-teams.js';
import { useGroups, useGroupMutations } from '../../hooks/use-groups.js';
```

Reemplazar:
```js
  const team = useTeamStore((s) => s.teams.find((t) => t.id === teamId));
  const updateGroupReal = useTeamStore((s) => s.updateGroupReal);
  const fetchTeam = useTeamStore((s) => s.fetchTeam);
  const fetchGroups = useTeamStore((s) => s.fetchGroups);
  const group = team?.groups.find((g) => g.id === groupId);
```
por:
```js
  const { team, loading: loadingTeam } = useTeam(teamId);
  const { groups, loading: loadingGroups } = useGroups(teamId, user?.userId);
  const { updateGroup } = useGroupMutations(teamId);
  const group = groups.find((g) => g.id === groupId);
```
(mover esta línea después de donde ya está definido `user` — `const user = useAuthStore((s) => s.user);` ya está arriba en el archivo, línea 30 actual, no hace falta moverla).

- [ ] **Step 2: Sacar los `useEffect`/`useState` de loading manual**

Los dos bloques `useEffect` (carga de `team` vía `fetchTeam`, carga de `groups` vía `fetchGroups`) y sus `useState(loadingTeam)`/`useState(loadingGroups)` ya no hacen falta — `useTeam`/`useGroups` los resuelven solos. Eliminarlos.

- [ ] **Step 3: Actualizar el call site de `updateGroupReal`**

Reemplazar:
```js
    const result = await updateGroupReal(teamId, groupId, { name: trimmed, description: description.trim() || null });
```
por:
```js
    const result = await updateGroup({ groupId, form: { name: trimmed, description: description.trim() || null } });
```

- [ ] **Step 4: Verificar en preview**

Editar nombre/descripción de un grupo desde `/teams/{id}/groups/{groupId}/edit`, confirmar que persiste.

- [ ] **Step 5: Correr suite y commitear**

Run: `npm run lint && npm test`

```bash
git add components/team/edit-group-screen.jsx
git commit -m "feat(teams): migrate edit-group-screen to use-teams/use-groups"
```

---

### Task 8: Migrar `invite-team-members-screen.jsx`

**Files:**
- Modify: `components/team/invite-team-members-screen.jsx:8`, `:50-55`, `:70-101` (efectos), `:142` (submit), `:182-188` (lectura de invitaciones)

**Interfaces:**
- Consumes: `useTeam(teamId)` (Task 1), `useGroups(teamId, userId)` (Task 3), `useTeamInvitations(teamId)`, `useInvitationMutations()` (Task 4).

- [ ] **Step 1: Reemplazar import y las 5 líneas de store**

Reemplazar:
```js
import { useTeamStore } from '../../store/team-store.js';
```
por:
```js
import { useTeam } from '../../hooks/use-teams.js';
import { useGroups } from '../../hooks/use-groups.js';
import { useTeamInvitations, useInvitationMutations } from '../../hooks/use-invitations.js';
```

Reemplazar:
```js
  const team = useTeamStore((s) => s.teams.find((t) => t.id === teamId));
  const fetchTeam = useTeamStore((s) => s.fetchTeam);
  const fetchInvitations = useTeamStore((s) => s.fetchInvitations);
  const sendInvite = useTeamStore((s) => s.sendInvite);
  const user = useAuthStore((s) => s.user);
  const fetchGroups = useTeamStore((s) => s.fetchGroups);
```
por:
```js
  const user = useAuthStore((s) => s.user);
  const { team, loading: loadingTeam } = useTeam(teamId);
  const { groups, loading: loadingGroups } = useGroups(teamId, user?.userId);
  const { invitations, loading: loadingInvitations } = useTeamInvitations(teamId);
  const { sendInvite } = useInvitationMutations();
```

- [ ] **Step 2: Sacar los 3 `useEffect`/`useState` de loading manual, y el `usePullToRefresh` de fetches manuales**

Eliminar los bloques `useEffect` de `fetchTeam`, `fetchInvitations`, `fetchGroups` y sus `useState` de loading asociados — ya resueltos por los hooks. Reemplazar:
```js
  const { refreshing, onRefresh } = usePullToRefresh(() => Promise.all([
    fetchTeam(teamId),
    fetchInvitations(teamId),
    user?.userId ? fetchGroups(teamId, user.userId) : Promise.resolve(),
  ]));
```
por:
```js
  const queryClient = useQueryClient();
  const { refreshing, onRefresh } = usePullToRefresh(() => Promise.all([
    queryClient.invalidateQueries({ queryKey: ['team', teamId] }),
    queryClient.invalidateQueries({ queryKey: ['invitations', teamId] }),
    queryClient.invalidateQueries({ queryKey: ['groups', teamId] }),
  ]));
```
(agregar `import { useQueryClient } from '@tanstack/react-query';` si no está ya).

El `if (loadingTeam || loadingInvitations || loadingGroups)` de más abajo queda igual, ya con las 3 variables provistas por los hooks.

- [ ] **Step 3: Actualizar `handleSendInvites` y las referencias a `team.invitations`**

Reemplazar:
```js
      const result = await sendInvite(teamId, invite.email, invite.groupId);
```
por:
```js
      const result = await sendInvite({ teamId, email: invite.email, groupId: invite.groupId });
```

Reemplazar las dos referencias a `team.invitations` (`team.invitations.length === 0`, `team.invitations.map(...)`) por `invitations.length === 0`/`invitations.map(...)` (la variable ya extraída de `useTeamInvitations` en Step 1).

- [ ] **Step 4: Verificar en preview**

Enviar una invitación nueva desde `/teams/{id}/invite`, confirmar que aparece en el listado de pendientes sin recargar la página.

- [ ] **Step 5: Correr suite y commitear**

Run: `npm run lint && npm test`

```bash
git add components/team/invite-team-members-screen.jsx
git commit -m "feat(teams): migrate invite-team-members-screen to use-teams/use-groups/use-invitations"
```

---

### Task 9: Migrar `assign-training-plan-screen.jsx` (parte de equipos/grupos)

**Files:**
- Modify: `components/plans/assign-training-plan-screen.jsx:10`, `:35-37`, `:50-59`, `:70-75` (aprox.)

**Interfaces:**
- Consumes: `useTeams()` (Task 1), `useGroups(teamId, userId)` (Task 3). No toca `useTrainingPlanStore` (`assignToGroup`/`assignToRunner`) — eso es del sub-proyecto 2, fuera de alcance.

- [ ] **Step 1: Reemplazar import y las 3 líneas de store de equipos**

Reemplazar:
```js
import { useTeamStore, selectAdministeredTeams } from '../../store/team-store.js';
```
por:
```js
import { selectAdministeredTeams } from '../../store/team-store.js';
import { useTeams } from '../../hooks/use-teams.js';
import { useGroups } from '../../hooks/use-groups.js';
```

Reemplazar:
```js
  const teams = useTeamStore((s) => s.teams);
  const fetchTeams = useTeamStore((s) => s.fetchTeams);
  const fetchGroups = useTeamStore((s) => s.fetchGroups);
  const administeredTeams = selectAdministeredTeams(teams, user?.userId);

  const [loadingTeams, setLoadingTeams] = useState(true);
```
por:
```js
  const { teams, loading: loadingTeams } = useTeams();
  const administeredTeams = selectAdministeredTeams(teams, user?.userId);
```

- [ ] **Step 2: Sacar el `useEffect` de `fetchTeams`, agregar `useGroups` para el equipo seleccionado**

Eliminar el `useEffect` que llamaba `fetchTeams()`. Reemplazar el `useEffect` que llamaba `fetchGroups(teamId, user.userId)` por:
```js
  const { groups: selectedTeamGroups } = useGroups(teamId, user?.userId);
```
(reemplaza el `useEffect` entero — ya no hace falta dispararlo a mano, `useGroups` reacciona solo a que cambie `teamId`).

- [ ] **Step 3: Reemplazar el uso de `selectedTeam.groups`**

Buscar `selectedTeam?.groups.map((g) => g.id)` (usado para armar el roster vía `useTeamRoster`) y reemplazarlo por `selectedTeamGroups.map((g) => g.id)`.

- [ ] **Step 4: Actualizar el `usePullToRefresh`**

Reemplazar las líneas `fetchTeams()` y `fetchGroups(teamId, user?.userId)` dentro del `Promise.all` del `usePullToRefresh` por:
```js
    queryClient.invalidateQueries({ queryKey: ['teams'] }),
    teamId ? queryClient.invalidateQueries({ queryKey: ['groups', teamId] }) : Promise.resolve(),
```

- [ ] **Step 5: Verificar en preview**

Desde un plan de entrenamiento, ir a "Asignar", confirmar que el picker de equipo/grupo/corredor sigue funcionando igual.

- [ ] **Step 6: Correr suite y commitear**

Run: `npm run lint && npm test`

```bash
git add components/plans/assign-training-plan-screen.jsx
git commit -m "feat(teams): migrate assign-training-plan-screen team/group reads to use-teams/use-groups"
```

---

### Task 10: Migrar `team-detail-screen.jsx`

**Files:**
- Modify: `components/team/team-detail-screen.jsx` — 11 puntos de contacto (ver Interfaces), archivo grande (1204 líneas), el más invasivo de la migración.

**Interfaces:**
- Consumes: `useTeam(teamId)`, `useTeamMutations()` (Task 1), `useGroups(teamId, userId)`, `useGroupMutations(teamId)` (Task 3).

- [ ] **Step 1: Reemplazar import y el bloque de hooks de equipo/grupos**

Reemplazar la línea:
```js
import { useTeamStore, TRAINING_PLAN_OPTIONS } from '../../store/team-store.js';
```
por:
```js
import { TRAINING_PLAN_OPTIONS } from '../../store/team-store.js';
import { useTeam, useTeamMutations } from '../../hooks/use-teams.js';
import { useGroups, useGroupMutations } from '../../hooks/use-groups.js';
```

Reemplazar (líneas 513-518, 532-533 actuales):
```js
  const team = useTeamStore((s) => s.teams.find((t) => t.id === teamId));
  const fetchTeam = useTeamStore((s) => s.fetchTeam);
  const deleteTeam = useTeamStore((s) => s.deleteTeam);
  const fetchGroups = useTeamStore((s) => s.fetchGroups);
  const createGroupInTeam = useTeamStore((s) => s.createGroupInTeam);
  const deleteGroupReal = useTeamStore((s) => s.deleteGroupReal);
  ...
  const uploadTeamIcon = useTeamStore((s) => s.uploadTeamIcon);
  const deleteTeamIcon = useTeamStore((s) => s.deleteTeamIcon);
```
por (en el mismo lugar donde estaba `const team = ...`, ya con `user` definido más arriba en el archivo):
```js
  const { team, loading: loadingTeam } = useTeam(teamId);
  const { groups, loading: loadingGroups } = useGroups(teamId, user?.userId);
  const { deleteTeam, uploadTeamIcon, deleteTeamIcon } = useTeamMutations();
  const { createGroup: createGroupInTeam, deleteGroup: deleteGroupReal } = useGroupMutations(teamId);
```
(se renombran `createGroup`/`deleteGroup` a `createGroupInTeam`/`deleteGroupReal` en el destructuring — evita tocar el resto del archivo, que ya llama a esos nombres en los handlers).

- [ ] **Step 2: Sacar los `useEffect`/`useState` de loading manual de equipo y grupos**

Eliminar el `useState(loadingGroups)` (línea 519 actual) y los dos `useEffect` (líneas 768-787 actuales, `fetchTeam(teamId)` y `fetchGroups(teamId, user.userId)`) — ya resueltos por `useTeam`/`useGroups`. `loadingTeam` ya no necesita su propio `useState` tampoco (línea 657 actual, `const [loadingTeam, setLoadingTeam] = useState(!team);`) — viene directo de `useTeam`.

- [ ] **Step 3: Reemplazar TODAS las referencias a `team.groups`/`team?.groups` por `groups`**

Este archivo tiene 8 referencias a `team.groups`/`team?.groups` (líneas 571, 612, 685, 744-745, 800, 940, 1024, 1166 en el archivo actual — buscar con `grep -n "team.groups\|team?.groups"` para confirmar el listado exacto en el momento de aplicar el cambio, puede haber corrido de línea por los steps anteriores). Cada una pasa a leer `groups` (la variable ya extraída en Step 1) en vez de `team.groups`. Ejemplos concretos:

```js
// Antes:
const { members: allMembers, loading: loadingRoster } = useTeamRoster(team?.id, team?.groups.map((g) => g.id) ?? []);
// Después:
const { members: allMembers, loading: loadingRoster } = useTeamRoster(team?.id, groups.map((g) => g.id) ?? []);
```

```js
// Antes:
if (team.groups.some((g) => g.name.toLowerCase() === trimmed.toLowerCase())) {
// Después:
if (groups.some((g) => g.name.toLowerCase() === trimmed.toLowerCase())) {
```

```js
// Antes:
team.groups.forEach((g) => queryClient.invalidateQueries({ queryKey: ['group-users', g.id] }));
// Después:
groups.forEach((g) => queryClient.invalidateQueries({ queryKey: ['group-users', g.id] }));
```

```js
// Antes:
const myGroup = team?.groups.find((g) => g.id === myMembership?.groupId);
const defaultGroup = team?.groups.find((g) => g.isDefault);
// Después:
const myGroup = groups.find((g) => g.id === myMembership?.groupId);
const defaultGroup = groups.find((g) => g.isDefault);
```

```js
// Antes:
const groupOptions = useMemo(() => (team ? team.groups.map((g) => ({ id: g.id, name: g.name })) : []), [team]);
// Después:
const groupOptions = useMemo(() => groups.map((g) => ({ id: g.id, name: g.name })), [groups]);
```

```js
// Antes (dentro del map de RunnerRow):
groupName={team.groups.find((g) => g.id === member.groupId)?.name ?? '—'}
// Después:
groupName={groups.find((g) => g.id === member.groupId)?.name ?? '—'}
```

```js
// Antes (sort + render de la sección Grupos):
{[...team.groups].sort((a, b) => (b.isDefault ? 1 : 0) - (a.isDefault ? 1 : 0)).map((group) => (
// Después:
{[...groups].sort((a, b) => (b.isDefault ? 1 : 0) - (a.isDefault ? 1 : 0)).map((group) => (
```

```js
// Antes (prop pasada a un sub-componente, buscar `groups={team.groups}`):
groups={team.groups}
// Después:
groups={groups}
```

- [ ] **Step 4: Actualizar los call sites de `deleteTeam`/`uploadTeamIcon`/`deleteTeamIcon`/`createGroupInTeam`/`deleteGroupReal`**

Estas 5 funciones ahora toman un objeto (mutations de Task 1/3) en vez de argumentos posicionales. Actualizar cada handler:

```js
// handleConfirmDelete — antes: await deleteTeam(team.id, user.userId);
const result = await deleteTeam({ teamId: team.id, userId: user.userId });
```
```js
// handlePickIcon — antes: await uploadTeamIcon(team.id, asset.uri, asset.mimeType);
const uploadResult = await uploadTeamIcon({ teamId: team.id, uri: asset.uri, mimeType: asset.mimeType });
```
```js
// handleRemoveIcon — antes: await deleteTeamIcon(team.id);
const result = await deleteTeamIcon(team.id); // sin cambio de forma — deleteTeamIconMutation toma directo el teamId, no un objeto
```
```js
// handleAddGroup — antes: await createGroupInTeam(team.id, { name: trimmed, description: ..., trainingPlanId: ... });
const result = await createGroupInTeam({ name: trimmed, description: newGroupDescription.trim() || null, trainingPlanId: newGroupPlan || null });
// nota: createGroup ya no recibe teamId como argumento — useGroupMutations(teamId) ya lo cerró sobre el teamId del hook
```
```js
// handleDeleteGroup — antes: await deleteGroupReal(team.id, group.id);
const defaultGroupId = groups.find((g) => g.isDefault)?.id;
const result = await deleteGroupReal({ groupId: group.id, defaultGroupId });
```

- [ ] **Step 5: Verificación final de que no queda ninguna referencia vieja**

Run: `grep -n "team.groups\|team?.groups\|useTeamStore" components/team/team-detail-screen.jsx`
Expected: sin resultados (0 matches) — si aparece algo, es una referencia que Step 3/1 no cubrió, corregir antes de seguir.

- [ ] **Step 6: Verificar en preview**

Recorrer `/teams/{id}` completo: subir/borrar ícono, crear grupo, borrar grupo (confirmar que reasigna miembros al grupo principal), borrar equipo — mismo comportamiento visible que antes.

- [ ] **Step 7: Correr suite y commitear**

Run: `npm run lint && npm test`

```bash
git add components/team/team-detail-screen.jsx
git commit -m "feat(teams): migrate team-detail-screen to use-teams/use-groups"
```

---

### Task 11: Migrar `notifications-screen.jsx`

**Files:**
- Modify: `components/notifications/notifications-screen.jsx:10`, `:161-163` (`TrainerPendingRequestsSection`), `:211-260` (aprox., `NotificationsScreenContent`)

**Interfaces:**
- Consumes: `useTeams()` (Task 1), `useMyInvitations(userId, email)`, `useInvitationMutations()` (Task 4).

- [ ] **Step 1: Reemplazar import**

Reemplazar:
```js
import { useTeamStore, selectAdministeredTeams } from '../../store/team-store.js';
```
por:
```js
import { selectAdministeredTeams } from '../../store/team-store.js';
import { useTeams } from '../../hooks/use-teams.js';
import { useMyInvitations, useInvitationMutations } from '../../hooks/use-invitations.js';
```

- [ ] **Step 2: `TrainerPendingRequestsSection` — reemplazar `teams`**

Reemplazar:
```js
  const teams = useTeamStore((s) => s.teams);
```
por:
```js
  const { teams } = useTeams();
```

- [ ] **Step 3: `NotificationsScreenContent` — reemplazar invitaciones y sus mutations**

Reemplazar:
```js
  const myInvitations = useTeamStore((s) => s.myInvitations);
  const fetchMyInvitations = useTeamStore((s) => s.fetchMyInvitations);
  const acceptMyInvitation = useTeamStore((s) => s.acceptMyInvitation);
  const rejectMyInvitation = useTeamStore((s) => s.rejectMyInvitation);

  const [loadingInvitations, setLoadingInvitations] = useState(true);
```
por:
```js
  const { invitations: myInvitations, loading: loadingInvitations } = useMyInvitations(user?.userId, user?.email);
  const { acceptInvitation, rejectInvitation } = useInvitationMutations();
```

Eliminar el `useEffect` que llamaba `fetchMyInvitations(user.userId, user.email)` — ya resuelto por `useMyInvitations`.

- [ ] **Step 4: Actualizar `handleAccept`/`handleReject` — el roster ya se invalida solo**

Reemplazar:
```js
  const handleAccept = async (invitationId) => {
    const invitation = myInvitations.find((i) => i.id === invitationId);
    setRespondingId(invitationId);
    const result = await acceptMyInvitation(invitationId, user.userId);
    setRespondingId(null);
    if (!result.success) {
      Toast.show({ type: 'error', text1: 'No pudimos aceptar la invitación', text2: result.error });
      return;
    }
    // El roster (useTeamRoster, TanStack Query) no se entera solo — si el
    // entrenador ya tiene el equipo abierto, el corredor recién unido no
    // aparece hasta un refresh manual sin esto.
    if (invitation?.teamId) queryClient.invalidateQueries({ queryKey: ['team-users', invitation.teamId] });
    queryClient.invalidateQueries({ queryKey: ['group-users'] });
    Toast.show({ type: 'success', text1: 'Te uniste al equipo' });
  };
```
por:
```js
  const handleAccept = async (invitationId) => {
    const invitation = myInvitations.find((i) => i.id === invitationId);
    setRespondingId(invitationId);
    // El roster (['team-users', teamId]) y ['group-users'] ya se invalidan
    // solos dentro de useInvitationMutations#acceptInvitation — no hace
    // falta repetirlo acá.
    const result = await acceptInvitation({ invitationId, userId: user.userId, teamId: invitation?.teamId });
    setRespondingId(null);
    if (!result.success) {
      Toast.show({ type: 'error', text1: 'No pudimos aceptar la invitación', text2: result.error });
      return;
    }
    Toast.show({ type: 'success', text1: 'Te uniste al equipo' });
  };
```

Reemplazar:
```js
    const result = await rejectMyInvitation(invitationId, user.userId);
```
por:
```js
    const result = await rejectInvitation({ invitationId, userId: user.userId });
```

- [ ] **Step 5: Actualizar el `usePullToRefresh`**

Reemplazar la línea `user?.userId ? fetchMyInvitations(user.userId, user.email) : Promise.resolve(),` dentro del `Promise.all` por:
```js
    queryClient.invalidateQueries({ queryKey: ['invitations-mine'] }),
```

- [ ] **Step 6: Verificar en preview — este es el caso motivador de toda la migración**

Con dos usuarios (o dos pestañas/sesiones), invitar a un corredor a un equipo, aceptar la invitación desde `/notifications`, y confirmar que el roster del equipo (si el entrenador lo tiene abierto en otra pestaña) se actualiza solo al volver a esa pestaña — sin recargar.

- [ ] **Step 7: Correr suite y commitear**

Run: `npm run lint && npm test`

```bash
git add components/notifications/notifications-screen.jsx
git commit -m "feat(teams): migrate notifications-screen to use-teams/use-invitations"
```

---

### Task 12: Migrar los 3 shells (badge de invitaciones)

**Files:**
- Modify: `components/shell/app-web-shell.jsx` (líneas con `useTeamStore`, ver Step 1)
- Modify: `components/shell/app-web-shell-narrow.jsx` (mismo patrón)
- Modify: `components/shell/app-mobile-shell.jsx` (mismo patrón)

**Interfaces:**
- Consumes: `useMyInvitations(userId, email)` (Task 4).

- [ ] **Step 1: Mismo reemplazo en los 3 archivos**

En cada uno, reemplazar:
```js
import { useTeamStore } from '../../store/team-store.js';
```
por:
```js
import { useMyInvitations } from '../../hooks/use-invitations.js';
```

Y reemplazar:
```js
  const fetchMyInvitations = useTeamStore((s) => s.fetchMyInvitations);
  const myInvitationsCount = useTeamStore((s) => s.myInvitations.length);
```
por:
```js
  const { invitations: myInvitations } = useMyInvitations(user?.userId, user?.email);
  const myInvitationsCount = myInvitations.length;
```

Y eliminar el `useEffect` que llamaba `fetchMyInvitations(user.userId, user.email)` en cada uno de los 3 archivos — ya resuelto por el hook (y ya deduplicado entre los 3 shells vía el mismo `queryKey: ['invitations-mine']`, aunque solo uno esté montado a la vez según plataforma).

- [ ] **Step 2: Verificar en preview**

Confirmar que el badge de notificaciones (círculo con contador) en el header/drawer sigue mostrando el número correcto de invitaciones pendientes, en web ancho, web angosto, y mobile (resize del preview para las 2 variantes web).

- [ ] **Step 3: Correr suite y commitear**

Run: `npm run lint && npm test`

```bash
git add components/shell/app-web-shell.jsx components/shell/app-web-shell-narrow.jsx components/shell/app-mobile-shell.jsx
git commit -m "feat(teams): migrate shell invitation badges to use-invitations.js"
```

---

### Task 13: Limpieza final — código muerto, `team-store.js`, `CLAUDE.md`, versión

**Files:**
- Modify: `store/team-store.js` (queda solo con `TEAM_MEMBER_LIMITS`, `getTeamMemberLimit`, `SUBSCRIPTION_STATUSES`, `TRAINING_PLAN_OPTIONS`, `selectAdministeredTeams`, y `setGroupTrainingPlan`/`trainingPlanId`)
- Modify: `CLAUDE.md` (sección Stack)
- Modify: `package.json` (versión)

**Interfaces:**
- No produce ni consume nada nuevo — es limpieza sobre lo ya migrado en Tasks 1-12.

- [ ] **Step 1: Confirmar que no queda ningún consumidor de las 17 acciones migradas**

Run: `grep -rn "useTeamStore((s) => s\.\(fetchTeams\|fetchMyMemberTeams\|fetchTeam\|fetchGroups\|createTeam\|updateTeam\|uploadTeamIcon\|deleteTeamIcon\|deleteTeam\|createGroupInTeam\|updateGroupReal\|deleteGroupReal\|fetchInvitations\|sendInvite\|fetchMyInvitations\|acceptMyInvitation\|rejectMyInvitation\|selectTeam\|selectedTeamId\)" components/`
Expected: sin resultados. Si aparece algo, es un consumidor que las Tasks 2-12 no cubrieron — corregirlo antes de tocar el store.

- [ ] **Step 2: Reescribir `store/team-store.js`**

Reemplazar el contenido completo del archivo por:

```js
import { create } from 'zustand';

// Tope de integrantes por tier del entrenador. 'base' es el plan free.
// 'pro'/'premium' hoy no los asigna ningun mock todavia (roles-mock.js
// siempre devuelve 'base'), pero el tope ya queda resuelto para cuando el
// sistema de tiers crezca mas alla de solo base/premium.
export const TEAM_MEMBER_LIMITS = {
  base: 10,
  pro: 50,
  premium: 300,
};

export function getTeamMemberLimit(tier) {
  return TEAM_MEMBER_LIMITS[tier] ?? TEAM_MEMBER_LIMITS.base;
}

// Sin dominio de suscripciones/cobros todavia (ver FUNCTIONAL_PROPOSE.md,
// "Sistema de suscripciones y cobros" sigue siendo un modulo reservado) —
// mismos tres estados que ya prevé esa seccion funcional.
export const SUBSCRIPTION_STATUSES = ['activo', 'vencido', 'en_prueba'];

// Sin dominio de planes de entrenamiento todavia — antes había un catálogo
// mock fijo acá (4 planes inventados), se sacó por decisión explícita del
// usuario (2026-08-02): el selector de plan sigue en la UI (no se elimina
// el campo) pero sin opciones fantasma hasta que exista un backend real de
// planes (bloqueado además por el módulo de cobros/suscripciones, en
// desarrollo en paralelo por otro miembro del equipo — ver
// docs/BACKEND_API_GAPS.md gap 4).
export const TRAINING_PLAN_OPTIONS = [];

// Equipos que el usuario administra (owner_id === userId) — el backend no
// tiene todavia un endpoint "mis equipos" (docs/BACKEND_API_GAPS.md), asi
// que se resuelve del lado del cliente filtrando GET /teams completo (hoy
// vía hooks/use-teams.js#useTeams, migrado de Zustand a TanStack Query el
// 2026-09-09 — ver docs/superpowers/specs/2026-09-09-team-store-tanstack-query-migration-design.md).
// No incluye equipos donde el usuario participa como corredor (ver
// hooks/use-teams.js#useMyMemberTeams para ese caso).
export function selectAdministeredTeams(teams, userId) {
  if (!userId) return [];
  return teams.filter((team) => team.ownerId === userId);
}

// Único estado que queda acá: la asignación local de plan de entrenamiento
// a un grupo. 100% local, el backend real no tiene este campo todavía (ver
// docs/BACKEND_API_GAPS.md gap 4) — no encaja en TanStack Query porque no
// hay ningún fetcher real detrás, sería fingir una mutation sin endpoint.
// El resto de este store (equipos/grupos/invitaciones reales) migró a
// TanStack Query el 2026-09-09 — ver la spec arriba.
export const useTeamStore = create((set) => ({
  setGroupTrainingPlan: (teamId, groupId, planId) => {
    // Sin consumidor real todavía tras esta migración (team.groups ya no
    // vive en este store) — queda reservado para cuando gap 4 tenga un
    // campo real que sincronizar. No borrar sin antes confirmar que sigue
    // sin uso.
  },
}));
```

- [ ] **Step 3: Actualizar `CLAUDE.md` — sección Stack**

Localizar el párrafo "Estado de aplicación vs. estado de servidor" (sección `## Stack`) y reemplazarlo por una versión que refleje el estado real post-migración: Zustand para estado de aplicación (sesión, UI, preferencias locales — `store/auth-store.js` para sesión, y lo que queda en `store/team-store.js`), TanStack Query para estado de servidor. Listar los dominios ya migrados: roster (`use-team-roster.js`), búsqueda de equipos (`use-team-search.js`), solicitudes de ingreso (`use-join-requests.js`), suscripción/tier (`use-tier-subscription.js`), y equipos/grupos/invitaciones (`use-teams.js`/`use-groups.js`/`use-invitations.js`, esta migración). Mencionar que `training-plan-store.js`/`session-store.js`/`exercise-store.js` y el split de `auth-store.js` quedan como sub-proyectos futuros, sin fecha.

- [ ] **Step 4: Bump de versión**

Run: `cat package.json | grep '"version"'` para ver la versión actual, y bumpear el minor (`0.X.0` → `0.(X+1).0`) en `package.json` — migración de arquitectura con alcance real (17 acciones, 11 pantallas), mismo criterio que otras migraciones de este tamaño en el historial del repo (ver `CLAUDE.md`, sección Versionado).

- [ ] **Step 5: Suite completa final**

Run: `npm run lint && npm test`
Expected: ambos en verde.

- [ ] **Step 6: Commit**

```bash
git add store/team-store.js CLAUDE.md package.json
git commit -m "$(cat <<'EOF'
refactor(teams): shrink team-store.js to client-only state

Las 17 acciones que eran estado de servidor real (equipos, grupos,
invitaciones) migraron a TanStack Query en hooks/use-teams.js,
use-groups.js y use-invitations.js — team-store.js queda solo con
setGroupTrainingPlan (sin endpoint real todavía, gap 4) y los
constantes/selectores que ya eran client-side. selectTeam/selectedTeamId
eliminado (código muerto, sin consumidor en toda la app).
EOF
)"
```

---

## Self-Review

**Spec coverage:** §3.1 (3 hooks) → Tasks 1/3/4. §3.2 (query keys) → usados tal cual en los 3 hooks. §3.3 (invalidación por mutation) → cada mutation de Tasks 1/3/4 invalida exactamente lo listado en la spec, incluida la invalidación cruzada invitación→roster (Task 4, `acceptInvitationMutation`). §2 (`selectTeam`/`selectedTeamId` código muerto, `setGroupTrainingPlan` fuera de alcance) → Task 13. §6 (orden sugerido) → orden de Tasks 1-13 lo sigue.

**Placeholder scan:** sin "TBD"/"TODO" en ningún paso. El único bloque sin código explícito es `setGroupTrainingPlan` en Task 13 Step 2 (cuerpo vacío) — es intencional, réplica exacta del comportamiento actual (ver `store/team-store.js:475-482` en el estado previo a esta migración), no un placeholder de trabajo pendiente.

**Type consistency:** `useTeamMutations()` (Task 1) expone `createTeam`/`updateTeam`/`uploadTeamIcon`/`deleteTeamIcon`/`deleteTeam` — mismos 5 nombres usados en Tasks 5/6/10. `useGroupMutations(teamId)` (Task 3) expone `createGroup`/`updateGroup`/`deleteGroup` — Task 10 los renombra en el destructuring (`createGroupInTeam`/`deleteGroupReal`) para no tocar el resto del archivo, documentado explícitamente en ese paso. `useInvitationMutations()` (Task 4) expone `sendInvite`/`acceptInvitation`/`rejectInvitation` — usados con esos nombres en Tasks 5/8/11. Firmas de argumentos (objetos vs. posicionales) consistentes entre la definición en Tasks 1/3/4 y cada call site en Tasks 5-12.
