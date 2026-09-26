import { useState } from 'react';
import { View } from 'react-native';
import Svg, { G, Rect, Text as SvgText } from 'react-native-svg';
import { useThemeColors } from '../../theme/colors.js';
import { buildMonthlyBars } from '../../utils/payments-chart.js';
import { formatARSCompact } from '../../utils/currency.js';
import { formatMonthShort } from '../../utils/payments-summary.js';

const CHART_HEIGHT = 170;

// Barras del bruto cobrado por mes. SVG a mano con react-native-svg (ya
// instalado): no hay librería de gráficos en el repo y para 6 barras no vale
// la pena sumar una. El ancho se mide con onLayout porque SVG necesita números.
// El Text de svg se importa como SvgText para no confundirlo con el de RN.
export function PaymentsMonthlyChart({ monthly }) {
  const colors = useThemeColors();
  const [width, setWidth] = useState(0);
  const bars = buildMonthlyBars(monthly, { width, height: CHART_HEIGHT });

  return (
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
              <Rect
                fill={bar.isCurrent ? colors.primary : colors.outlineVariant}
                height={bar.height}
                rx={4}
                width={bar.width}
                x={bar.x}
                y={bar.y}
              />
              {bar.value > 0 ? (
                <SvgText
                  fill={colors.onSurfaceVariant}
                  fontSize={10}
                  fontWeight="600"
                  textAnchor="middle"
                  x={bar.x + bar.width / 2}
                  y={bar.y - 4}
                >
                  {formatARSCompact(bar.value)}
                </SvgText>
              ) : null}
              <SvgText
                fill={bar.isCurrent ? colors.primary : colors.onSurfaceVariant}
                fontSize={11}
                fontWeight={bar.isCurrent ? '700' : '400'}
                textAnchor="middle"
                x={bar.x + bar.width / 2}
                y={bar.labelY}
              >
                {formatMonthShort(bar.month)}
              </SvgText>
            </G>
          ))}
        </Svg>
      ) : null}
    </View>
  );
}
