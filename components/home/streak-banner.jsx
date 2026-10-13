import { View, Text } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import Animated, { useSharedValue, useAnimatedStyle, withRepeat, withTiming, Easing } from 'react-native-reanimated';
import { useEffect } from 'react';
import { useStreaks } from '../../hooks/use-streaks.js';
import { streakDayVisual } from '../../utils/streak-day-status.js';
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

export function StreakBanner() {
  const colors = useThemeColors();
  const { streaks, loading, error } = useStreaks();
  const pulseStyle = useFirePulse();

  if (loading) {
    return (
      <View className="mb-6 h-24 items-center justify-center rounded-2xl bg-white shadow-sm dark:bg-surface" nativeID="streak-banner-loading" testID="streak-banner-loading">
        <Text className="text-sm text-slate-400 dark:text-slate-500" nativeID="streak-banner-loading-label" testID="streak-banner-loading-label">Cargando racha…</Text>
      </View>
    );
  }

  if (error || !streaks) {
    return (
      <View className="mb-6 h-24 items-center justify-center rounded-2xl bg-white shadow-sm dark:bg-surface" nativeID="streak-banner-error" testID="streak-banner-error">
        <Text className="text-sm text-slate-400 dark:text-slate-500" nativeID="streak-banner-error-label" testID="streak-banner-error-label">No pudimos cargar tu racha.</Text>
      </View>
    );
  }

  const lastDays = streaks.days.slice(-14);

  return (
    <View className="mb-6 rounded-2xl bg-white p-4 shadow-sm dark:bg-surface" nativeID="streak-banner-root" testID="streak-banner-root">
      <View className="flex-row items-center gap-3" nativeID="streak-banner-current-row" testID="streak-banner-current-row">
        <Animated.View nativeID="streak-banner-fire-icon" style={pulseStyle} testID="streak-banner-fire-icon">
          <MaterialCommunityIcons color={colors.primary} name="fire" size={28} />
        </Animated.View>
        <View nativeID="streak-banner-current-text" testID="streak-banner-current-text">
          <Text className="text-3xl font-bold text-slate-900 dark:text-white" nativeID="streak-banner-current-value" testID="streak-banner-current-value">
            {streaks.strict.current} días
          </Text>
          <Text className="text-xs text-slate-500 dark:text-slate-400" nativeID="streak-banner-best-value" testID="streak-banner-best-value">
            Mejor racha: {streaks.strict.best} días
          </Text>
        </View>
      </View>
      <View className="mt-3 flex-row gap-1" nativeID="streak-banner-days-row" testID="streak-banner-days-row">
        {lastDays.map((day) => {
          const visual = streakDayVisual(day.strictStatus);
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
    </View>
  );
}
