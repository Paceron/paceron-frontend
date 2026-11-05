const { computeTodayIso, isTodayDateString } = require('../utils/calendar-today.js');

describe('computeTodayIso', () => {
  test('pads single-digit month and day', () => {
    const now = new Date(2026, 0, 5, 10, 0, 0); // Jan 5, 2026, local
    expect(computeTodayIso(now)).toBe('2026-01-05');
  });

  test('does not use UTC getters -- late evening stays the same local day', () => {
    // 23:30 local time, Nov 2 -- a UTC-based implementation parsing a
    // date-only string would roll this to Nov 3 in any negative-offset
    // timezone. This constructs the Date from local components directly
    // (no string parsing involved), so it must stay Nov 2 regardless of
    // the machine's timezone.
    const now = new Date(2026, 10, 2, 23, 30, 0);
    expect(computeTodayIso(now)).toBe('2026-11-02');
  });
});

describe('isTodayDateString', () => {
  test('true when the date string matches today, regardless of hour', () => {
    const now = new Date(2026, 10, 2, 23, 45, 0);
    expect(isTodayDateString('2026-11-02', now)).toBe(true);
  });

  test('false for tomorrow, even at 23:45 today', () => {
    const now = new Date(2026, 10, 2, 23, 45, 0);
    expect(isTodayDateString('2026-11-03', now)).toBe(false);
  });

  test('false for yesterday', () => {
    const now = new Date(2026, 10, 2, 0, 5, 0);
    expect(isTodayDateString('2026-11-01', now)).toBe(false);
  });
});
