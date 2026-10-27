import { Text, View } from 'react-native';
import Svg, { Circle, Line, Text as SvgText } from 'react-native-svg';
import { dotPoints } from '../../../utils/dashboard-chart.js';
import { formatMetric } from '../../../utils/dashboard-format.js';
import { useThemeColors } from '../../../theme/colors.js';
import { ChartSurface } from './chart-surface.jsx';

const PADDING = 22;

// Dispersión serie por serie: cada punto es una ejecución. Es la pieza de la
// paleta B (sin objetivo no hay contra qué comparar, pero sí hay distribución:
// ¿las marcas propias están agrupadas o hay una que se escapa?) y el complemento
// del box plot en la paleta A.
//
// `points` es `[{ x, y }]`: X e Y son magnitudes distintas (por eje contra
// distancia), y `dotPoints` devuelve las escalas YA aplicadas para que los
// rótulos del eje usen exactamente la misma transformación que los puntos. Un
// punto con alguna coordenada no finita no se dibuja pero conserva su índice.
export function DotPlot({ id, height = 200, points = [], label, xUnit, yUnit, xCaption, yCaption, pointLabel }) {
  const colors = useThemeColors();

  return (
    <View nativeID={`${id}-root`} testID={`${id}-root`}>
      <ChartSurface height={height} id={id} label={label}>
        {(width) => {
          const plotWidth = Math.max(1, width - PADDING);
          const plotHeight = Math.max(1, height - PADDING);
          const { points: dots, x, y, xDomain, yDomain } = dotPoints(points, { width: plotWidth, height: plotHeight, minimumRange: 1 });

          const xTicks = [xDomain ? xDomain[0] : null, xDomain ? xDomain[1] : null];
          const yTicks = [yDomain ? yDomain[0] : null, yDomain ? yDomain[1] : null];

          return (
            <View nativeID={`${id}-plot`} testID={`${id}-plot`}>
              <Svg height={height} nativeID={`${id}-svg`} testID={`${id}-svg`} width={width}>
                <Line
                  nativeID={`${id}-axis-x`}
                  stroke={colors.outlineVariant}
                  strokeWidth={1}
                  testID={`${id}-axis-x`}
                  x1={PADDING}
                  x2={PADDING}
                  y1={0}
                  y2={plotHeight}
                />
                <Line
                  nativeID={`${id}-axis-y`}
                  stroke={colors.outlineVariant}
                  strokeWidth={1}
                  testID={`${id}-axis-y`}
                  x1={0}
                  x2={width}
                  y1={plotHeight}
                  y2={plotHeight}
                />
                {yTicks.map((value, index) => {
                  const position = y(value);
                  return (
                    <SvgText
                      fill={colors.onSurfaceVariant}
                      fontSize={10}
                      key={`y-${index}`}
                      nativeID={`${id}-y-label-${index}`}
                      testID={`${id}-y-label-${index}`}
                      x={PADDING + 4}
                      y={(position ?? 0) + 3}
                    >
                      {formatMetric(value, yUnit)}
                    </SvgText>
                  );
                })}
                {xTicks.map((value, index) => {
                  const position = x(value);
                  return (
                    <SvgText
                      fill={colors.onSurfaceVariant}
                      fontSize={10}
                      key={`x-${index}`}
                      nativeID={`${id}-x-label-${index}`}
                      testID={`${id}-x-label-${index}`}
                      textAnchor={index === 0 ? 'start' : 'end'}
                      x={position ?? 0}
                      y={plotHeight + 13}
                    >
                      {formatMetric(value, xUnit)}
                    </SvgText>
                  );
                })}
                {dots.map((dot) => (
                  <Circle
                    cx={PADDING + dot.cx}
                    cy={dot.cy}
                    fill={colors.primary}
                    key={dot.index}
                    nativeID={`${id}-point-${dot.index}`}
                    opacity={0.75}
                    r={4}
                    testID={`${id}-point-${dot.index}`}
                  />
                ))}
              </Svg>
            </View>
          );
        }}
      </ChartSurface>
      {xCaption || yCaption ? (
        <View className="mt-1 flex-row justify-between" nativeID={`${id}-captions`} testID={`${id}-captions`}>
          <Text className="text-[10px] text-slate-500 dark:text-slate-400" nativeID={`${id}-x-caption`} testID={`${id}-x-caption`}>
            {xCaption ?? ''}
          </Text>
          <Text className="text-[10px] text-slate-500 dark:text-slate-400" nativeID={`${id}-y-caption`} testID={`${id}-y-caption`}>
            {yCaption ?? ''}
          </Text>
        </View>
      ) : null}
      {pointLabel ? (
        <Text className="mt-1 text-[10px] text-slate-500 dark:text-slate-400" nativeID={`${id}-point-caption`} testID={`${id}-point-caption`}>
          {pointLabel}
        </Text>
      ) : null}
    </View>
  );
}
