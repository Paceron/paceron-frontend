import { formatMetricValue } from '../utils/leaderboard-metric-format.js';

describe('formatMetricValue', () => {
  test('distance -> usa formatMeters (km con 2 decimales sobre 1000m)', () => {
    expect(formatMetricValue('distance', 1500)).toBe('1.50 km');
  });

  test('duration -> usa formatClock (mm:ss)', () => {
    expect(formatMetricValue('duration', 125000)).toBe('02:05');
  });

  test('duration null -> guión, no "00:00" (formatClock trata null como 0, hay que guardear antes)', () => {
    expect(formatMetricValue('duration', null)).toBe('—');
  });

  test('pace -> mm:ss /km desde minutos decimales', () => {
    expect(formatMetricValue('pace', 5.4167)).toBe('5:25 /km');
  });

  test('peak_speed -> X.X km/h', () => {
    expect(formatMetricValue('peak_speed', 14.33)).toBe('14.3 km/h');
  });

  test('sessions_count -> entero plano', () => {
    expect(formatMetricValue('sessions_count', 12)).toBe('12');
  });

  test('attendance_count null -> guión', () => {
    expect(formatMetricValue('attendance_count', null)).toBe('—');
  });

  test('métrica desconocida -> guión', () => {
    expect(formatMetricValue('bogus', 10)).toBe('—');
  });
});
