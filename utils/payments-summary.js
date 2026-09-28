import { formatARS } from './currency.js';

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

// Variación del bruto contra el mes anterior. Sin cobros el mes anterior no hay
// porcentaje posible: direction 'none'.
export function computeMonthOverMonth(current, previous) {
  const cur = current?.grossAmount ?? 0;
  const prev = previous?.grossAmount ?? 0;
  if (prev === 0) return { pct: null, direction: 'none' };
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
  const net = formatARS(netAmount);
  if (netKnownCount < approvedCount) return `Neto parcial ${net} (${netKnownCount} de ${approvedCount})`;
  return `Neto ${net}`;
}

// True si en toda la ventana no hubo ni un cobro ni un intento pendiente o
// rechazado: la tarjeta muestra el estado vacío.
export function isSummaryEmpty(summary) {
  if (!summary) return true;
  const anyGross = (summary.monthly ?? []).some((m) => m.grossAmount > 0);
  return !anyGross && !summary.pendingCount && !summary.rejectedCount && !(summary.byTeam ?? []).length;
}
