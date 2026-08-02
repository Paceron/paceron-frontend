import { useQueries, useQuery } from '@tanstack/react-query';
import { getTeamUsers } from '../services/teams.js';
import { getGroupUsers } from '../services/groups.js';
import { getUser } from '../services/auth.js';
import { toUserModel } from '../services/normalizers.js';

// Roster real de un equipo (reemplaza el mock generateMockMembers de
// store/team-store.js). Ni team_users ni group_users traen nombre/email —
// solo user_id — así que hace falta un fan-out N+1 contra GET
// /auth/user?id= por cada corredor único. Este es el primer uso real de
// TanStack Query en el repo (ver CLAUDE.md "Estado de aplicación vs. de
// servidor") — el cache por queryKey (['user', userId]) es lo que evita
// pedir el mismo usuario dos veces si aparece en varios equipos/grupos
// abiertos en la sesión, sin tener que armar ese cache a mano.
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

  const userQueries = useQueries({
    queries: teamUserDtos.map((dto) => ({
      queryKey: ['user', dto.user_id],
      queryFn: () => getUser({ id: dto.user_id }),
      enabled: Boolean(dto.user_id),
    })),
  });

  const loading = teamUsersQuery.isLoading || groupUsersQueries.some((q) => q.isLoading) || userQueries.some((q) => q.isLoading);
  const error = teamUsersQuery.error ?? groupUsersQueries.find((q) => q.error)?.error ?? userQueries.find((q) => q.error)?.error ?? null;

  const members = teamUserDtos
    .map((teamUserDto, index) => {
      const userDto = userQueries[index].data;
      if (!userDto) return null;
      const user = toUserModel(userDto);
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
