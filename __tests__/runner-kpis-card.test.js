import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';

jest.mock('../theme/colors.js', () => ({
  useThemeColors: () => ({ warning: '#b45309' }),
}));
jest.mock('@expo/vector-icons', () => ({ MaterialCommunityIcons: () => null }));
jest.mock('../hooks/use-runner-kpis.js', () => ({ useRunnerKpis: jest.fn() }));
jest.mock('../components/shared/tab-bar.jsx', () => {
  const ReactModule = require('react');
  const { Pressable: NativePressable, Text: NativeText, View: NativeView } = require('react-native');
  return {
    TabBar: ({ active, onChange, scope, tabs }) => ReactModule.createElement(
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

// eslint-disable-next-line import/first -- los mocks de arriba tienen que registrarse antes del componente.
import { useRunnerKpis } from '../hooks/use-runner-kpis.js';
// eslint-disable-next-line import/first -- los mocks de arriba tienen que registrarse antes del componente.
import { RunnerKpisCard } from '../components/home/runner-kpis-card.jsx';

const METRICS = {
  total_distance_m: 84250,
  best_day_distance_m: 12000,
  best_day_date: '2026-10-11',
  best_speed_kph: 16.4,
  average_speed_kph: 10.8,
  best_distance_m: 5000,
  best_time_ms: 1380000,
};

const DATA = {
  period: 'month',
  reference_date: '2026-10-30',
  from: '2026-10-01',
  to: '2026-10-31',
  days_considered: 31,
  tab: 'general',
  has_data: true,
  series_count: 3,
  valid_series: 3,
  sessions: 2,
  metrics: METRICS,
};

function mockKpis(data = DATA, overrides = {}) {
  useRunnerKpis.mockReturnValue({
    data,
    loading: false,
    refreshing: false,
    failed: false,
    error: null,
    refetch: jest.fn(),
    ...overrides,
  });
}

describe('RunnerKpisCard — cards de métricas', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('cada métrica de la pestaña es una card con su valor formateado', () => {
    mockKpis();
    const { getByTestId, queryByTestId } = render(<RunnerKpisCard />);

    expect(getByTestId('runner-kpis-cards')).toBeTruthy();
    expect(getByTestId('runner-kpis-total_distance_m-tile-label').props.children).toBe('Distancia recorrida');
    expect(getByTestId('runner-kpis-total_distance_m-tile-value').props.children).toBe('84,3 km');
    expect(getByTestId('runner-kpis-best_day_distance_m-tile-value').props.children).toBe('12,0 km');
    expect(queryByTestId('runner-kpis-best_day_date-tile-value')).toBeNull();
    expect(getByTestId('runner-kpis-best_speed_kph-tile-value').props.children).toBe('16,4 km/h');
    expect(getByTestId('runner-kpis-average_speed_kph-tile-value').props.children).toBe('10,8 km/h');
  });

  test('el label corto del promedio deja el alcance en el tooltip', () => {
    mockKpis();
    const { getByTestId } = render(<RunnerKpisCard />);

    expect(getByTestId('runner-kpis-average_speed_kph-tile-label').props.children).toBe('Velocidad promedio');

    fireEvent.press(getByTestId('runner-kpis-average_speed_kph-trigger'));

    expect(getByTestId('runner-kpis-average_speed_kph-bubble-formula').props.children)
      .toMatch(/solo con series de ritmo continuo/);
  });

  test('la fecha del mejor día vive en el tooltip de la mayor distancia', () => {
    mockKpis();
    const { getByTestId, queryByTestId } = render(<RunnerKpisCard />);

    expect(queryByTestId('runner-kpis-best_day_date-cell')).toBeNull();

    fireEvent.press(getByTestId('runner-kpis-best_day_distance_m-trigger'));

    expect(getByTestId('runner-kpis-best_day_distance_m-bubble-meta-0').props.children)
      .toBe('Fecha del mejor día: 11/10/2026');
    expect(getByTestId('runner-kpis-best_day_distance_m-bubble-meta-1').props.children).toBe('Series usadas: 3');
  });

  test('el tooltip abre al presionar y muestra series y sesiones, no tolerancia', () => {
    mockKpis();
    const { getByTestId, queryByTestId } = render(<RunnerKpisCard />);

    expect(queryByTestId('runner-kpis-total_distance_m-bubble')).toBeNull();

    fireEvent.press(getByTestId('runner-kpis-total_distance_m-trigger'));

    expect(getByTestId('runner-kpis-total_distance_m-bubble-formula').props.children)
      .toBe('Suma de la distancia de las series válidas de esta pestaña.');
    expect(getByTestId('runner-kpis-total_distance_m-bubble-meta-0').props.children).toBe('Series usadas: 3');
    expect(getByTestId('runner-kpis-total_distance_m-bubble-meta-1').props.children).toBe('Sesiones: 2');
    expect(queryByTestId('runner-kpis-total_distance_m-bubble-tolerance')).toBeNull();

    fireEvent.press(getByTestId('runner-kpis-total_distance_m-trigger'));
    expect(queryByTestId('runner-kpis-total_distance_m-bubble')).toBeNull();
  });

  test('sin datos muestra todas las cards en "—" y la nota del período', () => {
    mockKpis({ ...DATA, has_data: false, valid_series: 0, sessions: 0 });
    const { getByTestId, queryByTestId } = render(<RunnerKpisCard />);

    expect(getByTestId('runner-kpis-total_distance_m-tile-value').props.children).toBe('—');
    expect(getByTestId('runner-kpis-best_day_distance_m-tile-value').props.children).toBe('—');
    expect(getByTestId('runner-kpis-empty').props.children).toBe('Sin datos en este período.');

    fireEvent.press(getByTestId('runner-kpis-total_distance_m-trigger'));
    expect(queryByTestId('runner-kpis-total_distance_m-bubble-meta')).toBeNull();
  });

  test('ante un error reemplaza la grilla por el mensaje y el reintento', () => {
    const refetch = jest.fn();
    mockKpis(undefined, {
      failed: true,
      error: { status: 500, message: 'No pudimos cargar las métricas.' },
      refetch,
    });
    const { getByTestId, queryByTestId } = render(<RunnerKpisCard />);

    expect(queryByTestId('runner-kpis-cards')).toBeNull();
    expect(getByTestId('runner-kpis-error')).toBeTruthy();

    fireEvent.press(getByTestId('runner-kpis-retry'));
    expect(refetch).toHaveBeenCalledTimes(1);
  });
});
