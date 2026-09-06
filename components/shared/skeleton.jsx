import { useEffect } from 'react';
import Animated, { useSharedValue, useAnimatedStyle, withRepeat, withTiming, Easing } from 'react-native-reanimated';

function useShimmer() {
  const opacity = useSharedValue(0.4);

  useEffect(() => {
    opacity.value = withRepeat(withTiming(1, { duration: 700, easing: Easing.inOut(Easing.ease) }), -1, true);
  }, [opacity]);

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
