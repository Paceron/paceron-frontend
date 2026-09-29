import { filterAndSortRows, sortRowsByName } from '../utils/attendance-rows.js';

const row = (user_id, name) => ({ user_id, name, email: `${name}@x.com` });

// Orden de entrada deliberadamente NO alfabético, para que un sort que no
// corriga el orden falle el test.
const DESORDERADAS = [row(3, 'Zoe Torres'), row(1, 'Ámbar Núñez'), row(4, 'martín Gómez'), row(2, 'BEATRIZ Soto')];

describe('sortRowsByName', () => {
  test('ascendente ordena alfabéticamente, sin distinguir mayúsculas', () => {
    expect(sortRowsByName(DESORDERADAS, 'asc').map((r) => r.name)).toEqual([
      'Ámbar Núñez',
      'BEATRIZ Soto',
      'martín Gómez',
      'Zoe Torres',
    ]);
  });

  test('descendente es exactamente el reverso', () => {
    const asc = sortRowsByName(DESORDERADAS, 'asc').map((r) => r.name);
    const desc = sortRowsByName(DESORDERADAS, 'desc').map((r) => r.name);
    expect(desc).toEqual([...asc].reverse());
  });

  test('la Ñ ordena como N, no después de la Z (locale es)', () => {
    // Sin locale 'es', 'Ñuñez' se iría al final: 'Ñ' > 'Z' en el orden de
    // puntos de código. Este es el bug que hace que la Ñ quede colgada.
    const names = sortRowsByName([row(1, 'Zulma Paz'), row(2, 'Ñuñez Ana')], 'asc').map((r) => r.name);
    expect(names.indexOf('Ñuñez Ana')).toBeLessThan(names.indexOf('Zulma Paz'));
  });

  test('las tildes no empujan al final (sensitivity base)', () => {
    const names = sortRowsByName([row(1, 'Zulma Paz'), row(2, 'Ávila Nico')], 'asc').map((r) => r.name);
    expect(names[0]).toBe('Ávila Nico');
  });

  test('NO muta el array original (viene de la cache de Query)', () => {
    const original = [...DESORDERADAS];
    sortRowsByName(DESORDERADAS, 'asc');
    expect(DESORDERADAS).toEqual(original);
  });

  test('tolera filas sin name', () => {
    const sucios = [row(1, 'Ana'), { user_id: 2 }, { user_id: 3, name: null }];
    expect(sortRowsByName(sucios, 'asc')).toHaveLength(3);
  });

  test('array vacío y default', () => {
    expect(sortRowsByName([], 'asc')).toEqual([]);
    expect(sortRowsByName(DESORDERADAS).map((r) => r.name)[0]).toBe('Ámbar Núñez');
  });
});

describe('filterAndSortRows', () => {
  test('filtra por nombre ignorando acentos y mayúsculas', () => {
    expect(filterAndSortRows(DESORDERADAS, 'nunez', 'asc').map((r) => r.name)).toEqual(['Ámbar Núñez']);
    expect(filterAndSortRows(DESORDERADAS, 'NÚNEZ', 'asc').map((r) => r.name)).toEqual(['Ámbar Núñez']);
    expect(filterAndSortRows(DESORDERADAS, 'núñez', 'asc').map((r) => r.name)).toEqual(['Ámbar Núñez']);
  });

  test('coincidencia parcial: alcanza con un fragmento del nombre o del apellido', () => {
    // El backend no separa nombre de apellido, así que el filtro tiene que
    // encontrar tanto por el nombre como por el apellido.
    expect(filterAndSortRows(DESORDERADAS, 'torr', 'asc').map((r) => r.name)).toEqual(['Zoe Torres']);
    expect(filterAndSortRows(DESORDERADAS, 'nuñ', 'asc').map((r) => r.name)).toEqual(['Ámbar Núñez']);
    expect(filterAndSortRows(DESORDERADAS, 'GÓM', 'asc').map((r) => r.name)).toEqual(['martín Gómez']);
  });

  test('query vacío devuelve todo, pero ordenado', () => {
    expect(filterAndSortRows(DESORDERADAS, '', 'asc')).toHaveLength(4);
    expect(filterAndSortRows(DESORDERADAS, '   ', 'asc')[0].name).toBe('Ámbar Núñez');
  });

  test('filtra Y ordena al mismo tiempo', () => {
    const todas = [row(1, 'Ana'), row(2, 'Beto'), row(3, 'Caro'), row(4, 'Dani')];
    // 'Beto' no matchea 'a' (B-e-t-o), así que queda afuera: el filtro corre
    // sobre el nombre, no sobre la posición.
    expect(filterAndSortRows(todas, 'a', 'asc').map((r) => r.name)).toEqual(['Ana', 'Caro', 'Dani']);
    expect(filterAndSortRows(todas, 'a', 'desc').map((r) => r.name)).toEqual(['Dani', 'Caro', 'Ana']);
    // 'e' solo está en Beto: el filtro mira el nombre completo, no la posición
    // ni un prefijo.
    expect(filterAndSortRows(todas, 'e', 'asc').map((r) => r.name)).toEqual(['Beto']);
    // Y coincide aunque la vocal esté en medio de la palabra.
    expect(filterAndSortRows(todas, 'ani', 'asc').map((r) => r.name)).toEqual(['Dani']);
  });

  test('sin coincidencias devuelve array vacío (no el original)', () => {
    expect(filterAndSortRows(DESORDERADAS, 'zzzz', 'asc')).toEqual([]);
  });

  test('no muta el array original', () => {
    const original = [...DESORDERADAS];
    filterAndSortRows(DESORDERADAS, 'a', 'desc');
    expect(DESORDERADAS).toEqual(original);
  });
});
