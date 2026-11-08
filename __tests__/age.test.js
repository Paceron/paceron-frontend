import { calculateAge } from '../utils/age.js';

const NOW = new Date(2026, 10, 7); // 2026-11-07

describe('calculateAge', () => {
  it('returns null for empty/missing input', () => {
    expect(calculateAge('', NOW)).toBeNull();
    expect(calculateAge(null, NOW)).toBeNull();
    expect(calculateAge(undefined, NOW)).toBeNull();
  });

  it('returns null for an unparseable value', () => {
    expect(calculateAge('not a date', NOW)).toBeNull();
  });

  it('computes age from a DD/MM/YYYY birth date, birthday already passed this year', () => {
    expect(calculateAge('15/03/2000', NOW)).toBe(26);
  });

  it('computes age from a YYYY-MM-DD birth date, same value', () => {
    expect(calculateAge('2000-03-15', NOW)).toBe(26);
  });

  it('has not had the birthday yet this year -- one year less', () => {
    expect(calculateAge('20/12/2000', NOW)).toBe(25);
  });

  it('birthday is exactly today -- counts the year that just turned', () => {
    expect(calculateAge('07/11/2000', NOW)).toBe(26);
  });

  it('birthday is tomorrow -- does not count it yet', () => {
    expect(calculateAge('08/11/2000', NOW)).toBe(25);
  });
});
