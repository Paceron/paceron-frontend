const COMPARABLE_KINDS = new Set(['ritmo_continuo', 'velocidad_distancia', 'velocidad_tiempo']);

function dateLabel(isoDate) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(isoDate ?? ''));
  return match ? `${match[3]}/${match[2]}/${match[1]}` : String(isoDate ?? '');
}

// GET /dashboard/exercises/{id}/series es paginado y devuelve una fila por set.
// Los selectores necesitan una sola opción por ejecución: la fecha es etiqueta,
// no identidad, porque puede repetirse en un mismo día.
export function buildDashboardSessionOptions(items = []) {
  const bySession = new Map();
  (Array.isArray(items) ? items : []).forEach((item) => {
    const id = item?.session_instance_id;
    if (id === null || id === undefined || id === '') return;
    const key = String(id);
    const existing = bySession.get(key);
    if (existing) {
      existing.seriesCount += 1;
      return;
    }
    const date = String(item.session_date ?? '');
    bySession.set(key, {
      id,
      date,
      name: `${dateLabel(date) || 'Fecha desconocida'} · sesión ${key}`,
      seriesCount: 1,
    });
  });

  return [...bySession.values()].sort((a, b) => {
    const dateOrder = b.date.localeCompare(a.date);
    if (dateOrder !== 0) return dateOrder;
    return String(a.id).localeCompare(String(b.id), undefined, { numeric: true });
  });
}

export function dashboardSessionExercises(exercises = []) {
  return (Array.isArray(exercises) ? exercises : []).filter((exercise) => COMPARABLE_KINDS.has(exercise?.kind));
}

// Cambiar cualquiera de los campos que define la ejecución invalida la sesión
// seleccionada; cambiar la sesión no debe borrar los otros tres filtros.
export function updateDashboardSessionSide(current = {}, key, value) {
  return {
    ...current,
    [key]: value == null ? '' : String(value),
    ...(key === 'sessionInstanceId' ? {} : { sessionInstanceId: '' }),
  };
}

export function reconcileDashboardSessionId(options = [], sessionInstanceId) {
  if (sessionInstanceId === null || sessionInstanceId === undefined || sessionInstanceId === '') return '';
  return (options ?? []).some((option) => String(option.id) === String(sessionInstanceId))
    ? String(sessionInstanceId)
    : '';
}

// Prepara las coordenadas de entrada del scatter sin calcular velocidades: Y es
// `speed_kph` del backend y X el número de serie que ya trae cada punto.
export function buildDashboardComparisonChartPoints(a, b) {
  return [
    ...(a?.series ?? []).map((point, index) => ({ side: 'a', index, point, x: point.set_number, y: point.speed_kph })),
    ...(b?.series ?? []).map((point, index) => ({ side: 'b', index, point, x: point.set_number, y: point.speed_kph })),
  ];
}
