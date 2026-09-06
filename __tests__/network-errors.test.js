import { mapNetworkError, mapHttpErrorMessage } from '../utils/network-errors.js';

describe('mapNetworkError', () => {
  test('maps an AbortError to a timeout message', () => {
    const abortError = new Error('The operation was aborted');
    abortError.name = 'AbortError';

    const result = mapNetworkError(abortError);

    expect(result).toBeInstanceOf(Error);
    expect(result.message).toBe('La conexión tardó demasiado. Probá de nuevo.');
  });

  test('maps any other fetch failure to a connectivity message', () => {
    const networkError = new TypeError('Failed to fetch');

    const result = mapNetworkError(networkError);

    expect(result.message).toBe('No pudimos conectarnos. Revisá tu conexión a internet.');
  });
});

describe('mapHttpErrorMessage', () => {
  test('returns the backend message unchanged when present, regardless of status', () => {
    expect(mapHttpErrorMessage(404, 'Ya existe un usuario con ese email.')).toBe('Ya existe un usuario con ese email.');
    expect(mapHttpErrorMessage(500, 'Mantenimiento programado.')).toBe('Mantenimiento programado.');
  });

  test('returns a friendly server message for 5xx with no backend message', () => {
    expect(mapHttpErrorMessage(500, undefined)).toBe('Hubo un problema en el servidor. Probá de nuevo en unos minutos.');
    expect(mapHttpErrorMessage(503, undefined)).toBe('Hubo un problema en el servidor. Probá de nuevo en unos minutos.');
  });

  test('returns the generic status fallback for non-5xx with no backend message', () => {
    expect(mapHttpErrorMessage(404, undefined)).toBe('Request failed with status 404');
    expect(mapHttpErrorMessage(400, undefined)).toBe('Request failed with status 400');
  });
});
