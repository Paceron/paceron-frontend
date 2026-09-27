import { __getMockTeamName, __getMockTeamMembershipFee } from './teams-mock.js';

// Simula GET /users/{id}/teams/{team_id}/subscription para
// EXPO_PUBLIC_USE_MOCKS=true.
//
// Igual que tier-subscriptions-mock.js, NO activa la membresía sola tras un
// pago aprobado — no hay webhook de Mercado Pago que simular acá, así que queda
// en first_payment_pending hasta que algo llame
// __mockActivateTeamSubscription explícitamente. Es deliberado: deja ejercer la
// UI de "tu pago puede tardar unos minutos en reflejarse" en modo mock, igual
// que pasa en local contra el backend real sin túnel para el webhook.
//
// La cuota sale de teams-mock.js (no se duplica el seed): equipo con
// membership_fee 0 → membresía `active` sin cuotas, como el
// ApplyTeamMembershipGate del backend.
let mockTeamSubscriptions = {};
let nextInstallmentId = 1;

function key(userId, teamId) {
  return `${userId}:${teamId}`;
}

function buildTeamInfo(teamId) {
  return {
    id: Number(teamId),
    name: __getMockTeamName(teamId),
    membership_fee: __getMockTeamMembershipFee(teamId),
  };
}

export async function mockGetTeamSubscription(userId, teamId) {
  const fee = __getMockTeamMembershipFee(teamId);

  // Equipo gratis: espeja el early return del backend — `active`, sin cuota y
  // sin bloque de mercadopago.
  if (!fee) {
    return {
      team: buildTeamInfo(teamId),
      membership: {
        subscription_status: 'active',
        init_amount: 0,
        paid_installments: 0,
        start_date: new Date().toISOString(),
      },
      has_debt: false,
    };
  }

  const k = key(userId, teamId);
  if (!mockTeamSubscriptions[k]) {
    mockTeamSubscriptions[k] = {
      subscription_status: 'first_payment_pending',
      init_amount: fee,
      paid_installments: 0,
      start_date: new Date().toISOString(),
      installment_id: nextInstallmentId++,
      installment_number: 1,
      // Cuota #1 sin due_date/blocked_date: nunca cuenta como deuda.
      next_due_date: null,
      blocked_date: null,
    };
  }

  const sub = mockTeamSubscriptions[k];
  return {
    team: buildTeamInfo(teamId),
    membership: {
      subscription_status: sub.subscription_status,
      init_amount: sub.init_amount,
      paid_installments: sub.paid_installments,
      start_date: sub.start_date,
    },
    next_installment: {
      installment_id: sub.installment_id,
      installment_number: sub.installment_number,
      installment_amount: sub.init_amount,
      next_due_date: sub.next_due_date,
      blocked_date: sub.blocked_date,
    },
    has_debt: Boolean(sub.blocked_date) && new Date(sub.blocked_date) < new Date(),
    // public_key es la de integrador (igual que el backend real acá) — el brick
    // NO la usa, saca la suya de POST /payments/preference.
    mercadopago: { public_key: 'TEST-mock-public-key', concept: 'team_subscription', marketplace: true },
  };
}

// Helper de testing manual (no lo llama la UI) — simula lo que en el backend
// real dispara el webhook de Mercado Pago al aprobarse la cuota: marca paga,
// activa la membresía si era la #1 y genera la siguiente (mensual, +7 días de
// gracia).
export function __mockActivateTeamSubscription(userId, teamId) {
  const sub = mockTeamSubscriptions[key(userId, teamId)];
  if (!sub) return;
  sub.subscription_status = 'active';
  sub.paid_installments += 1;
  sub.installment_id = nextInstallmentId++;
  sub.installment_number += 1;
  sub.next_due_date = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
  sub.blocked_date = new Date(Date.now() + 37 * 24 * 60 * 60 * 1000).toISOString();
}

export function __resetMockTeamSubscriptions() {
  mockTeamSubscriptions = {};
  nextInstallmentId = 1;
}
