// Simula el ciclo de suscripción de Fase 1 para EXPO_PUBLIC_USE_MOCKS=true.
// A diferencia del backend real, NO activa la suscripción sola tras un
// pago aprobado (no hay webhook que simular acá) — queda en
// first_payment_pending hasta que algo llame
// __mockActivateSubscription explícitamente. Esto es deliberado: deja
// que la UI de "puede tardar en reflejarse" (ver
// tier-upgrade-screen.jsx) se ejerza en modo mock sin depender de
// infraestructura de webhook, igual que en local contra el backend
// real sin túnel.
let mockSubscriptions = {};
let nextSubscriptionId = 1;
let nextInstallmentId = 1;

function key(userId, roleId) {
  return `${userId}:${roleId}`;
}

// Catálogo mínimo de tiers pagos — coincide con los ids/montos de
// services/__mocks__/tiers-mock.js (id 2 = premium corredor, id 4 =
// premium entrenador).
const MOCK_PAID_TIERS_BY_ID = {
  2: { id: 2, name: 'premium', hierarchy: 2, paymentRequired: true, amount: 4999, roleId: 1, roleName: 'corredor' },
  4: { id: 4, name: 'premium', hierarchy: 2, paymentRequired: true, amount: 9999, roleId: 2, roleName: 'entrenador' },
};

export async function mockChangeTier(userId, roleId, tierId) {
  const tier = MOCK_PAID_TIERS_BY_ID[tierId];
  if (!tier) {
    const error = new Error('Tier no encontrado.');
    error.status = 404;
    throw error;
  }
  const k = key(userId, roleId);
  const existing = mockSubscriptions[k];
  if (existing?.subscription_status === 'first_payment_pending') {
    const error = new Error('Ya hay una cuota #1 sin pagar.');
    error.status = 409;
    error.code = 'SUBSCRIPTION_PENDING_FIRST_PAYMENT';
    throw error;
  }
  const subscription = {
    subscription_id: nextSubscriptionId++,
    subscription_status: 'first_payment_pending',
    installment_id: nextInstallmentId++,
    installment_number: 1,
    installment_amount: tier.amount,
    next_due_date: null,
    blocked_date: null,
    paid_installments: 0,
    tier: { id: tier.id, name: tier.name, hierarchy: tier.hierarchy, payment_required: tier.paymentRequired },
    role: { id: roleId, name: tier.roleName },
    mercadopago: { public_key: 'TEST-mock-public-key' },
  };
  mockSubscriptions[k] = subscription;
  return subscription;
}

export async function mockGetCurrentSubscription(userId, roleId) {
  const k = key(userId, roleId);
  if (mockSubscriptions[k]) return mockSubscriptions[k];
  return { tier: { id: null, name: 'base', hierarchy: 1, payment_required: false }, role: { id: roleId, name: null } };
}

// Helper de testing manual (no lo llama la UI) — simula la activación
// que en el backend real dispara el webhook de Mercado Pago.
export function __mockActivateSubscription(userId, roleId) {
  const k = key(userId, roleId);
  const sub = mockSubscriptions[k];
  if (!sub) return;
  sub.subscription_status = 'active';
  sub.paid_installments = 1;
  sub.installment_id = nextInstallmentId++;
  sub.installment_number = 2;
  sub.next_due_date = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
  sub.blocked_date = new Date(Date.now() + 37 * 24 * 60 * 60 * 1000).toISOString();
}

export function __resetMockSubscriptions() {
  mockSubscriptions = {};
  nextSubscriptionId = 1;
  nextInstallmentId = 1;
}
