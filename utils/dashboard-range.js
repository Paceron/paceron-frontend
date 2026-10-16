// Los cuatro filtros de rango del dashboard (distancia y tiempo, desde y hasta):
// qué valores sugiere la pantalla, cómo se parsea lo que el usuario escribe a
// mano y cuándo se avisa que el rango está invertido.
//
// Dos decisiones que conviene que queden en un solo lugar:
//
// - **La pantalla habla km y minutos; el contrato habla metros y minutos.** La
//   conversión ocurre al serializar (`services/dashboard.js`, con `kmToMeters`)
//   y nunca en el valor que se muestra: el usuario piensa en km, y un filtro que
//   dice "3500" en vez de "3,5" no lo reconoce como el número que escribió.
// - **El backend exige enteros no negativos** para los cuatro parámetros
//   (`distance_from_m`, `distance_to_m`, `time_from_min`, `time_to_min`). Un
//   decimal que no se puede expresar como metro entero, o un negativo, no es un
//   dato que la pantalla pueda mostrar como filtrando: se avisa acá en vez de
//   gastar un 400 en algo que el usuario sí puede corregir.

// Los valores frecuentes. NO son un `select` cerrado: son el atajo para los
// números que casi siempre se filtran, y el campo acepta cualquier otro
// escrito a mano (3,5 km no está en la lista y hay que poder filtrar por eso).
// 240 y 360 no son relleno: son 4 y 6 horas, y una lista que corta en 180 deja
// al corredor de fondo sin una opción a un click.
export const DISTANCE_SUGGESTIONS_KM = [1, 2, 3, 5, 7, 10, 15, 21, 42];
export const TIME_SUGGESTIONS_MIN = [5, 10, 15, 20, 30, 45, 60, 90, 120, 180, 240, 360];

// Tres decimales de km son un metro entero: es la precisión máxima que el
// contrato puede representar. Los minutos van enteros, porque el parámetro es
// `time_from_min` y no hay medio minuto en la API.
export const DISTANCE_MAX_DECIMALS = 3;
export const TIME_MAX_DECIMALS = 0;

const NUMERIC_INPUT = /^-?\d+(?:[.,]\d+)?$/;

// Texto escrito → número. Tres salidas distintas y las tres importan:
// `null` ante vacío (el filtro no está puesto), `NaN` ante texto no numérico (el
// campo muestra error) y el número en el resto de los casos.
//
// Se acepta la coma decimal además del punto: el teclado de es-AR y el usuario
// escriben "3,5", y un `Number('3,5')` da `NaN` — sin esto, el filtro funciona en
// la web (donde se tipea con punto) y se rompe en mobile.
export function parseRangeInput(text) {
  if (text === null || text === undefined) return null;
  const raw = String(text).trim();
  if (raw === '') return null;
  if (!NUMERIC_INPUT.test(raw)) return NaN;
  const value = Number(raw.replace(',', '.'));
  return Number.isFinite(value) ? value : NaN;
}

// Qué está mal con lo escrito, o `null` si el valor sirve. Vive acá para que los
// cuatro campos no repitan la misma validación en el JSX.
export function rangeFieldError(text, { maxDecimals = null } = {}) {
  const value = parseRangeInput(text);
  if (value === null) return null;
  if (Number.isNaN(value)) return 'Solo números';
  if (value < 0) return 'No puede ser negativo';
  if (maxDecimals === 0 && !Number.isInteger(value)) return 'Usá minutos enteros';
  if (maxDecimals > 0 && decimalsOf(value) > maxDecimals) return `Usá hasta ${maxDecimals} decimales`;
  return null;
}

// El mensaje va en el campo del MÁXIMO: es el que se está leyendo cuando se ve
// que el rango no cierra, y el error va pegado al valor que hay que tocar.
export const INVERTED_RANGE_ERROR = 'No puede ser menor que el mínimo';

// ¿El rango está al revés? Un rango invertido nunca matchea, así que el backend
// lo rechaza con 400: la pantalla lo avisa antes de mandar (spec, rangos).
export function isInvertedRange(from, to) {
  const lower = parseRangeInput(from);
  const upper = parseRangeInput(to);
  if (lower === null || upper === null) return false;
  if (Number.isNaN(lower) || Number.isNaN(upper)) return false;
  return lower > upper;
}

// km → metros enteros del contrato. `null` si el valor no se puede expresar:
// no es número, es negativo o necesita más de tres decimales.
export function kmToMeters(km) {
  const value = typeof km === 'string' ? parseRangeInput(km) : km;
  if (value === null || !Number.isFinite(value) || value < 0) return null;
  const meters = value * 1000;
  const rounded = Math.round(meters);
  // Tolerancia y no igualdad: `0.1 * 1000` da 100.00000000000001 en IEEE-754, y
  // sin ella el filtro de 100 m se rechazaría a sí mismo.
  return Math.abs(meters - rounded) < 1e-9 ? rounded : null;
}

// Un solo lugar decide qué viaja al request y qué se muestra como error. Los
// cuatro valores salen YA en la unidad del contrato (metros y minutos): la
// conversión ocurre acá, en el borde entre lo que escribió la persona y lo que
// se pide, y nunca en el valor mostrado.
//
// Lo que NO se aplica: un campo escrito a mano que no se puede interpretar, y un
// rango invertido. En los dos casos se manda la request sin ese filtro en vez de
// mandarlo y dejar que el backend responda 400 — la pantalla tiene que poder
// corregirlo sin entrar al estado de "request inválida", que es un estado de
// error y no un formulario con un error.
export function resolveDashboardRange({ distanceFrom, distanceTo, timeFrom, timeTo } = {}) {
  const distanceInverted = isInvertedRange(distanceFrom, distanceTo);
  const timeInverted = isInvertedRange(timeFrom, timeTo);
  const kilometers = (text) => (rangeFieldError(text, { maxDecimals: DISTANCE_MAX_DECIMALS }) ? null : kmToMeters(text));
  const minutes = (text) => (rangeFieldError(text, { maxDecimals: TIME_MAX_DECIMALS }) ? null : parseRangeInput(text));

  return {
    distanceFromM: distanceInverted ? null : kilometers(distanceFrom),
    distanceToM: distanceInverted ? null : kilometers(distanceTo),
    timeFromMin: timeInverted ? null : minutes(timeFrom),
    timeToMin: timeInverted ? null : minutes(timeTo),
    errors: {
      distanceFrom: rangeFieldError(distanceFrom, { maxDecimals: DISTANCE_MAX_DECIMALS }),
      distanceTo: distanceInverted
        ? INVERTED_RANGE_ERROR
        : rangeFieldError(distanceTo, { maxDecimals: DISTANCE_MAX_DECIMALS }),
      timeFrom: rangeFieldError(timeFrom, { maxDecimals: TIME_MAX_DECIMALS }),
      timeTo: timeInverted ? INVERTED_RANGE_ERROR : rangeFieldError(timeTo, { maxDecimals: TIME_MAX_DECIMALS }),
    },
  };
}

// Decimales reales del número, sin los ceros de `Number(3.50)`. Se separa el
// entero de la parte fraccionaria en el string de la entrada normalizada en
// coma: `3.500` cuenta como 3 decimales, no como 3 enteros.
function decimalsOf(value) {
  const text = String(value);
  if (!text.includes('.')) return 0;
  return text.length - text.indexOf('.') - 1;
}