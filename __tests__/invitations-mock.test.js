import {
  mockInviteToTeam, mockListTeamInvitations, mockAcceptInvitation, mockRejectInvitation, __resetMockInvitations,
} from '../services/__mocks__/invitations-mock.js';

beforeEach(() => {
  __resetMockInvitations();
});

describe('invitations-mock', () => {
  test('mockInviteToTeam creates a pending invitation scoped to the team', async () => {
    const result = await mockInviteToTeam('7', 'a@b.com');
    expect(result).toEqual({ message: 'Invitación enviada.' });
    const invitations = await mockListTeamInvitations('7');
    expect(invitations).toHaveLength(1);
    expect(invitations[0]).toMatchObject({ team_id: 7, invitee_email: 'a@b.com', status: 'pending' });
  });

  test('mockListTeamInvitations only returns pending invitations for the requested team', async () => {
    await mockInviteToTeam('7', 'a@b.com');
    await mockInviteToTeam('8', 'b@b.com');
    const invitations = await mockListTeamInvitations('7');
    expect(invitations).toHaveLength(1);
    expect(invitations[0].team_id).toBe(7);
  });

  test('mockAcceptInvitation marks the invitation accepted, removing it from the pending list', async () => {
    await mockInviteToTeam('7', 'a@b.com');
    const [invitation] = await mockListTeamInvitations('7');
    const result = await mockAcceptInvitation(invitation.id, 42);
    expect(result).toEqual({ message: 'Invitación aceptada.' });
    expect(await mockListTeamInvitations('7')).toEqual([]);
  });

  test('mockRejectInvitation marks the invitation rejected, removing it from the pending list', async () => {
    await mockInviteToTeam('7', 'a@b.com');
    const [invitation] = await mockListTeamInvitations('7');
    const result = await mockRejectInvitation(invitation.id, 42);
    expect(result).toEqual({ message: 'Invitación rechazada.' });
    expect(await mockListTeamInvitations('7')).toEqual([]);
  });

  test('mockAcceptInvitation throws for an unknown id', async () => {
    await expect(mockAcceptInvitation(999999, 1)).rejects.toThrow();
  });
});
