import { useEffect, useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import { useThemeColors } from '../../theme/colors.js';
import { getWorkoutFeedbackPoints } from '../../services/runnerSession.js';
import { buildTrajectoryPath } from '../../utils/trajectory.js';
import { formatMeters } from '../../utils/distance.js';

const SIZE = 160;

// "Dibujo de trayectoria": la figura a escala del tramo recorrido por la
// serie, dentro de un recuadro fijo. Es una representación del recorrido, NO
// un mapa — no hay calles ni streets, solo la forma y los extremos.
//
// Los puntos se piden under demand (GET /workout-feedback/:id/points) cuando
// se abre la serie, porque la lista de feedback solo trae `points_count`: traer
// todos los puntos de todas las series de la sesión sería descargarlos sin
// necesidad. Por eso el componente monta y consulta por sí mismo en vez de usar
// una query del hook de la pantalla.
export function TrajectorySketch({ feedbackId, pointsCount }) {
  const colors = useThemeColors();
  const [state, setState] = useState({ loading: false, shape: null, error: null });

  useEffect(() => {
    if (!feedbackId || !pointsCount) return;
    let cancelled = false;
    setState({ loading: true, shape: null, error: null });
    getWorkoutFeedbackPoints(feedbackId)
      .then((res) => {
        if (cancelled) return;
        const points = res?.data ?? [];
        setState({ loading: false, shape: buildTrajectoryPath(points, { size: SIZE }), error: null });
      })
      .catch((error) => {
        if (cancelled) return;
        setState({ loading: false, shape: null, error: error });
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
      <View className="items-center justify-center py-6" nativeID="session-review-trajectory-loading" testID="session-review-trajectory-loading">
        <ActivityIndicator color={colors.primary} size="small" />
      </View>
    );
  }

  if (state.error || !state.shape) {
    return (
      <View className="mt-3" nativeID="session-review-trajectory-error" testID="session-review-trajectory-error">
        <Text className="text-xs text-amber-600 dark:text-amber-400" nativeID="session-review-trajectory-error-label" testID="session-review-trajectory-error-label">
          No pudimos dibujar la trayectoria.
        </Text>
      </View>
    );
  }

  const { d, start, end, metersWide, metersTall, pointCount } = state.shape;

  return (
    <View className="mt-3" nativeID="session-review-trajectory" testID="session-review-trajectory">
      <View
        className="self-start rounded-2xl border border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-900/50"
        nativeID="session-review-trajectory-figure"
        testID="session-review-trajectory-figure"
      >
        <Svg height={SIZE} width={SIZE} nativeID="session-review-trajectory-svg" testID="session-review-trajectory-svg">
          <Path d={d} fill="none" stroke="#16a34a" strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} />
          <Circle cx={start.x} cy={start.y} fill="#16a34a" r={4} />
          <Circle cx={end.x} cy={end.y} fill="#111518" r={4} />
        </Svg>
      </View>
      <View className="mt-2 gap-0.5" nativeID="session-review-trajectory-legend" testID="session-review-trajectory-legend">
        <Text className="text-[10px] text-slate-500 dark:text-slate-400" nativeID="session-review-trajectory-legend-start" testID="session-review-trajectory-legend-start">
          ● Inicio — ● Fin
        </Text>
        <Text className="text-[10px] text-slate-400 dark:text-slate-500" nativeID="session-review-trajectory-legend-dims" testID="session-review-trajectory-legend-dims">
          {formatMeters(metersWide)} × {formatMeters(metersTall)} · {pointCount} punto(s)
        </Text>
      </View>
    </View>
  );
}
