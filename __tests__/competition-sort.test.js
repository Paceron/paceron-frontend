const { sortCompetitionsForPreview, sortCompetitionsForList } = require('../utils/competition-sort.js');

function comp(overrides) {
  return { id: '1', type: 'metric', status: 'active', startAt: '2026-01-01T00:00:00Z', endAt: null, ...overrides };
}

describe('sortCompetitionsForPreview', () => {
  test('metric competitions sorted by soonest endAt first', () => {
    const a = comp({ id: 'a', endAt: '2026-11-10T00:00:00Z' });
    const b = comp({ id: 'b', endAt: '2026-11-05T00:00:00Z' });
    const result = sortCompetitionsForPreview([a, b]);
    expect(result.map((c) => c.id)).toEqual(['b', 'a']);
  });

  test('route competitions (no endAt) come after metric, sorted by most recent startAt', () => {
    const metricOne = comp({ id: 'metric', endAt: '2026-11-10T00:00:00Z' });
    const routeOld = comp({ id: 'route-old', type: 'route', endAt: null, startAt: '2026-01-01T00:00:00Z' });
    const routeNew = comp({ id: 'route-new', type: 'route', endAt: null, startAt: '2026-10-01T00:00:00Z' });
    const result = sortCompetitionsForPreview([routeOld, metricOne, routeNew]);
    expect(result.map((c) => c.id)).toEqual(['metric', 'route-new', 'route-old']);
  });

  test('does not mutate the input array', () => {
    const list = [comp({ id: 'a', endAt: '2026-11-10T00:00:00Z' }), comp({ id: 'b', endAt: '2026-11-05T00:00:00Z' })];
    const copy = [...list];
    sortCompetitionsForPreview(list);
    expect(list).toEqual(copy);
  });
});

describe('sortCompetitionsForList', () => {
  test('active first, then pending_approval, then the rest', () => {
    const finished = comp({ id: 'finished', status: 'finished' });
    const active = comp({ id: 'active', status: 'active' });
    const pending = comp({ id: 'pending', status: 'pending_approval' });
    const rejected = comp({ id: 'rejected', status: 'rejected' });
    const result = sortCompetitionsForList([finished, pending, rejected, active]);
    expect(result.map((c) => c.id)).toEqual(['active', 'pending', 'finished', 'rejected']);
  });

  test('within the same status group, applies the same date criterion as the preview sort', () => {
    const activeSoon = comp({ id: 'soon', status: 'active', endAt: '2026-11-05T00:00:00Z' });
    const activeLater = comp({ id: 'later', status: 'active', endAt: '2026-11-10T00:00:00Z' });
    const result = sortCompetitionsForList([activeLater, activeSoon]);
    expect(result.map((c) => c.id)).toEqual(['soon', 'later']);
  });
});
