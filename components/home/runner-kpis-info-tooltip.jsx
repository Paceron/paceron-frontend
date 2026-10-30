import { useRouter } from 'expo-router';
import { Pressable, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { KpiTooltip } from '../dashboard/kpi-tooltip.jsx';
import { useThemeColors } from '../../theme/colors.js';

// Tooltip informativo del encabezado de la tarjeta. No usa hover: el bubble
// tiene un link adentro y abrirlo al pasar el mouse lo cerraría justo cuando el
// usuario va hacia el link. Se abre con click/tap y, en web, el foco se mantiene
// mientras el usuario tabula desde el trigger hasta el link.
export function RunnerKpisInfoTooltip({ onOpenChange }) {
  const router = useRouter();
  const colors = useThemeColors();

  return (
    <KpiTooltip
      bubbleClassName="w-72 max-w-full"
      bubbleContent={(
        <View nativeID="runner-kpis-info-bubble-content" testID="runner-kpis-info-bubble-content">
          <Text className="text-[11px] leading-4 text-white" nativeID="runner-kpis-info-bubble-text" testID="runner-kpis-info-bubble-text">
            Resumen de tu rendimiento. Para más detalle, mirá la
          </Text>
          <Pressable
            accessibilityRole="link"
            className="mt-1 self-start"
            nativeID="runner-kpis-info-link"
            onPress={() => router.push('/teams')}
            testID="runner-kpis-info-link"
          >
            <Text className="text-[11px] font-semibold leading-4 text-primary underline" nativeID="runner-kpis-info-link-text" testID="runner-kpis-info-link-text">
              pestaña de rendimiento de tus equipos
            </Text>
          </Pressable>
        </View>
      )}
      hint="Más información sobre tus números"
      id="runner-kpis-info"
      onOpenChange={onOpenChange}
      openOnHover={false}
      showSeries={false}
      showTolerance={false}
    >
      <View className="flex-row items-center gap-1" nativeID="runner-kpis-info-trigger-content" testID="runner-kpis-info-trigger-content">
        <Text
          className="text-[10px] font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500"
          nativeID="runner-kpis-kicker"
          testID="runner-kpis-kicker"
        >
          Tus números
        </Text>
        <MaterialCommunityIcons color={colors.onSurfaceVariant} name="information-outline" size={12} />
      </View>
    </KpiTooltip>
  );
}
