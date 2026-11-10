import { Pressable, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useAuthStore } from '../../store/auth-store.js';
import { useComparisonList } from '../../hooks/use-activity-comparison.js';
import { useCalendarTabStore } from '../../store/calendar-tab-store.js';
import { selectRecentFinishedTrainings } from '../../utils/recent-trainings.js';
import { formatComparisonDate } from '../../utils/comparison-format.js';
import { formatClock } from '../../utils/time.js';
import { formatMeters } from '../../utils/distance.js';
import { pad2 } from '../../utils/calendar-month-range.js';
import { ComplianceBadge } from '../comparison/compliance-badge.jsx';
import { useThemeColors } from '../../theme/colors.js';

const WINDOW_DAYS = 90;

function toISODate(date) {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

function RecentTrainingRow({ training, onPress }) {
  const colors = useThemeColors();
  const idPrefix = `recent-trainings-card-row-${training.sessionInstanceId}`;
  const durationLabel = formatClock(training.totals.actualDurationMs);
  const distanceLabel = formatMeters(training.totals.actualDistanceM);

  return (
    <Pressable
      accessibilityLabel={`Ver ${training.sessionName ?? 'entrenamiento'} del ${formatComparisonDate(training.date)}`}
      accessibilityRole="button"
      className="flex-row items-center gap-3 rounded-xl bg-slate-100 p-3 hover:opacity-90 active:opacity-90 dark:bg-slate-800"
      nativeID={idPrefix}
      onPress={onPress}
      testID={idPrefix}
    >
      <MaterialCommunityIcons color={colors.primary} name={training.isPresencial ? 'map-marker-radius' : 'run-fast'} size={18} />
      <View className="flex-1" nativeID={`${idPrefix}-info`} testID={`${idPrefix}-info`}>
        <View className="flex-row flex-wrap items-center gap-x-1.5 gap-y-0.5" nativeID={`${idPrefix}-primary`} testID={`${idPrefix}-primary`}>
          <Text className="text-sm font-semibold text-slate-900 dark:text-white" nativeID={`${idPrefix}-date`} testID={`${idPrefix}-date`}>
            {formatComparisonDate(training.date)}
          </Text>
          <Text className="text-slate-300 dark:text-slate-600" nativeID={`${idPrefix}-sep`} testID={`${idPrefix}-sep`}>·</Text>
          <Text className="flex-1 text-sm text-slate-700 dark:text-slate-200" nativeID={`${idPrefix}-session-name`} numberOfLines={1} testID={`${idPrefix}-session-name`}>
            {training.sessionName}
          </Text>
        </View>
        <View className="mt-1 flex-row flex-wrap items-center gap-x-2 gap-y-1" nativeID={`${idPrefix}-meta`} testID={`${idPrefix}-meta`}>
          {training.teamName && (
            <Text className="text-xs text-slate-500 dark:text-slate-400" nativeID={`${idPrefix}-team`} numberOfLines={1} testID={`${idPrefix}-team`}>
              {training.teamName}
            </Text>
          )}
          <Text className="text-xs text-slate-500 dark:text-slate-400" nativeID={`${idPrefix}-duration`} testID={`${idPrefix}-duration`}>
            {durationLabel}
          </Text>
          <Text className="text-xs text-slate-500 dark:text-slate-400" nativeID={`${idPrefix}-distance`} testID={`${idPrefix}-distance`}>
            {distanceLabel}
          </Text>
        </View>
      </View>
      <ComplianceBadge idPrefix={idPrefix} pct={training.compliancePct} size="sm" />
      <MaterialCommunityIcons color={colors.onSurfaceVariant} name="chevron-right" size={18} />
    </Pressable>
  );
}

export function RecentTrainingsCard() {
  const router = useRouter();
  const userId = useAuthStore((s) => s.userId);
  const setCalendarTab = useCalendarTabStore((s) => s.setActiveTab);
  const colors = useThemeColors();

  const now = new Date();
  const windowStart = new Date(now);
  windowStart.setDate(windowStart.getDate() - WINDOW_DAYS);
  const dateFrom = toISODate(windowStart);
  const dateTo = toISODate(now);

  const { list, loading } = useComparisonList({ dateFrom, dateTo, enabled: Boolean(userId) });

  if (loading || !list) return null;
  const trainings = selectRecentFinishedTrainings(list.sessions);
  if (trainings.length === 0) return null;

  const goToHistory = () => {
    setCalendarTab('historial');
    router.push('/calendar');
  };

  return (
    <View className="mb-3 rounded-2xl bg-white p-4 shadow-sm dark:bg-surface" nativeID="recent-trainings-card" testID="recent-trainings-card">
      <Text className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500" nativeID="recent-trainings-card-kicker" testID="recent-trainings-card-kicker">
        Tus entrenamientos recientes
      </Text>
      <View className="gap-2" nativeID="recent-trainings-card-list" testID="recent-trainings-card-list">
        {trainings.map((training) => (
          <RecentTrainingRow
            key={training.sessionInstanceId}
            onPress={() => router.push(`/training-comparison/session?sessionInstanceId=${training.sessionInstanceId}`)}
            training={training}
          />
        ))}
      </View>
      <Pressable
        accessibilityLabel="Ver historial de entrenamientos"
        accessibilityRole="button"
        className="mt-2 flex-row items-center justify-center border border-slate-400 dark:border-slate-700 gap-1 rounded-full p-2 hover:bg-slate-100 active:opacity-70 dark:hover:bg-slate-800"
        nativeID="recent-trainings-card-view-history"
        onPress={goToHistory}
        testID="recent-trainings-card-view-history"
      >
        <Text className="text-xs font-semibold text-slate-600 dark:text-slate-300" nativeID="recent-trainings-card-view-history-label" testID="recent-trainings-card-view-history-label">
          Ver historial
        </Text>
        <MaterialCommunityIcons className="animate-pulse" color={colors.onSurfaceVariant} name="chevron-right" size={14} />
      </Pressable>
    </View>
  );
}
