// Geometría del gráfico de barras de cobros mensuales. Separada del componente
// para poder testearla sin renderizar SVG.
//
// Cada barra deja arriba lugar para su valor y abajo para el nombre del mes.
// Un mes con cobros nunca queda con altura 0: se le da un mínimo visible.
// `points` es [{ month, value, partial, missing }] (ver toChartPoints): el valor
// ya viene elegido según el modo bruto/neto, y un punto sin dato vale 0.

const MIN_VISIBLE_HEIGHT = 3;

// `currentMonth` ('YYYY-MM') resalta el mes actual; con la ventana corrida hacia
// atrás no hay ninguna barra resaltada. Sin él, se resalta la última.
export function buildMonthlyBars(points, { width, height, gap = 10, labelHeight = 18, valueHeight = 16, currentMonth } = {}) {
  const list = points ?? [];
  if (!list.length || !width || width <= 0 || !height || height <= 0) return [];

  const barWidth = Math.max(0, (width - gap * (list.length - 1)) / list.length);
  const plotHeight = Math.max(0, height - labelHeight - valueHeight);
  const max = Math.max(0, ...list.map((m) => m.value ?? 0));

  return list.map((m, i) => {
    const value = m.value ?? 0;
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
      isCurrent: currentMonth ? m.month === currentMonth : i === list.length - 1,
      partial: Boolean(m.partial),
      missing: Boolean(m.missing),
    };
  });
}
