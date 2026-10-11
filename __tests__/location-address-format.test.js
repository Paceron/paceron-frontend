import { formatAddressLines, getAddressDetailRows } from '../utils/location-address-format.js';

describe('formatAddressLines', () => {
  it('returns empty strings for no value', () => {
    expect(formatAddressLines(null)).toEqual({ primary: '', secondary: '' });
  });

  it('builds street+number as primary, city/province/country as secondary', () => {
    const value = { street: 'Av. Rivadavia', number: '1234', city: 'CABA', province: 'Buenos Aires', country: 'Argentina' };
    expect(formatAddressLines(value)).toEqual({
      primary: 'Av. Rivadavia 1234',
      secondary: 'CABA, Buenos Aires, Argentina',
    });
  });

  it('falls back to region line as primary when there is no street', () => {
    const value = { city: 'CABA', province: 'Buenos Aires', country: 'Argentina' };
    expect(formatAddressLines(value)).toEqual({
      primary: 'CABA, Buenos Aires, Argentina',
      secondary: '',
    });
  });

  it('falls back to the raw label when nothing structured is present', () => {
    const value = { label: 'Algún lugar sin desglose' };
    expect(formatAddressLines(value)).toEqual({ primary: 'Algún lugar sin desglose', secondary: '' });
  });

  it('falls back to coordinates when there is no label either', () => {
    const value = { lat: -34.6037, lng: -58.3816 };
    expect(formatAddressLines(value)).toEqual({ primary: '-34.60370, -58.38160', secondary: '' });
  });

  it('omits missing pieces from each line without stray separators', () => {
    const value = { street: 'Av. Rivadavia', city: 'CABA', country: 'Argentina' };
    expect(formatAddressLines(value)).toEqual({
      primary: 'Av. Rivadavia',
      secondary: 'CABA, Argentina',
    });
  });
});

describe('getAddressDetailRows', () => {
  it('returns an empty list without an extra object', () => {
    expect(getAddressDetailRows({})).toEqual([]);
    expect(getAddressDetailRows(null)).toEqual([]);
  });

  it('only includes known situational fields that are present', () => {
    const value = { extra: { municipality: 'La Matanza', postcode: '1754', country_code: 'ar', road: 'ignored' } };
    expect(getAddressDetailRows(value)).toEqual([
      { label: 'Municipio', value: 'La Matanza' },
      { label: 'Código postal', value: '1754' },
    ]);
  });
});
