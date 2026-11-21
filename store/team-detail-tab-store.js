import { create } from 'zustand';

// La pestaña se recuerda por equipo -- un solo valor global la arrastraba
// de un equipo a otro (ej. abrir el equipo B en "grupos" porque ahí quedó
// el equipo A, aunque el usuario no pueda verla). Sin persist a propósito:
// sobrevive la navegación dentro de la app, no un cold-start.
export const useTeamDetailTabStore = create((set) => ({
  activeTeamId: null,
  activeTab: 'corredores',
  ensureTeam: (teamId) => set((state) => {
    if (String(state.activeTeamId) === String(teamId)) return state;
    return { activeTeamId: teamId ?? null, activeTab: 'corredores' };
  }),
  setActiveTab: (activeTab) => set({ activeTab }),
}));
