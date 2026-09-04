import {
  mockChangeTier, mockGetCurrentSubscription, __mockActivateSubscription, __resetMockSubscriptions,
} from '../services/__mocks__/tier-subscriptions-mock.js';

beforeEach(() => {
  __resetMockSubscriptions();
});

describe('mockChangeTier', () => {
  test('crea una suscripción first_payment_pending con cuota #1', async () => {
    const sub = await mockChangeTier(42, 3, 2);
    expect(sub.subscription_status).toBe('first_payment_pending');
    expect(sub.installment_number).toBe(1);
    expect(sub.installment_amount).toBe(4999);
    expect(sub.tier.name).toBe('premium');
  });

  test('rechaza con 409 si ya hay una cuota #1 pendiente', async () => {
    await mockChangeTier(42, 3, 2);
    await expect(mockChangeTier(42, 3, 2)).rejects.toMatchObject({ status: 409, code: 'SUBSCRIPTION_PENDING_FIRST_PAYMENT' });
  });

  test('rechaza con 404 si el tier no existe', async () => {
    await expect(mockChangeTier(42, 3, 999)).rejects.toMatchObject({ status: 404 });
  });
});

describe('mockGetCurrentSubscription', () => {
  test('sin suscripción previa, devuelve tier base sin cuota', async () => {
    const sub = await mockGetCurrentSubscription(42, 3);
    expect(sub.tier.name).toBe('base');
    expect(sub.installment_id).toBeUndefined();
  });

  test('tras mockChangeTier, refleja la suscripción pendiente', async () => {
    await mockChangeTier(42, 3, 2);
    const sub = await mockGetCurrentSubscription(42, 3);
    expect(sub.subscription_status).toBe('first_payment_pending');
  });
});

describe('__mockActivateSubscription', () => {
  test('pasa la suscripción a active y genera la cuota #2', async () => {
    await mockChangeTier(42, 3, 2);
    __mockActivateSubscription(42, 3);
    const sub = await mockGetCurrentSubscription(42, 3);
    expect(sub.subscription_status).toBe('active');
    expect(sub.paid_installments).toBe(1);
    expect(sub.installment_number).toBe(2);
  });

  test('no-op si no hay suscripción previa', () => {
    expect(() => __mockActivateSubscription(42, 3)).not.toThrow();
  });
});
