import { estimateIndexFromOffset, clampIndex, reorderList, ESTIMATED_ROW_HEIGHT } from '../components/plans/session-reorder-math.js';

describe('estimateIndexFromOffset', () => {
  test('offset 0 da índice 0', () => {
    expect(estimateIndexFromOffset(0)).toBe(0);
  });

  test('offset positivo redondea al múltiplo de fila más cercano', () => {
    expect(estimateIndexFromOffset(ESTIMATED_ROW_HEIGHT)).toBe(1);
    expect(estimateIndexFromOffset(ESTIMATED_ROW_HEIGHT * 2.4)).toBe(2);
    expect(estimateIndexFromOffset(ESTIMATED_ROW_HEIGHT * 2.6)).toBe(3);
  });

  test('offset negativo nunca da índice negativo', () => {
    expect(estimateIndexFromOffset(-500)).toBe(0);
    expect(estimateIndexFromOffset(-ESTIMATED_ROW_HEIGHT / 2)).toBe(0);
  });

  test('acepta un alto de fila custom', () => {
    expect(estimateIndexFromOffset(50, 25)).toBe(2);
  });
});

describe('clampIndex', () => {
  test('deja pasar índices dentro de rango', () => {
    expect(clampIndex(2, 5)).toBe(2);
  });

  test('recorta índices por encima del último válido', () => {
    expect(clampIndex(10, 5)).toBe(4);
  });

  test('recorta índices negativos a 0', () => {
    expect(clampIndex(-3, 5)).toBe(0);
  });

  test('lista vacía siempre da 0', () => {
    expect(clampIndex(3, 0)).toBe(0);
    expect(clampIndex(-1, 0)).toBe(0);
  });
});

describe('reorderList', () => {
  test('mueve el elemento de fromIndex a toIndex', () => {
    expect(reorderList(['a', 'b', 'c', 'd'], 0, 2)).toEqual(['b', 'c', 'a', 'd']);
  });

  test('mueve hacia atrás igual de bien que hacia adelante', () => {
    expect(reorderList(['a', 'b', 'c', 'd'], 3, 1)).toEqual(['a', 'd', 'b', 'c']);
  });

  test('no muta el array original', () => {
    const original = ['a', 'b', 'c'];
    const result = reorderList(original, 0, 2);
    expect(original).toEqual(['a', 'b', 'c']);
    expect(result).not.toBe(original);
  });

  test('fromIndex === toIndex devuelve la misma referencia sin cambios', () => {
    const original = ['a', 'b', 'c'];
    expect(reorderList(original, 1, 1)).toBe(original);
  });

  test('índices fuera de rango devuelven la misma referencia sin cambios', () => {
    const original = ['a', 'b', 'c'];
    expect(reorderList(original, -1, 1)).toBe(original);
    expect(reorderList(original, 0, 5)).toBe(original);
    expect(reorderList(original, 5, 0)).toBe(original);
  });
});
