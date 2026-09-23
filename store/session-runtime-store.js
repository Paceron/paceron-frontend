import { create } from 'zustand';

// Slot transitorio, sin persist — no sobrevive un cold-start (ver
// docs/superpowers/specs/2026-09-23-live-session-base-design.md).
export const useSessionRuntimeStore = create((set) => ({
  pendingSession: null,
  setPendingSession: (day) => set({ pendingSession: day }),
  clearPendingSession: () => set({ pendingSession: null }),
}));
