import { useEffect, useState } from 'react';
import { View } from 'react-native';
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withTiming } from 'react-native-reanimated';

export function Collapsible({ expanded, children, idPrefix = 'collapsible', duration = 220 }) {
  const reduceMotion = useReducedMotion();
  const [contentHeight, setContentHeight] = useState(null);
  const progress = useSharedValue(expanded ? 1 : 0);

  useEffect(() => {
    const next = expanded ? 1 : 0;
    progress.value = reduceMotion ? next : withTiming(next, { duration });
  }, [duration, expanded, progress, reduceMotion]);

  const contentStyle = useAnimatedStyle(() => ({
    height: contentHeight == null ? (expanded ? undefined : 0) : progress.value * contentHeight,
    opacity: contentHeight == null ? 1 : 0.35 + progress.value * 0.65,
    overflow: 'hidden',
  }));

  const handleLayout = (event) => {
    const nextHeight = Math.ceil(event.nativeEvent.layout.height);
    if (nextHeight > 0 && nextHeight !== contentHeight) setContentHeight(nextHeight);
  };

  return (
    <Animated.View
      accessibilityElementsHidden={!expanded}
      importantForAccessibility={expanded ? 'auto' : 'no-hide-descendants'}
      nativeID={`${idPrefix}-animated`}
      pointerEvents={expanded ? 'auto' : 'none'}
      style={contentStyle}
      testID={`${idPrefix}-animated`}
    >
      <View nativeID={`${idPrefix}-content`} onLayout={handleLayout} testID={`${idPrefix}-content`}>
        {children}
      </View>
    </Animated.View>
  );
}
