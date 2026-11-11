import { buildCalendarDayTooltipLabel } from '../utils/calendar-day-tooltip.js';

describe('buildCalendarDayTooltipLabel', () => {
  test('sin marking no hay tooltip', () => {
    expect(buildCalendarDayTooltipLabel(null)).toBeNull();
  });

  test('descanso no es contenido a estos fines', () => {
    expect(buildCalendarDayTooltipLabel({ kind: 'rest' })).toBeNull();
  });

  test('entrenamiento sin presencial muestra solo el label', () => {
    expect(buildCalendarDayTooltipLabel({ kind: 'training' })).toBe('Entrenamiento');
  });

  test('entrenamiento presencial agrega el horario', () => {
    expect(buildCalendarDayTooltipLabel({ kind: 'training', isPresencial: true, presencialTimeFrom: '18:00', presencialTimeTo: '19:30' })).toBe('Entrenamiento · 18:00–19:30');
  });

  test('otra actividad muestra su label', () => {
    expect(buildCalendarDayTooltipLabel({ kind: 'other' })).toBe('Otra actividad');
  });

  test('cancelado muestra su label', () => {
    expect(buildCalendarDayTooltipLabel({ kind: 'cancelled' })).toBe('Cancelado');
  });

  test('kind desconocido no explota, cae a Otra actividad', () => {
    expect(buildCalendarDayTooltipLabel({ kind: 'bogus' })).toBe('Otra actividad');
  });

  test('presencial sin horario completo no agrega el separador', () => {
    expect(buildCalendarDayTooltipLabel({ kind: 'training', isPresencial: true, presencialTimeFrom: null, presencialTimeTo: null })).toBe('Entrenamiento');
  });
});
