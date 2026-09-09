import { getTeamMemberLimit, TEAM_MEMBER_LIMITS, selectAdministeredTeams } from '../store/team-store.js';

describe('getTeamMemberLimit', () => {
  test('resolves the limit for each known tier', () => {
    expect(getTeamMemberLimit('base')).toBe(TEAM_MEMBER_LIMITS.base);
    expect(getTeamMemberLimit('pro')).toBe(TEAM_MEMBER_LIMITS.pro);
    expect(getTeamMemberLimit('premium')).toBe(TEAM_MEMBER_LIMITS.premium);
  });

  test('falls back to base for an unknown or missing tier', () => {
    expect(getTeamMemberLimit('unknown')).toBe(TEAM_MEMBER_LIMITS.base);
    expect(getTeamMemberLimit(undefined)).toBe(TEAM_MEMBER_LIMITS.base);
  });
});

describe('selectAdministeredTeams', () => {
  test('filters teams by ownerId and returns an empty array without a userId', () => {
    const teams = [{ id: '1', ownerId: 7 }, { id: '2', ownerId: 9 }];
    expect(selectAdministeredTeams(teams, 7)).toEqual([{ id: '1', ownerId: 7 }]);
    expect(selectAdministeredTeams(teams, null)).toEqual([]);
  });
});
