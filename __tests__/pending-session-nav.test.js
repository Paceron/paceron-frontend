import { buildPendingSessionNavParams, pendingSessionFromNavParams } from '../utils/pending-session-nav.js';

describe('buildPendingSessionNavParams', () => {
  it('returns empty object for no pendingSession', () => {
    expect(buildPendingSessionNavParams(null)).toEqual({});
  });

  it('builds params from a full pendingSession, including presencial location and window', () => {
    const pendingSession = {
      sessionInstance: { id: '42', name: 'Fondo' },
      teamId: '7',
      groupId: '9',
      date: '2026-10-05',
      teamName: 'Team A',
      groupName: 'Group B',
      isPresencial: true,
      presencialTimeFrom: '18:00',
      presencialTimeTo: '19:00',
      presencialLocation: { lat: -34.6, lng: -58.4, label: 'Parque' },
    };
    expect(buildPendingSessionNavParams(pendingSession)).toEqual({
      sessionInstanceId: '42',
      teamId: '7',
      groupId: '9',
      date: '2026-10-05',
      teamName: 'Team A',
      groupName: 'Group B',
      sessionName: 'Fondo',
      isPresencial: 'true',
      presencialTimeFrom: '18:00',
      presencialTimeTo: '19:00',
      presencialLat: '-34.6',
      presencialLng: '-58.4',
      presencialLabel: 'Parque',
    });
  });

  it('omits undefined fields instead of passing them through', () => {
    const pendingSession = { sessionInstance: { id: '1' } };
    const params = buildPendingSessionNavParams(pendingSession);
    expect(params).toEqual({ sessionInstanceId: '1' });
    expect('teamName' in params).toBe(false);
  });

  it('omits the location label when the location has none', () => {
    const pendingSession = { sessionInstance: { id: '1' }, presencialLocation: { lat: 1, lng: 2, label: null } };
    const params = buildPendingSessionNavParams(pendingSession);
    expect(params.presencialLat).toBe('1');
    expect('presencialLabel' in params).toBe(false);
  });
});

describe('pendingSessionFromNavParams', () => {
  it('returns null without a sessionInstanceId', () => {
    expect(pendingSessionFromNavParams({}, null)).toBeNull();
  });

  it('rebuilds a pendingSession-shaped object from params alone (fetch still pending)', () => {
    const params = { sessionInstanceId: '42', teamId: '7', groupId: '9', date: '2026-10-05', teamName: 'Team A', groupName: 'Group B', sessionName: 'Fondo', isPresencial: 'true', presencialTimeFrom: '18:00', presencialTimeTo: '19:00' };
    const result = pendingSessionFromNavParams(params, null);
    expect(result).toEqual({
      sessionInstance: { id: '42', name: 'Fondo', exercises: [] },
      teamId: '7',
      groupId: '9',
      date: '2026-10-05',
      teamName: 'Team A',
      groupName: 'Group B',
      isPresencial: true,
      presencialTimeFrom: '18:00',
      presencialTimeTo: '19:00',
      presencialLocation: null,
    });
  });

  it('defaults isPresencial/window fields to falsy when absent from params', () => {
    const result = pendingSessionFromNavParams({ sessionInstanceId: '1' }, null);
    expect(result.isPresencial).toBe(false);
    expect(result.presencialTimeFrom).toBeNull();
    expect(result.presencialTimeTo).toBeNull();
  });

  it('prefers the fetched session instance name/exercises once available', () => {
    const params = { sessionInstanceId: '42', sessionName: 'Fondo (desde URL)' };
    const fetched = { name: 'Fondo', exercises: [{ id: '1', name: 'Sentadillas' }] };
    const result = pendingSessionFromNavParams(params, fetched);
    expect(result.sessionInstance).toEqual({ id: '42', name: 'Fondo', exercises: fetched.exercises });
  });

  it('rebuilds the presencial location when present', () => {
    const params = { sessionInstanceId: '42', presencialLat: '-34.6', presencialLng: '-58.4', presencialLabel: 'Parque' };
    const result = pendingSessionFromNavParams(params, null);
    expect(result.presencialLocation).toEqual({ lat: -34.6, lng: -58.4, label: 'Parque' });
  });
});
