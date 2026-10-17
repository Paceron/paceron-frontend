import { metersPerPixelAtZoom, buildRadiusHaloWidthExpression } from '../utils/map-radius-expression.js';

describe('metersPerPixelAtZoom', () => {
  test('en el ecuador, zoom 0 -> ~156543 metros/píxel (valor estándar Web Mercator)', () => {
    expect(metersPerPixelAtZoom(0, 0)).toBeCloseTo(156543.03, 1);
  });

  test('a mayor zoom, menos metros por píxel', () => {
    expect(metersPerPixelAtZoom(16, -34.6)).toBeLessThan(metersPerPixelAtZoom(8, -34.6));
  });

  test('más cerca del polo, menos metros por píxel (coseno de latitud)', () => {
    expect(metersPerPixelAtZoom(10, 60)).toBeLessThan(metersPerPixelAtZoom(10, 0));
  });
});

describe('buildRadiusHaloWidthExpression', () => {
  test('arma una expresión interpolate válida con stops crecientes de zoom', () => {
    const expression = buildRadiusHaloWidthExpression(50, -34.6);
    expect(expression[0]).toBe('interpolate');
    expect(expression[1]).toEqual(['exponential', 2]);
    expect(expression[2]).toEqual(['zoom']);
    const zooms = expression.slice(3).filter((_, i) => i % 2 === 0);
    expect(zooms).toEqual([8, 12, 16, 20]);
  });

  test('a mayor zoom, el ancho en píxeles crece (mismo radio real, más píxeles representan menos metros)', () => {
    const expression = buildRadiusHaloWidthExpression(50, -34.6);
    const widths = expression.slice(3).filter((_, i) => i % 2 === 1);
    for (let i = 1; i < widths.length; i++) {
      expect(widths[i]).toBeGreaterThan(widths[i - 1]);
    }
  });

  test('radio 0 o negativo -> ancho 0 en todos los stops', () => {
    const expression = buildRadiusHaloWidthExpression(0, -34.6);
    const widths = expression.slice(3).filter((_, i) => i % 2 === 1);
    widths.forEach((w) => expect(w).toBe(0));

    const expressionNegative = buildRadiusHaloWidthExpression(-10, -34.6);
    const widthsNegative = expressionNegative.slice(3).filter((_, i) => i % 2 === 1);
    widthsNegative.forEach((w) => expect(w).toBe(0));
  });

  test('radio mayor -> ancho proporcionalmente mayor en cada stop', () => {
    const small = buildRadiusHaloWidthExpression(50, -34.6);
    const big = buildRadiusHaloWidthExpression(100, -34.6);
    const smallWidths = small.slice(3).filter((_, i) => i % 2 === 1);
    const bigWidths = big.slice(3).filter((_, i) => i % 2 === 1);
    smallWidths.forEach((w, i) => expect(bigWidths[i]).toBeCloseTo(w * 2, 5));
  });
});
