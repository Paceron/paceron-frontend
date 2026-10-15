import { Modal, Pressable, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useThemeColors } from '../../theme/colors.js';
import { levelMeta } from '../../utils/achievement-level-meta.js';
import { ProgressBar } from '../shared/progress-bar.jsx';
import { LevelPips } from './level-pips.jsx';
import { IconTooltip } from '../shared/icon-tooltip.jsx';
import { formatDisplayDate } from '../../utils/format-date-display.js';

// Detalle de un logro al tocarlo (pedido 2026-10-14) -- sirve igual para
// bloqueados (qué falta para desbloquearlo) y desbloqueados (progreso
// actual). Sin guard de cambios sin guardar: es de solo lectura, no hay
// nada que escribir. Compartido entre achievements-tab.jsx y
// achievement-highlight-card.jsx (Home) -- mismo patrón de modal
// autocontenido que reject-competition-modal.jsx.
export function AchievementDetailModal({ achievement, visible, onClose }) {
  const colors = useThemeColors();
  if (!achievement) return null;

  const meta = levelMeta(achievement.currentLevel || 1);
  const isMaxLevel = achievement.family === 'leveled' && achievement.currentLevel === achievement.levels?.[achievement.levels.length - 1]?.level;

  return (
    <Modal animationType="fade" nativeID="achievement-detail-modal" onRequestClose={onClose} testID="achievement-detail-modal" transparent visible={visible}>
      <Pressable className="flex-1 items-center justify-center bg-black/50 px-4" nativeID="achievement-detail-modal-backdrop" onPress={onClose} testID="achievement-detail-modal-backdrop">
        <Pressable className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-xl dark:border-slate-700 dark:bg-surface" nativeID="achievement-detail-modal-card" onPress={() => {}} testID="achievement-detail-modal-card">
          <View className="flex-row items-center gap-3" nativeID="achievement-detail-modal-header" testID="achievement-detail-modal-header">
            <MaterialCommunityIcons color={meta.color} name={achievement.iconKey} size={32} />
            <Text className="flex-1 text-lg font-bold text-slate-900 dark:text-white" nativeID="achievement-detail-modal-title" testID="achievement-detail-modal-title">
              {achievement.name}
            </Text>
            {/* Ícono chico en vez del botón de ancho completo de abajo --
                pedido real 2026-10-15, "no veo necesario un botón tan
                grande de cerrar". */}
            <IconTooltip idPrefix="achievement-detail-modal-close-button-tooltip" label="Cerrar" position="bottom">
              <Pressable
                className="h-8 w-8 items-center justify-center rounded-full hover:bg-slate-100 active:opacity-60 dark:hover:bg-slate-800"
                nativeID="achievement-detail-modal-close-button"
                onPress={onClose}
                testID="achievement-detail-modal-close-button"
              >
                <MaterialCommunityIcons color={colors.onSurfaceVariant} name="close" size={20} />
              </Pressable>
            </IconTooltip>
          </View>

          <Text className="mt-3 text-sm text-slate-600 dark:text-slate-300" nativeID="achievement-detail-modal-description" testID="achievement-detail-modal-description">
            {achievement.description}
          </Text>

          {achievement.family === 'leveled' && (
            <View className="mt-4" nativeID="achievement-detail-modal-leveled" testID="achievement-detail-modal-leveled">
              <LevelPips currentLevel={achievement.currentLevel} idPrefix="achievement-detail-modal-pips" levels={achievement.levels} />
              <Text className="mt-2 text-sm font-semibold text-slate-700 dark:text-slate-200" nativeID="achievement-detail-modal-level-name" testID="achievement-detail-modal-level-name">
                {achievement.levelName ?? 'Todavía sin nivel'}
              </Text>
              {achievement.progressPercent != null && (
                <View className="mt-2" nativeID="achievement-detail-modal-progress" testID="achievement-detail-modal-progress">
                  <ProgressBar nativeID="achievement-detail-modal-progress-bar" percent={achievement.progressPercent} testID="achievement-detail-modal-progress-bar" />
                  <Text className="mt-1 text-xs text-slate-400 dark:text-slate-500" nativeID="achievement-detail-modal-next-level" testID="achievement-detail-modal-next-level">
                    Próximo: {achievement.nextLevelName}
                  </Text>
                </View>
              )}
              {isMaxLevel && (
                <Text className="mt-2 text-xs text-slate-400 dark:text-slate-500" nativeID="achievement-detail-modal-max-level" testID="achievement-detail-modal-max-level">
                  Nivel máximo alcanzado.
                </Text>
              )}
            </View>
          )}

          {achievement.family === 'counter' && (
            <View className="mt-4" nativeID="achievement-detail-modal-counter" testID="achievement-detail-modal-counter">
              <Text className="text-2xl font-bold text-slate-900 dark:text-white" nativeID="achievement-detail-modal-counter-count" testID="achievement-detail-modal-counter-count">
                {achievement.count ?? 0} veces
              </Text>
              {achievement.counterTrophyEvery != null && (
                <Text className="mt-1 text-xs text-slate-400 dark:text-slate-500" nativeID="achievement-detail-modal-counter-every" testID="achievement-detail-modal-counter-every">
                  Ganás una estampa nueva cada {achievement.counterTrophyEvery} veces.
                </Text>
              )}
            </View>
          )}

          {achievement.family === 'once' && (
            <View className="mt-4" nativeID="achievement-detail-modal-once" testID="achievement-detail-modal-once">
              {achievement.unlockedAt ? (
                <Text className="text-sm font-semibold text-slate-700 dark:text-slate-200" nativeID="achievement-detail-modal-once-unlocked" testID="achievement-detail-modal-once-unlocked">
                  Desbloqueado el {formatDisplayDate(achievement.unlockedAt.slice(0, 10))}
                </Text>
              ) : (
                <Text className="text-sm text-slate-500 dark:text-slate-400" nativeID="achievement-detail-modal-once-locked" testID="achievement-detail-modal-once-locked">
                  Todavía no lo desbloqueaste
                  {achievement.threshold != null ? ` — llevás ${achievement.count ?? 0} de ${achievement.threshold}.` : '.'}
                </Text>
              )}
            </View>
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
}
