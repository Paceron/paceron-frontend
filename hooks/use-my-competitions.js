import { useQueries } from '@tanstack/react-query';
import { useMyMemberTeams } from './use-teams.js';
import { competitionsQueryOptions } from './use-competitions.js';

// Fan-out cross-equipo sin endpoint nuevo -- mismo mecanismo que ya usa el
// punto rojo global de Gap 34 (docs/BACKEND_API_GAPS.md): recorrer los
// equipos donde el usuario es corredor y pedir las competencias de cada
// uno en paralelo con useQueries (mismo patrón que hooks/use-team-fees.js).
// "Participa" = su userId está en participantUserIds (campo real, ya
// normalizado) -- NO "es miembro del equipo", un equipo puede tener
// competencias en las que este corredor no fue anotado.
export function useMyCompetitions(userId, { status } = {}) {
  const { teams, loading: teamsLoading } = useMyMemberTeams(userId);
  const teamIds = teams.map((t) => t.id);

  const queries = useQueries({
    queries: teamIds.map((teamId) => competitionsQueryOptions(teamId, { status })),
  });

  const userIdStr = String(userId);
  const competitions = [];
  teamIds.forEach((teamId, i) => {
    const teamName = teams[i].name;
    const list = queries[i]?.data?.competitions ?? [];
    list.forEach((competition) => {
      if (competition.participantUserIds.includes(userIdStr)) {
        competitions.push({ ...competition, teamName });
      }
    });
  });

  return {
    competitions,
    loading: teamsLoading || queries.some((q) => q.isLoading),
  };
}
