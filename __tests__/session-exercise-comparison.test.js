import React from 'react';
import { render, waitFor } from '@testing-library/react-native';

const mockSeriesCalls = [];

jest.mock('../store/auth-store.js', () => ({
  useAuthStore: (selector) => selector({ userId: 24 }),
}));

jest.mock('../hooks/use-dashboard-series.js', () => ({
  useDashboardSeries: (options) => {
    mockSeriesCalls.push(options);
    return {
      series: [], loading: false, refreshing: false, loadingMore: false,
      failed: false, hasMore: false, error: null, refetch: jest.fn(), loadMore: jest.fn(),
    };
  },
}));

jest.mock('../hooks/use-dashboard-session-comparison.js', () => ({
  useDashboardGroupAthletes: () => ({ athleteIds: [], loading: false, failed: false, error: null, refetch: jest.fn() }),
  useDashboardSessionComparison: () => ({ data: null, loading: false, fetching: false, failed: false, error: null, refetch: jest.fn() }),
}));

jest.mock('../theme/colors.js', () => ({ useThemeColors: () => ({ primary: '#000', onSurfaceVariant: '#666' }) }));
jest.mock('@expo/vector-icons', () => ({ MaterialCommunityIcons: () => null }));
jest.mock('../components/forms/searchable-picker-field.jsx', () => ({ SearchablePickerField: () => null }));
jest.mock('../components/forms/responsive-select-field.jsx', () => ({ ResponsiveSelectField: () => null }));
jest.mock('../components/dashboard/dashboard-date-field.jsx', () => ({ DashboardDateField: () => null }));
jest.mock('../components/shared/tab-bar.jsx', () => ({ TabBar: () => null }));
jest.mock('../components/dashboard/session-comparison-chart.jsx', () => ({
  SessionComparisonChart: () => null,
  SESSION_SIDE_COLORS: { a: '#aaa', b: '#bbb' },
}));

// eslint-disable-next-line import/first -- Register the component dependencies' test doubles before importing it.
import { SessionExerciseComparison } from '../components/dashboard/session-exercise-comparison.jsx';

describe('SessionExerciseComparison', () => {
  beforeEach(() => {
    mockSeriesCalls.length = 0;
  });

  test('pasa el teamId actual a las consultas de sesiones A y B', async () => {
    render(
      <SessionExerciseComparison
        availableDateRange={{ min: '2026-07-21', max: '2026-10-22' }}
        exercises={[{ id: 37, name: 'Rodaje', kind: 'ritmo_continuo' }]}
        groups={[{ id: 39, name: 'Animals' }]}
        isNarrow
        isTrainer={false}
        teamId={12}
      />,
    );

    await waitFor(() => {
      expect(mockSeriesCalls.filter((call) => call.enabled)).toHaveLength(2);
    });
    expect(mockSeriesCalls.filter((call) => call.enabled).map((call) => call.teamId)).toEqual([12, 12]);
  });
});
