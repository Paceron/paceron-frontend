import { useState } from 'react';
import { Text, View } from 'react-native';
import Svg, { G, Rect, Text as SvgText } from 'react-native-svg';
import { useThemeColors } from '../../theme/colors.js';
import { buildMonthlyBars } from '../../utils/payments-chart.js';
import { formatARSCompact } from '../../utils/currency.js';
import { formatMonthShort } from '../../utils/payments-summary.js';

const CHART_HEIGHT = 170;
// Ámbar: lo pendiente se lee como "todavía no entró", distinto del verde de lo
// cobrado. Se ve igual en claro y en oscuro.
const PENDING_COLOR = '#f59e0b';

// Barras de lo cobrado por mes, en bruto o en neto según `points` (ver
// toChartPoints). Si algún mes tiene cuotas sin pagar, cada mes suma una
// segunda barra ámbar con lo pendiente y aparece la leyenda (change
// cobros-pendientes-y-vencimientos del backend). Un mes sin neto se dibuja como
// un contorno con "s/d" y un neto parcial lleva "*": quedan por compatibilidad,
// desde que el neto es bruto − comisión no deberían aparecer. SVG a mano con
// react-native-svg (ya instalado): no hay librería de gráficos en el repo. El
// ancho se mide con onLayout porque SVG necesita números. El Text de svg se
// importa como SvgText para no confundirlo con el de RN.
export function PaymentsMonthlyChart({ points, currentMonth }) {
  const colors = useThemeColors();
  const [width, setWidth] = useState(0);
  const bars = buildMonthlyBars(points, { width, height: CHART_HEIGHT, currentMonth });
  const hasPending = Boolean(points?.some((p) => (p.pending ?? 0) > 0));
  const isEmpty = !points?.some((p) => p.value > 0 || p.missing || (p.pending ?? 0) > 0);
  const plotBottom = CHART_HEIGHT - 18;

  return (
    <View nativeID="payments-monthly-chart-wrapper" testID="payments-monthly-chart-wrapper">
      <View
        nativeID="payments-monthly-chart"
        onLayout={(e) => setWidth(Math.floor(e.nativeEvent.layout.width))}
        style={{ height: CHART_HEIGHT }}
        testID="payments-monthly-chart"
      >
        {width > 0 ? (
          <Svg height={CHART_HEIGHT} nativeID="payments-monthly-chart-svg" testID="payments-monthly-chart-svg" width={width}>
            {bars.map((bar) => (
              <G key={bar.month}>
                {bar.missing ? (
                  <>
                    <Rect
                      fill="none"
                      height={24}
                      rx={4}
                      stroke={colors.outlineVariant}
                      strokeDasharray="4 3"
                      width={bar.width}
                      x={bar.x}
                      y={plotBottom - 24}
                    />
                    <SvgText fill={colors.onSurfaceVariant} fontSize={10} textAnchor="middle" x={bar.x + bar.width / 2} y={plotBottom - 30}>
                      s/d
                    </SvgText>
                  </>
                ) : (
                  <Rect
                    fill={bar.isCurrent ? colors.primary : colors.outlineVariant}
                    height={bar.height}
                    rx={4}
                    width={bar.width}
                    x={bar.x}
                    y={bar.y}
                  />
                )}
                {bar.value > 0 ? (
                  <SvgText
                    fill={colors.onSurfaceVariant}
                    fontSize={10}
                    fontWeight="600"
                    textAnchor="middle"
                    x={bar.x + bar.width / 2}
                    y={bar.y - 4}
                  >
                    {`${formatARSCompact(bar.value)}${bar.partial ? '*' : ''}`}
                  </SvgText>
                ) : null}
                {bar.pending ? (
                  <>
                    <Rect fill={PENDING_COLOR} height={bar.pending.height} opacity={0.85} rx={4} width={bar.pending.width} x={bar.pending.x} y={bar.pending.y} />
                    {bar.pending.value > 0 ? (
                      <SvgText
                        fill={PENDING_COLOR}
                        fontSize={10}
                        fontWeight="600"
                        textAnchor="middle"
                        x={bar.pending.x + bar.pending.width / 2}
                        y={bar.pending.y - 4}
                      >
                        {formatARSCompact(bar.pending.value)}
                      </SvgText>
                    ) : null}
                  </>
                ) : null}
                <SvgText
                  fill={bar.isCurrent ? colors.primary : colors.onSurfaceVariant}
                  fontSize={11}
                  fontWeight={bar.isCurrent ? '700' : '400'}
                  textAnchor="middle"
                  x={bar.centerX}
                  y={bar.labelY}
                >
                  {formatMonthShort(bar.month)}
                </SvgText>
              </G>
            ))}
          </Svg>
        ) : null}
        {isEmpty ? (
          // Sin cobros ni pendientes el gráfico queda sin barras: se avisa en vez de dejarlo en blanco.
          <View className="absolute inset-x-0 top-0 items-center justify-center" nativeID="payments-monthly-chart-empty" pointerEvents="none" style={{ bottom: 28 }} testID="payments-monthly-chart-empty">
            <Text className="text-center text-sm text-slate-500 dark:text-slate-400" nativeID="payments-monthly-chart-empty-text" testID="payments-monthly-chart-empty-text">
              Sin cobros en estos meses
            </Text>
          </View>
        ) : null}
      </View>
      {hasPending ? (
        <View className="mt-3 flex-row flex-wrap items-center gap-4" nativeID="payments-monthly-chart-legend" testID="payments-monthly-chart-legend">
          <LegendItem color={colors.primary} id="payments-monthly-chart-legend-collected" label="Cobrado" />
          <LegendItem color={PENDING_COLOR} id="payments-monthly-chart-legend-pending" label="Pendiente (cuotas sin pagar que vencen en el mes)" />
        </View>
      ) : null}
    </View>
  );
}

function LegendItem({ color, label, id }) {
  return (
    <View className="flex-row items-center gap-1.5" nativeID={id} testID={id}>
      <View className="h-2.5 w-2.5 rounded-sm" nativeID={`${id}-swatch`} style={{ backgroundColor: color }} testID={`${id}-swatch`} />
      <Text className="text-xs text-slate-500 dark:text-slate-400" nativeID={`${id}-label`} testID={`${id}-label`}>{label}</Text>
    </View>
  );
}
