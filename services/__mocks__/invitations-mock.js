// Estado in-memory con la MISMA shape snake_case que el backend real (para
// que toInvitationModel() funcione igual en ambas ramas) — mismo patrón
// stateful que groups-mock.js. expires_at se calcula a 7 días desde el
// envío (el backend no documenta el plazo exacto en el swagger, 7 días es
// un valor razonable solo para que el mock tenga algo consistente).
//
// mockListMyInvitations matchea por email en vez de invitee_id porque este
// mock no tiene un directorio real de usuarios que resuelva user_id→email
// al momento de invitar (a diferencia del backend real) — el caller (ver
// store/team-store.js#fetchMyInvitations) le pasa el email del usuario
// actual, que el backend real ignora (solo usa user_id como query param).
import { __getMockTeamName } from './teams-mock.js';

let mockInvitations = [];
let nextInvitationId = 1;

function findInvitationOrThrow(invitationId) {
  const invitation = mockInvitations.find((i) => String(i.id) === String(invitationId));
  if (!invitation) {
    const error = new Error('Invitación no encontrada.');
    error.status = 404;
    throw error;
  }
  return invitation;
}

export async function mockInviteToTeam(teamId, payload) {
  const now = new Date().toISOString();
  const expires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
  const invitation = {
    id: nextInvitationId++, team_id: Number(teamId), invitee_email: payload.email, invitee_id: null,
    invitee_name: null, group_id: payload.group_id ?? null, team_name: __getMockTeamName(teamId),
    status: 'pending', expires_at: expires, created_at: now,
  };
  mockInvitations.push(invitation);
  return { message: 'Invitación enviada.' };
}

export async function mockListTeamInvitations(teamId) {
  return mockInvitations.filter((i) => String(i.team_id) === String(teamId) && i.status === 'pending');
}

export async function mockListMyInvitations(_userId, email) {
  return mockInvitations.filter((i) => i.status === 'pending' && i.invitee_email?.toLowerCase() === (email ?? '').toLowerCase());
}

export async function mockGetInvitation(invitationId, _userId) {
  return findInvitationOrThrow(invitationId);
}

export async function mockAcceptInvitation(invitationId, userId) {
  const invitation = findInvitationOrThrow(invitationId);
  invitation.status = 'accepted';
  invitation.invitee_id = userId;
  return { message: 'Invitación aceptada.' };
}

export async function mockRejectInvitation(invitationId, userId) {
  const invitation = findInvitationOrThrow(invitationId);
  invitation.status = 'rejected';
  invitation.invitee_id = userId;
  return { message: 'Invitación rechazada.' };
}

export function __resetMockInvitations() {
  mockInvitations = [];
  nextInvitationId = 1;
}
