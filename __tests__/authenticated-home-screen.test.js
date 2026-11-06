import React from 'react';
import { render } from '@testing-library/react-native';

const mockAuthState = { userId: 33, activeRole: 'trainer' };
const mockQueryClient = { invalidateQueries: jest.fn(async () => undefined) };
let mockRefreshFn;

jest.mock('@tanstack/react-query', () => ({ useQueryClient: () => mockQueryClient }));
jest.mock('../store/auth-store.js', () => ({ useAuthStore: (selector) => selector(mockAuthState) }));
jest.mock('../hooks/use-user.js', () => ({ useUser: () => ({ user: { name: 'Alex' } }) }));
jest.mock('../theme/colors.js', () => ({ useThemeColors: () => ({ primary: '#8cc63e' }) }));
jest.mock('../hooks/use-pull-to-refresh.js', () => ({
  usePullToRefresh: (refreshFn) => {
    mockRefreshFn = refreshFn;
    return { refreshing: false, onRefresh: refreshFn };
  },
}));

jest.mock('../components/home/next-training-banner.jsx', () => {
  const ReactModule = require('react');
  const { View: NativeView } = require('react-native');
  return { NextTrainingBanner: () => ReactModule.createElement(NativeView, { testID: 'home-next-training' }) };
});
jest.mock('../components/home/streak-banner.jsx', () => ({ StreakBanner: () => null }));
jest.mock('../components/home/achievement-highlight-card.jsx', () => ({ AchievementHighlightCard: () => null }));
jest.mock('../components/home/runner-kpis-card.jsx', () => ({ RunnerKpisCard: () => null }));
jest.mock('../components/home/trainer-home-kpis-card.jsx', () => {
  const ReactModule = require('react');
  const { View: NativeView } = require('react-native');
  return { TrainerHomeKpisCard: () => ReactModule.createElement(NativeView, { testID: 'trainer-home-kpis-mounted' }) };
});
jest.mock('../components/home/home-payments-due-card.jsx', () => ({ HomePaymentsDueCard: () => null }));
jest.mock('../components/home/competitions-preview-card.jsx', () => ({ CompetitionsPreviewCard: () => null }));

import { PAYMENT_HISTORY_KEYS } from '../hooks/use-payment-history.js';
import { AuthenticatedHomeScreen } from '../components/home/authenticated-home-screen.jsx';

beforeEach(() => {
  mockAuthState.activeRole = 'trainer';
  mockQueryClient.invalidateQueries.mockClear();
});

test('muestra los KPIs del entrenador y los invalida al refrescar solo con ese rol', async () => {
  const { getByTestId, toJSON } = render(<AuthenticatedHomeScreen />);
  expect(getByTestId('trainer-home-kpis-mounted')).toBeTruthy();

  const testIDs = [];
  const visit = (node) => {
    if (!node) return;
    if (Array.isArray(node)) return node.forEach(visit);
    if (node.props?.testID) testIDs.push(node.props.testID);
    visit(node.children);
  };
  visit(toJSON());
  expect(testIDs.indexOf('home-next-training')).toBeLessThan(testIDs.indexOf('trainer-home-kpis-mounted'));

  await mockRefreshFn();

  expect(mockQueryClient.invalidateQueries).toHaveBeenCalledWith({ queryKey: ['trainer-home-kpis', 33] });
  expect(mockQueryClient.invalidateQueries).not.toHaveBeenCalledWith({ queryKey: ['runner-kpis'] });
  expect(mockQueryClient.invalidateQueries).toHaveBeenCalledWith({ queryKey: PAYMENT_HISTORY_KEYS.upcoming(33) });
});

test('no monta los KPIs de entrenador en el Home de corredor', () => {
  mockAuthState.activeRole = 'runner';
  const { queryByTestId } = render(<AuthenticatedHomeScreen />);
  expect(queryByTestId('trainer-home-kpis-mounted')).toBeNull();
});
