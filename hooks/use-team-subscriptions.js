import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getTeamSubscriptions } from '../services/team-subscriptions.js';
import { toTeamSubscriptionsListModel } from '../services/normalizers.js';

const EMPTY_MAP = new Map();

// Estado de servidor del estado de cuota de todos los corredores de un
// equipo, para el entrenador (Gap 41). `enabled` apagado por default salvo
// que el caller lo prenda: el endpoint es entrenador/owner-only, así que no
// tiene sentido ni pedirlo para una vista de corredor (403 seguro).
export function useTeamSubscriptions(teamId, { enabled = true } = {}) {
  const query = useQuery({
    queryKey: ['team-subscriptions', teamId],
    queryFn: () => getTeamSubscriptions(teamId).then(toTeamSubscriptionsListModel),
    enabled: Boolean(teamId) && enabled,
  });

  const subscriptionsByUserId = useMemo(() => {
    if (!query.data?.members?.length) return EMPTY_MAP;
    return new Map(query.data.members.map((m) => [m.userId, m]));
  }, [query.data]);

  return {
    subscriptionsByUserId,
    membershipFee: query.data?.membershipFee ?? 0,
    loading: query.isLoading,
    error: query.error ?? null,
  };
}
