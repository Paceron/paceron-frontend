import { useEffect, useState } from 'react';
import Animated, { Easing, interpolateColor, runOnJS, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { useRouter, usePathname } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useAuthStore } from '../../store/auth-store.js';

const COLOR_BY_ROLE = { runner: '#8cc63e', trainer: '#f59e0b' };
const ICON_BY_ROLE = { runner: 'run-fast', trainer: 'whistle' };

const FADE_MS = 150;
const TOTAL_MS = 1000;

// Fullscreen breve al alternar entre corredor/entrenador (switchRole). El
// fondo pasa del color del rol actual al del rol destino, con los íconos de
// ambos roles en cross-fade sobre la misma ventana. Sin texto — solo color
// + ícono, ~1s en total. Montado a nivel global (app/_layout.jsx). No navega
// si el usuario ya está en /profile.
export function RoleSwitchOverlay() {
  const router = useRouter();
  const pathname = usePathname();
  const animating = useAuthStore((s) => s.roleSwitchAnimating);
  const clearRoleSwitchAnimation = useAuthStore((s) => s.clearRoleSwitchAnimation);
  const [content, setContent] = useState(null);

  const opacity = useSharedValue(0);
  const progress = useSharedValue(0);

  useEffect(() => {
    if (!animating) return;

    setContent(animating);
    if (pathname !== '/profile') router.replace('/');

    progress.value = 0;
    opacity.value = withTiming(1, { duration: FADE_MS, easing: Easing.out(Easing.cubic) });
    progress.value = withTiming(1, { duration: TOTAL_MS - FADE_MS * 2, easing: Easing.inOut(Easing.cubic) });

    const hideTimer = setTimeout(() => {
      opacity.value = withTiming(0, { duration: FADE_MS, easing: Easing.in(Easing.cubic) }, (finished) => {
        if (finished) runOnJS(clearRoleSwitchAnimation)();
      });
    }, TOTAL_MS - FADE_MS);

    return () => clearTimeout(hideTimer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [animating]);

  const containerStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    backgroundColor: content
      ? interpolateColor(progress.value, [0, 1], [COLOR_BY_ROLE[content.from], COLOR_BY_ROLE[content.to]])
      : 'transparent',
  }));

  const fromIconStyle = useAnimatedStyle(() => ({ opacity: 1 - progress.value }));
  const toIconStyle = useAnimatedStyle(() => ({ opacity: progress.value }));

  if (!content) return null;

  return (
    <Animated.View
      pointerEvents={animating ? 'auto' : 'none'}
      style={[
        { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 100, alignItems: 'center', justifyContent: 'center' },
        containerStyle,
      ]}
    >
      <Animated.View style={[{ position: 'absolute' }, fromIconStyle]}>
        <MaterialCommunityIcons color="#ffffff" name={ICON_BY_ROLE[content.from]} size={72} />
      </Animated.View>
      <Animated.View style={toIconStyle}>
        <MaterialCommunityIcons color="#ffffff" name={ICON_BY_ROLE[content.to]} size={72} />
      </Animated.View>
    </Animated.View>
  );
}
