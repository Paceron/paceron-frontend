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
