import {
  __getMockTrainingsHistory,
  __resetTrainingsHistoryMock,
  mockDeleteWorkoutFeedback,
  mockGetAdministeredWorkoutFeedbackHistory,
  mockGetWorkoutFeedbackHistory,
} from '../services/__mocks__/trainings-history-mock.js';

describe('trainings history mock', () => {
  beforeEach(() => {
    __resetTrainingsHistoryMock();
  });

  test('returns only the runner history and paginates it', async () => {
    const firstPage = await mockGetWorkoutFeedbackHistory('1', { page: 1, pageSize: 2 });
    expect(firstPage.items).toHaveLength(2);
    expect(firstPage.total).toBe(4);
    expect(firstPage.items.every((item) => item.athlete_user_id === 1)).toBe(true);

    const secondPage = await mockGetWorkoutFeedbackHistory('1', { page: 2, pageSize: 2 });
    expect(secondPage.items).toHaveLength(2);
    expect(secondPage.items[0].id).not.toBe(firstPage.items[0].id);
  });

  test('applies date and athlete filters and exposes available options', async () => {
    const response = await mockGetAdministeredWorkoutFeedbackHistory('99', {
      athleteUserId: '101',
      dateFrom: '2026-11-11',
      dateTo: '2026-11-30',
    });

    expect(response.items).toHaveLength(1);
    expect(response.items[0].athlete_user_id).toBe(101);
    expect(response.available_athletes).toEqual([{ id: 101, name: 'Lucía Fernández' }]);
    expect(response.available_exercises.length).toBeGreaterThan(0);
  });

  test('deletes a feedback item from the history', async () => {
    const before = await mockGetWorkoutFeedbackHistory('1', {});
    await mockDeleteWorkoutFeedback(before.items[0].id);

    const after = await mockGetWorkoutFeedbackHistory('1', {});
    expect(after.total).toBe(before.total - 1);
    expect(after.items.some((item) => item.id === before.items[0].id)).toBe(false);
    expect(__getMockTrainingsHistory()).toHaveLength(after.total + 2);
  });
});
