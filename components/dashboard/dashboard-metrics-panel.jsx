import { useState } from 'react';
import { Text, View } from 'react-native';
import { TabBar } from '../shared/tab-bar.jsx';
import { PaletteSwitch } from './palette-switch.jsx';
import { ProfileRadarCard } from './profile-radar-card.jsx';

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
}) {
  const [active, setActive] = useState('kpis');
  const tabs = [
    { id: 'kpis', label: 'KPIs', icon: 'view-dashboard-outline' },
    { id: 'charts', label: 'Gráficos', icon: 'chart-box-outline' },
    ...(renderRanking ? [{ id: 'ranking', label: 'Ranking', icon: 'podium' }] : []),
  ];
  const current = tabs.some((tab) => tab.id === active) ? active : 'kpis';
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
          nativeID={`${id}-report-kpis-page`}
          ref={capturePageRefFor?.(`${id}-report-kpis-page`)}
          testID={`${id}-report-kpis-page`}
        >
          <Text className="text-sm font-bold text-slate-900 dark:text-white" nativeID={`${id}-report-kpis-title`} testID={`${id}-report-kpis-title`}>
            KPIs
          </Text>
          <PaletteSwitch {...paletteProps} section="kpis" />
        </View>

        <View
          collapsable={false}
          nativeID={`${id}-report-profile-page`}
          ref={capturePageRefFor?.(`${id}-report-profile-page`)}
          testID={`${id}-report-profile-page`}
        >
          <ProfileRadarCard id={`${id}-profile`} kind={kind} summary={summary} title={radarTitle} />
        </View>

        <View
          collapsable={false}
          nativeID={`${id}-report-charts-page`}
          ref={capturePageRefFor?.(`${id}-report-charts-page`)}
          testID={`${id}-report-charts-page`}
        >
          <PaletteSwitch
            {...paletteProps}
            forceExpandCharts
            id={`${id}-report-charts`}
            section="charts"
          />
        </View>

        {renderRanking ? renderRanking({
          captureRef: capturePageRefFor?.(`${id}-report-ranking-page`),
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
        onChange={setActive}
        scope={`${id}-tabs`}
        tabs={tabs}
        variant="compact"
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
        {current === 'charts' ? <PaletteSwitch {...paletteProps} section="charts" /> : null}
        {current === 'ranking' && renderRanking ? renderRanking({ reportMode: false }) : null}
      </View>
    </View>
  );
}
