// Fechas (lunes a domingo, ISO YYYY-MM-DD) de una semana calendario --
// `weekOffset=0` es la semana que contiene `referenceDate` (hoy por
// default), `weekOffset=1` la anterior, etc. Pura y testeada a propósito
// (vista semanal navegable de la grilla de rachas, 2026-10-15).
export function getWeekDates(weekOffset, referenceDate = new Date()) {
  const ref = new Date(referenceDate);
  const dayOfWeek = ref.getDay(); // 0=domingo..6=sábado
  const daysSinceMonday = (dayOfWeek + 6) % 7;
  const monday = new Date(ref);
  monday.setDate(ref.getDate() - daysSinceMonday - weekOffset * 7);

  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return d.toISOString().slice(0, 10);
  });
}

// ¿Se puede retroceder una semana más sin salir del rango de días que ya
// trajo el backend? `fetchedDays` es la cantidad total de días pedidos
// (ver hooks/use-streaks.js) -- generoso a propósito, no hace falta ser
// exacto al día: una semana parcialmente fuera de rango simplemente
// muestra huecos sin dato (ver `streakDayVisual`/'unknown' en el caller).
export function canGoOlder(weekOffset, fetchedDays) {
  return (weekOffset + 1) * 7 <= fetchedDays + 6;
}
