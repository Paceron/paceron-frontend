import { useEffect, useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { useThemeColors } from '../../theme/colors.js';
import { getWorkoutFeedbackPoints } from '../../services/runnerSession.js';
import { LiveTrajectoryMap } from './live-trajectory-map';

// Mapa real de una serie ya registrada -- reemplaza al dibujo abstracto que
// tenía trajectory-sketch.jsx, con el mismo mapa real que ya usan las
// pantallas en vivo y el detalle de intento de competencia
// (LiveTrajectoryMap). Mismo fetch bajo demanda que ya tenía el sketch viejo
// (GET /workout-feedback/:id/points por feedbackId, un fetch por serie, a
// propósito -- ver docs/superpowers/specs/2026-10-29-session-review-real-map-design.md,
// "Qué cambió respecto a la idea original": no hay forma de traer varias
// series de una sin pedir de más).
//
// `hideReferenceLine` siempre activo -- no hay "ruta planificada" que
// mostrar acá, solo lo que pasó. Inicio Y fin SIEMPRE presentes (a
// diferencia del mapa en vivo de las pantallas de sesión, acá la serie ya
// terminó, nunca hay un "todavía no se sabe el fin"). Sin `currentPosition`
// -- no hay avatar de posición en vivo, es historial.
export function SeriesTrajectoryMap({ feedbackId, pointsCount }) {
  const colors = useThemeColors();
  const [state, setState] = useState({ loading: false, points: null, error: null });

  useEffect(() => {
    if (!feedbackId || !pointsCount) return;
    let cancelled = false;
    setState({ loading: true, points: null, error: null });
    getWorkoutFeedbackPoints(feedbackId)
      .then((res) => {
        if (cancelled) return;
        setState({ loading: false, points: res?.data ?? [], error: null });
      })
      .catch((error) => {
        if (cancelled) return;
        setState({ loading: false, points: null, error });
      });
    return () => {
      cancelled = true;
    };
  }, [feedbackId, pointsCount]);

  if (!pointsCount) {
    return (
      <View className="mt-3" nativeID="session-review-trajectory" testID="session-review-trajectory">
        <Text className="text-xs text-slate-400 dark:text-slate-500" nativeID="session-review-trajectory-empty" testID="session-review-trajectory-empty">
          Esta serie se registró sin GPS, no hay trayectoria para dibujar.
        </Text>
      </View>
    );
  }

  if (state.loading) {
    return (
      <View className="items-center justify-center py-10" nativeID="session-review-trajectory-loading" testID="session-review-trajectory-loading">
        <ActivityIndicator color={colors.primary} size="small" />
      </View>
    );
  }

  if (state.error || !state.points || state.points.length < 2) {
    return (
      <View className="mt-3" nativeID="session-review-trajectory-error" testID="session-review-trajectory-error">
        <Text className="text-xs text-amber-600 dark:text-amber-400" nativeID="session-review-trajectory-error-label" testID="session-review-trajectory-error-label">
          No pudimos dibujar la trayectoria.
        </Text>
      </View>
    );
  }

  const startPoint = state.points[0];
  const endPoint = state.points[state.points.length - 1];
  const referenceRoute = {
    type: 'LineString',
    coordinates: [
      [startPoint.longitude, startPoint.latitude],
      [endPoint.longitude, endPoint.latitude],
    ],
  };

  return (
    <View className="mt-3 h-60" nativeID="session-review-trajectory" testID="session-review-trajectory">
      <LiveTrajectoryMap hideReferenceLine referenceRoute={referenceRoute} traveledPoints={state.points} />
    </View>
  );
}
