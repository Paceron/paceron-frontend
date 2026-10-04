import { useMemo, useState } from 'react';
import { Linking, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Redirect, useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useThemeColors } from '../../theme/colors.js';
import { RequireAuth } from '../guards/require-auth.jsx';
import { useSessionRuntimeStore } from '../../store/session-runtime-store.js';
import { useSessionReviewStore } from '../../store/session-review-store.js';
import { useAuthStore } from '../../store/auth-store.js';
import { useTeamRoster } from '../../hooks/use-team-roster.js';
import { useTrainerSessionSummary } from '../../hooks/use-trainer-session-summary.js';
import { useUser } from '../../hooks/use-user.js';
import { filterFeedByAthlete } from '../../utils/trainer-records-feed.js';
import { colorForUserId } from '../../utils/participant-color.js';
import { formatDisplayDate, formatWeekdayLabel } from '../../utils/format-date-display.js';
import { ParticipantAvatar } from './participant-avatar.jsx';
import { RecordsFeedModal } from './records-feed-modal.jsx';
import { AttendanceSessionModal } from './attendance-session-modal.jsx';
import { TrainerCard } from './trainer-card.jsx';

// Resumen post-sesión del entrenador -- entra acá después de confirmar el
// slide-to-finish (trainer-session-live-screen.jsx) o desde el calendario
// para una sesión presencial pasada (ver start-session-button.jsx). Mismo
// propósito que la pantalla de revisión del corredor (session-review-screen),
// pero a nivel de TODA la sesión: quién vino, cómo le fue a cada uno, y
// acceso directo a asistencia -- sin esto, el entrenador tenía que ir al
// módulo de asistencia general y volver a elegir equipo/grupo/sesión a mano.
const STATUS_META = {
  none: { label: 'Sin unirse', bg: 'bg-slate-200 dark:bg-slate-700', text: 'text-slate-600 dark:text-slate-200' },
  wip: { label: 'Sin cerrar', bg: 'bg-amber-300', text: 'text-amber-950' },
  finished: { label: 'Completado', bg: 'bg-emerald-500', text: 'text-white' },
  interrupted: { label: 'Interrumpido', bg: 'bg-red-500', text: 'text-white' },
};

function openLocationInMaps(location) {
  if (!location?.lat || !location?.lng) return;
  Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${location.lat},${location.lng}`);
}

function ParticipantRow({ participant, idPrefix, onPress }) {
  const meta = STATUS_META[participant.runnerStatus ?? 'none'];
  const rowId = `${idPrefix}-participant-${participant.userId}`;
  return (
    <Pressable className="flex-row items-center gap-2.5 rounded-xl border border-slate-200 bg-white p-2.5 dark:border-slate-700 dark:bg-slate-900" nativeID={rowId} onPress={onPress} testID={rowId}>
      <ParticipantAvatar color={colorForUserId(participant.userId)} idPrefix={rowId} name={participant.name} photoUrl={participant.photoUrl} size={36} />
      <Text className="flex-1 text-sm font-semibold text-slate-900 dark:text-white" nativeID={`${rowId}-name`} numberOfLines={1} testID={`${rowId}-name`}>
        {participant.name}
      </Text>
      <View className={`rounded-full px-2.5 py-1 ${meta.bg}`} nativeID={`${rowId}-status`} testID={`${rowId}-status`}>
        <Text className={`text-[11px] font-semibold ${meta.text}`} nativeID={`${rowId}-status-label`} testID={`${rowId}-status-label`}>{meta.label}</Text>
      </View>
      <MaterialCommunityIcons color="#9ca3af" name="chevron-right" size={18} />
    </Pressable>
  );
}

function TrainerSessionReviewScreenContent() {
  const router = useRouter();
  const colors = useThemeColors();
  const pendingSession = useSessionRuntimeStore((s) => s.pendingSession);
  const clearPendingSession = useSessionRuntimeStore((s) => s.clearPendingSession);
  const setReviewSlot = useSessionReviewStore((s) => s.setReviewSlot);
  const [attendanceVisible, setAttendanceVisible] = useState(false);
  const [feedVisible, setFeedVisible] = useState(false);
  const [feedFilterAthleteId, setFeedFilterAthleteId] = useState(null);

  const teamId = pendingSession?.teamId ?? null;
  const groupId = pendingSession?.groupId ?? null;
  const sessionInstanceId = pendingSession?.sessionInstance?.id;
  const exercises = pendingSession?.sessionInstance?.exercises ?? [];
  const { members: rosterMembers } = useTeamRoster(teamId, groupId ? [groupId] : []);
  const trainerUserId = useAuthStore((s) => s.userId);
  const { user: trainerUser } = useUser(trainerUserId);
  // El entrenador puede figurar en el roster del grupo -- no es un corredor
  // más, se muestra aparte vía TrainerCard, nunca en la lista de abajo.
  const runnerMembers = rosterMembers.filter((m) => String(m.userId) !== String(trainerUserId));
  const { participants, feed, loading } = useTrainerSessionSummary({ sessionInstanceId, exercises, rosterMembers: runnerMembers });

  const sortedParticipants = useMemo(() => [...participants].sort((a, b) => a.name.localeCompare(b.name)), [participants]);
  const visibleFeed = filterFeedByAthlete(feed, feedFilterAthleteId);
  const feedOptions = runnerMembers.map((m) => ({ id: m.userId, name: m.name }));
  const attendedCount = sortedParticipants.filter((p) => p.runnerStatus === 'finished' || p.runnerStatus === 'interrupted' || p.runnerStatus === 'wip').length;

  if (!pendingSession) return <Redirect href="/" />;

  const handleDone = () => {
    clearPendingSession();
    router.back();
  };

  const openAthleteReview = (participant) => {
    const mode = participant.runnerStatus === 'finished' || participant.runnerStatus === 'interrupted' ? 'review' : 'manual';
    setReviewSlot({
      sessionInstance: pendingSession.sessionInstance,
      sessionInstanceId,
      date: pendingSession.date,
      sessionName: pendingSession.sessionInstance?.name,
      role: 'trainer',
      athleteUserId: participant.userId,
      mode,
      completionStatus: participant.runnerStatus,
      teamId: pendingSession.teamId ?? null,
      teamName: pendingSession.teamName ?? null,
      groupName: pendingSession.groupName ?? null,
    });
    router.push('/training-session-review');
  };

  return (
    <SafeAreaView className="flex-1 bg-paper dark:bg-ink" edges={['top', 'bottom']} nativeID="trainer-session-review-screen-root" testID="trainer-session-review-screen-root">
      <ScrollView contentContainerClassName="px-4 py-6" nativeID="trainer-session-review-screen-scroll" testID="trainer-session-review-screen-scroll">
        <View className="flex-row items-center justify-between" nativeID="trainer-session-review-screen-header-row" testID="trainer-session-review-screen-header-row">
          <Pressable className="h-9 w-9 items-center justify-center rounded-full active:opacity-70" nativeID="trainer-session-review-screen-back-button" onPress={handleDone} testID="trainer-session-review-screen-back-button">
            <MaterialCommunityIcons color={colors.onSurfaceVariant} name="arrow-left" size={20} />
          </Pressable>
          <Pressable
            className="h-9 flex-row items-center gap-1.5 rounded-full border border-slate-200 px-3 active:opacity-70 dark:border-slate-700"
            nativeID="trainer-session-review-screen-attendance-button"
            onPress={() => setAttendanceVisible(true)}
            testID="trainer-session-review-screen-attendance-button"
          >
            <MaterialCommunityIcons color={colors.onSurfaceVariant} name="clipboard-check-outline" size={18} />
            <Text className="text-xs font-semibold text-slate-700 dark:text-slate-200" nativeID="trainer-session-review-screen-attendance-button-label" testID="trainer-session-review-screen-attendance-button-label">
              Asistencia
            </Text>
          </Pressable>
        </View>

        <View className="mb-6 mt-4 items-center" nativeID="trainer-session-review-screen-title-block" testID="trainer-session-review-screen-title-block">
          <View className="mb-2 flex-row items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1.5 dark:bg-emerald-900/20" nativeID="trainer-session-review-screen-done-badge" testID="trainer-session-review-screen-done-badge">
            <MaterialCommunityIcons color="#16a34a" name="check-decagram" size={16} />
            <Text className="text-sm font-semibold text-emerald-700 dark:text-emerald-400" nativeID="trainer-session-review-screen-done-badge-label" testID="trainer-session-review-screen-done-badge-label">
              Sesión finalizada
            </Text>
          </View>
          <Text className="text-base text-slate-500 dark:text-slate-400" nativeID="trainer-session-review-screen-date" testID="trainer-session-review-screen-date">
            {formatWeekdayLabel(pendingSession.date)}, {formatDisplayDate(pendingSession.date)}
          </Text>
          <Text className="mt-1 text-center text-3xl text-slate-900 dark:text-white" nativeID="trainer-session-review-screen-title" style={{ fontFamily: 'Orbitron_700Bold' }} testID="trainer-session-review-screen-title">
            {pendingSession.sessionInstance?.name ?? 'Entrenamiento'}
          </Text>
          {(pendingSession.teamName || pendingSession.groupName) && (
            <View className="mt-2 flex-row items-center gap-4" nativeID="trainer-session-review-screen-scope" testID="trainer-session-review-screen-scope">
              {pendingSession.teamName && (
                <View className="flex-row items-center gap-1" nativeID="trainer-session-review-screen-team" testID="trainer-session-review-screen-team">
                  <MaterialCommunityIcons color={colors.onSurfaceVariant} name="shield-account-outline" size={16} />
                  <Text className="text-sm font-semibold text-slate-600 dark:text-slate-300" nativeID="trainer-session-review-screen-team-label" testID="trainer-session-review-screen-team-label">
                    {pendingSession.teamName}
                  </Text>
                </View>
              )}
              {pendingSession.groupName && (
                <View className="flex-row items-center gap-1" nativeID="trainer-session-review-screen-group" testID="trainer-session-review-screen-group">
                  <MaterialCommunityIcons color={colors.onSurfaceVariant} name="account-multiple-outline" size={16} />
                  <Text className="text-sm font-semibold text-slate-600 dark:text-slate-300" nativeID="trainer-session-review-screen-group-label" testID="trainer-session-review-screen-group-label">
                    {pendingSession.groupName}
                  </Text>
                </View>
              )}
            </View>
          )}
          {pendingSession.presencialLocation?.label && (
            <Pressable
              className="mt-2 max-w-full flex-row items-center gap-1 px-4"
              nativeID="trainer-session-review-screen-presencial-location"
              onPress={() => openLocationInMaps(pendingSession.presencialLocation)}
              testID="trainer-session-review-screen-presencial-location"
            >
              <MaterialCommunityIcons color={colors.primary} name="map-marker-outline" size={16} />
              <Text className="text-sm font-semibold text-primary underline" nativeID="trainer-session-review-screen-presencial-location-label" numberOfLines={1} testID="trainer-session-review-screen-presencial-location-label">
                {pendingSession.presencialLocation.label}
              </Text>
            </Pressable>
          )}
        </View>

        <Pressable
          className="mb-4 flex-row items-center justify-center gap-2 rounded-full bg-primary py-3 active:opacity-80"
          nativeID="trainer-session-review-screen-feed-button"
          onPress={() => setFeedVisible(true)}
          testID="trainer-session-review-screen-feed-button"
        >
          <MaterialCommunityIcons color={colors.onPrimary} name="clipboard-text-multiple-outline" size={18} />
          <Text className="text-sm font-bold uppercase tracking-wide text-[#111518]" nativeID="trainer-session-review-screen-feed-button-label" testID="trainer-session-review-screen-feed-button-label">
            Ver registros ({feed.length})
          </Text>
        </Pressable>

        <View nativeID="trainer-session-review-screen-participants-container" testID="trainer-session-review-screen-participants-container">
          <Text className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400" nativeID="trainer-session-review-screen-participants-label" testID="trainer-session-review-screen-participants-label">
            Participantes ({attendedCount}/{sortedParticipants.length})
          </Text>
          {trainerUser && (
            <TrainerCard idPrefix="trainer-session-review-screen-trainer-card" name={trainerUser.name} photoUrl={trainerUser.photoUrl} />
          )}
          <View className="mt-2 gap-2" nativeID="trainer-session-review-screen-participants-list" testID="trainer-session-review-screen-participants-list">
            {sortedParticipants.map((participant) => (
              <ParticipantRow idPrefix="trainer-session-review-screen" key={participant.userId} onPress={() => openAthleteReview(participant)} participant={participant} />
            ))}
            {!loading && sortedParticipants.length === 0 && (
              <Text className="text-sm text-slate-500 dark:text-slate-400" nativeID="trainer-session-review-screen-participants-empty" testID="trainer-session-review-screen-participants-empty">
                Sin participantes en este grupo.
              </Text>
            )}
          </View>
        </View>
      </ScrollView>

      <AttendanceSessionModal
        groupId={groupId}
        onClose={() => setAttendanceVisible(false)}
        sessionDate={pendingSession.date}
        sessionInstanceId={sessionInstanceId}
        sessionName={pendingSession.sessionInstance?.name}
        teamId={teamId}
        teamName={pendingSession.teamName}
        visible={attendanceVisible}
      />

      <RecordsFeedModal
        feed={visibleFeed}
        feedFilterAthleteId={feedFilterAthleteId}
        feedOptions={feedOptions}
        idPrefix="trainer-session-review-screen-feed-modal"
        onChangeFeedFilter={setFeedFilterAthleteId}
        onClose={() => setFeedVisible(false)}
        visible={feedVisible}
      />
    </SafeAreaView>
  );
}

export function TrainerSessionReviewScreen() {
  return (
    <RequireAuth>
      <TrainerSessionReviewScreenContent />
    </RequireAuth>
  );
}
