import { useState } from 'react';
import { Pressable, View, Text } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useAchievements } from '../../hooks/use-achievements.js';
import { resolveAchievementIconName } from '../../utils/achievement-icon.js';
import { isAchievementUnlocked } from '../../utils/achievement-status.js';
import { ProgressBar } from '../shared/progress-bar.jsx';
import { LevelPips } from './level-pips.jsx';
import { AchievementDetailModal } from './achievement-detail-modal.jsx';
import { useIsNarrowWeb } from '../../hooks/use-is-narrow-web.js';
import { isWeb } from '../../utils/platform.js';
import { useThemeColors } from '../../theme/colors.js';

// Tocar la card abre el detalle (descripción + progreso) -- pedido
// 2026-10-14, sirve igual para logros bloqueados (qué falta) y
// desbloqueados (progreso actual).
function AchievementCard({ achievement, columnClass }) {
  const colors = useThemeColors();
  const idPrefix = `achievements-tab-card-${achievement.id}`;
  const [detailVisible, setDetailVisible] = useState(false);
  const unlocked = isAchievementUnlocked(achievement);
  const cardClass = unlocked
    ? 'border-primary/40 bg-primary-tint-subtle dark:border-primary/30 dark:bg-primary/10'
    : 'border-slate-200 bg-slate-100/70 dark:border-slate-700/60 dark:bg-slate-800/50';
  const iconColor = unlocked ? colors.primary : colors.onSurfaceVariant;

  return (
    <>
      <Pressable className={`${columnClass} rounded-2xl border p-3 transition-colors duration-150 hover:opacity-90 active:opacity-80 ${cardClass}`} nativeID={idPrefix} onPress={() => setDetailVisible(true)} testID={idPrefix}>
        {/* `achievement.iconName` (del catálogo, Gap 31) identifica AL LOGRO
            en sí (medalla, llama, estrella, según cada uno) -- antes se
            mostraba el ícono del NIVEL (meta.icon, genérico por nivel 1-5),
            así que todos los logros "leveled" se veían iguales entre sí. El
            color de nivel se mantiene, tiñe el ícono propio del logro en vez
            de reemplazarlo (bug/pedido real, 2026-10-14). `iconKey` (la
            clave semántica, ej. "streak_7") nunca fue un nombre de ícono
            real -- `resolveAchievementIconName` valida `iconName` contra el
            glyphMap real y cae a un fallback si falta o no existe
            (2026-11-13). */}
        <View className="flex-row items-center gap-2" nativeID={`${idPrefix}-header`} testID={`${idPrefix}-header`}>
          <View style={unlocked ? undefined : { opacity: 0.5 }} nativeID={`${idPrefix}-icon-wrap`} testID={`${idPrefix}-icon-wrap`}>
            <MaterialCommunityIcons color={iconColor} name={resolveAchievementIconName(achievement.iconName)} size={22} />
          </View>
          <Text className="flex-1 text-sm font-semibold text-slate-700 dark:text-slate-200" nativeID={`${idPrefix}-name`} numberOfLines={2} testID={`${idPrefix}-name`}>
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
