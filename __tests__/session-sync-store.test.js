import { useSessionSyncStore } from '../store/session-sync-store.js';

describe('session-sync-store', () => {
  afterEach(() => {
    useSessionSyncStore.getState().clearAll();
  });

  test('arranca sin sesiones sincronizando', () => {
    expect(useSessionSyncStore.getState().syncingBySessionId).toEqual({});
  });

  test('startSync marca la sesión y finishSync la limpia', () => {
    useSessionSyncStore.getState().startSync(12);
    expect(useSessionSyncStore.getState().syncingBySessionId).toEqual({ 12: true });

    useSessionSyncStore.getState().finishSync(12);
    expect(useSessionSyncStore.getState().syncingBySessionId).toEqual({});
  });

  test('normaliza el id a string y mantiene sesiones independientes', () => {
    useSessionSyncStore.getState().startSync(12);
    useSessionSyncStore.getState().startSync('13');

    expect(useSessionSyncStore.getState().syncingBySessionId).toEqual({ 12: true, 13: true });

    useSessionSyncStore.getState().finishSync('12');
    expect(useSessionSyncStore.getState().syncingBySessionId).toEqual({ 13: true });
  });

  test('ignora ids nulos o indefinidos', () => {
    useSessionSyncStore.getState().startSync(null);
    useSessionSyncStore.getState().startSync(undefined);
    useSessionSyncStore.getState().finishSync(null);

    expect(useSessionSyncStore.getState().syncingBySessionId).toEqual({});
  });

  test('clearAll vacía todas las sesiones', () => {
    useSessionSyncStore.getState().startSync(1);
    useSessionSyncStore.getState().startSync(2);
    useSessionSyncStore.getState().clearAll();

    expect(useSessionSyncStore.getState().syncingBySessionId).toEqual({});
  });
});
