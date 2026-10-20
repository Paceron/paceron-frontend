import { deriveAttemptStatus } from '../utils/attempt-status.js';

describe('deriveAttemptStatus', () => {
  test('returns not_found when there is no runner session', () => {
    expect(deriveAttemptStatus({ runnerSession: null, feedbackList: [] })).toBe('not_found');
  });

  test('returns pending when a runner session exists but no feedback synced yet', () => {
    expect(deriveAttemptStatus({ runnerSession: { status: 'wip' }, feedbackList: [] })).toBe('pending');
  });

  test('returns synced when a runner session exists and feedback has synced', () => {
    expect(deriveAttemptStatus({ runnerSession: { status: 'finished' }, feedbackList: [{ id: '1' }] })).toBe('synced');
  });

  test('returns synced even if runner session is still wip, as long as feedback already synced', () => {
    expect(deriveAttemptStatus({ runnerSession: { status: 'wip' }, feedbackList: [{ id: '1' }] })).toBe('synced');
  });
});
