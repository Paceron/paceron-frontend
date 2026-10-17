import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { EMPTY_METRIC, formatMetric, hasMetric } from '../../utils/dashboard-format.js';
import { useThemeColors } from '../../theme/colors.js';

// Ranking del equipo, paginado y ordenable SOLO por las cuatro columnas de la
// whitelist del backend (`DASHBOARD_LEADERBOARD_SORTS`): pedir un orden fuera de
// esa lista gasta un 400 con code estable que no le dice nada al usuario.
//
// La posición que se muestra es el `position` GLOBAL de la respuesta, no el
// índice de la fila dentro de la página: así se puede decir "vas 14°" sin traer
// todas las páginas. `rank` (dentro de la página) no se usa para eso.
//
// La fila propia se marca por `is_self` —el backend lo resuelve comparando con el
// llamador— y no por comparar ids en el front, que es donde aparecería el clásico
// number-vs-string del deep link.
export const COLUMNS = [
  { key: 'best_time_ms', label: 'Mejor tiempo', unitKey: 'best_time', align: 'right' },
  { key: 'mean_speed_kph', label: 'Ritmo medio', unitKey: 'speed', align: 'right' },
  { key: 'total_distance_m', label: 'Distancia', unitKey: 'distance', align: 'right' },
  { key: 'compliance_rate', label: 'Cumplimiento', unitKey: 'compliance', align: 'right' },
];

export function LeaderboardTable({
  id = 'dashboard-leaderboard',
  items = [],
  total = 0,
  sort,
  order,
  units,
  hasMore = false,
  loadingMore = false,
  onSort,
  onLoadMore,
  selfPosition = null,
}) {
  const colors = useThemeColors();


  return (
    <View className="mb-4 rounded-2xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-surface" nativeID={id} testID={id}>
      <View className="flex-row items-center gap-2 border-b border-slate-100 p-4 dark:border-slate-800" nativeID={`${id}-header`} testID={`${id}-header`}>
        <MaterialCommunityIcons color={colors.primary} name="podium" size={16} />
        <Text className="flex-1 text-sm font-bold text-slate-900 dark:text-white" nativeID={`${id}-title`} testID={`${id}-title`}>
          Ranking del equipo
        </Text>
        <Text className="text-[11px] text-slate-500 dark:text-slate-400" nativeID={`${id}-total`} testID={`${id}-total`}>
          {`${total} corredores`}
        </Text>
      </View>

      {selfPosition ? (
        <View className="flex-row items-center gap-2 bg-primary-tint-subtle px-4 py-2 dark:bg-primary/10" nativeID={`${id}-self-position`} testID={`${id}-self-position`}>
          <MaterialCommunityIcons color={colors.primary} name="map-marker" size={14} />
          <Text className="text-xs font-semibold text-[#3c6b12] dark:text-primary" nativeID={`${id}-self-position-text`} testID={`${id}-self-position-text`}>
            {`Vas ${selfPosition}°`}
          </Text>
        </View>
      ) : null}

      <View className="flex-row border-b border-slate-100 px-4 py-2 dark:border-slate-800" nativeID={`${id}-columns`} testID={`${id}-columns`}>
        <Text className="flex-1 text-[11px] uppercase tracking-wide text-slate-400 dark:text-slate-500" nativeID={`${id}-column-name`} testID={`${id}-column-name`}>
          Corredor
        </Text>
        {COLUMNS.map((column) => {
          const activeSort = sort === column.key;
          return (
            <Pressable
              accessibilityLabel={`Ordenar por ${column.label}`}
              accessibilityRole="button"
              className="w-20 items-end px-1"
              key={column.key}
              nativeID={`${id}-sort-${column.key}`}
              onPress={() => onSort?.(column.key)}
              testID={`${id}-sort-${column.key}`}
            >
              <View className="flex-row items-center gap-0.5" nativeID={`${id}-sort-${column.key}-row`} testID={`${id}-sort-${column.key}-row`}>
                <Text className="text-[11px] uppercase tracking-wide text-slate-400 dark:text-slate-500" nativeID={`${id}-sort-${column.key}-label`} testID={`${id}-sort-${column.key}-label`}>
                  {column.label}
                </Text>
                {activeSort ? (
                  <MaterialCommunityIcons
                    color={colors.primary}
                    name={order === 'asc' ? 'chevron-up' : 'chevron-down'}
                    size={12}
                  />
                ) : null}
              </View>
            </Pressable>
          );
        })}
      </View>

      {items.map((item, index) => {
        const rowId = `${id}-row-${item.athlete_user_id ?? index}`;
        return (
          <View
            className={`flex-row items-center border-b border-slate-50 px-4 py-2.5 last:border-b-0 dark:border-slate-800/60 ${item.is_self ? 'bg-primary-tint-subtle dark:bg-primary/10' : ''}`}
            key={rowId}
            nativeID={rowId}
            testID={rowId}
          >
            <View className="flex-1 flex-row items-center gap-2" nativeID={`${rowId}-name-row`} testID={`${rowId}-name-row`}>
              <Text className="w-6 text-xs font-semibold text-slate-400 dark:text-slate-500" nativeID={`${rowId}-position`} testID={`${rowId}-position`}>
                {`${item.position}°`}
              </Text>
              <Text className="flex-1 text-sm text-slate-800 dark:text-slate-100" nativeID={`${rowId}-name`} numberOfLines={1} testID={`${rowId}-name`}>
                {`${item.name} ${item.surname}`.trim()}
              </Text>
              {item.is_self ? (
                <View className="rounded-full bg-primary px-2 py-0.5" nativeID={`${rowId}-badge`} testID={`${rowId}-badge`}>
                  <Text className="text-[10px] font-bold text-[#111518]" nativeID={`${rowId}-badge-label`} testID={`${rowId}-badge-label`}>
                    Vos
                  </Text>
                </View>
              ) : null}
            </View>
            {COLUMNS.map((column) => (
              <Text
                className="w-20 px-1 text-right text-xs text-slate-700 dark:text-slate-200"
                key={column.key}
                nativeID={`${rowId}-${column.key}`}
                testID={`${rowId}-${column.key}`}
              >
                {hasMetric(item[column.key]) ? formatMetric(item[column.key], units?.[column.unitKey]) : EMPTY_METRIC}
              </Text>
            ))}
          </View>
        );
      })}

      {hasMore ? (
        <Pressable
          accessibilityLabel="Cargar más corredores"
          accessibilityRole="button"
          className="items-center py-3 hover:bg-slate-50 dark:hover:bg-slate-800"
          disabled={loadingMore}
          nativeID={`${id}-load-more`}
          onPress={onLoadMore}
          testID={`${id}-load-more`}
        >
          {loadingMore ? (
            <ActivityIndicator color={colors.primary} nativeID={`${id}-load-more-spinner`} size="small" testID={`${id}-load-more-spinner`} />
          ) : (
            <Text className="text-xs font-semibold text-primary" nativeID={`${id}-load-more-label`} testID={`${id}-load-more-label`}>
              Cargar más
            </Text>
          )}
        </Pressable>
      ) : null}
    </View>
  );
}
