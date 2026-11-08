import { KIND_ORDER } from './calendar-kind-colors.js';

// Cuenta los días de un mes por `kind`, en el orden fijo de KIND_ORDER --
// usado por la franja de resumen del calendario de grupo
// (group-calendar-screen.jsx). `days` ya viene recortado al mes visible
// (useGroupCalendar(groupId, from, to)) y solo trae los días con algo
// asignado -- sin fila para un día no es "sin dato", es que nunca se
// tocó, así que no entra en ningún conteo.
export function summarizeMonthDays(days) {
  const counts = Object.fromEntries(KIND_ORDER.map((kind) => [kind, 0]));
  for (const day of days ?? []) {
    if (counts[day.kind] !== undefined) counts[day.kind] += 1;
  }
  return counts;
}
