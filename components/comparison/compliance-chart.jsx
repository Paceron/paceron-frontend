import { useState } from 'react';
import { Text, View } from 'react-native';
import Svg, { G, Line, Rect, Text as SvgText } from 'react-native-svg';
import { useThemeColors } from '../../theme/colors.js';
import { buildComplianceBars, shortDateLabel } from '../../utils/compliance-chart.js';
import { COMPLIANCE_TONE_FILL } from './compliance-badge.jsx';

const CHART_HEIGHT = 170;
const LABEL_HEIGHT = 18;
const VALUE_HEIGHT = 16;

// Cumplimiento por sesión en el rango, escala fija 0-100 % con una línea de
// referencia en 100 %. SVG a mano como payments-monthly-chart.jsx (no hay
// librería de gráficos en el repo): el ancho se mide con onLayout porque SVG
// necesita números. Tocar una barra abre el detalle de esa sesión.
export function ComplianceChart({ sessions, onSelectSession }) {
  const colors = useThemeColors();
  const [width, setWidth] = useState(0);
  const bars = buildComplianceBars(sessions, { width, height: CHART_HEIGHT, labelHeight: LABEL_HEIGHT, valueHeight: VALUE_HEIGHT });
  const plotTop = VALUE_HEIGHT;

  return (
    <View
      accessibilityLabel={`Cumplimiento de ${sessions?.length ?? 0} sesiones`}
      nativeID="compliance-chart"
      onLayout={(e) => setWidth(Math.floor(e.nativeEvent.layout.width))}
      style={{ height: CHART_HEIGHT }}
      testID="compliance-chart"
    >
      {width > 0 && bars.length > 0 ? (
        <Svg height={CHART_HEIGHT} nativeID="compliance-chart-svg" testID="compliance-chart-svg" width={width}>
          <Line stroke={colors.outlineVariant} strokeDasharray="4 3" x1={0} x2={width} y1={plotTop} y2={plotTop} />
          {bars.map((bar) => (
            <G key={bar.sessionInstanceId} onPress={onSelectSession ? () => onSelectSession(bar.sessionInstanceId) : undefined}>
              <Rect fill={COMPLIANCE_TONE_FILL[bar.tone]} height={bar.height} rx={Math.min(4, bar.width / 2)} width={bar.width} x={bar.x} y={bar.y} />
              {bar.showValue ? (
                <SvgText fill={colors.onSurfaceVariant} fontSize={10} fontWeight="600" textAnchor="middle" x={bar.x + bar.width / 2} y={Math.max(bar.y - 4, 10)}>
                  {`${Math.round(bar.compliancePct)}%`}
                </SvgText>
              ) : null}
              {bar.showLabel ? (
                <SvgText fill={colors.onSurfaceVariant} fontSize={10} textAnchor="middle" x={Math.min(Math.max(bar.x + bar.width / 2, 14), width - 14)} y={bar.labelY}>
                  {shortDateLabel(bar.date)}
                </SvgText>
              ) : null}
            </G>
          ))}
        </Svg>
      ) : null}
      {!sessions?.length ? (
        <View className="absolute inset-0 items-center justify-center" nativeID="compliance-chart-empty" pointerEvents="none" testID="compliance-chart-empty">
          <Text className="text-center text-sm text-slate-500 dark:text-slate-400" nativeID="compliance-chart-empty-text" testID="compliance-chart-empty-text">
            Sin sesiones en este rango
          </Text>
        </View>
      ) : null}
    </View>
  );
}
