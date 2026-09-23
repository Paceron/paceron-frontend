import { useState } from 'react';
import { Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { Redirect, useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useThemeColors } from '../../theme/colors.js';
import { MobileOnlyRoute } from '../guards/platform-gate.jsx';
import { useSessionRuntimeStore } from '../../store/session-runtime-store.js';
import { formatDisplayDate, formatWeekdayLabel } from '../../utils/format-date-display.js';

const PREVIEW_EXERCISE_COUNT = 3;

function ExerciseRow({ exercise, idPrefix }) {
  const rowId = `${idPrefix}-exercise-${exercise.id}`;
  return (
    <View className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 dark:border-slate-700 dark:bg-slate-900" nativeID={rowId} testID={rowId}>
      <Text className="text-sm font-semibold text-slate-900 dark:text-white" nativeID={`${rowId}-name`} testID={`${rowId}-name`}>
        {exercise.name}
      </Text>
      <Text className="text-xs text-slate-500 dark:text-slate-400" nativeID={`${rowId}-detail`} testID={`${rowId}-detail`}>
        {exercise.repeatCount} serie{exercise.repeatCount === 1 ? '' : 's'} · descanso {exercise.restMinutes} min
      </Text>
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
    <View className="flex-1 bg-paper dark:bg-ink" nativeID="session-pre-start-screen-root" testID="session-pre-start-screen-root">
      <ScrollView contentContainerClassName="flex-1 px-4 py-8" nativeID="session-pre-start-screen-scroll" testID="session-pre-start-screen-scroll">
        <View className="mb-6 flex-row items-center gap-2" nativeID="session-pre-start-screen-header" testID="session-pre-start-screen-header">
          <Pressable
            className="flex-row items-center gap-1.5 py-1 pr-1 active:opacity-70"
            nativeID="session-pre-start-screen-back-button"
            onPress={() => router.back()}
            testID="session-pre-start-screen-back-button"
          >
            <MaterialCommunityIcons color={colors.onSurfaceVariant} name="arrow-left" size={18} />
          </Pressable>
          <View nativeID="session-pre-start-screen-date-wrapper" testID="session-pre-start-screen-date-wrapper">
            <Text className="text-xs text-slate-500 dark:text-slate-400" nativeID="session-pre-start-screen-date" testID="session-pre-start-screen-date">
              {formatWeekdayLabel(pendingSession.date)}, {formatDisplayDate(pendingSession.date)}
            </Text>
            <Text className="text-xl text-slate-900 dark:text-white" nativeID="session-pre-start-screen-title" style={{ fontFamily: 'Orbitron_700Bold' }} testID="session-pre-start-screen-title">
              {pendingSession.sessionInstance?.name ?? 'Entrenamiento'}
            </Text>
          </View>
        </View>

        <View className="mb-4 gap-2" nativeID="session-pre-start-screen-exercise-list" testID="session-pre-start-screen-exercise-list">
          {previewExercises.map((exercise) => (
            <ExerciseRow exercise={exercise} idPrefix="session-pre-start-screen" key={exercise.id} />
          ))}
        </View>

        {hasMore && (
          <Pressable
            className="mb-6 h-9 flex-row items-center justify-center gap-1.5 self-start rounded-full border border-slate-200 px-3 active:opacity-70 dark:border-slate-700"
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

        <View className="flex-1" nativeID="session-pre-start-screen-spacer" testID="session-pre-start-screen-spacer" />

        <Pressable
          className="h-16 w-16 items-center justify-center self-center rounded-full bg-primary active:opacity-80"
          nativeID="session-pre-start-screen-play-button"
          onPress={() => router.push('/training-session-active')}
          testID="session-pre-start-screen-play-button"
        >
          <MaterialCommunityIcons color={colors.onPrimary} name="play" size={32} />
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
    </View>
  );
}

export function SessionPreStartScreen() {
  return (
    <MobileOnlyRoute>
      <SessionPreStartScreenContent />
    </MobileOnlyRoute>
  );
}
