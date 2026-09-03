import { create } from 'zustand';
import {
  listSessions as listSessionsService,
  createSession as createSessionService,
  updateSession as updateSessionService,
  deleteSession as deleteSessionService,
} from '../services/sessions.js';
import { toSessionModel, toCreateSessionPayload } from '../services/normalizers.js';

// Catálogo de sesiones del entrenador — ver enmienda 2026-08-26 de
// docs/superpowers/specs/2026-08-26-training-plans-design.md y el ABM
// completo de docs/superpowers/specs/2026-09-03-exercises-sessions-catalog-design.md
// (pestaña "Sesiones" en Planes de entrenamiento).
export const useSessionStore = create((set) => ({
  sessions: [],

  fetchSessions: async (ownerId) => {
    try {
      const dtos = await listSessionsService({ ownerId });
      set({ sessions: dtos.map(toSessionModel) });
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  },

  createSession: async (form) => {
    try {
      const created = await createSessionService(toCreateSessionPayload(form));
      const session = toSessionModel(created);
      set((state) => ({ sessions: [...state.sessions, session] }));
      return { success: true, session };
    } catch (error) {
      return { success: false, error: error.message };
    }
  },

  updateSession: async (sessionId, form) => {
    try {
      const updated = await updateSessionService(sessionId, toCreateSessionPayload(form));
      const session = toSessionModel(updated);
      set((state) => ({ sessions: state.sessions.map((s) => (s.id === sessionId ? session : s)) }));
      return { success: true, session };
    } catch (error) {
      return { success: false, error: error.message };
    }
  },

  deleteSession: async (sessionId) => {
    try {
      await deleteSessionService(sessionId);
      set((state) => ({ sessions: state.sessions.filter((s) => s.id !== sessionId) }));
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  },
}));
