import { create } from 'zustand';

// Estado transitorio de la sesión en curso — la persistencia real vive en
// SQLite (services/session-db.js), acá solo el run activo y si el GPS está
// habilitado para esta sesión. No sobrevive un cold-start (mismo criterio que
// pendingSession en session-runtime-store.js).
export const useLiveSessionStore = create((set) => ({
  runId: null,
  gpsEnabled: false,
  setSessionStarted: (runId, gpsEnabled) => set({ runId, gpsEnabled: Boolean(gpsEnabled) }),
  setGpsEnabled: (gpsEnabled) => set({ gpsEnabled: Boolean(gpsEnabled) }),
  clearLiveSession: () => set({ runId: null, gpsEnabled: false }),
}));