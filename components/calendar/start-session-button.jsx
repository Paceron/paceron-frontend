import { useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useThemeColors } from '../../theme/colors.js';
import { isWeb } from '../../utils/platform.js';
import { canStartSession, isPastSessionDate } from '../../utils/session-start-window.js';
import { useAuthStore } from '../../store/auth-store.js';
import { useSessionRuntimeStore } from '../../store/session-runtime-store.js';
import { useSessionReviewStore } from '../../store/session-review-store.js';
import { useRunnerSession } from '../../hooks/use-runner-session.js';
import { getRunnerSession } from '../../services/runnerSession.js';
import { AthletePickerModal } from '../team/athlete-picker-modal.jsx';

// Punto de entrada del "Registro de Sesión" (spec 2026-09-24):
// - Sesión de hoy en ventana → comportamiento previo (Play / aviso web).
// - Sesión de fecha pasada con instancia → "Registro de Sesión":
//   corredor mobile entra al pre-start (que ramifica según estado runner_session);
//   corredor web entra directo a la revisión (el modo se decide por estado);
//   entrenador (web) abre el selector de corredor antes de entrar.
function RunnerReviewWebButton({ assignment, userId, fill }) {
  const router = useRouter();
  const colors = useThemeColors();
  const setReviewSlot = useSessionReviewStore((s) => s.setReviewSlot);
  const { runnerSession, loading } = useRunnerSession(assignment.sessionInstance?.id, userId);

  const handlePress = () => {
    // Gap 19: interrupted entra a revisión igual que finished -- lo hecho
    // antes de cancelar queda ahí para ver/editar, nunca a ingreso manual.
    const mode = runnerSession?.status === 'finished' || runnerSession?.status === 'interrupted' ? 'review' : 'manual';
    setReviewSlot({
      sessionInstance: assignment.sessionInstance,
      sessionInstanceId: assignment.sessionInstance?.id,
      date: assignment.date,
      sessionName: assignment.sessionInstance?.name,
      role: 'runner',
      athleteUserId: userId,
      mode,
      completionStatus: runnerSession?.status ?? null,
      teamId: assignment.teamId ?? null,
      teamName: assignment.teamName ?? null,
      groupName: assignment.groupName ?? null,
    });
    router.push('/training-session-review');
  };

  return (
    <Pressable className={`${fill ? 'flex-1' : 'mt-2'} h-9 flex-row items-center justify-center gap-1.5 rounded-full bg-primary active:opacity-80`} nativeID={`start-session-button-${assignment.id}-registro`} onPress={loading ? undefined : handlePress} testID={`start-session-button-${assignment.id}-registro`}>
      {loading ? (
        <ActivityIndicator color={colors.onPrimary} size="small" />
      ) : (
        <>
          <MaterialCommunityIcons color={colors.onPrimary} name="clipboard-text-outline" size={14} />
          <Text className="text-xs font-semibold uppercase tracking-wide text-[#111518]" nativeID={`start-session-button-${assignment.id}-registro-label`} testID={`start-session-button-${assignment.id}-registro-label`}>
            Registro de Sesión
          </Text>
        </>
      )}
    </Pressable>
  );
}

function TrainerReviewButton({ assignment, teamId, fill }) {
  const router = useRouter();
  const colors = useThemeColors();
  const userId = useAuthStore((s) => s.userId);
  const setReviewSlot = useSessionReviewStore((s) => s.setReviewSlot);
  const [pickerVisible, setPickerVisible] = useState(false);

  const handleConfirmAthlete = async (member) => {
    setPickerVisible(false);
    let mode = 'manual';
    let completionStatus = null;
    try {
      const res = await getRunnerSession(assignment.sessionInstance?.id, member.userId);
      completionStatus = res?.data?.status ?? null;
      // Gap 19: interrupted entra a revisión igual que finished.
      if (completionStatus === 'finished' || completionStatus === 'interrupted') mode = 'review';
    } catch {
      // 404 → todavía sin estado → ingreso manual
    }
    setReviewSlot({
      sessionInstance: assignment.sessionInstance,
      sessionInstanceId: assignment.sessionInstance?.id,
      date: assignment.date,
      sessionName: assignment.sessionInstance?.name,
      role: 'trainer',
      athleteUserId: member.userId,
      mode,
      completionStatus,
      teamId: assignment.teamId ?? teamId ?? null,
      teamName: assignment.teamName ?? null,
      groupName: assignment.groupName ?? null,
    });
    router.push('/training-session-review');
  };

  return (
    <>
      <Pressable
        className={`${fill ? 'flex-1' : 'mt-2'} h-9 flex-row items-center justify-center gap-1.5 rounded-full bg-primary active:opacity-80`}
        nativeID={`start-session-button-${assignment.id}-ver-registros`}
        onPress={() => setPickerVisible(true)}
        testID={`start-session-button-${assignment.id}-ver-registros`}
      >
        <MaterialCommunityIcons color={colors.onPrimary} name="clipboard-text-multiple-outline" size={14} />
        <Text className="text-xs font-semibold uppercase tracking-wide text-[#111518]" nativeID={`start-session-button-${assignment.id}-ver-registros-label`} testID={`start-session-button-${assignment.id}-ver-registros-label`}>
          Ver registros
        </Text>
      </Pressable>
      <AthletePickerModal
        excludeUserId={userId}
        onClose={() => setPickerVisible(false)}
        onConfirm={handleConfirmAthlete}
        teamId={assignment.teamId ?? teamId}
        title="Elegí el corredor"
        visible={pickerVisible}
      />
    </>
  );
}

export function StartSessionButton({ assignment, role, teamId, fill }) {
  const router = useRouter();
  const colors = useThemeColors();
  const userId = useAuthStore((s) => s.userId);
  const setPendingSession = useSessionRuntimeStore((s) => s.setPendingSession);

  const past = isPastSessionDate(assignment);
  // Una sola regla para las dos modalidades: el día de la sesión, a cualquier
  // hora. El ternario por rol que había antes dejaba al corredor sin botón en
  // toda sesión presencial.
  const inWindow = canStartSession(assignment);
  const hasSession = Boolean(assignment.sessionInstance);
  const idPrefix = `start-session-button-${assignment.id}`;

  // El estado runner_session del CORREDOR manda por encima de la fecha, igual
  // que en el pre-start: una sesión de HOY que ya terminó tiene que mostrar
  // "Registro de Sesión", no el Play — si no, el calendario sigue ofreciendo
  // arrancar una sesión ya corrida. Para el entrenador no se consulta (el
  // estado depende del atleta, que se elige después en el selector) y corre
  // solo la regla de fecha pasada.
  const { runnerSession } = useRunnerSession(role === 'runner' ? assignment?.sessionInstance?.id : null, userId);
  // Gap 19: interrupted manda igual que finished -- cancelar a mitad de
  // camino es una terminación, el calendario no debe seguir ofreciendo Play
  // para una sesión que el corredor ya cortó (bug real, 2026-10-04).
  const finished = runnerSession?.status === 'finished' || runnerSession?.status === 'interrupted';
  const showReview = (past || finished) && hasSession;

  if (showReview) {
    if (role === 'trainer') {
      if (!isWeb) {
        // El entrenador en mobile no tenía NINGÚN botón acá (TrainerReviewButton
        // es web-only, revisión por atleta) -- para una sesión presencial sí
        // hay algo útil que mostrar: el resumen agregado (asistencia +
        // participantes + registros), mismo que ve recién al finalizar en vivo.
        if (!assignment.isPresencial) return null;
        const handleOpenSummary = () => {
          setPendingSession(assignment);
          router.push('/trainer-session-review');
        };
        return (
          <Pressable
            className={`${fill ? 'flex-1' : 'mt-2'} h-9 flex-row items-center justify-center gap-1.5 rounded-full bg-primary active:opacity-80`}
            nativeID={`${idPrefix}-ver-sesion`}
            onPress={handleOpenSummary}
            testID={`${idPrefix}-ver-sesion`}
          >
            <MaterialCommunityIcons color={colors.onPrimary} name="clipboard-text-multiple-outline" size={14} />
            <Text className="text-xs font-semibold uppercase tracking-wide text-[#111518]" nativeID={`${idPrefix}-ver-sesion-label`} testID={`${idPrefix}-ver-sesion-label`}>
              Ver sesión
            </Text>
          </Pressable>
        );
      }
      return <TrainerReviewButton assignment={assignment} fill={fill} teamId={teamId} />;
    }
    if (isWeb) return <RunnerReviewWebButton assignment={assignment} fill={fill} userId={userId} />;
    // Corredor mobile: entra al pre-start, que ramifica Play vs Registro según
    // el estado runner_session (ver session-pre-start-screen.jsx).
    const handleReviewFromNative = () => {
      setPendingSession(assignment);
      router.push('/training-session');
    };
    return (
      <Pressable
        className={`${fill ? 'flex-1' : 'mt-2'} h-9 flex-row items-center justify-center gap-1.5 rounded-full bg-primary active:opacity-80`}
        nativeID={`${idPrefix}-registro`}
        onPress={handleReviewFromNative}
        testID={`${idPrefix}-registro`}
      >
        <MaterialCommunityIcons color={colors.onPrimary} name="clipboard-text-outline" size={14} />
        <Text className="text-xs font-semibold uppercase tracking-wide text-[#111518]" nativeID={`${idPrefix}-registro-label`} testID={`${idPrefix}-registro-label`}>
          Registro de Sesión
        </Text>
      </Pressable>
    );
  }

  if (!inWindow) return null;

  if (isWeb) {
    return (
      <View className={`${fill ? 'flex-1' : 'mt-2'} flex-row items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1.5 dark:bg-emerald-900/20`} nativeID={`${idPrefix}-web-notice`} testID={`${idPrefix}-web-notice`}>
        <MaterialCommunityIcons color="#16a34a" name="cellphone-check" size={14} />
        <Text className="text-xs font-medium text-emerald-700 dark:text-emerald-400" nativeID={`${idPrefix}-web-notice-label`} testID={`${idPrefix}-web-notice-label`}>
          El inicio y registro del entrenamiento solo está disponible en la app nativa
        </Text>
      </View>
    );
  }

  const handlePress = () => {
    setPendingSession(assignment);
    if (role === 'trainer' && assignment.isPresencial) {
      router.push('/trainer-session-pre-start');
      return;
    }
    router.push('/training-session');
  };

  return (
    <Pressable
      className={`${fill ? 'flex-1' : 'mt-2'} h-9 flex-row items-center justify-center gap-1.5 rounded-full bg-primary active:opacity-80`}
      nativeID={idPrefix}
      onPress={handlePress}
      testID={idPrefix}
    >
      <MaterialCommunityIcons color={colors.onPrimary} name="play" size={14} />
      <Text className="text-xs font-semibold uppercase tracking-wide text-[#111518]" nativeID={`${idPrefix}-label`} testID={`${idPrefix}-label`}>
        Iniciar entrenamiento
      </Text>
    </Pressable>
  );
}