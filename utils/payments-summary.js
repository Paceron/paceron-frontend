import { formatArs } from './currency.js';

// Lógica pura del resumen de cobros (tarjeta del perfil y dashboard). Los meses
// llegan como 'YYYY-MM' ya cortados en hora argentina por el backend.

const MONTHS_LONG = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

function monthNumber(key) {
  const month = Number(String(key ?? '').split('-')[1]);
  return month >= 1 && month <= 12 ? month : null;
}

export function formatMonthLong(key) {
  const m = monthNumber(key);
  return m ? MONTHS_LONG[m - 1] : '';
}

export function formatMonthShort(key) {
  return formatMonthLong(key).slice(0, 3);
}

// `monthly` viene ordenado y el último es el mes actual.
export function selectCurrentAndPrevious(monthly) {
  const list = monthly ?? [];
  return {
    current: list[list.length - 1] ?? null,
    previous: list[list.length - 2] ?? null,
  };
}

// Variación contra el mes anterior, en bruto o en neto. Sin neto en alguno de
// los dos meses no se compara (reason 'no-net'), y sin cobros el mes anterior no
// hay porcentaje posible (reason 'no-previous').
export function computeMonthOverMonth(current, previous, mode = 'gross') {
  const a = amountFor(current, mode);
  const b = amountFor(previous, mode);
  if (a.missing || b.missing) return { pct: null, direction: 'none', reason: 'no-net' };
  const cur = a.value;
  const prev = b.value;
  if (prev === 0) return { pct: null, direction: 'none', reason: 'no-previous' };
  const pct = Math.round(((cur - prev) / prev) * 100);
  const direction = pct > 0 ? 'up' : pct < 0 ? 'down' : 'flat';
  return { pct, direction };
}

export function formatMonthOverMonth({ pct, direction }) {
  // Un guion y no un texto: en el tile de 2x2 de mobile un texto largo parte
  // en dos renglones con el tamaño del número. La aclaración va en el hint.
  if (direction === 'none') return '—';
  if (direction === 'flat') return 'Igual';
  return `${pct > 0 ? '+' : ''}${pct}%`;
}

// El neto solo existe cuando Mercado Pago lo informó; nunca se estima.
export function formatNetLabel({ netAmount, netKnownCount, approvedCount }) {
  if (!approvedCount) return '';
  if (!netKnownCount || netAmount === null || netAmount === undefined) return 'Neto no disponible';
  const net = formatArs(netAmount);
  if (netKnownCount < approvedCount) return `Neto parcial ${net} (${netKnownCount} de ${approvedCount})`;
  return `Neto ${net}`;
}

// Monto de un mes o de un equipo según el modo del dashboard ('gross' | 'net').
// En neto nunca se estima: sin neto informado el valor es null (missing), y si
// solo algunos cobros lo trajeron queda marcado como parcial. Un período sin
// cobros aprobados vale 0 también en neto: no es un dato que falte.
export function amountFor(entry, mode) {
  if (mode !== 'net') return { value: entry?.grossAmount ?? 0, partial: false, missing: false };
  const approved = entry?.approvedCount ?? 0;
  if (!approved) return { value: 0, partial: false, missing: false };
  const known = entry?.netKnownCount ?? 0;
  if (!known || entry?.netAmount === null || entry?.netAmount === undefined) return { value: null, partial: false, missing: true };
  return { value: entry.netAmount, partial: known < approved, missing: false };
}

// Puntos del gráfico mensual en el modo elegido.
export function toChartPoints(monthly, mode) {
  return (monthly ?? []).map((m) => ({ month: m.month, ...amountFor(m, mode) }));
}

// Valor y aclaración del tile "Cobrado en <mes>". En bruto la aclaración es el
// neto (como antes); en neto, el bruto o por qué el neto está incompleto.
export function monthTileContent(current, mode) {
  if (mode !== 'net') return { value: formatArs(current?.grossAmount ?? 0), hint: formatNetLabel(current ?? {}) };
  const { value, partial, missing } = amountFor(current, 'net');
  if (missing) return { value: '—', hint: 'Sin datos de neto' };
  if (!current?.approvedCount) return { value: formatArs(0), hint: '' };
  if (partial) return { value: formatArs(value), hint: `Neto parcial (${current.netKnownCount} de ${current.approvedCount})` };
  return { value: formatArs(value), hint: `Bruto ${formatArs(current.grossAmount)}` };
}

// 'YYYY-MM' corrido `delta` meses (negativo = hacia atrás).
export function shiftMonth(key, delta) {
  const [y, m] = String(key).split('-').map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

// "abr – sep 2026", o "dic 2025 – may 2026" si la ventana cruza de año.
export function windowRange(monthly) {
  const list = monthly ?? [];
  if (!list.length) return '';
  const first = list[0].month;
  const last = list[list.length - 1].month;
  const year = (key) => String(key).slice(0, 4);
  const start = year(first) === year(last) ? formatMonthShort(first) : `${formatMonthShort(first)} ${year(first)}`;
  return `${start} – ${formatMonthShort(last)} ${year(last)}`;
}

// Se puede ir hacia atrás mientras la ventana empiece después del primer mes
// con cobros. Sin cobros no hay nada que ver atrás.
export function canGoBack(monthly, earliestMonth) {
  const first = (monthly ?? [])[0]?.month;
  if (!first || !earliestMonth) return false;
  return first > earliestMonth;
}

// True si en toda la ventana no hubo ni un cobro ni un intento pendiente o
// rechazado: la tarjeta muestra el estado vacío.
export function isSummaryEmpty(summary) {
  if (!summary) return true;
  const anyGross = (summary.monthly ?? []).some((m) => m.grossAmount > 0);
  return !anyGross && !summary.pendingCount && !summary.rejectedCount && !(summary.byTeam ?? []).length;
}
