import { createContext, useContext, useEffect } from 'react';
import { View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';

export const HomeRevealContext = createContext({
  phase: 'load',
  revealKey: 0,
});

export function resolveRevealStart(phase, reduceMotion) {
  if (reduceMotion) return 1;
  return 0;
}

export function HomeReveal({ children, delay = 0, fill = false, idPrefix = 'home-reveal' }) {
  const { phase, revealKey } = useContext(HomeRevealContext);
  const reduceMotion = useReducedMotion();
  const progress = useSharedValue(resolveRevealStart(phase, reduceMotion));
  const fillStyle = fill ? { flex: 1, minWidth: 0 } : undefined;

  useEffect(() => {
    const start = resolveRevealStart(phase, reduceMotion);
    progress.value = start;
    if (phase === 'hidden') return;
    if (reduceMotion) {
      progress.value = 1;
      return;
    }
    progress.value = withDelay(
      phase === 'return' ? 0 : delay,
      withTiming(1, {
        duration: 240,
        easing: Easing.out(Easing.cubic),
      }),
    );
  }, [delay, phase, progress, reduceMotion, revealKey]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [{ translateY: (1 - progress.value) * 8 }],
  }));

  return (
    <Animated.View
      nativeID={`${idPrefix}-animated`}
      style={[animatedStyle, fillStyle]}
      testID={`${idPrefix}-animated`}
    >
      <View nativeID={idPrefix} style={fillStyle} testID={idPrefix}>
        {children}
      </View>
    </Animated.View>
  );
}

export function HomeRevealProvider({ children, phase, revealKey }) {
  return (
    <HomeRevealContext.Provider value={{ phase, revealKey }}>
      {children}
    </HomeRevealContext.Provider>
  );
}

export function HomeRevealSlot({ children, delay = 0, idPrefix }) {
  return (
    <View className="flex-1 min-w-0" nativeID={`${idPrefix}-slot`} testID={`${idPrefix}-slot`}>
      <HomeReveal delay={delay} idPrefix={idPrefix}>
        {children}
      </HomeReveal>
    </View>
  );
}
