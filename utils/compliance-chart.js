import { complianceTone } from './comparison-format.js';

// Geometría del gráfico de cumplimiento por sesión (Gap 35). Separada del
// componente para testearla sin renderizar SVG, como utils/payments-chart.js.
//
// La escala es fija de 0 a 100 %: comparar sesiones solo tiene sentido contra
// el mismo techo. Una sesión con 0 % igual muestra un trazo mínimo para que se
// vea que existió. Con muchas sesiones las etiquetas de fecha se espacian para
// no pisarse (`minLabelSpacing`).

const MIN_VISIBLE_HEIGHT = 2;

export function buildComplianceBars(sessions, { width, height, gap = 6, labelHeight = 18, valueHeight = 16, minLabelSpacing = 40 } = {}) {
  const list = sessions ?? [];
  if (!list.length || !width || width <= 0 || !height || height <= 0) return [];

  const effectiveGap = list.length > 20 ? Math.min(gap, 2) : gap;
  const barWidth = Math.max(1, (width - effectiveGap * (list.length - 1)) / list.length);
  const plotHeight = Math.max(0, height - labelHeight - valueHeight);
  const slot = barWidth + effectiveGap;
  const labelEvery = Math.max(1, Math.ceil(minLabelSpacing / slot));
  // Con barras angostas el valor no entra arriba: se muestra solo el de las
  // barras que también llevan etiqueta.
  const showAllValues = barWidth >= 26;

  return list.map((s, i) => {
    const pct = Math.max(0, Math.min(100, Number(s.compliancePct) || 0));
    const barHeight = Math.max((pct / 100) * plotHeight, MIN_VISIBLE_HEIGHT);
    const labeled = i % labelEvery === 0 || i === list.length - 1;
    return {
      sessionInstanceId: s.sessionInstanceId,
      date: s.date,
      compliancePct: pct,
      tone: s.countsForAverage === false ? 'pending' : complianceTone(pct),
      x: i * slot,
      y: valueHeight + (plotHeight - barHeight),
      width: barWidth,
      height: barHeight,
      labelY: height - 4,
      showLabel: labeled,
      showValue: showAllValues || labeled,
    };
  });
}

// "12/10" para la etiqueta de la barra.
export function shortDateLabel(isoDate) {
  if (!isoDate) return '';
  const [, month, day] = String(isoDate).slice(0, 10).split('-');
  return `${day}/${month}`;
}
