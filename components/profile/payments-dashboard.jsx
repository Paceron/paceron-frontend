import { Pressable, Text, View } from 'react-native';
import { formatARS } from '../../utils/currency.js';
import {
  computeMonthOverMonth,
  formatMonthLong,
  formatMonthOverMonth,
  formatNetLabel,
  selectCurrentAndPrevious,
} from '../../utils/payments-summary.js';
import { SectionCard } from '../forms/section-card.jsx';
import { SkeletonBlock } from '../shared/skeleton.jsx';
import { StatTile } from '../shared/stat-tile.jsx';
import { PaymentsMonthlyChart } from './payments-monthly-chart.jsx';

// Dashboard de cobros: KPIs, evolución mensual y cobros por equipo. Tocar
// "Cuotas pendientes" o "Cuotas rechazadas" filtra la lista de cobros de abajo
// (onSelectStatus). Los tiles cuentan cuotas y la lista muestra intentos: por
// eso pueden no coincidir, y la pantalla lo aclara sobre la lista.
export function PaymentsDashboard({ summary, loading, failed, onRetry, isWide, activeStatus, onSelectStatus }) {
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
  const mom = computeMonthOverMonth(current, previous);
  const toggle = (group) => onSelectStatus(activeStatus === group ? '' : group);
  const kpiBox = isWide ? { flex: 1 } : { width: '47%' };
  const netIncomplete = summary.monthly.some((m) => m.approvedCount > m.netKnownCount);
  const maxTeamGross = Math.max(1, ...summary.byTeam.map((t) => t.grossAmount));

  return (
    <View className="mb-2" nativeID="payments-dashboard" testID="payments-dashboard">
      <View className="mb-5 flex-row flex-wrap gap-3" nativeID="payments-dashboard-kpis" testID="payments-dashboard-kpis">
        <View nativeID="payments-dashboard-kpi-month" style={kpiBox} testID="payments-dashboard-kpi-month">
          <StatTile hint={formatNetLabel(current ?? {})} icon="cash-plus" idPrefix="payments-kpi" label={`Cobrado en ${formatMonthLong(current?.month)}`} value={formatARS(current?.grossAmount ?? 0)} />
        </View>
        <View nativeID="payments-dashboard-kpi-mom" style={kpiBox} testID="payments-dashboard-kpi-mom">
          <StatTile
            icon={mom.direction === 'down' ? 'trending-down' : mom.direction === 'up' ? 'trending-up' : 'trending-neutral'}
            idPrefix="payments-kpi"
            label={`vs ${formatMonthLong(previous?.month)}`}
            value={formatMonthOverMonth(mom)}
          />
        </View>
        <View nativeID="payments-dashboard-kpi-pending" style={kpiBox} testID="payments-dashboard-kpi-pending">
          <StatTile active={activeStatus === 'pending'} icon="clock-outline" idPrefix="payments-kpi" label="Cuotas pendientes" onPress={() => toggle('pending')} value={String(summary.pendingCount)} />
        </View>
        <View nativeID="payments-dashboard-kpi-rejected" style={kpiBox} testID="payments-dashboard-kpi-rejected">
          <StatTile active={activeStatus === 'rejected'} icon="close-circle-outline" idPrefix="payments-kpi" label="Cuotas rechazadas" onPress={() => toggle('rejected')} value={String(summary.rejectedCount)} />
        </View>
      </View>

      <View className={isWide ? 'flex-row gap-4' : ''} nativeID="payments-dashboard-panels" testID="payments-dashboard-panels">
        <View nativeID="payments-dashboard-chart-panel" style={isWide ? { flex: 3 } : undefined} testID="payments-dashboard-chart-panel">
          <SectionCard icon="chart-bar" scope="payments-dashboard-chart-card" title={`Últimos ${summary.months} meses`}>
            <PaymentsMonthlyChart monthly={summary.monthly} />
            {netIncomplete ? (
              <Text className="mt-3 text-xs leading-4 text-slate-500 dark:text-slate-400" nativeID="payments-dashboard-net-note" testID="payments-dashboard-net-note">
                Montos brutos. El neto se muestra solo cuando Mercado Pago lo informa, así que puede faltar en algunos cobros.
              </Text>
            ) : null}
          </SectionCard>
        </View>

        <View nativeID="payments-dashboard-teams-panel" style={isWide ? { flex: 2 } : undefined} testID="payments-dashboard-teams-panel">
          <SectionCard icon="account-group" scope="payments-dashboard-teams-card" title="Cobros por equipo">
            {summary.byTeam.length === 0 ? (
              <Text className="py-2 text-sm text-slate-500 dark:text-slate-400" nativeID="payments-dashboard-teams-empty" testID="payments-dashboard-teams-empty">
                Sin cobros en este período.
              </Text>
            ) : (
              <View className="gap-4" nativeID="payments-dashboard-teams" testID="payments-dashboard-teams">
                {summary.byTeam.map((team) => (
                  <View key={team.teamId} nativeID={`payments-dashboard-team-${team.teamId}`} testID={`payments-dashboard-team-${team.teamId}`}>
                    <View className="mb-1.5 flex-row items-baseline justify-between gap-3" nativeID={`payments-dashboard-team-${team.teamId}-header`} testID={`payments-dashboard-team-${team.teamId}-header`}>
                      <Text className="flex-1 text-sm font-semibold text-slate-800 dark:text-slate-100" nativeID={`payments-dashboard-team-${team.teamId}-name`} numberOfLines={1} testID={`payments-dashboard-team-${team.teamId}-name`}>
                        {team.teamName || 'Equipo eliminado'}
                      </Text>
                      <Text className="text-sm font-semibold text-slate-900 dark:text-white" nativeID={`payments-dashboard-team-${team.teamId}-gross`} style={{ fontVariant: ['tabular-nums'] }} testID={`payments-dashboard-team-${team.teamId}-gross`}>
                        {formatARS(team.grossAmount)}
                      </Text>
                    </View>
                    <View className="h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800" nativeID={`payments-dashboard-team-${team.teamId}-track`} testID={`payments-dashboard-team-${team.teamId}-track`}>
                      <View className="h-2 rounded-full bg-primary" nativeID={`payments-dashboard-team-${team.teamId}-bar`} style={{ width: `${(team.grossAmount / maxTeamGross) * 100}%` }} testID={`payments-dashboard-team-${team.teamId}-bar`} />
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
