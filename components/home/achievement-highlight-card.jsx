import { Pressable, View, Text } from 'react-native';
import { useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useAchievements } from '../../hooks/use-achievements.js';
import { levelMeta } from '../../utils/achievement-level-meta.js';
import { pickAchievementHighlight } from '../../utils/achievement-highlight.js';
import { ProgressBar } from '../shared/progress-bar.jsx';
import { useAchievementsTabStore } from '../../store/achievements-tab-store.js';

// `paired` (Home, 2026-11-09): true cuando el caller ya decidió emparejar
// esta card con StreakBanner en una fila 50/50 (ver
// authenticated-home-screen.jsx, que usa el mismo `pickAchievementHighlight`
// para decidirlo ANTES de montar esta card). `flex-1` ahí estira la card a
// la altura de la fila (el slot ya quedó fijado por el hermano más alto via
// el `alignItems: stretch` default del row) -- sin pareja, la card vive
// suelta en el flujo de la ScrollView (altura auto, sin hermano con quien
// igualar), y `flex-1` ahí colapsaría a 0 (mismo quirk de CLAUDE.md sobre
// flex-1 dentro de un padre sin altura propia).
export function AchievementHighlightCard({ paired = false }) {
  const router = useRouter();
  const { achievements, loading, error } = useAchievements();
  const setActiveTab = useAchievementsTabStore((s) => s.setActiveTab);

  if (loading || error || !achievements.length) return null;

  const highlight = pickAchievementHighlight(achievements);
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
    <Pressable className={`mb-3 rounded-2xl bg-white p-4 shadow-sm transition-colors duration-150 hover:bg-slate-100 active:bg-slate-200 dark:bg-surface dark:hover:bg-surface-2 dark:active:bg-surface-3 ${paired ? 'flex-1' : ''}`} nativeID="achievement-highlight-card-root" onPress={goToAchievementsTab} testID="achievement-highlight-card-root">
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
