import {
  mockGetGroupCalendar, mockUpsertCalendarDay, mockDeleteCalendarDay, __resetMockCalendar,
} from '../services/__mocks__/calendar-mock.js';
import { __resetMockSessions } from '../services/__mocks__/sessions-mock.js';

beforeEach(() => {
  __resetMockCalendar();
  __resetMockSessions();
});

describe('calendar-mock', () => {
  test('mockGetGroupCalendar arranca vacío y filtra por grupo y rango de fechas', async () => {
    expect(await mockGetGroupCalendar(1, '2026-10-01', '2026-10-31')).toEqual([]);
    await mockUpsertCalendarDay(1, '2026-10-05', { kind: 'rest' });
    await mockUpsertCalendarDay(1, '2026-11-05', { kind: 'rest' });
    await mockUpsertCalendarDay(2, '2026-10-05', { kind: 'rest' });
    const octoberGroup1 = await mockGetGroupCalendar(1, '2026-10-01', '2026-10-31');
    expect(octoberGroup1).toHaveLength(1);
    expect(octoberGroup1[0].date).toBe('2026-10-05');
  });

  test('mockUpsertCalendarDay con kind=training instancia la sesión del catálogo', async () => {
    const day = await mockUpsertCalendarDay(1, '2026-10-05', {
      kind: 'training', session_id: 1, is_presencial: true,
      presencial_time_from: '08:00', presencial_time_to: '09:30',
      presencial_location: { lat: 1, lng: 2, label: 'Plaza' },
    });
    expect(day.kind).toBe('training');
    expect(day.session_instance.name).toBe('Fondo suave');
    expect(day.session_instance.exercises.length).toBeGreaterThan(0);
    expect(day.is_presencial).toBe(true);
    expect(day.presencial_time_from).toBe('08:00');
  });

  test('mockUpsertCalendarDay sobre un día existente actualiza en el mismo lugar (mismo id) y reinstancia', async () => {
    const first = await mockUpsertCalendarDay(1, '2026-10-05', { kind: 'training', session_id: 1 });
    const second = await mockUpsertCalendarDay(1, '2026-10-05', { kind: 'training', session_id: 2 });
    expect(second.id).toBe(first.id);
    expect(second.session_instance.id).not.toBe(first.session_instance.id);
    expect(second.session_instance.name).toBe('Series de velocidad');
  });

  test('mockUpsertCalendarDay a cancelled sin session_id en el payload preserva la instancia existente', async () => {
    await mockUpsertCalendarDay(1, '2026-10-05', { kind: 'training', session_id: 1 });
    const cancelled = await mockUpsertCalendarDay(1, '2026-10-05', { kind: 'cancelled', cancelled_reason: 'Lluvia' });
    expect(cancelled.kind).toBe('cancelled');
    expect(cancelled.session_instance).not.toBeNull();
    expect(cancelled.session_instance.name).toBe('Fondo suave');
    expect(cancelled.cancelled_reason).toBe('Lluvia');
  });

  test('mockUpsertCalendarDay con kind=rest no tiene session_instance', async () => {
    const day = await mockUpsertCalendarDay(1, '2026-10-05', { kind: 'rest' });
    expect(day.session_instance).toBeNull();
  });

  test('mockDeleteCalendarDay borra la fila', async () => {
    await mockUpsertCalendarDay(1, '2026-10-05', { kind: 'rest' });
    await mockDeleteCalendarDay(1, '2026-10-05');
    expect(await mockGetGroupCalendar(1, '2026-10-01', '2026-10-31')).toEqual([]);
  });
});
