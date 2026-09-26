import { useQueries } from '@tanstack/react-query';
import { teamQueryOptions } from './use-teams.js';

// Resuelve la cuota mensual (membership_fee) de varios equipos a la vez.
//
// Existe porque ni `TeamSearchResult` (GET /teams/search) ni
// `InvitationResponse` traen membership_fee, y el precio tiene que verse
// justo donde el corredor decide unirse — no recién en una pantalla
// posterior. `GET /teams/{id}` sí lo trae y lo puede leer cualquier
// autenticado, así que se piden los equipos de la lista en paralelo con
// useQueries, reusando la misma query que useTeam (key ['team', id]): el
// fetch se comparte con cualquier otra pantalla que ya haya pedido ese
// equipo, y no se duplica al volver a la lista.
//
// El pedido de agregar el campo a esos dos DTOs está anotado en
// docs/BACKEND_API_GAPS.md — cuando exista, este hook se borra y el precio
// sale del listado directo, sin fan-out.
export function useTeamFees(teamIds) {
  const ids = [...new Set((teamIds ?? []).filter(Boolean).map(String))];

  const queries = useQueries({
    queries: ids.map((teamId) => teamQueryOptions(teamId)),
  });

  // teamId → membershipFee. Un equipo cuya query todavía no resolvió queda
  // FUERA del mapa (no en 0): el caller tiene que poder distinguir "todavía
  // no sé el precio" de "es gratis" — mostrar "Gratis" mientras carga sería
  // mostrar un precio equivocado, que es peor que no mostrar ninguno.
  const feesByTeamId = {};
  ids.forEach((teamId, i) => {
    const team = queries[i]?.data;
    if (team) feesByTeamId[teamId] = team.membershipFee ?? 0;
  });

  return {
    feesByTeamId,
    loading: queries.some((q) => q.isLoading),
    // Devuelve undefined mientras no se sabe, número cuando sí.
    getFee: (teamId) => feesByTeamId[String(teamId)],
  };
}
