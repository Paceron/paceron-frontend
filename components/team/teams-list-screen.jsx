import { Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useThemeColors } from '../../theme/colors.js';
import { isWeb, isMobile } from '../../utils/platform.js';
import { useAuthStore } from '../../store/auth-store.js';
import { selectAdministeredTeams } from '../../store/team-store.js';
import { useTeams, useMyMemberTeams } from '../../hooks/use-teams.js';
import { useTeamsJoinRequestsMap } from '../../hooks/use-join-requests.js';
import { usePullToRefresh } from '../../hooks/use-pull-to-refresh.js';
import { SectionCard } from '../forms/section-card.jsx';
import { SkeletonBlock, SkeletonCircle } from '../shared/skeleton.jsx';
import { AvatarPicker } from '../shared/avatar-picker.jsx';
import { RequireAuth } from '../guards/require-auth.jsx';

function TeamRow({ team, onPress, hasPendingRequests }) {
  const colors = useThemeColors();
  return (
    <Pressable
      className="flex-row items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3.5 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:hover:bg-slate-800"
      nativeID={`teams-list-team-${team.id}`}
      onPress={onPress}
      testID={`teams-list-team-${team.id}`}
    >
      <View className="relative" nativeID={`teams-list-team-${team.id}-icon`} testID={`teams-list-team-${team.id}-icon`}>
        <AvatarPicker idPrefix={`teams-list-team-${team.id}-avatar`} placeholder="team" size={36} uri={team.iconUrl} />
        {hasPendingRequests && (
          <View className="absolute -right-1 -top-1 h-2 w-2 rounded-full bg-red-500" nativeID={`teams-list-team-${team.id}-pending-dot`} testID={`teams-list-team-${team.id}-pending-dot`} />
        )}
      </View>
      <Text className="flex-1 text-sm font-semibold text-slate-900 dark:text-white" nativeID={`teams-list-team-${team.id}-name`} testID={`teams-list-team-${team.id}-name`}>
        {team.name}
      </Text>
      <MaterialCommunityIcons color={colors.onSurfaceVariant} name="chevron-right" size={18} />
    </Pressable>
  );
}

function TeamsListScreenContent() {
  const router = useRouter();
  const colors = useThemeColors();
  const user = useAuthStore((s) => s.user);
  const hasTrainerRole = useAuthStore((s) => s.roles.some((r) => r.name === 'entrenador'));
  const activeRole = useAuthStore((s) => s.activeRole);
  const canCreateTeam = hasTrainerRole && activeRole === 'trainer';
  const { teams, loading: loadingTeams } = useTeams();
  const { teams: myMemberTeams, loading: loadingMyMemberTeams } = useMyMemberTeams(activeRole === 'runner' ? user?.userId : null);
  const administeredTeams = selectAdministeredTeams(teams, user?.userId);
  // Como entrenador ve los equipos que administra; como corredor, los que
  // integra — dos fuentes distintas (ver hooks/use-teams.js#useMyMemberTeams).
  const myTeams = activeRole === 'trainer' ? administeredTeams : myMemberTeams;
  const { byTeamId: pendingRequestsByTeamId } = useTeamsJoinRequestsMap(activeRole === 'trainer' ? administeredTeams.map((t) => t.id) : []);
  const loading = activeRole === 'trainer' ? loadingTeams : loadingMyMemberTeams;

  const queryClient = useQueryClient();
  const { refreshing, onRefresh } = usePullToRefresh(() => Promise.all([
    queryClient.invalidateQueries({ queryKey: activeRole === 'trainer' ? ['teams'] : ['teams-mine', user?.userId] }),
    queryClient.invalidateQueries({ queryKey: ['join-requests-team'] }),
  ]));

  return (
    <ScrollView
      className="flex-1 bg-paper dark:bg-ink"
      contentContainerClassName="px-4 py-8"
      nativeID="teams-list-screen-scroll"
      refreshControl={isMobile ? <RefreshControl onRefresh={onRefresh} refreshing={refreshing} tintColor={colors.primary} /> : undefined}
      showsVerticalScrollIndicator={false}
      testID="teams-list-screen-scroll"
    >
      <View className={`w-full self-center ${isWeb ? 'max-w-3xl' : ''}`} nativeID="teams-list-screen-container" testID="teams-list-screen-container">
        <View className="mb-8 flex-row items-center gap-2" nativeID="teams-list-screen-header" testID="teams-list-screen-header">
          <Pressable
            className="flex-row items-center gap-1.5 py-1 pr-1 hover:opacity-70 active:opacity-70"
            nativeID="teams-list-screen-back-button"
            onPress={() => router.back()}
            testID="teams-list-screen-back-button"
          >
            <MaterialCommunityIcons color={colors.onSurfaceVariant} name="arrow-left" size={18} />
          </Pressable>
          <Text className="flex-1 text-xl text-slate-900 dark:text-white" nativeID="teams-list-screen-title" style={{ fontFamily: 'Orbitron_700Bold' }} testID="teams-list-screen-title">
            Mis equipos
          </Text>
          {activeRole === 'runner' && (
            <Pressable
              accessibilityLabel="Buscar equipos"
              className="rounded-full p-2 hover:bg-slate-100 active:opacity-70 dark:hover:bg-slate-800"
              nativeID="teams-list-search-button"
              onPress={() => router.push('/teams/search')}
              testID="teams-list-search-button"
            >
              <MaterialCommunityIcons color={colors.onSurfaceVariant} name="magnify" size={22} />
            </Pressable>
          )}
          {canCreateTeam && (
            <Pressable
              accessibilityLabel="Crear equipo"
              className="rounded-full p-2 hover:bg-slate-100 active:opacity-70 dark:hover:bg-slate-800"
              nativeID="teams-list-create-button"
              onPress={() => router.push('/teams/create')}
              testID="teams-list-create-button"
            >
              <MaterialCommunityIcons color={colors.onSurfaceVariant} name="plus" size={22} />
            </Pressable>
          )}
        </View>

        <SectionCard icon="account-group" title={activeRole === 'trainer' ? 'Equipos que administrás' : 'Equipos en los que participás'}>
          {loading ? (
            <View className="gap-2" nativeID="teams-list-loading" testID="teams-list-loading">
              {[0, 1, 2].map((i) => (
                <View className="flex-row items-center gap-3 px-4 py-3" key={i} nativeID={`teams-list-loading-row-${i}`} testID={`teams-list-loading-row-${i}`}>
                  <SkeletonCircle nativeID={`teams-list-loading-row-${i}-avatar`} size={36} testID={`teams-list-loading-row-${i}-avatar`} />
                  <SkeletonBlock height={14} nativeID={`teams-list-loading-row-${i}-name`} testID={`teams-list-loading-row-${i}-name`} width="60%" />
                </View>
              ))}
            </View>
          ) : myTeams.length === 0 ? (
            <Text className="py-2 text-sm text-slate-500 dark:text-slate-400" nativeID="teams-list-empty" testID="teams-list-empty">
              {activeRole === 'trainer' ? 'Todavía no administrás ningún equipo.' : 'Todavía no participás de ningún equipo.'}
            </Text>
          ) : (
            <View className="gap-2" nativeID="teams-list-list" testID="teams-list-list">
              {myTeams.map((team) => (
                <TeamRow
                  hasPendingRequests={(pendingRequestsByTeamId.get(team.id) ?? []).length > 0}
                  key={team.id}
                  onPress={() => router.push(`/teams/${team.id}`)}
                  team={team}
                />
              ))}
            </View>
          )}
        </SectionCard>
      </View>
    </ScrollView>
  );
}

export function TeamsListScreen() {
  return (
    <RequireAuth>
      <TeamsListScreenContent />
    </RequireAuth>
  );
}
