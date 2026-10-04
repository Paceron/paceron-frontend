import { create } from 'zustand';

// team-search-screen.jsx remonta al volver del detalle de un equipo (mismo
// mecanismo que trainings-history-filters-store.js) -- sin esto, la
// búsqueda (nombre + nivel + país/provincia/localidad) y sus resultados se
// perdían al volver. `searched` es la señal de "hubo una búsqueda" para
// volver a dispararla sola al remontar (ver effect en el screen) -- los
// RESULTADOS en sí no se persisten acá, se piden de nuevo para que vuelvan
// frescos, no un snapshot viejo.
export const useTeamSearchStore = create((set) => ({
  name: '',
  level: '',
  country: '',
  province: '',
  city: '',
  searched: false,
  setName: (name) => set({ name }),
  setLevel: (level) => set({ level }),
  setAddress: (partial) => set(partial),
  setSearched: (searched) => set({ searched }),
}));
