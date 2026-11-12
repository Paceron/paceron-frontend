import { KIND_LABELS } from './calendar-kind-colors.js';

export function buildCalendarDayTooltipLabel(marking) {
  if (!marking || marking.kind === 'rest') return null;
  const kindLabel = KIND_LABELS[marking.kind] ?? KIND_LABELS.other;
  if (marking.isPresencial && marking.presencialTimeFrom && marking.presencialTimeTo) {
    return `${kindLabel} · ${marking.presencialTimeFrom}–${marking.presencialTimeTo}`;
  }
  return kindLabel;
}
