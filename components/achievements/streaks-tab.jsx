import { View, Text } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useStreaks } from '../../hooks/use-streaks.js';
import { streakDayVisual } from '../../utils/streak-day-status.js';
import { useThemeColors } from '../../theme/colors.js';

function StreakCard({ icon, title, current, best, idPrefix }) {
  const colors = useThemeColors();
  return (
    <View className="flex-1 rounded-2xl bg-white p-4 shadow-sm dark:bg-surface" nativeID={idPrefix} testID={idPrefix}>
      <View className="flex-row items-center gap-2" nativeID={`${idPrefix}-header`} testID={`${idPrefix}-header`}>
        <MaterialCommunityIcons color={colors.primary} name={icon} size={20} />
        <Text className="text-sm font-semibold text-slate-700 dark:text-slate-200" nativeID={`${idPrefix}-title`} testID={`${idPrefix}-title`}>{title}</Text>
      </View>
      <Text className="mt-2 text-2xl font-bold text-slate-900 dark:text-white" nativeID={`${idPrefix}-current`} testID={`${idPrefix}-current`}>
        {current} días
      </Text>
      <Text className="text-xs text-slate-500 dark:text-slate-400" nativeID={`${idPrefix}-best`} testID={`${idPrefix}-best`}>
        Mejor racha: {best} días
      </Text>
    </View>
  );
}

export function StreaksTab() {
  const { streaks, loading, error } = useStreaks();

  if (loading) {
    return <Text className="text-sm text-slate-400 dark:text-slate-500" nativeID="streaks-tab-loading" testID="streaks-tab-loading">Cargando…</Text>;
  }

  if (error || !streaks) {
    return <Text className="text-sm text-slate-400 dark:text-slate-500" nativeID="streaks-tab-error" testID="streaks-tab-error">No pudimos cargar tus rachas.</Text>;
  }

  return (
    <View nativeID="streaks-tab-root" testID="streaks-tab-root">
      <View className="flex-row gap-3" nativeID="streaks-tab-cards-row" testID="streaks-tab-cards-row">
        <StreakCard best={streaks.strict.best} current={streaks.strict.current} icon="fire" idPrefix="streaks-tab-strict-card" title="Entrenamientos consecutivos" />
        <StreakCard best={streaks.flexible.best} current={streaks.flexible.current} icon="calendar-check" idPrefix="streaks-tab-flexible-card" title="Días entrenando" />
      </View>
      <Text className="mb-2 mt-5 text-sm font-semibold text-slate-700 dark:text-slate-200" nativeID="streaks-tab-grid-title" testID="streaks-tab-grid-title">
        Últimas 6 semanas
      </Text>
      <View className="flex-row flex-wrap gap-1" nativeID="streaks-tab-grid" testID="streaks-tab-grid">
        {streaks.days.map((day) => {
          const visual = streakDayVisual(day.strictStatus);
          return (
            <View
              accessibilityLabel={`${day.date}: ${visual.label}`}
              className="h-4 w-4 rounded-sm"
              key={day.date}
              nativeID={`streaks-tab-grid-day-${day.date}`}
              style={{ backgroundColor: visual.color }}
              testID={`streaks-tab-grid-day-${day.date}`}
            />
          );
        })}
      </View>
    </View>
  );
}
