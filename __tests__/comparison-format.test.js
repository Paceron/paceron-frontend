import {
  averageBasisLabel,
  averageValueLabel,
  complianceTone,
  formatComparisonDate,
  formatCompliance,
  formatDistanceDeviation,
  formatDurationDeviation,
  formatPace,
  formatSchedule,
  kindLabel,
  NO_TARGET_LABEL,
  plannedExerciseLabel,
  plannedTargetLabel,
  roleLabel,
  sessionStatusLabel,
  setActualLabel,
  setDeviationLabel,
  setStatusLabel,
  totalsDistanceLabel,
  totalsDurationLabel,
} from '../utils/comparison-format.js';

describe('comparison-format', () => {
  it('formats compliance with a comma and handles null', () => {
    expect(formatCompliance(50.1)).toBe('50,1 %');
    expect(formatCompliance(100)).toBe('100 %');
    expect(formatCompliance(0)).toBe('0 %');
    expect(formatCompliance(null)).toBe('—');
  });

  it('picks a tone by compliance', () => {
    expect(complianceTone(95)).toBe('good');
    expect(complianceTone(90)).toBe('good');
    expect(complianceTone(50.1)).toBe('partial');
    expect(complianceTone(10)).toBe('low');
    expect(complianceTone(null)).toBe('low');
  });

  it('formats duration deviations with sign and keeps null as no target', () => {
    expect(formatDurationDeviation(-300000)).toBe('−05:00');
    expect(formatDurationDeviation(120000)).toBe('+02:00');
    expect(formatDurationDeviation(2340)).toBe('+00:02');
    expect(formatDurationDeviation(400)).toBe('±00:00');
    expect(formatDurationDeviation(null)).toBeNull();
  });

  it('formats distance deviations', () => {
    expect(formatDistanceDeviation(-250)).toBe('−250 m');
    expect(formatDistanceDeviation(1250)).toBe('+1.25 km');
    expect(formatDistanceDeviation(0.2)).toBe('±0 m');
    expect(formatDistanceDeviation(null)).toBeNull();
  });

  it('formats pace', () => {
    expect(formatPace(300)).toBe('05:00 /km');
    expect(formatPace(null)).toBeNull();
    expect(formatPace(0)).toBeNull();
  });

  it('labels the planned target, never as zero', () => {
    expect(plannedTargetLabel({ minutes: 10 })).toBe('10 min');
    expect(plannedTargetLabel({ distanceM: 400 })).toBe('400 m');
    expect(plannedTargetLabel({ minutes: 10, distanceM: 1000 })).toBe('10 min · 1.00 km');
    expect(plannedTargetLabel({ minutes: null, distanceM: null })).toBe(NO_TARGET_LABEL);
    expect(plannedExerciseLabel({ sets: 2, minutes: 10 })).toBe('2 × 10 min');
    expect(plannedExerciseLabel({ sets: 1 })).toBe('1 × serie');
  });

  it('labels what was done in a set', () => {
    expect(setActualLabel({ status: 'completed', durationMs: 602340, distanceMeters: 835.4 })).toBe('10:02 · 835 m');
    expect(setActualLabel({ status: 'completed', durationMs: null, distanceMeters: null })).toBe('Completada');
    expect(setActualLabel({ status: 'skipped' })).toBe('Salteada');
    expect(setActualLabel({ status: 'unregistered' })).toBe('Sin registro');
    expect(setStatusLabel('other')).toBe('other');
  });

  it('prefers the time deviation and falls back to distance', () => {
    expect(setDeviationLabel({ deviationDurationMs: -300000, deviationDistanceM: 10 })).toBe('−05:00');
    expect(setDeviationLabel({ deviationDurationMs: null, deviationDistanceM: -100 })).toBe('−100 m');
    expect(setDeviationLabel({})).toBeNull();
  });

  it('labels kinds, roles and session status', () => {
    expect(kindLabel('liviano')).toBe('Liviano');
    expect(kindLabel('desconocido')).toBe('desconocido');
    expect(roleLabel('cooldown')).toBe('Vuelta a la calma');
    expect(sessionStatusLabel('finished')).toBe('Completada');
    expect(sessionStatusLabel('none')).toBe('Sin ejecutar');
  });

  it('formats the schedule in local time', () => {
    const start = new Date(2026, 9, 12, 10, 0, 5).toISOString();
    const end = new Date(2026, 9, 12, 10, 16, 40).toISOString();
    expect(formatSchedule(start, end)).toBe('10:00 – 10:16');
    expect(formatSchedule(start, null)).toBe('10:00');
    expect(formatSchedule(null, end)).toBeNull();
    expect(formatSchedule('no-es-fecha', null)).toBeNull();
  });

  it('labels totals with or without a planned target', () => {
    expect(totalsDurationLabel({ plannedDurationMs: 1800000, actualDurationMs: 902340 })).toBe('30:00 vs 15:02');
    expect(totalsDurationLabel({ plannedDurationMs: null, actualDurationMs: 60000 })).toBe('01:00');
    expect(totalsDistanceLabel({ plannedDistanceM: 1200, actualDistanceM: 1100 })).toBe('1.20 km vs 1.10 km');
    expect(totalsDistanceLabel({ plannedDistanceM: null, actualDistanceM: 0 })).toBe('0 m');
  });

  it('formats dates as dd-mm-aaaa', () => {
    expect(formatComparisonDate('2026-10-12')).toBe('12-10-2026');
    expect(formatComparisonDate('')).toBe('');
  });
});

describe('promedio del rango', () => {
  it('aclara la base del promedio solo cuando no entran todas las sesiones', () => {
    expect(averageBasisLabel({ sessionsPlanned: 4, sessionsAveraged: 4 })).toBeNull();
    expect(averageBasisLabel({ sessionsPlanned: 4, sessionsAveraged: 3 })).toBe('Sobre 3 de 4 sesiones');
    expect(averageBasisLabel({ sessionsPlanned: 2, sessionsAveraged: 1 })).toBe('Sobre 1 de 2 sesiones');
    expect(averageBasisLabel({ sessionsPlanned: 1, sessionsAveraged: 0 })).toBe('Todavía no hay sesiones para promediar');
  });

  it('no muestra 0 % cuando no hay nada para promediar', () => {
    expect(averageValueLabel({ sessionsAveraged: 0, avgCompliancePct: 0 })).toBe('—');
    expect(averageValueLabel({ sessionsAveraged: 2, avgCompliancePct: 59.4 })).toBe(formatCompliance(59.4));
  });
});
