import {
  averageBasisLabel,
  averageValueLabel,
  formatComparisonDate,
  formatCompliance,
  formatPace,
  formatSchedule,
  kindLabel,
  PENDING_AVERAGE_LABEL,
  plannedExerciseLabel,
  roleLabel,
  sessionStatusLabel,
  setActualLabel,
  setDeviationLabel,
  totalsDistanceLabel,
  totalsDurationLabel,
} from './comparison-format.js';

// HTML del PDF de la comparación (Gap 35). Puro y testeable: lo imprime
// services/receipt (expo-print en nativo, iframe en web), igual que los
// comprobantes de pago. Todo lo que viene del backend pasa por escapeHtml.

const HTML_ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
export const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => HTML_ESCAPES[char]);

const STYLES = `
  @page { size: A4; margin: 16mm; }
  body { font-family: -apple-system, 'Segoe UI', Roboto, Arial, sans-serif; color: #111518; font-size: 12px; }
  h1 { font-size: 20px; margin: 0 0 4px; }
  h2 { font-size: 14px; margin: 18px 0 6px; }
  .muted { color: #5b6470; }
  .pct { font-size: 28px; font-weight: 700; color: #4f7a12; }
  table { width: 100%; border-collapse: collapse; margin-top: 6px; }
  th, td { text-align: left; padding: 5px 6px; border-bottom: 1px solid #dde1d6; vertical-align: top; }
  th { font-size: 10px; text-transform: uppercase; letter-spacing: .04em; color: #5b6470; }
  td.num, th.num { text-align: right; }
  .brand { color: #8cc63e; font-weight: 700; letter-spacing: .08em; text-transform: uppercase; font-size: 10px; }
`;

function page(title, body) {
  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>${escapeHtml(title)}</title><style>${STYLES}</style></head><body>${body}</body></html>`;
}

export function buildSessionComparisonHtml(comparison) {
  const c = comparison ?? {};
  const schedule = formatSchedule(c.startedAt, c.endedAt);
  const meta = [formatComparisonDate(c.date), schedule, c.teamName, c.groupName, (c.kinds ?? []).map(kindLabel).join(', ')].filter(Boolean).map(escapeHtml).join(' · ');
  const exercises = (c.exercises ?? []).map((ex) => {
    const rows = ex.sets.map((set) => `<tr>
        <td>${escapeHtml(set.extra ? `${set.setNumber} (extra)` : set.setNumber)}</td>
        <td>${escapeHtml(setActualLabel(set))}</td>
        <td>${escapeHtml(formatPace(set.paceSecPerKm) ?? '—')}</td>
        <td>${escapeHtml(setDeviationLabel(set) ?? 'Sin objetivo')}</td>
        <td class="num">${escapeHtml(set.extra ? '—' : formatCompliance(set.compliancePct))}</td>
      </tr>`).join('');
    return `<h2>${escapeHtml(ex.name)} <span class="muted">· ${escapeHtml(roleLabel(ex.role))} · ${escapeHtml(plannedExerciseLabel(ex.planned))}</span></h2>
      <table><thead><tr><th>Serie</th><th>Realizado</th><th>Ritmo</th><th>Desviación</th><th class="num">Cumplimiento</th></tr></thead><tbody>${rows}</tbody></table>
      <p class="muted">Cumplimiento del ejercicio: ${escapeHtml(formatCompliance(ex.compliancePct))}</p>`;
  }).join('');
  const body = `<div class="brand">Paceron · planificado vs realizado</div>
    <h1>${escapeHtml(c.sessionName)}</h1>
    <p class="muted">${meta}</p>
    <div class="pct">${escapeHtml(formatCompliance(c.compliancePct))}</div>
    <p class="muted">${escapeHtml(sessionStatusLabel(c.status))} · Duración ${escapeHtml(totalsDurationLabel(c.totals))} · Distancia ${escapeHtml(totalsDistanceLabel(c.totals))}</p>
    ${exercises}`;
  return page(`Comparación ${c.sessionName ?? ''}`, body);
}

export function buildRangeComparisonHtml(list) {
  const l = list ?? {};
  const rows = (l.sessions ?? []).map((s) => `<tr>
      <td>${escapeHtml(formatComparisonDate(s.date))}</td>
      <td>${escapeHtml(s.sessionName)}</td>
      <td>${escapeHtml((s.kinds ?? []).map(kindLabel).join(', '))}</td>
      <td>${escapeHtml(sessionStatusLabel(s.status))}${s.countsForAverage === false ? `<br><span class="muted">${escapeHtml(PENDING_AVERAGE_LABEL)}</span>` : ''}</td>
      <td class="num">${escapeHtml(`${s.totals.completedSets}/${s.totals.plannedSets}`)}</td>
      <td class="num">${escapeHtml(formatCompliance(s.compliancePct))}</td>
    </tr>`).join('');
  const summary = l.summary ?? {};
  const body = `<div class="brand">Paceron · planificado vs realizado</div>
    <h1>Cumplimiento del ${escapeHtml(formatComparisonDate(l.dateFrom))} al ${escapeHtml(formatComparisonDate(l.dateTo))}</h1>
    <div class="pct">${escapeHtml(averageValueLabel(summary))}</div>
    <p class="muted">${escapeHtml(summary.sessionsPlanned ?? 0)} sesiones planificadas · ${escapeHtml(summary.sessionsWithActivity ?? 0)} con actividad${averageBasisLabel(summary) ? ` · ${escapeHtml(averageBasisLabel(summary))}` : ''}</p>
    <table><thead><tr><th>Fecha</th><th>Sesión</th><th>Tipos</th><th>Estado</th><th class="num">Series</th><th class="num">Cumplimiento</th></tr></thead><tbody>${rows}</tbody></table>`;
  return page('Comparación de entrenamientos', body);
}
