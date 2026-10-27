import { useMemo } from 'react';
import { Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { barPath } from '../../../utils/dashboard-chart.js';
import { EMPTY_METRIC, formatMetric, hasMetric } from '../../../utils/dashboard-format.js';
import { useThemeColors } from '../../../theme/colors.js';

// Ranking horizontal: una fila por corredor con la barra proporcional al valor.
//
// Las barras NO se dibujan con `<Rect>` de SVG sino con `View`s de ancho en
// píxeles, y la geometría sale igual de `barPath` (utils/dashboard-chart.js). La
// razón es que acá la etiqueta es un nombre de persona: el `<Text>` de SVG no
// trunca ni hace wrap, así que un nombre largo o una fila angosta en mobile
// desbordarían el gráfico o se cortarían a mitad de palabra. La fila entera
// sigue siendo texto nativo, que además lee bien el lector de pantalla.
//
// `sort="asc"` invierte el orden para la paleta B: ahí el mejor valor es el MENOR
// (mejor tiempo), y con el orden por defecto el primero de la lista sería el
// peor. Los tres primeros quedan destacados con el color primario y el ícono de
// podio, nunca con el color solo.
// 96 y no más: la fila lleva la barra, el valor y —cuando es la propia— la
// insignia, y con 132 el nombre se quedaba en 64 px en un viewport de 320.
const BAR_WIDTH = 96;
const ROW_HEIGHT = 34;

export function BarChart({
  id,
  items = [],
  unit,
  sort = 'desc',
  highlightTop = 3,
  label,
  selfLabel = 'Vos',
  emptyMessage = 'Sin datos para ordenar',
}) {
  const colors = useThemeColors();
  const ordered = useMemo(() => {
    const list = items.filter((item) => hasMetric(item?.value));
    return [...list].sort((a, b) => (sort === 'asc' ? a.value - b.value : b.value - a.value));
  }, [items, sort]);

  const bars = barPath(ordered.map((item) => item.value), { width: BAR_WIDTH, height: ROW_HEIGHT, gap: 6, horizontal: true });

  return (
    <View nativeID={`${id}-root`} testID={`${id}-root`}>
      {ordered.length === 0 ? (
        <Text className="py-4 text-center text-xs text-slate-500 dark:text-slate-400" nativeID={`${id}-empty`} testID={`${id}-empty`}>
          {emptyMessage}
        </Text>
      ) : null}
      {ordered.map((item, index) => {
        const rowId = `${id}-row-${item.id ?? index}`;
        const bar = bars[index];
        const podium = index < highlightTop;
        return (
          <View
            className={`mb-1.5 flex-row items-center gap-2 rounded-lg px-2 py-1 ${item.isSelf ? 'bg-primary-tint-subtle dark:bg-primary/10' : ''}`}
            key={rowId}
            nativeID={rowId}
            testID={rowId}
          >
            <Text className="w-5 text-xs font-semibold text-slate-500 dark:text-slate-400" nativeID={`${rowId}-rank`} testID={`${rowId}-rank`}>
              {item.position ?? index + 1}
            </Text>
            <View className="flex-1" nativeID={`${rowId}-name-row`} testID={`${rowId}-name-row`}>
              <Text className="text-sm text-slate-800 dark:text-slate-100" nativeID={`${rowId}-name`} numberOfLines={1} testID={`${rowId}-name`}>
                {item.label}
              </Text>
              {item.sublabel ? (
                <Text className="text-[10px] text-slate-500 dark:text-slate-400" nativeID={`${rowId}-sublabel`} testID={`${rowId}-sublabel`}>
                  {item.sublabel}
                </Text>
              ) : null}
            </View>
            <View className="h-3 overflow-hidden rounded-full bg-slate-200 dark:bg-surface-3" nativeID={`${rowId}-track`} testID={`${rowId}-track`} style={{ width: BAR_WIDTH }}>
              <View
                className="h-full rounded-full"
                nativeID={`${rowId}-bar`}
                testID={`${rowId}-bar`}
                style={{ width: Math.max(bar?.length ?? 0, bar?.value === 0 ? 2 : 0), backgroundColor: podium ? colors.primary : colors.outlineVariant }}
              />
            </View>
            <View className="w-20 flex-row items-center justify-end gap-1" nativeID={`${rowId}-value-row`} testID={`${rowId}-value-row`}>
              {podium ? <MaterialCommunityIcons color={colors.primary} name="podium-gold" size={13} /> : null}
              <Text className="text-xs font-semibold text-slate-800 dark:text-slate-100" nativeID={`${rowId}-value`} testID={`${rowId}-value`}>
                {hasMetric(item.value) ? formatMetric(item.value, unit) : EMPTY_METRIC}
              </Text>
            </View>
            {item.isSelf ? (
              <View className="rounded-full bg-primary px-2 py-0.5" nativeID={`${rowId}-self-badge`} testID={`${rowId}-self-badge`}>
                <Text className="text-[10px] font-bold text-[#111518]" nativeID={`${rowId}-self-label`} testID={`${rowId}-self-label`}>
                  {selfLabel}
                </Text>
              </View>
            ) : null}
          </View>
        );
      })}
    </View>
  );
}
