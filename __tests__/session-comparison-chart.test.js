import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';

jest.mock('@expo/vector-icons', () => ({ MaterialCommunityIcons: () => null }));
jest.mock('../theme/colors.js', () => ({
  useThemeColors: () => ({ outlineVariant: '#ddd', onSurfaceVariant: '#666', surface: '#fff', onSurface: '#111', primary: '#0a0' }),
}));
jest.mock('../components/dashboard/charts/chart-surface.jsx', () => {
  const ReactModule = require('react');
  const { View } = require('react-native');
  return {
    ChartCard: ({ children }) => ReactModule.createElement(View, null, children),
    ChartSurface: ({ children, id, height }) => ReactModule.createElement(
      View,
      { testID: id, style: { height } },
      typeof children === 'function' ? children(320) : children,
    ),
  };
});

// eslint-disable-next-line import/first -- Register the test doubles before importing the chart.
import { SessionComparisonChart } from '../components/dashboard/session-comparison-chart.jsx';

const units = { distance: 'm', duration: 'ms', speed: 'km/h' };
const makeSide = (sessionId, date, setNumber, speed, distance) => ({
  session_instance_id: sessionId,
  exercise_id: 37,
  session_date: date,
  exercise_name: 'Rodaje',
  total_distance_m: distance,
  series: [{ set_number: setNumber, speed_kph: speed, distance_meters: distance, active_duration_ms: 300000 }],
});

describe('SessionComparisonChart tooltips', () => {
  const renderChart = () => render(
    <SessionComparisonChart
      a={makeSide(101, '2026-10-01', 1, 10.5, 5000)}
      b={makeSide(102, '2026-10-08', 1, 11.2, 5500)}
      distanceDeltaM={500}
      units={units}
    />,
  );

  test('muestra el detalle de una serie al tocar un punto del gráfico de velocidad', () => {
    const { getByTestId, getByText } = renderChart();

    fireEvent.press(getByTestId('dashboard-session-comparison-chart-speed-hotspot-a-0'));

    expect(getByTestId('dashboard-session-comparison-chart-tooltip')).toBeTruthy();
    expect(getByText(/A · Serie 1 · Rodaje · 2026-10-01/)).toBeTruthy();
    expect(getByText(/Tiempo:/)).toBeTruthy();
  });

  test('muestra distancia y delta al tocar una barra de A o B', () => {
    const { getByTestId, getByText } = renderChart();

    fireEvent.press(getByTestId('dashboard-session-comparison-chart-distance-row-b'));

    expect(getByTestId('dashboard-session-comparison-chart-distance-tooltip')).toBeTruthy();
    expect(getByText(/Sesión B/)).toBeTruthy();
    expect(getByTestId('dashboard-session-comparison-chart-distance-tooltip-delta')).toBeTruthy();
  });
});
