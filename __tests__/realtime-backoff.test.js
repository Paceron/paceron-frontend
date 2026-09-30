import { computeBackoffMs } from '../utils/realtime-backoff.js';

describe('computeBackoffMs', () => {
  test('attempt 0 returns roughly the base delay (jitter disabled via randomFn=0.5, no offset)', () => {
    // randomFn fijo en 0.5 => jitter factor neutro (ni resta ni suma, ver implementación)
    expect(computeBackoffMs(0, { baseMs: 1000, jitterRatio: 0.2, randomFn: () => 0.5 })).toBe(1000);
  });

  test('grows exponentially with the attempt number', () => {
    const opts = { baseMs: 1000, jitterRatio: 0, randomFn: () => 0.5 };
    expect(computeBackoffMs(0, opts)).toBe(1000);
    expect(computeBackoffMs(1, opts)).toBe(2000);
    expect(computeBackoffMs(2, opts)).toBe(4000);
    expect(computeBackoffMs(3, opts)).toBe(8000);
  });

  test('never exceeds maxMs even for large attempt numbers', () => {
    expect(computeBackoffMs(20, { baseMs: 1000, maxMs: 30000, jitterRatio: 0, randomFn: () => 0.5 })).toBe(30000);
  });

  test('jitter moves the result within +/- jitterRatio of the exponential value', () => {
    const base = 1000;
    const lowJitter = computeBackoffMs(0, { baseMs: base, jitterRatio: 0.2, randomFn: () => 0 });
    const highJitter = computeBackoffMs(0, { baseMs: base, jitterRatio: 0.2, randomFn: () => 1 });
    expect(lowJitter).toBe(800); // 1000 - 20%
    expect(highJitter).toBe(1200); // 1000 + 20%
  });

  test('result is never negative even with a tiny base and full negative jitter', () => {
    const result = computeBackoffMs(0, { baseMs: 10, jitterRatio: 1, randomFn: () => 0 });
    expect(result).toBeGreaterThanOrEqual(0);
  });

  test('uses sane defaults when no options are given', () => {
    const result = computeBackoffMs(0);
    expect(result).toBeGreaterThan(0);
    expect(result).toBeLessThanOrEqual(30000);
  });
});
