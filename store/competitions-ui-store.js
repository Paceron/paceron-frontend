import { create } from 'zustand';

// Slot transitorio, mismo patrón que session-review-store/session-runtime-store:
// se llena antes de navegar y no sobrevive un cold-start. Pedido real
// 2026-10-23: "al volver [del detalle de intento]... se mantenga el modal
// abierto si corresponde" -- bug real confirmado en preview, `router.back()`
// en la versión web de Expo Router REMONTA `CompetitionsTab` desde cero (no
// mantiene la pantalla anterior viva como sí hace un stack nativo), así que
// cualquier `useState` local (cuál modal estaba abierto, qué atleta tenía
// seleccionado) se pierde sin este store -- necesita vivir afuera del
// componente para sobrevivir el remount.
//
// `reopenModal`: null | { type: 'ranking', competitionId } |
// { type: 'attempts', competitionId, athleteId }. Se escribe justo antes de
// navegar (en el onPress de la fila del modal correspondiente) y se lee/limpia
// una sola vez al montar CompetitionsTab -- ver su useEffect con guard.
export const useCompetitionsUiStore = create((set) => ({
  reopenModal: null,
  setReopenModal: (reopenModal) => set({ reopenModal }),
  clearReopenModal: () => set({ reopenModal: null }),
}));
