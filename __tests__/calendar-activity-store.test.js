import { useCalendarActivityStore, isCalendarDatePending } from '../store/calendar-activity-store.js';

describe('calendar-activity-store', () => {
  afterEach(() => {
    useCalendarActivityStore.getState().clearAll();
  });

  test('arranca sin actividad pendiente', () => {
    expect(useCalendarActivityStore.getState().activityByScope).toEqual({});
  });

  test('startActivity marca las fechas y finishActivity las limpia', () => {
    const store = useCalendarActivityStore.getState();
    store.startActivity(7, ['2026-11-14', '2026-11-15']);
    expect(useCalendarActivityStore.getState().activityByScope).toEqual({
      7: { '2026-11-14': 1, '2026-11-15': 1 },
    });

    store.finishActivity(7, ['2026-11-14', '2026-11-15']);
    expect(useCalendarActivityStore.getState().activityByScope).toEqual({});
  });

  test('cuenta operaciones superpuestas sobre la misma fecha', () => {
    const store = useCalendarActivityStore.getState();
    store.startActivity(7, ['2026-11-14']);
    store.startActivity(7, ['2026-11-14']);

    expect(useCalendarActivityStore.getState().activityByScope[7]['2026-11-14']).toBe(2);

    store.finishActivity(7, ['2026-11-14']);
    expect(useCalendarActivityStore.getState().activityByScope[7]['2026-11-14']).toBe(1);

    store.finishActivity(7, ['2026-11-14']);
    expect(useCalendarActivityStore.getState().activityByScope).toEqual({});
  });

  test('mantiene independientes los grupos y las fechas', () => {
    const store = useCalendarActivityStore.getState();
    store.startActivity(7, ['2026-11-14']);
    store.startActivity(8, ['2026-11-14']);

    store.finishActivity(7, ['2026-11-14']);

    const state = useCalendarActivityStore.getState();
    expect(isCalendarDatePending(state.activityByScope, 7, '2026-11-14')).toBe(false);
    expect(isCalendarDatePending(state.activityByScope, 8, '2026-11-14')).toBe(true);
  });

  test('normaliza ids y fechas a string y deduplica la entrada', () => {
    const store = useCalendarActivityStore.getState();
    store.startActivity('7', ['2026-11-14', '2026-11-14']);

    expect(useCalendarActivityStore.getState().activityByScope).toEqual({
      7: { '2026-11-14': 1 },
    });
  });

  test('ignora grupos o fechas inválidas', () => {
    const store = useCalendarActivityStore.getState();
    store.startActivity(null, ['2026-11-14']);
    store.startActivity(7, [null, undefined, '']);
    store.finishActivity(7, [null]);

    expect(useCalendarActivityStore.getState().activityByScope).toEqual({});
  });

  test('clearScope limpia solo el grupo indicado', () => {
    const store = useCalendarActivityStore.getState();
    store.startActivity(7, ['2026-11-14']);
    store.startActivity(8, ['2026-11-14']);

    store.clearScope(7);

    const state = useCalendarActivityStore.getState();
    expect(state.activityByScope[7]).toBeUndefined();
    expect(isCalendarDatePending(state.activityByScope, 8, '2026-11-14')).toBe(true);
  });
});
