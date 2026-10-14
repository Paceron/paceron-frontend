import { Text, View } from 'react-native';
import Svg, { Circle, Line, Path, Text as SvgText } from 'react-native-svg';
import { extent, lineSeries } from '../../../utils/dashboard-chart.js';
import { formatMetric } from '../../../utils/dashboard-format.js';
import { useThemeColors } from '../../../theme/colors.js';
import { ChartSurface } from './chart-surface.jsx';

const TOP_PADDING = 14;
const AXIS_LABEL_H = 16;

// Evolución de una magnitud a lo largo del período: ritmo promedio en paleta A,
// mejor tiempo en paleta B. Acepta DOS series —la lograda y la objetivo— que es
// lo que hace legible la tendencia: contra una línea sola no se ve si se.apartó
// del objetivo o si el objetivo se movió.
//
// Las dos series comparten UN dominio (`extent` sobre los valores de ambas): con
// dominios separados cada una se vería "plana" en su propio tramo y la
// comparación visual mentiría.
//
// `primary`/`secondary` son `[{ label, value }]`: un `value: null` corta el
// trazo (utils/dashboard-chart.js#lineSeries) en vez de caer al piso.
export function LineChart({
  id,
  height = 190,
  label,
  primary = [],
  secondary = [],
  unit,
  secondaryLabel,
  formatX = (value) => String(value ?? ''),
  emptyMessage = 'Sin datos en el período',
}) {
  const colors = useThemeColors();
  const hasValues = [...primary, ...secondary].some((point) => typeof point?.value === 'number');
  const sharedDomain = secondary.length ? extent([...primary, ...secondary].map((point) => point?.value)) : null;

  return (
    <View nativeID={`${id}-wrapper`} testID={`${id}-wrapper`}>
      <ChartSurface height={height} id={id} label={label}>
        {(width) => {
          const plotHeight = height - TOP_PADDING - AXIS_LABEL_H;
          const main = lineSeries(primary, { width, height: plotHeight, domain: sharedDomain, inset: 4 });
          const target = secondary.length
            ? lineSeries(secondary, { width, height: plotHeight, domain: main.domain, inset: 4 })
            : null;
          const ticks = tickIndexes(primary.length);
          const max = main.domain?.[1] ?? 0;
          const min = main.domain?.[0] ?? 0;

          return (
            <View nativeID={`${id}-plot`} testID={`${id}-plot`}>
              <Svg height={plotHeight} nativeID={`${id}-svg`} testID={`${id}-svg`} width={width}>
                {[0, 0.5, 1].map((fraction) => {
                  const y = plotHeight * fraction;
                  return (
                    <Line
                      key={fraction}
                      nativeID={`${id}-grid-${fraction}`}
                      stroke={colors.outlineVariant}
                      strokeDasharray="3 3"
                      strokeWidth={1}
                      testID={`${id}-grid-${fraction}`}
                      x1={0}
                      x2={width}
                      y1={y}
                      y2={y}
                    />
                  );
                })}
                {target?.path ? (
                  <Path
                    d={target.path}
                    fill="none"
                    nativeID={`${id}-target-line`}
                    stroke={colors.onSurfaceVariant}
                    strokeDasharray="5 4"
                    strokeWidth={2}
                    testID={`${id}-target-line`}
                  />
                ) : null}
                {main.path ? (
                  <Path d={main.path} fill="none" nativeID={`${id}-main-line`} stroke={colors.primary} strokeWidth={2.5} testID={`${id}-main-line`} />
                ) : null}
                {main.points.map((point) =>
                  point.y === null ? null : (
                    <Circle
                      cx={point.x}
                      cy={point.y}
                      fill={colors.primary}
                      key={point.index}
                      nativeID={`${id}-point-${point.index}`}
                      r={3}
                      testID={`${id}-point-${point.index}`}
                    />
                  ),
                )}
                <SvgText
                  fill={colors.onSurfaceVariant}
                  fontSize={10}
                  nativeID={`${id}-max-label`}
                  testID={`${id}-max-label`}
                  textAnchor="end"
                  x={width - 2}
                  y={10}
                >
                  {formatMetric(max, unit)}
                </SvgText>
                <SvgText
                  fill={colors.onSurfaceVariant}
                  fontSize={10}
                  nativeID={`${id}-min-label`}
                  testID={`${id}-min-label`}
                  textAnchor="end"
                  x={width - 2}
                  y={plotHeight - 2}
                >
                  {formatMetric(min, unit)}
                </SvgText>
              </Svg>
              <View className="flex-row justify-between" nativeID={`${id}-x-axis`} testID={`${id}-x-axis`}>
                {ticks.map((index) => (
                  <Text
                    className="text-[10px] text-slate-500 dark:text-slate-400"
                    key={index}
                    nativeID={`${id}-x-axis-${index}`}
                    testID={`${id}-x-axis-${index}`}
                  >
                    {formatX(primary[index]?.label)}
                  </Text>
                ))}
              </View>
              {secondaryLabel ? (
                <Text className="mt-1 text-[10px] text-slate-500 dark:text-slate-400" nativeID={`${id}-series-caption`} testID={`${id}-series-caption`}>
                  {secondaryLabel}
                </Text>
              ) : null}
            </View>
          );
        }}
      </ChartSurface>
      {!hasValues ? (
        <Text className="mt-2 text-center text-xs text-slate-500 dark:text-slate-400" nativeID={`${id}-empty`} testID={`${id}-empty`}>
          {emptyMessage}
        </Text>
      ) : null}
    </View>
  );
}

// Hasta tres etiquetas del eje X (primera, del medio y última): con más de tres
// se pisan entre sí en mobile sin wrapping posible.
function tickIndexes(length) {
  if (length <= 0) return [];
  if (length <= 3) return Array.from({ length }, (_, index) => index);
  return [0, Math.floor((length - 1) / 2), length - 1];
}
