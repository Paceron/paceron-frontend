import { View, Text } from 'react-native';
import Svg, { Circle, Line, Path, Text as SvgText } from 'react-native-svg';
import { RADAR_AXES, normalizeRadarAxes, radarPolygon } from '../../../utils/dashboard-chart.js';
import { EMPTY_METRIC, formatDelta, formatMetric } from '../../../utils/dashboard-format.js';
import { useThemeColors } from '../../../theme/colors.js';
import { ChartSurface } from './chart-surface.jsx';

const SIZE = 220;
const RINGS = 4;

// Radar de cinco ejes que resume el perfil del período. Aparece SOLO en la
// paleta A: en la B no hay con qué normalizar la mayoría de los ejes y un radar
// de ceros es peor que no mostrarlo.
//
// Tres reglas de la spec que el componente tiene que hacer visibles:
//
//  1. Un eje con dato `null` queda FUERA del polígono. En JavaScript
//     `100 − (null × 100)` da 100, así que sin esto un corredor con una sola
//     serie vería "consistencia perfecta" sobre un punto que nunca se midió. El
//     vértice se salta (utils/dashboard-chart.js#radarPolygon) y la tabla de
//     abajo marca "s/d".
//  2. Cada eje muestra su valor REAL junto al polígono. El área es un resumen,
//     no el dato: leer "volumen = 0,7" de la forma sin el número al lado inventa
//     una precisión que el gráfico no tiene.
//  3. Accesible en tabla: el SVG lleva `accessibilityRole="image"` (viene de
//     ChartSurface) con la descripción de los cinco valores, y abajo va la tabla
//     con los crudos.
export function RadarChart({ id, summary, units, label }) {
  const colors = useThemeColors();
  const axes = normalizeRadarAxes({
    totals: summary?.totals,
    trend: summary?.trend,
    consistency: summary?.consistency,
  });

  return (
    <View nativeID={`${id}-root`} testID={`${id}-root`}>
      <ChartSurface height={SIZE} id={id} label={radarDescription(axes, units)}>
        {(width) => {
          // El radar se achica al ancho disponible en vez de desbordar: en un
          // viewport angosto un Svg de ancho fijo se sale de la pantalla, y la
          // spec pide que no haya scroll horizontal en mobile.
          const size = Math.max(120, Math.min(width, SIZE));
          const cx = size / 2;
          const cy = size / 2;
          const radius = cx - 28;
          const rings = Array.from({ length: RINGS }, (_, index) =>
            radarPolygon(RADAR_AXES.map((axis) => ({ ...axis, value: ((index + 1) / RINGS) * 100 })), { cx, cy, radius }),
          );
          const shape = radarPolygon(axes, { cx, cy, radius });

          return (
            <Svg height={size} nativeID={`${id}-svg`} testID={`${id}-svg`} width={size}>
              {rings.map((ring, index) => (
                <Path
                  d={ring.path}
                  fill="none"
                  key={`ring-${index}`}
                  nativeID={`${id}-ring-${index + 1}`}
                  stroke={colors.outlineVariant}
                  strokeWidth={1}
                  testID={`${id}-ring-${index + 1}`}
                />
              ))}
              {axes.map((axis, index) => {
                const angle = ((-90 + (360 / axes.length) * index) * Math.PI) / 180;
                return (
                  <Line
                    key={axis.id}
                    nativeID={`${id}-spoke-${axis.id}`}
                    stroke={colors.outlineVariant}
                    strokeWidth={1}
                    testID={`${id}-spoke-${axis.id}`}
                    x1={cx}
                    x2={cx + radius * Math.cos(angle)}
                    y1={cy}
                    y2={cy + radius * Math.sin(angle)}
                  />
                );
              })}
              {shape.path ? (
                <Path
                  d={shape.path}
                  fill={colors.primary}
                  fillOpacity={0.25}
                  nativeID={`${id}-polygon`}
                  stroke={colors.primary}
                  strokeWidth={2}
                  testID={`${id}-polygon`}
                />
              ) : null}
              {shape.points.map((point) =>
                point.available ? (
                  <Circle
                    cx={point.x}
                    cy={point.y}
                    fill={colors.primary}
                    key={point.id}
                    nativeID={`${id}-vertex-${point.id}`}
                    r={3.5}
                    testID={`${id}-vertex-${point.id}`}
                  />
                ) : null,
              )}
              {shape.points.map((point) => (
                <SvgText
                  fill={colors.onSurfaceVariant}
                  fontSize={9}
                  key={`label-${point.id}`}
                  nativeID={`${id}-label-${point.id}`}
                  textAnchor="middle"
                  testID={`${id}-label-${point.id}`}
                  x={point.outerX}
                  y={point.outerY - 4}
                >
                  {point.label}
                </SvgText>
              ))}
            </Svg>
          );
        }}
      </ChartSurface>
      <View className="mt-3" nativeID={`${id}-table`} testID={`${id}-table`}>
        {axes.map((axis) => (
          <View
            className="flex-row items-center justify-between border-b border-slate-100 py-1.5 last:border-b-0 dark:border-slate-800"
            key={axis.id}
            nativeID={`${id}-table-${axis.id}`}
            testID={`${id}-table-${axis.id}`}
          >
            <Text className="text-xs text-slate-600 dark:text-slate-300" nativeID={`${id}-table-${axis.id}-label`} testID={`${id}-table-${axis.id}-label`}>
              {axis.label}
            </Text>
            <View className="flex-row items-center gap-2" nativeID={`${id}-table-${axis.id}-value-row`} testID={`${id}-table-${axis.id}-value-row`}>
              <Text className="text-xs font-semibold text-slate-900 dark:text-white" nativeID={`${id}-table-${axis.id}-value`} testID={`${id}-table-${axis.id}-value`}>
                {rawLabel(axis, units)}
              </Text>
              <Text className="w-14 text-right text-[11px] text-slate-500 dark:text-slate-400" nativeID={`${id}-table-${axis.id}-index`} testID={`${id}-table-${axis.id}-index`}>
                {axis.available ? `${Math.round(axis.value)} / 100` : 's/d'}
              </Text>
            </View>
          </View>
        ))}
      </View>
    </View>
  );
}

// El valor real del eje, con la unidad que DECLARA la respuesta. El `cv` no
// tiene clave en el bloque `units` —el contrato no declara ninguna para el
// coeficiente de variación— así que se escribe sin sufijo en vez de inventar una.
function rawLabel(axis, units) {
  if (axis.raw === null || axis.raw === undefined) return EMPTY_METRIC;
  if (axis.id === 'trend') return formatDelta(axis.raw, units?.delta);
  if (axis.id === 'consistency') return formatMetric(axis.raw, null);
  return formatMetric(axis.raw, units?.[axis.unitKey]);
}

function radarDescription(axes, units) {
  const parts = axes.map((axis) => `${axis.label}: ${rawLabel(axis, units)}${axis.available ? ` (${Math.round(axis.value)} de 100)` : ' (sin dato)'}`);
  return `Perfil en cinco ejes. ${parts.join('. ')}`;
}
