// Arma dayCount días vacíos (todos "rest"), numerados 1..dayCount —
// punto de partida al crear un plan nuevo o al agregar/quitar días en
// el form. Sin día de la semana: el orden es puramente secuencial.
export function buildEmptyPlanDays(dayCount) {
  return Array.from({ length: dayCount }, (_, i) => ({
    sequenceNo: i + 1, kind: 'rest', otherName: null, sessionId: null,
    isPresencial: false, presencialTimeFrom: '', presencialTimeTo: '', presencialLocation: null,
  }));
}
