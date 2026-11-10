import { ActivityIndicator, Pressable, View, Text } from 'react-native';
import { useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import Animated, { useSharedValue, useAnimatedStyle, withRepeat, withTiming, Easing } from 'react-native-reanimated';
import { useEffect } from 'react';
import { useStreaks } from '../../hooks/use-streaks.js';
import { streakDayVisual } from '../../utils/streak-day-status.js';
import { useAchievementsTabStore } from '../../store/achievements-tab-store.js';
import { useThemeColors } from '../../theme/colors.js';
import { isWeb } from '../../utils/platform.js';

// Ícono de racha con pulso sutil -- solo mobile (ver CLAUDE.md "Theming" y
// la spec: en web no aporta y evita trabajo de animación donde no hace
// falta). Mismo mecanismo de useSharedValue/withRepeat que
// components/shared/skeleton.jsx.
function useFirePulse() {
  const scale = useSharedValue(1);

  useEffect(() => {
    if (isWeb) return;
    scale.value = withRepeat(withTiming(1.12, { duration: 900, easing: Easing.inOut(Easing.ease) }), -1, true);
  }, [scale]);

  return useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
}

// `daysCount` (Home, 2026-11-09): 7 cuando se empareja con el logro
// destacado (fila 50/50, menos ancho por card), 14 cuando Rachas queda
// sola y usa el ancho completo (ver authenticated-home-screen.jsx, que
// decide cuál de los dos casos aplica ANTES de montar esta card, con
// `pickAchievementHighlight`). `paired` agrega `flex-1` para igualar la
// altura visible con AchievementHighlightCard -- mismo criterio de
// seguridad que esa card (ver su comentario): solo se aplica cuando hay un
// hermano en la misma fila que fija la altura del slot.
export function StreakBanner({ daysCount = 7, paired = false }) {
  const router = useRouter();
  const colors = useThemeColors();
  const { streaks, loading, error } = useStreaks();
  const pulseStyle = useFirePulse();
  const setActiveTab = useAchievementsTabStore((s) => s.setActiveTab);

  // Tocar la card va directo a la pestaña Rachas del hub -- pedido
  // 2026-10-15, mismo criterio que el logro destacado (abajo).
  const goToStreaksTab = () => {
    setActiveTab('streaks');
    router.push('/achievements');
  };

  if (loading) {
    return (
      <View className={`mb-6 h-24 items-center justify-center rounded-2xl bg-white shadow-sm dark:bg-surface ${paired ? 'flex-1' : ''}`} nativeID="streak-banner-loading" testID="streak-banner-loading">
        <ActivityIndicator color={colors.primary} nativeID="streak-banner-loading-indicator" testID="streak-banner-loading-indicator" />
      </View>
    );
  }

  if (error || !streaks) {
    return (
      <View className={`mb-6 h-24 items-center justify-center rounded-2xl bg-white shadow-sm dark:bg-surface ${paired ? 'flex-1' : ''}`} nativeID="streak-banner-error" testID="streak-banner-error">
        <Text className="text-sm text-slate-400 dark:text-slate-500" nativeID="streak-banner-error-label" testID="streak-banner-error-label">No pudimos cargar tu racha.</Text>
      </View>
    );
  }

  const lastDays = streaks.days.slice(-daysCount);

  return (
    <Pressable className={`mb-3 rounded-2xl bg-white p-4 shadow-sm transition-colors duration-150 hover:bg-slate-100 active:bg-slate-200 dark:bg-surface dark:hover:bg-surface-2 dark:active:bg-surface-3 ${paired ? 'flex-1' : ''}`} nativeID="streak-banner-root" onPress={goToStreaksTab} testID="streak-banner-root">
      {/* Kicker con el nombre de la racha -- antes la card solo mostraba
          "X días" sin aclarar cuál de las dos rachas es (estricta/flexible,
          ver streaks-tab.jsx), mismo patrón de kicker que el resto de las
          cards del Home (recent-trainings-card.jsx, next-training-banner.jsx).
          Principal pasó de `strict` a `flexible` (pedido real 2026-11-10):
          "días consecutivos entrenando" importa más como primer vistazo que
          la racha que corta si un día programado se saltea -- esa sigue
          disponible en la pestaña Rachas (streaks-tab.jsx, con las dos
          tarjetas). El label es el mismo que usa esa pestaña para `flexible`
          ("Días entrenando"), no uno inventado nuevo. Los puntos del día
          abajo pasan a `flexibleStatus` para no mezclar: mostrar el número
          de una racha y los puntos de la otra confundía más que ayudaba. */}
      <Text className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500" nativeID="streak-banner-kicker" testID="streak-banner-kicker">
        Días entrenando
      </Text>
      <View className="flex-row items-center gap-2" nativeID="streak-banner-current-row" testID="streak-banner-current-row">
        <Animated.View nativeID="streak-banner-fire-icon" style={pulseStyle} testID="streak-banner-fire-icon">
          <MaterialCommunityIcons color={colors.primary} name="fire" size={20} />
        </Animated.View>
        <View nativeID="streak-banner-current-text" testID="streak-banner-current-text">
          <Text className="text-sm font-semibold text-slate-900 dark:text-white" nativeID="streak-banner-current-value" testID="streak-banner-current-value">
            {streaks.flexible.current} días consecutivos entrenando
          </Text>
          <Text className="text-xs text-slate-500 dark:text-slate-400" nativeID="streak-banner-best-value" testID="streak-banner-best-value">
            Mejor racha: {streaks.flexible.best} días
          </Text>
        </View>
      </View>
      <View className="mt-3 flex-row gap-1" nativeID="streak-banner-days-row" testID="streak-banner-days-row">
        {lastDays.map((day) => {
          const visual = streakDayVisual(day.flexibleStatus);
          return (
            <View
              accessibilityLabel={visual.label}
              className="h-2.5 w-2.5 flex-1 rounded-full"
              key={day.date}
              nativeID={`streak-banner-day-${day.date}`}
              style={{ backgroundColor: visual.color }}
              testID={`streak-banner-day-${day.date}`}
            />
          );
        })}
      </View>
    </Pressable>
  );
}
