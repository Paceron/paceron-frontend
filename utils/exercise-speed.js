// Velocidad promedio de un ejercicio, en km/h.
//
// Las unidades son las del contrato con el backend: DISTANCIA en metros y TIEMPO
// en minutos (`minutes` int, `distance_m` int). No hay conversión intermedia
// porque la app nunca habla en otras unidades — `minutes` no son segundos, no es
// mm:ss.
//
// El resultado se redondea a 1 decimal porque `speed_kph` es `numeric(4,1)` en
// Postgres. Redondear acá y no en la UI hace que lo que el usuario ve sea
// exactamente lo que queda guardado.

const DECIMALS = 1;

// Distancia en metros + tiempo en minutos → km/h. Devuelve null cuando no es
// calculable (falta un dato, es cero, es negativo, o no es un número) — nunca 0
// inventado: el mismo criterio que `formatArs` en utils/currency.js, donde
// `Number(null)` da 0 y pasaba un `Number.isFinite` tranquilo.
export function calculateSpeedKph(distanceM, minutes) {
  if (!isUsableNumber(distanceM) || !isUsableNumber(minutes)) return null;
  if (minutes <= 0) return null;

  const kph = (distanceM / 1000) / (minutes / 60);
  if (!Number.isFinite(kph)) return null;

  return round(kph, DECIMALS);
}

// ¿El valor sirve como número para calcular? Filtra null/undefined (que coercion
// a 0), vacío, texto, NaN e Infinity. La distancia sí puede ser 0 (un elongación
// de 0 m no tiene sentido pero un "0" tipeado no debe romper) — lo que no puede
// es negativa; eso lo valida el validator, acá solo evita la matemática sin sentido.
function isUsableNumber(value) {
  if (value === null || value === undefined || value === '') return false;
  if (typeof value === 'boolean') return false;
  const n = Number(value);
  return Number.isFinite(n) && n >= 0;
}

function round(value, decimals) {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

// Formato para mostrar en el input: string sin ceros de más. `10` no `10.0`, pero
// `10.5` sí muestra el decimal — el input acepta texto, no número, así que
// convertir siempre a string con `toFixed` mostraría "10.0" mientras se tipea.
export function formatSpeedInput(kph) {
  if (kph === null || kph === undefined) return '';
  return String(kph);
}
