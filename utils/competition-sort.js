// `endAt`/`startAt` son ISO datetime strings -- Date.parse las compara bien
// sin parsing manual, a diferencia del bug de calendar-today.js (ahí el
// problema era un string FECHA-SOLA, sin hora; acá siempre viene con hora
// y zona, Date.parse es seguro).

function byEndAtAscending(a, b) {
  return new Date(a.endAt).getTime() - new Date(b.endAt).getTime();
}

function byStartAtDescending(a, b) {
  return new Date(b.startAt).getTime() - new Date(a.startAt).getTime();
}

// Orden compartido por las dos funciones de este archivo: dentro de un
// mismo grupo (preview: todas; lista: cada status), metric antes que
// route, metric ordenado por cierre más próximo, route por más reciente.
function sortByTypeAndDate(competitions) {
  const metric = competitions.filter((c) => c.type === 'metric').sort(byEndAtAscending);
  const route = competitions.filter((c) => c.type !== 'metric').sort(byStartAtDescending);
  return [...metric, ...route];
}

export function sortCompetitionsForPreview(competitions) {
  return sortByTypeAndDate(competitions);
}

const STATUS_PRIORITY = { active: 0, pending_approval: 1 };

export function sortCompetitionsForList(competitions) {
  const groups = new Map();
  competitions.forEach((c) => {
    const priority = STATUS_PRIORITY[c.status] ?? 2;
    if (!groups.has(priority)) groups.set(priority, []);
    groups.get(priority).push(c);
  });
  return [...groups.keys()].sort((a, b) => a - b).flatMap((priority) => sortByTypeAndDate(groups.get(priority)));
}
