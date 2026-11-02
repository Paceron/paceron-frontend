import { useState } from 'react';
import { Pressable, View, Text } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useAchievements } from '../../hooks/use-achievements.js';
import { levelMeta } from '../../utils/achievement-level-meta.js';
import { ProgressBar } from '../shared/progress-bar.jsx';
import { LevelPips } from './level-pips.jsx';
import { AchievementDetailModal } from './achievement-detail-modal.jsx';
import { useIsNarrowWeb } from '../../hooks/use-is-narrow-web.js';
import { isWeb } from '../../utils/platform.js';

// Tocar la card abre el detalle (descripción + progreso) -- pedido
// 2026-10-14, sirve igual para logros bloqueados (qué falta) y
// desbloqueados (progreso actual).
function AchievementCard({ achievement, columnClass }) {
  const meta = levelMeta(achievement.currentLevel || 1);
  const idPrefix = `achievements-tab-card-${achievement.id}`;
  const [detailVisible, setDetailVisible] = useState(false);

  return (
    <>
      <Pressable className={`${columnClass} rounded-2xl border border-slate-200 bg-slate-50 p-3 transition-colors duration-150 hover:bg-slate-100 active:bg-slate-200 dark:border-transparent dark:bg-surface-2 dark:hover:bg-surface-3 dark:active:bg-surface-3`} nativeID={idPrefix} onPress={() => setDetailVisible(true)} testID={idPrefix}>
        {/* `achievement.iconKey` (del catálogo) identifica AL LOGRO en sí
            (medalla, llama, estrella, según cada uno) -- antes se mostraba el
            ícono del NIVEL (meta.icon, genérico por nivel 1-5), así que todos
            los logros "leveled" se veían iguales entre sí. El color de nivel
            se mantiene, tiñe el ícono propio del logro en vez de reemplazarlo
            (bug/pedido real, 2026-10-14). */}
        <View className="flex-row items-center gap-2" nativeID={`${idPrefix}-header`} testID={`${idPrefix}-header`}>
          <MaterialCommunityIcons color={meta.color} name={achievement.iconKey} size={22} />
          <Text className="flex-1 text-sm font-semibold text-slate-700 dark:text-slate-200" nativeID={`${idPrefix}-name`} numberOfLines={1} testID={`${idPrefix}-name`}>
            {achievement.name}
          </Text>
        </View>
        {achievement.levelName && (
          <Text className="mt-1 text-xs font-medium text-slate-500 dark:text-slate-400" nativeID={`${idPrefix}-level`} testID={`${idPrefix}-level`}>
            {achievement.levelName}
          </Text>
        )}
        {achievement.family === 'leveled' && (
          <View className="mt-1.5" nativeID={`${idPrefix}-pips-wrap`} testID={`${idPrefix}-pips-wrap`}>
            <LevelPips currentLevel={achievement.currentLevel} idPrefix={`${idPrefix}-pips`} levels={achievement.levels} />
          </View>
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
      </Pressable>
      <AchievementDetailModal achievement={achievement} onClose={() => setDetailVisible(false)} visible={detailVisible} />
    </>
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
