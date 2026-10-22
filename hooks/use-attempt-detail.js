import { useQuery } from '@tanstack/react-query';
import { getGpsPoints } from '../services/session-db.js';
import { getRunnerSession, getSessionFeedback, getWorkoutFeedbackPoints } from '../services/runnerSession.js';
import { toRunnerSessionModel, toSessionFeedbackListModel } from '../services/normalizers.js';
import { useCompetitionDetail } from './use-competitions.js';
import { totalRouteMeters, computeRouteComplianceRatio } from '../utils/route-geometry.js';
import { isWeb } from '../utils/platform.js';
import { deriveAttemptStatus } from '../utils/attempt-status.js';

export { deriveAttemptStatus };

function useLocalAttemptDetail(setId, { distanceMeters, durationMs, startedAt, competition }) {
  const query = useQuery({
    queryKey: ['attempt-detail-local', setId],
    queryFn: async () => {
      const points = await getGpsPoints(setId);
      return points.map((p) => ({ latitude: p.latitude, longitude: p.longitude }));
    },
    enabled: Boolean(setId) && !isWeb,
  });

  const referenceRoute = competition?.route ?? null;
  const expectedMeters = referenceRoute
    ? totalRouteMeters((referenceRoute.coordinates ?? []).map(([lng, lat]) => ({ lat, lng })))
    : null;

  return {
    loading: query.isLoading,
    status: 'local',
    distanceMeters: Number(distanceMeters ?? 0),
    durationMs: Number(durationMs ?? 0),
    startedAt: startedAt ?? null,
    teamId: competition?.teamId ?? null,
    traveledPoints: query.data ?? [],
    referenceRoute,
    expectedMeters,
  };
}

function useRemoteAttemptDetail(athleteUserId, { competition, competitionLoading, sessionInstanceIdOverride }) {
  // Prioridad: (1) un intento específico elegido explícitamente (viene de
  // AttemptsListModal, Task 10) -- (2) el mejor intento de ESTE atleta
  // puntual (Gap 36, vive en competition.progress, distinto por atleta) --
  // (3) fallback al session_instance_id único de la competencia (gap 35,
  // competencias viejas sin progress poblado todavía). Antes de este plan
  // SIEMPRE usaba (3) sin más -- correcto solo mientras cada atleta tenía
  // como máximo un intento.
  const athleteProgress = competition?.progress?.find((p) => p.userId === String(athleteUserId));
  const sessionInstanceId = sessionInstanceIdOverride
    ?? athleteProgress?.sessionInstanceId
    ?? competition?.sessionInstanceId
    ?? null;

  const runnerSessionQuery = useQuery({
    queryKey: ['attempt-detail-runner-session', sessionInstanceId, athleteUserId],
    queryFn: async () => {
      try {
        const res = await getRunnerSession(sessionInstanceId, athleteUserId);
        return toRunnerSessionModel(res?.data ?? null);
      } catch (error) {
        if (error.status === 404) return null;
        throw error;
      }
    },
    enabled: Boolean(sessionInstanceId && athleteUserId),
  });

  const feedbackQuery = useQuery({
    queryKey: ['attempt-detail-feedback', sessionInstanceId, athleteUserId],
    queryFn: async () => {
      const res = await getSessionFeedback(sessionInstanceId, athleteUserId);
      return toSessionFeedbackListModel(res?.data ?? res ?? []);
    },
    enabled: Boolean(sessionInstanceId && athleteUserId) && runnerSessionQuery.data !== undefined,
  });

  // `toSessionFeedbackListModel` agrupa por ejercicio -- un intento de ruta
  // tiene un solo ejercicio sintético ("Corrida"), así que la primera
  // entrada del primer grupo es la única fila real.
  const feedback = feedbackQuery.data?.[0]?.sets?.[0] ?? null;
  const flatFeedbackList = feedback ? [feedback] : [];

  const pointsQuery = useQuery({
    queryKey: ['attempt-detail-points', feedback?.id],
    queryFn: async () => {
      const res = await getWorkoutFeedbackPoints(feedback.id);
      const points = res?.data ?? res ?? [];
      return points.map((p) => ({ latitude: p.latitude, longitude: p.longitude }));
    },
    enabled: Boolean(feedback?.id) && (feedback?.pointsCount ?? 0) > 0,
  });

  const status = deriveAttemptStatus({ runnerSession: runnerSessionQuery.data, feedbackList: flatFeedbackList });
  const referenceRoute = competition?.route ?? null;
  const expectedMeters = referenceRoute
    ? totalRouteMeters((referenceRoute.coordinates ?? []).map(([lng, lat]) => ({ lat, lng })))
    : null;

  return {
    loading: competitionLoading || runnerSessionQuery.isLoading || feedbackQuery.isLoading,
    status,
    distanceMeters: feedback?.distanceMeters ?? null,
    durationMs: feedback?.durationMs ?? null,
    startedAt: feedback?.startedAt ?? feedback?.createdAt ?? null,
    teamId: feedback?.teamId ?? competition?.teamId ?? null,
    traveledPoints: pointsQuery.data ?? [],
    referenceRoute,
    expectedMeters,
  };
}

// Dos caminos de carga que normalizan al mismo shape -- `setId` presente
// (nativo, intento recién terminado/no sincronizado) lee SQLite local sin
// esperar red; sin `setId` (cualquier plataforma, cualquier participante)
// pide todo por API vía el session_instance_id sintético de la
// competencia (Gap 35). El detalle de la competencia (ruta esperada,
// equipo) se pide UNA sola vez acá arriba y se comparte entre las dos
// ramas -- antes la rama local nunca lo pedía, dejando el mapa vacío y
// sin distancia esperada/equipo (bug real reportado 2026-10-21). Ver la
// spec para el detalle completo.
export function useAttemptDetail({ competitionId, athleteUserId, setId, distanceMeters, durationMs, startedAt, sessionInstanceId }) {
  const { detail: competition, loading: competitionLoading } = useCompetitionDetail(competitionId);
  const local = useLocalAttemptDetail(setId, { distanceMeters, durationMs, startedAt, competition });
  const remote = useRemoteAttemptDetail(athleteUserId, { competition, competitionLoading, sessionInstanceIdOverride: sessionInstanceId });
  const result = setId ? local : remote;
  // % de la distancia recorrida dentro del radio de aceptación -- mismos
  // traveledPoints/referenceRoute que ya resolvió la rama elegida, solo
  // falta el radio (vive en la competencia, no en ninguna de las dos
  // ramas). null mientras no haya datos suficientes, no un 0% engañoso.
  const complianceRatio = computeRouteComplianceRatio(
    result.traveledPoints,
    result.referenceRoute?.coordinates,
    competition?.acceptanceRadiusMeters,
  );
  return { ...result, complianceRatio, acceptanceRadiusMeters: competition?.acceptanceRadiusMeters ?? null };
}
