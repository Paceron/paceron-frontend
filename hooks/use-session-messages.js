import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createSessionMessage, getSessionMessages } from '../services/sessionMessages.js';
import { toSessionMessageModel, toSessionMessagePayload } from '../services/normalizers.js';

// Historial de mensajes de una sesión en vivo (Gap 27). `staleTime: 0` --
// mismo criterio que use-runner-session.js/use-session-feedback.js: este
// dato cambia por un evento externo (el WS lo invalida, ver
// hooks/use-live-session-runtime.js / hooks/use-trainer-session-runtime.js),
// no solo por una acción propia del usuario, así que no conviene confiar en
// que siga "fresco" solo porque se pidió hace poco.
export function useSessionMessages(sessionInstanceId) {
  const query = useQuery({
    queryKey: ['session-messages', sessionInstanceId],
    queryFn: () => getSessionMessages(sessionInstanceId),
    enabled: Boolean(sessionInstanceId),
    staleTime: 0,
  });

  return {
    messages: (query.data?.messages ?? []).map(toSessionMessageModel).filter(Boolean),
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
  };
}

// La mutation invalida su propia query al completar -- cubre el caso del
// propio emisor, que no recibe el aviso de WS que dispara ESTE mismo mensaje
// (el backend no se lo reenvía a sí mismo, ver spec "Bordes").
export function useSendSessionMessage(sessionInstanceId) {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: (input) => createSessionMessage(sessionInstanceId, toSessionMessagePayload(input)),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['session-messages', sessionInstanceId] }),
  });

  return { sendMessage: mutation.mutateAsync, isSending: mutation.isPending, error: mutation.error };
}
