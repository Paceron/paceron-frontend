import { useEffect } from 'react';
import { Platform, Pressable } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useThemeMode } from '../../providers/theme-provider.jsx';

const TRACK_WIDTH = 64;
const TRACK_HEIGHT = 32;
const THUMB_SIZE = 28;
const THUMB_TRAVEL = TRACK_WIDTH - 4 - THUMB_SIZE;

// Sombra del thumb por plataforma explícita: mezclar shadowColor/Offset/
// Opacity/Radius CON elevation en el mismo style hace que React Native Web
// renderice dos box-shadow superpuestos (uno por cada mecanismo), viéndose
// como una sombra cuadrada extra. Cada plataforma usa solo su propio
// mecanismo.
const THUMB_SHADOW = Platform.select({
  android: { elevation: 3 },
  ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.2, shadowRadius: 2 },
  default: { boxShadow: '0 1px 2px rgba(0,0,0,0.2)' },
});

// Switch único (no dos botones): un solo Pressable cubre todo el track,
// cada tap alterna el tema. El thumb anima su posición con Reanimated.
// Sin íconos de fondo en el track: el único ícono es el del thumb (el modo
// activo) — tenerlos también en el fondo duplicaba visualmente el ícono
// del lado donde el thumb ya estaba parado.
export function ThemeToggle() {
  const { themeMode, toggleThemeMode } = useThemeMode();
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
      className="rounded-full bg-slate-200 dark:bg-slate-800"
      onPress={toggleThemeMode}
      style={{ width: TRACK_WIDTH, height: TRACK_HEIGHT, padding: 2 }}
    >
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
