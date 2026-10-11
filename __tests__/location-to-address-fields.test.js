import { toAddressFormFields } from '../utils/location-to-address-fields.js';

describe('toAddressFormFields', () => {
  it('returns all-empty fields for no value', () => {
    expect(toAddressFormFields(null)).toEqual({
      country: '', province: '', city: '', street: '', number: '', lat: null, lng: null,
    });
  });

  it('resolves country/province names to internal codes, keeps the rest as-is', () => {
    const value = {
      lat: -31.42, lng: -64.18, label: 'full label',
      street: 'Avenida Pueyrredón', number: '177', city: 'Córdoba', province: 'Córdoba', country: 'Argentina',
    };
    expect(toAddressFormFields(value)).toEqual({
      country: 'ARG', province: 'CD', city: 'Córdoba', street: 'Avenida Pueyrredón', number: '177', lat: -31.42, lng: -64.18,
    });
  });

  it('falls back to the raw name for country/province when unresolvable', () => {
    const value = { lat: 1, lng: 2, country: 'Narnia', province: 'Cair Paravel', city: 'Somewhere' };
    expect(toAddressFormFields(value)).toMatchObject({ country: 'Narnia', province: 'Cair Paravel' });
  });

  it('defaults missing street/number/city to empty strings, not undefined', () => {
    const value = { lat: 1, lng: 2, country: 'Argentina', province: 'Córdoba' };
    expect(toAddressFormFields(value)).toMatchObject({ city: '', street: '', number: '' });
  });
});
