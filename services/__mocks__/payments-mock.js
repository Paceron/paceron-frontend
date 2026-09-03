// Simula POST /payments/preference, POST /payments, GET /payments/:id,
// POST /payments/test-card-token para EXPO_PUBLIC_USE_MOCKS=true — el
// backend real de Fase 0 ya existe (ver
// docs/superpowers/specs/2026-09-02-payments-fase0-frontend-design.md),
// esto es solo para probar la plomería sin pegarle a Mercado Pago.
// mockProcessPayment siempre aprueba (estado determinístico) — no hay
// necesidad de simular rechazos en esta ronda, sin verificación en vivo
// contra MP todavía.
// `mockPreferences` guarda concept/description por preference_id — el
// backend real los persiste server-side al crear la preferencia y los
// recupera al procesar el pago (ProcessPaymentRequest NO lleva concept,
// solo preference_id, ver swagger); sin este mapa el mock no podría
// reflejar el concept real en la respuesta de mockProcessPayment.
let mockPreferences = {};
let mockPayments = [];
let nextPreferenceId = 1;
let nextPaymentId = 1;

export async function mockCreatePreference({ concept, description, items } = {}) {
  if (!concept || !Array.isArray(items) || items.length === 0) {
    const error = new Error('concept e items son requeridos.');
    error.status = 400;
    throw error;
  }
  for (const item of items) {
    if (!item.title || !item.quantity || item.quantity < 1 || item.unit_price == null || item.unit_price < 0) {
      const error = new Error('Cada item necesita title, quantity >= 1 y unit_price >= 0.');
      error.status = 400;
      throw error;
    }
  }
  const preferenceId = `mock-pref-${nextPreferenceId++}`;
  mockPreferences[preferenceId] = { concept, description: description ?? null };
  return {
    preference_id: preferenceId,
    public_key: 'TEST-mock-public-key',
  };
}

export async function mockProcessPayment(payload = {}) {
  const required = ['token', 'transaction_amount', 'payment_method_id', 'installments', 'payer_email'];
  if (required.some((key) => payload[key] == null)) {
    const error = new Error(`Faltan campos requeridos: ${required.join(', ')}.`);
    error.status = 400;
    throw error;
  }
  const preference = payload.preference_id ? mockPreferences[payload.preference_id] : null;
  const now = new Date().toISOString();
  const payment = {
    id: nextPaymentId,
    payment_id: `mock-payment-${nextPaymentId}`,
    preference_id: payload.preference_id ?? null,
    external_reference: `mock-ext-ref-${nextPaymentId}`,
    concept: preference?.concept ?? 'order',
    description: preference?.description ?? null,
    amount: payload.transaction_amount,
    currency_id: 'ARS',
    status: 'approved',
    status_detail: 'accredited',
    payment_method_id: payload.payment_method_id,
    installments: payload.installments,
    payer_email: payload.payer_email,
    created_at: now,
  };
  nextPaymentId += 1;
  mockPayments.push(payment);
  return payment;
}

export async function mockGetPayment(paymentId) {
  const payment = mockPayments.find((p) => String(p.id) === String(paymentId) || p.payment_id === String(paymentId));
  if (!payment) {
    const error = new Error('Pago no encontrado.');
    error.status = 404;
    throw error;
  }
  return payment;
}

export async function mockCreateTestCardToken(payload = {}) {
  const required = ['card_number', 'cardholder_name', 'expiration_month', 'expiration_year', 'identification_number', 'identification_type', 'security_code'];
  if (required.some((key) => !payload[key])) {
    const error = new Error(`Faltan campos requeridos: ${required.join(', ')}.`);
    error.status = 400;
    throw error;
  }
  return { token: `mock-card-token-${Date.now()}` };
}

export function __resetMockPayments() {
  mockPreferences = {};
  mockPayments = [];
  nextPreferenceId = 1;
  nextPaymentId = 1;
}
