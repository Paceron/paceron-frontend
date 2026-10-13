import { useQuery } from '@tanstack/react-query';
import { getTeamLeaderboard } from '../services/leaderboard.js';
import { toLeaderboardModel } from '../services/normalizers.js';

// Leaderboard de equipo (Gap 32) -- una query por combinación de filtros,
// la clave incluye todos para no mezclar cachés entre métrica/período
// distintos.
export function useTeamLeaderboard(teamId, { metric, period, from, to } = {}) {
  const query = useQuery({
    queryKey: ['leaderboard', teamId, metric, period, from, to],
    queryFn: () => getTeamLeaderboard(teamId, { metric, period, from, to }).then(toLeaderboardModel),
    enabled: Boolean(teamId) && Boolean(metric) && Boolean(period),
  });

  return {
    leaderboard: query.data ?? null,
    loading: query.isLoading,
    error: query.error ?? null,
  };
}
