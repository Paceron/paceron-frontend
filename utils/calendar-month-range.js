// Exportado (no privado) — group-calendar-screen.jsx lo usa directo para
// su currentMonthISO, no solo a través de monthRange.
export function pad2(n) {
  return String(n).padStart(2, '0');
}

// Rango YYYY-MM-DD del mes visible en un calendario — compartido entre
// group-calendar-screen.jsx y las pantallas de vista agregada
// (my-calendar-screen.jsx, administered-calendar-screen.jsx).
export function monthRange(year, month) {
  const from = `${year}-${pad2(month)}-01`;
  const lastDay = new Date(year, month, 0).getDate();
  const to = `${year}-${pad2(month)}-${pad2(lastDay)}`;
  return { from, to };
}

// Mes anterior/siguiente al dado — usado para precargar (TanStack Query
// prefetch) los meses vecinos al que se está viendo, sin duplicar la
// aritmética de rollover de año en cada hook que lo necesite.
export function adjacentMonths(year, month) {
  const prev = month === 1 ? { year: year - 1, month: 12 } : { year, month: month - 1 };
  const next = month === 12 ? { year: year + 1, month: 1 } : { year, month: month + 1 };
  return { prev, next };
}
