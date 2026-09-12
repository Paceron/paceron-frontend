import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  listSessions as listSessionsService,
  createSession as createSessionService,
  updateSession as updateSessionService,
  deleteSession as deleteSessionService,
  cloneSession as cloneSessionService,
} from '../services/sessions.js';
import { toSessionModel, toCreateSessionPayload } from '../services/normalizers.js';

// Catálogo de sesiones del entrenador — mismo criterio que
// hooks/use-exercises.js (ver ese archivo para el comentario completo
// sobre FORCE_MOCKS/gap 4).
export function useSessions(ownerId) {
  const query = useQuery({
    queryKey: ['sessions', ownerId],
    queryFn: () => listSessionsService({ ownerId }).then((dtos) => dtos.map(toSessionModel)),
    enabled: Boolean(ownerId),
  });
  return { sessions: query.data ?? [], loading: query.isLoading, error: query.error };
}

export function useSessionMutations() {
  const queryClient = useQueryClient();

  const createSessionMutation = useMutation({
    mutationFn: async ({ form }) => {
      try {
        const created = await createSessionService(toCreateSessionPayload(form));
        return { success: true, session: toSessionModel(created) };
      } catch (error) {
        return { success: false, error: error.message };
      }
    },
    onSuccess: (result, variables) => {
      if (result.success) queryClient.invalidateQueries({ queryKey: ['sessions', variables.ownerId] });
    },
  });

  const updateSessionMutation = useMutation({
    mutationFn: async ({ sessionId, form }) => {
      try {
        const updated = await updateSessionService(sessionId, toCreateSessionPayload(form));
        return { success: true, session: toSessionModel(updated) };
      } catch (error) {
        return { success: false, error: error.message };
      }
    },
    onSuccess: (result, variables) => {
      if (result.success) queryClient.invalidateQueries({ queryKey: ['sessions', variables.ownerId] });
    },
  });

  const deleteSessionMutation = useMutation({
    mutationFn: async ({ sessionId }) => {
      try {
        await deleteSessionService(sessionId);
        return { success: true };
      } catch (error) {
        return { success: false, error: error.message };
      }
    },
    onSuccess: (result, variables) => {
      if (result.success) queryClient.invalidateQueries({ queryKey: ['sessions', variables.ownerId] });
    },
  });

  const cloneSessionMutation = useMutation({
    mutationFn: async ({ sessionId }) => {
      try {
        const cloned = await cloneSessionService(sessionId);
        return { success: true, session: toSessionModel(cloned) };
      } catch (error) {
        return { success: false, error: error.message };
      }
    },
    onSuccess: (result, variables) => {
      if (result.success) queryClient.invalidateQueries({ queryKey: ['sessions', variables.ownerId] });
    },
  });

  return {
    createSession: createSessionMutation.mutateAsync,
    isCreating: createSessionMutation.isPending,
    updateSession: updateSessionMutation.mutateAsync,
    isUpdating: updateSessionMutation.isPending,
    deleteSession: deleteSessionMutation.mutateAsync,
    isDeleting: deleteSessionMutation.isPending,
    cloneSession: cloneSessionMutation.mutateAsync,
    isCloning: cloneSessionMutation.isPending,
  };
}
