// Formato de moneda único del repo. Vivía inline en
// components/profile/tier-upgrade-screen.jsx (formatTierPrice); se extrajo al
// sumar el pago de membresía de equipo y el historial de pagos, que lo
// necesitan en varias pantallas.
//
// Sin decimales por default: los montos del negocio son pesos redondos
// (mensualidades, cuotas de tier). Los que traen centavos (el neto que informa
// Mercado Pago, el comprobante) piden `decimals: 2`. Intl con es-AR inserta un
// espacio duro (NBSP) entre el signo y el número: los tests lo normalizan.
const formatters = new Map();

function getFormatter(decimals) {
  if (!formatters.has(decimals)) {
    formatters.set(
      decimals,
      new Intl.NumberFormat('es-AR', {
        style: 'currency',
        currency: 'ARS',
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
      })
    );
  }
  return formatters.get(decimals);
}

// "$ 15.000" (o "$ 14.101,50" con decimals: 2).
// Devuelve null (no "$ 0") cuando no hay un monto real. El descarte explícito
// de null/undefined/'' es necesario porque Number(null) y Number('') dan 0, que
// es finito: sin este guard, "todavía no sé el precio" se mostraría como un
// precio de cero.
export function formatArs(amount, { decimals = 0 } = {}) {
  if (amount === null || amount === undefined || String(amount).trim() === '') return null;
  const value = Number(amount);
  if (!Number.isFinite(value)) return null;
  return getFormatter(decimals).format(value);
}

// Precio de una membresía/suscripción: 0 (o nada) es "Gratis", no "$ 0" — un
// equipo sin cuota no cobra, y mostrar un monto cero se lee como un error.
export function formatMonthlyFee(amount) {
  const formatted = formatArs(amount);
  if (formatted === null || Number(amount) <= 0) return 'Gratis';
  return formatted;
}

// Versión corta para etiquetas de gráfico: "$45 mil", "$1,3 M", "$900".
// Hecha a mano: notation: 'compact' no es confiable en Hermes.
export function formatARSCompact(amount) {
  const n = Number(amount) || 0;
  const abs = Math.abs(n);
  const sign = n < 0 ? '-' : '';
  if (abs >= 1e6) return `${sign}$${oneDecimal(abs / 1e6)} M`;
  if (abs >= 1e3) return `${sign}$${oneDecimal(abs / 1e3)} mil`;
  return `${sign}$${Math.round(abs)}`;
}

function oneDecimal(value) {
  return value.toFixed(1).replace('.', ',').replace(/,0$/, '');
}
