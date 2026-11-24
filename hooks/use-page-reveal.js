import { useEffect, useRef, useState } from 'react';
import { usePathname } from 'expo-router';

export function usePageReveal({ initialPhase = 'hidden', loading = false, settleMs = 120 } = {}) {
  const pathname = usePathname();
  const [state, setState] = useState({
    phase: initialPhase,
    revealKey: initialPhase === 'hidden' ? 0 : 1,
  });
  const loadingRef = useRef(loading);
  loadingRef.current = loading;
  const previousPathnameRef = useRef(pathname);

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

  useEffect(() => {
    if (previousPathnameRef.current === pathname) return;
    previousPathnameRef.current = pathname;
    if (loadingRef.current) return;
    setState((prev) => ({ phase: 'return', revealKey: prev.revealKey + 1 }));
  }, [pathname]);

  return {
    phase: state.phase,
    revealKey: state.revealKey,
    visible: state.phase !== 'hidden',
  };
}
