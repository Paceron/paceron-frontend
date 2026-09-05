import { useQueries, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  listMyJoinRequests,
  listTeamJoinRequests,
  getPendingRequestsCount,
  createJoinRequest,
  cancelJoinRequest,
  respondJoinRequest,
} from '../services/join-requests.js';
import { toJoinRequestModel } from '../services/normalizers.js';

// Estado de servidor del dominio de solicitudes de ingreso — TanStack
// Query, no Zustand (ver CLAUDE.md), mismo criterio que
// hooks/use-team-roster.js y hooks/use-tier-subscription.js.

// Solicitudes propias del corredor actual (cualquier estado).
export function useMyJoinRequests(enabled = true) {
  const query = useQuery({
    queryKey: ['join-requests-mine'],
    queryFn: () => listMyJoinRequests().then((dtos) => dtos.map(toJoinRequestModel)),
    enabled,
  });
  return { requests: query.data ?? [], loading: query.isLoading, error: query.error };
}

// Solicitudes pending de UN equipo puntual — usado tanto por la tab
// "Solicitudes" del entrenador dueño (team-requests-tab.jsx) como,
// indirectamente, por useTeamsJoinRequestsMap más abajo (misma queryKey,
// mismo cache).
export function useTeamJoinRequests(teamId) {
  const query = useQuery({
    queryKey: ['join-requests-team', teamId],
    queryFn: () => listTeamJoinRequests(teamId).then((dtos) => dtos.map(toJoinRequestModel)),
    enabled: Boolean(teamId),
  });
  return { requests: query.data ?? [], loading: query.isLoading, error: query.error };
}

// Conteo agregado (todos los equipos del entrenador) — para el badge de
// la campana/drawer. `enabled` lo controla el caller: solo tiene sentido
// pedirlo cuando activeRole === 'trainer'.
export function usePendingRequestsCount(enabled = true) {
  const query = useQuery({
    queryKey: ['join-requests-pending-count'],
    queryFn: () => getPendingRequestsCount().then((dto) => dto.count),
    enabled,
  });
  return query.data ?? 0;
}

// Mapa teamId → solicitudes pending, para el "dot de novedad" en
// teams-list-screen.jsx (un dot por equipo administrado con solicitudes
// sin resolver) — N requests (uno por equipo administrado), mismo
// patrón ya usado en hooks/use-team-roster.js para group-users. Comparte
// queryKey con useTeamJoinRequests, así que abrir la tab Solicitudes de
// un equipo después de ver su dot no vuelve a pedir el mismo dato.
export function useTeamsJoinRequestsMap(teamIds = []) {
  const queries = useQueries({
    queries: teamIds.map((teamId) => ({
      queryKey: ['join-requests-team', teamId],
      queryFn: () => listTeamJoinRequests(teamId).then((dtos) => dtos.map(toJoinRequestModel)),
      enabled: Boolean(teamId),
    })),
  });
  const byTeamId = new Map();
  queries.forEach((q, index) => byTeamId.set(teamIds[index], q.data ?? []));
  const loading = queries.some((q) => q.isLoading);
  return { byTeamId, loading };
}

// Las 4 mutaciones del dominio — todas invalidan el mismo set de queries
// (propias, del equipo, el conteo agregado, y la búsqueda — crear/cancelar
// una solicitud cambia el estado "Solicitud enviada" que ve el botón de
// búsqueda para ese equipo).
export function useJoinRequestMutations() {
  const queryClient = useQueryClient();

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: ['join-requests-mine'] });
    queryClient.invalidateQueries({ queryKey: ['join-requests-team'] });
    queryClient.invalidateQueries({ queryKey: ['join-requests-pending-count'] });
    queryClient.invalidateQueries({ queryKey: ['team-search'] });
  };

  const create = useMutation({ mutationFn: (teamId) => createJoinRequest(teamId), onSuccess: invalidateAll });
  const cancel = useMutation({ mutationFn: (requestId) => cancelJoinRequest(requestId), onSuccess: invalidateAll });
  const accept = useMutation({ mutationFn: (requestId) => respondJoinRequest(requestId, true), onSuccess: invalidateAll });
  const reject = useMutation({ mutationFn: (requestId) => respondJoinRequest(requestId, false), onSuccess: invalidateAll });

  return {
    createJoinRequest: create.mutateAsync,
    isCreating: create.isPending,
    cancelJoinRequest: cancel.mutateAsync,
    isCancelling: cancel.isPending,
    acceptJoinRequest: accept.mutateAsync,
    isAccepting: accept.isPending,
    rejectJoinRequest: reject.mutateAsync,
    isRejecting: reject.isPending,
  };
}
