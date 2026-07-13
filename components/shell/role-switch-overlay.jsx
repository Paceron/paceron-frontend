import { useEffect, useState } from 'react';
import { Text } from 'react-native';
import Animated, { Easing, runOnJS, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useAuthStore } from '../../store/auth-store.js';

const CONTENT_BY_ROLE = {
  runner: { icon: 'run-fast', label: 'Cambiando a Corredor…', bg: '#8cc63e' },
  trainer: { icon: 'whistle', label: 'Cambiando a Entrenador…', bg: '#f59e0b' },
};

const VISIBLE_MS = 2000;
const FADE_MS = 250;

// Transición fullscreen al alternar entre corredor/entrenador (switchRole).
// No se dispara en la primera activación (esa usa su propio modal). Vive
// montado a nivel global (app/_layout.jsx) para cubrir cualquier pantalla,
// sin importar dónde estaba el usuario al cambiar de rol.
export function RoleSwitchOverlay() {
  const router = useRouter();
  const animating = useAuthStore((s) => s.roleSwitchAnimating);
  const clearRoleSwitchAnimation = useAuthStore((s) => s.clearRoleSwitchAnimation);
  const [content, setContent] = useState(null);

  const opacity = useSharedValue(0);

  useEffect(() => {
    if (!animating) return;

    setContent(CONTENT_BY_ROLE[animating.role]);
    if (animating.redirectHome !== false) router.replace('/');

    opacity.value = withTiming(1, { duration: FADE_MS, easing: Easing.out(Easing.cubic) });

    const hideTimer = setTimeout(() => {
      opacity.value = withTiming(0, { duration: FADE_MS, easing: Easing.in(Easing.cubic) }, (finished) => {
        if (finished) runOnJS(clearRoleSwitchAnimation)();
      });
    }, VISIBLE_MS);

    return () => clearTimeout(hideTimer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [animating]);

  const animatedStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));

  if (!content) return null;

  return (
    <Animated.View
      pointerEvents={animating ? 'auto' : 'none'}
      style={[
        { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 100, alignItems: 'center', justifyContent: 'center', backgroundColor: content.bg },
        animatedStyle,
      ]}
    >
      <MaterialCommunityIcons color="#ffffff" name={content.icon} size={72} />
      <Text className="mt-4 text-lg font-bold text-white">{content.label}</Text>
    </Animated.View>
  );
}
