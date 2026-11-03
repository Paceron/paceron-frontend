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

// Lo pendiente de un mes (cuotas sin pagar que vencen en él), en bruto o en
// neto. El backend ya lo trae calculado en los dos modos.
export function pendingFor(entry, mode) {
  return (mode === 'net' ? entry?.pendingNetAmount : entry?.pendingAmount) ?? 0;
}

// Puntos del gráfico mensual en el modo elegido: lo cobrado y lo pendiente.
export function toChartPoints(monthly, mode) {
  return (monthly ?? []).map((m) => ({ month: m.month, ...amountFor(m, mode), pending: pendingFor(m, mode) }));
}

// "1 cuota" / "3 cuotas".
export function formatInstallmentCount(count) {
  const n = count ?? 0;
  return `${n} ${n === 1 ? 'cuota' : 'cuotas'}`;
}

const joinHint = (...parts) => parts.filter(Boolean).join(' · ');

// Los tiles del dashboard muestran el monto como dato principal y la cantidad
// de cuotas como aclaración (pedido del tutor, 2026-11-03).
//
// Tile "Cobrado en <mes>". Después de las cuotas, en bruto va el neto; en neto,
// el bruto o por qué el neto está incompleto.
export function monthTileContent(current, mode) {
  const count = formatInstallmentCount(current?.approvedCount);
  if (mode !== 'net') return { value: formatArs(current?.grossAmount ?? 0), hint: joinHint(count, formatNetLabel(current ?? {})) };
  const { value, partial, missing } = amountFor(current, 'net');
  if (missing) return { value: '—', hint: joinHint(count, 'Sin datos de neto') };
  if (!current?.approvedCount) return { value: formatArs(0), hint: count };
  if (partial) return { value: formatArs(value), hint: joinHint(count, `Neto parcial (${current.netKnownCount} de ${current.approvedCount})`) };
  return { value: formatArs(value), hint: joinHint(count, `Bruto ${formatArs(current.grossAmount)}`) };
}

// Tile "vs <mes anterior>": la diferencia en pesos, y abajo el porcentaje (si
// el mes anterior tuvo cobros) y las cuotas de cada mes. `direction` elige el
// ícono.
export function monthOverMonthTileContent(current, previous, mode = 'gross') {
  const mom = computeMonthOverMonth(current, previous, mode);
  if (mom.reason === 'no-net') return { value: '—', hint: 'Sin datos de neto', direction: 'none' };
  const cur = amountFor(current, mode).value ?? 0;
  const prev = amountFor(previous, mode).value ?? 0;
  if (!cur && !prev) return { value: '—', hint: 'Sin cobros para comparar', direction: 'none' };
  const delta = Math.round((cur - prev) * 100) / 100;
  const direction = delta > 0 ? 'up' : delta < 0 ? 'down' : 'flat';
  const value = delta === 0 ? 'Igual' : `${delta > 0 ? '+' : '-'}${formatArs(Math.abs(delta))}`;
  const pct = mom.pct !== null && delta !== 0 ? formatMonthOverMonth(mom) : '';
  const counts = `${formatInstallmentCount(current?.approvedCount)} vs ${previous?.approvedCount ?? 0}`;
  return { value, hint: joinHint(pct, counts), direction };
}

// Tiles "Cuotas pendientes" / "Cuotas rechazadas" (`group` 'pending' |
// 'rejected'): el monto de esas cuotas en el modo elegido y cuántas son.
export function statusTileContent(summary, group, mode) {
  const prefix = group === 'rejected' ? 'rejected' : 'pending';
  const amount = mode === 'net' ? summary?.[`${prefix}NetAmount`] : summary?.[`${prefix}Amount`];
  return { value: formatArs(amount ?? 0), hint: formatInstallmentCount(summary?.[`${prefix}Count`]) };
}

// Detalle de un mes para el tooltip del gráfico: lo cobrado con sus cuotas, la
// comisión, el neto y lo pendiente. El neto y la comisión solo se muestran si
// el neto se conoce; nunca se estiman.
export function monthTooltipContent(entry, mode) {
  const key = String(entry?.month ?? '');
  const name = formatMonthLong(key);
  const title = name ? `${name.charAt(0).toUpperCase()}${name.slice(1)} ${key.slice(0, 4)}` : '';
  const net = amountFor(entry, 'net');
  const gross = entry?.grossAmount ?? 0;
  const rows = [{ key: 'gross', label: 'Cobrado', value: formatArs(gross), detail: formatInstallmentCount(entry?.approvedCount) }];
  if (net.missing) {
    rows.push({ key: 'net', label: 'Neto', value: 's/d' });
  } else if (entry?.approvedCount) {
    rows.push({ key: 'fee', label: 'Comisión', value: formatArs(Math.round((gross - net.value) * 100) / 100), detail: net.partial ? 'parcial' : '' });
    rows.push({ key: 'net', label: 'Neto', value: formatArs(net.value), detail: net.partial ? `${entry.netKnownCount} de ${entry.approvedCount}` : '' });
  }
  if (entry?.pendingCount) {
    rows.push({ key: 'pending', label: mode === 'net' ? 'Pendiente (neto)' : 'Pendiente', value: formatArs(pendingFor(entry, mode)), detail: formatInstallmentCount(entry.pendingCount) });
  }
  return { title, rows };
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

// Vencimiento como DD/MM/AAAA en hora argentina: el backend lo manda en UTC y
// corta los días en Argentina, así que un vencimiento del 6/11 a las 23:37 llega
// como 7/11 02:37Z. Con la zona del dispositivo se vería el día equivocado.
export function formatDueDate(iso) {
  if (!iso) return '';
  const d = new Date(new Date(iso).getTime() - 3 * 60 * 60 * 1000);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n) => String(n).padStart(2, '0');
  return `${pad(d.getUTCDate())}/${pad(d.getUTCMonth() + 1)}/${d.getUTCFullYear()}`;
}

// "comisión 5%" (o "comisión 2,5%"). Sin porcentaje no hay texto.
export function formatFeeLabel(feePercent) {
  if (feePercent === null || feePercent === undefined) return '';
  return `comisión ${String(Math.round(feePercent * 100) / 100).replace('.', ',')}%`;
}

// "vencida" o "3 cuotas vencidas" para la próxima cuota de un equipo o tier.
export function overdueLabel({ overdue, overdueCount }) {
  if (!overdue) return '';
  return overdueCount > 1 ? `${overdueCount} cuotas vencidas` : 'vencida';
}
