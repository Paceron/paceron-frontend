// Qué puede PEDIR cada rol a la API del dashboard, en un solo lugar.
//
// No es lo mismo que "qué se esconde en la UI": las dos variantes de la pantalla
// ya no son dos subárboles distintos (misma paleta, misma card de radar para los
// dos roles), así que lo único que cambia por rol son estas dos secciones — y son
// justo las dos que el backend restringe.
//
// Las dos preguntas parecen la misma y no lo son:
//   - el RANKING del equipo y la comparación ENTRE corredores son datos de otros;
//     para un corredor no aportan información (un ranking de una fila es ruido)
//     además de estar prohibidos por el backend (403 a quien no es dueño);
//   - la comparación del PERÍODO actual contra el anterior es dato propio de quien
//     pregunta (el scope ya viene recortado a sus series), pero el endpoint la
//     restringe a dueños del equipo igual. Está pedido como gap de backend
//     (`docs/BACKEND_API_GAPS.md`): cuando deje de ser owner-only, se prende con
//     `MEMBER_PERIOD_COMPARISON_ENABLED` y el corredor la ve sin tocar nada más.
export function canReadTeamRanking(activeRole) {
  return activeRole === 'trainer';
}

// La comparación A/B permite al entrenador elegir atletas de su scope y al
// corredor comparar únicamente su propio historial. El backend vuelve a validar
// ambos lados; este guard solo evita montar la sección para roles desconocidos.
export function canCompareSessions(activeRole) {
  return activeRole === 'trainer' || activeRole === 'runner';
}

// Interruptor único del gap de backend de arriba. Explícito y exportado para que
// el día que el endpoint abra sea un solo `true` y no una condición escondida en
// el JSX de la pantalla.
export const MEMBER_PERIOD_COMPARISON_ENABLED = false;

export function canReadPeriodComparison(activeRole) {
  return activeRole === 'trainer' || MEMBER_PERIOD_COMPARISON_ENABLED;
}
