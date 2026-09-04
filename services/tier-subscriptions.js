import api from './api.js';
import { USE_MOCKS } from '../config/env.js';
import { mockChangeTier, mockGetCurrentSubscription } from './__mocks__/tier-subscriptions-mock.js';

// PUT /api/v1/users/{id}/roles/{role_id}/tier — cambia de tier; si el
// tier target es pago, el backend cierra la suscripción vigente y crea
// una nueva en first_payment_pending con su cuota #1. Ver
// docs/superpowers/specs/2026-09-03-payments-fase1-tier-upgrade-design.md.
export async function changeTier(userId, roleId, tierId) {
  if (USE_MOCKS) return await mockChangeTier(userId, roleId, tierId);
  return await api.put(`/users/${userId}/roles/${roleId}/tier`, { tier_id: tierId });
}

// GET /api/v1/users/{id}/subscriptions/current?role_id= — cuota a
// pagar (si hay) + public_key para el Bricks. Tiers gratis devuelven
// solo tier/role, sin cuota (ver toSubscriptionModel).
export async function getCurrentSubscription(userId, roleId) {
  if (USE_MOCKS) return await mockGetCurrentSubscription(userId, roleId);
  return await api.get(`/users/${userId}/subscriptions/current?role_id=${encodeURIComponent(roleId)}`);
}
