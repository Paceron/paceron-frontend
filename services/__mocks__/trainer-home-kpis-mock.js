// Respuesta de demostración para GET /dashboard/trainer-home-kpis. Es un
// fixture de API, no lógica que use el Home para calcular sus KPIs.
function parseDate(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value ?? ''));
  return match ? new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]))) : new Date();
}

function isoDate(date) {
  return date.toISOString().slice(0, 10);
}

function periodRange(period, referenceDate) {
  const anchor = parseDate(referenceDate);
  let from;
  let to;
  if (period === 'day') {
    from = anchor;
    to = anchor;
  } else if (period === 'week') {
    const offset = (anchor.getUTCDay() + 6) % 7;
    from = new Date(anchor.getTime() - offset * 86_400_000);
    to = new Date(from.getTime() + 6 * 86_400_000);
  } else {
    from = new Date(Date.UTC(anchor.getUTCFullYear(), anchor.getUTCMonth(), 1));
    to = new Date(Date.UTC(anchor.getUTCFullYear(), anchor.getUTCMonth() + 1, 0));
  }
  return { from, to };
}

export async function mockGetTrainerHomeKpis({ period = 'month', referenceDate } = {}) {
  const anchor = referenceDate || isoDate(new Date());
  const { from, to } = periodRange(period, anchor);
  return {
    period,
    reference_date: anchor,
    from: isoDate(from),
    to: isoDate(to),
    days_considered: Math.round((to.getTime() - from.getTime()) / 86_400_000) + 1,
    sessions: { scheduled: 18, realized: 12, presencial_scheduled: 8, presencial_realized: 6 },
    structure: { active_teams: 2, active_runners: 17 },
    collections: { currency_id: 'ARS', net_collected: 286500.5, pending_amount: 30000, pending_count: 3 },
  };
}
