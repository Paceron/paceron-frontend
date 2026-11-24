import { useEffect } from 'react';
import { View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useReducedMotion, useSharedValue, withTiming } from 'react-native-reanimated';

// Barra de progreso simple, sin librería -- `View` con ancho proporcional.
// Compartida por achievements-tab.jsx y achievement-highlight-card.jsx.
export function ProgressBar({ percent, nativeID, testID }) {
  const clamped = Math.min(100, Math.max(0, percent));
  const reducedMotion = useReducedMotion();
  const progress = useSharedValue(clamped / 100);

  useEffect(() => {
    progress.value = reducedMotion ? clamped / 100 : withTiming(clamped / 100, { duration: 420, easing: Easing.out(Easing.cubic) });
  }, [clamped, progress, reducedMotion]);

  const fillStyle = useAnimatedStyle(() => ({
    transform: [{ scaleX: progress.value }],
  }));

  return (
    <View className="h-1.5 w-full rounded-full bg-slate-200 dark:bg-slate-700" nativeID={nativeID} testID={testID}>
      <Animated.View
        nativeID={`${nativeID}-fill`}
        style={[{
          backgroundColor: '#8cc63e',
          borderRadius: 9999,
          height: 6,
          transformOrigin: 'left center',
          width: '100%',
        }, fillStyle]}
        testID={`${nativeID}-fill`}
      />
    </View>
  );
}
