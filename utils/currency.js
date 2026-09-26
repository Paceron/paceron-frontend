// Formateo de montos en pesos argentinos.
//
// Antes vivía inline en tier-upgrade-screen.jsx (formatTierPrice). Intl con
// es-AR inserta un espacio duro (NBSP) entre el signo y el número: los tests lo
// normalizan antes de comparar.

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

// "$ 15.000" (o "$ 14.101,50" con decimals: 2). Devuelve '' si no hay monto.
export function formatARS(amount, { decimals = 0 } = {}) {
  if (amount === null || amount === undefined || Number.isNaN(Number(amount))) return '';
  return getFormatter(decimals).format(Number(amount));
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
