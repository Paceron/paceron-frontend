// Backoff exponencial + jitter para la reconexión del WS (spec 2026-09-28).
// randomFn es inyectable a propósito -- sin eso el jitter no es testeable
// de forma determinística.
export function computeBackoffMs(attempt, { baseMs = 1000, maxMs = 30000, jitterRatio = 0.2, randomFn = Math.random } = {}) {
  const exponential = Math.min(maxMs, baseMs * 2 ** attempt);
  // randomFn() en [0,1) -> factor de jitter en [-jitterRatio, +jitterRatio]
  const jitterFactor = (randomFn() * 2 - 1) * jitterRatio;
  const withJitter = exponential * (1 + jitterFactor);
  return Math.max(0, Math.min(maxMs, Math.round(withJitter)));
}
