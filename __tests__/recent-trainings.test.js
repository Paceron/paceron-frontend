import { selectRecentFinishedTrainings } from '../utils/recent-trainings.js';

function makeSession(overrides = {}) {
  return { sessionInstanceId: '1', date: '2026-10-01', status: 'finished', ...overrides };
}

describe('selectRecentFinishedTrainings', () => {
  it('returns an empty array for no sessions', () => {
    expect(selectRecentFinishedTrainings([])).toEqual([]);
  });

  it('excludes sessions that are not finished, even if more recent', () => {
    const sessions = [
      makeSession({ sessionInstanceId: '1', date: '2026-09-01', status: 'finished' }),
      makeSession({ sessionInstanceId: '2', date: '2026-10-05', status: 'wip' }),
      makeSession({ sessionInstanceId: '3', date: '2026-10-04', status: 'interrupted' }),
      makeSession({ sessionInstanceId: '4', date: '2026-10-03', status: 'none' }),
    ];
    const result = selectRecentFinishedTrainings(sessions);
    expect(result.map((s) => s.sessionInstanceId)).toEqual(['1']);
  });

  it('sorts finished sessions by date descending', () => {
    const sessions = [
      makeSession({ sessionInstanceId: '1', date: '2026-09-01' }),
      makeSession({ sessionInstanceId: '2', date: '2026-10-05' }),
      makeSession({ sessionInstanceId: '3', date: '2026-09-20' }),
    ];
    const result = selectRecentFinishedTrainings(sessions);
    expect(result.map((s) => s.sessionInstanceId)).toEqual(['2', '3', '1']);
  });

  it('caps at the given limit, defaulting to 3', () => {
    const sessions = Array.from({ length: 5 }, (_, i) => makeSession({ sessionInstanceId: String(i), date: `2026-10-0${i + 1}` }));
    expect(selectRecentFinishedTrainings(sessions)).toHaveLength(3);
    expect(selectRecentFinishedTrainings(sessions, 2)).toHaveLength(2);
  });

  it('returns fewer than the limit without padding when not enough finished sessions exist', () => {
    const sessions = [makeSession({ sessionInstanceId: '1' })];
    expect(selectRecentFinishedTrainings(sessions)).toHaveLength(1);
  });

  it('keeps both sessions when two share the same date, without crashing', () => {
    const sessions = [
      makeSession({ sessionInstanceId: '1', date: '2026-10-01' }),
      makeSession({ sessionInstanceId: '2', date: '2026-10-01' }),
    ];
    expect(selectRecentFinishedTrainings(sessions)).toHaveLength(2);
  });
});
