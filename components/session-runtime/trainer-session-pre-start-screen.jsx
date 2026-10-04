import { useState } from 'react';
import { Linking, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import * as Location from 'expo-location';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useThemeColors } from '../../theme/colors.js';
import { isWeb } from '../../utils/platform.js';
import { RequireAuth } from '../guards/require-auth.jsx';
import { useSessionRuntimeStore } from '../../store/session-runtime-store.js';
import { useLiveSessionStore } from '../../store/live-session-store.js';
import { useAuthStore } from '../../store/auth-store.js';
import { useTeamRoster } from '../../hooks/use-team-roster.js';
import { useSessionInstance } from '../../hooks/use-session-instance.js';
import { useUser } from '../../hooks/use-user.js';
import { filterByName } from '../../utils/attendance-filter.js';
import { formatDisplayDate, formatWeekdayLabel } from '../../utils/format-date-display.js';
import { colorForUserId } from '../../utils/participant-color.js';
import { logDebug } from '../../utils/debug-log.js';
import { createRunnerSession } from '../../services/runnerSession.js';
import { pendingSessionFromNavParams } from '../../utils/pending-session-nav.js';
import { AttendanceSessionModal } from './attendance-session-modal.jsx';
import { TrainerCard } from './trainer-card.jsx';

// Mismo criterio que session-pre-start-screen.jsx (URL universal de Google
// Maps, coordenadas no label) -- copiado, no importado: esa función no está
// exportada y ese archivo no se toca.
function openLocationInMaps(location) {
  if (!location?.lat || !location?.lng) return;
  Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${location.lat},${location.lng}`);
}

const PARTICIPANTS_COLLAPSED_COUNT = 5;

function ExerciseRow({ exercise, idPrefix }) {
  const rowId = `${idPrefix}-exercise-${exercise.id}`;
  return (
    <View className="rounded-xl border border-slate-200 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-900" nativeID={rowId} testID={rowId}>
      <Text className="text-sm font-semibold text-slate-900 dark:text-white" nativeID={`${rowId}-name`} testID={`${rowId}-name`}>
        {exercise.name}
      </Text>
      <Text className="text-xs text-slate-500 dark:text-slate-400" nativeID={`${rowId}-detail`} testID={`${rowId}-detail`}>
        {exercise.repeatCount} serie{exercise.repeatCount > 1 ? 's' : ''} · descanso {exercise.restMinutes} min
      </Text>
    </View>
  );
}

function ParticipantRow({ member, idPrefix }) {
  const rowId = `${idPrefix}-participant-${member.userId}`;
  return (
    <View className="flex-row items-center gap-2.5 rounded-xl border border-slate-200 bg-white p-2.5 dark:border-slate-700 dark:bg-slate-900" nativeID={rowId} testID={rowId}>
      {member.photoUrl ? (
        <View className="h-9 w-9 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700" nativeID={`${rowId}-photo`} testID={`${rowId}-photo`}>
          <Text className="sr-only" nativeID={`${rowId}-photo-placeholder`} testID={`${rowId}-photo-placeholder`}>{member.name}</Text>
        </View>
      ) : (
        <View className="h-9 w-9 items-center justify-center rounded-full bg-primary/20" nativeID={`${rowId}-initials`} testID={`${rowId}-initials`}>
          <Text className="text-xs font-bold text-primary" nativeID={`${rowId}-initials-label`} testID={`${rowId}-initials-label`}>
            {member.name.slice(0, 2).toUpperCase()}
          </Text>
        </View>
      )}
      {/* Mismo color que va de borde en el marcador del mapa en vivo
          (colorForUserId) -- acá como puntito, para reconocer de un vistazo
          a quién corresponde cada corredor entre el pre-start y la sesión. */}
      <View
        className="h-2.5 w-2.5 rounded-full"
        nativeID={`${rowId}-dot`}
        style={{ backgroundColor: colorForUserId(member.userId) }}
        testID={`${rowId}-dot`}
      />
      <Text className="flex-1 text-sm font-semibold text-slate-900 dark:text-white" nativeID={`${rowId}-name`} numberOfLines={1} testID={`${rowId}-name`}>
        {member.name}
      </Text>
    </View>
  );
}

function TrainerSessionPreStartScreenContent() {
  const router = useRouter();
  const colors = useThemeColors();
  const navParams = useLocalSearchParams();
  const storePendingSession = useSessionRuntimeStore((s) => s.pendingSession);
  const setGpsEnabled = useLiveSessionStore((s) => s.setGpsEnabled);
  const [participantsExpanded, setParticipantsExpanded] = useState(false);
  const [participantsQuery, setParticipantsQuery] = useState('');
  const [attendanceVisible, setAttendanceVisible] = useState(false);

  // El store (Zustand, sin persist) es el camino rápido -- siempre
  // preferido, cero requests extra. Un F5 en web lo vacía (bug real,
  // 2026-10-05): ahí se reconstruye desde los params de la URL (puestos por
  // start-session-button.jsx) + un fetch de la instancia por id -- misma
  // sesión, sin mandar a home.
  const needsFallback = !storePendingSession;
  const fallbackSessionInstanceId = needsFallback ? navParams.sessionInstanceId : null;
  const { sessionInstance: fetchedSessionInstance } = useSessionInstance(fallbackSessionInstanceId, Boolean(fallbackSessionInstanceId));
  const pendingSession = storePendingSession ?? pendingSessionFromNavParams(navParams, fetchedSessionInstance);

  const teamId = pendingSession?.teamId ?? null;
  const groupId = pendingSession?.groupId ?? null;
  const { members, loading: rosterLoading } = useTeamRoster(teamId, groupId ? [groupId] : []);
  const trainerUserId = useAuthStore((s) => s.userId);
  const { user: trainerUser } = useUser(trainerUserId);
  // El entrenador puede figurar en el roster del grupo (es dueño del equipo,
  // a veces también miembro) -- no es un corredor más, se muestra aparte vía
  // TrainerCard, nunca mezclado en la lista de participantes.
  const runnerMembers = members.filter((m) => String(m.userId) !== String(trainerUserId));

  const sessionInstanceId = pendingSession?.sessionInstance?.id;
  // El entrenador puede salir y volver a entrar a su propia sesión ya
  // abierta sin pasar por finalizar -- esto es lo que le permite distinguir
  // "todavía no la abrí" (Play) de "ya la abrí, estoy volviendo" (Reanudar),
  // en vez de mostrar Play como si fuera a abrirla de nuevo desde cero.
  const { sessionInstance: liveInstance } = useSessionInstance(sessionInstanceId, Boolean(sessionInstanceId) && Boolean(pendingSession?.isPresencial));
  const sessionAlreadyOpen = Boolean(liveInstance?.openedAt) && !liveInstance?.closedAt;

  if (!pendingSession) return <Redirect href="/" />;

  const exercises = pendingSession.sessionInstance?.exercises ?? [];
  const sortedMembers = [...runnerMembers].sort((a, b) => a.name.localeCompare(b.name));
  const visibleMembers = participantsExpanded ? filterByName(sortedMembers, participantsQuery) : sortedMembers.slice(0, PARTICIPANTS_COLLAPSED_COUNT);

  // Permiso GPS una sola vez por sesión, mismo patrón que el handlePlay del
  // corredor (session-pre-start-screen.jsx) -- el entrenador también comparte
  // su posición real en el mapa (useTrainerSessionRuntime depende de
  // gpsEnabled vía useLiveSessionStore). Solo el permiso importa acá, sin
  // getCurrentPositionAsync bloqueante (ya descartado del lado del corredor
  // por no respetar su propio timeout).
  const handlePlay = async () => {
    const startedAt = Date.now();
    let gpsEnabled = false;
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      gpsEnabled = Boolean(permission.granted);
    } catch (error) {
      gpsEnabled = false;
      logDebug(`[trainer-pre-start] permiso GPS ERROR ${error?.message ?? error}`);
    }
    // Mismo log que session-pre-start-screen.jsx (corredor) -- antes este
    // flujo no logueaba nada, así que un "el entrenador no comparte su
    // posición" no se podía distinguir de "nunca se intentó" vs "se negó el
    // permiso" (2026-10-01).
    logDebug(`[trainer-pre-start] permiso GPS resuelto (${Date.now() - startedAt}ms) granted=${gpsEnabled}`);
    setGpsEnabled(gpsEnabled);
    // Gap 26: el Play del entrenador ES la apertura de la sesión presencial
    // del lado del backend (self, sin athleteUserId -- el owner autenticado).
    // Sin este POST, el backend nunca marca `opened_at` y CUALQUIER corredor
    // que intente crear su propio runner_session (su propio Play) recibe 409
    // `session_not_opened` para siempre -- bug real, 2026-10-04: sin esto,
    // ni un solo registro del corredor llegaba a sincronizarse (el loop de
    // syncRun corta en el primer paso, createRunnerSession, y nunca llega a
    // mandar ninguna serie). El entrenador no tiene SQLite propio para
    // reintentar esto si falla, así que se loguea el resultado -- no bloquea
    // la navegación (el entrenador sigue pudiendo supervisar aunque la
    // apertura remota haya fallado, igual que el resto de esta pantalla).
    try {
      await createRunnerSession(sessionInstanceId);
      logDebug(`[trainer-pre-start] sesión presencial ${sessionAlreadyOpen ? 'reanudada' : 'abierta'} (session_instance=${sessionInstanceId})`);
    } catch (error) {
      logDebug(`[trainer-pre-start] ERROR abriendo/reanudando sesión presencial: ${error?.message ?? error}`);
    }
    router.push('/trainer-session-live');
  };

  return (
    <View className="flex-1 bg-paper dark:bg-ink" nativeID="trainer-session-pre-start-screen-root" testID="trainer-session-pre-start-screen-root">
      <View className={`flex-1 w-full self-center ${isWeb ? 'max-w-3xl' : ''}`} nativeID="trainer-session-pre-start-screen-width-container" testID="trainer-session-pre-start-screen-width-container">
      <ScrollView contentContainerClassName="px-4 py-6" nativeID="trainer-session-pre-start-screen-scroll" testID="trainer-session-pre-start-screen-scroll">
        <View className="flex-row items-center justify-between" nativeID="trainer-session-pre-start-screen-header-row" testID="trainer-session-pre-start-screen-header-row">
          <Pressable className="h-9 w-9 items-center justify-center rounded-full active:opacity-70" nativeID="trainer-session-pre-start-screen-back-button" onPress={() => router.back()} testID="trainer-session-pre-start-screen-back-button">
            <MaterialCommunityIcons color={colors.onSurfaceVariant} name="arrow-left" size={20} />
          </Pressable>
          <Pressable
            className="h-9 flex-row items-center gap-1.5 rounded-full border border-slate-200 px-3 active:opacity-70 dark:border-slate-700"
            nativeID="trainer-session-pre-start-screen-attendance-button"
            onPress={() => setAttendanceVisible(true)}
            testID="trainer-session-pre-start-screen-attendance-button"
          >
            <MaterialCommunityIcons color={colors.onSurfaceVariant} name="clipboard-check-outline" size={18} />
            <Text className="text-xs font-semibold text-slate-700 dark:text-slate-200" nativeID="trainer-session-pre-start-screen-attendance-button-label" testID="trainer-session-pre-start-screen-attendance-button-label">
              Asistencia
            </Text>
          </Pressable>
        </View>

        <View className="mb-6 mt-4 items-center" nativeID="trainer-session-pre-start-screen-title-block" testID="trainer-session-pre-start-screen-title-block">
          <Text className="text-base text-slate-500 dark:text-slate-400" nativeID="trainer-session-pre-start-screen-date" testID="trainer-session-pre-start-screen-date">
            {formatWeekdayLabel(pendingSession.date)}, {formatDisplayDate(pendingSession.date)}
            {pendingSession.presencialTimeFrom ? ` · ${pendingSession.presencialTimeFrom}–${pendingSession.presencialTimeTo}` : ''}
          </Text>
          <Text className="mt-1 text-center text-3xl text-slate-900 dark:text-white" nativeID="trainer-session-pre-start-screen-title" style={{ fontFamily: 'Orbitron_700Bold' }} testID="trainer-session-pre-start-screen-title">
            {pendingSession.sessionInstance?.name ?? 'Entrenamiento'}
          </Text>
          {(pendingSession.teamName || pendingSession.groupName) && (
            <View className="mt-2 flex-row items-center gap-4" nativeID="trainer-session-pre-start-screen-scope" testID="trainer-session-pre-start-screen-scope">
              {pendingSession.teamName && (
                <View className="flex-row items-center gap-1" nativeID="trainer-session-pre-start-screen-team" testID="trainer-session-pre-start-screen-team">
                  <MaterialCommunityIcons color={colors.onSurfaceVariant} name="shield-account-outline" size={16} />
                  <Text className="text-sm font-semibold text-slate-600 dark:text-slate-300" nativeID="trainer-session-pre-start-screen-team-label" testID="trainer-session-pre-start-screen-team-label">
                    {pendingSession.teamName}
                  </Text>
                </View>
              )}
              {pendingSession.groupName && (
                <View className="flex-row items-center gap-1" nativeID="trainer-session-pre-start-screen-group" testID="trainer-session-pre-start-screen-group">
                  <MaterialCommunityIcons color={colors.onSurfaceVariant} name="account-multiple-outline" size={16} />
                  <Text className="text-sm font-semibold text-slate-600 dark:text-slate-300" nativeID="trainer-session-pre-start-screen-group-label" testID="trainer-session-pre-start-screen-group-label">
                    {pendingSession.groupName}
                  </Text>
                </View>
              )}
            </View>
          )}
          {pendingSession.presencialLocation?.label && (
            <Pressable
              className="mt-2 max-w-full flex-row items-center gap-1 px-4"
              nativeID="trainer-session-pre-start-screen-presencial-location"
              onPress={() => openLocationInMaps(pendingSession.presencialLocation)}
              testID="trainer-session-pre-start-screen-presencial-location"
            >
              <MaterialCommunityIcons color={colors.primary} name="map-marker-outline" size={16} />
              <Text className="text-sm font-semibold text-primary underline" nativeID="trainer-session-pre-start-screen-presencial-location-label" numberOfLines={1} testID="trainer-session-pre-start-screen-presencial-location-label">
                {pendingSession.presencialLocation.label}
              </Text>
            </Pressable>
          )}
        </View>

        <View className="mb-4" nativeID="trainer-session-pre-start-screen-exercise-container" testID="trainer-session-pre-start-screen-exercise-container">
          <Text className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400" nativeID="trainer-session-pre-start-screen-exercise-container-label" testID="trainer-session-pre-start-screen-exercise-container-label">
            Ejercicios de la sesión ({exercises.length})
          </Text>
          <View className="gap-2" nativeID="trainer-session-pre-start-screen-exercise-list" testID="trainer-session-pre-start-screen-exercise-list">
            {exercises.map((exercise) => (
              <ExerciseRow exercise={exercise} idPrefix="trainer-session-pre-start-screen" key={exercise.id} />
            ))}
          </View>
        </View>

        <View className="mb-4" nativeID="trainer-session-pre-start-screen-participants-container" testID="trainer-session-pre-start-screen-participants-container">
          <Text className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400" nativeID="trainer-session-pre-start-screen-participants-label" testID="trainer-session-pre-start-screen-participants-label">
            Participantes ({sortedMembers.length})
          </Text>
          {participantsExpanded && (
            <TextInput
              className="mb-2 h-10 rounded-full border border-slate-200 bg-white px-4 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-white"
              nativeID="trainer-session-pre-start-screen-participants-search"
              onChangeText={setParticipantsQuery}
              placeholder="Buscar participante"
              placeholderTextColor={colors.onSurfaceVariant}
              testID="trainer-session-pre-start-screen-participants-search"
              value={participantsQuery}
            />
          )}
          {trainerUser && (
            <TrainerCard idPrefix="trainer-session-pre-start-screen-trainer-card" name={trainerUser.name} photoUrl={trainerUser.photoUrl} />
          )}
          <View className="mt-2 gap-2" nativeID="trainer-session-pre-start-screen-participants-list" testID="trainer-session-pre-start-screen-participants-list">
            {visibleMembers.map((member) => (
              <ParticipantRow idPrefix="trainer-session-pre-start-screen" key={member.userId} member={member} />
            ))}
            {!rosterLoading && sortedMembers.length === 0 && (
              <Text className="text-sm text-slate-500 dark:text-slate-400" nativeID="trainer-session-pre-start-screen-participants-empty" testID="trainer-session-pre-start-screen-participants-empty">
                Sin participantes en este grupo.
              </Text>
            )}
          </View>
          {!participantsExpanded && sortedMembers.length > PARTICIPANTS_COLLAPSED_COUNT && (
            <Pressable
              className="mt-2 items-center"
              nativeID="trainer-session-pre-start-screen-participants-expand-button"
              onPress={() => setParticipantsExpanded(true)}
              testID="trainer-session-pre-start-screen-participants-expand-button"
            >
              <Text className="text-sm font-semibold text-primary" nativeID="trainer-session-pre-start-screen-participants-expand-label" testID="trainer-session-pre-start-screen-participants-expand-label">
                Ver todos ({sortedMembers.length})
              </Text>
            </Pressable>
          )}
        </View>
      </ScrollView>

      <View className="border-t border-slate-100 px-4 pb-4 pt-3 dark:border-slate-800" nativeID="trainer-session-pre-start-screen-footer" testID="trainer-session-pre-start-screen-footer">
        {isWeb ? (
          <View className="flex-row items-center gap-1.5 self-center rounded-full bg-emerald-50 px-3 py-1.5 dark:bg-emerald-900/20" nativeID="trainer-session-pre-start-screen-web-notice" testID="trainer-session-pre-start-screen-web-notice">
            <MaterialCommunityIcons color="#16a34a" name="cellphone-check" size={14} />
            <Text className="text-xs font-medium text-emerald-700 dark:text-emerald-400" nativeID="trainer-session-pre-start-screen-web-notice-label" testID="trainer-session-pre-start-screen-web-notice-label">
              El inicio y registro del entrenamiento solo está disponible en la app nativa
            </Text>
          </View>
        ) : (
          <View className="items-center" nativeID="trainer-session-pre-start-screen-play-container" testID="trainer-session-pre-start-screen-play-container">
            <Pressable
              className="h-24 w-24 items-center justify-center self-center rounded-full bg-primary active:opacity-80"
              nativeID="trainer-session-pre-start-screen-play-button"
              onPress={handlePlay}
              testID="trainer-session-pre-start-screen-play-button"
            >
              {/* Ya abierta (el entrenador salió y volvió sin finalizar) -- no
                  es "iniciar de nuevo", es retomar la supervisión de la misma
                  sesión. Mismo ícono base (play), distinto label abajo. */}
              <MaterialCommunityIcons color={colors.onPrimary} name={sessionAlreadyOpen ? 'play-circle-outline' : 'play'} size={44} />
            </Pressable>
            {sessionAlreadyOpen && (
              <Text className="mt-2 text-xs font-semibold text-slate-500 dark:text-slate-400" nativeID="trainer-session-pre-start-screen-play-resume-label" testID="trainer-session-pre-start-screen-play-resume-label">
                Reanudar sesión
              </Text>
            )}
          </View>
        )}
      </View>
      </View>

      <AttendanceSessionModal
        groupId={groupId}
        onClose={() => setAttendanceVisible(false)}
        sessionDate={pendingSession.date}
        sessionInstanceId={pendingSession.sessionInstance?.id}
        sessionName={pendingSession.sessionInstance?.name}
        teamId={teamId}
        teamName={pendingSession.teamName}
        visible={attendanceVisible}
      />
    </View>
  );
}

export function TrainerSessionPreStartScreen() {
  return (
    <RequireAuth>
      <TrainerSessionPreStartScreenContent />
    </RequireAuth>
  );
}
