// El backend devuelve una fila por serie (workout_feedback), pero el
// historial se navega por SESIÓN -- una serie suelta no es una unidad útil
// para ver/editar/eliminar. Esta función agrupa las filas ya filtradas (por
// fecha/equipo/grupo/ejercicio/corredor, aplicados server-side antes de
// llegar acá) por sesión+corredor, preservando el orden de llegada (ya viene
// ordenado por el backend según `sort`/`order`).
export function groupHistoryItemsBySession(items) {
  const order = [];
  const map = new Map();

  for (const item of items) {
    const key = `${item.sessionInstanceId}:${item.athleteUserId}`;
    let group = map.get(key);
    if (!group) {
      group = {
        id: key,
        sessionInstanceId: item.sessionInstanceId,
        athleteUserId: item.athleteUserId,
        athleteName: item.athleteName,
        date: item.date,
        sessionName: item.sessionName,
        teamId: item.teamId,
        teamName: item.teamName,
        groupId: item.groupId,
        groupName: item.groupName,
        itemIds: [],
        completedCount: 0,
        skippedCount: 0,
        totalCount: 0,
      };
      map.set(key, group);
      order.push(key);
    }
    group.itemIds.push(item.id);
    group.totalCount += 1;
    if (item.completionStatus === 'completed') group.completedCount += 1;
    else if (item.completionStatus === 'skipped') group.skippedCount += 1;
  }

  return order.map((key) => map.get(key));
}
