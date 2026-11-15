import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';

jest.mock('../components/shared/tab-bar.jsx', () => {
  const ReactModule = require('react');
  const { Pressable: NativePressable, Text: NativeText, View: NativeView } = require('react-native');
  return {
    TabBar: ({ onChange, tabs, scope }) => ReactModule.createElement(
      NativeView,
      null,
      ...tabs.map((tab) => ReactModule.createElement(
        NativePressable,
        { key: tab.id, onPress: () => onChange(tab.id), testID: `${scope}-${tab.id}` },
        ReactModule.createElement(NativeText, null, tab.label),
      )),
    ),
  };
});
jest.mock('../components/dashboard/palette-switch.jsx', () => {
  const ReactModule = require('react');
  const { View: NativeView } = require('react-native');
  return {
    PaletteSwitch: ({ section }) => ReactModule.createElement(NativeView, { testID: `palette-${section}` }),
  };
});
jest.mock('../components/dashboard/profile-radar-card.jsx', () => ({ ProfileRadarCard: () => null }));
jest.mock('../components/shared/skeleton.jsx', () => {
  const ReactModule = require('react');
  const { View: NativeView } = require('react-native');
  return {
    SkeletonBlock: ({ nativeID, testID }) => ReactModule.createElement(NativeView, { testID: testID ?? nativeID }),
  };
});
jest.mock('../components/dashboard/state-error.jsx', () => {
  const ReactModule = require('react');
  const { View: NativeView } = require('react-native');
  return {
    StateError: ({ id }) => ReactModule.createElement(NativeView, { testID: id }),
  };
});

// eslint-disable-next-line import/first -- Register mocks before importing the panel.
import { DashboardMetricsPanel } from '../components/dashboard/dashboard-metrics-panel.jsx';

const BASE_PROPS = {
  id: 'panel',
  summary: { units: {}, totals: {} },
  timeseries: null,
  kind: 'velocidad_distancia',
  granularity: 'week',
  onGranularityChange: () => {},
  seriesSamples: [],
  seriesPoints: [],
  radarTitle: 'Perfil',
};

describe('DashboardMetricsPanel — carga diferida de gráficos', () => {
  test('los KPIs se pintan sin esperar la data de gráficos', () => {
    const { getByTestId, queryByTestId } = render(<DashboardMetricsPanel {...BASE_PROPS} />);

    expect(getByTestId('palette-kpis')).toBeTruthy();
    expect(queryByTestId('palette-charts')).toBeNull();
    expect(queryByTestId('panel-charts-loading')).toBeNull();
  });

  test('al elegir Gráficos avisa a la pantalla para que recién ahí pida el timeseries', () => {
    const onSectionChange = jest.fn();
    const { getByTestId } = render(
      <DashboardMetricsPanel {...BASE_PROPS} onSectionChange={onSectionChange} />,
    );

    fireEvent.press(getByTestId('panel-tabs-charts'));

    expect(onSectionChange).toHaveBeenCalledWith('charts');
  });

  test('en Gráficos muestra un esqueleto mientras el timeseries está en vuelo', () => {
    const { getByTestId, queryByTestId } = render(
      <DashboardMetricsPanel {...BASE_PROPS} activeSection="charts" chartsLoading />,
    );

    expect(getByTestId('panel-charts-loading')).toBeTruthy();
    expect(queryByTestId('palette-charts')).toBeNull();
  });

  test('cuando llega el timeseries reemplaza el esqueleto por los gráficos', () => {
    const { getByTestId, queryByTestId } = render(
      <DashboardMetricsPanel {...BASE_PROPS} activeSection="charts" timeseries={{ buckets: [] }} />,
    );

    expect(getByTestId('palette-charts')).toBeTruthy();
    expect(queryByTestId('panel-charts-loading')).toBeNull();
  });

  test('si falla el timeseries muestra el error propio de gráficos', () => {
    const { getByTestId } = render(
      <DashboardMetricsPanel
        {...BASE_PROPS}
        activeSection="charts"
        chartsError={new Error('boom')}
        onRetryCharts={() => {}}
      />,
    );

    expect(getByTestId('panel-charts-error')).toBeTruthy();
  });
});
