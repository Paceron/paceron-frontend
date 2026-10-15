import { getWeekDates, canGoOlder } from '../utils/streak-week.js';

describe('getWeekDates', () => {
  test('semana actual (offset 0) de lunes a domingo, referencia un miércoles', () => {
    const wednesday = new Date('2026-10-14T12:00:00'); // miércoles
    expect(getWeekDates(0, wednesday)).toEqual([
      '2026-10-12', '2026-10-13', '2026-10-14', '2026-10-15', '2026-10-16', '2026-10-17', '2026-10-18',
    ]);
  });

  test('referencia un domingo -- sigue perteneciendo a la semana que arrancó el lunes anterior', () => {
    const sunday = new Date('2026-10-18T12:00:00');
    expect(getWeekDates(0, sunday)).toEqual([
      '2026-10-12', '2026-10-13', '2026-10-14', '2026-10-15', '2026-10-16', '2026-10-17', '2026-10-18',
    ]);
  });

  test('offset 1 retrocede una semana completa', () => {
    const wednesday = new Date('2026-10-14T12:00:00');
    expect(getWeekDates(1, wednesday)).toEqual([
      '2026-10-05', '2026-10-06', '2026-10-07', '2026-10-08', '2026-10-09', '2026-10-10', '2026-10-11',
    ]);
  });

  test('semana que cruza fin de mes', () => {
    const wednesday = new Date('2026-11-04T12:00:00');
    expect(getWeekDates(0, wednesday)[0]).toBe('2026-11-02');
  });
});

describe('canGoOlder', () => {
  test('con suficientes días fetched, se puede retroceder', () => {
    expect(canGoOlder(0, 90)).toBe(true);
    expect(canGoOlder(10, 90)).toBe(true);
  });

  test('en el límite de los días fetched, no se puede retroceder más', () => {
    expect(canGoOlder(13, 90)).toBe(false);
  });
});
