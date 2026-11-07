import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';

jest.mock('../theme/colors.js', () => ({ useThemeColors: () => ({ warning: '#b45309', onSurfaceVariant: '#666' }) }));
jest.mock('@expo/vector-icons', () => ({ MaterialCommunityIcons: () => null }));
jest.mock('../hooks/use-trainer-home-kpis.js', () => ({ useTrainerHomeKpis: jest.fn() }));

import { useTrainerHomeKpis } from '../hooks/use-trainer-home-kpis.js';
import { TrainerHomeKpisCard } from '../components/home/trainer-home-kpis-card.jsx';

beforeEach(() => {
  useTrainerHomeKpis.mockReturnValue({
    data: {
      period: 'month', from: '2026-11-01', to: '2026-11-30', daysConsidered: 30,
      sessions: { scheduled: 18, realized: 12, presencialScheduled: 8, presencialRealized: 6 },
      structure: { activeTeams: 2, activeRunners: 17 },
      collections: { currencyId: 'ARS', netCollected: 286500.5, pendingAmount: 30000, pendingCount: 3 },
    },
    loading: false, refreshing: false, failed: false, error: null, refetch: jest.fn(),
  });
});

test('muestra los cuatro KPIs temporales y los dos totales actuales', () => {
  const { getByTestId, getByText } = render(<TrainerHomeKpisCard />);
  expect(getByText('Resumen de tus equipos')).toBeTruthy();
  expect(getByTestId('trainer-home-kpis-period-sessions-tile-value').props.children).toBe('18 / 12');
  expect(getByTestId('trainer-home-kpis-period-presencialSessions-tile-value').props.children).toBe('8 / 6');
  expect(getByTestId('trainer-home-kpis-structure-activeTeams-tile-value').props.children).toBe('2');
  expect(getByTestId('trainer-home-kpis-structure-activeRunners-tile-value').props.children).toBe('17');
  expect(getByText('Tu estructura actual')).toBeTruthy();
});

test('reutiliza el overlay animado con un texto de carga contextual', () => {
  useTrainerHomeKpis.mockReturnValue({
    data: null, loading: true, refreshing: false, failed: false, error: null, refetch: jest.fn(),
  });
  const { getByTestId } = render(<TrainerHomeKpisCard />);
  expect(getByTestId('trainer-home-kpis-loading-overlay')).toBeTruthy();
  expect(getByTestId('trainer-home-kpis-loading-label').props.children).toBe('Cargando resumen…');
});

test('eleva solo la grilla cuyo tooltip está abierto sobre la otra sección', () => {
  const { getByTestId } = render(<TrainerHomeKpisCard />);
  fireEvent.press(getByTestId('trainer-home-kpis-period-sessions-trigger'));
  expect(getByTestId('trainer-home-kpis-period-metrics').props.style.zIndex).toBe(2);
  expect(getByTestId('trainer-home-kpis-structure-metrics').props.style.zIndex).toBe(0);

  fireEvent.press(getByTestId('trainer-home-kpis-structure-activeTeams-trigger'));
  expect(getByTestId('trainer-home-kpis-period-metrics').props.style.zIndex).toBe(0);
  expect(getByTestId('trainer-home-kpis-structure-metrics').props.style.zIndex).toBe(2);
});
