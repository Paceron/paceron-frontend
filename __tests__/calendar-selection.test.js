import { canAddToSelection } from '../utils/calendar-selection.js';

describe('canAddToSelection', () => {
  test('con selección vacía (null), siempre se puede agregar', () => {
    expect(canAddToSelection(null, true)).toBe(true);
    expect(canAddToSelection(null, false)).toBe(true);
  });

  test('con clase cerrada fijada, solo se pueden agregar días cerrados', () => {
    expect(canAddToSelection(true, true)).toBe(true);
    expect(canAddToSelection(true, false)).toBe(false);
  });

  test('con clase abierta fijada, solo se pueden agregar días abiertos', () => {
    expect(canAddToSelection(false, false)).toBe(true);
    expect(canAddToSelection(false, true)).toBe(false);
  });
});
