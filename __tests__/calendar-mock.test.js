import {
  mockGetGroupCalendar, mockUpsertCalendarDay, mockDeleteCalendarDay, mockStampPlan,
  mockBulkAssignDays, mockBulkClearDays, __resetMockCalendar,
} from '../services/__mocks__/calendar-mock.js';
import { __resetMockSessions } from '../services/__mocks__/sessions-mock.js';
import { mockCreateTrainingPlan, __resetMockTrainingPlans } from '../services/__mocks__/training-plans-mock.js';

beforeEach(() => {
  __resetMockCalendar();
  __resetMockSessions();
  __resetMockTrainingPlans();
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

  test('mockUpsertCalendarDay con kind=training y session_id omitido conserva la instancia actual (Gap 7)', async () => {
    const first = await mockUpsertCalendarDay(1, '2026-10-05', { kind: 'training', session_id: 1 });
    const second = await mockUpsertCalendarDay(1, '2026-10-05', { kind: 'training', is_presencial: true, presencial_time_from: '08:00', presencial_time_to: '09:00', presencial_location: { lat: 1, lng: 2 } });
    expect(second.session_instance.id).toBe(first.session_instance.id);
    expect(second.session_instance.name).toBe('Fondo suave');
    expect(second.is_presencial).toBe(true);
  });

  test('instantiateSession vía mockUpsertCalendarDay guarda session_id/exercise_id de origen (Gap 7)', async () => {
    const day = await mockUpsertCalendarDay(1, '2026-10-05', { kind: 'training', session_id: 1 });
    expect(day.session_instance.session_id).toBe(1);
    expect(day.session_instance.exercises[0].exercise_id).toEqual(expect.any(Number));
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

describe('mockStampPlan', () => {
  test('crea un GroupCalendarDay por cada día del plan, con fechas correlativas', async () => {
    const plan = await mockCreateTrainingPlan({
      owner_id: 1, name: 'Plan test', description: '',
      days: [
        { sequence_no: 1, kind: 'training', other_name: null, session_id: 1, default_presencial: false, default_time_from: null, default_time_to: null },
        { sequence_no: 2, kind: 'rest', other_name: null, session_id: null, default_presencial: false, default_time_from: null, default_time_to: null },
      ],
    });
    const result = await mockStampPlan(1, { plan_id: plan.id, start_date: '2026-10-05', force: false });
    expect(result.conflict).toBe(false);
    expect(result.days).toHaveLength(2);
    expect(result.days.map((d) => d.date)).toEqual(['2026-10-05', '2026-10-06']);
    expect(result.days[0].session_instance.name).toBe('Fondo suave');
    expect(result.days[0].source_plan_id).toBe(plan.id);
  });

  test('copia default_presencial/default_time_from/default_time_to/default_location a is_presencial/presencial_time_from/presencial_time_to/presencial_location', async () => {
    const plan = await mockCreateTrainingPlan({
      owner_id: 1, name: 'Plan presencial', description: '',
      days: [
        { sequence_no: 1, kind: 'training', other_name: null, session_id: 1, default_presencial: true, default_time_from: '08:00', default_time_to: '09:30', default_location: { lat: -34.6, lng: -58.4, label: 'Plaza' } },
        { sequence_no: 2, kind: 'rest', other_name: null, session_id: null, default_presencial: false, default_time_from: null, default_time_to: null, default_location: null },
      ],
    });
    const result = await mockStampPlan(1, { plan_id: plan.id, start_date: '2026-10-05', force: false });
    expect(result.days[0].is_presencial).toBe(true);
    expect(result.days[0].presencial_time_from).toBe('08:00');
    expect(result.days[0].presencial_time_to).toBe('09:30');
    expect(result.days[0].presencial_location).toEqual({ lat: -34.6, lng: -58.4, label: 'Plaza' });
  });

  test('si algún día del rango ya tiene contenido y force no es true, devuelve conflicto sin escribir nada', async () => {
    await mockUpsertCalendarDay(1, '2026-10-06', { kind: 'rest' });
    const plan = await mockCreateTrainingPlan({
      owner_id: 1, name: 'Plan test', description: '',
      days: [
        { sequence_no: 1, kind: 'rest', other_name: null, session_id: null },
        { sequence_no: 2, kind: 'rest', other_name: null, session_id: null },
      ],
    });
    const result = await mockStampPlan(1, { plan_id: plan.id, start_date: '2026-10-05', force: false });
    expect(result.conflict).toBe(true);
    expect(result.dates).toEqual(['2026-10-06']);
    expect(await mockGetGroupCalendar(1, '2026-10-05', '2026-10-06')).toHaveLength(1); // solo el que ya existía
  });

  test('con force=true, pisa los días en conflicto', async () => {
    await mockUpsertCalendarDay(1, '2026-10-06', { kind: 'rest' });
    const plan = await mockCreateTrainingPlan({
      owner_id: 1, name: 'Plan test', description: '',
      days: [
        { sequence_no: 1, kind: 'rest', other_name: null, session_id: null },
        { sequence_no: 2, kind: 'other', other_name: 'Pisado', session_id: null },
      ],
    });
    const result = await mockStampPlan(1, { plan_id: plan.id, start_date: '2026-10-05', force: true });
    expect(result.conflict).toBe(false);
    expect(result.days[1].other_name).toBe('Pisado');
  });

  test('exclude_dates (Gap 8) salta esas fechas por completo, sin contarlas para el conflicto', async () => {
    await mockUpsertCalendarDay(1, '2026-10-06', { kind: 'other', other_name: 'Original' });
    const plan = await mockCreateTrainingPlan({
      owner_id: 1, name: 'Plan test', description: '',
      days: [
        { sequence_no: 1, kind: 'rest', other_name: null, session_id: null },
        { sequence_no: 2, kind: 'other', other_name: 'Nuevo', session_id: null },
      ],
    });
    const result = await mockStampPlan(1, { plan_id: plan.id, start_date: '2026-10-05', force: false, exclude_dates: ['2026-10-06'] });
    expect(result.conflict).toBe(false);
    expect(result.days).toHaveLength(1);
    expect(result.days[0].date).toBe('2026-10-05');
    const untouched = await mockGetGroupCalendar(1, '2026-10-06', '2026-10-06');
    expect(untouched[0].other_name).toBe('Original');
  });
});

describe('mockBulkAssignDays', () => {
  test('aplica el mismo contenido a todas las fechas listadas', async () => {
    const result = await mockBulkAssignDays(1, { dates: ['2026-10-05', '2026-10-06'], kind: 'rest' });
    expect(result).toHaveLength(2);
    expect(result.every((d) => d.kind === 'rest')).toBe(true);
    expect(await mockGetGroupCalendar(1, '2026-10-01', '2026-10-31')).toHaveLength(2);
  });

  test('con kind=training instancia la sesión en cada fecha', async () => {
    const result = await mockBulkAssignDays(1, { dates: ['2026-10-05', '2026-10-06'], kind: 'training', session_id: 1 });
    expect(result.every((d) => d.session_instance?.name === 'Fondo suave')).toBe(true);
  });
});

describe('mockBulkClearDays', () => {
  test('borra todas las fechas listadas', async () => {
    await mockUpsertCalendarDay(1, '2026-10-05', { kind: 'rest' });
    await mockUpsertCalendarDay(1, '2026-10-06', { kind: 'rest' });
    await mockBulkClearDays(1, ['2026-10-05', '2026-10-06']);
    expect(await mockGetGroupCalendar(1, '2026-10-01', '2026-10-31')).toEqual([]);
  });
});
