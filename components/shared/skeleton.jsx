import { useEffect } from 'react';
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withRepeat, withTiming, Easing } from 'react-native-reanimated';

function useShimmer() {
  const opacity = useSharedValue(0.4);
  // `prefers-reduced-motion` es una preferencia del sistema operativo, no un
  // ajuste de la app: si el usuario la activó, un shimmer que late para siempre
  // es movimiento innecesario. Reanimated expone `useReducedMotion()` con la
  // misma lectura que usa el resto de la librería (y en web, `matchMedia`).
  //
  // Sin este guard el repo no tenía NINGUNA ocurrencia de la preferencia, y el
  // dashboard de rendimiento es el caso más caro: su esqueleto de carga puede
  // estar en pantalla mientras llega un sondeo de 60-120 s, así que el pulso
  // infinito se ve el doble de tiempo que en cualquier otra pantalla.
  const reducedMotion = useReducedMotion();

  useEffect(() => {
    if (reducedMotion) {
      // Opacidad fija y quieta: el bloque sigue leyéndose como "cargando"
      // (mismo color de fondo, misma forma) pero sin animación.
      opacity.value = 0.6;
      return;
    }
    opacity.value = withRepeat(withTiming(1, { duration: 700, easing: Easing.inOut(Easing.ease) }), -1, true);
  }, [opacity, reducedMotion]);

  return useAnimatedStyle(() => ({ opacity: opacity.value }));
}

// Shimmer vía react-native-reanimated (no CSS-only) para que anime igual
// en web y nativo — mismo mecanismo que theme-toggle.jsx/section-card.jsx.
export function SkeletonBlock({ width, height, rounded = 'rounded-lg', className = '', nativeID, testID }) {
  const shimmerStyle = useShimmer();
  return (
    <Animated.View
      className={`bg-slate-200 dark:bg-slate-700 ${rounded} ${className}`}
      nativeID={nativeID}
      style={[{ width, height }, shimmerStyle]}
      testID={testID}
    />
  );
}

export function SkeletonCircle({ size, className = '', nativeID, testID }) {
  return <SkeletonBlock className={className} height={size} nativeID={nativeID} rounded="rounded-full" testID={testID} width={size} />;
}
