const { filterCompetitionsByFields, splitByLifecycle } = require('../utils/competition-filters.js');

function comp(overrides) {
  return { id: '1', teamId: '1', type: 'metric', status: 'active', startAt: '2026-11-01T00:00:00Z', endAt: '2026-11-10T00:00:00Z', ...overrides };
}

describe('filterCompetitionsByFields', () => {
  test('no filters -> returns everything unchanged', () => {
    const list = [comp({ id: 'a' }), comp({ id: 'b' })];
    expect(filterCompetitionsByFields(list, {})).toEqual(list);
  });

  test('filters by teamId', () => {
    const list = [comp({ id: 'a', teamId: '1' }), comp({ id: 'b', teamId: '2' })];
    expect(filterCompetitionsByFields(list, { teamId: '2' }).map((c) => c.id)).toEqual(['b']);
  });

  test('filters by type', () => {
    const list = [comp({ id: 'a', type: 'metric' }), comp({ id: 'b', type: 'route' })];
    expect(filterCompetitionsByFields(list, { type: 'route' }).map((c) => c.id)).toEqual(['b']);
  });

  test('filters by date range -- startAt within [from, to]', () => {
    const list = [
      comp({ id: 'early', startAt: '2026-10-01T00:00:00Z' }),
      comp({ id: 'inside', startAt: '2026-11-05T00:00:00Z' }),
      comp({ id: 'late', startAt: '2026-12-01T00:00:00Z' }),
    ];
    const result = filterCompetitionsByFields(list, { from: '2026-11-01T00:00:00Z', to: '2026-11-30T00:00:00Z' });
    expect(result.map((c) => c.id)).toEqual(['inside']);
  });

  test('only "from" given -- keeps startAt >= from', () => {
    const list = [comp({ id: 'a', startAt: '2026-10-01T00:00:00Z' }), comp({ id: 'b', startAt: '2026-11-05T00:00:00Z' })];
    expect(filterCompetitionsByFields(list, { from: '2026-11-01T00:00:00Z' }).map((c) => c.id)).toEqual(['b']);
  });

  test('only "to" given -- keeps startAt <= to', () => {
    const list = [comp({ id: 'a', startAt: '2026-10-01T00:00:00Z' }), comp({ id: 'b', startAt: '2026-11-05T00:00:00Z' })];
    expect(filterCompetitionsByFields(list, { to: '2026-10-31T00:00:00Z' }).map((c) => c.id)).toEqual(['a']);
  });

  test('empty-string fields are treated as "no filter", not as a literal match', () => {
    const list = [comp({ id: 'a', teamId: '1' })];
    expect(filterCompetitionsByFields(list, { teamId: '', type: '', from: '', to: '' })).toEqual(list);
  });

  test('does not mutate the input array', () => {
    const list = [comp({ id: 'a' }), comp({ id: 'b', type: 'route' })];
    const copy = [...list];
    filterCompetitionsByFields(list, { type: 'metric' });
    expect(list).toEqual(copy);
  });
});

describe('splitByLifecycle', () => {
  test('active and pending_approval go to "active"; finished and rejected go to "history"', () => {
    const list = [
      comp({ id: 'a', status: 'active' }),
      comp({ id: 'b', status: 'pending_approval' }),
      comp({ id: 'c', status: 'finished' }),
      comp({ id: 'd', status: 'rejected' }),
    ];
    const { active, history } = splitByLifecycle(list);
    expect(active.map((c) => c.id).sort()).toEqual(['a', 'b']);
    expect(history.map((c) => c.id).sort()).toEqual(['c', 'd']);
  });

  test('empty input -> both groups empty', () => {
    expect(splitByLifecycle([])).toEqual({ active: [], history: [] });
  });
});
