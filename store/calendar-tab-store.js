import { create } from 'zustand';

// Un solo valor alcanza -- administered-calendar-screen.jsx (entrenador) y
// my-calendar-screen.jsx (corredor) nunca están montadas a la vez (dependen
// del rol activo), así que comparten la misma clave sin colisión. Sin
// persist a propósito (mismo criterio que live-session-store.js): sobrevive
// nav dentro de la app (ir al detalle de una sesión y volver), no un
// cold-start -- eso ya sería más sorpresa que ayuda.
export const useCalendarTabStore = create((set) => ({
  activeTab: 'calendario',
  setActiveTab: (activeTab) => set({ activeTab }),
}));
