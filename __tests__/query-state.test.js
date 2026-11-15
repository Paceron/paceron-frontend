import { visibleQueryError } from '../utils/query-state.js';

describe('visibleQueryError', () => {
  test('oculta el error de un refetch fallido cuando hay datos cacheados', () => {
    expect(visibleQueryError({ current: 3 }, new Error('network'))).toBeNull();
  });

  test('considera datos cacheados aunque sean un array vacío', () => {
    expect(visibleQueryError([], new Error('network'))).toBeNull();
  });

  test('devuelve el error cuando no hay datos', () => {
    const error = new Error('offline');
    expect(visibleQueryError(undefined, error)).toBe(error);
  });

  test('devuelve null cuando no hay datos ni error', () => {
    expect(visibleQueryError(undefined, null)).toBeNull();
  });
});
