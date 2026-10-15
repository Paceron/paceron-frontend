import { useState } from 'react';
import { ActivityIndicator, Pressable, View, Text } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { ResponsiveSelectField } from '../forms/responsive-select-field.jsx';
import { DateField } from '../forms/fields.jsx';
import { AvatarPicker } from '../shared/avatar-picker.jsx';
import { IconTooltip } from '../shared/icon-tooltip.jsx';
import { useTeamLeaderboard } from '../../hooks/use-team-leaderboard.js';
import { useAuthStore } from '../../store/auth-store.js';
import { useUser } from '../../hooks/use-user.js';
import { useThemeColors } from '../../theme/colors.js';
import { formatMetricValue } from '../../utils/leaderboard-metric-format.js';
import { rankMeta } from '../../utils/leaderboard-rank-meta.js';
import { toISODate } from '../../utils/date-field-format.js';
import { getUserInitials } from '../../utils/user-initials.js';
import { METRIC_OPTIONS } from '../../utils/gamification-metric-options.js';

const PERIOD_OPTIONS = [
  { id: 'week', name: 'Última semana' },
  { id: 'month', name: 'Último mes' },
  { id: 'year', name: 'Último año' },
  { id: 'custom', name: 'Rango personalizado' },
  { id: 'all', name: 'Histórico' },
];

function RankBadge({ rank }) {
  const meta = rankMeta(rank);
  const idPrefix = `leaderboard-tab-rank-badge-${rank}`;

  if (meta) return <MaterialCommunityIcons color={meta.color} name={meta.icon} size={20} />;

  return (
    <View className="h-5 w-5 items-center justify-center rounded-full bg-slate-200 dark:bg-slate-700" nativeID={idPrefix} testID={idPrefix}>
      <Text className="text-xs font-semibold text-slate-600 dark:text-slate-300" nativeID={`${idPrefix}-label`} testID={`${idPrefix}-label`}>
        {rank}
      </Text>
    </View>
  );
}

// `isRecord` (puesto 1 en modo Histórico) reusa el estilo ámbar que antes
// vivía en una card aparte, debajo de las 5 filas -- mezclado acá para que
// el puesto 1 sea LA MISMA fila que el récord, no dos números distintos
// para la misma persona compitiendo por atención (bug/pedido real,
// 2026-10-15: antes la card de récord y la fila 1 podían mostrar valores
// diferentes del mismo ganador, confuso).
function LeaderboardRow({ row, metric, idPrefix, accent = false, isRecord = false }) {
  const containerClass = isRecord
    ? 'border border-amber-200 bg-amber-50 dark:border-amber-900/40 dark:bg-amber-900/10'
    : accent
    ? 'border-l-4 border-primary bg-primary-tint-subtle dark:bg-primary/10'
    : 'bg-white dark:bg-surface';

  return (
    <View className={`flex-row items-center gap-3 rounded-xl p-2 ${containerClass}`} nativeID={idPrefix} testID={idPrefix}>
      <RankBadge rank={row.rank} />
      <AvatarPicker accessibilityLabel={`Foto de ${row.name}`} idPrefix={`${idPrefix}-avatar`} initials={getUserInitials(row.name)} size={32} uri={row.avatarUrl} />
      <View className="flex-1" nativeID={`${idPrefix}-text`} testID={`${idPrefix}-text`}>
        {isRecord && (
          <Text className="text-[10px] font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-400" nativeID={`${idPrefix}-record-label`} testID={`${idPrefix}-record-label`}>
            Récord del equipo
          </Text>
        )}
        <Text className="text-sm font-medium text-slate-700 dark:text-slate-200" nativeID={`${idPrefix}-name`} numberOfLines={1} testID={`${idPrefix}-name`}>
          {row.name}
        </Text>
      </View>
      <Text className="text-sm font-semibold text-slate-900 dark:text-white" nativeID={`${idPrefix}-value`} testID={`${idPrefix}-value`}>
        {formatMetricValue(metric, row.value)}
      </Text>
    </View>
  );
}

// Una sección por métrica, siempre montada -- antes había un solo selector
// de métrica arriba y se veía una sola a la vez; pedido real 2026-10-15:
// mostrar las 6 siempre, colapsables, cada una con su propio período (no
// uno global). Expandida por default.
function MetricSection({ teamId, metricOption, viewerName, idPrefix }) {
  const colors = useThemeColors();
  const [expanded, setExpanded] = useState(true);
  const [period, setPeriod] = useState('month');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  const metric = metricOption.id;
  const from = period === 'custom' && fromDate ? toISODate(fromDate) : undefined;
  const to = period === 'custom' && toDate ? toISODate(toDate) : undefined;

  const { leaderboard, loading, error } = useTeamLeaderboard(teamId, { metric, period, from, to });

  const viewerInTop = Boolean(leaderboard?.rows?.some((row) => String(row.userId) === String(leaderboard?.viewerRank?.userId)));
  const isHistoric = period === 'all';
  // Histórico: mismas 5 filas de siempre + la posición propia si no está
  // en el top 5 (igual que cualquier otro período) -- el puesto 1 pasa a
  // ser el récord del equipo (mismo dato, no uno aparte) con estilo ámbar.
  // Corregido 2026-10-15: la versión anterior mostraba una card de récord
  // separada (con su propio valor) MÁS 4 filas del top 5 recortado --
  // confuso cuando el récord y el puesto 1 eran la misma persona con
  // números distintos.
  const visibleRows = isHistoric && leaderboard?.record
    ? [
        { userId: leaderboard.record.userId, name: leaderboard.record.name, avatarUrl: null, value: leaderboard.record.value, rank: 1 },
        ...(leaderboard?.rows ?? []).filter((row) => row.rank !== 1),
      ]
    : (leaderboard?.rows ?? []);

  return (
    <View className="rounded-2xl bg-white p-4 shadow-sm dark:bg-surface" nativeID={idPrefix} testID={idPrefix}>
      {/* `items-start justify-between` en la fila exterior -- el botón de
          colapsar queda SIEMPRE arriba a la derecha, fijo, sin importar si
          el grupo de la izquierda (título+período+fechas) necesita una
          segunda línea (pedido real, 2026-10-15: "debe permanecer
          inamovible arriba a la derecha"). El período va PEGADO al título
          (mismo grupo `flex-1 flex-wrap`, no empujado al otro extremo) --
          así el rango personalizado extiende hacia la derecha en vez de
          crecer la altura del header en el caso común (pedido real:
          "mostraría los inputs hacia la derecha y no produciría un
          corrimiento"). */}
      <View className="flex-row items-start justify-between gap-2" nativeID={`${idPrefix}-header`} testID={`${idPrefix}-header`}>
        <View className="flex-1 flex-row flex-wrap items-center gap-2" nativeID={`${idPrefix}-header-start`} testID={`${idPrefix}-header-start`}>
          <Text className="text-base font-bold text-slate-900 dark:text-white" nativeID={`${idPrefix}-title`} testID={`${idPrefix}-title`}>
            {metricOption.name}
          </Text>
          <View className="ml-4" nativeID={`${idPrefix}-period-wrap`} testID={`${idPrefix}-period-wrap`}>
            {/* `label` único por sección aunque quede oculto (`hideLabel`) --
                SelectField/PickerField derivan su nativeID del label
                (`slugify`), sin esto las 6 secciones generarían el mismo id
                ("Período") y chocarían. `plain` (variante compacta, sin
                borde/caja de h-12, ya existía en fields.jsx pero sin ningún
                call site todavía) + `required` (saca el botón de limpiar Y
                la opción vacía del <select> -- el período nunca debería
                poder quedar sin valor) -- antes se veía una caja alta con
                botón de limpiar, descentrada contra el título (pedido real,
                2026-10-15). `hideErrorRow` saca el renglón de 20px que el
                campo reserva siempre para un error (nunca aplica acá, el
                período no se valida) -- sin esto esa caja quedaba más alta
                que el título de al lado y el `items-center` del header los
                centraba mal entre sí (bug real, mismo pedido). */}
            <ResponsiveSelectField dense hideErrorRow hideLabel label={`Período — ${metricOption.name}`} onChange={setPeriod} options={PERIOD_OPTIONS} plain required value={period} />
          </View>
          {period === 'custom' && (
            <View className="flex-row flex-wrap items-center gap-2" nativeID={`${idPrefix}-custom-range`} testID={`${idPrefix}-custom-range`}>
              <View nativeID={`${idPrefix}-from-wrap`} style={{ width: 128 }} testID={`${idPrefix}-from-wrap`}>
                <DateField hideErrorRow hideLabel label={`Desde — ${metricOption.name}`} onChange={setFromDate} value={fromDate} />
              </View>
              <View nativeID={`${idPrefix}-to-wrap`} style={{ width: 128 }} testID={`${idPrefix}-to-wrap`}>
                <DateField hideErrorRow hideLabel label={`Hasta — ${metricOption.name}`} onChange={setToDate} value={toDate} />
              </View>
            </View>
          )}
        </View>
        <IconTooltip idPrefix={`${idPrefix}-toggle-tooltip`} label={expanded ? 'Colapsar' : 'Expandir'} position="bottom">
          <Pressable
            className="h-8 w-8 items-center justify-center rounded-full bg-slate-100 transition-colors duration-150 hover:bg-slate-200 active:bg-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 dark:active:bg-slate-600"
            nativeID={`${idPrefix}-toggle`}
            onPress={() => setExpanded((v) => !v)}
            testID={`${idPrefix}-toggle`}
          >
            <MaterialCommunityIcons color={colors.onSurfaceVariant} name={expanded ? 'chevron-up' : 'chevron-down'} size={20} />
          </Pressable>
        </IconTooltip>
      </View>

      {expanded && (
        <View className="mt-3 border-t border-slate-100 pt-3 dark:border-slate-800" nativeID={`${idPrefix}-body`} testID={`${idPrefix}-body`}>
          {loading && (
            <View className="items-center py-4" nativeID={`${idPrefix}-loading`} testID={`${idPrefix}-loading`}>
              <ActivityIndicator color={colors.primary} size="small" />
            </View>
          )}

          {!loading && error && (
            <Text className="text-sm text-slate-400 dark:text-slate-500" nativeID={`${idPrefix}-error`} testID={`${idPrefix}-error`}>
              No pudimos cargar este leaderboard.
            </Text>
          )}

          {!loading && !error && leaderboard && visibleRows.length === 0 && (
            <Text className="text-sm text-slate-400 dark:text-slate-500" nativeID={`${idPrefix}-empty`} testID={`${idPrefix}-empty`}>
              Todavía no hay datos para esta métrica en este período.
            </Text>
          )}

          {!loading && !error && leaderboard && visibleRows.length > 0 && (
            <View className="gap-2" nativeID={`${idPrefix}-rows`} testID={`${idPrefix}-rows`}>
              {visibleRows.map((row) => (
                <LeaderboardRow idPrefix={`${idPrefix}-row-${row.userId}`} isRecord={isHistoric && row.rank === 1} key={row.userId} metric={metric} row={row} />
              ))}
              {leaderboard.viewerRank && !viewerInTop && (
                <LeaderboardRow accent idPrefix={`${idPrefix}-viewer-row`} metric={metric} row={{ ...leaderboard.viewerRank, name: viewerName }} />
              )}
            </View>
          )}
        </View>
      )}
    </View>
  );
}

export function LeaderboardTab({ teamId }) {
  const userId = useAuthStore((s) => s.userId);
  const { user } = useUser(userId);
  const viewerName = `${user?.name ?? ''} ${user?.surname ?? ''}`.trim() || 'Vos';

  return (
    <View className="gap-3" nativeID="leaderboard-tab-root" testID="leaderboard-tab-root">
      {METRIC_OPTIONS.map((metricOption) => (
        <MetricSection
          idPrefix={`leaderboard-tab-section-${metricOption.id}`}
          key={metricOption.id}
          metricOption={metricOption}
          teamId={teamId}
          viewerName={viewerName}
        />
      ))}
    </View>
  );
}
