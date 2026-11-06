// Geometría del gráfico de barras de cobros mensuales. Separada del componente
// para poder testearla sin renderizar SVG.
//
// Cada barra deja arriba lugar para su valor y abajo para el nombre del mes.
// Un mes con cobros nunca queda con altura 0: se le da un mínimo visible.
// `points` es [{ month, value, partial, missing, pending }] (ver toChartPoints):
// el valor ya viene elegido según el modo bruto/neto, y un punto sin dato vale 0.
// Si algún mes tiene pendiente, cada mes lleva dos barras lado a lado (cobrado y
// pendiente) con la misma escala; si no, una sola como siempre.

const MIN_VISIBLE_HEIGHT = 3;
// Separación entre la barra de cobrado y la de pendiente de un mismo mes.
const PAIR_GAP = 4;

// `currentMonth` ('YYYY-MM') resalta el mes actual; con la ventana corrida hacia
// atrás no hay ninguna barra resaltada. Sin él, se resalta la última.
export function buildMonthlyBars(points, { width, height, gap = 10, labelHeight = 18, valueHeight = 16, currentMonth } = {}) {
  const list = points ?? [];
  if (!list.length || !width || width <= 0 || !height || height <= 0) return [];

  const slotWidth = Math.max(0, (width - gap * (list.length - 1)) / list.length);
  const plotHeight = Math.max(0, height - labelHeight - valueHeight);
  const hasPending = list.some((m) => (m.pending ?? 0) > 0);
  const barWidth = hasPending ? Math.max(0, (slotWidth - PAIR_GAP) / 2) : slotWidth;
  const max = Math.max(0, ...list.flatMap((m) => [m.value ?? 0, m.pending ?? 0]));
  const heightOf = (value) => {
    const h = max > 0 ? (value / max) * plotHeight : 0;
    return value > 0 ? Math.max(h, MIN_VISIBLE_HEIGHT) : h;
  };

  return list.map((m, i) => {
    const value = m.value ?? 0;
    const x = i * (slotWidth + gap);
    const barHeight = heightOf(value);
    const pendingValue = m.pending ?? 0;
    const pendingHeight = heightOf(pendingValue);
    return {
      month: m.month,
      value,
      x,
      y: valueHeight + (plotHeight - barHeight),
      width: barWidth,
      height: barHeight,
      centerX: x + slotWidth / 2,
      labelY: height - 4,
      isCurrent: currentMonth ? m.month === currentMonth : i === list.length - 1,
      partial: Boolean(m.partial),
      missing: Boolean(m.missing),
      pending: hasPending
        ? { value: pendingValue, x: x + barWidth + PAIR_GAP, y: valueHeight + (plotHeight - pendingHeight), width: barWidth, height: pendingHeight }
        : null,
    };
  });
}
