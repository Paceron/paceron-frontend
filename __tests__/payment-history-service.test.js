import api from '../services/api.js';
import { getPaymentHistory, getUpcomingPayments } from '../services/payment-history.js';

jest.mock('../config/env.js', () => ({ USE_MOCKS: false }));
jest.mock('../services/api.js', () => ({
  __esModule: true,
  default: { get: jest.fn().mockResolvedValue({}) },
}));

describe('payment-history service — perfil activo', () => {
  beforeEach(() => api.get.mockClear());

  test('el historial manda profile junto con tipo y estado', async () => {
    await getPaymentHistory({ page: 1, type: 'trainer_payment', status: 'approved', profile: 'corredor' });

    expect(api.get).toHaveBeenCalledWith('/payments/history?page=1&type=trainer_payment&status=approved&profile=corredor');
  });

  test('próximos vencimientos manda profile para no mezclar tiers', async () => {
    await getUpcomingPayments({ profile: 'entrenador' });

    expect(api.get).toHaveBeenCalledWith('/payments/upcoming?profile=entrenador');
  });

  test('sin profile no ensucia la query', async () => {
    await getUpcomingPayments();

    expect(api.get).toHaveBeenCalledWith('/payments/upcoming');
  });
});
