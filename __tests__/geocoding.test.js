import { reverseGeocode, searchAddress } from '../services/geocoding.js';

jest.mock('../utils/platform.js', () => ({ isWeb: false }));

describe('geocoding service', () => {
  afterEach(() => { global.fetch = undefined; jest.clearAllMocks(); });

  test('reverseGeocode returns the structured address breakdown on success', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        display_name: 'Av. Corrientes 1234, CABA, Argentina',
        address: { road: 'Av. Corrientes', house_number: '1234', city: 'CABA', state: 'Buenos Aires', country: 'Argentina', postcode: '1043' },
      }),
    });

    await expect(reverseGeocode(-34.6037, -58.3816)).resolves.toEqual({
      label: 'Av. Corrientes 1234, CABA, Argentina',
      street: 'Av. Corrientes',
      number: '1234',
      city: 'CABA',
      province: 'Buenos Aires',
      country: 'Argentina',
      extra: { road: 'Av. Corrientes', house_number: '1234', city: 'CABA', state: 'Buenos Aires', country: 'Argentina', postcode: '1043' },
    });
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/reverse?format=jsonv2&addressdetails=1&lat=-34.6037&lon=-58.3816'),
      expect.objectContaining({ headers: { 'User-Agent': expect.stringContaining('Paceron') } }),
    );
  });

  test('reverseGeocode returns just a null label when response has no address breakdown', async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({}) });
    await expect(reverseGeocode(0, 0)).resolves.toEqual({ label: null });
  });

  test('reverseGeocode throws when Nominatim responds with an error status', async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: false, status: 503 });
    await expect(reverseGeocode(0, 0)).rejects.toThrow('Nominatim respondió 503');
  });

  test('searchAddress returns first result normalized to lat/lng + structured address', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ([{
        lat: '-34.6037', lon: '-58.3816', display_name: 'Buenos Aires, Argentina',
        address: { city: 'Buenos Aires', country: 'Argentina' },
      }]),
    });

    await expect(searchAddress('Buenos Aires')).resolves.toEqual({
      lat: -34.6037,
      lng: -58.3816,
      label: 'Buenos Aires, Argentina',
      street: null,
      number: null,
      city: 'Buenos Aires',
      province: null,
      country: 'Argentina',
      extra: { city: 'Buenos Aires', country: 'Argentina' },
    });
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/search?format=jsonv2&addressdetails=1&limit=1&q=Buenos%20Aires'),
      expect.anything(),
    );
  });

  test('searchAddress returns null when there are no results', async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ([]) });
    await expect(searchAddress('lugar inexistente')).resolves.toBeNull();
  });
});
