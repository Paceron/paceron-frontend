import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import Toast from 'react-native-toast-message';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useThemeColors } from '../../theme/colors.js';
import { isWeb } from '../../utils/platform.js';
import { useAuthStore } from '../../store/auth-store.js';
import { useTeamStore, getTeamMemberLimit, TRAINING_PLAN_OPTIONS } from '../../store/team-store.js';
import { RequireAuth } from '../guards/require-auth.jsx';
import { SectionCard } from '../forms/section-card.jsx';
import { EmailListField } from '../forms/fields.jsx';
import { GroupListEditor } from './group-list-editor.jsx';
import { useTeamGeneralInfoForm } from '../../hooks/use-team-general-info-form.js';
import { TeamGeneralInfoFields } from './team-general-info-fields.jsx';

const STEP_TITLES = { 1: 'Datos del equipo', 2: 'Grupos', 3: 'Invitar corredores' };
const TOTAL_STEPS = 3;

// Botones de navegación entre pasos — Atrás (secundario) y la acción
// principal del paso (Siguiente/Crear), compartidos por los 3 pasos.
// `loading`/`disabled` solo tienen efecto real en el paso 3 (Crear, que
// pega contra el backend) — los pasos 1/2 son navegación sync.
function StepNav({ onBack, onNext, nextLabel, nextIcon = 'arrow-right', loading = false, disabled = false }) {
  const colors = useThemeColors();

  return (
    <View className="mt-2 flex-row gap-3" nativeID="create-team-step-nav" testID="create-team-step-nav">
      {onBack && (
        <Pressable
          className="h-12 flex-1 flex-row items-center justify-center gap-2 rounded-full border border-slate-200 hover:bg-slate-100 active:opacity-80 dark:border-slate-700 dark:hover:bg-slate-800"
          disabled={loading}
          nativeID="create-team-step-back-button"
          onPress={onBack}
          testID="create-team-step-back-button"
        >
          <MaterialCommunityIcons color={colors.onSurfaceVariant} name="arrow-left" size={18} />
          <Text className="text-sm font-semibold uppercase tracking-wide text-slate-700 dark:text-slate-200" nativeID="create-team-step-back-button-label" testID="create-team-step-back-button-label">
            Atrás
          </Text>
        </Pressable>
      )}
      <Pressable
        className={`h-12 flex-1 flex-row items-center justify-center gap-2 rounded-full bg-primary hover:opacity-90 active:opacity-80 ${disabled || loading ? 'opacity-60' : ''}`}
        disabled={disabled || loading}
        nativeID="create-team-step-next-button"
        onPress={onNext}
        testID="create-team-step-next-button"
      >
        {loading ? (
          <ActivityIndicator color={colors.onPrimary} />
        ) : (
          <>
            <Text className="text-sm font-semibold uppercase tracking-wide text-[#111518]" nativeID="create-team-step-next-button-label" testID="create-team-step-next-button-label">
              {nextLabel}
            </Text>
            <MaterialCommunityIcons color={colors.onPrimary} name={nextIcon} size={18} />
          </>
        )}
      </Pressable>
    </View>
  );
}

function CreateTeamScreenContent() {
  const router = useRouter();
  const colors = useThemeColors();
  const user = useAuthStore((s) => s.user);
  const roles = useAuthStore((s) => s.roles);
  const createTeam = useTeamStore((s) => s.createTeam);
  const sendInvite = useTeamStore((s) => s.sendInvite);

  const trainerTier = roles.find((r) => r.name === 'entrenador')?.tier;
  const maxAllowed = getTeamMemberLimit(trainerTier);

  const [step, setStep] = useState(1);

  // Mismo componente y misma cascada país→provincia→localidad que
  // register/editar perfil, vía el hook compartido con EditTeamScreen
  // (hooks/use-team-general-info-form.js). Precargada con la ubicación del
  // entrenador si ya la cargó al registrarse, asumiendo que el equipo suele
  // estar donde está él.
  const generalForm = useTeamGeneralInfoForm({
    initial: { country: user?.country, province: user?.province, city: user?.city },
    maxAllowed,
  });

  // Un equipo puede tener varios grupos (GroupListEditor). El grupo default
  // ("Sin grupo") no se crea ni se edita desde este formulario — lo agrega
  // store/team-store.js al crear el equipo. Este paso completo es
  // opcional: se puede pasar al siguiente sin haber agregado ningun grupo.
  const [groups, setGroups] = useState([]);
  const [invitedEmails, setInvitedEmails] = useState([]);

  const handleContinueStep1 = () => {
    if (!generalForm.validate()) return;
    setStep(2);
  };

  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (submitting) return;
    setSubmitting(true);
    const result = await createTeam({
      ...generalForm.getValues(),
      ownerId: user.userId,
      groups,
    });

    if (!result.success) {
      setSubmitting(false);
      Toast.show({ type: 'error', text1: 'No pudimos crear el equipo', text2: result.error });
      return;
    }

    let inviteFailures = 0;
    for (const invite of invitedEmails) {
      const inviteResult = await sendInvite(result.team.id, invite.email);
      if (!inviteResult.success) inviteFailures += 1;
    }
    setSubmitting(false);

    Toast.show({
      type: 'success',
      text1: 'Equipo creado',
      text2: result.addressWarning
        ? 'La dirección no se pudo guardar — podés agregarla después desde Editar equipo.'
        : inviteFailures > 0
          ? `${inviteFailures} de ${invitedEmails.length} invitaciones no se pudieron enviar — podés reintentar desde la pantalla de invitar.`
          : undefined,
    });

    router.replace(`/teams/${result.team.id}`);
  };

  return (
    <ScrollView
      nativeID="create-team-screen-scroll"
      testID="create-team-screen-scroll"
      className="flex-1 bg-paper dark:bg-ink"
      contentContainerClassName="px-4 py-8"
      showsVerticalScrollIndicator={false}
    >
      <View nativeID="create-team-screen-container" testID="create-team-screen-container" className={`w-full self-center ${isWeb ? 'max-w-3xl' : ''}`}>
        <View nativeID="create-team-screen-header" testID="create-team-screen-header" className="mb-8 flex-row items-center gap-2">
          <Pressable
            nativeID="create-team-screen-back-button"
            testID="create-team-screen-back-button"
            className="flex-row items-center gap-1.5 py-1 pr-1 hover:opacity-70 active:opacity-70"
            onPress={() => router.back()}
          >
            <MaterialCommunityIcons color={colors.onSurfaceVariant} name="arrow-left" size={18} />
          </Pressable>
          <View nativeID="create-team-screen-title-group" testID="create-team-screen-title-group">
            <Text
              nativeID="create-team-screen-title"
              testID="create-team-screen-title"
              style={{ fontFamily: 'Orbitron_700Bold' }}
              className="text-xl text-slate-900 dark:text-white"
            >
              Crear equipo
            </Text>
            <Text className="text-xs text-slate-500 dark:text-slate-400" nativeID="create-team-screen-step-indicator" testID="create-team-screen-step-indicator">
              Paso {step} de {TOTAL_STEPS} · {STEP_TITLES[step]}
            </Text>
          </View>
        </View>

        {step === 1 && (
          <SectionCard icon="account-group" title="Datos del equipo">
            <TeamGeneralInfoFields form={generalForm} idPrefix="create-team" maxAllowed={maxAllowed} />

            <StepNav nextLabel="Siguiente" onNext={handleContinueStep1} />
          </SectionCard>
        )}

        {step === 2 && (
          <SectionCard icon="account-multiple" title="Grupos del equipo">
            <Text className="mb-8 text-sm text-slate-500 dark:text-slate-400" nativeID="create-team-groups-hint" testID="create-team-groups-hint">
              Opcional — podés omitir este paso y crear grupos más adelante.
            </Text>

            <GroupListEditor groups={groups} onChange={setGroups} planOptions={TRAINING_PLAN_OPTIONS} />

            <StepNav nextLabel="Siguiente" onBack={() => setStep(1)} onNext={() => setStep(3)} />
          </SectionCard>
        )}

        {step === 3 && (
          <SectionCard icon="email-outline" title="Invitar corredores">
            <EmailListField label="Invitar corredores por email" onChange={setInvitedEmails} value={invitedEmails} />

            <StepNav disabled={submitting} loading={submitting} nextIcon="check" nextLabel="Crear" onBack={() => setStep(2)} onNext={handleSubmit} />
          </SectionCard>
        )}
      </View>
    </ScrollView>
  );
}

export function CreateTeamScreen() {
  return (
    <RequireAuth>
      <CreateTeamScreenContent />
    </RequireAuth>
  );
}
