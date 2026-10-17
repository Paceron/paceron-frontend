import { create } from 'zustand';

// Mismo criterio que team-detail-tab-store.js: el hub de gamificación se
// remonta al cruzar el breakpoint de ancho de ventana web (AppWebShell vs.
// AppWebShellNarrow son árboles de componentes distintos, cruzar el
// breakpoint remonta todo lo que cuelga de ahí) -- un useState normal
// perdía la pestaña seleccionada (bug real, 2026-10-14). Sin persist a
// propósito -- sobrevive nav/resize dentro de la app, no un cold-start.
export const useAchievementsTabStore = create((set) => ({
  activeTab: 'streaks',
  setActiveTab: (activeTab) => set({ activeTab }),
}));
