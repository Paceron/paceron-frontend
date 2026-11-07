import {
  TRAINER_HOME_PERIOD_METRICS,
  TRAINER_HOME_STRUCTURE_METRICS,
  formatSessionPair,
  formatTrainerHomeMetric,
  trainerHomePeriodTitle,
} from '../utils/trainer-home-kpis.js';

const DATA = {
  period: 'month', from: '2026-11-01', to: '2026-11-30', daysConsidered: 30,
  sessions: { scheduled: 18, realized: 12, presencialScheduled: 8, presencialRealized: 6 },
  structure: { activeTeams: 2, activeRunners: 17 },
  collections: { currencyId: 'ARS', netCollected: 286500.5, pendingAmount: 30000, pendingCount: 3 },
};

describe('trainer home KPI presentation', () => {
  test('la tarjeta temporal muestra actividad y cobranza; estructura queda separada', () => {
    expect(TRAINER_HOME_PERIOD_METRICS.map(({ field }) => field)).toEqual([
      'sessions', 'presencialSessions', 'netCollected', 'pendingAmount',
    ]);
    expect(TRAINER_HOME_STRUCTURE_METRICS.map(({ field }) => field)).toEqual(['activeTeams', 'activeRunners']);
  });

  test('las sesiones se presentan programadas / realizadas', () => {
    expect(formatSessionPair(18, 12)).toBe('18 / 12');
    expect(formatTrainerHomeMetric('sessions', DATA)).toBe('18 / 12');
    expect(formatTrainerHomeMetric('presencialSessions', DATA)).toBe('8 / 6');
  });

  test('los montos y contadores se formatean con utilidades compartidas', () => {
    expect(formatTrainerHomeMetric('netCollected', DATA)).toContain('286.500,50');
    expect(formatTrainerHomeMetric('pendingAmount', DATA)).toContain('30.000');
    expect(formatTrainerHomeMetric('activeTeams', DATA)).toBe('2');
    expect(formatTrainerHomeMetric('activeRunners', DATA)).toBe('17');
  });

  test('el título del corte usa los valores del backend', () => {
    expect(trainerHomePeriodTitle(DATA)).toBe('Noviembre 2026 · 30 días considerados');
    expect(trainerHomePeriodTitle(null)).toBe('0 días considerados');
  });
});
