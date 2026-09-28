import { filterByName, normalizeForSearch } from '../utils/attendance-filter.js';

describe('normalizeForSearch', () => {
  test('quita acentos', () => {
    expect(normalizeForSearch('Núñez')).toBe('nunez');
    expect(normalizeForSearch('ÁÉÍÓÚ')).toBe('aeiou');
  });

  test('pasa a minúsculas', () => {
    expect(normalizeForSearch('CLUB SUR')).toBe('club sur');
  });

  test('null y undefined no rompen', () => {
    expect(normalizeForSearch(null)).toBe('');
    expect(normalizeForSearch(undefined)).toBe('');
  });

  test('acepta números y strings vacíos', () => {
    expect(normalizeForSearch(42)).toBe('42');
    expect(normalizeForSearch('')).toBe('');
  });
});

describe('filterByName', () => {
  const ROSTER = [
    { id: '1', name: 'Núñez' },
    { id: '2', name: 'Ana Gomez' },
    { id: '3', name: 'Muñoz' },
  ];

  test('query con acento matchea el texto sin acentos, y al revés', () => {
    expect(filterByName(ROSTER, 'nunez').map((o) => o.id)).toEqual(['1']);
    expect(filterByName(ROSTER, 'núñez').map((o) => o.id)).toEqual(['1']);
  });

  test('ignora mayúsculas en el texto y en la query', () => {
    expect(filterByName(ROSTER, 'GOMEZ').map((o) => o.id)).toEqual(['2']);
    expect(filterByName([{ name: 'ana' }], 'ANA').map((o) => o.name)).toEqual(['ana']);
  });

  test('query vacío o de solo espacios devuelve todo', () => {
    expect(filterByName(ROSTER, '')).toBe(ROSTER);
    expect(filterByName(ROSTER, '   ')).toBe(ROSTER);
    expect(filterByName(ROSTER, null)).toBe(ROSTER);
    expect(filterByName(ROSTER, undefined)).toBe(ROSTER);
  });

  test('coincidencia parcial a mitad de palabra', () => {
    expect(filterByName(ROSTER, 'mu').map((o) => o.id)).toEqual(['3']);
    expect(filterByName(ROSTER, 'ez').map((o) => o.id)).toEqual(['1', '2']);
  });

  test('acentos en el texto y en la query a la vez', () => {
    expect(filterByName(ROSTER, 'MÚ').map((o) => o.id)).toEqual(['3']);
    expect(filterByName(ROSTER, 'úñez').map((o) => o.id)).toEqual(['1']);
  });

  test('sin coincidencias devuelve array vacío', () => {
    expect(filterByName(ROSTER, 'zzz')).toEqual([]);
  });

  test('textos null/undefined no matchean y no rompen', () => {
    const options = [{ name: null }, { name: undefined }, { name: 'Pérez' }];
    expect(filterByName(options, 'a')).toEqual([]);
    expect(filterByName(options, 'pérez').map((o) => o.name)).toEqual(['Pérez']);
  });

  test('no muta el array original', () => {
    const original = [...ROSTER];
    filterByName(original, 'nunez');
    filterByName(original, '');
    expect(original).toEqual(ROSTER);
    expect(original).toHaveLength(3);
  });

  test('filtra por el nameKey indicado, con default "name"', () => {
    const sessions = [
      { id: 1, name: 'Sesión 1' },
      { id: 2, name: 'Sesión 2' },
      { id: 3, name: 'Sesión 3' },
    ];
    expect(filterByName(sessions, '3', 'id').map((s) => s.id)).toEqual([3]);
    expect(filterByName(sessions, '3').map((s) => s.id)).toEqual([3]);
  });

  test('un nameKey ausente en el item no matchea y no rompe', () => {
    const options = [{ name: 'Ana' }, { other: 'Ana' }];
    expect(filterByName(options, 'ana')).toEqual([{ name: 'Ana' }]);
  });

  test('options no-array devuelve vacío en vez de romper', () => {
    expect(filterByName(undefined, 'ana')).toEqual([]);
    expect(filterByName(null, 'ana')).toEqual([]);
  });
});
