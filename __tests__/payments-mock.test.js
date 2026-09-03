import {
  mockCreatePreference, mockProcessPayment, mockGetPayment, mockCreateTestCardToken, __resetMockPayments,
} from '../services/__mocks__/payments-mock.js';

beforeEach(() => {
  __resetMockPayments();
});

describe('mockCreatePreference', () => {
  test('crea una preferencia con items válidos', async () => {
    const result = await mockCreatePreference({
      concept: 'order',
      items: [{ title: 'Item de prueba', quantity: 1, unit_price: 1000 }],
    });
    expect(result.preference_id).toMatch(/^mock-pref-/);
    expect(result.public_key).toBe('TEST-mock-public-key');
  });

  test('rechaza sin concept', async () => {
    await expect(mockCreatePreference({ items: [{ title: 'x', quantity: 1, unit_price: 1 }] })).rejects.toMatchObject({ status: 400 });
  });

  test('rechaza un item sin title', async () => {
    await expect(mockCreatePreference({ concept: 'order', items: [{ quantity: 1, unit_price: 1 }] })).rejects.toMatchObject({ status: 400 });
  });
});

describe('mockProcessPayment', () => {
  test('aprueba un pago con todos los campos requeridos', async () => {
    const payment = await mockProcessPayment({
      token: 'card-token', transaction_amount: 1000, payment_method_id: 'visa', installments: 1, payer_email: 'a@b.com',
    });
    expect(payment.status).toBe('approved');
    expect(payment.payment_id).toMatch(/^mock-payment-/);
  });

  test('rechaza sin token', async () => {
    await expect(mockProcessPayment({ transaction_amount: 1000, payment_method_id: 'visa', installments: 1, payer_email: 'a@b.com' })).rejects.toMatchObject({ status: 400 });
  });
});

describe('mockGetPayment', () => {
  test('devuelve el pago creado, por id o payment_id', async () => {
    const created = await mockProcessPayment({
      token: 'card-token', transaction_amount: 1000, payment_method_id: 'visa', installments: 1, payer_email: 'a@b.com',
    });
    const byId = await mockGetPayment(created.id);
    expect(byId).toEqual(created);
    const byPaymentId = await mockGetPayment(created.payment_id);
    expect(byPaymentId).toEqual(created);
  });

  test('tira 404-like para un id desconocido', async () => {
    await expect(mockGetPayment(9999)).rejects.toMatchObject({ status: 404 });
  });
});

describe('mockCreateTestCardToken', () => {
  test('genera un token con datos de tarjeta completos', async () => {
    const result = await mockCreateTestCardToken({
      card_number: '4509953566233704', cardholder_name: 'APRO', expiration_month: '11', expiration_year: '30',
      identification_number: '12345678', identification_type: 'DNI', security_code: '123',
    });
    expect(result.token).toMatch(/^mock-card-token-/);
  });

  test('rechaza con datos incompletos', async () => {
    await expect(mockCreateTestCardToken({ card_number: '123' })).rejects.toMatchObject({ status: 400 });
  });
});
