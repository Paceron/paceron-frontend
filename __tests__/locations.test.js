import { resolveCountryCode, resolveProvinceCode } from '../data/locations.js';

describe('resolveCountryCode', () => {
  it('resolves an exact name match to its code', () => {
    expect(resolveCountryCode('Argentina')).toBe('ARG');
  });

  it('is case and accent insensitive', () => {
    expect(resolveCountryCode('méxico')).toBe('MEX');
    expect(resolveCountryCode('MEXICO')).toBe('MEX');
  });

  it('falls back to the raw name when there is no match', () => {
    expect(resolveCountryCode('Narnia')).toBe('Narnia');
  });

  it('returns an empty string for a falsy name', () => {
    expect(resolveCountryCode(null)).toBe('');
    expect(resolveCountryCode('')).toBe('');
  });
});

describe('resolveProvinceCode', () => {
  it('resolves an exact name match within the given country', () => {
    expect(resolveProvinceCode('ARG', 'Córdoba')).toBe('CD');
  });

  it('is case and accent insensitive', () => {
    expect(resolveProvinceCode('ARG', 'cordoba')).toBe('CD');
  });

  it('falls back to the raw name when there is no match (ex: Nominatim variant)', () => {
    expect(resolveProvinceCode('ARG', 'Ciudad Autónoma de Buenos Aires')).toBe('Ciudad Autónoma de Buenos Aires');
  });

  it('falls back to the raw name for an unknown country code', () => {
    expect(resolveProvinceCode('ZZZ', 'Córdoba')).toBe('Córdoba');
  });

  it('returns an empty string for a falsy name', () => {
    expect(resolveProvinceCode('ARG', null)).toBe('');
  });
});
