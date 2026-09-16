import { useQuery } from '@tanstack/react-query';
import { getMpConnectStatus } from '../services/mp-connect.js';
import { useAuthStore } from '../store/auth-store.js';

// Estado de la conexión de Mercado Pago del entrenador logueado.
//
// Es la fuente de verdad del flujo de mp-connect: el `status` que llega por la
// URL de retorno sirve para el mensaje inmediato, pero quién decide si la
// cuenta está conectada es siempre este endpoint. Por eso el botón de conectar
// llama a refetch() en TODAS sus salidas (éxito, error y cancelación) — así un
// fallo del canal de retorno degrada el flujo pero no lo rompe.
export function useMpConnectStatus() {
  const userId = useAuthStore((s) => s.userId);

  const query = useQuery({
    queryKey: ['mp-connect-status', userId],
    queryFn: getMpConnectStatus,
    enabled: Boolean(userId),
    // Sin cache: si el entrenador desconecta la app desde Mercado Pago, el
    // webhook de deauth actualiza el backend pero esta pantalla no se entera
    // sola. refetchOnWindowFocus además cubre la vuelta de la ventana
    // emergente en web (redundante con el postMessage, a propósito).
    staleTime: 0,
    refetchOnWindowFocus: true,
  });

  return {
    connected: query.data?.connected ?? false,
    accountStatus: query.data?.account_status ?? null,
    loading: query.isLoading,
    refetching: query.isFetching,
    refetch: query.refetch,
  };
}
