// Cuotas para avisar en el Home y a qué pantalla lleva "Pagar". Se alimenta de
// GET /payments/upcoming (toUpcomingPaymentModel): la próxima cuota sin pagar
// de cada equipo y de cada tier del usuario.

const DAY_MS = 24 * 60 * 60 * 1000;

// Cuántos días antes del vencimiento una cuota pasa a mostrarse en el Home.
export const HOME_DUE_WINDOW_DAYS = 10;

// Las vencidas siempre; las demás, si vencen dentro de la ventana. Mantiene el
// orden que trae el backend (por vencimiento).
export function homeDuePayments(items, now = new Date(), days = HOME_DUE_WINDOW_DAYS) {
  const limit = now.getTime() + days * DAY_MS;
  return (items ?? []).filter((item) => {
    if (!item) return false;
    if (item.overdue) return true;
    const due = item.dueDate ? new Date(item.dueDate).getTime() : NaN;
    return Number.isFinite(due) && due <= limit;
  });
}

// Ruta que abre el pago de esa cuota con el checkout ya iniciado (`pay=1`).
// Las cuotas de tier van a la pantalla de tiers del rol de ESA suscripción, que
// no tiene por qué ser el rol activo. null si no hay a dónde ir.
export function payRouteFor(item) {
  if (!item) return null;
  if (item.type === 'subscription') {
    return { pathname: '/profile/tier-upgrade', params: item.tierRoleName ? { pay: '1', role: item.tierRoleName } : { pay: '1' } };
  }
  if (item.teamId == null) return null;
  return { pathname: '/teams/[teamId]/subscription', params: { teamId: String(item.teamId), pay: '1' } };
}
