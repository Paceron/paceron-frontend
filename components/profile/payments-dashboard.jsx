import { Pressable, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useThemeColors } from '../../theme/colors.js';
import { formatArs } from '../../utils/currency.js';
import {
  amountFor,
  computeMonthOverMonth,
  formatMonthLong,
  formatMonthOverMonth,
  monthTileContent,
  selectCurrentAndPrevious,
  toChartPoints,
  windowRange,
} from '../../utils/payments-summary.js';
import { SectionCard } from '../forms/section-card.jsx';
import { SkeletonBlock } from '../shared/skeleton.jsx';
import { StatTile } from '../shared/stat-tile.jsx';
import { PaymentsAmountMode } from './payments-amount-mode.jsx';
import { PaymentsMonthlyChart } from './payments-monthly-chart.jsx';
import { IconTooltip } from '../shared/icon-tooltip.jsx';

// Dashboard de cobros: KPIs, evolución mensual y cobros por equipo.
// - Los tiles usan `summary` (la ventana que termina hoy): correr el gráfico no
//   cambia "Cobrado en <mes actual>". El gráfico y cobros por equipo usan
//   `windowSummary`, la ventana elegida con las flechas.
// - `amountMode` ('gross' | 'net') cambia tiles, gráfico y equipos juntos.
// - Tocar "Cuotas pendientes" o "Cuotas rechazadas" filtra la lista de cobros
//   (onSelectStatus). Los tiles cuentan cuotas y la lista muestra intentos: por
//   eso pueden no coincidir, y la pantalla lo aclara sobre la lista.
export function PaymentsDashboard({
  summary,
  loading,
  failed,
  onRetry,
  isWide,
  activeStatus,
  onSelectStatus,
  amountMode = 'gross',
  onChangeAmountMode,
  windowSummary,
  windowLoading = false,
  windowFailed = false,
  onRetryWindow,
  currentMonth,
  canPrev = false,
  canNext = false,
  onPrev,
  onNext,
}) {
  if (loading) {
    return (
      <View className="mb-5 gap-3" nativeID="payments-dashboard-loading" testID="payments-dashboard-loading">
        <View className={isWide ? 'flex-row gap-3' : 'flex-row flex-wrap gap-3'} nativeID="payments-dashboard-loading-kpis" testID="payments-dashboard-loading-kpis">
          {[0, 1, 2, 3].map((i) => (
            <SkeletonBlock key={i} className={isWide ? 'flex-1' : ''} height={96} nativeID={`payments-dashboard-skeleton-${i}`} rounded="rounded-2xl" testID={`payments-dashboard-skeleton-${i}`} width={isWide ? undefined : '47%'} />
          ))}
        </View>
        <SkeletonBlock height={220} nativeID="payments-dashboard-skeleton-chart" rounded="rounded-2xl" testID="payments-dashboard-skeleton-chart" />
      </View>
    );
  }

  if (failed || !summary) {
    return (
      <View className="mb-5 flex-row items-center justify-between gap-3 rounded-2xl bg-rose-50 p-4 dark:bg-rose-900/20" nativeID="payments-dashboard-error" testID="payments-dashboard-error">
        <Text className="flex-1 text-sm text-rose-700 dark:text-rose-300" nativeID="payments-dashboard-error-text" testID="payments-dashboard-error-text">
          No pudimos cargar el resumen de tus cobros.
        </Text>
        <Pressable className="rounded-full bg-rose-100 px-3 py-1.5 hover:opacity-90 active:opacity-80 dark:bg-rose-900/40" nativeID="payments-dashboard-retry" onPress={onRetry} testID="payments-dashboard-retry">
          <Text className="text-xs font-semibold text-rose-700 dark:text-rose-300" nativeID="payments-dashboard-retry-label" testID="payments-dashboard-retry-label">Reintentar</Text>
        </Pressable>
      </View>
    );
  }

  const { current, previous } = selectCurrentAndPrevious(summary.monthly);
  const mom = computeMonthOverMonth(current, previous, amountMode);
  const monthTile = monthTileContent(current, amountMode);
  const toggle = (group) => onSelectStatus(activeStatus === group ? '' : group);
  const kpiBox = isWide ? { flex: 1 } : { width: '47%' };
  const momHint = mom.reason === 'no-net' ? 'Sin datos de neto' : mom.reason === 'no-previous' ? 'Sin cobros para comparar' : undefined;
  const statusHint = (group) => (activeStatus === group ? 'Filtrando · tocá para quitar' : 'Tocá para filtrar');

  const shown = windowSummary ?? summary;
  const points = toChartPoints(shown.monthly, amountMode);
  const range = windowRange(shown.monthly);
  const teams = shown.byTeam.map((team) => ({ team, amount: amountFor(team, amountMode) }));
  const maxTeam = Math.max(1, ...teams.map((t) => t.amount.value ?? 0));
  const netIncomplete = amountMode === 'net' && (points.some((p) => p.partial || p.missing) || teams.some((t) => t.amount.partial || t.amount.missing));

  return (
    <View className="mb-2" nativeID="payments-dashboard" testID="payments-dashboard">
      <View className="mb-3 flex-row justify-end" nativeID="payments-dashboard-toolbar" testID="payments-dashboard-toolbar">
        <PaymentsAmountMode mode={amountMode} onChange={onChangeAmountMode} />
      </View>

      <View className="mb-5 flex-row flex-wrap gap-3" nativeID="payments-dashboard-kpis" testID="payments-dashboard-kpis">
        <View nativeID="payments-dashboard-kpi-month" style={kpiBox} testID="payments-dashboard-kpi-month">
          <StatTile hint={monthTile.hint} icon="cash-plus" idPrefix="payments-kpi" label={`Cobrado en ${formatMonthLong(current?.month)}`} value={monthTile.value} />
        </View>
        <View nativeID="payments-dashboard-kpi-mom" style={kpiBox} testID="payments-dashboard-kpi-mom">
          <StatTile
            hint={momHint}
            icon={mom.direction === 'down' ? 'trending-down' : mom.direction === 'up' ? 'trending-up' : 'trending-neutral'}
            idPrefix="payments-kpi"
            label={`vs ${formatMonthLong(previous?.month)}`}
            value={formatMonthOverMonth(mom)}
          />
        </View>
        <View nativeID="payments-dashboard-kpi-pending" style={kpiBox} testID="payments-dashboard-kpi-pending">
          <StatTile
            actionHint={statusHint('pending')}
            active={activeStatus === 'pending'}
            icon="clock-outline"
            idPrefix="payments-kpi"
            label="Cuotas pendientes"
            onPress={() => toggle('pending')}
            value={String(summary.pendingCount)}
          />
        </View>
        <View nativeID="payments-dashboard-kpi-rejected" style={kpiBox} testID="payments-dashboard-kpi-rejected">
          <StatTile
            actionHint={statusHint('rejected')}
            active={activeStatus === 'rejected'}
            icon="close-circle-outline"
            idPrefix="payments-kpi"
            label="Cuotas rechazadas"
            onPress={() => toggle('rejected')}
            value={String(summary.rejectedCount)}
          />
        </View>
      </View>

      <View className={isWide ? 'flex-row gap-4' : ''} nativeID="payments-dashboard-panels" testID="payments-dashboard-panels">
        <View nativeID="payments-dashboard-chart-panel" style={isWide ? { flex: 3 } : undefined} testID="payments-dashboard-chart-panel">
          <SectionCard icon="chart-bar" scope="payments-dashboard-chart-card" title={amountMode === 'net' ? 'Neto por mes' : 'Cobrado por mes'}>
            <WindowNav canNext={canNext} canPrev={canPrev} label={range} onNext={onNext} onPrev={onPrev} />
            {windowLoading ? (
              <SkeletonBlock height={170} nativeID="payments-dashboard-window-skeleton" rounded="rounded-xl" testID="payments-dashboard-window-skeleton" />
            ) : windowFailed ? (
              <WindowError onRetry={onRetryWindow} />
            ) : (
              <PaymentsMonthlyChart currentMonth={currentMonth} points={points} />
            )}
            {netIncomplete ? (
              <Text className="mt-3 text-xs leading-4 text-slate-500 dark:text-slate-400" nativeID="payments-dashboard-net-note" testID="payments-dashboard-net-note">
                El neto es solo el que informó Mercado Pago. * neto parcial · s/d sin datos de neto.
              </Text>
            ) : null}
          </SectionCard>
        </View>

        <View nativeID="payments-dashboard-teams-panel" style={isWide ? { flex: 2 } : undefined} testID="payments-dashboard-teams-panel">
          <SectionCard icon="account-group" scope="payments-dashboard-teams-card" title="Cobros por equipo">
            <Text className="-mt-2 mb-3 text-xs text-slate-500 dark:text-slate-400" nativeID="payments-dashboard-teams-range" testID="payments-dashboard-teams-range">
              {range}
            </Text>
            {windowLoading ? (
              <SkeletonBlock height={60} nativeID="payments-dashboard-teams-skeleton" rounded="rounded-xl" testID="payments-dashboard-teams-skeleton" />
            ) : windowFailed ? null : teams.length === 0 ? (
              <Text className="py-2 text-sm text-slate-500 dark:text-slate-400" nativeID="payments-dashboard-teams-empty" testID="payments-dashboard-teams-empty">
                Sin cobros en este período.
              </Text>
            ) : (
              <View className="gap-4" nativeID="payments-dashboard-teams" testID="payments-dashboard-teams">
                {teams.map(({ team, amount }) => (
                  <View key={team.teamId} nativeID={`payments-dashboard-team-${team.teamId}`} testID={`payments-dashboard-team-${team.teamId}`}>
                    <View className="mb-1.5 flex-row items-baseline justify-between gap-3" nativeID={`payments-dashboard-team-${team.teamId}-header`} testID={`payments-dashboard-team-${team.teamId}-header`}>
                      <Text className="flex-1 text-sm font-semibold text-slate-800 dark:text-slate-100" nativeID={`payments-dashboard-team-${team.teamId}-name`} numberOfLines={1} testID={`payments-dashboard-team-${team.teamId}-name`}>
                        {team.teamName || 'Equipo eliminado'}
                      </Text>
                      <Text className="text-sm font-semibold text-slate-900 dark:text-white" nativeID={`payments-dashboard-team-${team.teamId}-gross`} style={{ fontVariant: ['tabular-nums'] }} testID={`payments-dashboard-team-${team.teamId}-gross`}>
                        {amount.missing ? 's/d' : `${formatArs(amount.value)}${amount.partial ? '*' : ''}`}
                      </Text>
                    </View>
                    <View className="h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800" nativeID={`payments-dashboard-team-${team.teamId}-track`} testID={`payments-dashboard-team-${team.teamId}-track`}>
                      <View className="h-2 rounded-full bg-primary" nativeID={`payments-dashboard-team-${team.teamId}-bar`} style={{ width: `${((amount.value ?? 0) / maxTeam) * 100}%` }} testID={`payments-dashboard-team-${team.teamId}-bar`} />
                    </View>
                    <Text className="mt-1 text-xs text-slate-500 dark:text-slate-400" nativeID={`payments-dashboard-team-${team.teamId}-meta`} testID={`payments-dashboard-team-${team.teamId}-meta`}>
                      {team.approvedCount} {team.approvedCount === 1 ? 'cobro' : 'cobros'}
                      {team.pendingCount ? ` · ${team.pendingCount} pend.` : ''}
                      {team.rejectedCount ? ` · ${team.rejectedCount} rech.` : ''}
                    </Text>
                  </View>
                ))}
              </View>
            )}
          </SectionCard>
        </View>
      </View>
    </View>
  );
}

function WindowNav({ label, canPrev, canNext, onPrev, onNext }) {
  const colors = useThemeColors();
  const arrow = (id, icon, enabled, onPress, a11y) => (
    <IconTooltip idPrefix={`${id}-tooltip`} label={a11y}>
      <Pressable
        accessibilityLabel={a11y}
        accessibilityState={{ disabled: !enabled }}
        className={`rounded-full p-1.5 ${enabled ? 'hover:bg-slate-100 active:opacity-70 dark:hover:bg-slate-800' : ''}`}
        disabled={!enabled}
        nativeID={id}
        onPress={onPress}
        style={{ opacity: enabled ? 1 : 0.3 }}
        testID={id}
      >
        <MaterialCommunityIcons color={colors.onSurfaceVariant} name={icon} size={20} />
      </Pressable>
    </IconTooltip>
  );
  return (
    <View className="mb-3 flex-row items-center justify-between" nativeID="payments-dashboard-window" testID="payments-dashboard-window">
      {arrow('payments-dashboard-window-prev', 'chevron-left', canPrev, onPrev, 'Ver los 6 meses anteriores')}
      <Text className="text-sm font-semibold text-slate-700 dark:text-slate-200" nativeID="payments-dashboard-window-label" testID="payments-dashboard-window-label">
        {label}
      </Text>
      {arrow('payments-dashboard-window-next', 'chevron-right', canNext, onNext, 'Ver los 6 meses siguientes')}
    </View>
  );
}

function WindowError({ onRetry }) {
  return (
    <View className="h-[170px] items-center justify-center gap-2" nativeID="payments-dashboard-window-error" testID="payments-dashboard-window-error">
      <Text className="text-sm text-rose-700 dark:text-rose-300" nativeID="payments-dashboard-window-error-text" testID="payments-dashboard-window-error-text">
        No pudimos cargar estos meses.
      </Text>
      <Pressable className="rounded-full bg-rose-100 px-3 py-1.5 hover:opacity-90 active:opacity-80 dark:bg-rose-900/40" nativeID="payments-dashboard-window-retry" onPress={onRetry} testID="payments-dashboard-window-retry">
        <Text className="text-xs font-semibold text-rose-700 dark:text-rose-300" nativeID="payments-dashboard-window-retry-label" testID="payments-dashboard-window-retry-label">Reintentar</Text>
      </Pressable>
    </View>
  );
}
