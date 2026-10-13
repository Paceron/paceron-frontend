// Geometría de los gráficos del dashboard de rendimiento. Puro a propósito
// (sin React ni SVG) para poder testearlo con Jest: el componente solo pega lo
// que sale de acá. Mismo criterio que utils/payments-chart.js y
// utils/trajectory.js — la parte con más chances de error (ejes, escalas, NaN
// cuando todos los valores son iguales) es justamente la testeable.
//
// Regla que atraviesa TODAS las funciones del archivo: nada devuelve NaN y nada
// convierte la ausencia de dato en un cero. Un `null` es `null` (o una bandera
// `missing`), nunca 0 — ver design.md D5.

const round = (n) => {
  const r = Math.round(n * 100) / 100;
  // -0 + 0 === +0: sin esto, un valor apenas negativo redondeado a cero deja
  // un -0 que se ve igual pero rompe comparaciones en los tests.
  return r === 0 ? 0 : r;
};

// Estricto a propósito: un string no es un número. Si el backend empezara a
// mandar "12" en vez de 12, queremos que el punto se marque como faltante y se
// vea en el gráfico, no que se dibuje en la posición de un valor inventado.
const finite = (value) => (typeof value === 'number' && Number.isFinite(value) ? value : null);

const positiveOrZero = (n) => (Number.isFinite(n) && n > 0 ? n : 0);

// Infinity * 0 es NaN, así que un `gap` no finito no se puede dejar pasar: con
// una sola barra el producto da NaN y el ancho de la barra se pierde con él.
const finiteOrZero = (n) => (Number.isFinite(Number(n)) && Number(n) > 0 ? Number(n) : 0);

// [mínimo, máximo] de los números presentes en la lista, o null si no hay
// ninguno. Se exporta porque el componente necesita el dominio para rotular los
// ejes, y recalcularlo allá es justamente la forma de que la escala del gráfico
// y la de sus etiquetas se desincronicen.
export function extent(values) {
  const nums = (Array.isArray(values) ? values : []).map(finite).filter((n) => n !== null);
  if (!nums.length) return null;
  return [Math.min(...nums), Math.max(...nums)];
}

// Escala lineal de dominio a rango, estilo d3 pero sin dependencias:
//   const y = scaleLinear([0, 100], [height, 0]);
//   y(50) → height / 2
//
// Devuelve null (no NaN) para un valor ausente: el caller lo usa para NO
// dibujar ese punto en vez de dibujarlo en el origen.
//
// Con dominio de rango cero (todos los valores iguales, p. ej. todas las series
// del día dieron 12,4 km/h) no hay escala posible, así que todos los valores
// caen en el punto medio del rango: una línea plana en el medio se lee como
// "todo igual"; pegada al piso se leería como "todo en cero", que es un dato
// distinto del que hay.
export function scaleLinear(domain, range) {
  const d = Array.isArray(domain) ? domain : [];
  const r = Array.isArray(range) ? range : [];
  const d0 = finite(d[0]);
  const d1 = finite(d[1]);
  const r0 = finite(r[0]) ?? 0;
  const r1 = finite(r[1]) ?? 0;
  if (d0 === null || d1 === null) return () => null;

  const span = d1 - d0;
  if (span === 0) {
    const middle = (r0 + r1) / 2;
    return (value) => (finite(value) === null ? null : middle);
  }
  return (value) => {
    const v = finite(value);
    if (v === null) return null;
    return r0 + ((v - d0) / span) * (r1 - r0);
  };
}

// Path de una polilínea a partir de [{ x, y }] (coordenadas de pantalla ya
// escaladas). Un punto sin dato (x o y no finito) CORTA el trazo en vez de
// saltarse: hacer de puente dibujaría una pendiente que no existe entre dos
// mediciones que nunca se hicieron. Devuelve null si no queda ningún segmento
// (cero puntos, un solo punto, o un único punto válido rodeado de huecos).
export function linePath(points) {
  const list = Array.isArray(points) ? points : [];
  let d = '';
  let segments = 0;
  let open = false;
  let prev = null;

  for (const point of list) {
    const x = finite(point?.x);
    const y = finite(point?.y);
    if (x === null || y === null) {
      open = false;
      prev = null;
      continue;
    }
    const coord = { x: round(x), y: round(y) };
    if (open && prev) {
      d += ` L${coord.x} ${coord.y}`;
      segments += 1;
    } else {
      d += `${d ? ' ' : ''}M${coord.x} ${coord.y}`;
    }
    open = true;
    prev = coord;
  }
  return segments > 0 ? d : null;
}

// Barras (rects) de un ranking o de una serie temporal. `horizontal: true`
// invierte los ejes, que es lo que usa el ranking: la barra crece hacia la
// derecha y la etiqueta de la fila queda a la izquierda.
//
// El cero SIEMPRE entra al dominio aunque ningún valor lo cruce: es la línea de
// base desde la que se mide el largo de una barra, y sin ella el largo de la
// barra deja de ser comparable entre filas. Por eso los valores negativos
// Works: la barra crece hacia el otro lado de la base, nunca hacia el piso.
//
// Un valor ausente (null) no se dibuja, pero RESERVA su lugar (`missing: true`)
// para que el eje no se corra respecto de lo que espera el resto del gráfico.
export function barPath(values, { width, height, gap = 0, horizontal = false } = {}) {
  const list = Array.isArray(values) ? values : [];
  if (!list.length) return [];
  const w = positiveOrZero(Number(width));
  const h = positiveOrZero(Number(height));
  if (w <= 0 || h <= 0) return [];

  const nums = list.map(finite);
  const present = nums.filter((n) => n !== null);
  const low = Math.min(0, ...(present.length ? present : [0]));
  const high = Math.max(0, ...(present.length ? present : [0]));

  // Cada orientación reparte las barras sobre un eje y mide su largo sobre el
  // otro: vertical = una al lado de la otra a lo ancho, largo en la altura;
  // horizontal = una debajo de la otra a lo alto, largo en el ancho.
  const spread = horizontal ? h : w;
  const grow = horizontal ? w : h;
  const scale = scaleLinear([low, high], horizontal ? [0, grow] : [grow, 0]);
  const base = scale(0) ?? 0;

  const spacing = finiteOrZero(gap);
  const slot = (spread - spacing * (list.length - 1)) / list.length;
  const thickness = Math.max(0, slot);

  return list.map((_, index) => {
    const value = nums[index];
    const pos = value === null ? null : scale(value);
    const start = pos === null ? base : Math.min(base, pos);
    const length = pos === null ? 0 : Math.abs(pos - base);
    const offset = round(index * (slot + spacing));
    const rect = {
      index,
      value,
      length: round(length),
      missing: value === null,
    };
    if (horizontal) {
      return { ...rect, x: round(start), y: offset, width: round(length), height: round(thickness) };
    }
    return { ...rect, x: offset, y: round(start), width: round(thickness), height: round(length) };
  });
}

// Las cuatro bandas de cumplimiento. El orden es el de abajo hacia arriba en el
// gráfico 100 % y el de las celdas del backend: `band_counts` por bucket.
// Los enums llegan en inglés y se muestran crudo — el front no traduce el
// contrato, y un `met` traducido a "cumplió" deja de ser reconciliable con la
// respuesta de la API.
export const DASHBOARD_BANDS = ['met', 'near', 'missed', 'unknown'];

export const BAND_LABELS = {
  met: 'Cumplió',
  near: 'Cerca del objetivo',
  missed: 'No cumplió',
  unknown: 'Sin dato',
};

// Barras apiladas al 100 %: cada bucket se reparte según los conteos que llegan
// calculados del backend (`band_counts` por bucket, `band` por serie). El front
// NO recalcula los umbrales de `near` ni decide qué banda es cuál — solo
// reparte el 100 % dentro de lo que le dieron.
//
// Un bucket puede venir como objeto ({ met, near, missed, unknown }) o como
// arreglo en el orden de DASHBOARD_BANDS: se aceptan los dos porque el orden es
// justo la clase de error que no se ve hasta que el gráfico sale al revés.
export function stackedBar100(segments, { width, height, gap = 0, horizontal = false, bands = DASHBOARD_BANDS } = {}) {
  const list = Array.isArray(segments) ? segments : [];
  if (!list.length) return [];
  const w = positiveOrZero(Number(width));
  const h = positiveOrZero(Number(height));
  if (w <= 0 || h <= 0) return [];

  const along = horizontal ? w : h;
  const spacing = finiteOrZero(gap);
  const spread = horizontal ? h : w;
  const slot = (spread - spacing * (list.length - 1)) / list.length;
  const thickness = Math.max(0, slot);

  const countsOf = (bucket) =>
    bands.map((band, i) => {
      const raw = Array.isArray(bucket) ? bucket[i] : bucket?.[band];
      const n = finite(raw);
      return n === null || n < 0 ? 0 : n;
    });

  return list.map((bucket, index) => {
    const counts = countsOf(bucket);
    const total = counts.reduce((acc, n) => acc + n, 0);
    const offset = round(index * (slot + spacing));

    let cursor = 0;
    const parts = counts
      .map((count, i) => ({ count, band: bands[i] ?? String(i), share: total > 0 ? count / total : 0 }))
      .filter((part) => part.count > 0)
      .map((part) => {
        const size = part.share * along;
        const at = round(cursor);
        cursor += size;
        const rect = {
          band: part.band,
          label: BAND_LABELS[part.band] ?? part.band,
          count: part.count,
          share: round(part.share * 100) / 100,
        };
        if (horizontal) {
          return { ...rect, x: at, y: offset, width: round(size), height: round(thickness) };
        }
        return { ...rect, x: offset, y: round(along - cursor), width: round(thickness), height: round(size) };
      });

    // La barra completa mide todo el eje del 100 %, no el slot: el slot es la
    // separación entre barras.
    const bar = { index, total, parts };
    if (horizontal) {
      return { ...bar, x: 0, y: offset, width: round(along), height: round(thickness) };
    }
    return { ...bar, x: offset, y: 0, width: round(thickness), height: round(along) };
  });
}

// Dispersión (dot plot): un punto por serie, con el eje X y el Y escalados
// dentro del recuadro. Devuelve las escalas junto a los puntos para que el
// componente rotule los ejes con EXACTAMENTE la misma transformación y no
// tenga que volver a derivar el dominio (que es donde se cuelan los NaN).
//
// El eje Y crece hacia arriba: el valor más alto, más arriba. Sin `xDomain` /
// `yDomain` explícitos, el dominio se deriva de los puntos con `minimumRange`
// para que un único punto no produzca un dominio de rango cero.
export function dotPoints(items, { width, height, xDomain, yDomain, minimumRange = 1 } = {}) {
  const list = Array.isArray(items) ? items : [];
  const w = positiveOrZero(Number(width));
  const h = positiveOrZero(Number(height));
  if (w <= 0 || h <= 0) return { points: [], x: scaleLinear([], []), y: scaleLinear([], []) };

  const valid = list
    .map((item, index) => ({ item, index, x: finite(item?.x), y: finite(item?.y) }))
    .filter((p) => p.x !== null && p.y !== null);

  const pad = Number(minimumRange) > 0 ? Number(minimumRange) : 0;
  const domainOf = (given, key) => {
    const asArray = Array.isArray(given) && given.length === 2 && given.every((v) => finite(v) !== null) ? given : null;
    if (asArray) return asArray;
    const found = extent(valid.map((p) => p[key]));
    if (!found) return null;
    return [found[0] - pad, found[1] + pad];
  };

  const x = scaleLinear(domainOf(xDomain, 'x'), [0, w]);
  const y = scaleLinear(domainOf(yDomain, 'y'), [h, 0]);

  const points = valid.map(({ item, index, x: vx, y: vy }) => ({
    index,
    item,
    cx: round(x(vx)),
    cy: round(y(vy)),
  }));

  return { points, x, y };
}

// Cuantil por interpolación lineal (método R-7, el de d3 y numpy): la posición
// p se ubica dentro del vector ordenado y se interpola entre los dos valores
// vecinos. `sorted` tiene que venir ordenado y sin nulos — boxPlotStats lo
// garantiza. p fuera de [0, 1] o lista vacía → null.
export function quantile(sorted, p) {
  const n = Array.isArray(sorted) ? sorted.length : 0;
  if (n === 0) return null;
  // Number(null) y Number('') dan 0, que es una posición VÁLIDA: sin este
  // descarte, quantile(x, null) devolvería el mínimo en vez de null.
  if (typeof p !== 'number' || !Number.isFinite(p) || p < 0 || p > 1) return null;
  const h = (n - 1) * p;
  const lo = Math.floor(h);
  const hi = Math.ceil(h);
  if (lo === hi) return round(sorted[lo]);
  return round(sorted[lo] + (h - lo) * (sorted[hi] - sorted[lo]));
}

// Criterio de outliers de Tukey (k = 1,5 IQR por default): lo que cae fuera de
// [Q1 − k·IQR, Q3 + k·IQR] es outlier, y los bigotes van hasta el valor más
// extremo DENTRO de las cercas, no hasta la cerca misma.
//
// Se aclaramos `min`/`max` (los extremos reales, para el dominio del eje) de
// `whiskerLow`/`whiskerHigh` (los bigotes) porque no son lo mismo: con un
// outlier, `max` es el outlier y el bigote superior se queda antes.
//
// La consistencia que muestra el KPI NO sale de acá: viene de `consistency.cv`
// de la API (design.md, no-goal de recalcular en el front). Esto es solo la
// geometría de la caja.
export function boxPlotStats(values, { k = 1.5 } = {}) {
  const sorted = (Array.isArray(values) ? values : []).map(finite).filter((n) => n !== null).sort((a, b) => a - b);
  if (!sorted.length) {
    return {
      count: 0, min: null, q1: null, median: null, q3: null, max: null, iqr: null,
      lowerFence: null, upperFence: null, whiskerLow: null, whiskerHigh: null, outliers: [],
    };
  }

  const q1 = quantile(sorted, 0.25);
  const median = quantile(sorted, 0.5);
  const q3 = quantile(sorted, 0.75);
  const iqr = round(q3 - q1);
  const mult = typeof k === 'number' && Number.isFinite(k) ? k : 1.5;
  const lowerFence = round(q1 - mult * iqr);
  const upperFence = round(q3 + mult * iqr);

  const inside = sorted.filter((n) => n >= lowerFence && n <= upperFence);
  const outliers = sorted.filter((n) => n < lowerFence || n > upperFence);

  return {
    count: sorted.length,
    min: round(sorted[0]),
    q1,
    median,
    q3,
    max: round(sorted[sorted.length - 1]),
    iqr,
    lowerFence,
    upperFence,
    whiskerLow: inside.length ? round(inside[0]) : q1,
    whiskerHigh: inside.length ? round(inside[inside.length - 1]) : q3,
    outliers: outliers.map(round),
  };
}

// Arco SVG entre dos ángulos. Ángulos en grados con la convención de pantalla
// (0° a la derecha, creciendo hacia abajo porque la Y del SVG crece hacia
// abajo): 180° es la izquierda, 270° es arriba, 360° es la derecha. El
// sweep-flag en 1 es lo que hace que 180° → 360° recorra la semicircunferencia
// de abajo, que es como se lee un gauge.
function arcPath(cx, cy, r, fromDeg, toDeg) {
  const rad = (deg) => (deg * Math.PI) / 180;
  const x0 = round(cx + r * Math.cos(rad(fromDeg)));
  const y0 = round(cy + r * Math.sin(rad(fromDeg)));
  const x1 = round(cx + r * Math.cos(rad(toDeg)));
  const y1 = round(cy + r * Math.sin(rad(toDeg)));
  const largeArc = Math.abs(toDeg - fromDeg) > 180 ? 1 : 0;
  return `M${x0} ${y0} A${r} ${r} 0 ${largeArc} 1 ${x1} ${y1}`;
}

// Gauge de semicircunferencia: cuánto se logró contra el objetivo.
//
// `ratio` es valor/objetivo, o null si falta cualquiera de los dos. Con ratio
// null no hay arco de progreso ni aguja: se dibuja solo la pista. Un objetivo
// de cero o negativo no es un objetivo, así que también cae en null en vez de
// dividir por cero.
//
// El arco se clampea a `maxRatio` (1,25 por default) y avisa con `clamped`, para
// que un 180 % de cumplimiento no se dibuje fuera del gauge ni se lea como un
// número mayor que el tope de la escala.
//
// El componente tiene que sumar `strokeWidth / 2` de padding alrededor: el arco
// se dibuja sobre la línea de la pista y se sale si no.
export function gaugeArc(value, target, { radius = 100, strokeWidth = 12, maxRatio = 1.25 } = {}) {
  const r = positiveOrZero(Number(radius));
  if (r <= 0) return null;
  const cx = r;
  const cy = r;
  const startAngle = 180;
  const sweep = 180;
  const top = finiteOrZero(maxRatio) > 0 ? finiteOrZero(maxRatio) : 1.25;

  const trackPath = arcPath(cx, cy, r, startAngle, startAngle + sweep);

  const v = finite(value);
  const t = finite(target);
  const usable = v !== null && t !== null && t > 0;
  if (!usable) {
    return {
      cx, cy, radius: r, strokeWidth, maxRatio: top,
      ratio: null, clamped: false,
      trackPath, progressPath: null, needleAngle: null,
    };
  }

  const raw = v / t;
  const clamped = raw > top || raw < 0;
  const ratio = clamp(raw, 0, top);
  const angle = round(startAngle + (ratio / top) * sweep);

  return {
    cx, cy, radius: r, strokeWidth, maxRatio: top,
    ratio: round(ratio), clamped,
    trackPath,
    progressPath: arcPath(cx, cy, r, startAngle, angle),
    needleAngle: round(angle),
  };
}

function clamp(n, min, max) {
  return Math.min(max, Math.max(min, n));
}