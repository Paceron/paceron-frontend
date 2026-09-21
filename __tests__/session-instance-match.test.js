import { findMatchingCatalogSession } from '../utils/session-instance-match.js';

describe('findMatchingCatalogSession', () => {
  const sessions = [
    { id: '1', name: 'Fondo suave' },
    { id: '2', name: 'Series de velocidad' },
  ];

  test('devuelve la sesión del catálogo cuyo nombre coincide', () => {
    const match = findMatchingCatalogSession({ id: '99', name: 'Series de velocidad' }, sessions);
    expect(match).toEqual({ id: '2', name: 'Series de velocidad' });
  });

  test('devuelve null si no hay coincidencia (renombrada o borrada del catálogo)', () => {
    expect(findMatchingCatalogSession({ id: '99', name: 'Ya no existe' }, sessions)).toBeNull();
  });

  test('devuelve null si no hay instancia (día sin sesión asignada)', () => {
    expect(findMatchingCatalogSession(null, sessions)).toBeNull();
  });
});
