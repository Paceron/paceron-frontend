import { create } from 'zustand';

// Un solo valor alcanza -- mismo criterio que calendar-tab-store.js: la
// pantalla de detalle de un equipo se remonta al navegar fuera y volver
// (vía un corredor en el roster, al calendario de un grupo, etc.), lo que
// perdía la pestaña seleccionada (useState normal). Sin persist a
// propósito -- sobrevive nav dentro de la app, no un cold-start.
export const useTeamDetailTabStore = create((set) => ({
  activeTab: 'general',
  setActiveTab: (activeTab) => set({ activeTab }),
}));
