import { useEffect, useRef } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as Location from 'expo-location';
import { useAuthStore } from '../store/auth-store.js';
import { USE_MOCKS } from '../config/env.js';
import {
  listCompetitions,
  getCompetition,
  createCompetition as createCompetitionService,
  approveCompetition as approveCompetitionService,
  rejectCompetition as rejectCompetitionService,
  cancelCompetition as cancelCompetitionService,
  closeCompetition as closeCompetitionService,
  createCompetitionAttempt as createCompetitionAttemptService,
  seedDynamicRouteCompetitionStart,
} from '../services/competitions.js';
import { toCompetitionModel, toCompetitionDetailModel, toCreateCompetitionPayload } from '../services/normalizers.js';

// Listado de competencias de un equipo (Gap 33) -- `hasUnseen` alimenta el
// punto rojo de la pestaña (ver hooks/use-gamification-badge.js, que NO
// suma este término al OR global a propósito -- ver la spec, sección
// "Alcance del punto rojo").
export function useCompetitions(teamId, { status, groupId } = {}) {
  const query = useQuery({
    queryKey: ['competitions', teamId, status, groupId],
    queryFn: () => listCompetitions(teamId, { status, groupId }).then((response) => ({
      competitions: (response.data ?? response).map(toCompetitionModel),
      hasUnseen: Boolean(response.has_unseen),
    })),
    enabled: Boolean(teamId),
  });

  return {
    competitions: query.data?.competitions ?? [],
    hasUnseen: query.data?.hasUnseen ?? false,
    loading: query.isLoading,
    error: query.error ?? null,
  };
}

// Detalle + progreso (Gap 33 punto 23, Spec 4b) -- lazy por default
// (`enabled`): CompetitionRow lo pide recién al expandir una fila, no de
// entrada para las 3-5 competencias de la lista completa.
export function useCompetitionDetail(id, { enabled = true } = {}) {
  const query = useQuery({
    queryKey: ['competition', id],
    queryFn: () => getCompetition(id).then((response) => toCompetitionDetailModel(response.data ?? response)),
    enabled: Boolean(id) && enabled,
  });

  return { detail: query.data ?? null, loading: query.isLoading };
}

// Las 5 mutaciones del dominio -- todas invalidan la misma queryKey al
// resolver (sin filtros: invalida cualquier variante status/groupId
// cacheada para este equipo, comportamiento default de TanStack Query).
export function useCompetitionMutations(teamId) {
  const queryClient = useQueryClient();
  const activeRole = useAuthStore((s) => s.activeRole);
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['competitions', teamId] });

  const createMutation = useMutation({
    mutationFn: (form) => createCompetitionService(teamId, toCreateCompetitionPayload(form), { isTrainerCreator: activeRole === 'trainer' }),
    onSuccess: invalidate,
  });
  const approveMutation = useMutation({ mutationFn: approveCompetitionService, onSuccess: invalidate });
  const rejectMutation = useMutation({ mutationFn: ({ id, reason }) => rejectCompetitionService(id, reason), onSuccess: invalidate });
  const cancelMutation = useMutation({ mutationFn: cancelCompetitionService, onSuccess: invalidate });
  const closeMutation = useMutation({ mutationFn: closeCompetitionService, onSuccess: invalidate });
  // Sin invalidate -- correr un intento no cambia el status/listado de la
  // competencia, solo crea el runner_session sintético del lado backend.
  const attemptMutation = useMutation({ mutationFn: ({ id, athleteUserId }) => createCompetitionAttemptService(id, athleteUserId) });

  const wrap = (mutateAsync) => async (...args) => {
    try {
      const data = await mutateAsync(...args);
      return { success: true, data };
    } catch (error) {
      return { success: false, error: error.message };
    }
  };

  return {
    createCompetition: wrap(createMutation.mutateAsync),
    approveCompetition: wrap(approveMutation.mutateAsync),
    rejectCompetition: (id, reason) => wrap(rejectMutation.mutateAsync)({ id, reason }),
    cancelCompetition: wrap(cancelMutation.mutateAsync),
    closeCompetition: wrap(closeMutation.mutateAsync),
    createCompetitionAttempt: (id, athleteUserId) => wrap(attemptMutation.mutateAsync)({ id, athleteUserId }),
    isCreating: createMutation.isPending,
    isApproving: approveMutation.isPending,
    isRejecting: rejectMutation.isPending,
    isCancelling: cancelMutation.isPending,
    isClosing: closeMutation.isPending,
    isStartingAttempt: attemptMutation.isPending,
  };
}

// Solo mocks (USE_MOCKS, early return abajo) -- reubica la competencia de
// ruta "dinámica" (seed 8, services/__mocks__/competitions-mock.js)
// contra el GPS real del dispositivo. Pedido real 2026-10-19: no hay forma
// de crear a mano, con mocks, una competencia de ruta cuyo punto de inicio
// sirva para probar el gate de GPS como corredor -- crearla como
// entrenador la deja pending_approval sin un corredor propio que la
// apruebe/corra después, y crearla directo como `active` la deja sin
// participante corredor real tampoco (roles separados, catch-22 de
// mocks). `useRef` (no useState) para el guard de "ya se pidió" -- no hace
// falta re-renderizar nada por esto, solo evitar pedir permiso de nuevo en
// cada remount de CompetitionsTab.
export function useSeedDynamicRouteCompetition() {
  const queryClient = useQueryClient();
  const requestedRef = useRef(false);

  useEffect(() => {
    if (!USE_MOCKS || requestedRef.current) return;
    requestedRef.current = true;
    let cancelled = false;
    (async () => {
      try {
        const position = await Location.getCurrentPositionAsync();
        if (cancelled || !position?.coords) return;
        const changed = seedDynamicRouteCompetitionStart(position.coords.latitude, position.coords.longitude);
        // Invalidate amplio (sin teamId/status/groupId) -- no importa en
        // qué equipo esté parado el tab que disparó esto, la seed 8 es
        // siempre del equipo 5.
        if (changed) queryClient.invalidateQueries({ queryKey: ['competitions'] });
      } catch {
        // Sin permiso/GPS -- la competencia dinámica queda con su
        // placeholder (lejos, como seed 7), no bloquea nada más.
      }
    })();
    return () => { cancelled = true; };
  }, [queryClient]);
}
