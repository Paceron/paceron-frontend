import api from './api.js';
import { USE_MOCKS } from '../config/env.js';
import {
  mockInviteToTeam,
  mockListTeamInvitations,
  mockListMyInvitations,
  mockGetInvitation,
  mockAcceptInvitation,
  mockRejectInvitation,
} from './__mocks__/invitations-mock.js';

// POST /api/v1/teams/{id}/invite — invitation.InviteRunnerRequest (email +
// group_id opcional, ver services/normalizers.js#toInvitePayload — quien
// llama a esta función ya arma el payload con esa función).
export async function inviteToTeam(teamId, payload) {
  if (USE_MOCKS) return await mockInviteToTeam(teamId, payload);
  return await api.post(`/teams/${teamId}/invite`, payload);
}

// GET /api/v1/teams/{id}/invitations — invitaciones pendientes del equipo (lado dueño).
export async function listTeamInvitations(teamId) {
  if (USE_MOCKS) return await mockListTeamInvitations(teamId);
  return await api.get(`/teams/${teamId}/invitations`);
}

// GET /api/v1/invitations?user_id= — invitaciones pendientes del usuario
// actual (lado invitado). `email` es solo para el mock (ver
// services/__mocks__/invitations-mock.js) — el backend real solo usa `user_id`.
export async function listMyInvitations(userId, email) {
  if (USE_MOCKS) return await mockListMyInvitations(userId, email);
  return await api.get(`/invitations?user_id=${encodeURIComponent(userId)}`);
}

// GET /api/v1/invitations/{id}?user_id=. Sin consumidor en la UI todavía
// (el listado ya trae el detalle completo por item) — se agrega igual
// como espejo 1:1 barato del contrato ya documentado.
export async function getInvitation(invitationId, userId) {
  if (USE_MOCKS) return await mockGetInvitation(invitationId, userId);
  return await api.get(`/invitations/${invitationId}?user_id=${encodeURIComponent(userId)}`);
}

// POST /api/v1/invitations/{id}/accept — invitation.RespondInvitationRequest.
export async function acceptInvitation(invitationId, userId) {
  if (USE_MOCKS) return await mockAcceptInvitation(invitationId, userId);
  return await api.post(`/invitations/${invitationId}/accept`, { user_id: userId });
}

// POST /api/v1/invitations/{id}/reject.
export async function rejectInvitation(invitationId, userId) {
  if (USE_MOCKS) return await mockRejectInvitation(invitationId, userId);
  return await api.post(`/invitations/${invitationId}/reject`, { user_id: userId });
}
