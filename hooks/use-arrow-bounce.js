import { useEffect } from 'react';
import { Easing, interpolate, useAnimatedStyle, useSharedValue, withRepeat, withSequence, withTiming } from 'react-native-reanimated';

// Ícono saltando hacia arriba en loop -- extraído de role-switch-toggle.jsx
// (2026-11-10) al sumarse un segundo caller (next-training-banner.jsx) que
// no tiene nada que ver con el switch de rol; importar un hook genérico
// desde un componente de otro dominio (profile -> home) es exactamente el
// tipo de acoplamiento que conviene evitar. Reanimated, no `animate-*` de
// NativeWind -- hay que animar también en nativo (mismo motivo que
// `useFirePulse` en streak-banner.jsx).
export function useArrowBounce() {
  const bounce = useSharedValue(0);

  useEffect(() => {
    bounce.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 450, easing: Easing.out(Easing.quad) }),
        withTiming(0, { duration: 450, easing: Easing.in(Easing.quad) }),
      ),
      -1,
    );
  }, [bounce]);

  return useAnimatedStyle(() => ({ transform: [{ translateY: interpolate(bounce.value, [0, 1], [0, -3]) }] }));
}
