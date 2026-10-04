import { buildTrainerReviewNavParams, pendingSessionFromReviewParams } from '../utils/trainer-review-nav.js';

describe('buildTrainerReviewNavParams', () => {
  it('returns empty object for no pendingSession', () => {
    expect(buildTrainerReviewNavParams(null)).toEqual({});
  });

  it('builds params from a full pendingSession, including presencial location', () => {
    const pendingSession = {
      sessionInstance: { id: '42', name: 'Fondo' },
      teamId: '7',
      groupId: '9',
      date: '2026-10-05',
      teamName: 'Team A',
      groupName: 'Group B',
      presencialLocation: { lat: -34.6, lng: -58.4, label: 'Parque' },
    };
    expect(buildTrainerReviewNavParams(pendingSession)).toEqual({
      sessionInstanceId: '42',
      teamId: '7',
      groupId: '9',
      date: '2026-10-05',
      teamName: 'Team A',
      groupName: 'Group B',
      sessionName: 'Fondo',
      presencialLat: '-34.6',
      presencialLng: '-58.4',
      presencialLabel: 'Parque',
    });
  });

  it('omits undefined fields instead of passing them through', () => {
    const pendingSession = { sessionInstance: { id: '1' } };
    const params = buildTrainerReviewNavParams(pendingSession);
    expect(params).toEqual({ sessionInstanceId: '1' });
    expect('teamName' in params).toBe(false);
  });

  it('omits the location label when the location has none', () => {
    const pendingSession = { sessionInstance: { id: '1' }, presencialLocation: { lat: 1, lng: 2, label: null } };
    const params = buildTrainerReviewNavParams(pendingSession);
    expect(params.presencialLat).toBe('1');
    expect('presencialLabel' in params).toBe(false);
  });
});

describe('pendingSessionFromReviewParams', () => {
  it('returns null without a sessionInstanceId', () => {
    expect(pendingSessionFromReviewParams({}, null)).toBeNull();
  });

  it('rebuilds a pendingSession-shaped object from params alone (fetch still pending)', () => {
    const params = { sessionInstanceId: '42', teamId: '7', groupId: '9', date: '2026-10-05', teamName: 'Team A', groupName: 'Group B', sessionName: 'Fondo' };
    const result = pendingSessionFromReviewParams(params, null);
    expect(result).toEqual({
      sessionInstance: { id: '42', name: 'Fondo', exercises: [] },
      teamId: '7',
      groupId: '9',
      date: '2026-10-05',
      teamName: 'Team A',
      groupName: 'Group B',
      presencialLocation: null,
    });
  });

  it('prefers the fetched session instance name/exercises once available', () => {
    const params = { sessionInstanceId: '42', sessionName: 'Fondo (desde URL)' };
    const fetched = { name: 'Fondo', exercises: [{ id: '1', name: 'Sentadillas' }] };
    const result = pendingSessionFromReviewParams(params, fetched);
    expect(result.sessionInstance).toEqual({ id: '42', name: 'Fondo', exercises: fetched.exercises });
  });

  it('rebuilds the presencial location when present', () => {
    const params = { sessionInstanceId: '42', presencialLat: '-34.6', presencialLng: '-58.4', presencialLabel: 'Parque' };
    const result = pendingSessionFromReviewParams(params, null);
    expect(result.presencialLocation).toEqual({ lat: -34.6, lng: -58.4, label: 'Parque' });
  });
});
