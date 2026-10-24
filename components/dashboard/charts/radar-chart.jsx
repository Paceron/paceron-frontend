import { View } from 'react-native';
import Svg, { Circle, Line, Path, Text as SvgText } from 'react-native-svg';
import { RADAR_AXES, normalizeRadarAxes, radarPolygon } from '../../../utils/dashboard-chart.js';
import { EMPTY_METRIC, formatDelta, formatMetric } from '../../../utils/dashboard-format.js';
import { useThemeColors } from '../../../theme/colors.js';
import { ChartSurface } from './chart-surface.jsx';

export const RADAR_SIZE = 220;
const RINGS = 4;

// Radio mínimo del SVG. Coincide con el piso del `Math.max` de abajo: por debajo
// de esto el pentágono deja de leerse y conviene que el call site no le dé menos
// ancho. Está exportado para que las cards puedan usarlo como `minWidth`.
export const RADAR_MIN_SIZE = 120;

// Radar de cinco ejes que resume el perfil del período. Aparece SOLO en la
// paleta A: en la B no hay con qué normalizar la mayoría de los ejes y un radar
// de ceros es peor que no mostrarlo.
//
// Tres reglas de la spec que el componente tiene que hacer visibles:
//
//  1. Un eje con dato `null` queda FUERA del polígono. En JavaScript
//     `100 − (null × 100)` da 100, así que sin esto un corredor con una sola
//     serie vería "consistencia perfecta" sobre un punto que nunca se midió. El
//     vértice se salta (utils/dashboard-chart.js#radarPolygon) y la barrita de ese
//     eje dice "sin dato" abajo.
//  2. El área es un RESUMEN, no el dato: puede ser 0,7 del radio sin que el
//     volumen sea chico. Los cinco crudos y su 0-100 viven en las barritas que
//     arma `AxisBars`, que salen de la misma `normalizeRadarAxes` (no hay dos
//     normalizaciones que se puedan desincronizar).
//  3. Accesible: el SVG lleva `accessibilityRole="image"` (viene de
//     ChartSurface) con la descripción de los cinco valores. Acá NO va ninguna
//     tabla con los crudos: hasta 2026-10-17 había una debajo y repetía los
//     mismos cinco números que las barritas — un solo lugar para el número.
//
// OJO CON EL ANCHO: esta superficie mide su propio layout y no tiene contenido
// propio que la dimensione (la tabla que lo hacía ya no está), así que un padre
// de ancho automático la colapsa a 0 y el pentágono desaparece sin ningún error.
// El call site tiene que darle un ancho definido — ver las dos cards del perfil,
// donde vive dentro de un slot con ancho explícito.
export function RadarChart({ id, summary, units, label }) {
  const colors = useThemeColors();
  const axes = normalizeRadarAxes({
    totals: summary?.totals,
    trend: summary?.trend,
    consistency: summary?.consistency,
  });

  return (
    <View nativeID={`${id}-root`} testID={`${id}-root`}>
      <ChartSurface height={RADAR_SIZE} id={id} label={radarDescription(axes, units)}>
        {(width) => {
          // El radar se achica al ancho disponible en vez de desbordar: en un
          // viewport angosto un Svg de ancho fijo se sale de la pantalla, y la
          // spec pide que no haya scroll horizontal en mobile.
          const size = Math.max(RADAR_MIN_SIZE, Math.min(width, RADAR_SIZE));
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
