import { useCallback, useEffect, useRef, useState } from 'react';

const TICK_MS = 50;

// Cronómetro por timestamps (base = Date.now), no por conteo de intervalos —
// así un frame perdido no acumula error. `wallMs` es el tiempo de pared
// (start→ahora, incluye pausas) y `activeMs` solo los segmentos activos.
export function useStopwatch() {
  const [running, setRunning] = useState(false);
  const [elapsed, setElapsed] = useState({ wallMs: 0, activeMs: 0 });
  const baseRef = useRef({ wallMs: 0, activeMs: 0 });
  const epochRef = useRef({ wallMs: 0, activeMs: 0 });
  const intervalRef = useRef(null);

  const computeCurrent = useCallback(() => {
    const now = Date.now();
    return {
      wallMs: baseRef.current.wallMs + (now - epochRef.current.wallMs),
      activeMs: baseRef.current.activeMs + (now - epochRef.current.activeMs),
    };
  }, []);

  const stopInterval = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  useEffect(() => () => stopInterval(), [stopInterval]);

  // Arranque desde una base previa ({ wallMs, activeMs } = 0,0). El countdown
  // de 5 s solo aplica en el arranque de la serie; resume usa resumeFrom con
  // los valores ya capturados. Devuelve el snapshot recién computed (para
  // persistir en el pause).
  const resumeFrom = useCallback(
    ({ wallMs = 0, activeMs = 0 } = {}) => {
      baseRef.current = { wallMs, activeMs };
      epochRef.current = { wallMs: Date.now(), activeMs: Date.now() };
      stopInterval();
      intervalRef.current = setInterval(() => setElapsed(computeCurrent()), TICK_MS);
      setRunning(true);
      const snapshot = computeCurrent();
      setElapsed(snapshot);
      return snapshot;
    },
    [computeCurrent, stopInterval],
  );

  const start = useCallback(() => resumeFrom({ wallMs: 0, activeMs: 0 }), [resumeFrom]);

  const pause = useCallback(() => {
    stopInterval();
    const snapshot = computeCurrent();
    setRunning(false);
    setElapsed(snapshot);
    return snapshot;
  }, [computeCurrent, stopInterval]);

  const reset = useCallback(() => {
    stopInterval();
    baseRef.current = { wallMs: 0, activeMs: 0 };
    epochRef.current = { wallMs: 0, activeMs: 0 };
    setRunning(false);
    setElapsed({ wallMs: 0, activeMs: 0 });
  }, [stopInterval]);

  return { running, wallMs: elapsed.wallMs, activeMs: elapsed.activeMs, start, resumeFrom, pause, reset };
}