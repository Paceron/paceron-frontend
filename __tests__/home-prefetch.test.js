jest.mock('../hooks/use-user.js', () => ({
  userQueryOptions: (userId) => ({ queryKey: ['user', userId] }),
  permissionsQueryOptions: (userId) => ({ queryKey: ['permissions', userId] }),
}));
jest.mock('../hooks/use-aggregated-calendar.js', () => ({
  memberCalendarQueryOptions: (userId, from, to) => ({ queryKey: ['member-calendar', userId, from, to] }),
  administeredCalendarQueryOptions: (userId, from, to) => ({ queryKey: ['administered-calendar', userId, from, to] }),
}));
jest.mock('../hooks/use-runner-kpis.js', () => ({
  runnerKpisQueryOptions: ({ period, referenceDate, tab }) => ({ queryKey: ['runner-kpis', period, referenceDate, tab] }),
}));
jest.mock('../hooks/use-trainer-home-kpis.js', () => ({
  trainerHomeKpisQueryOptions: ({ userId, period, referenceDate }) => ({ queryKey: ['trainer-home-kpis', userId, period, referenceDate] }),
}));

// eslint-disable-next-line import/first -- mocks must be registered before the module under test.
import { buildHomePrefetchQueries, prefetchHomeCriticalQueries } from '../utils/home-prefetch.js';

describe('home-prefetch', () => {
  const now = new Date('2026-11-20T12:00:00-03:00');

  it('builds user, permissions, calendar and runner KPI queries', () => {
    const queries = buildHomePrefetchQueries({ userId: 7, role: 'runner', now });

    expect(queries.map((query) => query.queryKey)).toEqual([
      ['user', 7],
      ['permissions', 7],
      ['member-calendar', 7, '2026-11-20', '2027-02-18'],
      ['runner-kpis', 'month', '2026-11-20', 'general'],
    ]);
  });

  it('uses the administered calendar and trainer KPI for trainers', () => {
    const queries = buildHomePrefetchQueries({ userId: 7, role: 'trainer', now });

    expect(queries.map((query) => query.queryKey)).toEqual([
      ['user', 7],
      ['permissions', 7],
      ['administered-calendar', 7, '2026-11-20', '2027-02-18'],
      ['trainer-home-kpis', 7, 'month', '2026-11-20'],
    ]);
  });

  it('returns no queries without a user', () => {
    expect(buildHomePrefetchQueries({ userId: null, role: 'runner', now })).toEqual([]);
  });

  it('prefetches every query and never throws when one fails', async () => {
    const prefetchQuery = jest.fn()
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error('permissions failed'))
      .mockResolvedValue(undefined);
    const queryClient = { prefetchQuery };

    await expect(prefetchHomeCriticalQueries(queryClient, { userId: 7, role: 'runner', now }))
      .resolves.toBeUndefined();

    expect(prefetchQuery).toHaveBeenCalledTimes(4);
  });

  it('stops waiting after the timeout while the prefetch continues in background', async () => {
    const prefetchQuery = jest.fn(() => new Promise(() => {}));
    const queryClient = { prefetchQuery };

    await expect(prefetchHomeCriticalQueries(queryClient, {
      userId: 7,
      role: 'runner',
      now,
      timeoutMs: 5,
    })).resolves.toBeUndefined();

    expect(prefetchQuery).toHaveBeenCalledTimes(4);
  });
});
