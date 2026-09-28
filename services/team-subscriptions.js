import api from './api.js';
import { USE_MOCKS } from '../config/env.js';
import { mockGetTeamSubscription } from './__mocks__/team-subscriptions-mock.js';

// Suscripción del corredor a un EQUIPO — le paga la mensualidad al
// entrenador (split de Mercado Pago), distinto de services/tier-subscriptions.js
// (el tier de Paceron, que se le paga a Paceron). Ver
// docs/superpowers/specs/2026-09-26-team-subscription-join-payment-design.md.

// GET /api/v1/users/{id}/teams/{team_id}/subscription — membresía + cuota a
// pagar + deuda + datos de checkout (TeamSubscriptionResponse). El backend
// IGNORA el `:id` del path y usa el del JWT, así que es self-only por
// construcción; se manda igual para que la URL sea legible en los logs.
// 404 si el usuario no es miembro de ese equipo.
export async function getTeamSubscription(userId, teamId) {
  if (USE_MOCKS) return await mockGetTeamSubscription(userId, teamId);
  return await api.get(`/users/${userId}/teams/${teamId}/subscription`);
}
