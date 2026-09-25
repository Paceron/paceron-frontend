import { useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useThemeColors } from '../../theme/colors.js';
import { formatDisplayDate, formatWeekdayLabel } from '../../utils/format-date-display.js';
import { StartSessionButton } from './start-session-button.jsx';
import { DayDetailModal } from './day-detail-modal.jsx';

const PREVIEW_COUNT = 5;

function UpcomingTrainingCard({ training, variant, onPress }) {
  const colors = useThemeColors();
  const idPrefix = `upcoming-training-card-${training.id}`;

  return (
    <Pressable
      className="rounded-xl border border-slate-200 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-900"
      nativeID={idPrefix}
      onPress={onPress}
      testID={idPrefix}
    >
      <Text className="text-xs font-semibold text-slate-500 dark:text-slate-400" nativeID={`${idPrefix}-date`} testID={`${idPrefix}-date`}>
        {formatWeekdayLabel(training.date, { short: true })}, {formatDisplayDate(training.date)}
      </Text>
      <View className="mt-1 flex-row flex-wrap items-center gap-x-3 gap-y-0.5" nativeID={`${idPrefix}-scope`} testID={`${idPrefix}-scope`}>
        <View className="flex-row items-center gap-1" nativeID={`${idPrefix}-team`} testID={`${idPrefix}-team`}>
          <MaterialCommunityIcons color={colors.onSurfaceVariant} name="shield-account-outline" size={12} />
          <Text className="text-xs font-bold text-slate-700 dark:text-slate-200" nativeID={`${idPrefix}-team-label`} testID={`${idPrefix}-team-label`}>
            {training.teamName}
          </Text>
        </View>
        <View className="flex-row items-center gap-1" nativeID={`${idPrefix}-group`} testID={`${idPrefix}-group`}>
          <MaterialCommunityIcons color={colors.onSurfaceVariant} name="account-multiple-outline" size={12} />
          <Text className="text-xs font-semibold text-slate-500 dark:text-slate-400" nativeID={`${idPrefix}-group-label`} testID={`${idPrefix}-group-label`}>
            {training.groupName}
          </Text>
        </View>
      </View>
      <Text className="mt-1 text-sm font-semibold text-slate-900 dark:text-white" nativeID={`${idPrefix}-session-name`} testID={`${idPrefix}-session-name`}>
        {training.sessionInstance?.name ?? 'Entrenamiento'}
      </Text>
      {training.isPresencial && (
        <View className="mt-1 flex-row items-center gap-1.5" nativeID={`${idPrefix}-presencial`} testID={`${idPrefix}-presencial`}>
          <MaterialCommunityIcons color={colors.onSurfaceVariant} name="map-marker-outline" size={14} />
          <Text className="text-xs text-slate-500 dark:text-slate-400" nativeID={`${idPrefix}-presencial-label`} testID={`${idPrefix}-presencial-label`}>
            {training.presencialTimeFrom}–{training.presencialTimeTo}
            {training.presencialLocation?.label ? ` · ${training.presencialLocation.label}` : ''}
          </Text>
        </View>
      )}
      <StartSessionButton assignment={training} role={variant === 'member' ? 'runner' : 'trainer'} />
    </Pressable>
  );
}

export function UpcomingTrainingsGrid({ trainings, variant, loading, isFetching }) {
  const colors = useThemeColors();
  const [seeAllVisible, setSeeAllVisible] = useState(false);
  const [openTraining, setOpenTraining] = useState(null);

  const previewTrainings = trainings.slice(0, PREVIEW_COUNT);
  const hasMore = trainings.length > PREVIEW_COUNT;

  return (
    <View className="mt-6 gap-2" nativeID="upcoming-trainings-grid-root" testID="upcoming-trainings-grid-root">
      <View className="flex-row items-center gap-2" nativeID="upcoming-trainings-grid-title-row" testID="upcoming-trainings-grid-title-row">
        <Text className="text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400" nativeID="upcoming-trainings-grid-title" testID="upcoming-trainings-grid-title">
          Próximos entrenamientos
        </Text>
        {(loading || isFetching) && (
          <ActivityIndicator color={colors.primary} nativeID="upcoming-trainings-grid-loading" size="small" testID="upcoming-trainings-grid-loading" />
        )}
      </View>

      {!loading && previewTrainings.length === 0 && (
        <Text className="text-sm text-slate-500 dark:text-slate-400" nativeID="upcoming-trainings-grid-empty" testID="upcoming-trainings-grid-empty">
          No tenés entrenamientos próximos.
        </Text>
      )}

      <View className="gap-2" nativeID="upcoming-trainings-grid-list" testID="upcoming-trainings-grid-list">
        {previewTrainings.map((training) => (
          <UpcomingTrainingCard key={training.id} onPress={() => setOpenTraining(training)} training={training} variant={variant} />
        ))}
      </View>

      {hasMore && (
        <Pressable
          className="mt-1 h-9 flex-row items-center justify-center gap-1.5 self-start rounded-full border border-slate-200 px-3 active:opacity-70 dark:border-slate-700"
          nativeID="upcoming-trainings-grid-see-all-button"
          onPress={() => setSeeAllVisible(true)}
          testID="upcoming-trainings-grid-see-all-button"
        >
          <MaterialCommunityIcons color={colors.onSurfaceVariant} name="dots-horizontal" size={16} />
          <Text className="text-xs font-semibold text-slate-700 dark:text-slate-200" nativeID="upcoming-trainings-grid-see-all-button-label" testID="upcoming-trainings-grid-see-all-button-label">
            Ver todos ({trainings.length})
          </Text>
        </Pressable>
      )}

      <Modal
        animationType="fade"
        nativeID="upcoming-trainings-grid-see-all-modal"
        onRequestClose={() => setSeeAllVisible(false)}
        testID="upcoming-trainings-grid-see-all-modal"
        transparent
        visible={seeAllVisible}
      >
        <Pressable
          className="flex-1 items-center justify-center bg-black/50 px-4"
          nativeID="upcoming-trainings-grid-see-all-modal-backdrop"
          onPress={() => setSeeAllVisible(false)}
          testID="upcoming-trainings-grid-see-all-modal-backdrop"
        >
          <Pressable
            className="max-h-[80%] w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-4 shadow-xl dark:border-slate-700 dark:bg-surface"
            nativeID="upcoming-trainings-grid-see-all-modal-card"
            onPress={() => {}}
            testID="upcoming-trainings-grid-see-all-modal-card"
          >
            <Text className="mb-3 text-lg font-bold text-slate-900 dark:text-white" nativeID="upcoming-trainings-grid-see-all-modal-title" testID="upcoming-trainings-grid-see-all-modal-title">
              Próximos entrenamientos
            </Text>
            <ScrollView nativeID="upcoming-trainings-grid-see-all-modal-scroll" testID="upcoming-trainings-grid-see-all-modal-scroll">
              <View className="gap-2" nativeID="upcoming-trainings-grid-see-all-modal-list" testID="upcoming-trainings-grid-see-all-modal-list">
                {trainings.map((training) => (
                  <UpcomingTrainingCard key={training.id} onPress={() => setOpenTraining(training)} training={training} variant={variant} />
                ))}
              </View>
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>

      <DayDetailModal
        assignments={openTraining ? [openTraining] : []}
        date={openTraining?.date ?? ''}
        onClose={() => setOpenTraining(null)}
        variant={variant}
        visible={Boolean(openTraining)}
      />
    </View>
  );
}
