import { ActivityIndicator, Pressable, View, Text } from 'react-native';
import { useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useAchievements } from '../../hooks/use-achievements.js';
import { levelMeta } from '../../utils/achievement-level-meta.js';
import { pickAchievementHighlight } from '../../utils/achievement-highlight.js';
import { resolveAchievementIconName } from '../../utils/achievement-icon.js';
import { ProgressBar } from '../shared/progress-bar.jsx';
import { useThemeColors } from '../../theme/colors.js';
import { useAchievementsTabStore } from '../../store/achievements-tab-store.js';

// `paired`: `flex-1` para igualar la altura de StreakBanner en la fila 50/50
// del Home. Sin pareja, `flex-1` colapsaría a 0 dentro de un padre sin altura
// propia (ver CLAUDE.md).
const CARD_CLASS = 'mb-3 min-h-[96px] rounded-2xl bg-white p-4 shadow-sm dark:bg-surface';

export function AchievementHighlightCard({ paired = false }) {
  const router = useRouter();
  const colors = useThemeColors();
  const { achievements, loading, error } = useAchievements();
  const setActiveTab = useAchievementsTabStore((s) => s.setActiveTab);
  const shellClass = `${CARD_CLASS} ${paired ? 'flex-1' : ''}`;

  if (loading) {
    return (
      <View className={`${shellClass} items-center justify-center`} nativeID="achievement-highlight-card-loading" testID="achievement-highlight-card-loading">
        <ActivityIndicator color={colors.primary} nativeID="achievement-highlight-card-loading-indicator" testID="achievement-highlight-card-loading-indicator" />
      </View>
    );
  }

  const highlight = pickAchievementHighlight(achievements);
  const statusMessage = error
    ? 'No pudimos cargar tus logros.'
    : !achievements.length
      ? 'Todavía no hay logros disponibles.'
      : 'Todo desbloqueado.';

  if (!highlight) {
    return (
      <View className={`${shellClass} items-center justify-center`} nativeID="achievement-highlight-card-empty" testID="achievement-highlight-card-empty">
        <MaterialCommunityIcons color={colors.onSurfaceVariant} name={error ? 'alert-circle-outline' : 'trophy-outline'} size={24} />
        <Text className="mt-2 text-center text-xs text-slate-500 dark:text-slate-400" nativeID="achievement-highlight-card-empty-label" testID="achievement-highlight-card-empty-label">
          {statusMessage}
        </Text>
      </View>
    );
  }

  const meta = levelMeta(highlight.currentLevel || 1);

  // Va directo a la pestaña Logros del hub -- antes abría el modal de
  // detalle acá mismo, pedido 2026-10-15: "en lugar de mostrar el modal,
  // solo para ese caso" (el modal de detalle queda para dentro de
  // /achievements, no para el acceso rápido del Home).
  const goToAchievementsTab = () => {
    setActiveTab('achievements');
    router.push('/achievements');
  };

  return (
    <Pressable className={`${shellClass} transition-colors duration-150 hover:bg-slate-100 active:bg-slate-200 dark:hover:bg-surface-2 dark:active:bg-surface-3`} nativeID="achievement-highlight-card-root" onPress={goToAchievementsTab} testID="achievement-highlight-card-root">
        {/* Kicker "Logro" -- sin esto se confundía con la card de Racha
            justo arriba (mismo estilo blanco/ícono+texto+barra), pedido
            real 2026-10-14. */}
        <Text className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500" nativeID="achievement-highlight-card-kicker" testID="achievement-highlight-card-kicker">
          Logro más cercano
        </Text>
        <View className="flex-row items-center gap-3" nativeID="achievement-highlight-card-header" testID="achievement-highlight-card-header">
          <MaterialCommunityIcons color={meta.color} name={resolveAchievementIconName(highlight.iconName)} size={26} />
          <Text className="flex-1 text-sm font-semibold text-slate-700 dark:text-slate-200" nativeID="achievement-highlight-card-name" testID="achievement-highlight-card-name">
            {highlight.name}
          </Text>
        </View>
        {highlight.progressPercent != null ? (
          <View className="mt-3" nativeID="achievement-highlight-card-progress" testID="achievement-highlight-card-progress">
            <ProgressBar nativeID="achievement-highlight-card-progress-bar" percent={highlight.progressPercent} testID="achievement-highlight-card-progress-bar" />
            <Text className="mt-1 text-xs text-slate-400 dark:text-slate-500" nativeID="achievement-highlight-card-next-level" testID="achievement-highlight-card-next-level">
              Próximo: {highlight.nextLevelName}
            </Text>
          </View>
        ) : (
          <Text className="mt-2 text-xs text-slate-500 dark:text-slate-400" nativeID="achievement-highlight-card-unlocked" testID="achievement-highlight-card-unlocked">
            Desbloqueado
          </Text>
        )}
      </Pressable>
  );
}
