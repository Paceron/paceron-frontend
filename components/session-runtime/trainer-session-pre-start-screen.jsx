import { useState } from 'react';
import { Linking, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Redirect, useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useThemeColors } from '../../theme/colors.js';
import { MobileOnlyRoute } from '../guards/platform-gate.jsx';
import { useSessionRuntimeStore } from '../../store/session-runtime-store.js';
import { useAuthStore } from '../../store/auth-store.js';
import { useTeamRoster } from '../../hooks/use-team-roster.js';
import { filterByName } from '../../utils/attendance-filter.js';
import { formatDisplayDate, formatWeekdayLabel } from '../../utils/format-date-display.js';
import { AttendanceSessionModal } from './attendance-session-modal.jsx';

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
      <Text className="flex-1 text-sm font-semibold text-slate-900 dark:text-white" nativeID={`${rowId}-name`} numberOfLines={1} testID={`${rowId}-name`}>
        {member.name}
      </Text>
    </View>
  );
}

function TrainerSessionPreStartScreenContent() {
  const router = useRouter();
  const colors = useThemeColors();
  const pendingSession = useSessionRuntimeStore((s) => s.pendingSession);
  const userId = useAuthStore((s) => s.userId);
  const [participantsExpanded, setParticipantsExpanded] = useState(false);
  const [participantsQuery, setParticipantsQuery] = useState('');
  const [attendanceVisible, setAttendanceVisible] = useState(false);

  const teamId = pendingSession?.teamId ?? null;
  const groupId = pendingSession?.groupId ?? null;
  const { members, loading: rosterLoading } = useTeamRoster(teamId, groupId ? [groupId] : []);

  if (!pendingSession) return <Redirect href="/" />;

  const exercises = pendingSession.sessionInstance?.exercises ?? [];
  const sortedMembers = [...members].sort((a, b) => a.name.localeCompare(b.name));
  const visibleMembers = participantsExpanded ? filterByName(sortedMembers, participantsQuery) : sortedMembers.slice(0, PARTICIPANTS_COLLAPSED_COUNT);

  const handlePlay = () => {
    router.push('/trainer-session-live');
  };

  return (
    <SafeAreaView className="flex-1 bg-paper dark:bg-ink" edges={['top', 'bottom']} nativeID="trainer-session-pre-start-screen-root" testID="trainer-session-pre-start-screen-root">
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
          <View className="gap-2" nativeID="trainer-session-pre-start-screen-participants-list" testID="trainer-session-pre-start-screen-participants-list">
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
        <Pressable
          className="h-24 w-24 items-center justify-center self-center rounded-full bg-primary active:opacity-80"
          nativeID="trainer-session-pre-start-screen-play-button"
          onPress={handlePlay}
          testID="trainer-session-pre-start-screen-play-button"
        >
          <MaterialCommunityIcons color={colors.onPrimary} name="play" size={44} />
        </Pressable>
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
    </SafeAreaView>
  );
}

export function TrainerSessionPreStartScreen() {
  return (
    <MobileOnlyRoute>
      <TrainerSessionPreStartScreenContent />
    </MobileOnlyRoute>
  );
}
