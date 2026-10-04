import {
  computeFiltersKey,
  shouldResetPage,
  mergeHistoryPage,
  computeHasMore,
  visibleHistoryItems,
} from '../utils/trainings-history-pagination.js';

describe('computeFiltersKey', () => {
  test('ignora el campo page', () => {
    expect(computeFiltersKey({ teamId: '3', page: 1 })).toBe(computeFiltersKey({ teamId: '3', page: 2 }));
  });

  test('distingue filtros distintos', () => {
    expect(computeFiltersKey({ teamId: '3' })).not.toBe(computeFiltersKey({ teamId: '4' }));
  });
});

describe('shouldResetPage', () => {
  test('false en la primera carga (prevFiltersKey null)', () => {
    expect(shouldResetPage(null, 'a', 1)).toBe(false);
  });

  test('false si los filtros no cambiaron', () => {
    expect(shouldResetPage('a', 'a', 3)).toBe(false);
  });

  test('false si ya está en página 1 (nada que resetear)', () => {
    expect(shouldResetPage('a', 'b', 1)).toBe(false);
  });

  test('true si cambian los filtros estando en página > 1', () => {
    expect(shouldResetPage('a', 'b', 2)).toBe(true);
  });
});

describe('mergeHistoryPage', () => {
  const accumulated = { filtersKey: 'a', pageKey: 'a:1', responseKey: 'a:1:1000', items: [{ id: '1' }, { id: '2' }] };

  test('página 1 reemplaza el acumulado', () => {
    const result = mergeHistoryPage(accumulated, 'b', 'b:1', 'b:1:2000', 1, [{ id: '9' }]);
    expect(result).toEqual({ filtersKey: 'b', pageKey: 'b:1', responseKey: 'b:1:2000', items: [{ id: '9' }] });
  });

  test('página > 1 concatena al acumulado existente', () => {
    const result = mergeHistoryPage(accumulated, 'a', 'a:2', 'a:2:2000', 2, [{ id: '3' }]);
    expect(result).toEqual({ filtersKey: 'a', pageKey: 'a:2', responseKey: 'a:2:2000', items: [{ id: '1' }, { id: '2' }, { id: '3' }] });
  });

  test('un refetch de la MISMA página con responseKey nuevo reemplaza el contenido de la página 1', () => {
    // Caso real del bug: se borra una sesión, invalidateQueries dispara un
    // refetch de la misma página con los mismos filtros -- solo cambia
    // dataUpdatedAt (acá modelado en el responseKey nuevo).
    const result = mergeHistoryPage(accumulated, 'a', 'a:1', 'a:1:2000', 1, [{ id: '1' }]);
    expect(result).toEqual({ filtersKey: 'a', pageKey: 'a:1', responseKey: 'a:1:2000', items: [{ id: '1' }] });
  });
});

describe('computeHasMore', () => {
  test('true cuando quedan más resultados', () => {
    expect(computeHasMore(1, 20, 45)).toBe(true);
  });

  test('false cuando la página cubre el total', () => {
    expect(computeHasMore(3, 20, 45)).toBe(false);
  });

  test('false cuando calza exacto', () => {
    expect(computeHasMore(2, 20, 40)).toBe(false);
  });
});

describe('visibleHistoryItems', () => {
  test('devuelve el acumulado si la key coincide', () => {
    const accumulated = { filtersKey: 'a', items: [{ id: '1' }] };
    expect(visibleHistoryItems(accumulated, 'a')).toEqual([{ id: '1' }]);
  });

  test('devuelve vacío si la key no coincide (filtros cambiaron, todavía sin respuesta nueva)', () => {
    const accumulated = { filtersKey: 'a', items: [{ id: '1' }] };
    expect(visibleHistoryItems(accumulated, 'b')).toEqual([]);
  });
});
