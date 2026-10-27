import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import { Text } from 'react-native';

jest.mock('../hooks/use-is-narrow-web.js', () => ({ useIsNarrowWeb: () => true }));
jest.mock('../theme/colors.js', () => ({ useThemeColors: () => ({ primary: '#8cc63e', onSurfaceVariant: '#666' }) }));
jest.mock('@expo/vector-icons', () => ({ MaterialCommunityIcons: () => null }));
jest.mock('../components/shared/tab-bar.jsx', () => {
  const ReactModule = require('react');
  const { Pressable: NativePressable, Text: NativeText, View: NativeView } = require('react-native');
  return {
    TabBar: ({ onChange, tabs }) => ReactModule.createElement(
      NativeView,
      null,
      ...tabs.map((tab) => ReactModule.createElement(
        NativePressable,
        { key: tab.id, onPress: () => onChange(tab.id), testID: `mobile-tab-${tab.id}` },
        ReactModule.createElement(NativeText, null, tab.label),
      )),
    ),
  };
});
jest.mock('../components/dashboard/charts/chart-surface.jsx', () => {
  const ReactModule = require('react');
  const { View: NativeView } = require('react-native');
  return {
    ChartCard: ({ children, id }) => ReactModule.createElement(NativeView, { testID: id }, children),
  };
});

// eslint-disable-next-line import/first -- Register responsive component mocks before importing the views.
import { DashboardUtilityPanel } from '../components/dashboard/dashboard-utility-panel.jsx';
// eslint-disable-next-line import/first -- Register responsive component mocks before importing the views.
import { ChartGrid, ChartGridItem } from '../components/dashboard/chart-grid.jsx';

describe('mobile dashboard layout', () => {
  test('opens filters as a sheet action instead of rendering the form inline', () => {
    const onOpenFilters = jest.fn();
    const { getByTestId, queryByTestId } = render(
      <DashboardUtilityPanel
        filterCount={2}
        filtersContent={<Text nativeID="filters-inline" testID="filters-inline">Form fields</Text>}
        onOpenFilters={onOpenFilters}
        qualityBadge={null}
        qualityContent={<Text nativeID="quality-inline" testID="quality-inline">Quality details</Text>}
      />,
    );

    fireEvent.press(getByTestId('mobile-tab-filters'));

    expect(onOpenFilters).toHaveBeenCalledTimes(1);
    expect(queryByTestId('filters-inline')).toBeNull();

    fireEvent.press(getByTestId('mobile-tab-quality'));
    expect(getByTestId('quality-inline')).toBeTruthy();
  });

  test('opens the primary graph first and leaves secondary charts collapsed in a narrow layout', () => {
    const { getByTestId, getAllByTestId, queryByTestId } = render(
      <ChartGrid id="mobile-grid" ids={['secondary-card', 'main-card']} initialExpandedId="main-card">
        <ChartGridItem id="secondary-card" preview={<Text nativeID="secondary-preview" testID="secondary-preview">Resumen</Text>} title="Secundario">
          <Text nativeID="secondary-graph" testID="secondary-graph">Gráfico secundario</Text>
        </ChartGridItem>
        <ChartGridItem id="main-card" mobileOrder={-1} preview={<Text nativeID="main-preview" testID="main-preview">Evolución</Text>} title="Principal">
          <Text nativeID="main-graph" testID="main-graph">Gráfico principal</Text>
        </ChartGridItem>
      </ChartGrid>,
    );

    expect(getByTestId('main-graph')).toBeTruthy();
    expect(queryByTestId('secondary-graph')).toBeNull();
    expect(getByTestId('secondary-preview')).toBeTruthy();
    expect(getAllByTestId(/-slot$/).map((element) => element.props.testID)).toEqual(['main-card-slot', 'secondary-card-slot']);
  });
});
