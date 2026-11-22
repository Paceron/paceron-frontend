import { useCallback, useEffect, useRef, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';

export function usePageReveal({ initialPhase = 'hidden', loading = false, settleMs = 120 } = {}) {
  const [state, setState] = useState({
    phase: initialPhase,
    revealKey: initialPhase === 'hidden' ? 0 : 1,
  });
  const loadingRef = useRef(loading);
  loadingRef.current = loading;
  const hasFocusedOnce = useRef(false);

  useEffect(() => {
    if (loading) {
      setState((prev) => (prev.phase === 'hidden' ? prev : { ...prev, phase: 'hidden' }));
      return undefined;
    }
    if (state.phase !== 'hidden') return undefined;
    const timer = setTimeout(() => {
      setState((prev) => ({ phase: 'load', revealKey: prev.revealKey + 1 }));
    }, settleMs);
    return () => clearTimeout(timer);
  }, [loading, settleMs, state.phase]);

  useFocusEffect(useCallback(() => {
    if (!hasFocusedOnce.current) {
      hasFocusedOnce.current = true;
      return;
    }
    if (loadingRef.current) return;
    setState((prev) => ({ phase: 'return', revealKey: prev.revealKey + 1 }));
  }, []));

  return {
    phase: state.phase,
    revealKey: state.revealKey,
    visible: state.phase !== 'hidden',
  };
}
