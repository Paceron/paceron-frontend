// Simula los endpoints del historial de pagos para EXPO_PUBLIC_USE_MOCKS=true.
//
// Los datos se generan relativos a un "hoy" inyectable (__setMockPaymentHistoryNow)
// para que los meses del dashboard siempre terminen en el mes actual. El resumen
// aplica las mismas reglas que el backend (change historial-pagos-cobros-entrenador):
// meses en hora argentina sobre created_at, solo `approved` suma, neto solo si
// existe, y pendientes/rechazados por cuota según su último intento.
import { STATUS_GROUP_STATUSES, statusGroupOf } from '../../utils/payment-status.js';

const PAGE_SIZE = 20;
const ART_OFFSET_MS = -3 * 60 * 60 * 1000;
const NET_RATIO = 0.9401;

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
    const withNet = status === 'approved' && (runnerIndex + monthsAgo) % 5 < 3;
    const { name, surname } = splitName(team.runners[runnerIndex]);
    rows.push({
      id: id++,
      mp_payment_id: String(1319990000 + id),
      status,
      status_group: statusGroupOf(status),
      status_detail: detail,
      gross_amount: team.fee,
      net_amount: withNet ? Math.round(team.fee * NET_RATIO * 100) / 100 : null,
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
export async function mockGetReceivedPaymentsSummary({ months = 6 } = {}) {
  const { year, month } = artParts(now());
  const keys = [];
  for (let i = months - 1; i >= 0; i -= 1) {
    const d = new Date(Date.UTC(year, month - i, 1));
    keys.push(`${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`);
  }
  const inWindow = new Set(keys);
  const rows = buildReceived().filter((p) => inWindow.has(monthKeyART(p.created_at)));

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
  installments.forEach(({ latest, anyApproved }) => {
    if (anyApproved) return;
    const group = statusGroupOf(latest.status);
    if (group === 'pending') {
      pending += 1;
      teams.get(latest.team.id).pending_count += 1;
    } else if (group === 'rejected') {
      rejected += 1;
      teams.get(latest.team.id).rejected_count += 1;
    }
  });

  const round2 = (v) => Math.round(v * 100) / 100;
  const knownNet = (sum, count) => (count === 0 ? null : round2(sum));

  return {
    currency_id: 'ARS',
    months,
    monthly: monthly.map((m) => ({ ...m, gross_amount: round2(m.gross_amount), net_amount: knownNet(m.net_amount, m.net_known_count) })),
    by_team: [...teams.values()]
      .map((t) => ({ ...t, gross_amount: round2(t.gross_amount), net_amount: knownNet(t.net_amount, t.net_known_count) }))
      .sort((a, b) => b.gross_amount - a.gross_amount || a.team_name.localeCompare(b.team_name) || a.team_id - b.team_id),
    pending_count: pending,
    rejected_count: rejected,
    generated_at: now().toISOString(),
  };
}
