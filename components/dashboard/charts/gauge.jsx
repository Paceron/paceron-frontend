import { Text, View } from 'react-native';
import Svg, { Circle, Line, Path } from 'react-native-svg';
import { gaugeArc } from '../../../utils/dashboard-chart.js';
import { EMPTY_METRIC, formatMetric, hasMetric } from '../../../utils/dashboard-format.js';
import { useThemeColors } from '../../../theme/colors.js';
import { ChartSurface } from './chart-surface.jsx';

const RADIUS = 62;
const STROKE = 10;

// Gauge de ritmo logrado contra el objetivo: la semicircunferencia con la aguja
// en el porcentaje alcanzado.
//
// Es una pieza SOLO de la paleta A completa. En A reducido `target_speed_kph` es
// `null` —no hay tiempo objetivo del cual derivar una velocidad esperada— y
// dibujarla sería inventar un objetivo que no existe; `gaugeArc` devuelve solo la
// pista sin arco de progreso y el componente avisa que no hay objetivo, en vez
// de pintar un 0 %.
export function Gauge({ id, value, target, unit, label, targetCaption }) {
  const colors = useThemeColors();
  const hasBoth = hasMetric(value) && hasMetric(target);

  return (
    <View className="items-center" nativeID={`${id}-root`} testID={`${id}-root`}>
      <ChartSurface height={RADIUS * 2 + STROKE} id={id} label={label}>
        {(width) => {
          const geometry = gaugeArc(value, target, { radius: RADIUS, strokeWidth: STROKE });
          if (!geometry) return null;

          return (
            <Svg
              height={RADIUS * 2 + STROKE}
              nativeID={`${id}-svg`}
              testID={`${id}-svg`}
              width={Math.min(width, (RADIUS + STROKE) * 2)}
            >
              <Path
                d={geometry.trackPath}
                fill="none"
                nativeID={`${id}-track`}
                stroke={colors.outlineVariant}
                strokeLinecap="round"
                strokeWidth={STROKE}
                testID={`${id}-track`}
              />
              {geometry.progressPath ? (
                <Path
                  d={geometry.progressPath}
                  fill="none"
                  nativeID={`${id}-progress`}
                  stroke={colors.primary}
                  strokeLinecap="round"
                  strokeWidth={STROKE}
                  testID={`${id}-progress`}
                />
              ) : null}
              {geometry.needleAngle !== null ? (
                <>
                  <Line
                    nativeID={`${id}-needle`}
                    stroke={colors.onSurface}
                    strokeLinecap="round"
                    strokeWidth={3}
                    testID={`${id}-needle`}
                    x1={geometry.cx}
                    x2={geometry.cx + (RADIUS - 12) * Math.cos((geometry.needleAngle * Math.PI) / 180)}
                    y1={geometry.cy}
                    y2={geometry.cy + (RADIUS - 12) * Math.sin((geometry.needleAngle * Math.PI) / 180)}
                  />
                  <Circle
                    cx={geometry.cx}
                    cy={geometry.cy}
                    fill={colors.onSurface}
                    nativeID={`${id}-needle-hub`}
                    r={5}
                    testID={`${id}-needle-hub`}
                  />
                </>
              ) : null}
            </Svg>
          );
        }}
      </ChartSurface>
      <Text className="-mt-6 text-xl font-bold text-slate-900 dark:text-white" nativeID={`${id}-value`} testID={`${id}-value`}>
        {hasMetric(value) ? formatMetric(value, unit) : EMPTY_METRIC}
      </Text>
      <Text className="mt-1 text-[11px] text-slate-500 dark:text-slate-400" nativeID={`${id}-caption`} testID={`${id}-caption`}>
        {targetCaption ?? (hasBoth ? `Objetivo ${formatMetric(target, unit)}` : 'Sin objetivo de ritmo cargado')}
      </Text>
    </View>
  );
}
