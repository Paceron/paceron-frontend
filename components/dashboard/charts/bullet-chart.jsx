import { Text, View } from 'react-native';
import Svg, { Line, Rect, Text as SvgText } from 'react-native-svg';
import { bulletBar } from '../../../utils/dashboard-chart.js';
import { EMPTY_METRIC, formatMetric, hasMetric } from '../../../utils/dashboard-format.js';
import { useThemeColors } from '../../../theme/colors.js';
import { ChartSurface } from './chart-surface.jsx';

const HEIGHT = 54;
const MARKER_WIDTH = 3;

// Cumplimiento del objetivo: barra de logro con el marcador del objetivo.
//
// Complementa al gauge en vez de repetirlo —el gauge es de RITMO, la barra es de
// CUMPLIMIENTO— y es la única de las dos que sirve en A reducido: con objetivo
// solo de distancia, el cumplimiento se puede medir aunque la velocidad esperada
// no exista.
//
// Las bandas de fondo son cualitativas y van fijas en el componente (0-80 %
// "falta", 80-100 % "cerca", 100-150 % "cumplió"): NO son las bandas `met`/
// `near`/`missed` del backend, que se calculan por serie con la tolerancia
// aplicada y se muestran en el gráfico apilado. Mezclarlas sería mostrar dos
// veredictos distintos del mismo número.
// Bandas en múltiplos del OBJETIVO, y con `maxRatio = 1` la escala termina
// exactamente en 100 %: el gris se acaba donde termina el objetivo.
//
// Antes `maxRatio` era 1.5 y el track llegaba al 150 %. Con 58 % de cumplimiento
// eso llenaba solo el 39 % del ancho, así que la barra se leía como mucho peor
// de lo que era: el número y la barra contaban cosas distintas. Un cumplimiento es
// una tasa sobre 100; darle espacio al "sobre-cumplimiento" en la misma barra
// hace que el ojo lea mal el número.
//
// `utils/dashboard-chart.js#bulletBar` convierte las bandas a fracción del ancho
// dividiendo por `ratio`, así que siguen alineadas con la escala del valor.
const BANDS = [
  { id: 'short', from: 0, to: 0.8 },
  { id: 'near', from: 0.8, to: 0.95 },
  { id: 'met', from: 0.95, to: 1 },
];

export function BulletChart({ id, value, target, unit, label, maxRatio = 1 }) {
  const colors = useThemeColors();
  const ratio = hasMetric(value) && hasMetric(target) && target > 0 ? value / target : null;

  return (
    <View nativeID={`${id}-root`} testID={`${id}-root`}>
      <ChartSurface height={HEIGHT} id={id} label={label}>
        {(width) => {
          const geometry = bulletBar(value, target, { width, height: HEIGHT, maxRatio, bands: BANDS });
          if (!geometry) return null;

          return (
            <Svg height={HEIGHT} nativeID={`${id}-svg`} testID={`${id}-svg`} width={width}>
              {geometry.bands.map((band) => (
                <Rect
                  fill={colors.outlineVariant}
                  height={10}
                  key={band.from}
                  nativeID={`${id}-band-${band.from}`}
                  opacity={0.35}
                  rx={3}
                  testID={`${id}-band-${band.from}`}
                  width={Math.max(band.width, 0)}
                  x={band.x}
                  y={HEIGHT / 2 - 5}
                />
              ))}
              <Rect
                fill={colors.primary}
                height={14}
                nativeID={`${id}-value-bar`}
                rx={4}
                testID={`${id}-value-bar`}
                width={Math.max(geometry.valueWidth, geometry.hasValue ? 3 : 0)}
                x={0}
                y={HEIGHT / 2 - 7}
              />
              {geometry.targetX !== null ? (
                <Line
                  nativeID={`${id}-target-marker`}
                  stroke={colors.onSurface}
                  strokeWidth={MARKER_WIDTH}
                  testID={`${id}-target-marker`}
                  x1={geometry.targetX}
                  x2={geometry.targetX}
                  y1={HEIGHT / 2 - 16}
                  y2={HEIGHT / 2 + 16}
                />
              ) : null}
              <SvgText
                fill={colors.onSurfaceVariant}
                fontSize={10}
                nativeID={`${id}-target-label`}
                testID={`${id}-target-label`}
                textAnchor={geometry.targetX !== null && geometry.targetX > width - 60 ? 'end' : 'middle'}
                x={geometry.targetX ?? width / 2}
                y={HEIGHT - 2}
              >
                {geometry.hasTarget ? `objetivo ${formatMetric(target, unit)}` : 'sin objetivo cargado'}
              </SvgText>
            </Svg>
          );
        }}
      </ChartSurface>
      <View className="mt-1 flex-row items-center justify-between" nativeID={`${id}-footer`} testID={`${id}-footer`}>
        <Text className="text-lg font-bold text-slate-900 dark:text-white" nativeID={`${id}-value`} testID={`${id}-value`}>
          {hasMetric(value) ? formatMetric(value, unit) : EMPTY_METRIC}
        </Text>
        <Text className="text-xs font-semibold text-slate-600 dark:text-slate-300" nativeID={`${id}-ratio`} testID={`${id}-ratio`}>
          {ratio === null ? EMPTY_METRIC : `${Math.round(ratio * 100)} %`}
        </Text>
      </View>
      {exceedsScale(value, target, maxRatio) ? (
        // Con ratio 1 la escala termina en el objetivo, así que "supera el tope"
        // ya no habla de un tope artificial: habla del 100 %, que es el número
        // que el usuario está mirando.
        <Text className="text-[10px] text-amber-600 dark:text-amber-400" nativeID={`${id}-clamped`} testID={`${id}-clamped`}>
          Supera el 100 % de cumplimiento; la barra queda recortada
        </Text>
      ) : null}
    </View>
  );
}

function exceedsScale(value, target, maxRatio) {
  if (!hasMetric(value) || !hasMetric(target) || !(target > 0)) return false;
  return value > target * maxRatio;
}
