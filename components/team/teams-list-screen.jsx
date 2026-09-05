import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useThemeColors } from '../../theme/colors.js';
import { isWeb } from '../../utils/platform.js';
import { useAuthStore } from '../../store/auth-store.js';
import { useTeamStore, selectAdministeredTeams } from '../../store/team-store.js';
import { useTeamsJoinRequestsMap } from '../../hooks/use-join-requests.js';
import { SectionCard } from '../forms/section-card.jsx';
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
        <AvatarPicker fallbackIcon="account-group" idPrefix={`teams-list-team-${team.id}-avatar`} size={36} uri={team.iconUrl} />
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
  const teams = useTeamStore((s) => s.teams);
  const fetchTeams = useTeamStore((s) => s.fetchTeams);
  const myMemberTeams = useTeamStore((s) => s.myMemberTeams);
  const fetchMyMemberTeams = useTeamStore((s) => s.fetchMyMemberTeams);
  const administeredTeams = selectAdministeredTeams(teams, user?.userId);
  // Como entrenador ve los equipos que administra; como corredor, los que
  // integra — dos fuentes distintas (ver store/team-store.js#fetchMyMemberTeams).
  const myTeams = activeRole === 'trainer' ? administeredTeams : myMemberTeams;
  const { byTeamId: pendingRequestsByTeamId } = useTeamsJoinRequestsMap(activeRole === 'trainer' ? administeredTeams.map((t) => t.id) : []);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetchTeams().finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (activeRole === 'trainer' || !user?.userId) return undefined;
    let cancelled = false;
    setLoading(true);
    fetchMyMemberTeams(user.userId).finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeRole, user?.userId]);

  return (
    <ScrollView
      className="flex-1 bg-paper dark:bg-ink"
      contentContainerClassName="px-4 py-8"
      nativeID="teams-list-screen-scroll"
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
        </View>

        <SectionCard icon="account-group" title={activeRole === 'trainer' ? 'Equipos que administrás' : 'Equipos en los que participás'}>
          {loading ? (
            <View className="items-center py-6" nativeID="teams-list-loading" testID="teams-list-loading">
              <ActivityIndicator color={colors.primary} />
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

          {canCreateTeam && (
            <Pressable
              className="mt-4 h-11 flex-row items-center justify-center gap-2 self-start rounded-full bg-primary px-6 hover:opacity-90 active:opacity-80"
              nativeID="teams-list-create-button"
              onPress={() => router.push('/teams/create')}
              testID="teams-list-create-button"
            >
              <MaterialCommunityIcons color={colors.onPrimary} name="plus" size={18} />
              <Text className="text-sm font-semibold uppercase tracking-wide text-[#111518]" nativeID="teams-list-create-button-label" testID="teams-list-create-button-label">
                Crear equipo
              </Text>
            </Pressable>
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
