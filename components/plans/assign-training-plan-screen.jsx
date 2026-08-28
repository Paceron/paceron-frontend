import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import Toast from 'react-native-toast-message';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useThemeColors } from '../../theme/colors.js';
import { isWeb } from '../../utils/platform.js';
import { useAuthStore } from '../../store/auth-store.js';
import { useTeamStore, selectAdministeredTeams } from '../../store/team-store.js';
import { useTrainingPlanStore } from '../../store/training-plan-store.js';
import { useTeamRoster } from '../../hooks/use-team-roster.js';
import { SectionCard } from '../forms/section-card.jsx';
import { PickerField } from '../forms/fields.jsx';
import { ResponsiveSelectField } from '../forms/responsive-select-field.jsx';
import { RequireAuth } from '../guards/require-auth.jsx';

const TARGET_TYPE_OPTIONS = [
  { id: 'group', name: 'Un grupo' },
  { id: 'runner', name: 'Un corredor individual' },
];

function AssignTrainingPlanScreenContent({ planId }) {
  const router = useRouter();
  const colors = useThemeColors();
  const user = useAuthStore((s) => s.user);
  const plan = useTrainingPlanStore((s) => s.plans.find((p) => p.id === planId));
  const assignToGroup = useTrainingPlanStore((s) => s.assignToGroup);
  const assignToRunner = useTrainingPlanStore((s) => s.assignToRunner);

  const teams = useTeamStore((s) => s.teams);
  const fetchTeams = useTeamStore((s) => s.fetchTeams);
  const fetchGroups = useTeamStore((s) => s.fetchGroups);
  const administeredTeams = selectAdministeredTeams(teams, user?.userId);

  const [loadingTeams, setLoadingTeams] = useState(true);
  const [teamId, setTeamId] = useState('');
  const [targetType, setTargetType] = useState('group');
  const [groupId, setGroupId] = useState('');
  const [runnerId, setRunnerId] = useState('');
  const [assigning, setAssigning] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoadingTeams(true);
    fetchTeams().finally(() => { if (!cancelled) setLoadingTeams(false); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const selectedTeam = administeredTeams.find((t) => t.id === teamId);

  useEffect(() => {
    if (!teamId || !user?.userId) return;
    fetchGroups(teamId, user.userId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teamId, user?.userId]);

  const { members: roster, loading: loadingRoster } = useTeamRoster(
    targetType === 'runner' ? teamId : null,
    selectedTeam?.groups.map((g) => g.id) ?? [],
  );

  const groupOptions = (selectedTeam?.groups ?? []).map((g) => ({ id: g.id, name: g.name }));
  const runnerOptions = roster.map((m) => ({ id: m.userId, name: m.name }));

  const handleTeamChange = (value) => {
    setTeamId(value);
    setGroupId('');
    setRunnerId('');
  };

  const handleAssign = async () => {
    if (assigning) return;
    if (targetType === 'group' && !groupId) {
      Toast.show({ type: 'error', text1: 'Elegí un grupo' });
      return;
    }
    if (targetType === 'runner' && !runnerId) {
      Toast.show({ type: 'error', text1: 'Elegí un corredor' });
      return;
    }

    setAssigning(true);
    const result = targetType === 'group'
      ? assignToGroup(teamId, groupId, planId)
      : await assignToRunner(planId, runnerId);
    setAssigning(false);

    if (!result.success) {
      Toast.show({ type: 'error', text1: 'No pudimos asignar el plan', text2: result.error });
      return;
    }

    Toast.show({ type: 'success', text1: 'Plan asignado' });
    router.back();
  };

  return (
    <ScrollView
      className="flex-1 bg-paper dark:bg-ink"
      contentContainerClassName="px-4 py-8"
      nativeID="assign-training-plan-screen-scroll"
      showsVerticalScrollIndicator={false}
      testID="assign-training-plan-screen-scroll"
    >
      <View className={`w-full self-center ${isWeb ? 'max-w-3xl' : ''}`} nativeID="assign-training-plan-screen-container" testID="assign-training-plan-screen-container">
        <View className="mb-8 flex-row items-center gap-2" nativeID="assign-training-plan-screen-header" testID="assign-training-plan-screen-header">
          <Pressable
            className="flex-row items-center gap-1.5 py-1 pr-1 hover:opacity-70 active:opacity-70"
            nativeID="assign-training-plan-screen-back-button"
            onPress={() => router.back()}
            testID="assign-training-plan-screen-back-button"
          >
            <MaterialCommunityIcons color={colors.onSurfaceVariant} name="arrow-left" size={18} />
          </Pressable>
          <Text className="text-xl text-slate-900 dark:text-white" nativeID="assign-training-plan-screen-title" style={{ fontFamily: 'Orbitron_700Bold' }} testID="assign-training-plan-screen-title">
            Asignar {plan ? `"${plan.name}"` : 'plan'}
          </Text>
        </View>

        <SectionCard icon="account-arrow-right-outline" title="A quién asignar">
          {loadingTeams ? (
            <View className="items-center py-6" nativeID="assign-training-plan-teams-loading" testID="assign-training-plan-teams-loading">
              <ActivityIndicator color={colors.primary} />
            </View>
          ) : administeredTeams.length === 0 ? (
            <Text className="py-2 text-sm text-slate-500 dark:text-slate-400" nativeID="assign-training-plan-no-teams" testID="assign-training-plan-no-teams">
              Todavía no administrás ningún equipo.
            </Text>
          ) : (
            <>
              <ResponsiveSelectField
                dense
                label="Equipo"
                onChange={handleTeamChange}
                options={administeredTeams.map((t) => ({ id: t.id, name: t.name }))}
                placeholder="Elegí un equipo"
                value={teamId}
              />

              {teamId && (
                <>
                  <PickerField dense label="Asignar a" onChange={setTargetType} options={TARGET_TYPE_OPTIONS} value={targetType} />

                  {targetType === 'group' ? (
                    <ResponsiveSelectField
                      dense
                      label="Grupo"
                      onChange={setGroupId}
                      options={groupOptions}
                      placeholder={groupOptions.length ? 'Elegí un grupo' : 'Este equipo todavía no tiene grupos'}
                      value={groupId}
                    />
                  ) : loadingRoster ? (
                    <View className="items-center py-4" nativeID="assign-training-plan-roster-loading" testID="assign-training-plan-roster-loading">
                      <ActivityIndicator color={colors.primary} />
                    </View>
                  ) : (
                    <ResponsiveSelectField
                      dense
                      label="Corredor"
                      onChange={setRunnerId}
                      options={runnerOptions}
                      placeholder={runnerOptions.length ? 'Elegí un corredor' : 'Este equipo todavía no tiene corredores'}
                      value={runnerId}
                    />
                  )}
                </>
              )}
            </>
          )}
        </SectionCard>

        {teamId && (
          <Pressable
            className={`h-12 flex-row items-center justify-center gap-2 rounded-full bg-primary hover:opacity-90 active:opacity-80 ${assigning ? 'opacity-60' : ''}`}
            disabled={assigning}
            nativeID="assign-training-plan-submit-button"
            onPress={handleAssign}
            testID="assign-training-plan-submit-button"
          >
            {assigning ? (
              <ActivityIndicator color={colors.onPrimary} />
            ) : (
              <>
                <MaterialCommunityIcons color={colors.onPrimary} name="check" size={18} />
                <Text className="text-sm font-semibold uppercase tracking-wide text-[#111518]" nativeID="assign-training-plan-submit-button-label" testID="assign-training-plan-submit-button-label">
                  Asignar
                </Text>
              </>
            )}
          </Pressable>
        )}
      </View>
    </ScrollView>
  );
}

export function AssignTrainingPlanScreen({ planId }) {
  return (
    <RequireAuth>
      <AssignTrainingPlanScreenContent planId={planId} />
    </RequireAuth>
  );
}
