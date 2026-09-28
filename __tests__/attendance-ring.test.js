import { toRingGeometry } from '../utils/attendance-ring.js';

// Largo REALMENTE pintado por un `strokeDasharray: [dash, gap]` con un
// `strokeDashoffset` dado: el spec de SVG dice que el offset es "en qué punto
// del patrón se arranca", así que el punto del path a distancia `t` cae en el
// guion si `((t + offset) mod periodo) < dash`.
//
// Es la cuenta del comentario de utils/attendance-ring.js escrita en números, y
// es la que permite verificar la convención de signos sin depender de un render
// (ni de ver un arco en un device).
function paintedLength(dash, gap, offset) {
  const period = dash + gap;
  const start = ((offset % period) + period) % period;
  return start < dash ? dash - start : period - start;
}

// La geometría que devuelvo con los defaults (size 56, stroke 6) y los números
// que salen de cuenta, para que los tests siguientes se lean con los valores a
// la vista en vez de tenerlos que calcular.
const DEFAULT = toRingGeometry({ pct: 50 });
const DEFAULT_CIRCUMFERENCE = 2 * Math.PI * 25; // r = (56 − 6) / 2

describe('toRingGeometry — centro y radio', () => {
  test('el anillo queda centrado en el recuadro, con el trazo adentro', () => {
    const geometry = toRingGeometry({ pct: 50, size: 56, strokeWidth: 6 });

    expect(geometry.cx).toBe(28);
    expect(geometry.cy).toBe(28);
    // (56 − 6) / 2: se resta el ancho COMPLETO del trazo, no la mitad, porque
    // el trazo se centra sobre la línea de la circunferencia.
    expect(geometry.radius).toBe(25);
  });

  test('sin argumentos de tamaño usa los defaults del anillo de las tarjetas', () => {
    expect(DEFAULT.cx).toBe(28);
    expect(DEFAULT.radius).toBe(25);
    expect(DEFAULT.strokeDasharray).toBe(`${round2(DEFAULT_CIRCUMFERENCE)} ${round2(DEFAULT_CIRCUMFERENCE)}`);
  });

  test('la circunferencia del dasharray es 2πr, repetida (guion + hueco del mismo largo)', () => {
    const [dash, gap] = toRingGeometry({ pct: 0, size: 100, strokeWidth: 10 }).strokeDasharray.split(' ');

    expect(Number(dash)).toBeCloseTo(2 * Math.PI * 45, 2);
    expect(Number(gap)).toBe(Number(dash));
  });
});

describe('toRingGeometry — el arco según el porcentaje', () => {
  test('0 % no dibuja nada (el offset tapa toda la circunferencia)', () => {
    const geometry = toRingGeometry({ pct: 0, size: 56, strokeWidth: 6 });

    expect(geometry.clampPct).toBe(0);
    expect(geometry.strokeDashoffset).toBe(Number(geometry.strokeDasharray.split(' ')[0]));
  });

  test('50 % deja medio arco', () => {
    const geometry = toRingGeometry({ pct: 50, size: 56, strokeWidth: 6 });

    expect(geometry.clampPct).toBe(50);
    expect(geometry.strokeDashoffset).toBeCloseTo(geometry.strokeDasharray.split(' ')[0] / 2, 2);
  });

  test('100 % no deja offset (se ve el círculo entero)', () => {
    const geometry = toRingGeometry({ pct: 100, size: 56, strokeWidth: 6 });

    expect(geometry.clampPct).toBe(100);
    expect(geometry.strokeDashoffset).toBe(0);
  });

  test('un porcentaje con decimal no se redondea (33,3 % no es 33 %)', () => {
    expect(toRingGeometry({ pct: 33.3, size: 56, strokeWidth: 6 }).clampPct).toBe(33.3);
    expect(toRingGeometry({ pct: 66.7, size: 56, strokeWidth: 6 }).clampPct).toBe(66.7);
  });
});

// ── El >100 % que puede mandar el backend ──────────────────────────────────
// `attended` es el total de asistencias de la sesión SIN filtrar por roster, así
// que si alguien que ya no está en el grupo tiene asistencia cargada el
// cociente se pasa. `toAttendanceRate` no clampea (el util no inventa datos) y
// el clamp es de la capa de presentación: el anillo es una circunferencia y no
// tiene cómo dibujar más del 100 %.
describe('toRingGeometry — clamp', () => {
  test('más de 100 % se satura en un anillo completo', () => {
    const geometry = toRingGeometry({ pct: 125, size: 56, strokeWidth: 6 });

    expect(geometry.clampPct).toBe(100);
    expect(geometry.strokeDashoffset).toBe(0);
  });

  test('un negativo se satura en 0 (no hay asistencias negativas)', () => {
    const geometry = toRingGeometry({ pct: -30, size: 56, strokeWidth: 6 });

    expect(geometry.clampPct).toBe(0);
    expect(geometry.strokeDashoffset).toBe(Number(geometry.strokeDasharray.split(' ')[0]));
  });

  test('Infinity y los valores absurdos también quedan dentro del rango', () => {
    expect(toRingGeometry({ pct: Infinity }).clampPct).toBe(0);
    expect(toRingGeometry({ pct: -Infinity }).clampPct).toBe(0);
  });
});

describe('toRingGeometry — sin dato (null / NaN / vacío)', () => {
  // La geometría tiene que ser un número pase lo que pase: un
  // `strokeDashoffset` NaN hace que react-native-svg no dibuje el arco, sin
  // error. Que caiga en 0 NO significa "0 %": la tarjeta usa otro texto para el
  // dato faltante y directamente no dibuja el arco de progreso.
  test.each([
    ['null', null],
    ['undefined', undefined],
    ['NaN', NaN],
    ["''", ''],
    ["'   '", '   '],
    ["'abc'", 'abc'],
    ['{}', {}],
  ])('%s se dibuja como piso, sin NaN en ningún campo', (_label, pct) => {
    const geometry = toRingGeometry({ pct, size: 56, strokeWidth: 6 });

    expect(geometry.clampPct).toBe(0);
    expect(Number.isNaN(geometry.strokeDashoffset)).toBe(false);
    expect(Number.isNaN(geometry.radius)).toBe(false);
    expect(Number.isNaN(geometry.cx)).toBe(false);
  });

  test('sin argumentos no rompe (todo undefined)', () => {
    const geometry = toRingGeometry();

    expect(geometry).toEqual({
      cx: 28,
      cy: 28,
      radius: 25,
      strokeDasharray: '157.08 157.08',
      strokeDashoffset: 157.08,
      clampPct: 0,
    });
  });
});

describe('toRingGeometry — tamaños degenerados', () => {
  test('size 0 o negativo: radio 0, no radio negativo', () => {
    expect(toRingGeometry({ pct: 50, size: 0, strokeWidth: 6 }).radius).toBe(0);
    expect(toRingGeometry({ pct: 50, size: -40, strokeWidth: 6 }).radius).toBe(0);
  });

  test('trazo 0 o negativo: el radio es la mitad del recuadro, sin romperse', () => {
    expect(toRingGeometry({ pct: 50, size: 56, strokeWidth: 0 }).radius).toBe(28);
    expect(toRingGeometry({ pct: 50, size: 56, strokeWidth: -8 }).radius).toBe(28);
    expect(toRingGeometry({ pct: 50, size: 56, strokeWidth: NaN }).radius).toBe(28);
  });

  test('un trazo más grueso que el recuadro deja radio 0 en vez de NaN', () => {
    // (56 − 60) / 2 daría −2: un radio negativo rompe la circunferencia y el
    // dasharray entero. Acá el radio satura en 0 y el componente no dibuja el
    // arco (un dasharray "0 0" lo interpreta SVG como trazo continuo).
    const geometry = toRingGeometry({ pct: 75, size: 56, strokeWidth: 60 });

    expect(geometry.radius).toBe(0);
    expect(geometry.strokeDasharray).toBe('0 0');
    expect(geometry.strokeDashoffset).toBe(0);
  });

  test('ningún tamaño degenerado produce NaN en el dasharray (que es un string)', () => {
    const cases = [
      { pct: 50, size: 0, strokeWidth: 0 },
      { pct: 50, size: -1, strokeWidth: -1 },
      { pct: 50, size: NaN, strokeWidth: NaN },
      { pct: 50, size: null, strokeWidth: null },
      { pct: 50, size: 'x', strokeWidth: 'y' },
    ];

    cases.forEach((input) => {
      const geometry = toRingGeometry(input);
      expect(geometry.strokeDasharray).toMatch(/^\d+(\.\d+)? \d+(\.\d+)?$/);
      expect(Number.isNaN(geometry.strokeDashoffset)).toBe(false);
      expect(Number.isFinite(geometry.cx)).toBe(true);
    });
  });
});

describe('toRingGeometry — convención de signos de strokeDashoffset', () => {
  // El contrato que el componente necesita de verdad: el largo pintado tiene
  // que ser C · f, con f = clampPct / 100, para C = la circunferencia del
  // dasharray. Es lo que define que el arco CREZCA desde su arranque.
  //
  // Con offset POSITIVO = C·(1 − f) esto se cumple para cualquier f; con offset
  // negativo (C·(f − 1)) el arco se vería al revés —0 % pintado y 100 % vacío—,
  // que es justo el error que este test existe para que no vuelva.
  test('el largo pintado es C · clampPct/100, y el offset es positivo', () => {
    [0, 10, 25, 33.3, 50, 66.7, 75, 90, 100].forEach((pct) => {
      const geometry = toRingGeometry({ pct, size: 56, strokeWidth: 6 });
      const [dash, gap] = geometry.strokeDasharray.split(' ').map(Number);

      expect(geometry.strokeDashoffset).toBeGreaterThanOrEqual(0);
      expect(paintedLength(dash, gap, geometry.strokeDashoffset)).toBeCloseTo(dash * (pct / 100), 1);
    });
  });

  test('el offset decrece monótonamente de C a 0 mientras sube el porcentaje', () => {
    const offsets = [0, 25, 50, 75, 100].map(
      (pct) => toRingGeometry({ pct, size: 56, strokeWidth: 6 }).strokeDashoffset,
    );

    for (let index = 1; index < offsets.length; index += 1) {
      expect(offsets[index]).toBeLessThan(offsets[index - 1]);
    }
  });
});

function round2(value) {
  return Math.round(value * 100) / 100;
}
