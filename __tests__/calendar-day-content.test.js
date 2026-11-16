import { hasCalendarDayContent } from '../utils/calendar-day-content.js';

describe('hasCalendarDayContent', () => {
  test('un día de descanso se trata como vacío para asignar', () => {
    expect(hasCalendarDayContent({ kind: 'rest' })).toBe(false);
  });

  test('entrenamiento, otra actividad y cancelada son contenido', () => {
    expect(hasCalendarDayContent({ kind: 'training' })).toBe(true);
    expect(hasCalendarDayContent({ kind: 'other' })).toBe(true);
    expect(hasCalendarDayContent({ kind: 'cancelled' })).toBe(true);
  });

  test('sin día no hay contenido', () => {
    expect(hasCalendarDayContent(null)).toBe(false);
    expect(hasCalendarDayContent(undefined)).toBe(false);
  });
});
