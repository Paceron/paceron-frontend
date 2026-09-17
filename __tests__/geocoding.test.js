import { reverseGeocode, searchAddress } from '../services/geocoding.js';

jest.mock('../utils/platform.js', () => ({ isWeb: false }));

describe('geocoding service', () => {
  afterEach(() => { global.fetch = undefined; jest.clearAllMocks(); });

  test('reverseGeocode returns display_name on success', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ display_name: 'Av. Corrientes 1234, CABA' }),
    });

    await expect(reverseGeocode(-34.6037, -58.3816)).resolves.toBe('Av. Corrientes 1234, CABA');
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/reverse?format=jsonv2&lat=-34.6037&lon=-58.3816'),
      expect.objectContaining({ headers: { 'User-Agent': expect.stringContaining('Paceron') } }),
    );
  });

  test('reverseGeocode returns null when response has no display_name', async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({}) });
    await expect(reverseGeocode(0, 0)).resolves.toBeNull();
  });

  test('reverseGeocode throws when Nominatim responds with an error status', async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: false, status: 503 });
    await expect(reverseGeocode(0, 0)).rejects.toThrow('Nominatim respondió 503');
  });

  test('searchAddress returns first result normalized to lat/lng/label', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ([{ lat: '-34.6037', lon: '-58.3816', display_name: 'Buenos Aires, Argentina' }]),
    });

    await expect(searchAddress('Buenos Aires')).resolves.toEqual({
      lat: -34.6037,
      lng: -58.3816,
      label: 'Buenos Aires, Argentina',
    });
  });

  test('searchAddress returns null when there are no results', async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ([]) });
    await expect(searchAddress('lugar inexistente')).resolves.toBeNull();
  });
});
