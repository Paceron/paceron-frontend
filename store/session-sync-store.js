import { create } from 'zustand';

export const useSessionSyncStore = create((set) => ({
  syncingBySessionId: {},
  startSync: (sessionInstanceId) => {
    if (sessionInstanceId == null) return;
    const key = String(sessionInstanceId);
    set((state) => ({ syncingBySessionId: { ...state.syncingBySessionId, [key]: true } }));
  },
  finishSync: (sessionInstanceId) => {
    if (sessionInstanceId == null) return;
    const key = String(sessionInstanceId);
    set((state) => {
      if (!state.syncingBySessionId[key]) return state;
      const next = { ...state.syncingBySessionId };
      delete next[key];
      return { syncingBySessionId: next };
    });
  },
  clearAll: () => set({ syncingBySessionId: {} }),
}));
