import { useEffect, useRef, useState } from 'react';
import { estimateProgressFraction } from '../utils/estimated-progress.js';

// Fracción 0-1 que avanza mientras `active` -- ver utils/estimated-progress.js
// para el por qué del tope en 0.95. Se resetea a 0 en cuanto `active` pasa a
// false (éxito o error: el caller decide qué mostrar después, esto solo
// cubre "mientras está en curso").
export function useEstimatedProgress(active, estimatedTotalMs) {
  const [fraction, setFraction] = useState(0);
  const startRef = useRef(null);

  useEffect(() => {
    if (!active) {
      setFraction(0);
      startRef.current = null;
      return undefined;
    }
    startRef.current = Date.now();
    const interval = setInterval(() => {
      setFraction(estimateProgressFraction(Date.now() - startRef.current, estimatedTotalMs));
    }, 150);
    return () => clearInterval(interval);
  }, [active, estimatedTotalMs]);

  return fraction;
}
