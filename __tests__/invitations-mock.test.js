import {
  mockInviteToTeam, mockListTeamInvitations, mockListMyInvitations, mockGetInvitation,
  mockAcceptInvitation, mockRejectInvitation, __resetMockInvitations,
} from '../services/__mocks__/invitations-mock.js';
import { __resetMockTeams } from '../services/__mocks__/teams-mock.js';

beforeEach(() => {
  __resetMockInvitations();
  __resetMockTeams();
});

describe('invitations-mock', () => {
  test('mockInviteToTeam creates a pending invitation scoped to the team, with team_name resolved', async () => {
    const result = await mockInviteToTeam('1', { email: 'a@b.com' });
    expect(result).toEqual({ message: 'Invitación enviada.' });
    const invitations = await mockListTeamInvitations('1');
    expect(invitations).toHaveLength(1);
    expect(invitations[0]).toMatchObject({ team_id: 1, invitee_email: 'a@b.com', status: 'pending', group_id: null, team_name: 'Corredores del Sur' });
  });

  test('mockInviteToTeam stores group_id when provided', async () => {
    await mockInviteToTeam('1', { email: 'a@b.com', group_id: 3 });
    const [invitation] = await mockListTeamInvitations('1');
    expect(invitation.group_id).toBe(3);
  });

  test('mockListTeamInvitations only returns pending invitations for the requested team', async () => {
    await mockInviteToTeam('1', { email: 'a@b.com' });
    await mockInviteToTeam('2', { email: 'b@b.com' });
    const invitations = await mockListTeamInvitations('1');
    expect(invitations).toHaveLength(1);
    expect(invitations[0].team_id).toBe(1);
  });

  test('mockListMyInvitations matches by invitee email, only pending', async () => {
    await mockInviteToTeam('1', { email: 'demo@paceron.com' });
    await mockInviteToTeam('2', { email: 'otro@b.com' });
    const mine = await mockListMyInvitations(1, 'demo@paceron.com');
    expect(mine).toHaveLength(1);
    expect(mine[0].invitee_email).toBe('demo@paceron.com');
  });

  test('mockGetInvitation returns the invitation by id, throws for an unknown id', async () => {
    await mockInviteToTeam('1', { email: 'a@b.com' });
    const [invitation] = await mockListTeamInvitations('1');
    expect(await mockGetInvitation(invitation.id, 1)).toEqual(invitation);
    await expect(mockGetInvitation(999999, 1)).rejects.toThrow();
  });

  test('mockAcceptInvitation marks the invitation accepted, removing it from the pending list', async () => {
    await mockInviteToTeam('1', { email: 'a@b.com' });
    const [invitation] = await mockListTeamInvitations('1');
    const result = await mockAcceptInvitation(invitation.id, 42);
    expect(result).toEqual({ message: 'Invitación aceptada.' });
    expect(await mockListTeamInvitations('1')).toEqual([]);
  });

  test('mockRejectInvitation marks the invitation rejected, removing it from the pending list', async () => {
    await mockInviteToTeam('1', { email: 'a@b.com' });
    const [invitation] = await mockListTeamInvitations('1');
    const result = await mockRejectInvitation(invitation.id, 42);
    expect(result).toEqual({ message: 'Invitación rechazada.' });
    expect(await mockListTeamInvitations('1')).toEqual([]);
  });

  test('mockAcceptInvitation throws for an unknown id', async () => {
    await expect(mockAcceptInvitation(999999, 1)).rejects.toThrow();
  });
});
