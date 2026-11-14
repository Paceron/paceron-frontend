import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useThemeColors } from '../../theme/colors.js';
import { formatArs } from '../../utils/currency.js';
import {
  amountFor,
  DEFAULT_RECEIVED_KPI_PERIOD,
  formatMonthLong,
  monthOverMonthTileContent,
  monthTileContent,
  periodLabel,
  periodTileContent,
  RECEIVED_KPI_PERIODS,
  selectCurrentAndPrevious,
  toChartPoints,
  windowRange,
} from '../../utils/payments-summary.js';
import { SectionCard } from '../forms/section-card.jsx';
import { SkeletonBlock } from '../shared/skeleton.jsx';
import { StatTile } from '../shared/stat-tile.jsx';
import { ResponsiveSelectField } from '../forms/responsive-select-field.jsx';
import { PaymentsMonthlyChart } from './payments-monthly-chart.jsx';
import { PaymentsDueCard } from './payments-due-card.jsx';
import { IconTooltip } from '../shared/icon-tooltip.jsx';

// El panel muestra SOLO montos netos (pedido 2026-11-13): se quitó el
// segmentado "Bruto / Neto" y con él la etiqueta "Montos". El bruto sigue en
// la respuesta del backend y en el tooltip de cada mes (Cobrado/Comisión/Neto),
// pero no hay un modo bruto navegable.
const AMOUNT_MODE = 'net';

// Dashboard de cobros: KPIs, lo que hay por cobrar este mes, evolución mensual
// (cobrado y pendiente) y cobros por equipo.
// - Los tiles usan `summary` (la ventana que termina hoy): correr el gráfico no
//   cambia "Cobrado en <mes actual>". El gráfico y cobros por equipo usan
//   `windowSummary`, la ventana elegida con las flechas.
// - Los montos son siempre netos: el neto es el bruto menos la comisión de
//   Paceron (ver utils/payments-summary.js#amountFor).
// - "Pendiente de cobro" y "Monto rechazado" usan un selector de período
//   compartido: Todas (vencidas + mes en curso), mes en curso, mes pasado y
//   último trimestre. El hint de cada tile es la cantidad de cuotas de ese
//   período, no un contador aparte (bug reportado 2026-11-13: el KPI mostraba
//   $0 y "0 cuotas" aunque el gráfico tuviera pendientes).
// - "Pendiente de cobro" sale de las obligaciones esperadas del backend, no de
//   los intentos de pago. Por eso no filtra la lista: la lista de cobros
//   muestra pagos/intentos, y el detalle de lo pendiente está en la card "Por
//   cobrar este mes". "Monto rechazado" sí conserva el filtro por intentos.
export function PaymentsDashboard({
  summary,
  loading,
  failed,
  onRetry,
  isWide,
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
  const [kpiPeriod, setKpiPeriod] = useState(DEFAULT_RECEIVED_KPI_PERIOD);
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
  const monthTile = monthTileContent(current, AMOUNT_MODE);
  const momTile = monthOverMonthTileContent(current, previous, AMOUNT_MODE);
  const pendingTile = periodTileContent(summary.pendingPeriods?.[kpiPeriod]);
  const rejectedTile = periodTileContent(summary.rejectedPeriods?.[kpiPeriod]);
  const kpiBox = { flex: 1 };

  const shown = windowSummary ?? summary;
  const points = toChartPoints(shown.monthly, AMOUNT_MODE);
  const range = windowRange(shown.monthly);
  const teams = shown.byTeam.map((team) => ({ team, amount: amountFor(team, AMOUNT_MODE) }));
  const maxTeam = Math.max(1, ...teams.map((t) => t.amount.value ?? 0));
  const netIncomplete = points.some((p) => p.partial || p.missing) || teams.some((t) => t.amount.partial || t.amount.missing);

  return (
    <View className="mb-2" nativeID="payments-dashboard" testID="payments-dashboard">
      <View className="mb-4 flex-row gap-3" nativeID="payments-dashboard-kpis" testID="payments-dashboard-kpis">
        <View nativeID="payments-dashboard-kpi-month" style={kpiBox} testID="payments-dashboard-kpi-month">
          <IconTooltip idPrefix="payments-kpi-month-tooltip" label="Monto cobrado en el mes actual" wrap>
            <Pressable nativeID="payments-kpi-month-trigger" style={{ flex: 1 }} testID="payments-kpi-month-trigger">
              <StatTile hint={monthTile.hint} icon="cash-plus" idPrefix="payments-kpi" label={`Cobrado en ${formatMonthLong(current?.month)}`} surface="bg-slate-50 dark:bg-surface-2" value={monthTile.value} />
            </Pressable>
          </IconTooltip>
        </View>
        <View nativeID="payments-dashboard-kpi-mom" style={kpiBox} testID="payments-dashboard-kpi-mom">
          <IconTooltip idPrefix="payments-kpi-mom-tooltip" label="Variación respecto al mes anterior" wrap>
            <Pressable nativeID="payments-kpi-mom-trigger" style={{ flex: 1 }} testID="payments-kpi-mom-trigger">
              <StatTile
                hint={momTile.hint}
                icon={momTile.direction === 'down' ? 'trending-down' : momTile.direction === 'up' ? 'trending-up' : 'trending-neutral'}
                idPrefix="payments-kpi"
                label={`vs ${formatMonthLong(previous?.month)}`}
                surface="bg-slate-50 dark:bg-surface-2"
                value={momTile.value}
              />
            </Pressable>
          </IconTooltip>
        </View>
      </View>

      {/* Panel propio para los dos KPIs que dependen del período. El selector
          vive en el encabezado del panel, con su label, así queda claro qué
          cards cambia y cuáles no. */}
      <SectionCard
        icon="cash-clock"
        scope="payments-dashboard-kpi-periods"
        title="Pendientes y rechazados"
        variant="nested"
      >
        <View className={`mb-4 gap-3 ${isWide ? 'flex-row items-end justify-between' : ''}`} nativeID="payments-dashboard-kpi-period" testID="payments-dashboard-kpi-period">
          <Text className="flex-1 text-xs leading-4 text-slate-500 dark:text-slate-400" nativeID="payments-dashboard-kpi-period-caption" testID="payments-dashboard-kpi-period-caption">
            Montos netos y cantidad de cuotas del período elegido.
          </Text>
          <View style={isWide ? { width: 220 } : undefined} nativeID="payments-dashboard-kpi-period-select" testID="payments-dashboard-kpi-period-select">
            <ResponsiveSelectField
              className=""
              dense
              hideErrorRow
              label="Período"
              onChange={setKpiPeriod}
              options={RECEIVED_KPI_PERIODS}
              placeholder=""
              required
              value={kpiPeriod}
            />
          </View>
        </View>
        <View className="flex-row gap-3" nativeID="payments-dashboard-kpi-period-cards" testID="payments-dashboard-kpi-period-cards">
          <View nativeID="payments-dashboard-kpi-pending" style={kpiBox} testID="payments-dashboard-kpi-pending">
            <IconTooltip idPrefix="payments-kpi-pending-tooltip" label={`Pendiente de cobro · ${periodLabel(kpiPeriod)}`} wrap>
              <Pressable nativeID="payments-kpi-pending-trigger" style={{ flex: 1 }} testID="payments-kpi-pending-trigger">
                <StatTile
                  hint={pendingTile.hint}
                  icon="clock-outline"
                  idPrefix="payments-kpi"
                  label="Pendiente de cobro"
                  surface="bg-slate-50 dark:bg-surface-2"
                  value={pendingTile.value}
                />
              </Pressable>
            </IconTooltip>
          </View>
          <View nativeID="payments-dashboard-kpi-rejected" style={kpiBox} testID="payments-dashboard-kpi-rejected">
            <IconTooltip idPrefix="payments-kpi-rejected-tooltip" label={`Monto rechazado · ${periodLabel(kpiPeriod)}`} wrap>
              <Pressable nativeID="payments-kpi-rejected-trigger" style={{ flex: 1 }} testID="payments-kpi-rejected-trigger">
                <StatTile
                  hint={rejectedTile.hint}
                  icon="close-circle-outline"
                  idPrefix="payments-kpi"
                  label="Monto rechazado"
                  surface="bg-slate-50 dark:bg-surface-2"
                  value={rejectedTile.value}
                />
              </Pressable>
            </IconTooltip>
          </View>
        </View>
      </SectionCard>

      <PaymentsDueCard amountMode={AMOUNT_MODE} dueThisMonth={summary.dueThisMonth} isWide={isWide} overdue={summary.overdue} />

      <View className={isWide ? 'flex-row gap-4' : ''} nativeID="payments-dashboard-panels" testID="payments-dashboard-panels">
        <View nativeID="payments-dashboard-chart-panel" style={isWide ? { flex: 3 } : undefined} testID="payments-dashboard-chart-panel">
          <SectionCard icon="chart-bar" scope="payments-dashboard-chart-card" title="Ingresos por mes" variant="nested">
            <WindowNav canNext={canNext} canPrev={canPrev} label={range} onNext={onNext} onPrev={onPrev} />
            {windowLoading ? (
              <SkeletonBlock height={170} nativeID="payments-dashboard-window-skeleton" rounded="rounded-xl" testID="payments-dashboard-window-skeleton" />
            ) : windowFailed ? (
              <WindowError onRetry={onRetryWindow} />
            ) : (
              <PaymentsMonthlyChart amountMode={AMOUNT_MODE} currentMonth={currentMonth} monthly={shown.monthly} points={points} />
            )}
            <Text className="mt-3 text-xs leading-4 text-slate-500 dark:text-slate-400" nativeID="payments-dashboard-net-note" testID="payments-dashboard-net-note">
              {`Neto = lo cobrado menos la comisión de Paceron.${netIncomplete ? ' * neto parcial · s/d sin datos de neto.' : ''}`}
            </Text>
          </SectionCard>
        </View>

        <View nativeID="payments-dashboard-teams-panel" style={isWide ? { flex: 2 } : undefined} testID="payments-dashboard-teams-panel">
          <SectionCard icon="account-group" scope="payments-dashboard-teams-card" title="Cobros por equipo" variant="nested">
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
        // Clases fijas aunque cambie `enabled`: agregar/quitar pseudo-estados después
        // del primer render remonta el componente en nativo (ver CLAUDE.md, "Quirks").
        className="rounded-full p-1.5 hover:bg-slate-100 active:opacity-70 dark:hover:bg-slate-800"
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
