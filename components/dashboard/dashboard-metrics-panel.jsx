import { useState } from 'react';
import { Text, View } from 'react-native';
import { TabBar } from '../shared/tab-bar.jsx';
import { SkeletonBlock } from '../shared/skeleton.jsx';
import { PaletteSwitch } from './palette-switch.jsx';
import { ProfileRadarCard } from './profile-radar-card.jsx';
import { StateError } from './state-error.jsx';

export function DashboardMetricsPanel({
  id,
  summary,
  timeseries,
  kind,
  granularity,
  onGranularityChange,
  seriesSamples,
  seriesPoints,
  radarTitle,
  renderRanking = null,
  reportMode = false,
  capturePageRefFor,
  onReportReady,
  // La pestaña activa puede vivir en la pantalla (ver DashboardScreen): así el
  // screen sabe cuándo habilitar la query de gráficos, que es carísima y no hace
  // falta para pintar los KPIs. Sin estas props el panel sigue funcionando solo.
  activeSection = null,
  onSectionChange = null,
  chartsLoading = false,
  chartsError = null,
  onRetryCharts = null,
}) {
  const [localActive, setLocalActive] = useState('kpis');
  const active = activeSection ?? localActive;
  // El ranking NO es una pestaña de la pantalla: se muestra en la pestaña
  // Leaderboard del detalle de equipo. Acá solo se usa para armar la página del
  // PDF en `reportMode` (ver dashboard-screen.jsx#captureDashboardReport).
  const tabs = [
    { id: 'kpis', label: 'KPIs', icon: 'view-dashboard-outline' },
    { id: 'charts', label: 'Gráficos', icon: 'chart-box-outline' },
  ];
  const current = tabs.some((tab) => tab.id === active) ? active : 'kpis';
  const changeSection = (next) => {
    setLocalActive(next);
    onSectionChange?.(next);
  };
  const paletteProps = {
    granularity,
    id: `${id}-palette`,
    kind,
    onGranularityChange,
    seriesPoints,
    seriesSamples,
    summary,
    timeseries,
  };

  if (reportMode) {
    return (
      <View className="gap-5" nativeID={`${id}-report`} testID={`${id}-report`}>
        <View
          className="gap-2"
          collapsable={false}
          nativeID={`${id}-kpis-page`}
          ref={capturePageRefFor?.(`${id}-kpis-page`)}
          testID={`${id}-kpis-page`}
        >
          <Text className="text-sm font-bold text-slate-900 dark:text-white" nativeID={`${id}-report-kpis-title`} testID={`${id}-report-kpis-title`}>
            KPIs
          </Text>
          <PaletteSwitch {...paletteProps} section="kpis" />
        </View>

        <View
          collapsable={false}
          nativeID={`${id}-profile-page`}
          ref={capturePageRefFor?.(`${id}-profile-page`)}
          testID={`${id}-profile-page`}
        >
          <ProfileRadarCard id={`${id}-profile`} kind={kind} summary={summary} title={radarTitle} />
        </View>

        <View
          collapsable={false}
          nativeID={`${id}-charts-page`}
          ref={capturePageRefFor?.(`${id}-charts-page`)}
          testID={`${id}-charts-page`}
        >
          <PaletteSwitch
            {...paletteProps}
            forceExpandCharts
            id={`${id}-report-charts`}
            section="charts"
          />
        </View>

        {renderRanking ? renderRanking({
          captureRef: capturePageRefFor?.(`${id}-ranking-page`),
          onReportReady,
          reportMode: true,
        }) : null}
      </View>
    );
  }

  return (
    <View nativeID={id} testID={id}>
      <TabBar
        active={current}
        onChange={changeSection}
        scope={`${id}-tabs`}
        tabs={tabs}
        variant="default"
      />
      <View
        aria-labelledby={`${id}-tabs-${current}`}
        nativeID={`${id}-tabpanel-${current}`}
        role="tabpanel"
        testID={`${id}-tabpanel-${current}`}
      >
        {current === 'kpis' ? (
          <>
            <PaletteSwitch {...paletteProps} section="kpis" />
            <ProfileRadarCard id={`${id}-profile`} kind={kind} summary={summary} title={radarTitle} />
          </>
        ) : null}
        {current === 'charts' ? (
          chartsError && !timeseries ? (
            <StateError
              error={chartsError}
              id={`${id}-charts-error`}
              onRetry={onRetryCharts}
              title="No pudimos cargar los gráficos"
            />
          ) : chartsLoading || !timeseries ? (
            <ChartsSkeleton id={`${id}-charts-loading`} />
          ) : (
            <PaletteSwitch {...paletteProps} section="charts" />
          )
        ) : null}
      </View>
    </View>
  );
}

// La pestaña de gráficos es lazy: mientras llega la primera respuesta del
// timeseries se muestra este esqueleto en vez de gráficos vacíos. Reusa el
// shimmer compartido; no bloquea los KPIs, que ya están visibles arriba.
function ChartsSkeleton({ id }) {
  return (
    <View className="gap-3" nativeID={id} testID={id}>
      <SkeletonBlock height={20} nativeID={`${id}-title`} testID={`${id}-title`} width="45%" />
      <SkeletonBlock height={196} nativeID={`${id}-chart`} testID={`${id}-chart`} />
      <SkeletonBlock height={140} nativeID={`${id}-chart-2`} testID={`${id}-chart-2`} />
    </View>
  );
}
