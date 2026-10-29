import { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { barPath } from '../../utils/dashboard-chart.js';
import { EMPTY_METRIC, formatMetric, hasMetric } from '../../utils/dashboard-format.js';
import { useThemeColors } from '../../theme/colors.js';
import { InfoHint } from './info-hint.jsx';

// Ranking del equipo: UNA sola tabla con la barra y las cuatro métricas.
//
// Antes eran dos piezas con el mismo título —un gráfico de barras con la columna
// activa y una tabla aparte con las cuatro columnas— que se leían como dos
// rankings distintos aunque salieran del mismo endpoint. Ahora la barra vive en
// la misma fila que los números y visualiza la columna por la que se está
// ordenando: cambia de métrica al tocar otro encabezado.
//
// La tabla es paginada y ordenable SOLO por las cuatro columnas de la whitelist
// del backend (`DASHBOARD_LEADERBOARD_SORTS`): pedir un orden fuera de esa lista
// gasta un 400 con code estable que no le dice nada al usuario.
//
// La posición que se muestra es el `position` GLOBAL de la respuesta, no el
// índice de la fila dentro de la página: así se puede decir "vas 14°" sin traer
// todas las páginas. `rank` (dentro de la página) no se usa para eso.
//
// La fila propia se marca por `is_self` —el backend lo resuelve comparando con el
// llamador— y no por comparar ids en el front, que es donde aparecería el clásico
// number-vs-string del deep link.
//
// Responsive: el corte no es el breakpoint del shell (1024) sino el ancho REAL de
// la tabla, medido con `onLayout` — lo que decide si los encabezados entran o no
// es el espacio de la card, no el del viewport. En ancho, encabezado y fila usan
// la MISMA estructura (`#`, nombre, barra, cuatro métricas) para que las columnas
// queden alineadas; los labels pueden ocupar dos líneas y nunca se superponen
// porque cada uno vive en su celda con `flex`. En angosto, una fila de
// encabezados de cuatro métricas no entra: cada corredor pasa a dos líneas —pos,
// nombre y barra arriba; las cuatro métricas en una grilla 2×2 con su label
// abajo— y ese label es el control de orden, así que la función no se pierde.
export const COLUMNS = [
  { key: 'best_time_ms', label: 'Mejor tiempo', shortLabel: 'Tiempo', unitKey: 'best_time' },
  { key: 'mean_speed_kph', label: 'Ritmo medio', shortLabel: 'Ritmo', unitKey: 'speed' },
  { key: 'total_distance_m', label: 'Distancia', shortLabel: 'Distancia', unitKey: 'distance' },
  { key: 'compliance_rate', label: 'Cumplimiento', shortLabel: 'Cumplimiento', unitKey: 'compliance' },
];

const POSITION_WIDTH = 26;
const BAR_WIDTH_WIDE = 96;
const BAR_WIDTH_COMPACT = 64;
const BAR_HEIGHT = 10;
// Ancho medido de la card. Por debajo de esto, cuatro encabezados + nombre +
// barra no entran sin pisarse (a 700 el label más largo, "Cumplimiento", ya
// queda holgado en su celda; el dashboard vive en `max-w-3xl`, así que en
// desktop siempre es ancho).
const COMPACT_BREAKPOINT = 700;

// Nombre y "Corredor" comparten este flex (doble que cada métrica): con cuatro
// columnas numéricas, un `flex-1` parejo dejaba el nombre en ~70 px.
const NAME_FLEX = 2;

const TITLE = 'Ranking del equipo';
// La bajada de la card va en la "i" del título (ver `InfoHint`), no como texto
// fijo: la tabla ya explica con el subtítulo el orden activo, que es el dato que
// hay que poder leer sin ningún gesto.
const DESCRIPTION =
  'La barra de cada fila es la columna activa, proporcional al valor más alto de las filas cargadas. La posición es la global del ranking —no la de esta página— y tu fila va marcada.';

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
  captureRef = null,
  hideLoadMore = false,
}) {
  const colors = useThemeColors();
  const [width, setWidth] = useState(0);
  const compact = width > 0 && width < COMPACT_BREAKPOINT;

  const activeColumn = COLUMNS.find((column) => column.key === sort) ?? COLUMNS[0];
  const barWidth = compact ? BAR_WIDTH_COMPACT : BAR_WIDTH_WIDE;

  // Una barra por fila, proporcional al valor de la columna activa. La
  // normalización es la misma función pura que usa el resto del dashboard
  // (`barPath`), no una regla local: con una sola fila o con todos los valores
  // iguales tiene que dar un largo válido y no `NaN`.
  const bars = useMemo(() => {
    const values = items.map((item) => item?.[activeColumn.key]);
    return barPath(values, { width: barWidth, height: BAR_HEIGHT, horizontal: true });
  }, [activeColumn.key, barWidth, items]);

  const sortControl = (column, { compactCell = false, idPrefix = id } = {}) => {
    const active = sort === column.key;
    return (
      <Pressable
        accessibilityLabel={`Ordenar por ${column.label}`}
        accessibilityRole="button"
        className={compactCell ? '' : 'flex-1 items-end'}
        key={column.key}
        nativeID={`${idPrefix}-sort-${column.key}`}
        onPress={() => onSort?.(column.key)}
        style={compactCell ? undefined : { flex: 1 }}
        testID={`${idPrefix}-sort-${column.key}`}
      >
        <View
          className={`flex-row items-start gap-0.5 ${compactCell ? '' : 'justify-end'}`}
          nativeID={`${idPrefix}-sort-${column.key}-row`}
          testID={`${idPrefix}-sort-${column.key}-row`}
        >
          <Text
            className={`${compactCell ? 'text-left' : 'text-right'} text-[10px] uppercase tracking-wide text-slate-400 dark:text-slate-500`}
            nativeID={`${idPrefix}-sort-${column.key}-label`}
            numberOfLines={2}
            testID={`${idPrefix}-sort-${column.key}-label`}
          >
            {compactCell ? column.shortLabel : column.label}
          </Text>
          {active ? (
            <MaterialCommunityIcons
              color={colors.primary}
              name={order === 'asc' ? 'chevron-up' : 'chevron-down'}
              size={12}
            />
          ) : null}
        </View>
      </Pressable>
    );
  };

  const metricValue = (item, column, rowId) => (
    <View
      className="flex-1"
      key={column.key}
      nativeID={`${rowId}-${column.key}-cell`}
      style={{ flex: 1 }}
      testID={`${rowId}-${column.key}-cell`}
    >
      <Text
        className="text-right text-xs text-slate-700 dark:text-slate-200"
        nativeID={`${rowId}-${column.key}`}
        testID={`${rowId}-${column.key}`}
      >
        {hasMetric(item?.[column.key]) ? formatMetric(item[column.key], units?.[column.unitKey]) : EMPTY_METRIC}
      </Text>
    </View>
  );

  const athleteName = (item, rowId, nameFlex) => (
    <View className="flex-row items-center gap-1" nativeID={`${rowId}-name-row`} style={{ flex: nameFlex }} testID={`${rowId}-name-row`}>
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
  );

  const positionCell = (item, rowId) => (
    <Text
      className="text-xs font-semibold text-slate-400 dark:text-slate-500"
      nativeID={`${rowId}-position`}
      style={{ width: POSITION_WIDTH }}
      testID={`${rowId}-position`}
    >
      {`${item.position}°`}
    </Text>
  );

  const barCell = (item, rowId, index, widthValue) => {
    const bar = bars[index];
    const length = Math.max(bar?.length ?? 0, bar?.value === 0 ? 2 : 0);
    const podium = Number(item?.position) > 0 && Number(item?.position) <= 3;
    return (
      <View
        className="h-2.5 overflow-hidden rounded-full bg-slate-200 dark:bg-surface-3"
        nativeID={`${rowId}-bar-track`}
        style={{ width: widthValue }}
        testID={`${rowId}-bar-track`}
      >
        <View
          className="h-full rounded-full"
          nativeID={`${rowId}-bar`}
          style={{ width: length, backgroundColor: podium ? colors.primary : colors.outlineVariant }}
          testID={`${rowId}-bar`}
        />
      </View>
    );
  };

  return (
    <View
      className="mb-4 rounded-2xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-surface"
      collapsable={false}
      nativeID={id}
      onLayout={(event) => setWidth(Math.floor(event.nativeEvent.layout.width))}
      ref={captureRef}
      testID={id}
    >
      <View className="border-b border-slate-100 p-4 dark:border-slate-800" nativeID={`${id}-header`} testID={`${id}-header`}>
        <View className="flex-row items-center gap-2" nativeID={`${id}-header-row`} testID={`${id}-header-row`}>
          <MaterialCommunityIcons color={colors.primary} name="podium" size={16} />
          <View className="min-w-0 flex-1 flex-row items-center gap-1.5" nativeID={`${id}-heading`} testID={`${id}-heading`}>
            <Text className="min-w-0 shrink text-sm font-bold text-slate-900 dark:text-white" nativeID={`${id}-title`} testID={`${id}-title`}>
              {TITLE}
            </Text>
            <InfoHint description={DESCRIPTION} id={`${id}-info`} title={TITLE} />
          </View>
          <Text className="text-[11px] text-slate-500 dark:text-slate-400" nativeID={`${id}-total`} testID={`${id}-total`}>
            {`${total} corredores`}
          </Text>
        </View>
        {onSort ? (
          <Text className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400" nativeID={`${id}-subtitle`} testID={`${id}-subtitle`}>
            {`${activeColumn.label}, ${order === 'asc' ? 'menor primero' : 'mayor primero'}.`}
          </Text>
        ) : null}
      </View>

      {selfPosition ? (
        <View className="flex-row items-center gap-2 bg-primary-tint-subtle px-4 py-2 dark:bg-primary/10" nativeID={`${id}-self-position`} testID={`${id}-self-position`}>
          <MaterialCommunityIcons color={colors.primary} name="map-marker" size={14} />
          <Text className="text-xs font-semibold text-[#3c6b12] dark:text-primary" nativeID={`${id}-self-position-text`} testID={`${id}-self-position-text`}>
            {`Vas ${selfPosition}°`}
          </Text>
        </View>
      ) : null}

      {!compact ? (
        <View
          className="flex-row items-end gap-2 border-b border-slate-100 px-4 py-2 dark:border-slate-800"
          nativeID={`${id}-columns`}
          testID={`${id}-columns`}
        >
          <View nativeID={`${id}-column-position`} style={{ width: POSITION_WIDTH }} testID={`${id}-column-position`} />
          <Text
            className="text-[10px] uppercase tracking-wide text-slate-400 dark:text-slate-500"
            nativeID={`${id}-column-name`}
            style={{ flex: NAME_FLEX }}
            testID={`${id}-column-name`}
          >
            Corredor
          </Text>
          <View nativeID={`${id}-column-bar`} style={{ width: BAR_WIDTH_WIDE }} testID={`${id}-column-bar`} />
          {COLUMNS.map((column) => sortControl(column))}
        </View>
      ) : (
        // En angosto los cuatro labels van una sola vez, en 2×2. Repetirlos en
        // cada fila sería cuatro botones por corredor para la misma acción.
        <View
          className="flex-row flex-wrap border-b border-slate-100 px-4 py-2 dark:border-slate-800"
          nativeID={`${id}-columns`}
          testID={`${id}-columns`}
        >
          {COLUMNS.map((column) => (
            <View className="w-1/2 pr-2" key={column.key} nativeID={`${id}-column-${column.key}`} testID={`${id}-column-${column.key}`}>
              {sortControl(column, { compactCell: true })}
            </View>
          ))}
        </View>
      )}

      {items.length === 0 ? (
        <Text className="px-4 py-4 text-center text-xs text-slate-500 dark:text-slate-400" nativeID={`${id}-empty`} testID={`${id}-empty`}>
          Sin corredores para este filtro.
        </Text>
      ) : null}

      {items.map((item, index) => {
        const rowId = `${id}-row-${item.athlete_user_id ?? index}`;
        const selfRow = item?.is_self ? 'bg-primary-tint-subtle dark:bg-primary/10' : '';

        return (
          <View
            className={`border-b border-slate-50 px-4 py-2.5 last:border-b-0 dark:border-slate-800/60 ${selfRow}`}
            key={rowId}
            nativeID={rowId}
            testID={rowId}
          >
            {compact ? (
              <View nativeID={`${rowId}-body`} testID={`${rowId}-body`}>
                <View className="flex-row items-center gap-2" nativeID={`${rowId}-main`} testID={`${rowId}-main`}>
                  {positionCell(item, rowId)}
                  {athleteName(item, rowId, 1)}
                  {barCell(item, rowId, index, BAR_WIDTH_COMPACT)}
                </View>
                <View className="mt-1.5 flex-row flex-wrap" nativeID={`${rowId}-metrics`} testID={`${rowId}-metrics`}>
                  {COLUMNS.map((column) => (
                    <View className="w-1/2 py-0.5 pr-2" key={column.key} nativeID={`${rowId}-${column.key}-cell`} testID={`${rowId}-${column.key}-cell`}>
                      <Text
                        className="text-xs text-slate-700 dark:text-slate-200"
                        nativeID={`${rowId}-${column.key}`}
                        testID={`${rowId}-${column.key}`}
                      >
                        {hasMetric(item?.[column.key]) ? formatMetric(item[column.key], units?.[column.unitKey]) : EMPTY_METRIC}
                      </Text>
                    </View>
                  ))}
                </View>
              </View>
            ) : (
              <View className="flex-row items-center gap-2" nativeID={`${rowId}-main`} testID={`${rowId}-main`}>
                {positionCell(item, rowId)}
                {athleteName(item, rowId, NAME_FLEX)}
                {barCell(item, rowId, index, BAR_WIDTH_WIDE)}
                {COLUMNS.map((column) => metricValue(item, column, rowId))}
              </View>
            )}
          </View>
        );
      })}

      {hasMore && !hideLoadMore ? (
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
