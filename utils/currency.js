// Formato de moneda único del repo. Vivía inline en
// components/profile/tier-upgrade-screen.jsx (formatTierPrice); se extrajo al
// sumar el pago de membresía de equipo, que lo necesita en la búsqueda, la
// invitación, el banner de pendiente, la pantalla de pago y los forms de equipo.
//
// Sin decimales a propósito: los montos del negocio son pesos redondos
// (mensualidades, cuotas de tier) y ARS con centavos solo agrega ruido visual.
const ARS_FORMATTER = new Intl.NumberFormat('es-AR', {
  style: 'currency',
  currency: 'ARS',
  maximumFractionDigits: 0,
});

// Devuelve null (no "$ 0") cuando no hay un monto real. El descarte explícito
// de null/undefined/'' es necesario porque Number(null) y Number('') dan 0, que
// es finito: sin este guard, "todavía no sé el precio" se mostraría como un
// precio de cero.
export function formatArs(amount) {
  if (amount === null || amount === undefined || String(amount).trim() === '') return null;
  const value = Number(amount);
  if (!Number.isFinite(value)) return null;
  return ARS_FORMATTER.format(value);
}

// Precio de una membresía/suscripción: 0 (o nada) es "Gratis", no "$ 0" — un
// equipo sin cuota no cobra, y mostrar un monto cero se lee como un error.
export function formatMonthlyFee(amount) {
  const formatted = formatArs(amount);
  if (formatted === null || Number(amount) <= 0) return 'Gratis';
  return formatted;
}
