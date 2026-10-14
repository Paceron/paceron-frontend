// Los TRES casos de paleta de la pantalla de rendimiento, resueltos desde la
// tupla `(has_target, axis, target_speed_kph != null)` de la respuesta y NO
// desde el `kind` del ejercicio.
//
// Vive acá, y no en el componente, porque es una decisión de datos que el
// proyecto no cubre con tests de render: la cobertura sale de funciones puras en
// `utils/` (ver CLAUDE.md, sección "Testing"). Un `kind` mal clasificado en un
// JSX no fallaría nunca; acá hay un test por cada tupla del contrato.
//
// Por qué los tres y no dos: con `axis: "distance"` hay objetivo (`has_target`
// true) pero NO hay tiempo objetivo, así que la velocidad esperada no se puede
// derivar de la distancia sola — `target_speed_kph` llega `null` y un gauge
// "ritmo vs objetivo" ahí sería inventar un objetivo que no existe.

import { hasMetric } from './dashboard-format.js';

export const PALETTE_CASES = {
  withTarget: 'with_target',
  reducedTarget: 'reduced_target',
  withoutTarget: 'without_target',
};

// `axis` no decide el caso: `distance` y `time` se comportan igual cuando hay
// velocidad objetivo, y `distance_and_time` tampoco. Entra en la firma igual
// porque la tupla del contrato es de tres campos y porque el caso reducido
// necesita el eje para elegir su número principal (que es la otra mitad de la
// decisión, más abajo).
export function resolvePaletteCase({ hasTarget, axis, targetSpeedKph } = {}) {
  if (!hasTarget) return PALETTE_CASES.withoutTarget;
  if (!hasMetric(targetSpeedKph)) return PALETTE_CASES.reducedTarget;
  return PALETTE_CASES.withTarget;
}

function metric(id, label, value, unit) {
  return { id, label, value: hasMetric(value) ? value : null, unit: unit ?? null, available: hasMetric(value) };
}

// Número principal de cada caso. Es la pieza que más se nota cuando está mal:
// el spec pide ritmo en A completo, distancia en A reducido y mejor tiempo en
// B, con `liviano` como la excepción que muestra volumen en vez de ritmo.
//
// `liviano` es la excepción porque el tipo se define por VOLUMEN
// (utils/exercise-field-matrix.js, `showSpeed: false`): mostrar 7,2 km/h como
// número principal de un calentamiento de 10 minutos sería medirlo con una vara
// que el producto no usa para ese tipo.
export function resolvePrimaryMetric({
  hasTarget,
  axis,
  targetSpeedKph,
  kind,
  totals,
  units,
} = {}) {
  const paletteCase = resolvePaletteCase({ hasTarget, axis, targetSpeedKph });
  const t = totals ?? {};
  const u = units ?? {};

  if (paletteCase === PALETTE_CASES.withoutTarget) {
    // Sin objetivo no hay contra qué comparar: el mejor tiempo es el único
    // número que significa algo por sí mismo.
    return { ...metric('best_time_ms', 'Mejor tiempo', t.best_time_ms, u.best_time), case: paletteCase };
  }

  if (paletteCase === PALETTE_CASES.reducedTarget) {
    // A reducido: el número principal es la magnitud que el objetivo sí
    // define. En eje `distance` es la distancia; en eje `time` (elongacion sin
    // velocidad objetivo) es el tiempo.
    return axis === 'distance'
      ? { ...metric('distance_m', 'Distancia', t.distance_m, u.distance), case: paletteCase }
      : { ...metric('time_ms', 'Tiempo total', t.time_ms, u.time), case: paletteCase };
  }

  if (kind === 'liviano') {
    // Volumen: distancia si está cargada, si no tiempo. El que falte NO se
    // sustituye por el otro en el título — el label dice "Volumen" en los dos
    // casos y la unidad que se rotula sale del bloque `units` de la respuesta.
    return hasMetric(t.distance_m)
      ? { ...metric('distance_m', 'Volumen', t.distance_m, u.distance), case: paletteCase }
      : { ...metric('time_ms', 'Volumen', t.time_ms, u.time), case: paletteCase };
  }

  return { ...metric('achieved_speed_kph', 'Ritmo promedio', t.achieved_speed_kph, u.speed), case: paletteCase };
}

// Lectura de la respuesta cruda: el call site no repite el mapeo de
// `has_target` / `totals.target_speed_kph` en cada componente.
export function describePalette(data, kind) {
  const payload = data ?? {};
  const args = {
    hasTarget: payload.has_target,
    axis: payload.axis,
    targetSpeedKph: payload.totals?.target_speed_kph,
    kind,
    totals: payload.totals,
    units: payload.units,
  };
  return {
    case: resolvePaletteCase(args),
    primary: resolvePrimaryMetric(args),
    hasTarget: Boolean(payload.has_target),
    axis: payload.axis ?? null,
    hasPace: hasMetric(payload.totals?.target_speed_kph),
  };
}

// ¿Las piezas de ritmo se pintan? Es la pregunta que separa A completo de A
// reducido, y la que responde la tupla: sin velocidad objetivo no hay gauge ni
// "velocidad esperada". Vive acá para que palette-reduced-target.jsx y el resto
// de las piezas no tengan que reimplementar la condición.
export function showsPacePieces(data) {
  return describePalette(data).hasPace;
}

// La magnitud por la que se ordena el ranking de barras de cada paleta: la misma
// que es número principal del caso. En B el mejor valor es el MENOR (mejor
// tiempo) y por eso el orden es ascendente — con el orden por defecto el primero
// de la lista sería el peor.
export function resolveRankingMetric(paletteCase) {
  if (paletteCase === PALETTE_CASES.withoutTarget) {
    return { key: 'best_time_ms', unitKey: 'best_time', sort: 'asc' };
  }
  if (paletteCase === PALETTE_CASES.reducedTarget) {
    return { key: 'total_distance_m', unitKey: 'distance', sort: 'desc' };
  }
  return { key: 'mean_speed_kph', unitKey: 'speed', sort: 'desc' };
}

// Una fila de /comparisons → una fila de `bar-chart.jsx`. El `value` ausente se
// conserva como `null` en vez de convertirse en 0: el componente lo descarta de
// la lista, y un corredor sin ese dato no va al final de un ranking de ceros.
export function toRankingItems(series, metric) {
  return (Array.isArray(series) ? series : []).map((row) => ({
    id: row?.athlete_user_id ?? null,
    label: `${row?.name ?? ''} ${row?.surname ?? ''}`.trim(),
    value: hasMetric(row?.[metric.key]) ? row[metric.key] : null,
  }));
}
