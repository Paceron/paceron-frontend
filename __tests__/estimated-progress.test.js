import { estimateBulkDurationMs, estimateProgressFraction } from '../utils/estimated-progress.js';

describe('estimateBulkDurationMs', () => {
  it('scales with item count', () => {
    expect(estimateBulkDurationMs(38)).toBe(190000);
  });

  it('floors to a minimum for tiny batches', () => {
    expect(estimateBulkDurationMs(1)).toBe(10000);
    expect(estimateBulkDurationMs(0)).toBe(10000);
  });
});

describe('estimateProgressFraction', () => {
  it('grows linearly with elapsed time', () => {
    expect(estimateProgressFraction(5000, 10000)).toBe(0.5);
  });

  it('caps at 0.95 so it never claims completion before the real response', () => {
    expect(estimateProgressFraction(20000, 10000)).toBe(0.95);
  });

  it('returns 0 for a non-positive estimate', () => {
    expect(estimateProgressFraction(5000, 0)).toBe(0);
  });
});
