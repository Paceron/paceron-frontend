import {
  DASHBOARD_BANDS,
  BAND_LABELS,
  barPath,
  boxPlotStats,
  dotPoints,
  extent,
  gaugeArc,
  linePath,
  quantile,
  scaleLinear,
  stackedBar100,
} from '../utils/dashboard-chart.js';

describe('scaleLinear', () => {
  test('mapea el dominio al rango', () => {
    const y = scaleLinear([0, 100], [200, 0]);
    expect(y(0)).toBe(200);
    expect(y(50)).toBe(100);
    expect(y(100)).toBe(0);
    expect(y(25)).toBe(150);
  });

  test('un rango invertido invierte la escala', () => {
    const x = scaleLinear([0, 10], [0, 100]);
    expect(x(0)).toBe(0);
    expect(x(10)).toBe(100);
    expect(scaleLinear([10, 0], [0, 100])(10)).toBe(0);
  });

  test('con decimales mantiene la proporción', () => {
    const y = scaleLinear([0, 3], [0, 1]);
    expect(y(1.5)).toBe(0.5);
    expect(y(2.25)).toBe(0.75);
  });

  test('todos los valores iguales caen en el medio, no en el piso', () => {
    const y = scaleLinear([12.4, 12.4], [200, 0]);
    expect(y(12.4)).toBe(100);
    expect(Number.isNaN(y(12.4))).toBe(false);
  });

  test('con rango cero todos los valores caen en el mismo punto', () => {
    const y = scaleLinear([0, 10], [50, 50]);
    expect(y(0)).toBe(50);
    expect(y(10)).toBe(50);
  });

  test('un valor ausente da null y no un 0 en el origen', () => {
    const y = scaleLinear([0, 100], [200, 0]);
    expect(y(null)).toBeNull();
    expect(y(undefined)).toBeNull();
    expect(y('12')).toBeNull();
    expect(y(NaN)).toBeNull();
    expect(y(Infinity)).toBeNull();
    expect(scaleLinear(null, [0, 1])(5)).toBeNull();
    expect(scaleLinear([0, 'x'], [0, 1])(5)).toBeNull();
  });

  test('nunca devuelve NaN, con ningún dominio', () => {
    const scale = scaleLinear([1, 1], [1, 1]);
    [0, -1, 1e9, null, undefined, NaN, 'x', {}].forEach((v) => {
      expect(Number.isNaN(scale(v))).toBe(false);
    });
  });
});

describe('extent', () => {
  test('devuelve mínimo y máximo de los números presentes', () => {
    expect(extent([3, 1, 7])).toEqual([1, 7]);
    expect(extent([-5, 0, 5])).toEqual([-5, 5]);
    expect(extent([2.5, 2.5])).toEqual([2.5, 2.5]);
  });

  test('descarta lo que no es número', () => {
    expect(extent([3, null, undefined, 'x', 1])).toEqual([1, 3]);
    expect(extent([])).toBeNull();
    expect(extent(null)).toBeNull();
    expect(extent([null, null])).toBeNull();
  });
});

describe('linePath', () => {
  test('une los puntos en un solo trazo', () => {
    expect(linePath([{ x: 0, y: 10 }, { x: 10, y: 0 }])).toBe('M0 10 L10 0');
    expect(linePath([{ x: 0, y: 10 }, { x: 10, y: 0 }, { x: 20, y: 20 }])).toBe('M0 10 L10 0 L20 20');
  });

  test('redondea a dos decimales', () => {
    expect(linePath([{ x: 1.23456, y: 9.87654 }, { x: 2, y: 3 }])).toBe('M1.23 9.88 L2 3');
  });

  test('un solo punto no dibuja una línea', () => {
    expect(linePath([{ x: 5, y: 5 }])).toBeNull();
    expect(linePath([])).toBeNull();
    expect(linePath(null)).toBeNull();
  });

  test('un hueco corta el trazo en vez de Tender un puente', () => {
    const d = linePath([
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 20, y: null },
      { x: 30, y: 30 },
      { x: 40, y: 40 },
    ]);
    expect(d).toBe('M0 0 L10 0 M30 30 L40 40');
  });

  test('un punto aislado rodeado de huecos no dibuja nada', () => {
    expect(linePath([{ x: 0, y: null }, { x: 10, y: 10 }, { x: 20, y: null }])).toBeNull();
    expect(linePath([{ x: null, y: 1 }, { x: 2, y: null }])).toBeNull();
  });

  test('con todos los valores iguales la línea queda horizontal y finita', () => {
    const d = linePath([{ x: 0, y: 100 }, { x: 10, y: 100 }, { x: 20, y: 100 }]);
    expect(d).toBe('M0 100 L10 100 L20 100');
    expect(d).not.toMatch(/NaN/);
  });
});

describe('barPath', () => {
  const monthly = [1, 2, 3, 4];

  test('reparte el alto entre las barras con su separación', () => {
    const bars = barPath(monthly, { width: 320, height: 200, gap: 10 });
    expect(bars).toHaveLength(4);
    expect(bars.map((b) => b.x)).toEqual([0, 82.5, 165, 247.5]);
    expect(bars.every((b) => b.width === 72.5)).toBe(true);
    // La más alta ocupa todo el alto y la más corta un cuarto.
    expect(bars[3]).toEqual(expect.objectContaining({ y: 0, height: 200 }));
    expect(bars[0]).toEqual(expect.objectContaining({ y: 150, height: 50 }));
  });

  test('en horizontal la barra crece hacia la derecha y la fila se apila', () => {
    const bars = barPath(monthly, { width: 300, height: 100, gap: 10, horizontal: true });
    expect(bars.map((b) => b.y)).toEqual([0, 27.5, 55, 82.5]);
    expect(bars.every((b) => b.height === 17.5)).toBe(true);
    expect(bars[3]).toEqual(expect.objectContaining({ x: 0, width: 300 }));
    expect(bars[0]).toEqual(expect.objectContaining({ x: 0, width: 75 }));
  });

  test('un valor negativo crece hacia el otro lado de la base, no hacia el piso', () => {
    const bars = barPath([-5, 10], { width: 100, height: 200 });
    // El dominio es [-5, 10], así que el cero queda a 2/3 del alto desde abajo:
    // la barra negativa cuelga de ahí hacia abajo y la positiva sube al tope.
    expect(bars[0]).toEqual(expect.objectContaining({ y: 133.33, height: 66.67 }));
    expect(bars[1]).toEqual(expect.objectContaining({ y: 0, height: 133.33 }));
  });

  test('todos los valores iguales llenan la misma barra contra la base', () => {
    const bars = barPath([7, 7, 7], { width: 90, height: 90 });
    bars.forEach((b) => {
      expect(Number.isFinite(b.height)).toBe(true);
      expect(b.height).toBe(90);
    });
  });

  test('todos en cero deja barras de largo cero', () => {
    barPath([0, 0], { width: 100, height: 100 }).forEach((b) => {
      expect(b.height).toBe(0);
      expect(b.missing).toBe(false);
    });
  });

  test('un valor ausente reserva su lugar y se marca, sin volverse un cero', () => {
    const bars = barPath([10, null, 20], { width: 90, height: 200 });
    expect(bars[1]).toEqual(expect.objectContaining({ value: null, height: 0, missing: true }));
    expect(bars.map((b) => b.x)).toEqual([0, 30, 60]);
    expect(bars[0].missing).toBe(false);
  });

  test('decimales y negativos juntos no producen NaN', () => {
    const bars = barPath([-1.5, 0, 2.25], { width: 100, height: 100 });
    bars.forEach((b) => {
      expect(Number.isFinite(b.x + b.y + b.width + b.height)).toBe(true);
    });
  });

  test('sin datos o sin recuadro medido no dibuja nada', () => {
    expect(barPath([], { width: 100, height: 100 })).toEqual([]);
    expect(barPath(null, { width: 100, height: 100 })).toEqual([]);
    expect(barPath(monthly, { width: 0, height: 100 })).toEqual([]);
    expect(barPath(monthly, { width: 100, height: -5 })).toEqual([]);
    expect(barPath(monthly)).toEqual([]);
  });
});

describe('stackedBar100', () => {
  const buckets = [
    [6, 2, 1, 1],
    [0, 0, 4, 0],
  ];

  test('reparte el 100 % de la barra entre las bandas', () => {
    const bars = stackedBar100(buckets, { width: 100, height: 200 });
    expect(bars).toHaveLength(2);

    const first = bars[0];
    expect(first.total).toBe(10);
    expect(first.parts.map((p) => p.band)).toEqual(['met', 'near', 'missed', 'unknown']);
    expect(first.parts.map((p) => p.share)).toEqual([0.6, 0.2, 0.1, 0.1]);
    expect(first.parts.map((p) => p.height)).toEqual([120, 40, 20, 20]);
    expect(first.parts.map((p) => p.width)).toEqual([50, 50, 50, 50]);
    expect(first).toEqual(expect.objectContaining({ x: 0, width: 50, height: 200 }));

    // La pila arranca en la base y termina arriba, sin huecos ni solapes.
    expect(first.parts.map((p) => p.y)).toEqual([80, 40, 20, 0]);
    expect(first.parts[1].y + first.parts[1].height).toBe(first.parts[0].y);
    expect(first.parts[3].y + first.parts[3].height).toBe(first.parts[2].y);
  });

  test('un bucket sin conteos no inventa reparto', () => {
    const [empty] = stackedBar100([[0, 0, 0, 0]], { width: 100, height: 200 });
    expect(empty.total).toBe(0);
    expect(empty.parts).toEqual([]);
  });

  test('acepta el bucket como objeto además de como arreglo', () => {
    const [asObject] = stackedBar100([{ met: 6, near: 2, missed: 1, unknown: 1 }], { width: 100, height: 200 });
    const [asArray] = stackedBar100([[6, 2, 1, 1]], { width: 100, height: 200 });
    expect(asObject.parts).toEqual(asArray.parts);
  });

  test('una banda en cero no produce un rectángulo de alto cero', () => {
    const [bar] = stackedBar100([[0, 0, 4, 0]], { width: 100, height: 200 });
    expect(bar.parts.map((p) => p.band)).toEqual(['missed']);
  });

  test('horizontal reparte sobre el ancho y apila las filas', () => {
    const [bar] = stackedBar100([[5, 5]], { width: 300, height: 40, horizontal: true });
    expect(bar).toEqual(expect.objectContaining({ x: 0, y: 0, width: 300, height: 40 }));
    expect(bar.parts.map((p) => [p.x, p.width])).toEqual([[0, 150], [150, 150]]);
  });

  test('un conteo ausente o negativo cuenta como cero, sin NaN', () => {
    const [bar] = stackedBar100([[null, 3, -2, undefined]], { width: 100, height: 200 });
    expect(bar.total).toBe(3);
    expect(bar.parts.map((p) => p.band)).toEqual(['near']);
    bar.parts.forEach((p) => expect(Number.isFinite(p.height) && Number.isFinite(p.share)).toBe(true));
  });

  test('el orden de bandas es el del contrato y tiene su etiqueta', () => {
    expect(DASHBOARD_BANDS).toEqual(['met', 'near', 'missed', 'unknown']);
    DASHBOARD_BANDS.forEach((band) => expect(typeof BAND_LABELS[band]).toBe('string'));
  });

  test('sin datos o sin recuadro medido no dibuja nada', () => {
    expect(stackedBar100([], { width: 100, height: 100 })).toEqual([]);
    expect(stackedBar100(null, { width: 100, height: 100 })).toEqual([]);
    expect(stackedBar100(buckets, { width: 0, height: 100 })).toEqual([]);
  });
});

describe('dotPoints', () => {
  const items = [
    { x: 0, y: 0, label: 'a' },
    { x: 100, y: 50, label: 'b' },
    { x: 50, y: 100, label: 'c' },
  ];

  test('escala los dos ejes dentro del recuadro', () => {
    const { points } = dotPoints(items, { width: 200, height: 100, xDomain: [0, 100], yDomain: [0, 100] });
    expect(points).toHaveLength(3);
    expect(points[0]).toEqual(expect.objectContaining({ cx: 0, cy: 100 }));
    expect(points[1]).toEqual(expect.objectContaining({ cx: 200, cy: 50 }));
    expect(points[2]).toEqual(expect.objectContaining({ cx: 100, cy: 0 }));
    expect(points[1].item.label).toBe('b');
  });

  test('el eje Y crece hacia arriba: el valor más alto, más arriba', () => {
    const { points } = dotPoints([{ x: 1, y: 1 }, { x: 2, y: 9 }], {
      width: 100, height: 100, xDomain: [1, 2], yDomain: [1, 9],
    });
    expect(points[0].cy).toBeGreaterThan(points[1].cy);
  });

  test('un único punto no rompe la escala', () => {
    const { points } = dotPoints([{ x: 7, y: 7 }], { width: 100, height: 100 });
    expect(points).toHaveLength(1);
    expect(Number.isFinite(points[0].cx)).toBe(true);
    expect(Number.isFinite(points[0].cy)).toBe(true);
  });

  test('deriva el dominio de los datos cuando no se pasa explícito', () => {
    const { x, points } = dotPoints([{ x: 10, y: 0 }, { x: 30, y: 20 }], { width: 100, height: 100, minimumRange: 0 });
    expect(x(10)).toBe(0);
    expect(x(30)).toBe(100);
    expect(points[0].cx).toBe(0);
  });

  test('descarta los puntos sin dato en vez de dibujarlos en el origen', () => {
    const { points } = dotPoints(
      [{ x: 0, y: 0 }, { x: null, y: 5 }, { x: 5, y: 'x' }, { x: 10, y: 10 }],
      { width: 100, height: 100, xDomain: [0, 10], yDomain: [0, 10] }
    );
    expect(points).toHaveLength(2);
    expect(points.map((p) => p.index)).toEqual([0, 3]);
  });

  test('sin recuadro medido no hay puntos', () => {
    expect(dotPoints(items, { width: 0, height: 100 }).points).toEqual([]);
    expect(dotPoints(null, { width: 100, height: 100 }).points).toEqual([]);
  });
});

describe('quantile', () => {
  test('interpola entre los dos valores vecinos', () => {
    expect(quantile([1, 2, 3, 4], 0.5)).toBe(2.5);
    expect(quantile([1, 2, 3, 4], 0.25)).toBe(1.75);
    expect(quantile([1, 2, 3, 4], 0.75)).toBe(3.25);
    expect(quantile([1, 2, 3, 4], 0)).toBe(1);
    expect(quantile([1, 2, 3, 4], 1)).toBe(4);
  });

  test('lista vacía o posición inválida devuelven null', () => {
    expect(quantile([], 0.5)).toBeNull();
    expect(quantile([1, 2], 1.5)).toBeNull();
    expect(quantile([1, 2], -0.1)).toBeNull();
    expect(quantile([1, 2], null)).toBeNull();
  });
});

describe('boxPlotStats', () => {
  test('cuartiles y bigotes sobre una muestra sin outliers', () => {
    const stats = boxPlotStats([1, 2, 3, 4, 5]);
    expect(stats.count).toBe(5);
    expect(stats.q1).toBe(2);
    expect(stats.median).toBe(3);
    expect(stats.q3).toBe(4);
    expect(stats.iqr).toBe(2);
    expect(stats.lowerFence).toBe(-1);
    expect(stats.upperFence).toBe(7);
    expect(stats.whiskerLow).toBe(1);
    expect(stats.whiskerHigh).toBe(5);
    expect(stats.outliers).toEqual([]);
  });

  test('marca como outlier lo que cae fuera de 1,5 IQR y acorta el bigote', () => {
    const stats = boxPlotStats([1, 2, 3, 4, 5, 6, 7, 100]);
    expect(stats.outliers).toEqual([100]);
    expect(stats.max).toBe(100);
    expect(stats.whiskerHigh).toBe(7);
    expect(stats.upperFence).toBe(11.5);
  });

  test('la constante k se puede ajustar', () => {
    const values = [1, 2, 3, 4, 10];
    expect(boxPlotStats(values, { k: 1.5 }).outliers).toEqual([10]);
    expect(boxPlotStats(values, { k: 10 }).outliers).toEqual([]);
  });

  test('un solo valor da caja chata y sin outliers', () => {
    const stats = boxPlotStats([4.2]);
    expect(stats).toEqual(expect.objectContaining({
      count: 1, min: 4.2, q1: 4.2, median: 4.2, q3: 4.2, max: 4.2,
      iqr: 0, whiskerLow: 4.2, whiskerHigh: 4.2, outliers: [],
    }));
  });

  test('todos los valores iguales no.divide por cero', () => {
    const stats = boxPlotStats([3, 3, 3, 3]);
    expect(stats.iqr).toBe(0);
    expect(stats.outliers).toEqual([]);
    expect(stats.whiskerLow).toBe(3);
    expect(stats.whiskerHigh).toBe(3);
  });

  test('un IQR de cero con un valor extremo lo marca como outlier', () => {
    const stats = boxPlotStats([1, 1, 1, 1, 5]);
    expect(stats.iqr).toBe(0);
    expect(stats.outliers).toEqual([5]);
    expect(stats.whiskerHigh).toBe(1);
  });

  test('funciona con negativos y decimales', () => {
    const stats = boxPlotStats([-1.5, -0.5, 0, 0.5, 1.5]);
    expect(stats.median).toBe(0);
    expect(stats.q1).toBe(-0.5);
    expect(stats.q3).toBe(0.5);
    expect(stats.outliers).toEqual([]);
  });

  test('descarta los nulos y cuenta solo los valores reales', () => {
    const stats = boxPlotStats([1, null, 2, undefined, 3, NaN]);
    expect(stats.count).toBe(3);
    expect(stats.median).toBe(2);
  });

  test('sin datos devuelve todo en null y no en cero', () => {
    expect(boxPlotStats([])).toEqual({
      count: 0, min: null, q1: null, median: null, q3: null, max: null, iqr: null,
      lowerFence: null, upperFence: null, whiskerLow: null, whiskerHigh: null, outliers: [],
    });
    expect(boxPlotStats(null)).toEqual(expect.objectContaining({ count: 0, median: null }));
    expect(boxPlotStats([null, null])).toEqual(expect.objectContaining({ count: 0, min: null }));
  });
});

describe('gaugeArc', () => {
  test('alcanzar el objetivo llena 4/5 de la semicircunferencia', () => {
    const gauge = gaugeArc(12, 12, { radius: 100 });
    expect(gauge.ratio).toBe(1);
    expect(gauge.clamped).toBe(false);
    expect(gauge.needleAngle).toBe(324);
    expect(gauge.trackPath).toBe('M0 100 A100 100 0 0 1 200 100');
    expect(gauge.progressPath).toBe('M0 100 A100 100 0 0 1 180.9 41.22');
  });

  test('el tope por defecto es 1,25 del objetivo', () => {
    const gauge = gaugeArc(15, 12, { radius: 100 });
    expect(gauge.maxRatio).toBe(1.25);
    expect(gauge.needleAngle).toBe(360);
    expect(gauge.clamped).toBe(false);
  });

  test('la mitad del objetivo llena un cuarto de la pista', () => {
    expect(gaugeArc(6, 12, { radius: 100 }).needleAngle).toBe(252);
    expect(gaugeArc(0, 12, { radius: 100 }).needleAngle).toBe(180);
  });

  test('pasarse del objetivo se clampea y avisa', () => {
    const gauge = gaugeArc(30, 12, { radius: 100 });
    expect(gauge.ratio).toBe(1.25);
    expect(gauge.clamped).toBe(true);
    expect(gauge.needleAngle).toBe(360);
  });

  test('un objetivo negativo o cero no es un objetivo', () => {
    expect(gaugeArc(12, 0, { radius: 100 }).progressPath).toBeNull();
    expect(gaugeArc(12, -3, { radius: 100 }).progressPath).toBeNull();
  });

  test('sin dato no hay arco de progreso ni aguja, pero sí la pista', () => {
    const gauge = gaugeArc(null, 12, { radius: 100 });
    expect(gauge.ratio).toBeNull();
    expect(gauge.needleAngle).toBeNull();
    expect(gauge.progressPath).toBeNull();
    expect(gauge.trackPath).toBe('M0 100 A100 100 0 0 1 200 100');
  });

  test('sin radio medido no devuelve una figura', () => {
    expect(gaugeArc(12, 12, { radius: 0 })).toBeNull();
  });

  test('ninguna combinación devuelve NaN en el path', () => {
    [
      [0, 0], [1, null], [null, 1], [1e9, 1], [-5, 10], [5, -10], [NaN, NaN], [12, 12],
    ].forEach(([v, t]) => {
      const gauge = gaugeArc(v, t, { radius: 80 });
      expect(gauge).not.toBeNull();
      expect(gauge.trackPath).not.toMatch(/NaN/);
      if (gauge.progressPath) expect(gauge.progressPath).not.toMatch(/NaN/);
      expect(Number.isFinite(gauge.needleAngle ?? 0)).toBe(true);
    });
  });
});

describe('ningún helper devuelve NaN', () => {
  const HOSTILE = [null, undefined, NaN, Infinity, -Infinity, '', 'x', {}, [], 0, -1, 1e12];

  test('con entradas basura en todas partes', () => {
    const walk = (value) => {
      if (typeof value === 'number') {
        expect(Number.isNaN(value)).toBe(false);
        return;
      }
      if (Array.isArray(value)) {
        value.forEach(walk);
        return;
      }
      if (value && typeof value === 'object') {
        Object.values(value).forEach(walk);
      }
    };

    HOSTILE.forEach((v) => {
      walk(scaleLinear([v, v], [v, v])(v));
      walk(linePath([{ x: v, y: v }, { x: v, y: v }]));
      walk(linePath(v));
      walk(barPath(v, { width: v, height: v, gap: v }));
      walk(barPath([v, v, v], { width: 100, height: 100 }));
      walk(stackedBar100([v], { width: 100, height: 100, gap: v }));
      walk(stackedBar100([[v, v]], { width: 100, height: 100 }));
      walk(dotPoints([{ x: v, y: v }], { width: 100, height: 100 }));
      walk(dotPoints(v, { width: 100, height: 100 }));
      walk(boxPlotStats(v));
      walk(boxPlotStats([v, v, v]));
      walk(gaugeArc(v, v, { radius: 100 }));
      walk(extent(v));
    });
  });
});