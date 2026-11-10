import { useEffect } from 'react';
import { Easing, interpolate, useAnimatedStyle, useSharedValue, withRepeat, withSequence, withTiming } from 'react-native-reanimated';

// Ícono saltando hacia arriba -- extraído de role-switch-toggle.jsx
// (2026-11-10) al sumarse un segundo caller (next-training-banner.jsx) que
// no tiene nada que ver con el switch de rol; importar un hook genérico
// desde un componente de otro dominio (profile -> home) es exactamente el
// tipo de acoplamiento que conviene evitar. Reanimated, no `animate-*` de
// NativeWind -- hay que animar también en nativo (mismo motivo que
// `useFirePulse` en streak-banner.jsx).
//
// `repeatCount` (2026-11-10, lag real reportado en mobile): default -1
// (infinito) para "Mejorar tier" en role-switch-toggle.jsx, que es un CTA
// real que amerita seguir llamando la atención todo el tiempo que esté en
// pantalla. next-training-banner.jsx pasa un número finito -- el Home de
// corredor llega a tener 4 animaciones en loop infinito a la vez (esta +
// el fuego de streak-banner.jsx + los 2 `animate-pulse` de competitions-
// preview-card.jsx/recent-trainings-card.jsx), y un ícono de "siguiente
// entrenamiento" no necesita seguir rebotando para siempre para cumplir su
// propósito (llamar la atención apenas aparece la card) -- rebota unas
// vueltas al montar y se queda quieto, bajando el trabajo en loop en la
// pantalla con más animaciones simultáneas de toda la app.
export function useArrowBounce(repeatCount = -1) {
  const bounce = useSharedValue(0);

  useEffect(() => {
    bounce.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 450, easing: Easing.out(Easing.quad) }),
        withTiming(0, { duration: 450, easing: Easing.in(Easing.quad) }),
      ),
      repeatCount,
    );
  }, [bounce, repeatCount]);

  return useAnimatedStyle(() => ({ transform: [{ translateY: interpolate(bounce.value, [0, 1], [0, -3]) }] }));
}
