import { create } from 'zustand';
import {
  listSessions as listSessionsService,
  createSession as createSessionService,
} from '../services/sessions.js';
import { toSessionModel, toCreateSessionPayload } from '../services/normalizers.js';

// Catálogo de sesiones del entrenador — ver enmienda 2026-08-26 de
// docs/superpowers/specs/2026-08-26-training-plans-design.md. Mismo
// alcance que exercise-store.js: solo list/create, el catálogo completo
// (editar/borrar sueltas) es "otro menú" a futuro.
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
}));
