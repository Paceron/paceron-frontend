import { useState } from 'react';
import { Text, View } from 'react-native';
import Svg, { Circle, Line, Path, Text as SvgText } from 'react-native-svg';
import { areaPath, bandPath, bandShares, BAND_LABELS, DASHBOARD_BANDS, lineSeries, tickIndexes } from '../../../utils/dashboard-chart.js';
import { formatMetric } from '../../../utils/dashboard-format.js';
import { useThemeColors } from '../../../theme/colors.js';
import { BAND_COLORS } from './band-tones.js';
import { ChartSurface } from './chart-surface.jsx';
import { LineChartHotspots } from './line-chart-tooltip.jsx';

const TOP_PADDING = 14;
const AXIS_LABEL_H = 16;
// Aire vertical del dominio 0–100: sin esto un 100 % toca el borde de arriba y
// el punto queda recortado por el `overflow: hidden` que todo `<svg>` tiene.
const Y_INSET = 6;

// Cumplimiento por período, como ÁREA APILADA de las cuatro bandas contra un eje
// fijo de 0 a 100 %: cumplió (abajo), cerca, no cumplió y sin dato (arriba).
//
// Antes eran dos áreas (cumplió y "dentro o cerca") y `missed` sólo bajaba esas
// curvas: no tenía banda propia y encima compartía el hueco de arriba con
// `unknown`, así que "no cumplió" no se leía. Apiladas, cada banda tiene grosor
// real y el período suma 100 % de sus series con objetivo.
//
// Las bandas llegan CALCULADAS del backend (`band_counts` por bucket) y el front
// no recalcula los umbrales: los de `near` y el signo invertido del eje temporal
// viven en domains/dashboard/band.go. Acá solo se reparte lo que ya vino (D5).
//
// El eje es FIJO a 0–100 (y no el rango de los datos) porque lo que se lee es la
// tendencia contra el objetivo, no contra sí misma: con autoscale, un período
// plano en 92 % se vería igual que uno plano en 12 %.
//
// La franja ámbar (`near`) sigue siendo la zona de tolerancia, ahora como banda
// de la pila. Un bucket sin series comparables (`total: 0`) corta la pila entera
// en vez de caer a 0: un 0 dibujaría una caída que no pasó.
export function ComplianceTrendChart({ id, buckets = [], height = 190, label, emptyMessage = 'Sin series con objetivo en el período' }) {
  const colors = useThemeColors();
  const [activeIndex, setActiveIndex] = useState(null);
  const shares = buckets.map((bucket) => bandShares(bucket?.counts));
  // Bordes de la pila: `met` = techo de "cumplió", `nearTop` = techo de "cerca"
  // (`met + near`), `missedTop` = techo de "no cumplió" (`+ missed`). El cuarto
  // techo es el 100 fijo del eje, arriba de todo.
  const metValues = shares.map((share) => share.stack[0]);
  const nearTopValues = shares.map((share) => share.stack[1]);
  const missedTopValues = shares.map((share) => share.stack[2]);
  const hasValues = shares.some((share) => share.total > 0);

  return (
    <View nativeID={`${id}-wrapper`} testID={`${id}-wrapper`}>
      <ChartSurface height={height} id={id} label={label}>
        {(width) => {
          const plotHeight = height - TOP_PADDING - AXIS_LABEL_H;
          const frame = { width, height: plotHeight, domain: [0, 100], minimumRange: 0, inset: 4, yInset: Y_INSET };
          const met = lineSeries(metValues, frame);
          const nearTop = lineSeries(nearTopValues, frame);
          const missedTop = lineSeries(missedTopValues, frame);
          const baseline = met.y(0) ?? plotHeight;
          const ceiling = met.y(100) ?? 0;
          // Los puntos se copian con su etiqueta porque el hotspot de la línea la
          // usa en el `accessibilityLabel`: `lineSeries` no la arrastra.
          const points = met.points.map((point, index) => ({ ...point, label: buckets[index]?.label }));

          return (
            <View
              // `relative` ancla el overlay de hotspots y el tooltip.
              style={{ position: 'relative' }}
              nativeID={`${id}-plot`}
              testID={`${id}-plot`}
            >
              <Svg height={plotHeight} nativeID={`${id}-svg`} testID={`${id}-svg`} width={width}>
                {[0, 50, 100].map((value) => {
                  const y = met.y(value);
                  if (y === null) return null;
                  return (
                    <Line
                      key={value}
                      nativeID={`${id}-grid-${value}`}
                      stroke={colors.outlineVariant}
                      strokeDasharray="3 3"
                      strokeWidth={1}
                      testID={`${id}-grid-${value}`}
                      x1={0}
                      x2={width}
                      y1={y}
                      y2={y}
                    />
                  );
                })}
                {/* Área apilada, de abajo hacia arriba: cumplió, cerca, no
                    cumplió y sin dato. Cada banda es la franja entre dos bordes
                    acumulados, así que "no cumplió" tiene grosor propio en vez de
                    quedar mezclado con "sin dato" en el hueco de arriba. `unknown`
                    va contra el techo (es lo que no se pudo evaluar) y `missed`
                    justo debajo, pegado a la zona de tolerancia. */}
                {areaPath(missedTop.points, ceiling).map((d, index) => (
                  <Path
                    d={d}
                    fill={BAND_COLORS.unknown}
                    fillOpacity={0.18}
                    key={`unknown-${index}`}
                    nativeID={`${id}-unknown-area-${index}`}
                    stroke="none"
                    testID={`${id}-unknown-area-${index}`}
                  />
                ))}
                {bandPath(missedTop.points, nearTop.points).map((d, index) => (
                  <Path
                    d={d}
                    fill={BAND_COLORS.missed}
                    fillOpacity={0.3}
                    key={`missed-${index}`}
                    nativeID={`${id}-missed-area-${index}`}
                    stroke="none"
                    testID={`${id}-missed-area-${index}`}
                  />
                ))}
                {bandPath(nearTop.points, met.points).map((d, index) => (
                  <Path
                    d={d}
                    fill={BAND_COLORS.near}
                    fillOpacity={0.3}
                    key={`near-${index}`}
                    nativeID={`${id}-near-area-${index}`}
                    stroke="none"
                    testID={`${id}-near-area-${index}`}
                  />
                ))}
                {areaPath(met.points, baseline).map((d, index) => (
                  <Path
                    d={d}
                    fill={BAND_COLORS.met}
                    fillOpacity={0.35}
                    key={`met-${index}`}
                    nativeID={`${id}-met-area-${index}`}
                    stroke="none"
                    testID={`${id}-met-area-${index}`}
                  />
                ))}
                {met.path ? (
                  <Path
                    d={met.path}
                    fill="none"
                    nativeID={`${id}-met-line`}
                    stroke={BAND_COLORS.met}
                    strokeWidth={2.5}
                    testID={`${id}-met-line`}
                  />
                ) : null}
                {met.points.map((point) =>
                  point.y === null ? null : (
                    <Circle
                      cx={point.x}
                      cy={point.y}
                      fill={BAND_COLORS.met}
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
                  100 %
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
                  0 %
                </SvgText>
              </Svg>
              {hasValues ? (
                <>
                  <LineChartHotspots
                    activeIndex={activeIndex}
                    id={id}
                    onActive={setActiveIndex}
                    onDeactivate={() => setActiveIndex(null)}
                    plotHeight={plotHeight}
                    points={points}
                    width={width}
                  />
                  {activeIndex !== null && met.points[activeIndex] && met.points[activeIndex].y !== null ? (
                    <ComplianceTrendTooltip
                      id={id}
                      point={{ ...points[activeIndex], width }}
                      share={shares[activeIndex]}
                      width={width}
                    />
                  ) : null}
                </>
              ) : null}
              <View className="flex-row justify-between" nativeID={`${id}-x-axis`} testID={`${id}-x-axis`}>
                {tickIndexes(buckets.length).map((index) => (
                  <Text
                    className="text-[10px] text-slate-500 dark:text-slate-400"
                    key={index}
                    nativeID={`${id}-x-axis-${index}`}
                    testID={`${id}-x-axis-${index}`}
                  >
                    {buckets[index]?.label ?? ''}
                  </Text>
                ))}
              </View>
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

// Tooltip de un período. Mismo criterio que el de la línea: overlay `absolute`
// con un `Pressable` invisible arriba del `<Svg>` (react-native-svg no expone
// `onMouseEnter`), hover en web y tap en nativo, y se corre contra los bordes para
// no salirse del gráfico.
//
// Lista las CUATRO bandas del período con su porcentaje y su conteo: el porcentaje
// solo no explica de qué está hecho el 100 % de la barra apilada, y el conteo es
// lo único que dice sobre cuántas series se está hablando.
function ComplianceTrendTooltip({ id, point, share, width }) {
  if (!point || !share) return null;
  const flip = point.x > width * 0.6;

  return (
    <View
      style={{
        pointerEvents: 'none',
        position: 'absolute',
        top: Math.max(0, point.y - 12),
        left: flip ? undefined : point.x + 12,
        right: flip ? width - point.x + 12 : undefined,
        alignItems: flip ? 'flex-end' : 'flex-start',
      }}
      nativeID={`${id}-tooltip`}
      testID={`${id}-tooltip`}
    >
      <View
        className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 shadow-sm dark:border-slate-600 dark:bg-surface-2"
        nativeID={`${id}-tooltip-box`}
        testID={`${id}-tooltip-box`}
      >
        <Text className="text-[11px] font-medium text-slate-500 dark:text-slate-400" nativeID={`${id}-tooltip-x`} testID={`${id}-tooltip-x`}>
          {point.label ?? ''}
        </Text>
        {DASHBOARD_BANDS.map((band) => (
          <TooltipRow
            color={BAND_COLORS[band]}
            id={`${id}-tooltip-${band}`}
            key={band}
            label={BAND_LABELS[band]}
            value={`${formatMetric(share[`${band}Share`], '%')} · ${share.counts?.[band] ?? 0} de ${share.total}`}
          />
        ))}
      </View>
    </View>
  );
}

function TooltipRow({ id, color, label, value }) {
  return (
    <View className="flex-row items-center gap-1.5" nativeID={id} testID={id}>
      <View
        style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: color }}
        nativeID={`${id}-dot`}
        testID={`${id}-dot`}
      />
      <Text className="text-[11px] text-slate-500 dark:text-slate-400" nativeID={`${id}-label`} testID={`${id}-label`}>
        {label}
      </Text>
      <Text className="text-[11px] font-bold text-slate-900 dark:text-white" nativeID={`${id}-value`} testID={`${id}-value`}>
        {value}
      </Text>
    </View>
  );
}
