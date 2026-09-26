import { useQuery } from '@tanstack/react-query';
import { getTeamConfiguration } from '../services/team-configuration.js';
import { toTeamConfigurationModel } from '../services/normalizers.js';

// Topes de creación/edición de equipo según el tier del entrenador autenticado.
// Se cachea con `userId` en la key porque el valor depende de QUIÉN pregunta
// (el endpoint no toma params, sale del JWT) — sin el id en la key, un cambio de
// usuario reusaría la configuración del anterior.
export function useTeamConfiguration(userId) {
  const query = useQuery({
    queryKey: ['team-configuration', userId],
    queryFn: () => getTeamConfiguration().then(toTeamConfigurationModel),
    enabled: Boolean(userId),
  });

  return {
    configuration: query.data ?? null,
    minimumFee: query.data?.minimumFee ?? null,
    maxMembers: query.data?.maxMembers ?? null,
    loading: query.isLoading,
    error: query.error ?? null,
  };
}
