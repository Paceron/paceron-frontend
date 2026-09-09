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
