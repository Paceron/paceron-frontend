import api from './api.js';
import { USE_MOCKS } from '../config/env.js';
import {
  mockInviteToTeam,
  mockListTeamInvitations,
  mockAcceptInvitation,
  mockRejectInvitation,
} from './__mocks__/invitations-mock.js';

// POST /api/v1/teams/{id}/invite — invitation.InviteRunnerRequest, solo
// acepta email (ver docs/BACKEND_API_GAPS.md gap 9 — no acepta grupo).
export async function inviteToTeam(teamId, email) {
  if (USE_MOCKS) return await mockInviteToTeam(teamId, email);
  return await api.post(`/teams/${teamId}/invite`, { email });
}

// GET /api/v1/teams/{id}/invitations — invitaciones pendientes del equipo.
export async function listTeamInvitations(teamId) {
  if (USE_MOCKS) return await mockListTeamInvitations(teamId);
  return await api.get(`/teams/${teamId}/invitations`);
}

// POST /api/v1/invitations/{id}/accept — invitation.RespondInvitationRequest.
// Sin consumidor en la UI de esta etapa (ver docs/BACKEND_API_GAPS.md gap 8
// — sin forma de listar las invitaciones de un invitado) — se agrega igual
// como espejo 1:1 barato del contrato ya documentado.
export async function acceptInvitation(invitationId, userId) {
  if (USE_MOCKS) return await mockAcceptInvitation(invitationId, userId);
  return await api.post(`/invitations/${invitationId}/accept`, { user_id: userId });
}

// POST /api/v1/invitations/{id}/reject.
export async function rejectInvitation(invitationId, userId) {
  if (USE_MOCKS) return await mockRejectInvitation(invitationId, userId);
  return await api.post(`/invitations/${invitationId}/reject`, { user_id: userId });
}
