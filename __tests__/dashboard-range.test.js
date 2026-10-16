import {
  DISTANCE_MAX_DECIMALS,
  DISTANCE_SUGGESTIONS_KM,
  INVERTED_RANGE_ERROR,
  TIME_MAX_DECIMALS,
  TIME_SUGGESTIONS_MIN,
  isInvertedRange,
  kmToMeters,
  parseRangeInput,
  rangeFieldError,
  resolveDashboardRange,
} from '../utils/dashboard-range.js';

// El rango de la pantalla se escribe en km y minutos y se pide en metros y
// minutos enteros. Estos tests fijan las dos puntas de esa traducción: lo que
// acepta el campo (coma y punto, decimales, vacío, texto) y lo que sale en el
// request.

describe('dashboard range — los valores sugeridos', () => {
  test('las dos listas son las del contrato, en orden y sin repetidos', () => {
    expect(DISTANCE_SUGGESTIONS_KM).toEqual([1, 2, 3, 5, 7, 10, 15, 21, 42]);
    expect(TIME_SUGGESTIONS_MIN).toEqual([5, 10, 15, 20, 30, 45, 60, 90, 120, 180, 240, 360]);
    expect(new Set(DISTANCE_SUGGESTIONS_KM).size).toBe(DISTANCE_SUGGESTIONS_KM.length);
    expect(new Set(TIME_SUGGESTIONS_MIN).size).toBe(TIME_SUGGESTIONS_MIN.length);
  });

  test('240 y 360 minutos están: son 4 y 6 horas, y sin ellos el corredor de fondo no tiene atajo', () => {
    expect(TIME_SUGGESTIONS_MIN).toContain(240);
    expect(TIME_SUGGESTIONS_MIN).toContain(360);
  });
});

describe('dashboard range — parseo de lo que se escribe a mano', () => {
  test('coma y punto son el mismo número', () => {
    expect(parseRangeInput('3,5')).toBe(3.5);
    expect(parseRangeInput('3.5')).toBe(3.5);
    expect(parseRangeInput('0,1')).toBe(0.1);
  });

  test('vacío es "no hay filtro", no cero', () => {
    expect(parseRangeInput('')).toBeNull();
    expect(parseRangeInput('   ')).toBeNull();
    expect(parseRangeInput(null)).toBeNull();
    expect(parseRangeInput(undefined)).toBeNull();
    // El cero SÍ es un valor: filtrar por series de 0 km es una pregunta válida
    // aunque hoy nadie la haga.
    expect(parseRangeInput('0')).toBe(0);
  });

  test('texto no numérico devuelve NaN, para que el campo muestre error', () => {
    expect(Number.isNaN(parseRangeInput('abc'))).toBe(true);
    expect(Number.isNaN(parseRangeInput('3 km'))).toBe(true);
    expect(Number.isNaN(parseRangeInput('1.2.3'))).toBe(true);
    expect(Number.isNaN(parseRangeInput('1,2,3'))).toBe(true);
  });

  test('un número ya parseado pasa sin cambiar', () => {
    expect(parseRangeInput(21)).toBe(21);
    expect(parseRangeInput(21.5)).toBe(21.5);
  });
});

describe('dashboard range — conversión a la unidad del contrato', () => {
  test('km a metros enteros', () => {
    expect(kmToMeters(3.5)).toBe(3500);
    expect(kmToMeters(0.1)).toBe(100);
    expect(kmToMeters(21)).toBe(21000);
    expect(kmToMeters(0)).toBe(0);
    expect(kmToMeters('3,5')).toBe(3500);
  });

  test('un valor que no se puede expresar en metros enteros no se convierte', () => {
    expect(kmToMeters(3.5555)).toBeNull();
    expect(kmToMeters(-1)).toBeNull();
    expect(kmToMeters(NaN)).toBeNull();
    expect(kmToMeters(null)).toBeNull();
    expect(kmToMeters('')).toBeNull();
  });
});

describe('dashboard range — errores antes de mandar', () => {
  test('texto no numérico, negativo y decimales de más tienen su mensaje', () => {
    expect(rangeFieldError('abc')).toBe('Solo números');
    expect(rangeFieldError('-2')).toBe('No puede ser negativo');
    expect(rangeFieldError('4,5', { maxDecimals: TIME_MAX_DECIMALS })).toBe('Usá minutos enteros');
    expect(rangeFieldError('3,5555', { maxDecimals: DISTANCE_MAX_DECIMALS })).toBe('Usá hasta 3 decimales');
  });

  test('un valor válido no tiene error, y vacío tampoco', () => {
    expect(rangeFieldError('3,5', { maxDecimals: DISTANCE_MAX_DECIMALS })).toBeNull();
    expect(rangeFieldError('', { maxDecimals: DISTANCE_MAX_DECIMALS })).toBeNull();
    expect(rangeFieldError('30', { maxDecimals: TIME_MAX_DECIMALS })).toBeNull();
  });

  test('rango invertido: desde mayor que hasta', () => {
    expect(isInvertedRange('42', '5')).toBe(true);
    expect(isInvertedRange('5', '42')).toBe(false);
    expect(isInvertedRange('5', '5')).toBe(false);
    // Con un solo extremo no hay rango que pueda estar invertido.
    expect(isInvertedRange('42', '')).toBe(false);
    expect(isInvertedRange('', '5')).toBe(false);
    expect(isInvertedRange('abc', '5')).toBe(false);
  });
});

describe('dashboard range — lo que se aplica al request', () => {
  test('un valor escrito a mano que no está en la lista se aplica igual', () => {
    const range = resolveDashboardRange({ distanceFrom: '3,5', distanceTo: '21' });
    expect(range.distanceFromM).toBe(3500);
    expect(range.distanceToM).toBe(21000);
    expect(range.errors).toEqual({ distanceFrom: null, distanceTo: null, timeFrom: null, timeTo: null });
  });

  test('el tiempo viaja en minutos enteros', () => {
    const range = resolveDashboardRange({ timeFrom: '30', timeTo: '90' });
    expect(range.timeFromMin).toBe(30);
    expect(range.timeToMin).toBe(90);
  });

  test('un rango invertido NO se manda, y el error va en el campo del máximo', () => {
    const range = resolveDashboardRange({ distanceFrom: '42', distanceTo: '5' });
    expect(range.distanceFromM).toBeNull();
    expect(range.distanceToM).toBeNull();
    expect(range.errors.distanceFrom).toBeNull();
    expect(range.errors.distanceTo).toBe(INVERTED_RANGE_ERROR);

    const times = resolveDashboardRange({ timeFrom: '90', timeTo: '5' });
    expect(times.timeFromMin).toBeNull();
    expect(times.timeToMin).toBeNull();
    expect(times.errors.timeTo).toBe(INVERTED_RANGE_ERROR);
  });

  test('un rango invertido NO arrastra al otro: distancia y tiempo son independientes', () => {
    const range = resolveDashboardRange({ distanceFrom: '42', distanceTo: '5', timeFrom: '10', timeTo: '60' });
    expect(range.distanceFromM).toBeNull();
    expect(range.timeFromMin).toBe(10);
    expect(range.timeToMin).toBe(60);
  });

  test('un valor que no se puede interpretar no se manda, pero el resto del filtro sí', () => {
    const range = resolveDashboardRange({ distanceFrom: 'abc', distanceTo: '10' });
    expect(range.distanceFromM).toBeNull();
    expect(range.distanceToM).toBe(10000);
    expect(range.errors.distanceFrom).toBe('Solo números');
  });

  test('sin nada escrito no hay nada que mandar', () => {
    expect(resolveDashboardRange()).toEqual({
      distanceFromM: null,
      distanceToM: null,
      timeFromMin: null,
      timeToMin: null,
      errors: { distanceFrom: null, distanceTo: null, timeFrom: null, timeTo: null },
    });
  });
});