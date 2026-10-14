import {
  DEFAULT_TOLERANCE,
  EMPTY_METRIC,
  KIND_LABELS,
  TOLERANCE_MAX,
  TOLERANCE_MIN,
  VERDICT_LABELS,
  formatDelta,
  formatKind,
  formatMetric,
  formatTimeQuality,
  formatVerdict,
  hasInsufficientData,
  hasMetric,
  isLegacyNote,
  resolveTolerance,
  verdictIcon,
} from '../utils/dashboard-format.js';

describe('formatMetric', () => {
  test('un null muestra un guion, no un cero (design.md D5)', () => {
    ['km/h', 'ms', 'm', '%', 'pp', undefined].forEach((unit) => {
      expect(formatMetric(null, unit)).toBe(EMPTY_METRIC);
      expect(formatMetric(null, unit)).not.toBe('0');
    });
    expect(EMPTY_METRIC).toBe('—');
  });

  test('undefined, vacío y no-finito también son guion', () => {
    expect(formatMetric(undefined, 'm')).toBe(EMPTY_METRIC);
    expect(formatMetric('', 'm')).toBe(EMPTY_METRIC);
    expect(formatMetric('   ', 'm')).toBe(EMPTY_METRIC);
    expect(formatMetric(NaN, 'm')).toBe(EMPTY_METRIC);
    expect(formatMetric(Infinity, 'm')).toBe(EMPTY_METRIC);
    expect(formatMetric(-Infinity, 'm')).toBe(EMPTY_METRIC);
    expect(formatMetric({}, '%')).toBe(EMPTY_METRIC);
  });

  test('un cero de verdad se muestra como cero', () => {
    expect(formatMetric(0, 'km/h')).toBe('0 km/h');
    expect(formatMetric(0, '%')).toBe('0 %');
  });

  test('las unidades del contrato se escriben en español', () => {
    expect(formatMetric(12.44, 'km/h')).toBe('12,4 km/h');
    expect(formatMetric(64.25, '%')).toBe('64,3 %');
    expect(formatMetric(-6.04, 'pp')).toBe('−6 pp');
    expect(formatMetric(5000, 'm')).toBe('5.000 m');
  });

  test('los milisegundos salen como reloj, sin sufijo', () => {
    expect(formatMetric(248000, 'ms')).toBe('04:08');
    expect(formatMetric(95000, 'ms')).toBe('01:35');
    expect(formatMetric(3725000, 'ms')).toBe('1:02:05');
    expect(formatMetric(0, 'ms')).toBe('00:00');
  });

  test('el negativo usa el signo tipográfico, no el guion', () => {
    expect(formatMetric(-1.5, 'km/h')).toBe('−1,5 km/h');
    expect(formatMetric(-1.5, 'km/h')).not.toContain('-');
  });

  test('una unidad que el backend agrega después no rompe nada', () => {
    expect(formatMetric(5, 'bpm')).toBe('5 bpm');
    expect(formatMetric(1.239, 'desnivel')).toBe('1,24 desnivel');
    expect(formatMetric(12, undefined)).toBe('12');
    expect(formatMetric(12, '')).toBe('12');
  });

  test('un string numérico se acepta, uno con coma no', () => {
    expect(formatMetric('12.44', 'km/h')).toBe('12,4 km/h');
    expect(formatMetric('12,5', 'km/h')).toBe(EMPTY_METRIC);
  });
});

describe('formatDelta', () => {
  test('el positivo lleva el signo explícito y el negativo también', () => {
    expect(formatDelta(6, 'pp')).toBe('+6 pp');
    expect(formatDelta(-6, 'pp')).toBe('−6 pp');
  });

  test('la diferencia de cumplimiento va en puntos porcentuales, no en porcentaje relativo', () => {
    // 64 % → 58 % es −6 pp, no un −9,4 % relativo (design.md D6).
    expect(formatDelta(58 - 64, 'pp')).toBe('−6 pp');
    expect(formatDelta(58 - 64, '%')).not.toBe(formatDelta(58 - 64, 'pp'));
  });

  test('un cero no lleva signo: no es ni mejora ni retroceso', () => {
    expect(formatDelta(0, 'pp')).toBe('0 pp');
  });

  test('un dato ausente no muestra ni el cero ni el signo', () => {
    expect(formatDelta(null, '%')).toBe(EMPTY_METRIC);
    expect(formatDelta(NaN, '%')).toBe(EMPTY_METRIC);
  });

  test('funciona con decimales', () => {
    expect(formatDelta(2.5, '%')).toBe('+2,5 %');
    expect(formatDelta(-0.4, 'km/h')).toBe('−0,4 km/h');
  });
});

describe('hasMetric', () => {
  test('distingue el cero real de la ausencia de dato', () => {
    expect(hasMetric(0)).toBe(true);
    expect(hasMetric(1)).toBe(true);
    expect(hasMetric('0')).toBe(true);
    expect(hasMetric(null)).toBe(false);
    expect(hasMetric(undefined)).toBe(false);
    expect(hasMetric('')).toBe(false);
    expect(hasMetric(NaN)).toBe(false);
    expect(hasMetric('hola')).toBe(false);
  });
});
describe('resolveTolerance', () => {
  test('sin valor, usa la default del backend', () => {
    expect(DEFAULT_TOLERANCE).toBe(0.05);
    [undefined, null, ''].forEach((value) => {
      expect(resolveTolerance(value)).toBe(0.05);
    });
  });

  test('una tolerancia dentro del rango se respeta tal cual', () => {
    expect(resolveTolerance(0.01)).toBe(0.01);
    expect(resolveTolerance(0.1)).toBe(0.1);
    expect(resolveTolerance(0.2)).toBe(0.2);
    expect(resolveTolerance('0.08')).toBe(0.08);
  });

  test('fuera del rango [0,01 – 0,20] vuelve a la default sin tirar', () => {
    // No hay control de UI para la tolerancia, así que un valor inválido
    // vendría de código: gastar un 400 del backend no le aporta nada a nadie.
    expect(resolveTolerance(0)).toBe(0.05);
    expect(resolveTolerance(0.009)).toBe(0.05);
    expect(resolveTolerance(0.21)).toBe(0.05);
    expect(resolveTolerance(5)).toBe(0.05);
    expect(resolveTolerance('mucho')).toBe(0.05);
    expect(resolveTolerance(NaN)).toBe(0.05);
  });

  test('las cotas coinciden con las del backend', () => {
    expect(TOLERANCE_MIN).toBe(0.01);
    expect(TOLERANCE_MAX).toBe(0.2);
  });
});

describe('enums del contrato traducidos para pantalla', () => {
  test('el veredicto se muestra traducido, no como el slug de la API', () => {
    expect(formatVerdict('improving')).toBe('Mejoró');
    expect(formatVerdict('stable')).toBe('Estable');
    expect(formatVerdict('regressing')).toBe('Retrocedió');
    Object.entries(VERDICT_LABELS).forEach(([slug, label]) => expect(formatVerdict(slug)).toBe(label));
  });

  test('un enum desconocido o ausente NO se muestra crudo', () => {
    // Un slug en pantalla no le dice nada a nadie, y un null tampoco: los dos
    // son "no hay veredicto".
    expect(formatVerdict('improvingg')).toBe('Sin veredicto');
    expect(formatVerdict(null)).toBe('Sin veredicto');
    expect(formatVerdict(undefined)).toBe('Sin veredicto');
    expect(formatVerdict('improvingg')).not.toContain('improving');
  });

  test('cada veredicto tiene su ícono: el color nunca es el único portador del significado', () => {
    expect(verdictIcon('improving')).not.toBe(verdictIcon('regressing'));
    expect(verdictIcon('improving')).not.toBe(verdictIcon('stable'));
    expect(verdictIcon('nope')).toBe('help-circle-outline');
  });

  test('la calidad del tiempo también se traduce', () => {
    expect(formatTimeQuality('alta')).toBe('Alta');
    expect(formatTimeQuality('degraded')).toBe('Degradada');
    expect(formatTimeQuality(undefined)).toBe('Sin dato');
  });

  test('los cinco tipos vigentes tienen etiqueta en español', () => {
    expect(Object.keys(KIND_LABELS).sort()).toEqual(
      ['elongacion', 'liviano', 'ritmo_continuo', 'velocidad_distancia', 'velocidad_tiempo'],
    );
    expect(formatKind('velocidad_distancia')).toBe('Velocidad en distancia');
    // Un tipo desconocido vuelve crudo, no undefined: es dato viejo del backend
    // y aunque no sepamos qué es, hay que poder mostrarlo.
    expect(formatKind('ritmo_antiguo')).toBe('ritmo_antiguo');
    expect(formatKind(null)).toBe(EMPTY_METRIC);
  });
});

describe('calidad de los datos', () => {
  test('insufficient_data ordena ocultar las tendencias', () => {
    expect(hasInsufficientData({ insufficient_data: true })).toBe(true);
    expect(hasInsufficientData({ insufficient_data: false })).toBe(false);
    expect(hasInsufficientData(null)).toBe(false);
  });

  test('legacy_sessions es una nota informativa, no un defecto', () => {
    expect(isLegacyNote({ legacy_sessions: 3 })).toBe(true);
    expect(isLegacyNote({ legacy_sessions: 0 })).toBe(false);
    expect(isLegacyNote(undefined)).toBe(false);
  });
});
