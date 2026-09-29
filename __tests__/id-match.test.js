import { dedupeById, isSameId } from '../utils/id-match.js';

describe('isSameId', () => {
  test('compara igual un número y su string (el caso real: deep link vs backend)', () => {
    expect(isSameId(42, '42')).toBe(true);
    expect(isSameId('42', 42)).toBe(true);
  });

  test('distingue ids distintos del mismo tipo', () => {
    expect(isSameId(42, 43)).toBe(false);
    expect(isSameId('42', '43')).toBe(false);
  });

  test('null/undefined nunca matchean, ni contra sí mismos', () => {
    expect(isSameId(null, null)).toBe(false);
    expect(isSameId(undefined, undefined)).toBe(false);
    expect(isSameId(null, 42)).toBe(false);
    expect(isSameId(42, undefined)).toBe(false);
    expect(isSameId(0, null)).toBe(false);
    expect(isSameId(0, undefined)).toBe(false);
  });

  test('el 0 es un id válido y no se confunde con "sin id"', () => {
    expect(isSameId(0, '0')).toBe(true);
    expect(isSameId(0, 0)).toBe(true);
  });

  test('no muta los argumentos', () => {
    const a = { id: 1 };
    isSameId(a.id, 1);
    expect(a).toEqual({ id: 1 });
  });
});

describe('dedupeById', () => {
  test('deja la primera ocurrencia cuando el id se repite con otro tipo', () => {
    const options = [
      { id: 42, name: 'Sesión A' },
      { id: '42', name: 'Sesión B' },
    ];
    expect(dedupeById(options)).toEqual([{ id: 42, name: 'Sesión A' }]);
  });

  test('deja pasar opciones con ids distintos', () => {
    const options = [
      { id: 1, name: 'A' },
      { id: 2, name: 'B' },
      { id: 3, name: 'C' },
    ];
    expect(dedupeById(options)).toHaveLength(3);
  });

  test('descarta opciones sin id (no son elegibles)', () => {
    const options = [
      { name: 'Sin id' },
      { id: null, name: 'Id nulo' },
      { id: undefined, name: 'Id indefinido' },
      { id: 7, name: 'Válida' },
    ];
    expect(dedupeById(options)).toEqual([{ id: 7, name: 'Válida' }]);
  });

  test('acepta el id 0 (no lo confunde con ausencia de id)', () => {
    expect(dedupeById([{ id: 0, name: 'Cero' }])).toEqual([{ id: 0, name: 'Cero' }]);
  });

  test('tolera entradas inválidas sin romper', () => {
    expect(dedupeById(null)).toEqual([]);
    expect(dedupeById(undefined)).toEqual([]);
    expect(dedupeById([])).toEqual([]);
    expect(dedupeById([null, undefined, { id: 1, name: 'A' }])).toEqual([{ id: 1, name: 'A' }]);
  });

  test('no muta el array original', () => {
    const options = [
      { id: 1, name: 'A' },
      { id: '1', name: 'B' },
    ];
    dedupeById(options);
    expect(options).toHaveLength(2);
  });
});
