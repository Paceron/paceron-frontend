import { useState } from 'react';
import { Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Redirect, useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useThemeColors } from '../../theme/colors.js';
import { MobileOnlyRoute } from '../guards/platform-gate.jsx';
import { useSessionRuntimeStore } from '../../store/session-runtime-store.js';
import { formatDisplayDate, formatWeekdayLabel } from '../../utils/format-date-display.js';

const PREVIEW_EXERCISE_COUNT = 3;

function ExerciseRow({ exercise, idPrefix }) {
  const colors = useThemeColors();
  const [expanded, setExpanded] = useState(false);
  const rowId = `${idPrefix}-exercise-${exercise.id}`;
  const hasMultipleSeries = exercise.repeatCount > 1;

  return (
    <View className="rounded-xl border border-slate-200 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-900" nativeID={rowId} testID={rowId}>
      <Pressable
        className="flex-row items-center justify-between"
        disabled={!hasMultipleSeries}
        nativeID={`${rowId}-toggle`}
        onPress={() => setExpanded((v) => !v)}
        testID={`${rowId}-toggle`}
      >
        <View nativeID={`${rowId}-summary`} testID={`${rowId}-summary`}>
          <Text className="text-sm font-semibold text-slate-900 dark:text-white" nativeID={`${rowId}-name`} testID={`${rowId}-name`}>
            {exercise.name}
          </Text>
          <Text className="text-xs text-slate-500 dark:text-slate-400" nativeID={`${rowId}-detail`} testID={`${rowId}-detail`}>
            {exercise.repeatCount} serie{hasMultipleSeries ? 's' : ''} · descanso {exercise.restMinutes} min
          </Text>
        </View>
        {hasMultipleSeries && <MaterialCommunityIcons color={colors.onSurfaceVariant} name={expanded ? 'chevron-up' : 'chevron-down'} size={18} />}
      </Pressable>
      {expanded && hasMultipleSeries && (
        <View className="mt-2 gap-1 border-t border-slate-100 pt-2 dark:border-slate-800" nativeID={`${rowId}-series-list`} testID={`${rowId}-series-list`}>
          {Array.from({ length: exercise.repeatCount }, (_, i) => (
            <Text className="text-xs text-slate-600 dark:text-slate-300" key={i} nativeID={`${rowId}-series-${i + 1}`} testID={`${rowId}-series-${i + 1}`}>
              Serie {i + 1}
            </Text>
          ))}
        </View>
      )}
    </View>
  );
}

function SessionPreStartScreenContent() {
  const router = useRouter();
  const colors = useThemeColors();
  const pendingSession = useSessionRuntimeStore((s) => s.pendingSession);
  const [listVisible, setListVisible] = useState(false);

  if (!pendingSession) return <Redirect href="/" />;

  const exercises = pendingSession.sessionInstance?.exercises ?? [];
  const previewExercises = exercises.slice(0, PREVIEW_EXERCISE_COUNT);
  const hasMore = exercises.length > PREVIEW_EXERCISE_COUNT;

  return (
    <SafeAreaView className="flex-1 bg-paper dark:bg-ink" edges={['top', 'bottom']} nativeID="session-pre-start-screen-root" testID="session-pre-start-screen-root">
      <ScrollView contentContainerClassName="flex-1 px-4 py-6" nativeID="session-pre-start-screen-scroll" testID="session-pre-start-screen-scroll">
        <Pressable
          className="h-9 w-9 items-center justify-center self-start rounded-full active:opacity-70"
          nativeID="session-pre-start-screen-back-button"
          onPress={() => router.back()}
          testID="session-pre-start-screen-back-button"
        >
          <MaterialCommunityIcons color={colors.onSurfaceVariant} name="arrow-left" size={20} />
        </Pressable>

        <View className="mb-6 mt-4 items-center" nativeID="session-pre-start-screen-title-block" testID="session-pre-start-screen-title-block">
          <Text className="text-base text-slate-500 dark:text-slate-400" nativeID="session-pre-start-screen-date" testID="session-pre-start-screen-date">
            {formatWeekdayLabel(pendingSession.date)}, {formatDisplayDate(pendingSession.date)}
          </Text>
          <Text className="mt-1 text-center text-3xl text-slate-900 dark:text-white" nativeID="session-pre-start-screen-title" style={{ fontFamily: 'Orbitron_700Bold' }} testID="session-pre-start-screen-title">
            {pendingSession.sessionInstance?.name ?? 'Entrenamiento'}
          </Text>
          {(pendingSession.teamName || pendingSession.groupName) && (
            <View className="mt-2 flex-row items-center gap-4" nativeID="session-pre-start-screen-scope" testID="session-pre-start-screen-scope">
              {pendingSession.teamName && (
                <View className="flex-row items-center gap-1" nativeID="session-pre-start-screen-team" testID="session-pre-start-screen-team">
                  <MaterialCommunityIcons color={colors.onSurfaceVariant} name="shield-account-outline" size={16} />
                  <Text className="text-sm font-semibold text-slate-600 dark:text-slate-300" nativeID="session-pre-start-screen-team-label" testID="session-pre-start-screen-team-label">
                    {pendingSession.teamName}
                  </Text>
                </View>
              )}
              {pendingSession.groupName && (
                <View className="flex-row items-center gap-1" nativeID="session-pre-start-screen-group" testID="session-pre-start-screen-group">
                  <MaterialCommunityIcons color={colors.onSurfaceVariant} name="account-multiple-outline" size={16} />
                  <Text className="text-sm font-semibold text-slate-600 dark:text-slate-300" nativeID="session-pre-start-screen-group-label" testID="session-pre-start-screen-group-label">
                    {pendingSession.groupName}
                  </Text>
                </View>
              )}
            </View>
          )}
        </View>

        <View className="mb-4 rounded-2xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-900/40" nativeID="session-pre-start-screen-exercise-container" testID="session-pre-start-screen-exercise-container">
          <Text className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400" nativeID="session-pre-start-screen-exercise-container-label" testID="session-pre-start-screen-exercise-container-label">
            Ejercicios de la sesión
          </Text>
          <View className="gap-2" nativeID="session-pre-start-screen-exercise-list" testID="session-pre-start-screen-exercise-list">
            {previewExercises.map((exercise) => (
              <ExerciseRow exercise={exercise} idPrefix="session-pre-start-screen" key={exercise.id} />
            ))}
          </View>

          {hasMore && (
            <Pressable
              className="mt-3 h-9 flex-row items-center justify-center gap-1.5 self-start rounded-full border border-slate-200 px-3 active:opacity-70 dark:border-slate-700"
              nativeID="session-pre-start-screen-see-all-button"
              onPress={() => setListVisible(true)}
              testID="session-pre-start-screen-see-all-button"
            >
              <MaterialCommunityIcons color={colors.onSurfaceVariant} name="dots-horizontal" size={16} />
              <Text className="text-xs font-semibold text-slate-700 dark:text-slate-200" nativeID="session-pre-start-screen-see-all-button-label" testID="session-pre-start-screen-see-all-button-label">
                Ver los {exercises.length} ejercicios
              </Text>
            </Pressable>
          )}
        </View>

        <View className="flex-1" nativeID="session-pre-start-screen-spacer" testID="session-pre-start-screen-spacer" />

        <Pressable
          className="h-24 w-24 items-center justify-center self-center rounded-full bg-primary active:opacity-80"
          nativeID="session-pre-start-screen-play-button"
          onPress={() => router.push('/training-session-active')}
          testID="session-pre-start-screen-play-button"
        >
          <MaterialCommunityIcons color={colors.onPrimary} name="play" size={44} />
        </Pressable>
      </ScrollView>

      <Modal
        animationType="fade"
        nativeID="session-pre-start-screen-exercise-modal"
        onRequestClose={() => setListVisible(false)}
        testID="session-pre-start-screen-exercise-modal"
        transparent
        visible={listVisible}
      >
        <Pressable
          className="flex-1 items-center justify-center bg-black/50 px-4"
          nativeID="session-pre-start-screen-exercise-modal-backdrop"
          onPress={() => setListVisible(false)}
          testID="session-pre-start-screen-exercise-modal-backdrop"
        >
          <Pressable
            className="max-h-[80%] w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-4 shadow-xl dark:border-slate-700 dark:bg-surface"
            nativeID="session-pre-start-screen-exercise-modal-card"
            onPress={() => {}}
            testID="session-pre-start-screen-exercise-modal-card"
          >
            <Text className="mb-3 text-lg font-bold text-slate-900 dark:text-white" nativeID="session-pre-start-screen-exercise-modal-title" testID="session-pre-start-screen-exercise-modal-title">
              Ejercicios de la sesión
            </Text>
            <ScrollView nativeID="session-pre-start-screen-exercise-modal-scroll" testID="session-pre-start-screen-exercise-modal-scroll">
              <View className="gap-2" nativeID="session-pre-start-screen-exercise-modal-list" testID="session-pre-start-screen-exercise-modal-list">
                {exercises.map((exercise) => (
                  <ExerciseRow exercise={exercise} idPrefix="session-pre-start-screen-modal" key={exercise.id} />
                ))}
              </View>
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

export function SessionPreStartScreen() {
  return (
    <MobileOnlyRoute>
      <SessionPreStartScreenContent />
    </MobileOnlyRoute>
  );
}
