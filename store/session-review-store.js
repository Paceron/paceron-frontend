import { create } from 'zustand';

// Slot transitorio de la pantalla de revisión ("Registro de Sesión"), mismo
// patrón que session-runtime-store: se llena antes de navegar y no sobrevive
// un cold-start. El `sessionInstance` con su shape completo (ejercicios +
// feedback) se normaliza en el punto de entrada o en la pantalla al cargar;
// acá solo vive la referencia mínima para el header y la consulta.
//
// mode: 'review' (sesión completada — datos cargados) | 'manual' (fecha
// pasada sin completar — editor vacío).
export const useSessionReviewStore = create((set) => ({
  reviewSlot: null,
  setReviewSlot: (slot) => set({ reviewSlot: slot }),
  clearReviewSlot: () => set({ reviewSlot: null }),
}));