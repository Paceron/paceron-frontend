import {
  toLocationPickerValue, hasLegacyAddressWithoutCoordinates, formatLegacyAddressLabel,
} from '../utils/address-fields-to-location.js';

describe('toLocationPickerValue', () => {
  it('returns null when there are no coordinates (legacy row)', () => {
    expect(toLocationPickerValue({ country: 'ARG', province: 'CD', city: 'Córdoba' })).toBeNull();
  });

  it('builds a LocationPicker value with codes resolved back to names', () => {
    expect(toLocationPickerValue({
      lat: -31.42, lng: -64.18, country: 'ARG', province: 'CD', city: 'Córdoba', street: 'Av. Pueyrredón', number: '177',
    })).toEqual({
      lat: -31.42, lng: -64.18, label: null,
      street: 'Av. Pueyrredón', number: '177', city: 'Córdoba',
      province: 'Córdoba', country: 'Argentina',
    });
  });
});

describe('hasLegacyAddressWithoutCoordinates', () => {
  it('is true for an address saved before lat/lng existed', () => {
    expect(hasLegacyAddressWithoutCoordinates({ country: 'ARG', province: 'CD', city: 'Córdoba' })).toBe(true);
  });

  it('is false once lat/lng are present', () => {
    expect(hasLegacyAddressWithoutCoordinates({ lat: 1, lng: 2, country: 'ARG' })).toBe(false);
  });

  it('is false for a brand new record with no address at all', () => {
    expect(hasLegacyAddressWithoutCoordinates({})).toBe(false);
  });
});

describe('formatLegacyAddressLabel', () => {
  it('joins city/province/country, resolving codes to names', () => {
    expect(formatLegacyAddressLabel({ country: 'ARG', province: 'CD', city: 'Córdoba' })).toBe('Córdoba, Córdoba, Argentina');
  });

  it('omits missing pieces without stray separators', () => {
    expect(formatLegacyAddressLabel({ country: 'ARG', city: 'Córdoba' })).toBe('Córdoba, Argentina');
  });
});
