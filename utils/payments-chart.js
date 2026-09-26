// Geometría del gráfico de barras de cobros mensuales. Separada del componente
// para poder testearla sin renderizar SVG.
//
// Cada barra deja arriba lugar para su valor y abajo para el nombre del mes.
// Un mes con cobros nunca queda con altura 0: se le da un mínimo visible.

const MIN_VISIBLE_HEIGHT = 3;

export function buildMonthlyBars(monthly, { width, height, gap = 10, labelHeight = 18, valueHeight = 16 } = {}) {
  const list = monthly ?? [];
  if (!list.length || !width || width <= 0 || !height || height <= 0) return [];

  const barWidth = Math.max(0, (width - gap * (list.length - 1)) / list.length);
  const plotHeight = Math.max(0, height - labelHeight - valueHeight);
  const max = Math.max(0, ...list.map((m) => m.grossAmount ?? 0));

  return list.map((m, i) => {
    const value = m.grossAmount ?? 0;
    let barHeight = max > 0 ? (value / max) * plotHeight : 0;
    if (value > 0) barHeight = Math.max(barHeight, MIN_VISIBLE_HEIGHT);
    return {
      month: m.month,
      value,
      x: i * (barWidth + gap),
      y: valueHeight + (plotHeight - barHeight),
      width: barWidth,
      height: barHeight,
      labelY: height - 4,
      isCurrent: i === list.length - 1,
    };
  });
}
