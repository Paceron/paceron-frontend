import {
  mockListTrainingPlans, mockGetTrainingPlan, mockCreateTrainingPlan, mockUpdateTrainingPlan,
  mockDeleteTrainingPlan, mockCloneTrainingPlan, mockListRunnerPlanAssignments, mockAssignPlanToRunner,
  mockUnassignPlanFromRunner, validatePlanDays, __resetMockTrainingPlans,
} from '../services/__mocks__/training-plans-mock.js';

function buildValidDays() {
  const daysOfWeek = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
  return daysOfWeek.map((day_of_week, i) => ({ sequence_no: i + 1, day_of_week, kind: 'rest', other_name: null, session_id: null }));
}

beforeEach(() => {
  __resetMockTrainingPlans();
});

describe('training-plans-mock', () => {
  test('mockListTrainingPlans devuelve el plan sembrado, filtrable por owner_id', async () => {
    const all = await mockListTrainingPlans();
    expect(all.length).toBeGreaterThan(0);
    const forOwner1 = await mockListTrainingPlans({ ownerId: 1 });
    expect(forOwner1.every((p) => p.owner_id === 1)).toBe(true);
    const forUnknownOwner = await mockListTrainingPlans({ ownerId: 999 });
    expect(forUnknownOwner).toEqual([]);
  });

  test('mockGetTrainingPlan devuelve el plan por id, tira 404-like para un id desconocido', async () => {
    const plan = await mockGetTrainingPlan(1);
    expect(plan.id).toBe(1);
    await expect(mockGetTrainingPlan(9999)).rejects.toThrow('Plan de entrenamiento no encontrado.');
  });

  test('validatePlanDays exige exactamente 7 días, secuencia 1..7 y los 7 días de la semana sin repetir', () => {
    expect(() => validatePlanDays(buildValidDays())).not.toThrow();
    expect(() => validatePlanDays(buildValidDays().slice(0, 6))).toThrow('exactamente 7 días');

    const dupSequence = buildValidDays();
    dupSequence[1].sequence_no = 1;
    expect(() => validatePlanDays(dupSequence)).toThrow();

    const dupDay = buildValidDays();
    dupDay[1].day_of_week = 'monday';
    expect(() => validatePlanDays(dupDay)).toThrow();
  });

  test('validatePlanDays exige session_id en los días de entrenamiento y other_name en los de otra actividad', () => {
    const trainingWithoutSession = buildValidDays();
    trainingWithoutSession[0].kind = 'training';
    expect(() => validatePlanDays(trainingWithoutSession)).toThrow('sesión para cada día de entrenamiento');

    const trainingWithSession = buildValidDays();
    trainingWithSession[0].kind = 'training';
    trainingWithSession[0].session_id = 1;
    expect(() => validatePlanDays(trainingWithSession)).not.toThrow();

    const otherWithoutName = buildValidDays();
    otherWithoutName[0].kind = 'other';
    expect(() => validatePlanDays(otherWithoutName)).toThrow('otra actividad');

    const otherWithName = buildValidDays();
    otherWithName[0].kind = 'other';
    otherWithName[0].other_name = 'Natación';
    expect(() => validatePlanDays(otherWithName)).not.toThrow();
  });

  test('mockCreateTrainingPlan agrega un plan nuevo con id incremental', async () => {
    const before = await mockListTrainingPlans();
    const created = await mockCreateTrainingPlan({ owner_id: 5, name: 'Plan nuevo', description: null, duration_days: 14, days: buildValidDays() });
    const after = await mockListTrainingPlans();
    expect(after.length).toBe(before.length + 1);
    expect(created.name).toBe('Plan nuevo');
    expect(created.duration_days).toBe(14);
  });

  test('mockCreateTrainingPlan rechaza días inválidos', async () => {
    await expect(mockCreateTrainingPlan({ owner_id: 5, name: 'X', duration_days: 7, days: [] })).rejects.toThrow();
  });

  test('mockUpdateTrainingPlan mergea los campos dados', async () => {
    const updated = await mockUpdateTrainingPlan(1, { name: 'Nombre nuevo' });
    expect(updated.name).toBe('Nombre nuevo');
    expect((await mockGetTrainingPlan(1)).name).toBe('Nombre nuevo');
  });

  test('mockCloneTrainingPlan copia los 7 días con un id nuevo y sufijo "(copia)", sin mutar el original', async () => {
    const original = await mockGetTrainingPlan(1);
    const clone = await mockCloneTrainingPlan(1);

    expect(clone.id).not.toBe(original.id);
    expect(clone.name).toBe(`${original.name} (copia)`);
    expect(clone.days).toEqual(original.days);

    // Deep copy real, no la misma referencia — mutar el clon no toca el original.
    clone.days[0].kind = 'rest';
    const originalAfter = await mockGetTrainingPlan(1);
    expect(originalAfter.days[0].kind).not.toBe('rest');
  });

  test('mockDeleteTrainingPlan saca el plan y sus asignaciones individuales', async () => {
    await mockAssignPlanToRunner(1, 42);
    await mockDeleteTrainingPlan(1);

    await expect(mockGetTrainingPlan(1)).rejects.toThrow();
    expect(await mockListRunnerPlanAssignments({ planId: 1 })).toEqual([]);
  });

  test('mockAssignPlanToRunner reemplaza cualquier asignación individual previa del mismo corredor', async () => {
    const clone = await mockCloneTrainingPlan(1);
    await mockAssignPlanToRunner(1, 42);
    await mockAssignPlanToRunner(clone.id, 42);

    const assignments = await mockListRunnerPlanAssignments({ userId: 42 });
    expect(assignments).toHaveLength(1);
    expect(assignments[0].plan_id).toBe(clone.id);
  });

  test('mockAssignPlanToRunner tira si el plan no existe', async () => {
    await expect(mockAssignPlanToRunner(9999, 42)).rejects.toThrow();
  });

  test('mockUnassignPlanFromRunner saca la asignación del corredor', async () => {
    await mockAssignPlanToRunner(1, 42);
    await mockUnassignPlanFromRunner(42);
    expect(await mockListRunnerPlanAssignments({ userId: 42 })).toEqual([]);
  });
});
