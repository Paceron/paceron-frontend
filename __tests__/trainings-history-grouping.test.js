import { groupHistoryItemsBySession } from '../utils/trainings-history-grouping.js';

function makeItem(overrides = {}) {
  return {
    id: '1',
    sessionInstanceId: '100',
    athleteUserId: '5',
    athleteName: 'Juan',
    date: '2026-10-01',
    sessionName: 'Fondo',
    teamId: '1',
    teamName: 'Team A',
    groupId: '2',
    groupName: 'Group B',
    exerciseId: '10',
    exerciseName: 'Sentadillas',
    setNumber: 1,
    completionStatus: 'completed',
    ...overrides,
  };
}

describe('groupHistoryItemsBySession', () => {
  it('returns an empty array for no items', () => {
    expect(groupHistoryItemsBySession([])).toEqual([]);
  });

  it('groups rows by sessionInstanceId+athleteUserId, keeping underlying item ids', () => {
    const items = [
      makeItem({ id: '1', setNumber: 1, completionStatus: 'completed' }),
      makeItem({ id: '2', setNumber: 2, completionStatus: 'skipped' }),
    ];
    const groups = groupHistoryItemsBySession(items);
    expect(groups).toHaveLength(1);
    expect(groups[0]).toMatchObject({
      id: '100:5',
      sessionInstanceId: '100',
      athleteUserId: '5',
      itemIds: ['1', '2'],
      totalCount: 2,
      completedCount: 1,
      skippedCount: 1,
    });
  });

  it('keeps different athletes of the same session as separate groups', () => {
    const items = [
      makeItem({ id: '1', athleteUserId: '5' }),
      makeItem({ id: '2', athleteUserId: '6' }),
    ];
    const groups = groupHistoryItemsBySession(items);
    expect(groups.map((g) => g.id)).toEqual(['100:5', '100:6']);
  });

  it('preserves the order sessions first appear in the input', () => {
    const items = [
      makeItem({ id: '1', sessionInstanceId: '200' }),
      makeItem({ id: '2', sessionInstanceId: '100' }),
      makeItem({ id: '3', sessionInstanceId: '200' }),
    ];
    const groups = groupHistoryItemsBySession(items);
    expect(groups.map((g) => g.sessionInstanceId)).toEqual(['200', '100']);
  });

  it('counts a status other than completed/skipped in totalCount only', () => {
    const items = [makeItem({ id: '1', completionStatus: 'unregistered' })];
    const groups = groupHistoryItemsBySession(items);
    expect(groups[0]).toMatchObject({ totalCount: 1, completedCount: 0, skippedCount: 0 });
  });
});
