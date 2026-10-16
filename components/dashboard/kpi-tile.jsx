import { Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { EMPTY_METRIC, formatDelta, formatMetric, formatVerdict, hasMetric, verdictIcon } from '../../utils/dashboard-format.js';
import { useThemeColors } from '../../theme/colors.js';

// Tile de un KPI: número grande, delta, veredicto y "—" ante `null`.
//
// NO reusa `components/shared/stat-tile.jsx`: ese no tiene slot de unidad, ni
// delta, ni veredicto —meterlos ahí sería agregar props que ninguna de sus
// pantallas actuales necesita, y el resultado sería el mismo componente con la
// mitad de las ramas muertas.
//
// El `null` se muestra como "—" en todos los lugares (número, delta y veredicto):
// un 0 de cumplimiento se lee como "no cumplió nada" cuando en realidad no se
// midió (design.md D5). El veredicto siempre lleva ícono + texto además del
// color, para que el tono no sea el único portador del significado.
const VERDICT_STYLES = {
  improving: { text: 'text-[#3c6b12] dark:text-primary', icon: '#8cc63e' },
  stable: { text: 'text-amber-800 dark:text-amber-300', icon: null },
  regressing: { text: 'text-red-600 dark:text-red-400', icon: '#ba1a1a' },
};

export function KpiTile({ id, label, value, unit, delta, deltaUnit, verdict, hint, icon, emphasis = false, hovered = false }) {
  const colors = useThemeColors();
  const verdictStyle = VERDICT_STYLES[verdict] ?? null;

  // Las seis cifras vuelven a ser cards del MISMO tamaño que las de gráficos.
  //
  // Se intentó lo contrario —una cifra gigante arriba y cuatro cifras sueltas
  // abajo— y no funciona acá: con seis números que el usuario compara entre sí,
  // un tamaño especial para dos de ellos rompe la comparación. El tamaño
  // uniforme es lo que hace escaneable la grilla.
  //
  // El hover en ambar marca el área sensible sin obligar a acertar el punto
  // para abrir el tooltip. Mismo amber que el banner de calidad.
  const surfaceClass = hovered
    ? 'border-amber-500 bg-amber-100 dark:border-amber-400 dark:bg-amber-900/50'
    : emphasis
      ? 'border-amber-600 bg-amber-200 dark:border-amber-500 dark:bg-amber-900/60'
      : 'border-amber-300 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/25';

  return (
    <View
      className={`rounded-2xl border p-3 ${surfaceClass}`}
      nativeID={`${id}-root`}
      testID={`${id}-root`}
    >
      <View className="flex-row items-center gap-1" nativeID={`${id}-header`} testID={`${id}-header`}>
        {icon ? <MaterialCommunityIcons color={colors.warning ?? '#b45309'} name={icon} size={13} /> : null}
        <Text className="flex-1 text-[11px] leading-4 text-amber-800 dark:text-amber-200" nativeID={`${id}-label`} testID={`${id}-label`}>
          {label}
        </Text>
      </View>
      <Text className={`mt-1 font-bold text-amber-950 dark:text-amber-50 ${emphasis ? 'text-2xl' : 'text-lg'}`} nativeID={`${id}-value`} numberOfLines={1} testID={`${id}-value`}>
        {hasMetric(value) ? formatMetric(value, unit) : EMPTY_METRIC}
      </Text>
      {delta !== undefined ? (
        <View className="mt-0.5 flex-row items-center gap-1" nativeID={`${id}-delta-row`} testID={`${id}-delta-row`}>
          <Text className="text-xs font-semibold text-amber-900 dark:text-amber-100" nativeID={`${id}-delta`} testID={`${id}-delta`}>
            {hasMetric(delta) ? formatDelta(delta, deltaUnit) : EMPTY_METRIC}
          </Text>
          {verdict ? (
            <View className="flex-row items-center" nativeID={`${id}-verdict`} testID={`${id}-verdict`}>
              <MaterialCommunityIcons color={verdictStyle?.icon ?? colors.onSurfaceVariant} name={verdictIcon(verdict)} size={13} />
              <Text className={`text-[11px] ${verdictStyle?.text ?? 'text-amber-800 dark:text-amber-300'}`} nativeID={`${id}-verdict-label`} testID={`${id}-verdict-label`}>
                {formatVerdict(verdict)}
              </Text>
            </View>
          ) : null}
        </View>
      ) : null}
      {hint ? (
        <Text className="mt-0.5 text-[10px] leading-4 text-amber-700 dark:text-amber-400" nativeID={`${id}-hint`} testID={`${id}-hint`}>
          {hint}
        </Text>
      ) : null}
    </View>
  );
}
