import { useCallback, useEffect, useRef } from 'react';
import { Easing, useAnimatedStyle, useReducedMotion, useSharedValue, withTiming } from 'react-native-reanimated';

export function useExitAction({ duration = 160, restoreDelay = 900 } = {}) {
  const reduceMotion = useReducedMotion();
  const progress = useSharedValue(1);
  const busyRef = useRef(false);
  const actionTimerRef = useRef(null);
  const restoreTimerRef = useRef(null);

  useEffect(() => () => {
    if (actionTimerRef.current) clearTimeout(actionTimerRef.current);
    if (restoreTimerRef.current) clearTimeout(restoreTimerRef.current);
  }, []);

  const style = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [{ translateX: (1 - progress.value) * 12 }],
  }));

  const runExit = useCallback((action) => {
    if (busyRef.current) return;
    busyRef.current = true;

    if (reduceMotion) {
      action();
      busyRef.current = false;
      return;
    }

    progress.value = withTiming(0, { duration, easing: Easing.out(Easing.cubic) });
    actionTimerRef.current = setTimeout(() => {
      actionTimerRef.current = null;
      action();
      restoreTimerRef.current = setTimeout(() => {
        restoreTimerRef.current = null;
        if (!busyRef.current) return;
        busyRef.current = false;
        progress.value = withTiming(1, { duration });
      }, restoreDelay);
    }, duration);
  }, [duration, progress, reduceMotion, restoreDelay]);

  return { runExit, style };
}
