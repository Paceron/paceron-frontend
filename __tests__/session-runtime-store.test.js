import { useSessionRuntimeStore } from '../store/session-runtime-store.js';

describe('session-runtime-store', () => {
  afterEach(() => {
    useSessionRuntimeStore.getState().clearPendingSession();
  });

  test('arranca en null', () => {
    expect(useSessionRuntimeStore.getState().pendingSession).toBeNull();
  });

  test('setPendingSession guarda el día elegido', () => {
    const day = { id: '1', date: '2026-10-15', kind: 'training' };
    useSessionRuntimeStore.getState().setPendingSession(day);
    expect(useSessionRuntimeStore.getState().pendingSession).toEqual(day);
  });

  test('clearPendingSession lo vacía', () => {
    useSessionRuntimeStore.getState().setPendingSession({ id: '1' });
    useSessionRuntimeStore.getState().clearPendingSession();
    expect(useSessionRuntimeStore.getState().pendingSession).toBeNull();
  });
});
