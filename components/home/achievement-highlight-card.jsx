import { Pressable, View, Text } from 'react-native';
import { useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useAchievements } from '../../hooks/use-achievements.js';
import { levelMeta } from '../../utils/achievement-level-meta.js';
import { ProgressBar } from '../shared/progress-bar.jsx';
import { useAchievementsTabStore } from '../../store/achievements-tab-store.js';

// El logro con más progreso pendiente (más cerca de subir de nivel), o si
// ninguno tiene progreso fraccional, el desbloqueado más recientemente.
function pickHighlight(achievements) {
  const withProgress = achievements.filter((a) => a.progressPercent != null && a.progressPercent < 100);
  if (withProgress.length) {
    return withProgress.reduce((best, a) => (a.progressPercent > best.progressPercent ? a : best));
  }

  const unlocked = achievements.filter((a) => a.unlockedAt);
  if (!unlocked.length) return null;
  return unlocked.reduce((latest, a) => ((a.lastUnlockedAt ?? '') > (latest.lastUnlockedAt ?? '') ? a : latest));
}

export function AchievementHighlightCard() {
  const router = useRouter();
  const { achievements, loading, error } = useAchievements();
  const setActiveTab = useAchievementsTabStore((s) => s.setActiveTab);

  if (loading || error || !achievements.length) return null;

  const highlight = pickHighlight(achievements);
  if (!highlight) return null;

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
    <Pressable className="mb-6 rounded-2xl bg-white p-4 shadow-sm transition-colors duration-150 hover:bg-slate-100 active:bg-slate-200 dark:bg-surface dark:hover:bg-surface-2 dark:active:bg-surface-3" nativeID="achievement-highlight-card-root" onPress={goToAchievementsTab} testID="achievement-highlight-card-root">
        {/* Kicker "Logro" -- sin esto se confundía con la card de Racha
            justo arriba (mismo estilo blanco/ícono+texto+barra), pedido
            real 2026-10-14. */}
        <Text className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500" nativeID="achievement-highlight-card-kicker" testID="achievement-highlight-card-kicker">
          Logro más cercano
        </Text>
        <View className="flex-row items-center gap-3" nativeID="achievement-highlight-card-header" testID="achievement-highlight-card-header">
          <MaterialCommunityIcons color={meta.color} name={highlight.iconKey} size={26} />
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
