import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import Toast from 'react-native-toast-message';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useThemeColors } from '../../theme/colors.js';
import { isWeb } from '../../utils/platform.js';
import { useAuthStore } from '../../store/auth-store.js';
import { useTeamStore, getTeamMemberLimit } from '../../store/team-store.js';
import { SectionCard } from '../forms/section-card.jsx';
import { useTeamGeneralInfoForm } from '../../hooks/use-team-general-info-form.js';
import { TeamGeneralInfoFields } from './team-general-info-fields.jsx';

// Edita solo los datos generales del equipo (mismos campos que el paso 1
// del wizard de creación, vía el hook y los campos compartidos). Grupos se
// editan aparte (pestaña Grupos → editar-group-screen.jsx); invitaciones no
// se re-editan post-creación, todavía no hay un flujo para eso.
//
// Separado en dos componentes: este (EditTeamScreen) resuelve
// loading/not-found — el equipo puede no estar todavía en el store si se
// entra por deep-link (fetchTeam es async) — y EditTeamForm, que recién se
// monta con un `team` ya garantizado. Si useTeamGeneralInfoForm se llamara
// acá arriba con un `team` inicialmente undefined, el formulario quedaría
// vacío para siempre una vez que el fetch resuelve (useState solo toma el
// valor inicial una vez).
export function EditTeamScreen({ teamId }) {
  const router = useRouter();
  const colors = useThemeColors();
  const team = useTeamStore((s) => s.teams.find((t) => t.id === teamId));
  const fetchTeam = useTeamStore((s) => s.fetchTeam);
  const [loading, setLoading] = useState(!team);

  useEffect(() => {
    if (team) {
      setLoading(false);
      return undefined;
    }
    let cancelled = false;
    setLoading(true);
    fetchTeam(teamId).finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teamId]);

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center bg-paper dark:bg-ink" nativeID="edit-team-loading" testID="edit-team-loading">
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  if (!team) {
    return (
      <View className="flex-1 items-center justify-center bg-paper px-6 dark:bg-ink" nativeID="edit-team-not-found" testID="edit-team-not-found">
        <Text className="mb-4 text-center text-sm text-slate-500 dark:text-slate-400" nativeID="edit-team-not-found-label" testID="edit-team-not-found-label">
          No encontramos este equipo.
        </Text>
        <Pressable
          className="h-11 flex-row items-center gap-2 rounded-full bg-primary px-6 active:opacity-80"
          nativeID="edit-team-not-found-back-button"
          onPress={() => router.back()}
          testID="edit-team-not-found-back-button"
        >
          <Text className="text-sm font-semibold uppercase tracking-wide text-[#111518]" nativeID="edit-team-not-found-back-button-label" testID="edit-team-not-found-back-button-label">
            Volver
          </Text>
        </Pressable>
      </View>
    );
  }

  return <EditTeamForm team={team} teamId={teamId} />;
}

function EditTeamForm({ team, teamId }) {
  const router = useRouter();
  const colors = useThemeColors();
  const roles = useAuthStore((s) => s.roles);
  const updateTeam = useTeamStore((s) => s.updateTeam);

  const trainerTier = roles.find((r) => r.name === 'entrenador')?.tier;
  const maxAllowed = getTeamMemberLimit(trainerTier);

  const generalForm = useTeamGeneralInfoForm({ initial: team, maxAllowed });
  const [showGroupsToRunners, setShowGroupsToRunners] = useState(team.showGroupsToRunners ?? false);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (submitting) return;
    if (!generalForm.validate()) return;
    setSubmitting(true);
    const result = await updateTeam(teamId, { ...generalForm.getValues(), showGroupsToRunners });
    setSubmitting(false);

    if (!result.success) {
      Toast.show({ type: 'error', text1: 'No pudimos guardar los cambios', text2: result.error });
      return;
    }

    Toast.show({
      type: 'success',
      text1: 'Equipo actualizado',
      text2: result.addressWarning ? 'La dirección no se pudo guardar — probá de nuevo más tarde.' : undefined,
    });
    router.back();
  };

  return (
    <ScrollView
      className="flex-1 bg-paper dark:bg-ink"
      contentContainerClassName="px-4 py-8"
      nativeID="edit-team-screen-scroll"
      showsVerticalScrollIndicator={false}
      testID="edit-team-screen-scroll"
    >
      <View className={`w-full self-center ${isWeb ? 'max-w-3xl' : ''}`} nativeID="edit-team-screen-container" testID="edit-team-screen-container">
        <View className="mb-8 flex-row items-center gap-2" nativeID="edit-team-screen-header" testID="edit-team-screen-header">
          <Pressable
            className="flex-row items-center gap-1.5 py-1 pr-1 hover:opacity-70 active:opacity-70"
            nativeID="edit-team-screen-back-button"
            onPress={() => router.back()}
            testID="edit-team-screen-back-button"
          >
            <MaterialCommunityIcons color={colors.onSurfaceVariant} name="arrow-left" size={18} />
          </Pressable>
          <Text className="text-xl text-slate-900 dark:text-white" nativeID="edit-team-screen-title" style={{ fontFamily: 'Orbitron_700Bold' }} testID="edit-team-screen-title">
            Editar equipo
          </Text>
        </View>

        <SectionCard icon="account-group" title="Datos del equipo">
          <TeamGeneralInfoFields form={generalForm} idPrefix="edit-team" maxAllowed={maxAllowed} />
        </SectionCard>

        <SectionCard icon="shield-account-outline" title="Privacidad">
          <Pressable
            accessibilityLabel="Mostrar los grupos a los corredores"
            accessibilityRole="checkbox"
            accessibilityState={{ checked: showGroupsToRunners }}
            className="flex-row items-start gap-3 py-1"
            nativeID="edit-team-show-groups-checkbox"
            onPress={() => setShowGroupsToRunners((v) => !v)}
            testID="edit-team-show-groups-checkbox"
          >
            <View
              className={`mt-0.5 h-5 w-5 items-center justify-center rounded border ${
                showGroupsToRunners ? 'border-primary bg-primary' : 'border-slate-300 dark:border-slate-600'
              }`}
              nativeID="edit-team-show-groups-checkbox-box"
              testID="edit-team-show-groups-checkbox-box"
            >
              {showGroupsToRunners && <MaterialCommunityIcons color={colors.onPrimary} name="check-bold" size={14} />}
            </View>
            <View className="flex-1" nativeID="edit-team-show-groups-checkbox-text" testID="edit-team-show-groups-checkbox-text">
              <Text className="text-sm font-medium text-slate-900 dark:text-white" nativeID="edit-team-show-groups-checkbox-label" testID="edit-team-show-groups-checkbox-label">
                Mostrar los grupos a los corredores
              </Text>
              <Text className="text-xs text-slate-500 dark:text-slate-400" nativeID="edit-team-show-groups-checkbox-hint" testID="edit-team-show-groups-checkbox-hint">
                Van a poder ver a qué grupo pertenece cada compañero de equipo. La sección Grupos sigue siendo solo para vos.
              </Text>
            </View>
          </Pressable>

          <Text className="mt-2 text-xs text-slate-400 dark:text-slate-500" nativeID="edit-team-show-groups-persistence-hint" testID="edit-team-show-groups-persistence-hint">
            Por ahora esta preferencia no se guarda entre sesiones — el backend todavía no tiene este campo.
          </Text>

          <Pressable
            className={`mt-5 h-12 flex-row items-center justify-center gap-2 rounded-full bg-primary hover:opacity-90 active:opacity-80 ${submitting ? 'opacity-60' : ''}`}
            disabled={submitting}
            nativeID="edit-team-save-button"
            onPress={handleSubmit}
            testID="edit-team-save-button"
          >
            {submitting ? (
              <ActivityIndicator color={colors.onPrimary} />
            ) : (
              <>
                <MaterialCommunityIcons color={colors.onPrimary} name="check" size={18} />
                <Text className="text-sm font-semibold uppercase tracking-wide text-[#111518]" nativeID="edit-team-save-button-label" testID="edit-team-save-button-label">
                  Guardar cambios
                </Text>
              </>
            )}
          </Pressable>
        </SectionCard>
      </View>
    </ScrollView>
  );
}
