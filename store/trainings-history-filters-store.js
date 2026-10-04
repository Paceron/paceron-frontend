import { create } from 'zustand';

// trainings-history-tab.jsx remonta al volver de /training-session-review
// (mismo mecanismo que perdía la pestaña activa, ver calendar-tab-store.js)
// -- sin esto, cada filtro elegido (equipo, grupo, rango de fechas,
// ejercicio, corredor, orden) se perdía al volver del detalle de una
// sesión, aunque los RESULTADOS en sí sobreviven solos vía el cache de
// TanStack Query una vez que los filtros (la query key) vuelven a ser los
// mismos. Un solo store para corredor y entrenador -- nunca están montados
// los dos a la vez (dependen del rol activo).
export const useTrainingsHistoryFiltersStore = create((set) => ({
  teamId: '',
  groupId: '',
  dateFromInput: '',
  dateToInput: '',
  order: 'desc',
  exerciseId: '',
  athleteId: '',
  setTeamId: (teamId) => set({ teamId, groupId: '' }),
  setGroupId: (groupId) => set({ groupId }),
  setDateFromInput: (dateFromInput) => set({ dateFromInput }),
  setDateToInput: (dateToInput) => set({ dateToInput }),
  setOrder: (order) => set({ order }),
  setExerciseId: (exerciseId) => set({ exerciseId }),
  setAthleteId: (athleteId) => set({ athleteId }),
  clearFilters: () => set({ teamId: '', groupId: '', dateFromInput: '', dateToInput: '', exerciseId: '', athleteId: '' }),
}));
