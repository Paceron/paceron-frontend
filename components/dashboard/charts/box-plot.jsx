import { Text, View } from 'react-native';
import Svg, { Circle, Line, Rect, Text as SvgText } from 'react-native-svg';
import { boxPlotStats, scaleLinear } from '../../../utils/dashboard-chart.js';
import { formatMetric } from '../../../utils/dashboard-format.js';
import { useThemeColors } from '../../../theme/colors.js';
import { ChartSurface } from './chart-surface.jsx';

const PAD_X = 16;
const PAD_TOP = 12;
const PAD_BOTTOM = 24;

// Caja de la distribución de la magnitud elegida (velocidad en la paleta A, tiempo
// en la B), con los outliers marcados aparte.
//
// Aclaración que el nombre de la pieza suele confundir: la CONSISTENCIA que
// muestra el KPI NO sale de acá. Viene de `consistency.cv` de la API
// (domains/dashboard/consistency.go del backend); esta función es solo la
// geometría de la caja. Recalcular el cv acá sería exactamente el no-goal de
// "ninguna fórmula de KPI se recalcula en el front".
export function BoxPlot({ id, height = 170, values = [], unit, label, caption }) {
  const colors = useThemeColors();
  const stats = boxPlotStats(values);

  return (
    <View nativeID={`${id}-root`} testID={`${id}-root`}>
      <ChartSurface height={height} id={id} label={label}>
        {(width) => {
          const plotWidth = Math.max(1, width - PAD_X * 2);
          const plotHeight = Math.max(1, height - PAD_TOP - PAD_BOTTOM);
          const y = scaleLinear([stats.min, stats.max], [plotHeight, PAD_TOP]);
          const boxWidth = Math.min(72, plotWidth * 0.5);
          const centerX = width / 2;
          const q1 = y(stats.q1);
          const q3 = y(stats.q3);
          const median = y(stats.median);
          const low = y(stats.whiskerLow);
          const high = y(stats.whiskerHigh);

          return (
            <Svg height={height} nativeID={`${id}-svg`} testID={`${id}-svg`} width={width}>
              <Line
                nativeID={`${id}-whisker-line`}
                stroke={colors.onSurfaceVariant}
                strokeWidth={1}
                testID={`${id}-whisker-line`}
                x1={centerX}
                x2={centerX}
                y1={high}
                y2={low}
              />
              <Line
                nativeID={`${id}-whisker-top`}
                stroke={colors.onSurfaceVariant}
                strokeWidth={1}
                testID={`${id}-whisker-top`}
                x1={centerX - boxWidth / 4}
                x2={centerX + boxWidth / 4}
                y1={high}
                y2={high}
              />
              <Line
                nativeID={`${id}-whisker-bottom`}
                stroke={colors.onSurfaceVariant}
                strokeWidth={1}
                testID={`${id}-whisker-bottom`}
                x1={centerX - boxWidth / 4}
                x2={centerX + boxWidth / 4}
                y1={low}
                y2={low}
              />
              <Rect
                fill={colors.primary}
                height={Math.max((q3 ?? 0) - (q1 ?? 0), 2)}
                nativeID={`${id}-box`}
                opacity={0.18}
                rx={4}
                stroke={colors.primary}
                strokeWidth={2}
                testID={`${id}-box`}
                width={boxWidth}
                x={centerX - boxWidth / 2}
                y={q3 ?? 0}
              />
              <Line
                nativeID={`${id}-median`}
                stroke={colors.primary}
                strokeWidth={3}
                testID={`${id}-median`}
                x1={centerX - boxWidth / 2}
                x2={centerX + boxWidth / 2}
                y1={median}
                y2={median}
              />
              {stats.outliers.map((value, index) => {
                const position = y(value);
                return (
                  <Circle
                    cx={centerX}
                    cy={position ?? 0}
                    fill={colors.error}
                    key={`outlier-${index}`}
                    nativeID={`${id}-outlier-${index}`}
                    r={4}
                    testID={`${id}-outlier-${index}`}
                  />
                );
              })}
              <SvgText
                fill={colors.onSurfaceVariant}
                fontSize={10}
                nativeID={`${id}-median-label`}
                testID={`${id}-median-label`}
                textAnchor="middle"
                x={centerX}
                y={height - 6}
              >
                {`mediana ${formatMetric(stats.median, unit)}`}
              </SvgText>
            </Svg>
          );
        }}
      </ChartSurface>
      <Text className="mt-1 text-[11px] text-slate-500 dark:text-slate-400" nativeID={`${id}-caption`} testID={`${id}-caption`}>
        {caption ?? `${stats.count} ${stats.count === 1 ? 'serie' : 'series'}${stats.outliers.length ? ` · ${stats.outliers.length} ${stats.outliers.length === 1 ? 'valor atípico' : 'valores atípicos'}` : ''}`}
      </Text>
    </View>
  );
}
