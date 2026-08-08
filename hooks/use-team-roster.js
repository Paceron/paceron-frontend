import { useQueries, useQuery } from '@tanstack/react-query';
import { getTeamUsers } from '../services/teams.js';
import { getGroupUsers } from '../services/groups.js';
import { batchLookupUsers } from '../services/user.js';

// Roster real de un equipo (reemplaza el mock generateMockMembers de
// store/team-store.js). Ni team_users ni group_users traen nombre/email —
// solo user_id. Antes esto se resolvía con un fan-out N+1 contra GET
// /auth/user?id= (uno por corredor único) — reemplazado por
// GET /users?ids=1,2,3 (services/user.js#batchLookupUsers, hasta 50 ids
// en una sola llamada, ver docs/BACKEND_API_GAPS.md historial). Este fue
// el primer uso real de TanStack Query en el repo (ver CLAUDE.md "Estado
// de aplicación vs. de servidor") — el cache por queryKey sigue
// deduplicando este fetch si el mismo roster se vuelve a montar en la
// sesión, aunque ya no dedupea por-usuario-individual entre equipos
// distintos (no hace falta: ahora es 1 sola request por roster, no N).
export function useTeamRoster(teamId, groupIds = []) {
  const teamUsersQuery = useQuery({
    queryKey: ['team-users', teamId],
    queryFn: () => getTeamUsers(teamId),
    enabled: Boolean(teamId),
  });

  const groupUsersQueries = useQueries({
    queries: groupIds.map((groupId) => ({
      queryKey: ['group-users', groupId],
      queryFn: () => getGroupUsers(groupId),
      enabled: Boolean(groupId),
    })),
  });

  const groupIdByUserId = new Map();
  groupUsersQueries.forEach((query, index) => {
    (query.data ?? []).forEach((dto) => {
      groupIdByUserId.set(dto.user_id, String(groupIds[index]));
    });
  });

  const teamUserDtos = teamUsersQuery.data ?? [];
  const uniqueUserIds = [...new Set(teamUserDtos.map((dto) => dto.user_id))].sort((a, b) => a - b);

  const usersQuery = useQuery({
    queryKey: ['users-batch', teamId, uniqueUserIds.join(',')],
    queryFn: () => batchLookupUsers(uniqueUserIds),
    enabled: uniqueUserIds.length > 0,
  });

  const userById = new Map((usersQuery.data ?? []).map((user) => [user.user_id, user]));

  const loading = teamUsersQuery.isLoading || groupUsersQueries.some((q) => q.isLoading) || usersQuery.isLoading;
  const error = teamUsersQuery.error ?? groupUsersQueries.find((q) => q.error)?.error ?? usersQuery.error ?? null;

  const members = teamUserDtos
    .map((teamUserDto) => {
      const user = userById.get(teamUserDto.user_id);
      if (!user) return null;
      return {
        id: String(teamUserDto.user_id),
        userId: String(teamUserDto.user_id),
        name: `${user.name ?? ''} ${user.surname ?? ''}`.trim() || user.email,
        email: user.email,
        groupId: groupIdByUserId.get(teamUserDto.user_id) ?? null,
        joinedAt: teamUserDto.assignment_date ?? null,
        subscriptionStatus: null,
      };
    })
    .filter(Boolean);

  return { members, loading, error };
}
