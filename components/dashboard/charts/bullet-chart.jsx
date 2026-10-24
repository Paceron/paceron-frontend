import { Text, View } from 'react-native';
import Svg, { Line, Rect, Text as SvgText } from 'react-native-svg';
import { bulletBar } from '../../../utils/dashboard-chart.js';
import { formatMetric, hasMetric } from '../../../utils/dashboard-format.js';
import { useThemeColors } from '../../../theme/colors.js';
import { ChartSurface } from './chart-surface.jsx';

// Geometría de la barra. Es más gruesa y más alta que una barra de progreso
// plana a propósito: en una card que llega a 768 px de ancho una barra de 14 px
// se lee como un renglón, no como una medición.
const HEIGHT = 64;
const BAR_TOP = 14;
const BAR_HEIGHT = 26;
const BAR_RADIUS = BAR_HEIGHT / 2;
const MIN_FILL_WIDTH = 6;
// Línea base de las dos etiquetas de abajo (el valor logrado y el tope de escala).
const LABEL_Y = BAR_TOP + BAR_HEIGHT + 16;
// Ancho reservado a la derecha para la etiqueta del tope ("100 %"): el valor
// logrado se corre a su izquierda en vez de pisarla cuando el cumplimiento llega
// al final de la barra.
const EDGE_RESERVE = 56;
// Y no se sale por la izquierda cuando el cumplimiento es muy bajo.
const LABEL_MIN_X = 24;

// Cumplimiento del objetivo: barra de logro contra el objetivo.
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
//
// Plano, sin volumen (2026-10-17): se probó un tubo 3D armado con `LinearGradient`
// (canal hundido + tubo convexo + brillo especular, ya que react-native-svg no
// soporta filtros) y se descartó — el volumen le restaba lectura al número, que es
// lo que la card existe para mostrar. Queda un track plano y una barra plana; el
// peso lo da el GROSOR, no un efecto. Las tres zonas cualitativas son las muescas
// en 80 % y 95 % (antes eran tres rectángulos translúcidos con el mismo fill, que
// se leían como un solo track gris).
//
// SIN marcador de objetivo (2026-10-17): con `maxRatio = 1` la escala termina
// exactamente en el objetivo, así que `targetX` cae SIEMPRE sobre el borde derecho
// del track — la línea vertical se leía como un borde suelto al final de la barra,
// no como una marca. Si alguna vez se vuelve a un `maxRatio` > 1 (habilitar el
// "sobre-cumplimiento"), el marcador vuelve a caer adentro del track y hay que
// reponerlo.
//
// Las DOS etiquetas de abajo son las únicas cifras del gráfico (2026-10-17): el
// valor logrado, debajo del extremo de la barra, y el tope de escala pegado al
// borde derecho. Antes había cuatro números para el mismo dato —la leyenda
// "objetivo 100 %" centrada y, abajo del SVG, el valor grande más el porcentaje
// del footer, que con `target = 100` era literalmente el valor repetido— y dos de
// ellos competían por el mismo lugar cuando la barra llegaba al final. No queda
// ninguno: el detalle fino sigue en el `accessibilityLabel` del `ChartSurface` y
// en el tooltip del KPI, que es donde se consulta, no en la card.
const BANDS = [
  { id: 'short', from: 0, to: 0.8 },
  { id: 'near', from: 0.8, to: 0.95 },
  { id: 'met', from: 0.95, to: 1 },
];

export function BulletChart({ id, value, target, unit, label, maxRatio = 1 }) {
  const colors = useThemeColors();

  return (
    <View nativeID={`${id}-root`} testID={`${id}-root`}>
      <ChartSurface height={HEIGHT} id={id} label={label}>
        {(width) => {
          const geometry = bulletBar(value, target, { width, height: HEIGHT, maxRatio, bands: BANDS });
          if (!geometry) return null;

          // Sin dato la barra no se dibuja pero conserva su lugar: el track es el
          // mismo para todas las filas. El radio se recorta con el ancho para que
          // un cumplimiento chico sea un punto redondo y no una píldora deforme.
          const fillWidth = Math.max(geometry.valueWidth, geometry.hasValue ? MIN_FILL_WIDTH : 0);
          const fillRadius = Math.min(BAR_RADIUS, fillWidth / 2);
          // El corte en 0 es el borde del track, no una muesca.
          const separators = geometry.bands.filter((band) => band.from > 0).map((band) => band.x);
          // El valor logrado va centrado debajo del extremo de la barra; solo
          // cambia de anclaje si se acercaría al tope de la derecha.
          const valueAtEdge = fillWidth > width - EDGE_RESERVE;
          const valueLabelX = valueAtEdge ? width - EDGE_RESERVE : Math.max(fillWidth, LABEL_MIN_X);

          return (
            <Svg height={HEIGHT} nativeID={`${id}-svg`} testID={`${id}-svg`} width={width}>
              <Rect
                fill={colors.outlineVariant}
                height={BAR_HEIGHT}
                nativeID={`${id}-track`}
                opacity={0.28}
                rx={BAR_RADIUS}
                testID={`${id}-track`}
                width={width}
                x={0}
                y={BAR_TOP}
              />

              {separators.map((x) => (
                <Line
                  key={`separator-${x}`}
                  nativeID={`${id}-separator-${Math.round(x)}`}
                  stroke={colors.outlineVariant}
                  strokeWidth={1}
                  testID={`${id}-separator-${Math.round(x)}`}
                  x1={x}
                  x2={x}
                  y1={BAR_TOP}
                  y2={BAR_TOP + BAR_HEIGHT}
                />
              ))}

              <Rect
                fill={colors.primary}
                height={BAR_HEIGHT}
                nativeID={`${id}-value-bar`}
                rx={fillRadius}
                testID={`${id}-value-bar`}
                width={fillWidth}
                x={0}
                y={BAR_TOP}
              />

              {geometry.hasTarget && geometry.hasValue ? (
                <SvgText
                  fill={colors.onSurface}
                  fontSize={11}
                  fontWeight="700"
                  nativeID={`${id}-value-label`}
                  testID={`${id}-value-label`}
                  textAnchor={valueAtEdge ? 'end' : 'middle'}
                  x={valueLabelX}
                  y={LABEL_Y}
                >
                  {formatMetric(value, unit)}
                </SvgText>
              ) : null}

              {geometry.hasTarget ? (
                <SvgText
                  fill={colors.onSurfaceVariant}
                  fontSize={11}
                  nativeID={`${id}-scale-max`}
                  testID={`${id}-scale-max`}
                  textAnchor="end"
                  x={width}
                  y={LABEL_Y}
                >
                  {formatMetric(geometry.max, unit)}
                </SvgText>
              ) : (
                <SvgText
                  fill={colors.onSurfaceVariant}
                  fontSize={11}
                  nativeID={`${id}-no-target`}
                  testID={`${id}-no-target`}
                  textAnchor="middle"
                  x={width / 2}
                  y={LABEL_Y}
                >
                  sin objetivo cargado
                </SvgText>
              )}
            </Svg>
          );
        }}
      </ChartSurface>
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
