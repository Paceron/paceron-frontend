import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';
import { useReducedMotion } from 'react-native-reanimated';
import { SkeletonBlock, SkeletonPulse } from '../shared/skeleton.jsx';

export function HomeSkeleton({ visible, idPrefix = 'home-skeleton' }) {
  const [mounted, setMounted] = useState(visible);
  const reduceMotion = useReducedMotion();
  const opacity = useRef(new Animated.Value(visible ? 1 : 0)).current;

  useEffect(() => {
    if (visible) {
      setMounted(true);
      opacity.setValue(1);
      return;
    }
    if (!mounted) return;
    if (reduceMotion) {
      opacity.setValue(0);
      setMounted(false);
      return;
    }
    const animation = Animated.timing(opacity, {
      duration: 160,
      easing: Easing.out(Easing.cubic),
      toValue: 0,
      useNativeDriver: false,
    });
    const fallback = setTimeout(() => setMounted(false), 240);
    animation.start(({ finished }) => {
      if (finished) setMounted(false);
    });
    return () => {
      clearTimeout(fallback);
      animation.stop();
    };
  }, [mounted, opacity, reduceMotion, visible]);

  if (!mounted) return null;

  return (
    <Animated.View
      accessibilityLabel="Cargando inicio"
      accessibilityViewIsModal
      nativeID={`${idPrefix}-overlay`}
      pointerEvents={visible ? 'auto' : 'none'}
      style={[styles.overlay, { opacity }]}
      testID={`${idPrefix}-overlay`}
    >
      <View className="absolute inset-0 bg-paper dark:bg-ink" nativeID={`${idPrefix}-background`} testID={`${idPrefix}-background`} />
      <View className="absolute inset-0 justify-center px-4 py-8" nativeID={`${idPrefix}-content`} testID={`${idPrefix}-content`}>
        <View className="w-full max-w-3xl self-center" nativeID={`${idPrefix}-column`} testID={`${idPrefix}-column`}>
          <SkeletonPulse className="w-full" nativeID={`${idPrefix}-pulse`} testID={`${idPrefix}-pulse`}>
            <SkeletonBlock height={28} nativeID={`${idPrefix}-title`} testID={`${idPrefix}-title`} width={150} />
            <SkeletonBlock
              className="mt-4 w-full"
              height={168}
              nativeID={`${idPrefix}-hero`}
              rounded="rounded-2xl"
              testID={`${idPrefix}-hero`}
              width="100%"
            />
            <SkeletonBlock
              className="mt-3 w-full"
              height={146}
              nativeID={`${idPrefix}-kpis`}
              rounded="rounded-2xl"
              testID={`${idPrefix}-kpis`}
              width="100%"
            />
            <View className="mt-3 flex-row gap-3" nativeID={`${idPrefix}-row`} testID={`${idPrefix}-row`}>
              <SkeletonBlock height={96} nativeID={`${idPrefix}-row-left`} rounded="rounded-2xl" testID={`${idPrefix}-row-left`} width="48%" />
              <SkeletonBlock height={96} nativeID={`${idPrefix}-row-right`} rounded="rounded-2xl" testID={`${idPrefix}-row-right`} width="48%" />
            </View>
            <SkeletonBlock
              className="mt-3 w-full"
              height={122}
              nativeID={`${idPrefix}-card`}
              rounded="rounded-2xl"
              testID={`${idPrefix}-card`}
              width="100%"
            />
          </SkeletonPulse>
        </View>
      </View>
    </Animated.View>
  );
}

const styles = {
  overlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 40,
  },
};
