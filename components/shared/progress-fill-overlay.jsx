import { useEffect } from 'react';
import Animated, { useSharedValue, useAnimatedStyle, withTiming, Easing } from 'react-native-reanimated';

// Relleno de izquierda a derecha dentro de un botón, según `fraction` (0-1,
// estimado -- ver hooks/use-estimated-progress.js). El Pressable que lo
// envuelve necesita `overflow-hidden` para que el relleno quede recortado a
// su forma (rounded-full no recorta hijos por sí solo en RN); se monta como
// PRIMER hijo para que quede detrás del label/spinner (RN pinta hijos en
// orden de declaración). Reanimated (no RN Animated core) para seguir el
// mismo mecanismo que skeleton.jsx/theme-toggle.jsx -- anima igual en web y
// nativo. El tick de `fraction` (cada 150ms, ver use-estimated-progress.js)
// queda "a los saltos" sin esto -- la transición de `withTiming` interpola
// entre un tick y el siguiente en vez de saltar directo al nuevo %.
export function ProgressFillOverlay({ fraction, idPrefix }) {
  const width = useSharedValue(0);

  useEffect(() => {
    width.value = withTiming(fraction * 100, { duration: 300, easing: Easing.out(Easing.ease) });
  }, [fraction, width]);

  const fillStyle = useAnimatedStyle(() => ({ width: `${width.value}%` }));

  if (!fraction) return null;
  return (
    <Animated.View
      className="absolute bottom-0 left-0 top-0 bg-black/20 dark:bg-white/30"
      nativeID={`${idPrefix}-progress-fill`}
      style={fillStyle}
      testID={`${idPrefix}-progress-fill`}
    />
  );
}
