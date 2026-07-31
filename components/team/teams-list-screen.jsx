import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useThemeColors } from '../../theme/colors.js';
import { isWeb } from '../../utils/platform.js';
import { useAuthStore } from '../../store/auth-store.js';
import { useTeamStore, selectAdministeredTeams } from '../../store/team-store.js';
import { SectionCard } from '../forms/section-card.jsx';
import { RequireAuth } from '../guards/require-auth.jsx';

function TeamRow({ team, onPress }) {
  const colors = useThemeColors();
  return (
    <Pressable
      className="flex-row items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3.5 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:hover:bg-slate-800"
      nativeID={`teams-list-team-${team.id}`}
      onPress={onPress}
      testID={`teams-list-team-${team.id}`}
    >
      <View className="h-9 w-9 items-center justify-center rounded-full bg-primary-tint dark:bg-primary/15" nativeID={`teams-list-team-${team.id}-icon`} testID={`teams-list-team-${team.id}-icon`}>
        <MaterialCommunityIcons color={colors.primary} name="account-group" size={18} />
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
  const administeredTeams = selectAdministeredTeams(teams, user?.userId);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetchTeams().finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
          <Text className="text-xl text-slate-900 dark:text-white" nativeID="teams-list-screen-title" style={{ fontFamily: 'Orbitron_700Bold' }} testID="teams-list-screen-title">
            Mis equipos
          </Text>
        </View>

        <SectionCard icon="account-group" title="Equipos que administrás">
          {loading ? (
            <View className="items-center py-6" nativeID="teams-list-loading" testID="teams-list-loading">
              <ActivityIndicator color={colors.primary} />
            </View>
          ) : administeredTeams.length === 0 ? (
            <Text className="py-2 text-sm text-slate-500 dark:text-slate-400" nativeID="teams-list-empty" testID="teams-list-empty">
              Todavía no administrás ningún equipo.
            </Text>
          ) : (
            <View className="gap-2" nativeID="teams-list-list" testID="teams-list-list">
              {administeredTeams.map((team) => (
                <TeamRow key={team.id} onPress={() => router.push(`/teams/${team.id}`)} team={team} />
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
