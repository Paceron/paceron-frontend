// Geometría del anillo de progreso de la tarjeta de % de asistencias (D6).
//
// Puro a propósito —sin React ni react-native-svg— por el mismo motivo que
// utils/trajectory.js: el componente solo pega los números que salen de acá, y
// lo que puede estar mal (el clamp, la circunferencia, el signo del offset)
// queda verificado con Jest en vez de a ojo en un device.
//
// ── Cómo se dibuja un arco en un <Circle> de SVG ────────────────────────────
//
// El trazo no se pinta continuo: avanza a lo largo del path según el patrón de
// `strokeDasharray` (guion, hueco, guion, …) y `strokeDashoffset` dice en qué
// punto de ese patrón se arranca. Con el patrón `[C, C]` —guion de toda la
// circunferencia y hueco de toda la circunferencia, que se repite cada 2C— el
// punto del path que está a distancia `t` cae dentro del guion si
// `((t + offset) mod 2C) < C`.
//
// Con `offset = C · (1 − f)`, POSITIVO y tal cual:
//   - f = 0   → offset = C  → `(0 + C) mod 2C = C`, que NO es < C → no se ve nada.
//   - f = 1   → offset = 0  → `0 < C` → se ve toda la circunferencia.
//   - f = 0,5 → offset = C/2 → visible para `t < C/2` → medio arco, arrancando
//     en el punto 0 del path.
//
// El signo es lo que hace que el arco CREZCA desde el arranque en vez de
// encogerse: con offset negativo el patrón arrancaría más adelante y el 0 % se
// vería completo con el 100 % invisible. Crecer-from-start es la convención
// estándar (la misma cuenta de react-native-circular-progress y de los
// tutoriales de SVG) y es la que permite girar el círculo −90° para que el arco
// arranque a las 12 en punto.
//
// El `dasharray` se devuelve como string ("C C"), que es la forma que aceptan
// igual las tres plataformas de react-native-svg; y el `offset` va redondeado a
// dos decimales junto con la circunferencia para que los dos sean consistentes
// entre sí (el patrón se arma con el mismo C que el offset descuenta).

const DEFAULT_SIZE = 56;
const DEFAULT_STROKE_WIDTH = 6;

const round2 = (value) => Math.round(value * 100) / 100;

// Number(null) y Number('') dan 0, que es finito: sin este descarte explícito
// "no hay dato" se convertiría en un 0 — el mismo bug que documentan
// utils/currency.js y utils/attendance-payload.js.
const toFinite = (value) => {
  if (value === null || value === undefined || String(value).trim() === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

// Porcentaje a dibujar, en [0, 100].
//
// El clamp vive ACÁ y no en `toAttendanceRate` (utils/attendance-payload.js) a
// propósito: el util no inventa datos, y el backend puede mandar más de 100
// (`attended` es el total de asistencias de la sesión sin filtrar por roster, así
// que alguien que ya no está en el grupo hace pasar el cociente). Un anillo es
// una circunferencia: no tiene cómo representar 125 %, y el SVG tampoco lo
// dejaría — `dasharray` mayor que la circunferencia no se画出. Acá se satura
// en 100 y el componente muestra el número REAL al lado, que es donde el
// entrenador se entera de la anomalía.
//
// `null`/NaN/'' caen en 0 para que la geometría sea siempre un número (un
// `strokeDashoffset` NaN hace que react-native-svg no dibuje el arco, y
// `Number.isFinite` no es un guard que se pueda activar desde JSX). El 0 de acá
// NO significa "0 %": la tarjeta distingue el dato faltante con otro texto, y
// además en ese caso ni siquiera dibuja el arco de progreso.
const toClampPct = (pct) => {
  const parsed = toFinite(pct);
  if (parsed === null) return 0;
  return Math.min(100, Math.max(0, parsed));
};

// Tamaño del lado del recuadro y ancho del trazo del anillo.
//
// Nada de esto se tira: un `size` o un `strokeWidth` degenerado (0, negativo,
// NaN) devolviendo NaN rompería el `strokeDasharray` entero —que es un string—
// y el arco desaparecería sin error visible, que es peor que no dibujar. Se
// saturan en 0 y el radio se acota abajo en 0: el componente no dibuja el arco
// cuando `radius` es 0 (un dasharray de ceros lo interpreta SVG como trazo
// continuo, así que el arco de progreso no se puede dejar pasar por ahí).
export function toRingGeometry({ pct, size = DEFAULT_SIZE, strokeWidth = DEFAULT_STROKE_WIDTH } = {}) {
  const safeSize = Math.max(0, toFinite(size) ?? 0);
  const safeStrokeWidth = Math.max(0, toFinite(strokeWidth) ?? 0);
  const cx = round2(safeSize / 2);
  const cy = cx;

  // El trazo se pinta centrado sobre la línea de la circunferencia, así que
  // para que el anillo entre entero en el recuadro hay que restar el ancho
  // COMPLETO del trazo: restando la mitad, la mitad exterior se salía del
  // `size` y el anillo se recortaba en los bordes.
  const radius = Math.max(0, round2((safeSize - safeStrokeWidth) / 2));
  const circumference = round2(2 * Math.PI * radius);
  const clampPct = toClampPct(pct);

  return {
    cx,
    cy,
    radius,
    strokeDasharray: `${circumference} ${circumference}`,
    strokeDashoffset: round2(circumference * (1 - clampPct / 100)),
    clampPct,
  };
}
