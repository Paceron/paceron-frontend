import { useState } from 'react';
import { ActivityIndicator, Pressable, Text } from 'react-native';
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
import { buildPendingSessionNavParams } from '../../utils/pending-session-nav.js';
import { buildReviewSlotNavParams } from '../../utils/review-slot-nav.js';
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
    const slot = {
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
    };
    setReviewSlot(slot);
    // Params en la URL además del store -- un F5 en web no debería mandar a
    // home (bug real, 2026-10-05).
    router.push({ pathname: '/training-session-review', params: buildReviewSlotNavParams(slot) });
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
    const slot = {
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
    };
    setReviewSlot(slot);
    router.push({ pathname: '/training-session-review', params: buildReviewSlotNavParams(slot) });
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

  // El estado runner_session del usuario actual manda por encima de la fecha,
  // igual que en el pre-start: una sesión de HOY que ya terminó tiene que
  // mostrar "Registro de Sesión"/"Ver sesión", no el Play. El entrenador
  // también tiene su propio runner_session (se crea con su Play, se cierra
  // con su finalize -- ver use-trainer-session-runtime.js) así que esta
  // consulta aplica igual para los dos roles -- antes solo corría para
  // 'runner', y un entrenador que finalizaba una sesión presencial del mismo
  // día seguía viendo "Iniciar entrenamiento" al volver, porque `past` da
  // false el mismo día y nada más lo contemplaba (bug real, 2026-10-05).
  const { runnerSession } = useRunnerSession(assignment?.sessionInstance?.id, userId);
  // Gap 19: interrupted manda igual que finished -- cancelar a mitad de
  // camino es una terminación, el calendario no debe seguir ofreciendo Play
  // para una sesión que el corredor ya cortó (bug real, 2026-10-04).
  const finished = runnerSession?.status === 'finished' || runnerSession?.status === 'interrupted';
  const showReview = (past || finished) && hasSession;

  if (showReview) {
    if (role === 'trainer') {
      // Presencial: el resumen agregado (asistencia + participantes +
      // registros) ahora se ve en las dos plataformas -- trainer-session-
      // review-screen.jsx ya no es mobile-only (2026-10-05). Antes web caía
      // siempre a TrainerReviewButton (elegir un corredor) y no había forma
      // de llegar al resumen agregado desde ahí.
      if (assignment.isPresencial) {
        const handleOpenSummary = () => {
          setPendingSession(assignment);
          // Params en la URL (no solo el store en memoria) -- un F5 en web
          // reinicia el store, y sin esto la pantalla no tenía de dónde
          // reconstruir qué sesión mostrar (bug real, 2026-10-05).
          router.push({ pathname: '/trainer-session-review', params: buildPendingSessionNavParams(assignment) });
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
      // Async: sin concepto de sesión en vivo del entrenador -- mobile sigue
      // sin botón acá, web sigue con el selector de corredor por atleta.
      if (!isWeb) return null;
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

  // Antes, web cortaba acá mismo con un aviso y nunca navegaba -- ahora
  // entra al pre-start igual que mobile (detalles/roster/asistencia se ven
  // en las dos plataformas); el aviso de "solo app nativa" se corrió adentro
  // de cada pre-start, puntual en el lugar del botón Play (ver
  // session-pre-start-screen.jsx/trainer-session-pre-start-screen.jsx).
  const handlePress = () => {
    setPendingSession(assignment);
    // Params en la URL además del store -- mismo motivo que el resumen del
    // entrenador (bug real, 2026-10-05): un F5 en web vacía el store.
    const navParams = buildPendingSessionNavParams(assignment);
    if (role === 'trainer' && assignment.isPresencial) {
      router.push({ pathname: '/trainer-session-pre-start', params: navParams });
      return;
    }
    router.push({ pathname: '/training-session', params: navParams });
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
        Ir a entrenamiento
      </Text>
    </Pressable>
  );
}