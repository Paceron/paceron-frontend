import { View, Text } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useAchievements } from '../../hooks/use-achievements.js';
import { levelMeta } from '../../utils/achievement-level-meta.js';
import { ProgressBar } from '../shared/progress-bar.jsx';
import { useIsNarrowWeb } from '../../hooks/use-is-narrow-web.js';
import { isWeb } from '../../utils/platform.js';

function AchievementCard({ achievement, columnClass }) {
  const meta = levelMeta(achievement.currentLevel || 1);
  const idPrefix = `achievements-tab-card-${achievement.id}`;

  return (
    <View className={`${columnClass} rounded-2xl bg-white p-3 shadow-sm dark:bg-surface`} nativeID={idPrefix} testID={idPrefix}>
      <View className="flex-row items-center gap-2" nativeID={`${idPrefix}-header`} testID={`${idPrefix}-header`}>
        <MaterialCommunityIcons color={meta.color} name={meta.icon} size={22} />
        <Text className="flex-1 text-sm font-semibold text-slate-700 dark:text-slate-200" nativeID={`${idPrefix}-name`} numberOfLines={1} testID={`${idPrefix}-name`}>
          {achievement.name}
        </Text>
      </View>
      {achievement.levelName && (
        <Text className="mt-1 text-xs font-medium text-slate-500 dark:text-slate-400" nativeID={`${idPrefix}-level`} testID={`${idPrefix}-level`}>
          {achievement.levelName}
        </Text>
      )}
      {achievement.progressPercent != null && (
        <View className="mt-2" nativeID={`${idPrefix}-progress`} testID={`${idPrefix}-progress`}>
          <ProgressBar nativeID={`${idPrefix}-progress-bar`} percent={achievement.progressPercent} testID={`${idPrefix}-progress-bar`} />
          <Text className="mt-1 text-xs text-slate-400 dark:text-slate-500" nativeID={`${idPrefix}-next-level`} testID={`${idPrefix}-next-level`}>
            Próximo: {achievement.nextLevelName}
          </Text>
        </View>
      )}
      {achievement.family === 'counter' && (
        <Text className="mt-2 text-xs text-slate-500 dark:text-slate-400" nativeID={`${idPrefix}-count`} testID={`${idPrefix}-count`}>
          {achievement.count ?? 0} veces
        </Text>
      )}
      {achievement.unlockedAt && (
        <Text className="mt-2 text-xs text-slate-400 dark:text-slate-500" nativeID={`${idPrefix}-unlocked`} testID={`${idPrefix}-unlocked`}>
          Desbloqueado {achievement.unlockedAt.slice(0, 10)}
        </Text>
      )}
    </View>
  );
}

export function AchievementsTab() {
  const { achievements, loading, error } = useAchievements();
  const isNarrowWeb = useIsNarrowWeb();
  const columnClass = !isWeb || isNarrowWeb ? 'w-[48%]' : 'w-[31%]';

  if (loading) {
    return <Text className="text-sm text-slate-400 dark:text-slate-500" nativeID="achievements-tab-loading" testID="achievements-tab-loading">Cargando…</Text>;
  }

  if (error) {
    return <Text className="text-sm text-slate-400 dark:text-slate-500" nativeID="achievements-tab-error" testID="achievements-tab-error">No pudimos cargar tus logros.</Text>;
  }

  return (
    <View className="flex-row flex-wrap gap-3" nativeID="achievements-tab-root" testID="achievements-tab-root">
      {achievements.map((achievement) => (
        <AchievementCard achievement={achievement} columnClass={columnClass} key={achievement.id} />
      ))}
    </View>
  );
}
