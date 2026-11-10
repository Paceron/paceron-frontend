// Simula los endpoints del historial de pagos para EXPO_PUBLIC_USE_MOCKS=true.
//
// Los datos se generan relativos a un "hoy" inyectable (__setMockPaymentHistoryNow)
// para que los meses del dashboard siempre terminen en el mes actual. El resumen
// aplica las mismas reglas que el backend (changes historial-pagos-cobros-entrenador
// y cobros-pendientes-y-vencimientos): meses en hora argentina sobre created_at,
// solo `approved` suma, neto = bruto − comisión (5%), pendientes/rechazados por
// cuota según su último intento, y cuotas esperadas sin pagar por mes.
import { STATUS_GROUP_STATUSES, statusGroupOf } from '../../utils/payment-status.js';

const PAGE_SIZE = 20;
const ART_OFFSET_MS = -3 * 60 * 60 * 1000;
const FEE_PERCENT = 5;
const feeOf = (amount) => Math.round(amount * FEE_PERCENT) / 100;
const netOf = (amount) => Math.round((amount - feeOf(amount)) * 100) / 100;

const TEAMS = [
  { id: 12, name: 'Runners del Parque', fee: 15000, runners: ['Lucía Gómez', 'Martín Pérez', 'Sofía Díaz', 'Tomás Romero', 'Valentina Ruiz'] },
  { id: 18, name: 'Trail Norte', fee: 22000, runners: ['Julián Castro', 'Camila Sosa', 'Nicolás Vega'] },
  // Equipo nuevo: solo existe en los últimos 3 meses.
  { id: 21, name: 'Pista 10K', fee: 12000, runners: ['Agustina Molina', 'Federico Ríos'], sinceMonth: 2 },
];

// Mes sin ningún cobro, para ver el bucket vacío en el gráfico.
const EMPTY_MONTH = 4;

let mockNow = null;

export function __setMockPaymentHistoryNow(date) {
  mockNow = date ? new Date(date) : null;
}

export function __resetMockPaymentHistory() {
  mockNow = null;
}

function now() {
  return mockNow ?? new Date();
}

// Partes de fecha en hora argentina.
function artParts(date) {
  const d = new Date(date.getTime() + ART_OFFSET_MS);
  return { year: d.getUTCFullYear(), month: d.getUTCMonth(), day: d.getUTCDate() };
}

// ISO UTC de un día a las 12:00 de Argentina, `monthsAgo` meses atrás.
function artNoon(monthsAgo, day, hourOffset = 0) {
  const { year, month, day: today } = artParts(now());
  const target = new Date(Date.UTC(year, month - monthsAgo, 1));
  const lastDay = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
  // En el mes actual no se generan pagos en el futuro.
  const safeDay = Math.min(day, lastDay, monthsAgo === 0 ? today : lastDay);
  return new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth(), safeDay, 15 + hourOffset)).toISOString();
}

function monthKeyART(iso) {
  const { year, month } = artParts(new Date(iso));
  return `${year}-${String(month + 1).padStart(2, '0')}`;
}

function splitName(full) {
  const [name, ...rest] = full.split(' ');
  return { name, surname: rest.join(' ') };
}

function buildReceived() {
  const rows = [];
  let id = 900;
  let installmentId = 3000;

  const push = (team, runnerIndex, inst, monthsAgo, status, day, hourOffset = 0, detail = 'accredited') => {
    const runnerId = team.id * 100 + runnerIndex;
    const { name, surname } = splitName(team.runners[runnerIndex]);
    rows.push({
      id: id++,
      mp_payment_id: String(1319990000 + id),
      status,
      status_group: statusGroupOf(status),
      status_detail: detail,
      gross_amount: team.fee,
      net_amount: status === 'approved' ? team.fee - feeOf(team.fee) : null,
      fee_amount: feeOf(team.fee),
      fee_percent: FEE_PERCENT,
      currency_id: 'ARS',
      payment_method_id: runnerIndex % 2 === 0 ? 'visa' : 'master',
      created_at: artNoon(monthsAgo, day, hourOffset),
      installment_id: inst.id,
      installment_number: inst.number,
      team: { id: team.id, name: team.name },
      payer: { id: runnerId, name, surname, email: `${name}.${surname}`.toLowerCase().replace(/\s/g, '') + '@mail.com' },
    });
  };

  for (let monthsAgo = 5; monthsAgo >= 0; monthsAgo -= 1) {
    if (monthsAgo === EMPTY_MONTH) continue;
    TEAMS.forEach((team) => {
      if (team.sinceMonth !== undefined && monthsAgo > team.sinceMonth) return;
      team.runners.forEach((_, r) => {
        const inst = { id: installmentId++, number: 6 - monthsAgo };
        const day = 3 + r * 2;
        const key = `${team.id}-${r}-${monthsAgo}`;
        switch (key) {
          // Rechazo seguido de un pago aprobado: no cuenta como rechazada.
          case '12-0-0':
            push(team, r, inst, monthsAgo, 'rejected', day, 0, 'cc_rejected_insufficient_amount');
            push(team, r, inst, monthsAgo, 'approved', day, 2);
            break;
          case '18-2-1':
            push(team, r, inst, monthsAgo, 'rejected', day, 0, 'cc_rejected_bad_filled_security_code');
            break;
          case '12-4-2':
            push(team, r, inst, monthsAgo, 'rejected', day, 0, 'cc_rejected_insufficient_amount');
            break;
          case '18-0-0':
          case '21-1-0':
            push(team, r, inst, monthsAgo, 'in_process', day, 0, 'pending_contingency');
            break;
          case '12-3-3':
            push(team, r, inst, monthsAgo, 'refunded', day, 0, 'refunded');
            break;
          default:
            push(team, r, inst, monthsAgo, 'approved', day);
        }
      });
    });
  }

  return rows.sort((a, b) => (b.created_at === a.created_at ? b.id - a.id : b.created_at.localeCompare(a.created_at)));
}

// Historial del usuario logueado: sus suscripciones de tier y lo que le pagó a
// entrenadores por pertenecer a sus equipos.
function buildHistory() {
  const rows = [];
  let id = 700;
  const tiers = {
    premium: { id: 4, name: 'Premium_entrenador', role_name: 'entrenador', amount: 9999 },
    medium: { id: 3, name: 'Medium_entrenador', role_name: 'entrenador', amount: 4999 },
  };
  const base = (status, monthsAgo, day, hourOffset, method) => ({
    id: id++,
    mp_payment_id: String(1318880000 + id),
    status,
    status_group: statusGroupOf(status),
    status_detail: status === 'approved' ? 'accredited' : 'cc_rejected_other_reason',
    currency_id: 'ARS',
    payment_method_id: method,
    created_at: artNoon(monthsAgo, day, hourOffset),
  });
  const subscription = (tier, number, monthsAgo, status, hourOffset = 0) => {
    rows.push({
      ...base(status, monthsAgo, 2, hourOffset, 'master'),
      type: 'subscription',
      amount: tier.amount,
      installment_id: 2000 + number,
      installment_number: number,
      due_date: number === 1 ? null : artNoon(monthsAgo, 5),
      tier: { id: tier.id, name: tier.name, role_name: tier.role_name },
      team: null,
      trainer: null,
    });
  };
  const trainerPayment = (number, monthsAgo, status, method, hourOffset = 0) => {
    rows.push({
      ...base(status, monthsAgo, 8, hourOffset, method),
      type: 'trainer_payment',
      amount: 18000,
      installment_id: 2500 + number,
      installment_number: number,
      due_date: number === 1 ? null : artNoon(monthsAgo, 10),
      tier: null,
      team: { id: 33, name: 'Club de Corredores Palermo' },
      trainer: { id: 51, name: 'Mariana', surname: 'Ibarra' },
    });
  };

  subscription(tiers.medium, 1, 5, 'approved');
  subscription(tiers.premium, 1, 4, 'approved');
  subscription(tiers.premium, 2, 3, 'approved');
  // Tarjeta rechazada y reintento aprobado en la misma cuota.
  subscription(tiers.premium, 3, 2, 'rejected');
  subscription(tiers.premium, 3, 2, 'approved', 3);
  subscription(tiers.premium, 4, 1, 'approved');
  subscription(tiers.premium, 5, 0, 'approved');

  trainerPayment(1, 3, 'approved', 'visa');
  trainerPayment(2, 2, 'approved', 'account_money');
  trainerPayment(3, 1, 'approved', 'debvisa');
  trainerPayment(4, 0, 'in_process', 'visa');

  return rows.sort((a, b) => (b.created_at === a.created_at ? b.id - a.id : b.created_at.localeCompare(a.created_at)));
}

// ISO UTC de un día a las 12:00 de Argentina, `monthsAgo` meses atrás (negativo =
// meses adelante). A diferencia de artNoon, puede caer en el futuro: un
// vencimiento todavía no ocurrió.
function dueAt(monthsAgo, day) {
  const { year, month } = artParts(now());
  const target = new Date(Date.UTC(year, month - monthsAgo, 1));
  const lastDay = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
  return new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth(), Math.min(day, lastDay), 15)).toISOString();
}

// Cuotas esperadas que nadie pagó: las que solo tuvieron intentos rechazados o
// en proceso, y dos que vencen más adelante en el mes actual.
function buildObligations() {
  const team = (id) => TEAMS.find((t) => t.id === id);
  const obligation = (teamId, runnerIndex, number, monthsAgo, day) => {
    const t = team(teamId);
    const { name, surname } = splitName(t.runners[runnerIndex]);
    return { team: { id: t.id, name: t.name }, payer: { id: t.id * 100 + runnerIndex, name, surname, email: '' },
      installment_number: number, amount: t.fee, due_date: dueAt(monthsAgo, day) };
  };
  return [
    obligation(12, 4, 4, 2, 11),
    obligation(18, 2, 5, 1, 7),
    obligation(18, 0, 6, 0, 3),
    obligation(21, 1, 6, 0, 5),
    obligation(21, 0, 7, 0, 28),
    obligation(18, 1, 7, 0, 30),
  ];
}

function paginate(items, page) {
  const pageNumber = page ?? 1;
  const start = (pageNumber - 1) * PAGE_SIZE;
  return { payments: items.slice(start, start + PAGE_SIZE), has_more: start + PAGE_SIZE < items.length };
}

// GET /api/v1/payments/received
export async function mockGetReceivedPayments({ page = 1, teamId, status } = {}) {
  let items = buildReceived();
  if (teamId !== undefined && teamId !== null && teamId !== '') {
    items = items.filter((p) => p.team.id === Number(teamId));
  }
  if (status) {
    const statuses = STATUS_GROUP_STATUSES[status] ?? [];
    items = items.filter((p) => statuses.includes(p.status));
  }
  return paginate(items, page);
}

// GET /api/v1/payments/history
export async function mockGetPaymentHistory({ page = 1, type, status } = {}) {
  let items = buildHistory();
  if (type) items = items.filter((p) => p.type === type);
  if (status) {
    const statuses = STATUS_GROUP_STATUSES[status] ?? [];
    items = items.filter((p) => statuses.includes(p.status));
  }
  return paginate(items, page);
}

// GET /api/v1/payments/received/summary
export async function mockGetReceivedPaymentsSummary({ months = 6, until } = {}) {
  // La ventana termina en `until` (YYYY-MM) o, sin él, en el mes actual (D14).
  const current = artParts(now());
  const [year, month] = until ? [Number(until.slice(0, 4)), Number(until.slice(5, 7)) - 1] : [current.year, current.month];
  const keys = [];
  for (let i = months - 1; i >= 0; i -= 1) {
    const d = new Date(Date.UTC(year, month - i, 1));
    keys.push(`${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`);
  }
  const inWindow = new Set(keys);
  const allRows = buildReceived();
  const rows = allRows.filter((p) => inWindow.has(monthKeyART(p.created_at)));
  const earliest = allRows.map((p) => p.created_at).sort()[0];

  const monthly = keys.map((key) => ({ month: key, gross_amount: 0, net_amount: 0, approved_count: 0, net_known_count: 0 }));
  const monthIndex = Object.fromEntries(keys.map((k, i) => [k, i]));
  const teams = new Map();
  const installments = new Map();

  rows.forEach((p) => {
    if (!teams.has(p.team.id)) {
      teams.set(p.team.id, { team_id: p.team.id, team_name: p.team.name, gross_amount: 0, net_amount: 0, approved_count: 0, net_known_count: 0, pending_count: 0, rejected_count: 0 });
    }
    const team = teams.get(p.team.id);
    const approved = p.status === 'approved';
    if (approved) {
      const m = monthly[monthIndex[monthKeyART(p.created_at)]];
      m.gross_amount += p.gross_amount;
      m.approved_count += 1;
      team.gross_amount += p.gross_amount;
      team.approved_count += 1;
      if (p.net_amount !== null) {
        m.net_amount += p.net_amount;
        m.net_known_count += 1;
        team.net_amount += p.net_amount;
        team.net_known_count += 1;
      }
    }
    const current = installments.get(p.installment_id);
    const isLater = !current || p.created_at > current.latest.created_at || (p.created_at === current.latest.created_at && p.id > current.latest.id);
    installments.set(p.installment_id, {
      latest: isLater ? p : current.latest,
      anyApproved: (current?.anyApproved ?? false) || approved,
    });
  });

  let pending = 0;
  let rejected = 0;
  const amounts = { pending: 0, pendingNet: 0, rejected: 0, rejectedNet: 0 };
  installments.forEach(({ latest, anyApproved }) => {
    if (anyApproved) return;
    const group = statusGroupOf(latest.status);
    if (group === 'pending') {
      pending += 1;
      amounts.pending += latest.gross_amount;
      amounts.pendingNet += netOf(latest.gross_amount);
      teams.get(latest.team.id).pending_count += 1;
    } else if (group === 'rejected') {
      rejected += 1;
      amounts.rejected += latest.gross_amount;
      amounts.rejectedNet += netOf(latest.gross_amount);
      teams.get(latest.team.id).rejected_count += 1;
    }
  });

  const round2 = (v) => Math.round(v * 100) / 100;
  const knownNet = (sum, count) => (count === 0 ? null : round2(sum));

  // Cuotas esperadas sin pagar: por mes de vencimiento, y las del mes actual en
  // "a vencer" (desde hoy hasta fin de mes) o "vencidas" (antes de hoy, de
  // cualquier mes: una cuota de octubre sin pagar se sigue debiendo en noviembre).
  monthly.forEach((m) => Object.assign(m, { pending_amount: 0, pending_net_amount: 0, pending_count: 0 }));
  const todayKey = (() => { const t = artParts(now()); return `${t.year}-${String(t.month + 1).padStart(2, '0')}-${String(t.day).padStart(2, '0')}`; })();
  const currentKey = todayKey.slice(0, 7);
  const block = () => ({ count: 0, amount: 0, net_amount: 0, items: [] });
  const due = block();
  const overdue = block();
  buildObligations().forEach((o) => {
    const key = monthKeyART(o.due_date);
    if (key in monthIndex) {
      const m = monthly[monthIndex[key]];
      m.pending_amount += o.amount;
      m.pending_net_amount += netOf(o.amount);
      m.pending_count += 1;
    }
    const late = o.due_date.slice(0, 10) < todayKey;
    if (!late && key !== currentKey) return;
    const target = late ? overdue : due;
    target.count += 1;
    target.amount += o.amount;
    target.net_amount += netOf(o.amount);
    target.items.push(o);
  });
  [due, overdue].forEach((b) => b.items.sort((a, c) => a.due_date.localeCompare(c.due_date)));

  return {
    currency_id: 'ARS',
    months,
    monthly: monthly.map((m) => ({ ...m, gross_amount: round2(m.gross_amount), net_amount: knownNet(m.net_amount, m.net_known_count),
      pending_amount: round2(m.pending_amount), pending_net_amount: round2(m.pending_net_amount) })),
    by_team: [...teams.values()]
      .map((t) => ({ ...t, gross_amount: round2(t.gross_amount), net_amount: knownNet(t.net_amount, t.net_known_count) }))
      .sort((a, b) => b.gross_amount - a.gross_amount || a.team_name.localeCompare(b.team_name) || a.team_id - b.team_id),
    pending_count: pending,
    rejected_count: rejected,
    pending_amount: round2(amounts.pending),
    pending_net_amount: round2(amounts.pendingNet),
    rejected_amount: round2(amounts.rejected),
    rejected_net_amount: round2(amounts.rejectedNet),
    earliest_month: earliest ? monthKeyART(earliest) : null,
    due_this_month: { ...due, amount: round2(due.amount), net_amount: round2(due.net_amount) },
    overdue: { ...overdue, amount: round2(overdue.amount), net_amount: round2(overdue.net_amount) },
    generated_at: now().toISOString(),
  };
}

// GET /api/v1/payments/upcoming — próxima cuota de cada equipo que paga el
// usuario y de cada tier: una por vencer pronto (dentro de
// HOME_DUE_WINDOW_DAYS, tono `soon`/ámbar), una atrasada (`overdue`/rojo) y
// el tier, lejos (`normal`). Las 3 son las únicas que
// homeDuePayments/dueTone distinguen -- antes las 3 quedaban `normal` salvo
// la atrasada, así que el tono ámbar nunca se pudo ver ni probar con mocks
// (bug real reportado 2026-11-09, al ajustar los colores de esta tarjeta).
export async function mockGetUpcomingPayments() {
  const { day } = artParts(now());
  const items = [
    { type: 'trainer_payment', team: { id: 33, name: 'Club de Corredores Palermo' }, trainer: { id: 51, name: 'Mariana', surname: 'Ibarra' }, tier: null,
      installment_number: 5, amount: 18000, currency_id: 'ARS', due_date: dueAt(0, day + 5), overdue: false, overdue_count: 0 },
    // Atrasado: no pagó la cuota del 15 del mes pasado (ni la de este mes, si ya pasó).
    { type: 'trainer_payment', team: { id: 40, name: 'Fondistas del Sur' }, trainer: { id: 52, name: 'Pablo', surname: 'Ruiz' }, tier: null,
      installment_number: 3, amount: 12000, currency_id: 'ARS', due_date: dueAt(1, 15), overdue: true, overdue_count: day > 15 ? 2 : 1 },
    { type: 'subscription', team: null, trainer: null, tier: { id: 4, name: 'Premium_entrenador', role_name: 'entrenador' },
      installment_number: 6, amount: 9999, currency_id: 'ARS', due_date: dueAt(-1, 5), overdue: false, overdue_count: 0 },
  ];
  return { items: items.sort((a, b) => a.due_date.localeCompare(b.due_date)) };
}
