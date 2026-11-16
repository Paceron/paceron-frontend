import { buildFinishedSessionReviewSlot, buildReviewSlotNavParams, reviewSlotFromNavParams } from '../utils/review-slot-nav.js';

describe('buildReviewSlotNavParams', () => {
  it('returns empty object for no reviewSlot', () => {
    expect(buildReviewSlotNavParams(null)).toEqual({});
  });

  it('builds params from a full reviewSlot', () => {
    const reviewSlot = {
      sessionInstance: { id: '42', name: 'Fondo' },
      date: '2026-10-05',
      role: 'trainer',
      athleteUserId: '9',
      mode: 'review',
      completionStatus: 'finished',
      teamId: '7',
      teamName: 'Team A',
      groupName: 'Group B',
    };
    expect(buildReviewSlotNavParams(reviewSlot)).toEqual({
      sessionInstanceId: '42',
      date: '2026-10-05',
      sessionName: 'Fondo',
      role: 'trainer',
      athleteUserId: '9',
      mode: 'review',
      completionStatus: 'finished',
      teamId: '7',
      teamName: 'Team A',
      groupName: 'Group B',
    });
  });

  it('prefers sessionInstanceId over sessionInstance.id when both are present', () => {
    const reviewSlot = { sessionInstanceId: '1', sessionInstance: { id: '2' } };
    expect(buildReviewSlotNavParams(reviewSlot).sessionInstanceId).toBe('1');
  });

  it('omits a null completionStatus instead of passing it through', () => {
    const reviewSlot = { sessionInstanceId: '1', completionStatus: null };
    const params = buildReviewSlotNavParams(reviewSlot);
    expect('completionStatus' in params).toBe(false);
  });
});

describe('buildFinishedSessionReviewSlot', () => {
  it('returns null without a run', () => {
    expect(buildFinishedSessionReviewSlot({ pendingSession: { teamId: '7' }, athleteUserId: '9' })).toBeNull();
  });

  it('returns null for a run without a session instance id', () => {
    expect(buildFinishedSessionReviewSlot({ run: { id: 3 } })).toBeNull();
  });

  it('builds a finished runner review slot from the run and pending session', () => {
    const run = { id: 3, session_instance_id: 42, session_date: '2026-11-16', session_name: 'Fondo' };
    const pendingSession = {
      sessionInstance: { id: 42, name: 'Fondo' },
      teamId: 7,
      teamName: 'Team A',
      groupName: 'Group B',
    };
    expect(buildFinishedSessionReviewSlot({ run, pendingSession, athleteUserId: '9' })).toEqual({
      sessionInstance: { id: 42, name: 'Fondo' },
      sessionInstanceId: 42,
      date: '2026-11-16',
      sessionName: 'Fondo',
      role: 'runner',
      athleteUserId: '9',
      mode: 'review',
      completionStatus: 'finished',
      teamId: 7,
      teamName: 'Team A',
      groupName: 'Group B',
    });
  });

  it('keeps team fields null when the pending session is gone', () => {
    const run = { session_instance_id: 42, session_date: '2026-11-16', session_name: 'Fondo' };
    expect(buildFinishedSessionReviewSlot({ run, athleteUserId: 9 })).toEqual({
      sessionInstance: null,
      sessionInstanceId: 42,
      date: '2026-11-16',
      sessionName: 'Fondo',
      role: 'runner',
      athleteUserId: 9,
      mode: 'review',
      completionStatus: 'finished',
      teamId: null,
      teamName: null,
      groupName: null,
    });
  });
});

describe('reviewSlotFromNavParams', () => {
  it('returns null without a sessionInstanceId', () => {
    expect(reviewSlotFromNavParams({})).toBeNull();
  });

  it('rebuilds a reviewSlot-shaped object, sessionInstance null so the screen self-fetches it', () => {
    const params = { sessionInstanceId: '42', date: '2026-10-05', sessionName: 'Fondo', role: 'trainer', athleteUserId: '9', mode: 'review', completionStatus: 'finished', teamId: '7', teamName: 'Team A', groupName: 'Group B' };
    expect(reviewSlotFromNavParams(params)).toEqual({
      sessionInstanceId: '42',
      sessionInstance: null,
      date: '2026-10-05',
      sessionName: 'Fondo',
      role: 'trainer',
      athleteUserId: '9',
      mode: 'review',
      completionStatus: 'finished',
      teamId: '7',
      teamName: 'Team A',
      groupName: 'Group B',
    });
  });

  it('defaults role to runner and mode to manual when absent', () => {
    const result = reviewSlotFromNavParams({ sessionInstanceId: '1' });
    expect(result.role).toBe('runner');
    expect(result.mode).toBe('manual');
    expect(result.completionStatus).toBeNull();
  });
});
