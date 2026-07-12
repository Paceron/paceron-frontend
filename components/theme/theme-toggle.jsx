import { useEffect } from 'react';
import { Pressable, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useThemeMode } from '../../providers/theme-provider.jsx';
import { useThemeColors } from '../../theme/colors.js';

const TRACK_WIDTH = 64;
const TRACK_HEIGHT = 32;
const THUMB_SIZE = 28;
const THUMB_TRAVEL = TRACK_WIDTH - 4 - THUMB_SIZE;

// Sombra del thumb con propiedades explícitas (no la clase `shadow` de
// Tailwind/NativeWind): esa clase se traduce a box-shadow CSS en web pero
// requiere shadowColor/shadowOffset/shadowOpacity/shadowRadius + elevation
// por separado en nativo, y termina viéndose bien distinto entre
// plataformas. Con estas propiedades el resultado es consistente en ambas.
const THUMB_SHADOW = {
  shadowColor: '#000',
  shadowOffset: { width: 0, height: 1 },
  shadowOpacity: 0.2,
  shadowRadius: 2,
  elevation: 3,
};

// Switch único (no dos botones): un solo Pressable cubre todo el track,
// cada tap alterna el tema. El thumb anima su posición con Reanimated.
export function ThemeToggle() {
  const { themeMode, toggleThemeMode } = useThemeMode();
  const colors = useThemeColors();
  const isDark = themeMode === 'dark';

  const translateX = useSharedValue(isDark ? THUMB_TRAVEL : 0);

  useEffect(() => {
    translateX.value = withTiming(isDark ? THUMB_TRAVEL : 0, { duration: 200, easing: Easing.out(Easing.cubic) });
  }, [isDark]);

  const thumbStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));

  return (
    <Pressable
      accessibilityLabel={isDark ? 'Cambiar a tema claro' : 'Cambiar a tema oscuro'}
      accessibilityRole="switch"
      accessibilityState={{ checked: isDark }}
      className="flex-row items-center rounded-full bg-slate-200 dark:bg-slate-800"
      onPress={toggleThemeMode}
      style={{ width: TRACK_WIDTH, height: TRACK_HEIGHT, padding: 2 }}
    >
      <View
        className="absolute left-0 right-0 flex-row items-center justify-between px-1.5"
        style={{ height: TRACK_HEIGHT }}
      >
        <MaterialCommunityIcons color={isDark ? colors.onSurfaceVariant : '#f59e0b'} name="weather-sunny" size={14} />
        <MaterialCommunityIcons color={isDark ? '#8cc63e' : colors.onSurfaceVariant} name="weather-night" size={14} />
      </View>
      <Animated.View
        className="items-center justify-center rounded-full bg-white dark:bg-slate-950"
        style={[{ width: THUMB_SIZE, height: THUMB_SIZE }, THUMB_SHADOW, thumbStyle]}
      >
        <MaterialCommunityIcons
          color={isDark ? '#8cc63e' : '#f59e0b'}
          name={isDark ? 'weather-night' : 'weather-sunny'}
          size={14}
        />
      </Animated.View>
    </Pressable>
  );
}
